#!/usr/bin/env node
/**
 * P2-6: bot-kb — qualification probability + standings injection into Bot system prompt
 *
 * Does not start the server; directly tests fetchGlobalContext + buildSystemPrompt.
 */
'use strict';

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }

console.log('━━━ test-bot-kb ━━━');

// ── Module mock ──
const Module = require('module');
const fs = require('fs');
const path = require('path');
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

function standingsRoute(groups) {
  return { 'GET /api/standings': async () => ({ groups }) };
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
  assert(ctx.qualification === null, 'A3a empty qualification is omitted');
  const ctx2 = await bot.fetchGlobalContext({ getCached, setCache });
  assert(ctx2.qualification[0].team === 'cached', 'A3b cache hit');
}

// A5: production standings route is preferred when the legacy DB table is empty
{
  mockDb(makeStandingsDB({}));
  const deps = {
    routes: {
      ...baseRoutes,
      ...qualRoute({}),
      ...standingsRoute([{
        name: '小组 A',
        group: 'A',
        standings: [
          { name: 'Mexico', nameI18n: { zh: '墨西哥', en: 'Mexico' }, played: 3, wins: 3, draws: 0, losses: 0, gf: 6, ga: 0, gd: 6, pts: 9 },
          { name: 'South Africa', nameI18n: { zh: '南非', en: 'South Africa' }, played: 3, wins: 1, draws: 1, losses: 1, gf: 2, ga: 3, gd: -1, pts: 4 },
        ],
      }]),
    },
    getCached: () => null,
    setCache: () => {},
  };
  const bot = freshBot(deps);
  const ctx = await bot.fetchGlobalContext({ getCached: () => null, setCache: () => {} });
  assert(ctx.qualification === null, 'A5a empty qualification omitted');
  assert(ctx.standings.A.length === 2, 'A5b standings route supplies Group A');
  assert(ctx.standings.A[0].team_name === '墨西哥', 'A5c localized team name retained');
  assert(ctx.standings.A[0].points === 9, 'A5d points normalized');
  assert(ctx.standings.A[0].goal_difference === 6, 'A5e goal difference normalized');
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
  assert(zh.includes('只用中文回答'), 'B1d zh prompt requires Chinese only');
  assert(!zh.includes('先中文，后英文'), 'B1e zh prompt no longer requires bilingual output');
}

// B2: buildSystemPrompt en with global
{
  const bsp = freshBot({ routes: baseRoutes, getCached: () => null, setCache: () => {} }).buildSystemPrompt;
  const en = bsp('en', '', '', '## Qualification\n[{"team":"France"}]');
  assert(en.includes('Tournament Data'), 'B2a en has Tournament Data');
  assert(en.includes('Answer only in English'), 'B2b en prompt requires English only');
  assert(!en.includes('Chinese first'), 'B2c en prompt no longer requires bilingual output');
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

// C1: question language overrides UI language and fallback stays single-language
{
  const api = freshBot({ routes: baseRoutes, getCached: () => null, setCache: () => {} });
  assert(api.detectLanguage('法国对西班牙有什么看点？', { uiLang: 'en' }) === 'zh', 'C1a Chinese question overrides English UI');
  assert(api.detectLanguage('What are the key points for France vs Spain?', { uiLang: 'zh' }) === 'en', 'C1b English question overrides Chinese UI');
  assert(!/[\u3400-\u9fff]/.test(api.localFallback('prediction model', 'en')), 'C1c English fallback has no Chinese');
  assert(!/The forecast|I am PitchSignal/.test(api.localFallback('预测概率', 'zh')), 'C1d Chinese fallback has no English paragraph');
  assert(api.shouldLoadGlobalContext('法国对西班牙有什么看点？', '760514') === false, 'C1e knockout preview skips group-table context');
  assert(api.shouldLoadGlobalContext('法国小组积分榜', '760514') === true, 'C1f explicit standings question keeps global context');
}

// C2: match modal publishes and clears the current match id for global chat
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'match-detail.js'), 'utf8');
  assert(source.includes("modal.dataset.currentMatchId = String(id)"), 'C2a opening modal exposes match id');
  assert(source.includes('delete modal.dataset.currentMatchId'), 'C2b closing modal clears match id');
}

// D1: live match context contains the knockout stage and complete tournament journeys
{
  const journey = (teamId) => ({ matches: [
    { matchId: `${teamId}-g1`, date: '2026-06-15T00:00:00Z', stage: 'Group Stage', state: 'post', homeTeam: { name: teamId }, awayTeam: { name: 'Opponent' }, score: { home: '3', away: '0' }, result: 'W' },
    { matchId: teamId === '478' ? '760510' : '760511', date: '2026-07-11T00:00:00Z', stage: 'QF', state: 'post', homeTeam: { name: teamId }, awayTeam: { name: 'Quarter-final opponent' }, score: { home: '2', away: '0' }, result: 'W' },
    { matchId: '760514', date: '2026-07-15T00:00:00Z', stage: 'SF', state: 'pre', homeTeam: { name: 'France' }, awayTeam: { name: 'Spain' }, score: { home: '0', away: '0' }, result: null },
  ] });
  const routes = {
    'GET /api/match/:id': async () => ({ id: '760514', date: '2026-07-15T00:00:00Z', state: 'pre', venue: 'AT&T Stadium', home: { id: '478', name: 'France', score: '0' }, away: { id: '164', name: 'Spain', score: '0' } }),
    'GET /api/matchup-spatial/:home/:away': async () => ({ summary: 'France transition vs Spain possession', pairs: [] }),
    'GET /api/predict/:matchId': async () => ({ homeWin: 0.4, draw: 0.3, awayWin: 0.3, knockoutIntel: { meta: { isKnockout: true }, sections: { styleMatchup: { matchSources: Array(50).fill({ noisy: true }), homeTags: ['counter_fast'], awayTags: ['possession'] } } } }),
    'GET /api/team/:id/recent-matches': async ({ id }) => journey(String(id)),
    'GET /api/team/:id/recent-stats': async ({ id }) => ({ matches: 6, matchIds: [`${id}-g1`, id === '478' ? '760510' : '760511'], stats: { possessionPct: { avg: id === '478' ? 48 : 66 }, shots: { avg: 14 }, unrelatedNoise: { avg: 99 } }, source: 'ESPN' }),
    'GET /api/match/:id/lineups': async () => ({ homeFormation: '4-3-3', awayFormation: '4-3-3', homeXI: [{ name: 'Mbappe' }], awayXI: [{ name: 'Yamal' }], source: 'FIFA' }),
  };
  const bot = freshBot({ routes, getCached: () => null, setCache: () => {} });
  const ctx = await bot.fetchMatchContext('760514', { getCached: () => null, setCache: () => {} });
  assert(ctx.match.stage === 'SF', 'D1a current stage is injected as SF');
  assert(ctx.tournamentJourney.home.some(m => m.matchId === '760510' && m.stage === 'QF'), 'D1b France QF path is present');
  assert(ctx.tournamentJourney.away.some(m => m.matchId === '760511' && m.stage === 'QF'), 'D1c Spain QF path is present');
  assert(ctx.tournamentStats.home.completedMatches === 6, 'D1d full tournament stats are present');
  assert(ctx.currentLineups.homeXI[0] === 'Mbappe', 'D1e current lineup context is compacted');
  assert(!JSON.stringify(ctx.knockoutIntel).includes('matchSources'), 'D1f bulky raw match sources are omitted');
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
