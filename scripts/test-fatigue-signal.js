#!/usr/bin/env node
/**
 * KO-5: fatigue signal tests
 *
 * Covers:
 *   - buildSignal returns null when either team has no previous match.
 *   - Equal rest/ET/travel yields neutral probabilities (no tilt).
 *   - Missing data yields confidence 0 and neutral probabilities.
 *   - Hard tilt boundary: max probability displacement is ±2.5% (0.025).
 *   - signalApplied exposes weight, tilt, and usedInModel=true.
 *   - Section builder exposes raw home/away components and differential.
 */

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-ko5.db');
try { fs.unlinkSync(process.env.TEST_DB_PATH); } catch (_) {}

const { db } = require('../lib/db');
const teamResolver = require('../lib/team_resolver');
const { buildSignal, buildFatigueSection, restScore, travelScore, DEFAULT_PARAMS } = require('../lib/services/fatigue-signal');
const { teamMatches, previousMatch } = require('../lib/services/schedule-lookup');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function insertMatchRow(espnHomeId, espnAwayId, wentToEt, decidedByPens) {
  const homeRid = teamResolver.getRatingsIdByEspnId(espnHomeId);
  const awayRid = teamResolver.getRatingsIdByEspnId(espnAwayId);
  if (!homeRid || !awayRid) return null;
  db.prepare(`
    INSERT INTO matches (home_team_id, away_team_id, played, went_to_et, decided_by_pens, stage)
    VALUES (?, ?, 1, ?, ?, 'Group')
  `).run(homeRid, awayRid, wentToEt ? 1 : 0, decidedByPens ? 1 : 0);
  return { homeRid, awayRid };
}

// Find real matches where both teams have at least one earlier match in the
// tournament (so previousMatch returns a fixture for each side).
function findMatchesWithBothTeamsHavingHistory() {
  const schedule = require('../data/match_snapshot_schedule.json');
  const out = [];
  for (const m of schedule.matches || []) {
    const homeHistory = teamMatches(m.teams.home.id);
    const awayHistory = teamMatches(m.teams.away.id);
    const homeIdx = homeHistory.findIndex((x) => String(x.matchId) === String(m.matchId));
    const awayIdx = awayHistory.findIndex((x) => String(x.matchId) === String(m.matchId));
    if (homeIdx > 0 && awayIdx > 0) out.push(m);
  }
  return out;
}

const MATCHES = findMatchesWithBothTeamsHavingHistory();
function getMatch(i) { return MATCHES[i] || null; }

console.log('=== KO-5 fatigue signal test ===\n');

// ---- 1. Pure helpers ----
console.log('📊 pure helpers');
{
  check(restScore(5, DEFAULT_PARAMS) === 0, '5 rest days => rested (0 fatigue)');
  check(restScore(2, DEFAULT_PARAMS) === 1, '2 rest days => max fatigue (1)');
  check(restScore(3.5, DEFAULT_PARAMS) === 0.5, '3.5 days => midpoint (0.5)');
  check(travelScore(0, DEFAULT_PARAMS) === 0, '0 travel => 0');
  check(travelScore(4000, DEFAULT_PARAMS) === 1, '4000 km => max travel (1)');
  check(travelScore(2000, DEFAULT_PARAMS) === 0.5, '2000 km => 0.5');
}

// ---- 2. No previous match => null ----
console.log('\n📊 no previous match => null');
{
  const sig = buildSignal({ matchId: '760415', homeId: '203', awayId: '467', db });
  check(sig === null, 'first tournament match for both teams => null');
}

// ---- 3. Real knockout match with both teams having history ----
console.log('\n📊 real knockout match with history');
const m = getMatch(0);
if (!m) {
  console.error('  ❌ could not find a match with both teams having history');
  failed++;
} else {
  const homePrev = previousMatch(m.matchId, m.teams.home.id);
  const awayPrev = previousMatch(m.matchId, m.teams.away.id);

  // Insert previous match rows: one team went to ET, the other did not.
  insertMatchRow(homePrev.homeId, homePrev.awayId, true, false);
  insertMatchRow(awayPrev.homeId, awayPrev.awayId, false, false);

  const sig = buildSignal({
    matchId: m.matchId,
    homeId: m.teams.home.id,
    awayId: m.teams.away.id,
    db,
  });

  check(sig && sig.usedInModel === true, 'usedInModel true');
  check(sig && sig.home != null && sig.draw != null && sig.away != null, 'signal returns probabilities');
  check(sig && Math.abs(sig.home - 0.33) <= 0.025 + 1e-6, 'home probability tilt bounded by 2.5%');
  check(sig && Math.abs(sig.away - 0.33) <= 0.025 + 1e-6, 'away probability tilt bounded by 2.5%');
  check(sig && sig.homeTeam && sig.awayTeam, 'raw home/away components present');
  check(sig && sig.signalApplied && sig.signalApplied.weight === 0.04, 'signalApplied.weight = 0.04');
  check(sig && sig.signalApplied.tilt.home <= 0 && sig.signalApplied.tilt.away >= 0, 'home more fatigued => tilt favors away');
  check(sig && sig.confidence > 0, 'confidence > 0 when data available');

  // ---- 4. Section builder ----
  const section = buildFatigueSection({
    matchId: m.matchId,
    homeTeamId: m.teams.home.id,
    awayTeamId: m.teams.away.id,
    db,
  });
  check(section && section.source === 'schedule+venues', 'section source');
  check(section && section.usedInModel === true, 'section usedInModel');
  check(section && section.home.score >= 0 && section.away.score >= 0, 'section home/away scores');
  check(section && typeof section.differential === 'number', 'section differential');
  check(section && section.signalApplied && section.signalApplied.tilt, 'section signalApplied.tilt');
}

// ---- 5. Equal rest/ET/travel => neutral probabilities ----
console.log('\n📊 equal conditions => neutral');
{
  const m2 = getMatch(1);
  if (!m2) {
    console.error('  ❌ could not find a match for equal-neutral test');
    failed++;
  } else {
    const homeHistory = teamMatches(m2.teams.home.id);
    const awayHistory = teamMatches(m2.teams.away.id);
    const homePrev = homeHistory[homeHistory.length - 2];
    const awayPrev = awayHistory[awayHistory.length - 2];
    insertMatchRow(homePrev.homeId, homePrev.awayId, false, false);
    insertMatchRow(awayPrev.homeId, awayPrev.awayId, false, false);
    const sig = buildSignal({
      matchId: m2.matchId,
      homeId: m2.teams.home.id,
      awayId: m2.teams.away.id,
      db,
    });
    check(sig && Math.abs(sig.home - 0.33) < 0.001 && Math.abs(sig.away - 0.33) < 0.001,
      'equal conditions => neutral probabilities');
  }
}

// ---- 6. Missing data => confidence 0 and neutral ----
console.log('\n📊 missing data => confidence 0 neutral');
{
  // Use a match where both teams have history, but do NOT insert the previous
  // match rows => lookupPreviousMatchStatus returns null, dataAvailable=false.
  const m3 = getMatch(2);
  if (!m3) {
    console.error('  ❌ could not find a match for missing-data test');
    failed++;
  } else {
    const sig = buildSignal({
      matchId: m3.matchId,
      homeId: m3.teams.home.id,
      awayId: m3.teams.away.id,
      db,
    });
    check(sig && sig.confidence === 0, 'missing data => confidence 0');
    check(sig && Math.abs(sig.home - 0.33) < 0.001 && Math.abs(sig.away - 0.33) < 0.001,
      'missing data => neutral probabilities');
  }
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
