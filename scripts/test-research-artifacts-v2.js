#!/usr/bin/env node
'use strict';

/**
 * Owner D v2 Acceptance & Specification Test Suite
 * Verifies Research Artifacts v2, Match-Level Ledger CSV, Clustered Paired Deltas across multiple baselines,
 * and Dynamic Prospective 2026 vs Historical Replay Domain Separation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BacktestRunner = require('../lib/backtest');
const ArtifactGenerator = require('../lib/research/artifactGenerator');

async function testResearchArtifactsV2() {
  console.log('🧪 Running Owner D v2 — Research Artifacts Test Suite...\n');

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

  const firstDataLine = lines[1];
  assert.ok(firstDataLine.includes('1930'), 'First row should belong to 1930 World Cup');
  assert.ok(firstDataLine.includes('p0-quarantine-v3-2026-07-10'), 'Must include A v4 quarantined model version');
  console.log('  ✅ D2. CSV generation verified (964 rows + complete required headers elo_diff/is_knockout/model_version/data_cutoff)');

  // D3. Clustered Paired Delta Verification across Multiple Baselines (§2.2)
  console.log('⏳ D3. Verifying Clustered Paired Delta Evaluator over 22 tournament editions & multiple baselines...');
  const pairedData = ArtifactGenerator.generatePairedDeltas(evaluatedRecords);
  assert.ok(pairedData.modelVsUniform, 'Must include modelVsUniform comparison');
  assert.ok(pairedData.modelVsHistoricalFrequency, 'Must include modelVsHistoricalFrequency comparison');
  assert.strictEqual(pairedData.modelVsUniform.clusterCount, 22, 'Must cluster over exactly 22 FIFA World Cup tournaments (1930-2022)');
  assert.strictEqual(pairedData.modelVsHistoricalFrequency.clusterCount, 22);
  assert.ok(pairedData.metadata.coveredBaselines.length >= 2, 'Must list covered baselines explicitly');
  assert.ok(pairedData.modelVsUniform.methodologyNote.includes('avoiding the overlapping CI fallacy'));
  assert.ok(Array.isArray(pairedData.modelVsUniform.brier.ci95TwoSided), 'Must report two-sided 95% CI');
  assert.ok(typeof pairedData.modelVsUniform.brier.pValueTwoSided === 'number', 'Must report two-sided empirical p-value');
  assert.ok(typeof pairedData.modelVsUniform.brier.pValueOneSided === 'number', 'Must report one-sided empirical p-value');
  console.log('  ✅ D3. Clustered bootstrap paired deltas verified across Uniform & Historical Frequency baselines (aligned two-sided CI/p-value)');

  // D4. Dynamic Prospective Evaluation & Domain Separation (No Hardcoded Evidence Allowed)
  console.log('⏳ D4. Verifying dynamic prospective metrics calculation & domain separation rules...');
  
  // (a) Test default case when ledger is missing (must output unverified/null, NEVER hardcode)
  const unverifiedProspective = ArtifactGenerator.computeProspectiveMetrics({ prospectiveLedgerPath: '/non/existent/path.json' });
  assert.strictEqual(unverifiedProspective.status, 'unverified', 'Missing ledger must return unverified status');
  assert.strictEqual(unverifiedProspective.sampleSize, null, 'Missing ledger must have sampleSize null');
  assert.strictEqual(unverifiedProspective.metrics.meanBrier, null, 'Missing ledger must have meanBrier null');

  const tmpDir = path.join(__dirname, '..', 'outputs', 'test-research');
  fs.mkdirSync(tmpDir, { recursive: true });

  // (b) Test rejection of fake/incomplete ledger lacking strict verification criteria
  const fakeLedgerPath = path.join(tmpDir, 'fake_unverified_ledger.json');
  const fakeLedgerRecords = [
    { pred: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 }, actualOutcome: 'home' } // Lacks verificationStatus, modelVersion, configHash, kickoffTime
  ];
  fs.writeFileSync(fakeLedgerPath, JSON.stringify({ records: fakeLedgerRecords }), 'utf8');
  const fakeProspective = ArtifactGenerator.computeProspectiveMetrics({ prospectiveLedgerPath: fakeLedgerPath });
  assert.strictEqual(fakeProspective.status, 'unverified', 'Incomplete/fake ledger must be rejected as unverified');

  // (c) Test acceptance of strictly verified immutable pre-match ledger records
  const validLedgerPath = path.join(tmpDir, 'strictly_verified_ledger.json');
  const verifiedLedgerRecords = [
    {
      verificationStatus: 'verified',
      modelVersion: 'p0-quarantine-v3-2026-07-10',
      configHash: '2066763607e5',
      predictedAt: '2026-06-10T10:00:00Z',
      kickoffTime: '2026-06-10T19:00:00Z',
      source: 'Track A',
      pred: { homeWin: 0.6, draw: 0.25, awayWin: 0.15 },
      actualOutcome: 'home'
    },
    {
      verificationStatus: 'verified',
      modelVersion: 'p0-quarantine-v3-2026-07-10',
      configHash: '2066763607e5',
      predictedAt: '2026-06-11T10:00:00Z',
      kickoffTime: '2026-06-11T18:00:00Z',
      source: 'Track A',
      pred: { homeWin: 0.3, draw: 0.4, awayWin: 0.3 },
      actualOutcome: 'draw'
    }
  ];
  fs.writeFileSync(validLedgerPath, JSON.stringify({ dataCutoff: '2026-06-11', records: verifiedLedgerRecords }), 'utf8');

  const verifiedProspective = ArtifactGenerator.computeProspectiveMetrics({ prospectiveLedgerPath: validLedgerPath });
  assert.strictEqual(verifiedProspective.status, 'verified');
  assert.strictEqual(verifiedProspective.sampleSize, 2);
  assert.ok(typeof verifiedProspective.metrics.meanBrier === 'number');
  assert.ok(verifiedProspective.inputHash, 'Must hash the prospective ledger input file');

  // (d) Test complete writeArtifacts output
  await ArtifactGenerator.writeArtifacts(tmpDir, res1, 'test command', { prospectiveLedgerPath: validLedgerPath });

  assert.ok(fs.existsSync(path.join(tmpDir, 'backtest-predictions.csv')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'calibration-classwise.json')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'paired-deltas.json')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'research-summary.json')));
  assert.ok(fs.existsSync(path.join(tmpDir, 'MANIFEST.md')));

  const summary = JSON.parse(fs.readFileSync(path.join(tmpDir, 'research-summary.json'), 'utf8'));
  assert.strictEqual(summary.prospective_2026_online.status, 'verified');
  assert.strictEqual(summary.prospective_2026_online.sampleSize, 2);
  assert.strictEqual(summary.retrospective_historical_replay_964.sampleSize, 964);

  const manifestContent = fs.readFileSync(path.join(tmpDir, 'MANIFEST.md'), 'utf8');
  assert.ok(manifestContent.includes('Data License'), 'MANIFEST must specify Data License');
  assert.ok(manifestContent.includes('SHA-256 Checksums'), 'MANIFEST must include SHA-256 hashes');
  assert.ok(manifestContent.includes('Model vs. Uniform Baseline') && manifestContent.includes('Model vs. Walk-Forward Historical Frequency Baseline'));
  assert.ok(manifestContent.includes('Evaluation Boundary Note'));

  // Clean up test directory
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('  ✅ D4. Strict verified ledger checks and zero-hardcoding rules verified');

  console.log('\n=============================================');
  console.log('Results: 4 test sections passed (100% PASS)');
  console.log('=============================================\n');
}

if (require.main === module) {
  testResearchArtifactsV2().catch(err => {
    console.error('❌ Owner D v2 Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = testResearchArtifactsV2;
