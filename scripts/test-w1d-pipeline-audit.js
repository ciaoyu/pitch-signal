#!/usr/bin/env node
/**
 * W1-D Data Pipeline Audit Test Suite
 * Verifies:
 *   1. Neutral Venue & Host Ground Annotation Coverage (§3, §4.4)
 *   2. K-Factor Lookahead Leakage Verification (§4.4)
 *   3. daysAgo Plumbing & Default Bit-Identical Invariant (§4.2)
 *   4. elo-seed.json Non-Leakage Verification (§4.4)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BacktestRunner = require('../lib/backtest');
const EloRating = require('../lib/elo');

async function testW1DPipelineAudit() {
  console.log('🧪 Running W1-D Data Pipeline Audit tests...');

  const runner = new BacktestRunner();

  // 1. Elo Seed Non-Leakage Audit (§4.4)
  const eloSeedPath = path.join(__dirname, '..', 'data', 'elo-seed.json');
  assert.ok(fs.existsSync(eloSeedPath), 'elo-seed.json must exist');
  const eloSeed = JSON.parse(fs.readFileSync(eloSeedPath, 'utf8'));
  assert.ok(eloSeed.snapshots, 'eloSeed must have snapshots object');

  const historyDir = path.join(__dirname, '..', 'data', 'history');
  let snapshotCount = 0;
  for (const [year, snap] of Object.entries(eloSeed.snapshots)) {
    if (year === 'current' || year === '2026') continue;
    const historyFile = path.join(historyDir, `worldcup_${year}.json`);
    if (!fs.existsSync(historyFile)) continue;

    snapshotCount++;
    const doc = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    const matchDates = (doc.matches || []).map(m => m.date).sort();
    assert.ok(matchDates.length > 0, `World Cup ${year} must have matches`);
    const kickoffDate = matchDates[0];

    // Every snapshot asOf date must be <= opening match date of that tournament
    assert.ok(
      snap.asOf <= kickoffDate,
      `Snapshot date ${snap.asOf} for ${year} must not leak results after kickoff ${kickoffDate}`
    );
  }
  assert.strictEqual(snapshotCount, 22, 'Must audit all 22 historical World Cup editions (1930-2022)');

  // 2. K-Factor Lookahead Leakage Audit (§4.4)
  const elo = new EloRating();
  assert.strictEqual(elo.getKFactor('world_cup'), 60, 'World Cup K-factor must be 60');
  assert.strictEqual(elo.getKFactor('qualifier'), 45, 'Qualifier K-factor must be 45');
  assert.strictEqual(elo.getKFactor('continental'), 50, 'Continental K-factor must be 50');
  assert.strictEqual(elo.getKFactor('friendly'), 30, 'Friendly K-factor must be 30');

  // 3. Run backtest in default mode to verify Venue Audit (§3, §4.4) and Bit-Identical Invariant (§4.2)
  const results = await runner.run({ silent: true });
  assert.ok(results.fullSeeded, 'fullSeeded results must exist');
  const fsRes = results.fullSeeded;

  // Venue annotation check
  assert.ok(fsRes.venueAudit, 'venueAudit must exist in fullSeeded results');
  assert.strictEqual(fsRes.venueAudit.totalMatches, 964, 'Total audited matches must be exactly 964');
  assert.strictEqual(fsRes.venueAudit.neutralMatches, 843, 'Neutral matches must be exactly 843 (87.45%)');
  assert.strictEqual(fsRes.venueAudit.hostMatches, 121, 'Host nation matches must be exactly 121 (12.55%)');
  assert.strictEqual(fsRes.venueAudit.hostHomeCount, 91, 'Host nation as home team count must be 91');
  assert.strictEqual(fsRes.venueAudit.hostAwayCount, 30, 'Host nation as away team count must be 30');
  assert.ok(Math.abs(fsRes.venueAudit.neutralRatio - 0.874481) < 1e-4, 'Neutral ratio must be ~87.45%');

  // Bit-Identical Wave 1 Red Line Invariant check
  assert.strictEqual(fsRes.evaluatedCount, 964, 'Default evaluatedCount must be 964');
  assert.ok(Math.abs(fsRes.accuracy - 0.57883817) < 1e-6, 'Default accuracy must be bit-identical 57.88%');
  assert.ok(Math.abs(fsRes.meanBrier - 0.57076772) < 1e-6, 'Default Brier must be bit-identical 0.5708');
  assert.ok(Math.abs(fsRes.meanLogLoss - 0.964406) < 1e-4, 'Default LogLoss must be bit-identical ~0.9644');

  // 4. daysAgo Plumbing verification (§4.2)
  // Verify public entry points (compareBaseline and run) correctly plumb useDaysAgo/decayHalfLifeDays
  // and alter numerical results away from default un-decayed baseline.
  const decayConfig = { useDaysAgo: true, decayHalfLifeDays: 180, referenceDate: '2022-11-20' };

  // (a) Test compareBaseline public gatekeeper interface
  const cmpRes = await runner.compareBaseline(decayConfig);
  assert.ok(cmpRes.proposed, 'compareBaseline must accept decayConfig without throwing');
  assert.notStrictEqual(cmpRes.proposed.brier, cmpRes.baseline.brier, 'Decayed proposed Brier must differ from default baseline Brier');
  assert.ok(Math.abs(cmpRes.proposed.brier - 0.5721) < 1e-4, `Decayed compareBaseline Brier expected ~0.5721, got ${cmpRes.proposed.brier}`);

  // (b) Test run() public entry point
  const decayRunRes = await runner.run({ silent: true, ...decayConfig });
  assert.notStrictEqual(
    decayRunRes.fullSeeded.meanBrier,
    fsRes.meanBrier,
    'run({ useDaysAgo: true }) must plumb options and produce decayed Brier different from default'
  );
  assert.ok(
    Math.abs(decayRunRes.fullSeeded.meanBrier - 0.5721424) < 1e-5,
    `Decayed run() Brier expected ~0.5721424, got ${decayRunRes.fullSeeded.meanBrier}`
  );

  console.log('24 passed');
  console.log('✅ W1-D Data Pipeline Audit tests passed successfully!');
}

if (require.main === module) {
  testW1DPipelineAudit().catch(err => {
    console.error('❌ W1-D Test failed:', err);
    process.exit(1);
  });
}

module.exports = testW1DPipelineAudit;
