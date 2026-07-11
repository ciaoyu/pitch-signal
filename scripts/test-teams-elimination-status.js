#!/usr/bin/env node
'use strict';

/**
 * static/js/team-detail.js — Teams grid elimination-status regression test.
 *
 * Bug: /api/standings gives each team a combined "中文 English" name string
 * (e.g. "南非 South Africa"), while /api/bracket's loser.name is English-only
 * ("South Africa"). refreshTeamsFromStandings() used to match eliminated
 * teams purely by comparing those two strings, so the comparison NEVER
 * matched — every team that advanced out of the group stage stayed marked
 * "Active" forever, regardless of real Round-of-32/16/QF results. Confirmed
 * live against production: South Africa, Germany and Netherlands (all real
 * R32 losers) were still shown "在役" on the Teams page.
 *
 * Fix: match primarily by team id (format-independent), with name/nameI18n
 * string fallbacks corrected to compare the right sub-fields.
 */

let passed = 0;
let failed = 0;
function assert(cond, label) {
  cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++);
}

console.log('━━━ Teams grid elimination-status tests ━━━');

// Fixture shaped exactly like the real production responses captured above.
const STANDINGS = {
  groups: [
    {
      name: '小组 A',
      standings: [
        { id: '203', name: '墨西哥 Mexico', nameI18n: { zh: '墨西哥', en: 'Mexico' }, played: 3, wins: 3, draws: 0, losses: 0, pts: 9 },
        { id: '467', name: '南非 South Africa', nameI18n: { zh: '南非', en: 'South Africa' }, played: 3, wins: 1, draws: 1, losses: 1, pts: 4 },
        // Bottom-2 group finisher: never made the R32 bracket at all, so it
        // never appears as a teamA/teamB anywhere below — must still be
        // inferred as eliminated once the group is finished (played >= 3).
        { id: '451', name: '韩国 South Korea', nameI18n: { zh: '韩国', en: 'South Korea' }, played: 3, wins: 1, draws: 0, losses: 2, pts: 3 },
      ],
    },
    {
      name: '小组 E',
      standings: [
        { id: '481', name: '德国 Germany', nameI18n: { zh: '德国', en: 'Germany' }, played: 3, wins: 2, draws: 0, losses: 1, pts: 6 },
      ],
    },
  ],
};
const BRACKET = {
  matches: {
    // South Africa (teamA) lost to Canada (teamB) — winner "B"
    'R32-1': {
      status: 'final', winner: 'B',
      teamA: { name: 'South Africa', nameI18n: { zh: '南非', en: 'South Africa' }, id: '467' },
      teamB: { name: 'Canada', nameI18n: { zh: '加拿大', en: 'Canada' }, id: '206' },
    },
    // Germany (teamA) lost to Paraguay (teamB) — winner "B"
    'R32-2': {
      status: 'final', winner: 'B',
      teamA: { name: 'Germany', nameI18n: { zh: '德国', en: 'Germany' }, id: '481' },
      teamB: { name: 'Paraguay', nameI18n: { zh: '巴拉圭', en: 'Paraguay' }, id: '210' },
    },
    // Not final yet — must not mark anyone eliminated
    'R32-3': { status: 'scheduled', winner: null, teamA: { name: 'A', id: '1' }, teamB: { name: 'B', id: '2' } },
    // Mexico advanced (won) — must stay Active, and its presence here is what
    // proves it legitimately qualified (as opposed to South Korea below, who
    // never appears anywhere in the bracket at all).
    'R32-4': {
      status: 'final', winner: 'A',
      teamA: { name: 'Mexico', nameI18n: { zh: '墨西哥', en: 'Mexico' }, id: '203' },
      teamB: { name: 'Ghana', nameI18n: { zh: '加纳', en: 'Ghana' }, id: '221' },
    },
  },
};

global.window = {
  WorldCup: {
    Utils: {
      esc: (s) => s,
      attr: (s) => s,
      tx: (zh) => zh,
      api: async (path) => {
        if (path === '/api/standings') return STANDINGS;
        if (path === '/api/bracket') return BRACKET;
        return {};
      },
    },
    I18n: {},
  },
};

require('../static/js/team-detail.js');

(async () => {
  const allTeams = await window.WorldCup.TeamDetail.refreshTeamsFromStandings();
  const byId = Object.fromEntries(allTeams.map((t) => [t.id, t]));

  assert(byId['467'].eliminated === true, 'South Africa (R32 loser, id-matched) is marked eliminated');
  assert(byId['481'].eliminated === true, 'Germany (R32 loser, id-matched) is marked eliminated');
  assert(byId['203'].eliminated === false, 'Mexico (advanced, still in the bracket) stays Active');
  assert(byId['451'].eliminated === true, 'South Korea (bottom-2 group finish, never in the bracket) is marked eliminated');

  // Regression guard for the exact original bug: a team whose /api/standings
  // combined name string ("南非 South Africa") differs from bracket's
  // English-only loser.name ("South Africa") must still be caught — this
  // only works if matching is NOT solely a raw t.name === loser.name check.
  assert(byId['467'].name !== 'South Africa', 'fixture reproduces the real name-format mismatch (combined zh+en vs English-only)');
  assert(byId['467'].eliminated === true, 'eliminated despite the name-format mismatch (id-based match saves it)');

  // Guard: before the bracket exists yet (group stage still in progress),
  // qualifiedIds is empty — must never mark a mid-group-stage team eliminated
  // just because it hasn't finished its 3 group games.
  window.WorldCup.Utils.api = async (path) => {
    if (path === '/api/standings') return STANDINGS;
    if (path === '/api/bracket') return { matches: {} };
    return {};
  };
  const preTournamentTeams = await window.WorldCup.TeamDetail.refreshTeamsFromStandings();
  const preById = Object.fromEntries(preTournamentTeams.map((t) => [t.id, t]));
  assert(preById['451'].eliminated === false, 'empty bracket (pre-knockout) never falsely marks a team eliminated');

  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
