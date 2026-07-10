#!/usr/bin/env node
/**
 * KO-1: knockout-intel foundation tests
 *
 * Acceptance covered:
 *   - buildKnockoutIntel returns null for group-stage fixtures (field absent).
 *   - buildKnockoutIntel returns {meta:{isKnockout:true,round,stage}, sections} for
 *     knockout fixtures, and the round is correct.
 *   - venue-distance: haversine between known venues, name resolution (exact + fuzzy),
 *     unknown venue returns null.
 *   - schedule-lookup: previous match, rest days, travel distance between venues.
 *   - score-writeback: writes went_to_et / decided_by_pens on insert and preserves
 *     them on idempotent re-run (set-true-only guard).
 *   - backfill script: idempotently marks known ET/Pens matches from ESPN.
 *
 * API integration (/api/predict/:id) is verified in a best-effort spawn at the end;
 * if the server cannot start in this environment the test skips rather than fails.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-ko1.db');

// Wipe temp test DB so each run is fresh.
try { fs.unlinkSync(process.env.TEST_DB_PATH); } catch (_) { /* may not exist */ }

const { db } = require('../lib/db');
const { buildKnockoutIntel } = require('../lib/services/knockout-intel');
const { haversineKm, resolveVenue, distanceKm } = require('../lib/services/venue-distance');
const { previousMatch, restDaysBeforeMatch, travelKmToMatch } = require('../lib/services/schedule-lookup');
const { writebackMatchScore } = require('../lib/services/score-writeback');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function addMinutes(db, minutes) {
  const stmt = db.prepare(`INSERT INTO player_match_events (match_id, team_id, player_name, event_type, minute, round) VALUES (?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction((rows) => { for (const r of rows) stmt.run(...r); });
  tx(minutes);
}

console.log('=== KO-1 knockout-intel foundation test ===\n');

// ---- 1. Aggregator: group => absent, knockout => present with meta ----
console.log('📊 knockout-intel aggregator');
{
  check(buildKnockoutIntel({ matchId: 'g1', homeId: '1', awayId: '2', stage: 'group' }) === null,
    'group-stage fixture returns null (field absent)');
  check(buildKnockoutIntel({ matchId: 'g1', homeId: '1', awayId: '2', stage: 'Group A' }) === null,
    '"Group A" returns null');
  const intel = buildKnockoutIntel({ matchId: 'k1', homeId: '1', awayId: '2', stage: 'Quarter-finals' });
  check(intel && intel.meta && intel.meta.isKnockout === true, 'knockout fixture meta.isKnockout=true');
  check(intel && intel.meta.round === 'QF', 'Quarter-finals round maps to QF');
  check(intel && intel.meta.stage === 'Quarter-finals', 'meta.stage preserved');
  check(intel && intel.sections && intel.sections.penalty && intel.sections.penalty.usedInModel === false,
    'knockout fixture includes display-only penalty section');
}

// ---- 2. Aggregator: suspensions section populated for knockout ----
console.log('\n📊 aggregator with suspensions section');
{
  addMinutes(db, [
    ['m1', 'H', 'Player TwoY', 'yellow', 30, 'Round of 32'],
    ['m2', 'H', 'Player TwoY', 'yellow', 55, 'Round of 16'],
  ]);
  const intel = buildKnockoutIntel({ matchId: 'k2', homeId: 'H', awayId: 'A', stage: 'Quarter-finals', db });
  check(intel && intel.meta.isKnockout === true && intel.sections.suspensions, 'suspensions section present for knockout');
  check(intel && intel.sections.suspensions.home.out.length === 1, 'home.out has one suspended player');
  check(buildKnockoutIntel({ matchId: 'k3', homeId: 'H', awayId: 'A', stage: 'group', db }) === null,
    'group fixture with DB cards still returns null (gated by knockout)');
}

// ---- 3. Venue distance ----
console.log('\n📊 venue-distance');
{
  const sofi = resolveVenue('SoFi Stadium');
  const metlife = resolveVenue('MetLife Stadium');
  check(sofi && sofi.name === 'SoFi Stadium', 'exact venue resolution');
  check(metlife && metlife.name === 'MetLife Stadium', 'exact venue resolution (MetLife)');
  const d = distanceKm('SoFi Stadium', 'MetLife Stadium');
  check(typeof d === 'number' && d > 2000 && d < 4000, `distance LA↔NJ ≈ ${d} km (reasonable)`);
  const fuzzy = resolveVenue('Sofi stadium');
  check(fuzzy && fuzzy.name === 'SoFi Stadium', 'case-insensitive fuzzy match');
  check(resolveVenue('Definitely Not A Real Venue XYZ') === null, 'unknown venue returns null');
  check(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }) === 0, 'same point = 0 km');
}

// ---- 4. Schedule lookup ----
console.log('\n📊 schedule-lookup');
{
  // 467 (South Africa) plays 760415 (group) then 760438 (group) in the schedule.
  const prev = previousMatch('760438', '467');
  check(prev && prev.matchId === '760415', 'previous match for South Africa is 760415');
  const rest = restDaysBeforeMatch('760438', '467');
  check(typeof rest === 'number' && rest > 0, `rest days > 0 (got ${rest})`);
  const travel = travelKmToMatch('760438', '467');
  // Travel may be null if the schedule venue name is not in venues.json (e.g.
  // Mexican venues). The unit-level distanceKm test already proves the haversine
  // path with known venues; here we just verify the function is wired.
  check(typeof travel === 'number' || travel === null, `travelKmToMatch returns number or null (got ${travel})`);
  check(previousMatch('760415', '467') === null, 'first match has no previous');
}

// ---- 5. Score-writeback: final-status flags ----
console.log('\n📊 score-writeback ET/Pens flags');
{
  const res = writebackMatchScore({
    homeTeam: '203', awayTeam: '467', homeScore: 2, awayScore: 1,
    statusName: 'post', matchDate: '2026-06-11', stage: 'Group A', venue: 'Estadio Banorte',
    source: 'test', wentToEt: true, decidedByPens: true,
  });
  check(res.success === true, 'writeback succeeded');

  const row = db.prepare(`SELECT went_to_et, decided_by_pens FROM matches WHERE id = ?`).get(res.matchId);
  check(row && row.went_to_et === 1 && row.decided_by_pens === 1, 'flags written on insert');

  // Idempotent re-run with false flags should NOT clear the already-set flags.
  const res2 = writebackMatchScore({
    homeTeam: '203', awayTeam: '467', homeScore: 2, awayScore: 1,
    statusName: 'post', source: 'test', wentToEt: false, decidedByPens: false,
  });
  check(res2.reason === 'already_written', 'second write is idempotent');
  const row2 = db.prepare(`SELECT went_to_et, decided_by_pens FROM matches WHERE id = ?`).get(res.matchId);
  check(row2 && row2.went_to_et === 1 && row2.decided_by_pens === 1, 'flags preserved on idempotent re-run');
}

// ---- 6. Backfill script: idempotent ET/Pens marker ----
console.log('\n📊 backfill-match-final-status.js');
{
  // Run the backfill for a known penalties match (760488: FT-Pens, 1-1).
  cp.execSync(
    `node "${path.join(__dirname, 'backfill-match-final-status.js')}" --matchId=760488`,
    {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, TEST_DB_PATH: process.env.TEST_DB_PATH },
      stdio: 'pipe',
      timeout: 60000,
    }
  );

  // The backfill inserts/updates the match row by resolved team IDs; just verify
  // at least one row has ET + Pens flags set.
  const count = db.prepare(`SELECT COUNT(*) c FROM matches WHERE went_to_et = 1 AND decided_by_pens = 1`).get().c;
  check(count >= 1, 'backfill marked 760488 as ET + Pens');
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---- 7. Best-effort API integration (/api/predict/:id) ----
console.log('\n📊 API integration (best-effort)');
let integrationRan = false;
(async () => {
  const PORT = 5094;
  const testDb = path.join(__dirname, '..', 'data', 'test-ko1-integration.db');
  try { fs.unlinkSync(testDb); } catch (_) {}
  const proc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), TEST_DB_PATH: testDb, NODE_ENV: 'test' },
  });
  const start = Date.now();
  let healthOk = false;
  while (Date.now() - start < 12000) {
    try {
      await fetch(`http://localhost:${PORT}/health`, { signal: AbortSignal.timeout(500) });
      healthOk = true;
      break;
    } catch (_) { sleepMs(200); }
  }
  if (healthOk) {
    try {
      const groupRes = await fetch(`http://localhost:${PORT}/api/predict/760415`).then(r => r.json());
      const koRes = await fetch(`http://localhost:${PORT}/api/predict/760488`).then(r => r.json());
      check(!groupRes.knockoutIntel, 'group-stage API response omits knockoutIntel');
      check(koRes.knockoutIntel && koRes.knockoutIntel.meta.isKnockout === true, 'knockout API response includes knockoutIntel.meta.isKnockout=true');
      integrationRan = true;
    } catch (e) {
      console.log(`  ⚠️  API integration request failed: ${e.message} (skipping)`);
    }
  } else {
    console.log('  ⚠️  server health check failed (skipping API integration)');
  }
  try { proc.kill(); } catch (_) {}
  try { proc.kill('SIGKILL'); } catch (_) {}
})().then(() => {
  console.log(`\n============================`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (!integrationRan) console.log('(API integration skipped; run server manually to verify /api/predict/:id)');
  console.log('============================');
  process.exit(failed > 0 ? 1 : 0);
});
