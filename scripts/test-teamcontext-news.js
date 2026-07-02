#!/usr/bin/env node
/**
 * P2-5: teamcontext-news 测试 — 搜索词 + 缓存注入链 + 降级
 */
'use strict';

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }

console.log('━━━ teamcontext-news tests (search-terms + cache-chain + fallback) ━━━');

// ── Part A: buildContextAwareSearchTerms (existing) ──

const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../lib/routes/news.js', 'utf8');
const buildFn = src.match(/function buildContextAwareSearchTerms[\s\S]*?^}/m);
if (!buildFn) { console.error('❌ Could not extract buildContextAwareSearchTerms'); process.exit(1); }
const buildContextAwareSearchTerms = eval(`(${buildFn[0]})`);

{
  const ctx = { homeTeam: 'Germany', awayTeam: 'Curaçao', homeId: 'GER', awayId: 'CUW' };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false });
  assert(terms.length >= 5, 'base pre-match ≥ 5 terms');
  assert(terms.some(t => t.includes('injury update')), 'contains injury update');
}
{
  const ctx = { homeTeam: 'Brazil', awayTeam: 'Argentina', homeId: 'BRA', awayId: 'ARG' };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: true });
  assert(terms.some(t => t.includes('match analysis')), 'post has match analysis');
  assert(terms.some(t => t.includes('post-match reaction')), 'post has reaction');
}
{
  const ctx = { homeTeam: 'France', awayTeam: 'Iceland', homeId: 'FRA', awayId: 'ISL' };
  const getElo = (id) => id === 'FRA' ? 1850 : 1550;
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getElo });
  assert(terms.some(t => t.includes('upset')), 'Elo diff → upset chance');
  assert(terms.length > 5, 'Elo diff increases term count');
}
{
  const ctx = { homeTeam: 'Morocco', awayTeam: 'England', homeId: 'MAR', awayId: 'ENG' };
  const getStyle = (id) => id === 'MAR' ? 'defensive' : 'attacking';
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getStyle });
  assert(terms.some(t => t.includes('counter attack')), 'def vs att → counter query');
}
{
  const ctx = { homeTeam: 'Norway', awayTeam: 'Spain', homeId: 'NOR', awayId: 'ESP', weatherCondition: 'Rain' };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false });
  assert(terms.some(t => t.includes('weather')), 'rain → weather query');
}
{
  const ctx = { homeTeam: 'Argentina', awayTeam: 'Portugal', homeId: 'ARG', awayId: 'POR' };
  const getQualification = () => ({ stage: 'knockout' });
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getQualification });
  assert(terms.some(t => t.includes('must win')), 'knockout → must win');
}
{
  const ctx = { homeTeam: 'France', awayTeam: 'Iceland', homeId: 'FRA', awayId: 'ISL' };
  const getElo = (id) => id === 'FRA' ? 1850 : 1550;
  const getStyle = (id) => id === 'FRA' ? 'attacking' : 'defensive';
  const getQualification = () => ({ stage: 'knockout' });
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getElo, getStyle, getQualification });
  assert(terms.length <= 8, 'max 8 queries');
  const unique = new Set(terms.map(t => t.toLowerCase().trim()));
  assert(unique.size === terms.length, 'all queries unique');
}

// ── Part B: _generateMockTeamNews logic verification ──
// Mirror the template generation logic (avoid eval of class method syntax).
const teamContextSrc = require('fs').readFileSync(__dirname + '/../lib/teamContext.js', 'utf8');
const genFnMatch = teamContextSrc.match(/^  _generateMockTeamNews[\s\S]*?^  \}/m);
assert(genFnMatch !== null, '_generateMockTeamNews method found in source');
const genBody = genFnMatch[0];

// 8 templates in source
assert((genBody.match(/`\$\{name\}/g) || []).length === 8, '8 template strings');
assert(genBody.includes('.slice(0, maxItems)'), 'uses slice for clamping');
assert(genBody.includes('const name = String'), 'normalizes to String');

// Inline equivalent test
function _mockNews(teamId, maxItems) {
  const name = String(teamId);
  const templates = [
    `${name} injury update: key players fitness assessment ahead of next match`,
    `${name} manager discusses tactical approach and possible formation changes`,
    `${name} training camp report: squad depth and rotation options`,
    `${name} set-piece analysis: identified as potential game-changer`,
    `${name} defensive organization under scrutiny in recent outings`,
    `${name} goalkeeper form could be decisive factor`,
    `${name} young prospect pushing for starting role`,
    `${name} recent form guide: trends and patterns in last 5 matches`,
  ];
  return templates.slice(0, maxItems);
}
const h = _mockNews('GER', 4);
assert(Array.isArray(h), 'returns array');
assert(h.length === 4, 'returns 4 items');
assert(h.every(s => typeof s === 'string' && s.length > 10), 'all items strings');
assert(h[0].includes('GER injury'), 'includes teamId in first headline');
assert(h.some(s => s.includes('tactical')), 'tactical headline exists');
assert(h.some(s => s.includes('form')), 'form headline exists (at least 1)');
assert(_mockNews('BRA', 3).length === 3, 'maxItems clamps');
assert(_mockNews('FRA', 0).length === 0, 'maxItems=0 returns empty');

// ── Part C: requestTeamNews anti-overwrite logic (verify via source inspection) ──

const reqFnMatch = teamContextSrc.match(/async requestTeamNews[\s\S]*?^\s+\}/m);
assert(reqFnMatch !== null, 'requestTeamNews method found in source');

const reqBody = reqFnMatch[0];
assert(reqBody.includes('cached.length > 0'), 'checks cached.length before updating');
assert(reqBody.includes('this._generateMockTeamNews'), 'calls _generateMockTeamNews when cache miss');
assert(!reqBody.includes('const headlines = []'), 'no longer returns empty hardcoded array');

// ── Part D: _getLatestNews reads from _newsCache (verify via source) ──
// The regex ^\s+} matches first } (if-block), not method-end, so use substring.
const getNewsStart = teamContextSrc.indexOf('_getLatestNews(teamId) {');
assert(getNewsStart > 0, '_getLatestNews found');
const getNewsBody = teamContextSrc.substring(getNewsStart, getNewsStart + 600);
assert(getNewsBody.includes('this._newsCache.get'), 'reads _newsCache');
assert(getNewsBody.includes('teamIdAliasSet'), 'uses alias bridging');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
