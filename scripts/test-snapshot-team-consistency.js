#!/usr/bin/env node
'use strict';

/**
 * Regression test: pre-match snapshot / post-match review team-consistency guard.
 *
 * Reproduces the 2026-07-14 France 0-2 Spain (ESPN 760514) incident where the
 * post-match review graded a STALE pre-match snapshot: it was captured while the
 * knockout opponent was still a TBD placeholder (ESPN id "17629"), so the review
 * surfaced a bogus 72.7% pre-match confidence for a fixture that never had that
 * forecast at kickoff.
 *
 * Two root causes, both in lib/postMatchReview.js:
 *   1. savePredictionSnapshot() de-dup only compared modelVersion + configHash, so
 *      the kickoff-time re-run (with the resolved real opponent) was a no-op and
 *      the placeholder snapshot survived.
 *   2. The review pipeline read the latest snapshot without checking that its
 *      teams match the actual fixture.
 *
 * Covers:
 *   A. De-dup key includes team ids — opponent resolving from placeholder → real
 *      forces a fresh snapshot even when model version/config hash are identical.
 *   B. Identical teams + identical version/hash still de-dup (immutability kept).
 *   C. buildPostMatchReview discards a mismatched snapshot (no recovery available)
 *      and does NOT expose a bogus confidence.
 *   D. buildPostMatchReview recovers the most recent team-matching snapshot when
 *      the latest one is stale.
 */

let PMR;
let db;
try {
  PMR = require('../lib/postMatchReview');
  ({ db } = require('../lib/db'));
} catch (e) {
  if (e.message && e.message.includes('NODE_MODULE_VERSION')) {
    console.log('⚠️  SKIP: Database unavailable (better-sqlite3 NODE_MODULE_VERSION mismatch)');
    process.exit(0);
  }
  throw e;
}

const { savePredictionSnapshot, getPredictionSnapshot, buildPostMatchReview } = PMR;

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// Synthetic ids: not in match_snapshot_schedule.json, so the post-kickoff guard
// (getScheduledKickoff) stays inert and lets us seed snapshots at any timestamp.
const MATCH_ID = 'team_consistency_test_760514';
const HOME_ID = '164';        // France (stable across the fixture)
const REAL_AWAY_ID = '176';   // Spain — resolved opponent at kickoff
const PLACEHOLDER_AWAY_ID = '17629'; // ESPN TBD placeholder (== bogus away team name)

function cleanup() {
  db.prepare('DELETE FROM prediction_snapshots WHERE match_id = ?').run(MATCH_ID);
  db.prepare('DELETE FROM post_match_reviews WHERE match_id = ?').run(MATCH_ID);
}

function countRows() {
  return db.prepare('SELECT COUNT(*) AS n FROM prediction_snapshots WHERE match_id = ?').get(MATCH_ID).n;
}

// A prediction with a fixed model contract so version/hash are stable between saves.
function makePrediction({ awayId, awayName, homeWin, draw, awayWin, likelyScore }) {
  return {
    match: { homeId: HOME_ID, awayId, homeName: '法国 France', awayName },
    likelyScore,
    homeWin,
    draw,
    awayWin,
    goals: { homeExpected: 1.4, awayExpected: 1.1 },
    modelContract: { modelVersion: 'v4-test', configHash: 'cfg-hash-test' },
  };
}

// ===== A. De-dup key includes team ids =====
function testDedupIncludesTeams() {
  console.log('\n📋 Test A: placeholder → real opponent forces a fresh snapshot');
  cleanup();

  // Placeholder snapshot (opponent not yet resolved), created before kickoff.
  const placeholder = savePredictionSnapshot(MATCH_ID, makePrediction({
    awayId: PLACEHOLDER_AWAY_ID, awayName: PLACEHOLDER_AWAY_ID,
    homeWin: 0.727, draw: 0.16, awayWin: 0.113, likelyScore: '2-0',
  }), { createdAt: '2026-07-10T18:58:00.000Z', source: 'test-placeholder' });
  assert(placeholder !== null, 'placeholder snapshot saved');
  assert(String(placeholder.awayTeamId) === PLACEHOLDER_AWAY_ID, 'placeholder away team id stored');

  // Kickoff-time re-run: SAME model version + config hash, but the opponent has
  // now resolved to the real team. Must NOT be de-duped away.
  const real = savePredictionSnapshot(MATCH_ID, makePrediction({
    awayId: REAL_AWAY_ID, awayName: '西班牙 Spain',
    homeWin: 0.542, draw: 0.266, awayWin: 0.192, likelyScore: '1-1',
  }), { createdAt: '2026-07-14T18:00:00.000Z', source: 'test-kickoff' });
  assert(real !== null, 'kickoff snapshot saved');
  assert(real.id !== placeholder.id, 'kickoff snapshot is a NEW row (not de-duped)');
  assert(String(real.awayTeamId) === REAL_AWAY_ID, 'kickoff snapshot has the real away team id');
  assert(countRows() === 2, `two distinct snapshots exist (got ${countRows()})`);

  const latest = getPredictionSnapshot(MATCH_ID);
  assert(String(latest.awayTeamId) === REAL_AWAY_ID, 'getPredictionSnapshot returns the real-team snapshot');
  assert(Math.abs(latest.homeWin - 0.542) < 1e-9, 'latest snapshot carries the real kickoff probabilities');
}

