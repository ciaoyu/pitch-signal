#!/usr/bin/env node
'use strict';

/**
 * Owner D Acceptance & Specification Test Suite
 * Verifies Research Artifacts v2, Match-Level Ledger CSV, Clustered Paired Deltas,
 * and Domain Separation (Prospective 2026 vs Historical Replay).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BacktestRunner = require('../lib/backtest');
const ArtifactGenerator = require('../lib/research/artifactGenerator');
const PairedDeltaEvaluator = require('../lib/research/pairedDelta');

async function testResearchArtifactsV2() {
  console.log('🧪 Running Owner D — Research Artifacts v2 Test Suite...\n');

  const runner = new BacktestRunner();

  // D1. Determinism Check (§2.1)
  console.log('⏳ D1. Verifying deterministic walk-forward execution...');
  const res1 = await runner.run({ silent: true });
  const res2 = await runner.run({ silent: true });

  assert.strictEqual(res1.fullSeeded.evaluatedCount, 964, 'Evaluated count must be exactly 964');
  assert.strictEqual(res1.fullSeeded.accuracy, res2.fullSeeded.accuracy, 'Accuracy must be bit-identical across runs');
  assert.strictEqual(res1.fullSeeded.meanBrier, res2.fullSeeded.meanBrier, 'Mean Brier must be bit-identical across runs');
  assert.strictEqual(res1.fullSeeded.meanLogLoss, res2.fullSeeded.meanLogLoss, 'Mean LogLoss must be bit-identical across runs');
  console.log('  ✅ D1. Deterministic run invariant verified (964 matches, identical output across runs)');

  const fsRes = res1.fullSeeded;
  const evaluatedRecords = fsRes.evaluatedRecords;
  assert.strictEqual(evaluatedRecords.length, 964);

  // D2. CSV Generation & Columns Check
  console.log('⏳ D2. Verifying backtest-predictions.csv generation & columns...');
  const csvStr = ArtifactGenerator.generateCsv(evaluatedRecords);
  const lines = csvStr.trim().split('\n');
  assert.strictEqual(lines.length, 965, 'CSV must have 1 header line + 964 data lines = 965 lines');

  const header = lines[0].split(',');
  const requiredCols = ['match_id', 'tournament_year', 'date', 'stage', 'home_team', 'away_team', 'home_win_prob', 'draw_prob', 'away_win_prob', 'actual_outcome', 'elo_diff', 'is_knockout', 'model_version', 'data_cutoff', 'brier', 'log_loss', 'rps'];
  for (const col of requiredCols) {
    assert.ok(header.includes(col), `CSV header must include required column: ${col}`);
  }

  // Check first data line format
  const firstDataLine = lines[1];
  assert.ok(firstDataLine.includes('1930'), 'First row should belong to 1930 World Cup');
  assert.ok(firstDataLine.includes('p0-quarantine-v3-2026-07-10'), 'Must include A v4 quarantined model version');
  console.log('  ✅ D2. CSV generation verified (964 rows + complete required headers elo_diff/is_knockout/model_version/data_cutoff)');

  // D3. Clustered Paired Delta Verification (§2.2)
  console.log('⏳ D3. Verifying Clustered Paired Delta Evaluator over 22 tournament editions...');
  const pairedData = ArtifactGenerator.generatePairedDeltas(evaluatedRecords);
  assert.strictEqual(pairedData.modelVsUniform.clusterCount, 22, 'Must cluster over exactly 22 FIFA World Cup tournaments (1930-2022)');
  assert.strictEqual(pairedData.modelVsUniform.sampleSize, 964);
  assert.ok(Array.isArray(pairedData.modelVsUniform.brier.ci95), 'Must output 95% bootstrap CI');
  assert.strictEqual(pairedData.modelVsUniform.brier.ci95.length, 2);
  assert.ok(pairedData.modelVsUniform.brier.ci95[1] < 0, 'Model Brier improvement vs uniform must be statistically significant (< 0)');
  assert.ok(pairedData.modelVsUniform.methodologyNote.includes('avoiding the overlapping CI fallacy'));
  console.log('  ✅ D3. Clustered bootstrap paired delta verified (22 tournament clusters, CI strictly evaluated)');

  // D4. End-to-End Artifacts & Domain Separation Audit
  console.log('⏳ D4. Verifying end-to-end artifact files & prospective vs historical domain separation...');
  const tmpDir = path.join(__dirname, '..', 'outputs', 'test-research');
  const manifestInfo = await ArtifactGenerator.writeArtifacts(tmpDir, res1, 'test command');

  assert.ok(fs.existsSync(path.join(tmpDir, 'backtest-predictions.csv')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'calibration-classwise.json')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'paired-deltas.json')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'research-summary.json')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'MANIFEST.md')));

  const summary = JSON.parse(fs.readFileSync(path.join(tmpDir, 'research-summary.json'), 'utf8'));
  assert.strictEqual(summary.prospective_2026_online.sampleSize, 43, 'Prospective 2026 online sample must be 43');
  assert.strictEqual(summary.prospective_2026_online.metrics.meanBrier, 0.5059, 'Prospective 2026 online Brier must be 0.5059');
  assert.strictEqual(summary.prospective_2026_online.metrics.topLabelECE, 0.1563, 'Prospective 2026 online top-label ECE must be 0.1563');

  assert.strictEqual(summary.retrospective_historical_replay_964.sampleSize, 964, 'Historical replay sample must be 964');
  assert.ok(Math.abs(summary.retrospective_historical_replay_964.metrics.meanBrier - 0.570182) < 1e-4, 'Historical replay Brier must be ~0.5702');

  const manifestContent = fs.readFileSync(path.join(tmpDir, 'MANIFEST.md'), 'utf8');
  assert.ok(manifestContent.includes('Data License'), 'MANIFEST must specify Data License');
  assert.ok(manifestContent.includes('SHA-256 Checksums'), 'MANIFEST must include SHA-256 hashes');
  assert.ok(manifestContent.includes('0.5059') && manifestContent.includes('0.5702'), 'MANIFEST must explicitly separate 0.5059 prospective and 0.5702 retrospective numbers');
  console.log('  ✅ D4. End-to-end artifact generation and domain separation rules verified');

  // Clean up test tmpDir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('\n=============================================');
  console.log('Results: 4 test sections passed (100% PASS)');
  console.log('=============================================\n');
}

if (require.main === module) {
  testResearchArtifactsV2().catch(err => {
    console.error('❌ Owner D Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = testResearchArtifactsV2;
