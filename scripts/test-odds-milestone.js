#!/usr/bin/env node
'use strict';

/**
 * lib/services/odds-milestone.js — the replacement for the two uncontrolled
 * the-odds-api call sites (the unconditional hourly poll in odds-collector.js,
 * and the live-compute-on-cache-miss fallback that used to live in
 * odds-divergence.js). Covers: due-milestone detection, idempotent capture,
 * retry throttling when a line isn't posted yet, and the quota safety cutoff.
 */

process.env.TEST_MODE = '1';

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;
function assert(cond, label) {
  cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++);
}

console.log('━━━ odds-milestone unit tests ━━━');

const theOddsApiClient = require('../lib/services/the-odds-api');
const { runDueOddsMilestones, nextOddsWakeDelay } = require('../lib/services/odds-milestone');
const { db } = require('../lib/db');

const originalFetch = theOddsApiClient.fetchMatchOdds;
const originalQuota = theOddsApiClient.getQuotaSnapshot;
const silentLogger = { warn() {}, error() {}, log() {} };

function fakePredictionService() {
  return {
    predictMatch: async () => ({
      homeWin: 0.5,
      draw: 0.25,
      awayWin: 0.25,
      match: {
        homeId: '464',
        awayId: '448',
        homeNameI18n: { en: 'Norway' },
        awayNameI18n: { en: 'England' },
      },
    }),
  };
}

function realOdds() {
  return { homeWin: '2.0', draw: '3.2', awayWin: '4.0', source: 'test', vendor: 'test' };
}

function futureMatch(id, hoursOut = 30) {
  return { matchId: id, kickoffUtc: new Date(Date.now() + hoursOut * 60 * 60 * 1000).toISOString() };
}

const tmpDirs = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `odds-milestone-${label}-`));
  tmpDirs.push(d);
  return d;
}

(async () => {
  process.env.THE_ODDS_API_KEY = 'test-key';

  // 1) OPENING_LINE is due immediately for a match 30h out (T-24h/lineup/pre-kickoff are not).
  const dir1 = mkTmp('opening');
  const matchA = futureMatch('test-odds-milestone-opening');
  let calls = 0;
  theOddsApiClient.fetchMatchOdds = async () => { calls++; return realOdds(); };
  theOddsApiClient.getQuotaSnapshot = () => null;

  const actions1 = await runDueOddsMilestones({
    schedule: [matchA], dataDir: dir1, db, predictionService: fakePredictionService(), logger: silentLogger,
  });
  assert(calls === 1, 'fetchMatchOdds called exactly once for the one due milestone (OPENING_LINE)');
  assert(actions1.some(a => a.startsWith('odds_OPENING_LINE:')), 'OPENING_LINE captured on first pass');
  assert(!actions1.some(a => a.includes('T_MINUS_24H')), 'T_MINUS_24H not yet due for a 30h-out match');

  // 2) Idempotent: a second pass must not re-fetch an already-captured milestone.
  calls = 0;
  const actions2 = await runDueOddsMilestones({
    schedule: [matchA], dataDir: dir1, db, predictionService: fakePredictionService(), logger: silentLogger,
  });
  assert(calls === 0, 'second pass does not re-fetch an already-captured milestone');
  assert(actions2.length === 0, 'no new actions once OPENING_LINE is captured and nothing else is due yet');

  // 3) The capture must have written a usable match_odds_benchmark row (this is
  // what the homepage/match-detail "model vs market" panel reads).
  const row = db.prepare('SELECT * FROM match_odds_benchmark WHERE match_id = ?').get(matchA.matchId);
  assert(!!row, 'match_odds_benchmark row written after a successful capture');
  assert(row && row.market_home_prob != null, 'market_home_prob populated from the captured odds');
  assert(row && row.model_home_prob != null, 'model_home_prob populated from the (free) pure model call');

  // 4) Bookmakers haven't posted a line yet (fetchMatchOdds -> null): the
  // milestone must stay uncaptured, and retries must be throttled instead of
  // hammering the API every tick.
  const dir2 = mkTmp('notlisted');
  const matchB = futureMatch('test-odds-milestone-notlisted');
  let notListedCalls = 0;
  theOddsApiClient.fetchMatchOdds = async () => { notListedCalls++; return null; };

  await runDueOddsMilestones({ schedule: [matchB], dataDir: dir2, db, predictionService: fakePredictionService(), logger: silentLogger });
  assert(notListedCalls === 1, 'attempts once when the line is not posted yet');
  await runDueOddsMilestones({ schedule: [matchB], dataDir: dir2, db, predictionService: fakePredictionService(), logger: silentLogger });
  assert(notListedCalls === 1, 'throttled: immediate re-run does not retry within the throttle window');
  const rowB = db.prepare('SELECT * FROM match_odds_benchmark WHERE match_id = ?').get(matchB.matchId);
  assert(!rowB, 'no benchmark row written when odds were never actually found');

  // 5) Quota safety cutoff: once the account is nearly dry, stop spending
  // credits entirely rather than trusting a possibly-wrong local counter.
  const dir3 = mkTmp('quota');
  const matchC = futureMatch('test-odds-milestone-quota');
  let quotaCalls = 0;
  theOddsApiClient.fetchMatchOdds = async () => { quotaCalls++; return realOdds(); };
  theOddsApiClient.getQuotaSnapshot = () => ({ remaining: 2, used: 498, checkedAt: new Date().toISOString() });

  const actions3 = await runDueOddsMilestones({ schedule: [matchC], dataDir: dir3, db, predictionService: fakePredictionService(), logger: silentLogger });
  assert(quotaCalls === 0, 'refuses to call the API at all when remaining quota is at/under the safety margin');
  assert(actions3.length === 0, 'no actions taken when quota is low');

  // 6) Missing API key must be a graceful no-op, never a throw (this runs
  // unattended on a server tick — it must never crash the scheduler).
  const dir4 = mkTmp('nokey');
  delete process.env.THE_ODDS_API_KEY;
  theOddsApiClient.getQuotaSnapshot = () => null;
  let threw = false;
  try {
    await runDueOddsMilestones({
      schedule: [futureMatch('test-odds-milestone-nokey')], dataDir: dir4, db, predictionService: fakePredictionService(), logger: silentLogger,
    });
  } catch (e) {
    threw = true;
  }
  assert(!threw, 'missing THE_ODDS_API_KEY does not throw');
  const runsFileNoKey = path.join(dir4, 'odds_milestone_runs.json');
  const wroteNoKeyState = fs.existsSync(runsFileNoKey) && JSON.stringify(JSON.parse(fs.readFileSync(runsFileNoKey, 'utf8'))) !== '{"matches":{}}';
  assert(!wroteNoKeyState, 'missing API key does not start the retry-throttle clock for any milestone (regression guard)');
  process.env.THE_ODDS_API_KEY = 'test-key';

  // 7) nextOddsWakeDelay must return a sane value (or null) so the scheduler's
  // self-pacing tick loop never gets a NaN/negative timer.
  const delay = nextOddsWakeDelay([matchB], dir2);
  assert(delay === null || (Number.isFinite(delay) && delay > 0), 'nextOddsWakeDelay returns null or a positive delay');

  // Restore + cleanup
  theOddsApiClient.fetchMatchOdds = originalFetch;
  theOddsApiClient.getQuotaSnapshot = originalQuota;
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  try {
    db.prepare("DELETE FROM match_odds_benchmark WHERE match_id LIKE 'test-odds-milestone-%'").run();
  } catch { /* table may not exist in this test DB yet */ }

  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
