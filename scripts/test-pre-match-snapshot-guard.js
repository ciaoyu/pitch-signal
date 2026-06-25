'use strict';

const { savePredictionSnapshot } = require('../lib/postMatchReview');

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
