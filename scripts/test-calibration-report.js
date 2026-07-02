#!/usr/bin/env node
'use strict';

const {
  buildCalibrationReport,
  brierScore,
  outcomeFromScore,
} = require('../lib/backtest-calibration');
const createCalibrationRoutes = require('../lib/routes/calibration');

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

console.log('━━━ calibration report tests ━━━');

assert(outcomeFromScore(2, 1) === 'home', 'home score maps to home outcome');
assert(outcomeFromScore(0, 0) === 'draw', 'equal score maps to draw outcome');
assert(Math.abs(brierScore({ homeWin: 0.6, draw: 0.25, awayWin: 0.15, outcome: 'home' }) - 0.245) < 0.000001, 'Brier score uses three-way squared error');

const rows = [
  { matchId: '1', homeTeamName: 'A', awayTeamName: 'B', homeWin: 0.72, draw: 0.18, awayWin: 0.10, actualHomeScore: 2, actualAwayScore: 0, outcome: 'home' },
  { matchId: '2', homeTeamName: 'C', awayTeamName: 'D', homeWin: 0.62, draw: 0.22, awayWin: 0.16, actualHomeScore: 1, actualAwayScore: 2, outcome: 'away' },
  { matchId: '3', homeTeamName: 'E', awayTeamName: 'F', homeWin: 0.35, draw: 0.34, awayWin: 0.31, actualHomeScore: 0, actualAwayScore: 0, outcome: 'draw' },
  { matchId: '4', homeTeamName: 'G', awayTeamName: 'H', homeWin: 0.20, draw: 0.24, awayWin: 0.56, actualHomeScore: 0, actualAwayScore: 1, outcome: 'away' },
];

const report = buildCalibrationReport({ rows });
assert(report.status === 'ok', 'report status is ok when rows exist');
assert(report.sampleSize === 4, 'report counts sample size');
assert(report.metrics.brier > 0 && report.metrics.brier < 2, 'report includes mean Brier score');
assert(report.metrics.accuracy === 0.5, 'report includes top-pick accuracy');
assert(report.buckets.length === 10, 'report includes 10 calibration buckets');
assert(report.buckets.some(b => b.count > 0 && b.avgConfidence != null), 'non-empty buckets include confidence and accuracy');
assert(report.platt.available === false && report.platt.reason === 'insufficient_sample', 'Platt fitting is gated on sample size');
assert(report.recent.length === 4 && report.recent[0].matchId === '4', 'recent rows are newest first');

const routeReport = createCalibrationRoutes()['GET /api/calibration-report'];
assert(typeof routeReport === 'function', 'calibration route is registered by factory');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