// ===== B. Identical teams still de-dup (immutability preserved) =====
function testIdenticalTeamsStillDedup() {
  console.log('\n📋 Test B: identical teams + version/hash still de-dups');
  const before = countRows();
  const again = savePredictionSnapshot(MATCH_ID, makePrediction({
    awayId: REAL_AWAY_ID, awayName: '西班牙 Spain',
    homeWin: 0.542, draw: 0.266, awayWin: 0.192, likelyScore: '1-1',
  }), { createdAt: '2026-07-14T18:30:00.000Z', source: 'test-kickoff-again' });
  assert(countRows() === before, `no new row for an identical fixture (still ${before})`);
  assert(String(again.awayTeamId) === REAL_AWAY_ID, 'de-duped save returns the existing real-team snapshot');
}

// ===== C. Review discards a mismatched snapshot with no recovery =====
function testReviewDiscardsMismatch() {
  console.log('\n📋 Test C: review discards a stale snapshot (no recovery) — no bogus confidence');
  const emptyMatchId = 'team_consistency_test_norecover';
  db.prepare('DELETE FROM prediction_snapshots WHERE match_id = ?').run(emptyMatchId);

  const staleSnapshot = {
    id: 50,
    matchId: emptyMatchId,
    homeTeamId: HOME_ID,
    awayTeamId: PLACEHOLDER_AWAY_ID, // TBD placeholder — wrong opponent
    homeTeamName: '法国 France',
    awayTeamName: PLACEHOLDER_AWAY_ID,
    predictedScore: '2-0',
    homeWin: 0.727, draw: 0.16, awayWin: 0.113,
    homeExpectedGoals: 1.4, awayExpectedGoals: 0.6,
    createdAt: '2026-07-10T18:58:00.000Z',
  };

  const review = buildPostMatchReview({
    matchId: emptyMatchId,
    match: {
      homeId: HOME_ID, awayId: REAL_AWAY_ID,
      homeName: '法国 France', awayName: '西班牙 Spain',
      homeScore: 0, awayScore: 2, completed: true, status: 'STATUS_FINAL',
    },
    snapshot: staleSnapshot,
  });

  assert(review.predictionSnapshot === null, 'stale snapshot is discarded (predictionSnapshot=null)');
  assert(review.predictionSource === 'stale_snapshot_discarded', `predictionSource=${review.predictionSource}`);
  assert(review.biasAnalysis.predictedConfidence === 0, `predictedConfidence not the bogus 72.7 (got ${review.biasAnalysis.predictedConfidence})`);
  assert(review.predictionSnapshotNote && /弃用/.test(review.predictionSnapshotNote.zh || ''), 'predictionSnapshotNote flags the discarded snapshot');
  assert(review.aiPrediction === null, 'aiPrediction is null (no snapshot to grade)');

  db.prepare('DELETE FROM prediction_snapshots WHERE match_id = ?').run(emptyMatchId);
}

// ===== D. Review recovers the most recent team-matching snapshot =====
function testReviewRecoversMatchingSnapshot() {
  console.log('\n📋 Test D: review recovers a team-matching snapshot when the latest is stale');
  cleanup();

  // Seed the real kickoff snapshot in the DB (the one recovery should find).
  savePredictionSnapshot(MATCH_ID, makePrediction({
    awayId: REAL_AWAY_ID, awayName: '西班牙 Spain',
    homeWin: 0.542, draw: 0.266, awayWin: 0.192, likelyScore: '1-1',
  }), { createdAt: '2026-07-14T18:00:00.000Z', source: 'test-kickoff' });

  // Explicitly hand the review a STALE (placeholder) snapshot; it must reject it
  // and recover the real-team snapshot from the DB.
  const staleSnapshot = {
    id: 50,
    matchId: MATCH_ID,
    homeTeamId: HOME_ID,
    awayTeamId: PLACEHOLDER_AWAY_ID,
    homeTeamName: '法国 France',
    awayTeamName: PLACEHOLDER_AWAY_ID,
    predictedScore: '2-0',
    homeWin: 0.727, draw: 0.16, awayWin: 0.113,
    homeExpectedGoals: 1.4, awayExpectedGoals: 0.6,
    createdAt: '2026-07-10T18:58:00.000Z',
  };

  const review = buildPostMatchReview({
    matchId: MATCH_ID,
    match: {
      homeId: HOME_ID, awayId: REAL_AWAY_ID,
      homeName: '法国 France', awayName: '西班牙 Spain',
      homeScore: 0, awayScore: 2, completed: true, status: 'STATUS_FINAL',
    },
    snapshot: staleSnapshot,
  });

  assert(review.predictionSnapshot !== null, 'a snapshot was recovered');
  assert(String(review.predictionSnapshot.awayTeamId) === REAL_AWAY_ID, 'recovered snapshot has the real away team');
  assert(review.predictionSource === 'pre_match', `predictionSource=${review.predictionSource} (real pre-match snapshot)`);
  assert(review.biasAnalysis.predictedConfidence === 54.2, `predictedConfidence reflects the real snapshot (got ${review.biasAnalysis.predictedConfidence})`);
  assert(review.predictionSnapshotNote && /改用/.test(review.predictionSnapshotNote.zh || ''), 'predictionSnapshotNote flags the recovery');

  cleanup();
}

function main() {
  console.log('🧪 Snapshot team-consistency regression tests');
  console.log('=============================================');
  try {
    testDedupIncludesTeams();
    testIdenticalTeamsStillDedup();
    testReviewDiscardsMismatch();
    testReviewRecoversMatchingSnapshot();
  } catch (e) {
    console.error('  💥 crashed:', e.stack || e.message);
    failed++;
  } finally {
    cleanup();
  }

  console.log('\n=============================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
