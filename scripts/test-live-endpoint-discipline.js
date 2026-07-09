#!/usr/bin/env node
'use strict';

/**
 * W1-A — Live endpoint discipline tests (roadmap §1.1, §1.4)
 *
 * Covers:
 *   1. reprice() convergence: ignores unverified soft signals (shots/possession/cards),
 *      proving the public live-probability path is pure math on hard facts (§1.1).
 *   2. POST /api/predict-live/:matchId is admin-gated:
 *        - public beta (no WRITE_API_TOKEN) → 403 for every caller;
 *        - admin server (token set) → 403 without token, 200 with Bearer token
 *          (gate passes for authorized admin, proving it is a gate not a removal).
 *   3. GET /api/match/:id/live-probability remains the public in-play path (not gated).
 *   4. Frontend §1.4 source guard: pressure index is NOT unconditionally rendered in the
 *      live view — it is gated behind an explicit experiment flag and shown in review.
 *
 * Run: node scripts/test-live-endpoint-discipline.js
 * Spawns its own server on port 5092 (public, no token) and 5093 (admin, token set),
 * each with a dedicated test DB, killed on exit. Avoids the 5099 port shared by other suites.
 */

const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const PUB_DB = path.join(__dirname, '..', 'data', 'test-w1a-public.db');
const ADM_DB = path.join(__dirname, '..', 'data', 'test-w1a-admin.db');
const PUB_PORT = 5092;
const ADM_PORT = 5093;
const ADMIN_TOKEN = 'test-w1a-token';

process.env.NODE_ENV = 'test';

let passed = 0;
let failed = 0;
let pubProcess = null;
let admProcess = null;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function request(port, p, method, body, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`http://localhost:${port}${p}`, opts).then(async (res) => {
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { status: res.status, data };
  });
}

function startServer(port, dbPath, extraEnv) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      TEST_DB_PATH: dbPath,
      ...extraEnv,
    };
    const proc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env });
    proc.on('error', () => {});
    const start = Date.now();
    const retry = () => {
      if (Date.now() - start < 12000) setTimeout(poll, 200);
      else { console.log('  ⚠️  health check timed out, proceeding anyway'); resolve(proc); }
    };
    const poll = () => {
      fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(500) })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => (d && d.status === 'ok' ? resolve(proc) : retry()))
        .catch(retry);
    };
    poll();
  });
}

async function main() {
  // ── 1. reprice() convergence: ignores unverified soft signals (§1.1) ──
  console.log('\n📋 Test 1: reprice() ignores unverified soft signals (pure-math convergence, §1.1)');
  const { reprice } = require('../lib/live-reprice');
  const base = {
    preLambdaHome: 1.5, preLambdaAway: 1.2,
    homeScore: 1, awayScore: 0, minuteElapsed: 60, addedTime: 0,
    homeRedCards: 0, awayRedCards: 0,
  };
  const withoutSignals = reprice(base);
  const withSignals = reprice({
    ...base,
    homeShots: 20, awayShots: 3,
    homePossession: 80, awayPossession: 20,
    homeYellowCards: 2, awayYellowCards: 0,
  });
  assert(
    withoutSignals.homeWin === withSignals.homeWin &&
    withoutSignals.draw === withSignals.draw &&
    withoutSignals.awayWin === withSignals.awayWin,
    'reprice output identical with/without soft signals (shots/possession/cards)'
  );
  assert(withoutSignals.source === 'live_reprice', "reprice source is 'live_reprice' (pure math path)");

  // ── 2. Public server (no token): predict-live must be blocked ──
  console.log('\n📋 Test 2: POST /api/predict-live blocked for public beta (no token) → 403');
  pubProcess = await startServer(PUB_PORT, PUB_DB, {});
  const pubRes = await request(PUB_PORT, '/api/predict-live/999', 'POST', {
    liveStats: { minute: 60, homeScore: 1, awayScore: 0, homeShots: 20, awayScore: 0 },
  });
  assert(
    pubRes.status === 403 || pubRes.status === 401,
    `public POST /api/predict-live returns ${pubRes.status} (blocked; soft signals cannot move probability)`
  );

  // The clean public path must stay reachable (not gated)
  const liveProb = await request(PUB_PORT, '/api/match/999/live-probability?homeScore=1&awayScore=0&minute=60', 'GET');
  assert(
    liveProb.status === 200,
    `GET /api/match/:id/live-probability remains the public in-play path (status ${liveProb.status})`
  );
  try { pubProcess.kill('SIGTERM'); } catch (_) {}
  pubProcess = null;

  // ── 3. Admin server (token set): gate works both ways ──
  console.log('\n📋 Test 3: admin gate — without token 403, with Bearer token 200');
  admProcess = await startServer(ADM_PORT, ADM_DB, { WRITE_API_TOKEN: ADMIN_TOKEN });
  const admNoToken = await request(ADM_PORT, '/api/predict-live/999', 'POST', {
    liveStats: { minute: 60, homeScore: 1, awayScore: 0 },
  });
  assert(
    admNoToken.status === 403 || admNoToken.status === 401,
    `admin server without token → ${admNoToken.status}`
  );
  const admWithToken = await request(
    ADM_PORT, '/api/predict-live/999', 'POST',
    { liveStats: { minute: 60, homeScore: 1, awayScore: 0 } },
    { Authorization: `Bearer ${ADMIN_TOKEN}` }
  );
  assert(
    admWithToken.status === 200,
    `admin server with Bearer token → ${admWithToken.status} (gate passes for authorized admin)`
  );
  try { admProcess.kill('SIGTERM'); } catch (_) {}
  admProcess = null;

  // ── 4. Frontend §1.4 source guard: pressure index not default-visible in live view ──
  console.log('\n📋 Test 4: frontend pressure index gated in live view (§1.4)');
  const src = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'match-detail.js'), 'utf8');
  assert(
    src.includes('const pressureExperimentOn = window.__ENABLE_PRESSURE_INDEX__ === true;'),
    'live pressure render is gated behind an explicit experiment flag'
  );
  assert(
    src.includes('if (isFinishedMatch || (isLive && pressureExperimentOn)) {'),
    'pressure is shown in review, or in live only via the experiment flag (not by default in live)'
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  try { pubProcess && pubProcess.kill('SIGTERM'); } catch (_) {}
  try { admProcess && admProcess.kill('SIGTERM'); } catch (_) {}
  process.exit(1);
});
