#!/usr/bin/env node
/**
 * P2-5: teamcontext-news 行为测试
 *
 * 测试原则：
 * - 不复制生产逻辑到测试
 * - 不 inspect teamContext.js 源码字符串 (no eval/regex on production module)
 * - 直接 require 生产模块,覆盖真实行为
 * - mock fetch 控制 API 返回值
 *
 * 例外：Part A 的 buildContextAwareSearchTerms 是 pure function 但未导出,
 * 通过 eval(function body) 提取，这是访问该函数的唯一入口。
 */
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }

console.log('━━━ teamcontext-news tests (real module, mocked Tavily) ━━━');

// ── Module mock: bypass better-sqlite3 NODE_MODULE_VERSION mismatch ──
const Module = require('module');
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === './db' && this.filename && this.filename.includes('/lib/')) {
    return { db: { prepare: () => ({ all: () => [] }) }, DB_PATH: ':memory:' };
  }
  return origRequire.apply(this, arguments);
};

function freshModule() {
  delete require.cache[require.resolve('../lib/teamContext')];
  delete require.cache[require.resolve('../lib/crossMatchEffect')];
  return require('../lib/teamContext');
}

// ── fetch mock ──
const origFetch = globalThis.fetch;
let fetchCalls = [];

function setFetch(fn) {
  fetchCalls = [];
  globalThis.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const body = args[1]?.body ? JSON.parse(args[1].body) : {};
    fetchCalls.push({ url, query: body.query });
    return fn(url, body);
  };
}

async function run(fn, label) {
  try { await fn(); } catch (e) { console.error(`  ❌ ${label}: ${e.message}`); failed++; }
}

// ── TAVILY_API_KEY — set globally, B9 deletes/restores locally ──
const ORIG_KEY = process.env.TAVILY_API_KEY;
process.env.TAVILY_API_KEY = 'test-key';

(async () => {

// ═══ Part A: buildContextAwareSearchTerms (pure fn via eval, only entry) ═══

{
  const newsSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'routes', 'news.js'), 'utf8');
  const fnMatch = newsSrc.match(/function buildContextAwareSearchTerms\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  if (!fnMatch) { console.error('❌ Could not extract buildContextAwareSearchTerms'); process.exit(1); }
  const buildContextAwareSearchTerms = eval(`(${fnMatch[0]})`);

  const ctx = { homeTeam: 'Germany', awayTeam: 'Argentina', homeId: '481', awayId: '202' };

  {
    const terms = buildContextAwareSearchTerms(ctx, { isFinished: false });
    assert(terms.length >= 5, `A1 base pre-match: ${terms.length} ≥ 5`);
  }
  {
    const post = buildContextAwareSearchTerms({ ...ctx, homeScore: 1, awayScore: 0 }, { isFinished: true });
    assert(post.some(t => t.includes('result') || t.includes('recap')), 'A2 post-match includes result/recap');
  }
  {
    const getElo = (id) => (id === '481' ? 2000 : 1400);
    const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getElo });
    assert(terms.some(t => t.includes('upset')), 'A3 Elo diff → upset');
  }
  {
    const getStyle = (id) => (id === '481' ? 'attacking' : 'defensive');
    const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getStyle });
    assert(terms.some(t => /low.?block|defensive/i.test(t)), 'A4 att vs def → tactical clash');
  }
  {
    const terms = buildContextAwareSearchTerms({ ...ctx, weatherCondition: 'rain' }, { isFinished: false });
    assert(terms.some(t => t.includes('weather')), 'A5 rain → weather query');
  }
  {
    const getQual = () => ({ stage: 'knockout' });
    const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getQualification: getQual });
    assert(terms.some(t => t.includes('must win')), 'A6 knockout → must win');
  }
  {
    const terms = buildContextAwareSearchTerms(ctx, { isFinished: false,
      getElo: () => 1600, getStyle: () => 'balanced', getQualification: () => ({ stage: 'knockout' }),
    });
    assert(terms.length <= 8, `A7 max 8: ${terms.length}`);
    const norms = terms.map(t => t.toLowerCase().trim());
    assert(new Set(norms).size === terms.length, 'A8 all unique');
  }
}

// ═══ Part B: requestTeamNews — real module, mocked fetch ═══

// B1: Tavily returns results → headlines injected + fetch was called
await run(async () => {
  const tm = freshModule();
  setFetch(() => ({
    ok: true,
    json: async () => ({ results: [
      { title: 'Germany striker injured, doubtful for opener' },
      { title: 'Germany manager reveals tactical switch' },
      { title: 'Germany squad rotation plans' },
    ] }),
  }));

  const headlines = await tm.requestTeamNews('Germany');
  assert(fetchCalls.length > 0, 'B1 fetch was called');
  assert(headlines.length > 0, 'B1 non-empty headlines');
  assert(headlines.length <= 8, 'B1 headlines ≤ 8');
  assert(headlines[0].includes('Germany'), 'B1 headline contains team name');
}, 'B1');

// B2: Tavily empty results → [] + fetch was called
await run(async () => {
  const tm = freshModule();
  setFetch(() => ({ ok: true, json: async () => ({ results: [] }) }));

  const headlines = await tm.requestTeamNews('Brazil');
  assert(fetchCalls.length > 0, 'B2 fetch was called');
  assert(headlines.length === 0, 'B2 empty results → []');

  const ctx = await tm.getContext('Brazil');
  assert(ctx.latestNews.length === 0, 'B2 getContext returns []');
}, 'B2');

