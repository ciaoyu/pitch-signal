#!/usr/bin/env node
'use strict';

/**
 * Pre-match snapshot guard test
 * Verifies that post-kickoff prediction snapshots are rejected.
 */

let savePredictionSnapshot;
try {
  ({ savePredictionSnapshot } = require('../lib/postMatchReview'));
} catch (e) {
  if (e.message && e.message.includes('NODE_MODULE_VERSION')) {
    console.log('⚠️  SKIP: Database unavailable (better-sqlite3 NODE_MODULE_VERSION mismatch)');
    process.exit(0);
  }
  throw e;
}

const result = savePredictionSnapshot('760438', {
  match: { homeId: '450', awayId: '467', homeName: 'Czechia', awayName: 'South Africa' },
  likelyScore: '2-0',
  homeWin: 0.6,
  draw: 0.25,
  awayWin: 0.15,
}, {
  createdAt: '2026-06-18T16:00:00.000Z',
  source: 'test-after-kickoff',
});

if (result !== null) {
  throw new Error('Post-kickoff prediction snapshot was not rejected');
}

console.log('PASS: post-kickoff prediction snapshots are rejected.');
