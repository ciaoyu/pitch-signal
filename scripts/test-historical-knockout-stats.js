#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { loadAllHistoryMatches } = require('../lib/backtest');
const { inferDrawWinner, calculateYearStats, loadHistoricalKnockoutStats } = require('../lib/services/historical-knockout-stats');
const { detectKnockout } = require('../lib/knockoutStage');

const history = loadAllHistoryMatches();
const y2022 = history.byYear['2022'];
const final = y2022.find(m => m.stage === 'Final');
const qf = y2022.find(m => m.stage === 'Quarter-finals' && new Set([m.home, m.away]).has('Brazil'));
assert.equal(inferDrawWinner(final, y2022, '2022'), 'Argentina');
assert.equal(inferDrawWinner(qf, y2022, '2022'), 'Croatia');

const synthetic = [
  { date: '2022-07-01', home: 'Alpha', away: 'Beta', homeScore: 1, awayScore: 1, stage: 'Semi-finals' },
  { date: '2022-07-05', home: 'Alpha', away: 'Gamma', homeScore: 2, awayScore: 0, stage: 'Third place' },
];
assert.equal(inferDrawWinner(synthetic[0], synthetic, '2022'), null, 'third-place appearance cannot prove progression');

for (const year of ['1954', '1958', '1962']) {
  const rows = history.byYear[year];
  assert.ok(rows.some(m => detectKnockout(m.stage).isKnockout), `${year} has recognized knockout matches`);
  assert.ok(rows.filter(m => /group/i.test(m.stage)).every(m => !detectKnockout(m.stage).isKnockout), `${year} group stages excluded`);
}

const stats = calculateYearStats('2022', y2022);
assert.equal(stats.Argentina.shootoutsWon, 2);
assert.equal(stats.Croatia.shootoutsWon, 2);
assert.ok(loadHistoricalKnockoutStats().allTime.England.matchesPlayed > 0);
console.log('historical knockout stats: all assertions passed');
