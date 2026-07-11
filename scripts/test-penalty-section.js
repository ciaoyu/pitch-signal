#!/usr/bin/env node
/**
 * KO-7: penalty shootout readiness section tests
 *
 * The penalty section is display/bot-only (`usedInModel: false`).
 * Tests cover: section presence/absence, field contracts, key-taker extraction,
 * shootout-experience counting, and knockout-match counting.
 */

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-ko7.db');
try { fs.unlinkSync(process.env.TEST_DB_PATH); } catch (_) {}

const { db } = require('../lib/db');
const teamResolver = require('../lib/team_resolver');
const { buildPenaltySection, isPenaltyGoal } = require('../lib/services/penalty-section');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function insertMatchRow(espnHomeId, espnAwayId, opts = {}) {
  const homeRid = teamResolver.getRatingsIdByEspnId(espnHomeId);
  const awayRid = teamResolver.getRatingsIdByEspnId(espnAwayId);
  if (!homeRid || !awayRid) return null;
  const { wentToEt = false, decidedByPens = false, homeScore = 0, awayScore = 0, stage = 'Group' } = opts;
  db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, played, went_to_et, decided_by_pens, home_score, away_score, stage)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?)
  `).run(
    homeRid, awayRid,
    wentToEt ? 1 : 0,
    decidedByPens ? 1 : 0,
    homeScore,
    awayScore,
    stage
  );
  return { homeRid, awayRid };
}

function insertPlayerEvent(teamId, playerName, eventType, minute, rawJson) {
  db.prepare(`
    INSERT INTO player_match_events (match_id, team_id, player_name, player_id, event_type, minute, minute_added, stage, round, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'Group', 'Group', ?)
  `).run('760999', String(teamId), playerName, 'player_' + playerName, eventType, minute, JSON.stringify(rawJson));
}

console.log('=== KO-7 penalty section test ===\n');

// ---- 1. isPenaltyGoal helper ----
console.log('📊 isPenaltyGoal helper');
{
  check(isPenaltyGoal(JSON.stringify({ text: 'Penalty - scored' })) === true, 'detects "Penalty - scored"');
  check(isPenaltyGoal(JSON.stringify({ text: 'Goal' })) === false, 'plain goal is not penalty');
  check(isPenaltyGoal(JSON.stringify({ text: 'PK saved' })) === true, 'detects "PK"');
  check(isPenaltyGoal(null) === false, 'null raw_json => false');
}

// ---- 2. Missing inputs => null ----
console.log('\n📊 missing inputs => null');
{
  check(buildPenaltySection({}) === null, 'empty ctx returns null');
  check(buildPenaltySection({ matchId: '1' }) === null, 'missing team ids returns null');
}

// ---- 3. Basic section contract for a knockout fixture ----
console.log('\n📊 section contract for knockout fixture');
{
  const section = buildPenaltySection({
    matchId: '760777',
    homeTeamId: '203', // Mexico
    awayTeamId: '467', // South Africa
    homeName: 'Mexico',
    awayName: 'South Africa',
    db,
  });
  check(section !== null, 'section returned for knockout fixture');
  check(section && section.usedInModel === false, 'usedInModel false');
  check(section && section.source === 'world-cup-history+ratings+schedule+player-events', 'source field');
  check(section && ['low', 'medium', 'high'].includes(section.confidence), 'confidence label');
  check(section && ['low', 'medium', 'high'].includes(section.likelihood), 'likelihood label');
  check(section && section.home && section.away, 'home/away sub-sections');
  check(section && typeof section.home.elo === 'number', 'home elo numeric');
  check(section && typeof section.away.elo === 'number', 'away elo numeric');
  check(section && typeof section.home.knockoutMatchesPlayed === 'number', 'home knockoutMatchesPlayed numeric');
  check(section && typeof section.away.knockoutMatchesPlayed === 'number', 'away knockoutMatchesPlayed numeric');
  check(section && typeof section.comparison.side === 'string', 'comparison side');
  check(section && typeof section.comparison.reason === 'string', 'comparison reason');
}

// ---- 4. Knockout matches played counted from schedule ----
console.log('\n📊 knockout matches played counted');
{
  // Mexico (203) has two knockout placeholder matches in the schedule snapshot.
  const section = buildPenaltySection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  check(section && section.home.knockoutMatchesPlayed === 2, 'home knockout matches played = 2');
  check(section && section.away.knockoutMatchesPlayed === 1, 'away knockout matches played = 1');
}

// ---- 5. Penalty shootout experience counted from DB ----
console.log('\n📊 penalty shootout experience counted');
{
  // Insert a match that was decided by penalties for Mexico (203) vs Czechia (450)
  insertMatchRow('203', '450', { decidedByPens: true, homeScore: 4, awayScore: 2 });
  const section = buildPenaltySection({
    matchId: '760778',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  check(section && section.home.currentTournament.shootouts === 1, 'current-tournament shootouts = 1');
  check(section && section.home.shootouts > section.home.currentTournament.shootouts, 'all-time includes historical shootouts');
  check(section && section.home.currentTournament.shootoutsWon === 1, 'current-tournament wins = 1');
  check(section && section.home.notes.some((n) => n.includes('World Cup')), 'note labels World Cup scope');
  check(section && section.away.shootoutExperience === 'none', 'away has no shootout experience');
}

// ---- 6. Key penalty takers extracted from player_match_events ----
console.log('\n📊 key penalty takers extracted');
{
  insertPlayerEvent('203', 'Lozano', 'goal', 12, { text: 'Penalty - scored' });
  insertPlayerEvent('203', 'Jimenez', 'goal', 55, { text: 'Goal' });
  insertPlayerEvent('467', 'Tau', 'goal', 70, { text: 'Penalty - scored' });

  const section = buildPenaltySection({
    matchId: '760779',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });

  check(section && section.home.keyTakers.length === 1, 'home has 1 penalty taker');
  check(section && section.home.keyTakers[0].playerName === 'Lozano', 'home taker is Lozano');
  check(section && section.away.keyTakers.length === 1, 'away has 1 penalty taker');
  check(section && section.away.keyTakers[0].playerName === 'Tau', 'away taker is Tau');
  check(section && section.home.notes.some((n) => n.includes('1 penalty kick goal')), 'home notes mention 1 penalty kick goal');
}

// ---- 7. Multiple shootout experience = multiple label ----
console.log('\n📊 multiple shootout experience');
{
  insertMatchRow('450', '203', { decidedByPens: true, homeScore: 2, awayScore: 4 }); // Mexico wins again
  const section = buildPenaltySection({
    matchId: '760780',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  check(section && section.home.shootoutExperience === 'multiple', 'home shootout experience = multiple');
  check(section && section.home.currentTournament.shootouts === 2, 'current-tournament shootouts = 2');
  check(section && section.home.currentTournament.shootoutsWon === 2, 'current-tournament wins = 2');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