// B3: HTTP 500 → [] + fetch was called
await run(async () => {
  const tm = freshModule();
  setFetch(() => ({ ok: false, status: 500 }));

  const headlines = await tm.requestTeamNews('Argentina');
  assert(fetchCalls.length > 0, 'B3 fetch was called');
  assert(headlines.length === 0, 'B3 HTTP 500 → []');
}, 'B3');

// B4: network error → [] + fetch was called
await run(async () => {
  const tm = freshModule();
  setFetch(() => { throw new Error('ECONNREFUSED'); });

  const headlines = await tm.requestTeamNews('France');
  assert(fetchCalls.length > 0, 'B4 fetch was called');
  assert(headlines.length === 0, 'B4 network error → []');
}, 'B4');

// B5: cache hit → fetch NOT called, returns existing items
await run(async () => {
  const tm = freshModule();
  setFetch(() => ({ ok: true, json: async () => ({ results: [{ title: 'Should NOT be called' }] }) }));
  tm.updateTeamNews('Spain', ['Existing headline 1', 'Existing headline 2']);

  const headlines = await tm.requestTeamNews('Spain');
  assert(fetchCalls.length === 0, 'B5 fetch was NOT called (cache hit)');
  assert(headlines.length === 2, 'B5 cache returns 2 items');
  assert(headlines[0] === 'Existing headline 1', 'B5 cache returns original item');
}, 'B5');

// B6: empty Tavily → guard prevents overwriting existing cache entry
await run(async () => {
  const tm = freshModule();
  tm.updateTeamNews('Italy', ['Italy team news: important headline']);

  // Force-expire cache to trigger Tavily fetch path, then return empty
  for (const [key, entry] of tm._newsCache) {
    entry.updatedAt = '2020-01-01T00:00:00.000Z';
  }

  setFetch(() => ({ ok: true, json: async () => ({ results: [] }) }));
  const headlines = await tm.requestTeamNews('Italy');

  assert(fetchCalls.length > 0, 'B6 fetch was called (cache expired)');
  assert(headlines.length === 0, 'B6 empty Tavily → []');

  // Anti-overwrite guard: cache entry still holds original items (not replaced by [])
  const entry = tm._newsCache.get('Italy');
  assert(entry !== undefined, 'B6 cache entry still exists');
  assert(entry.items.length === 1, 'B6 cache items preserved (not overwritten by empty)');
  assert(entry.items[0].includes('Italy'), 'B6 original headline preserved');
}, 'B6');

// B7: maxItems=3 → exactly 3 headlines returned
await run(async () => {
  const tm = freshModule();
  setFetch((_, body) => ({
    ok: true,
    json: async () => ({ results: Array.from({ length: 6 }, (_, i) => ({ title: `${body.query} result ${i + 1}` })) }),
  }));

  const headlines = await tm.requestTeamNews('Netherlands', { maxItems: 3 });
  assert(fetchCalls.length > 0, 'B7 fetch was called');
  assert(headlines.length === 3, `B7 maxItems=3 → exactly 3, got ${headlines.length}`);
}, 'B7');

// B8: maxItems=0 → returns [] without calling fetch
await run(async () => {
  const tm = freshModule();
  setFetch(() => ({ ok: true, json: async () => ({ results: [{ title: 'nope' }] }) }));

  const headlines = await tm.requestTeamNews('Mexico', { maxItems: 0 });
  assert(fetchCalls.length === 0, 'B8 fetch was NOT called (maxItems=0)');
  assert(headlines.length === 0, 'B8 maxItems=0 → []');
}, 'B8');

// B9: no TAVILY_API_KEY → returns [] without calling fetch
await run(async () => {
  delete process.env.TAVILY_API_KEY;

  const tm = freshModule();
  setFetch(() => ({ ok: true, json: async () => ({ results: [{ title: 'nope' }] }) }));

  const headlines = await tm.requestTeamNews('England');
  assert(fetchCalls.length === 0, 'B9 fetch was NOT called (no API key)');
  assert(headlines.length === 0, 'B9 no API key → []');

  process.env.TAVILY_API_KEY = ORIG_KEY;
}, 'B9');

// B10: duplicate titles deduped + non-empty result
await run(async () => {
  const tm = freshModule();
  setFetch(() => ({
    ok: true,
    json: async () => ({ results: [
      { title: 'Unique headline' },
      { title: 'Unique headline' },  // dup
      { title: 'Another news item' },
      { title: 'Unique headline' },  // dup again
    ] }),
  }));

  const headlines = await tm.requestTeamNews('Portugal');
  assert(fetchCalls.length > 0, 'B10 fetch was called');
  assert(headlines.length > 0, 'B10 non-empty result');
  assert(headlines.length === 2, `B10 deduped to 2 unique, got ${headlines.length}: [${headlines.join(', ')}]`);
  const dupCount = headlines.filter(h => h === 'Unique headline').length;
  assert(dupCount === 1, `B10 "Unique headline" appears exactly once (${dupCount})`);
}, 'B10');

// ═══ Part C: updateTeamNews (sync, real module) ═══

{
  const tm = freshModule();
  assert(tm.updateTeamNews(null, ['a']) === 0, 'C1 null teamId → 0');
  assert(tm.updateTeamNews('X', 'not-an-array') === 0, 'C2 non-array items → 0');

  const count = tm.updateTeamNews('Germany', ['H1','H2','H3','H4','H5','H6','H7','H8','H9','H10']);
  assert(count === 8, 'C3 updateTeamNews slices to 8');
}

})().then(() => {
  globalThis.fetch = origFetch;
  process.env.TAVILY_API_KEY = ORIG_KEY;
  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}).catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
