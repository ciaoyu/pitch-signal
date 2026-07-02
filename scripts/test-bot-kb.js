#!/usr/bin/env node
/**
 * P2-6: bot-kb — 出线概率 + 积分榜注入 Bot system prompt
 *
 * 不启动 server，直接测试 fetchGlobalContext + buildSystemPrompt。
 */
'use strict';

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }

console.log('━━━ test-bot-kb ━━━');

// ── Module mock ──
const Module = require('module');
const origRequire = Module.prototype.require;

function mockDb(dbImpl) {
  Module.prototype.require = function (id) {
    if (id === '../db' && this.filename && this.filename.includes('/lib/')) return dbImpl;
    return origRequire.apply(this, arguments);
  };
}
function unmockDb() { Module.prototype.require = origRequire; }

function freshBot(deps) {
  delete require.cache[require.resolve('../lib/routes/bot')];
  return require('../lib/routes/bot')(deps).__test__;
}

// Standings mock: group_id → rows
function makeStandingsDB(groups) {
  return { db: { prepare: (sql) => {
    if (sql.includes('DISTINCT group_id') || sql.includes('GROUP BY group_id')) {
      return { all: () => Object.keys(groups).map(g => ({ group_id: g })) };
    }
    // Bound queries: group_id = ?
    return {
      all: (gid) => (groups[gid] || []),
    };
  }}};
}

// Qualification mock
function qualRoute(data) {
  return { 'GET /api/qualification-probabilities': async () => data };
}

const baseRoutes = {
  'GET /api/matchup-spatial/:home/:away': async () => ({ summary: 'mock' }),
};

(async () => {

// A1: Qualification only (no standings)
{
  unmockDb();
  mockDb({ db: null });
  const deps = { routes: { ...baseRoutes, ...qualRoute([
    { teamName: 'France', qualifyProb: 0.995, thirdPlaceQualifyProb: 0, championProb: 0.12, eliminatedProb: 0.002 },
    { teamName: 'Brazil', qualifyProb: 0.988, thirdPlaceQualifyProb: 0, championProb: 0.11, eliminatedProb: 0.003 },
  ])}, getCached: () => null, setCache: () => {} };
  const bot = freshBot(deps);
  const ctx = await bot.fetchGlobalContext({ getCached: () => null, setCache: () => {} });
  assert(ctx !== null, 'A1a globalCtx not null');
  assert(ctx.qualification.length === 2, `A1b 2 teams: ${ctx.qualification.length}`);
  assert(ctx.qualification[0].team === 'France', 'A1c France top');
  assert(ctx.qualification[0].qualify === 0.995, 'A1d France 0.995');
  assert(ctx.standings === null, 'A1e no DB → standings null');
}

// A2: Standings only (no qualification)
{
  mockDb(makeStandingsDB({
    'A': [{ team_name: 'France', points: 9 }, { team_name: 'Senegal', points: 4 }],
    'B': [{ team_name: 'Brazil', points: 7 }],
  }));
  const deps = { routes: { ...baseRoutes, ...qualRoute({ error: 'no data' }) }, getCached: () => null, setCache: () => {} };
  const bot = freshBot(deps);
  const ctx = await bot.fetchGlobalContext({ getCached: () => null, setCache: () => {} });
  assert(ctx.qualification === null, 'A2a qualification null');
  assert(ctx.standings !== null, 'A2b standings not null');
  assert(Object.keys(ctx.standings).length === 2, `A2c 2 groups: ${Object.keys(ctx.standings).length}`);
  assert(ctx.standings['A'].length === 2, 'A2d Group A: 2 teams');
  assert(ctx.standings['A'][0].team_name === 'France', 'A2e Group A leader France');
}

// A3: Cache hit
{
  mockDb({ db: null });
  const getCached = () => ({ qualification: [{ team: 'cached', qualify: 0.5 }], standings: null });
  const setCache = () => {};
  const deps = { routes: { ...baseRoutes, ...qualRoute([]) }, getCached, setCache };
  const bot = freshBot(deps);
  const ctx = await bot.fetchGlobalContext({ getCached: () => null, setCache: () => {} });
  assert(ctx.qualification.length === 0, 'A3a first call ← qual route');
  const ctx2 = await bot.fetchGlobalContext({ getCached, setCache });
  assert(ctx2.qualification[0].team === 'cached', 'A3b cache hit');
}

// A4: grouped production response is flattened without dropping lower-ranked teams
{
  mockDb({ db: null });
  const results = Array.from({ length: 25 }, (_, i) => ({ teamName: `Team${i}`, qualifyProb: 1 - i * 0.04 }));
  const deps = {
    routes: {
      ...baseRoutes,
      ...qualRoute({
        'Group A': { results: results.slice(0, 13) },
        'Group B': { results: results.slice(13) },
      }),
    },
    getCached: () => null,
    setCache: () => {},
  };
  const bot = freshBot(deps);
  const ctx = await bot.fetchGlobalContext({ getCached: () => null, setCache: () => {} });
  assert(ctx.qualification.length === 25, `A4 keeps all teams: ${ctx.qualification.length}`);
  assert(ctx.qualification[24].team === 'Team24', 'A4 lower-ranked team remains available');
}

// B1: buildSystemPrompt zh with global
{
  const bsp = freshBot({ routes: baseRoutes, getCached: () => null, setCache: () => {} }).buildSystemPrompt;
  const zh = bsp('zh', 'KB here', '{"match":"A vs B"}', '## 出线概率\n[{"team":"France"}]');
  assert(zh.includes('赛事数据'), 'B1a zh has 赛事数据');
  assert(zh.includes('出线概率'), 'B1b zh has qualification');
  assert(zh.includes('France'), 'B1c zh has team');
}

// B2: buildSystemPrompt en with global
{
  const bsp = freshBot({ routes: baseRoutes, getCached: () => null, setCache: () => {} }).buildSystemPrompt;
  const en = bsp('en', '', '', '## Qualification\n[{"team":"France"}]');
  assert(en.includes('Tournament Data'), 'B2a en has Tournament Data');
}

// B3: buildSystemPrompt without global (regression)
{
  const bsp = freshBot({ routes: baseRoutes, getCached: () => null, setCache: () => {} }).buildSystemPrompt;
  const zh = bsp('zh', 'KB', 'ctx', '');
  assert(!zh.includes('赛事数据'), 'B3a zh no 赛事数据 when empty');
  assert(zh.includes('内部知识库'), 'B3b zh has KB');
  const en = bsp('en', '', '', '');
  assert(!en.includes('Tournament Data'), 'B3c en no Tournament Data when empty');
}

})()
  .then(() => {
    unmockDb();
    console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((e) => {
    unmockDb();
    console.error('FATAL:', e);
    process.exit(1);
  });
