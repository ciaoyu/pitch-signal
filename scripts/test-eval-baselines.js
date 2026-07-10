#!/usr/bin/env node
/**
 * W1-C Regression & Specification Test
 * Verifies Four Baselines Comparison (§2.1), Reliability Diagram 10-bin JSON (§0.4),
 * and Pre-Registered Hypothesis Report.
 */

const assert = require('assert');
const BacktestRunner = require('../lib/backtest');

async function testW1CEvalBaselines() {
  console.log('🧪 Running W1-C Eval Baselines & Reliability Diagram tests...');

  const runner = new BacktestRunner();

  // Test static helper computeReliabilityDiagram
  const dummyRecords = [];
  for (let i = 0; i < 100; i++) {
    dummyRecords.push({
      pred: { homeWin: 0.5, draw: 0.25, awayWin: 0.25 },
      actualOutcome: i < 50 ? 'home' : (i < 75 ? 'draw' : 'away')
    });
  }
  const dummyDiag = BacktestRunner.computeReliabilityDiagram(dummyRecords, 10);
  assert.ok(dummyDiag.home && dummyDiag.draw && dummyDiag.away, 'Reliability diagram should include home, draw, away');
  assert.strictEqual(dummyDiag.home.bins.length, 10, 'Should create 10 equal-frequency bins');
  assert.ok('lowest' in dummyDiag.home.tail_bins && 'highest' in dummyDiag.home.tail_bins, 'Should include tail_bins lowest/highest');

  // Test full walk-forward execution
  const results = await runner.run({ silent: true });
  assert.ok(results.fullSeeded, 'fullSeeded result should exist');

  const fs = results.fullSeeded;
  assert.strictEqual(fs.evaluatedCount, 964, 'Evaluated count must be exactly 964');

  // 1. Uniform Baseline check
  assert.ok(Math.abs(fs.baselines.uniform.accuracy - 1 / 3) < 1e-6, 'Uniform accuracy should be 1/3');
  assert.ok(Math.abs(fs.baselines.uniform.meanBrier - 2 / 3) < 1e-6, 'Uniform Brier should be 2/3');

  // 2. Historical Frequency check (expanding window walk-forward)
  assert.ok(Math.abs(fs.baselines.historicalFrequency.accuracy - 0.51970954) < 1e-4, 'Historical frequency accuracy should be ~51.97%');
  assert.ok(Math.abs(fs.baselines.historicalFrequency.meanBrier - 0.61611681) < 1e-4, 'Historical frequency Brier should be ~0.6161%');

  // 3. Model Baseline check (Wave 1 Red Line invariant)
  // NOTE (Owner A P0 quarantine v2): the model baseline moved because the
  // quarantine legitimately removed the un-estimated nominal home advantage
  // (all WC matches are neutral) plus the coach / capacity-venue / fatigue
  // signals. 57.88% -> 55.50% is the HONEST accuracy of the quarantined model,
  // not a spurious regression. See docs/acceptance/prediction-p0-quarantine-v2.md.
  assert.ok(Math.abs(fs.baselines.model.accuracy - 0.55497925) < 1e-4, 'Model accuracy must be 55.50% (P0 quarantine v2)');
  assert.ok(Math.abs(fs.baselines.model.meanBrier - 0.58623131) < 1e-4, 'Model Brier must be 0.5862 (P0 quarantine v2)');

  // 4. Hypothesis report check
  assert.ok(fs.hypothesisReport.conclusion.includes('significantly outperforms'), 'Conclusion should reflect model outperforming historical baseline');

  // 5. Reliability Diagram check on fullSeeded
  assert.strictEqual(fs.reliabilityDiagram.home.bins.length, 10);
  assert.strictEqual(fs.reliabilityDiagram.draw.bins.length, 10);
  assert.strictEqual(fs.reliabilityDiagram.away.bins.length, 10);
  assert.strictEqual(typeof fs.reliabilityDiagram.home.tail_calibration_pass, 'boolean');

  console.log('15 passed');
  console.log('✅ W1-C Eval Baselines & Reliability Diagram tests passed!');
}

if (require.main === module) {
  testW1CEvalBaselines().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
}

module.exports = testW1CEvalBaselines;
