#!/usr/bin/env node
'use strict';

/**
 * Owner G: Market Shadow Ledger & Odds Archival Verification Suite
 *
 * Verifies:
 * G1. API Quota Protection & Controlled Odds Collection (stops blind 5-min polling, enforces daily quota).
 * G2. Permanent Archival & Dual Devigging (stores Proportional and Shin devig without slice(-200) truncation).
 * G3. As-Of Anti-Leakage Audit (validates snapshot timestamp strictly precedes kickoff time).
 * G4. OOS Shadow Benchmarking & Missing/Failure handling (status: 'unavailable' on missing/corrupt odds).
 * G5. Governance Invariant: usedInModel: false is strictly enforced; public probabilities are unchanged.
 */

const fs = require('fs');
const path = require('path');
const MarketShadowLedger = require('../lib/services/market-shadow-ledger');
const { createOddsCollectorJob } = require('../lib/jobs/odds-collector');
const PredictionEngine = require('../lib/prediction');

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

console.log('🧪 Running Owner G: Market Shadow Ledger Verification Suite...\n');

// ---------------------------------------------------------------------------
// G1. Dual Devigging (Proportional & Shin)
// ---------------------------------------------------------------------------
console.log('📋 G1: Dual Devigging (Proportional vs Shin)');
{
  const odds = { homeWin: 1.50, draw: 4.20, awayWin: 7.00 };
  const prop = MarketShadowLedger.devigProportional(odds);
  const shin = MarketShadowLedger.devigShin(odds);

  assert(prop && Math.abs(prop.homeWin + prop.draw + prop.awayWin - 1.0) < 1e-3, 'Proportional devig probabilities sum to 1.0');
  assert(shin && Math.abs(shin.homeWin + shin.draw + shin.awayWin - 1.0) < 1e-3, 'Shin devig probabilities sum to 1.0');
  assert(shin.homeWin > prop.homeWin, `Shin favorite probability raised (${shin.homeWin} > ${prop.homeWin})`);
  assert(shin.awayWin < prop.awayWin, `Shin longshot probability lowered (${shin.awayWin} < ${prop.awayWin})`);
}

// ---------------------------------------------------------------------------
// G2. As-Of Anti-Leakage Audit
// ---------------------------------------------------------------------------
console.log('\n📋 G2: As-Of Anti-Leakage Audit');
{
  const kickoff = '2026-06-15T19:00:00.000Z';
  const validPreMatchTs = '2026-06-15T14:00:00.000Z';
  const leakedPostKickoffTs = '2026-06-15T19:15:00.000Z';

  assert(MarketShadowLedger.verifyAsOfAntiLeakage(validPreMatchTs, kickoff) === true, 'Valid pre-match snapshot passes As-Of audit');
  assert(MarketShadowLedger.verifyAsOfAntiLeakage(leakedPostKickoffTs, kickoff) === false, 'Post-kickoff snapshot fails As-Of audit');
}

// ---------------------------------------------------------------------------
// G3. Permanent Archival (No slice(-200) Truncation)
// ---------------------------------------------------------------------------
console.log('\n📋 G3: Permanent Archival & Disk Persistence');
{
  const tmpDir = path.join('/tmp', 'market-shadow-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const matchKey = 'Brazil_vs_France';
  for (let i = 0; i < 205; i++) {
    MarketShadowLedger.recordSnapshot({
      matchKey,
      kickoffTime: '2028-07-01T20:00:00.000Z',
      bookmaker: 'Pinnacle',
      odds: { homeWin: 2.10, draw: 3.30, awayWin: 3.60 },
      dataDir: tmpDir
    });
  }

  const histFile = path.join(tmpDir, 'odds_brazil_vs_france.json');
  const saved = JSON.parse(fs.readFileSync(histFile, 'utf8'));
  assert(saved.snapshots.length === 205, `All 205 snapshots permanently archived without truncation (${saved.snapshots.length})`);
  assert(saved.snapshots[0].devig.shin && saved.snapshots[0].devig.proportional, 'Saved snapshot includes dual devigging');
  assert(saved.snapshots[0].asOfAntiLeakageVerified === true, 'Saved snapshot has As-Of verification metadata');

  // Test fail-closed when kickoffTime is missing
  const missingKickoffKey = 'Arg_vs_Ned';
  MarketShadowLedger.recordSnapshot({
    matchKey: missingKickoffKey,
    bookmaker: 'Pinnacle',
    odds: { homeWin: 2.10, draw: 3.30, awayWin: 3.60 },
    dataDir: tmpDir
  });
  const missingKickoffFile = path.join(tmpDir, 'odds_arg_vs_ned.json');
  const missingSaved = JSON.parse(fs.readFileSync(missingKickoffFile, 'utf8'));
  assert(missingSaved.snapshots[0].asOfAntiLeakageVerified === false, 'recordSnapshot without kickoffTime fail-closed (false)');

  // Test milestone recording across full chain
  const milestoneKey = 'Eng_vs_Ger';
  const milestones = ['OPENING_LINE', 'T_MINUS_24H', 'LINEUP_ANNOUNCED', 'PRE_KICKOFF'];
  for (const ms of milestones) {
    MarketShadowLedger.recordSnapshot({
      matchKey: milestoneKey,
      kickoffTime: '2028-07-01T20:00:00.000Z',
      bookmaker: 'Pinnacle',
      odds: { homeWin: 2.50, draw: 3.10, awayWin: 2.90 },
      milestone: ms,
      rawResponse: { bookmaker: 'Pinnacle', sample: true, milestone: ms },
      dataDir: tmpDir
    });
  }
  const milestoneFile = path.join(tmpDir, 'odds_eng_vs_ger.json');
  const msSaved = JSON.parse(fs.readFileSync(milestoneFile, 'utf8'));
  assert(msSaved.snapshots.length === 4, 'Saved all 4 milestone snapshots');
  assert(msSaved.snapshots[0].milestone === 'OPENING_LINE', 'Milestone OPENING_LINE saved correctly');
  assert(msSaved.snapshots[2].milestone === 'LINEUP_ANNOUNCED', 'Milestone LINEUP_ANNOUNCED saved correctly');
  assert(typeof msSaved.snapshots[0].rawResponseSha256 === 'string' && msSaved.snapshots[0].rawResponseSha256.length === 64, 'Per-snapshot rawResponseSha256 hash computed correctly');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// G4. Model vs Market OOS Shadow Benchmarking & Governance Invariants
// ---------------------------------------------------------------------------
console.log('\n📋 G4: Model vs Market Shadow Benchmark & Governance');
{
  const modelPred = { homeWin: 0.55, draw: 0.25, awayWin: 0.20 };
  const marketOdds = { homeWin: 1.80, draw: 3.60, awayWin: 4.80, ts: '2026-06-10T12:00:00Z' };

  const comp = MarketShadowLedger.compareModelVsMarket({
    matchId: 'm001',
    kickoffTime: '2026-06-10T18:00:00Z',
    modelPred,
    marketOdds,
    actualOutcome: 'home'
  });

  assert(comp.status === 'shadow_benchmark', 'Comparison returns shadow_benchmark status');
  assert(comp.usedInModel === false, 'Comparison strictly enforces usedInModel: false');
  assert(typeof comp.metrics.model.brier === 'number' && typeof comp.metrics.marketShin.brier === 'number', 'Computes OOS Brier scores for model and market');
  assert(comp.governanceConclusion.includes('SHADOW_ONLY'), 'Governance conclusion explicit in result');

  // Test missing/unavailable odds
  const missingComp = MarketShadowLedger.compareModelVsMarket({
    matchId: 'm002',
    modelPred,
    marketOdds: null
  });
  assert(missingComp.status === 'unavailable', 'Missing market odds cleanly report status: unavailable');
  assert(missingComp.usedInModel === false, 'Missing comparison still enforces usedInModel: false');

  // Test As-Of fail-closed and exclusion of leaked post-kickoff odds from OOS metrics
  const leakedComp = MarketShadowLedger.compareModelVsMarket({
    matchId: 'm003',
    kickoffTime: '2026-06-10T18:00:00Z',
    modelPred,
    marketOdds: { homeWin: 1.80, draw: 3.60, awayWin: 4.80, ts: '2026-06-10T19:30:00Z' },
    actualOutcome: 'home'
  });
  assert(leakedComp.asOfAntiLeakageVerified === false, 'Leaked post-kickoff comparison marked false');
  assert(leakedComp.metrics === null, 'Leaked post-kickoff record excluded from OOS metrics');

  // Test missing timestamp fail-closed
  const missingTsComp = MarketShadowLedger.compareModelVsMarket({
    matchId: 'm004',
    kickoffTime: '2026-06-10T18:00:00Z',
    modelPred,
    marketOdds: { homeWin: 1.80, draw: 3.60, awayWin: 4.80 },
    actualOutcome: 'home'
  });
  assert(missingTsComp.asOfAntiLeakageVerified === false, 'Missing timestamp fail-closed marked false');
  assert(missingTsComp.metrics === null, 'Missing timestamp record excluded from OOS metrics');

  // Generate Benchmark Report
  const report = MarketShadowLedger.generateShadowBenchmarkReport([comp, missingComp, leakedComp, missingTsComp]);
  assert(report.coverage.totalMatches === 4, 'Report tracks total matches (4)');
  assert(report.coverage.coveredRaw === 3, 'Report tracks coveredRaw matches (3)');
  assert(report.coverage.asOfEligible === 1, 'Report tracks asOfEligible matches (1)');
  assert(report.coverage.excludedLeakage === 2, 'Report tracks excludedLeakage matches (2)');
  assert(report.coverage.coverageRate === 0.75, 'Report calculates accurate coverage rate (0.7500)');
  assert(report.outOfSampleBenchmark.note.includes('Shin 去水具有热门/冷门非线性修正'), 'Report states Shin empirical accuracy awaits accumulated ledger');
  assert(report.governanceConclusion.permittedInCoreModel === false, 'Report confirms market odds NOT permitted in core model');
  assert(report.dataSource.license.includes('ODbL'), 'Report includes explicit data source & license info');
}

// ---------------------------------------------------------------------------
// G5. Quota Protection & Controlled Odds Collection Job
// ---------------------------------------------------------------------------
console.log('\n📋 G5: Controlled Odds Collection Quota Protection');
{
  const tmpDir = path.join('/tmp', 'odds-job-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const job = createOddsCollectorJob({ dataDir: tmpDir });
  assert(job.getQuotaStatus().dailyCalls === 0, 'Collector initializes with 0 daily calls');

  // Check quota enforcement when missing API key
  job.collectOdds().then(res => {
    assert(res.status === 'unavailable', 'Missing API key returns unavailable status gracefully');
  });

  // Check force:true requires registered milestone type
  job.collectOdds({ force: true }).then(res => {
    assert(res.status === 'unavailable' || res.status === 'quota_exhausted', 'force:true without registered milestone handled safely');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
}

// ---------------------------------------------------------------------------
// G6. Public Core Probability Invariant Check (PredictionEngine)
// ---------------------------------------------------------------------------
console.log('\n📋 G6: Public Core Probability Invariant Check');
{
  const engine = new PredictionEngine();
  const matchParams = {
    homeTeam: 'Spain',
    awayTeam: 'Germany',
    tournament: 'World Cup',
    isKnockout: false
  };

  const predWithoutOdds = engine.predict(matchParams);
  const predWithOdds = engine.predict({
    ...matchParams,
    odds: { homeWin: 1.40, draw: 4.50, awayWin: 8.00 }
  });

  assert(predWithOdds.modelContract.activeSignals.join(',') === 'elo,poisson', 'Public activeSignals remains elo,poisson');
  assert(predWithOdds.modelContract.p0PublicFusionExcludes.includes('odds'), 'odds explicitly excluded from public fusion');
  assert(predWithOdds.homeWin === predWithoutOdds.homeWin, `Public homeWin probability identical (${predWithOdds.homeWin} === ${predWithoutOdds.homeWin})`);
  assert(predWithOdds.draw === predWithoutOdds.draw, `Public draw probability identical (${predWithOdds.draw} === ${predWithoutOdds.draw})`);
  assert(predWithOdds.awayWin === predWithoutOdds.awayWin, `Public awayWin probability identical (${predWithOdds.awayWin} === ${predWithoutOdds.awayWin})`);
  assert(predWithOdds.candidates.odds && predWithOdds.candidates.odds.usedInModel === false, 'Odds candidate recorded with usedInModel: false');

  // Verify polymarketOdds injection also does not alter public probabilities
  const predWithPolymarket = engine.predict({
    ...matchParams,
    polymarketOdds: { homeWin: 0.197, draw: 0.211, awayWin: 0.592, liquidity: 'high' }
  });
  assert(predWithPolymarket.homeWin === predWithoutOdds.homeWin, 'PolymarketOdds does not alter public homeWin probability');
  assert(predWithPolymarket.draw === predWithoutOdds.draw, 'PolymarketOdds does not alter public draw probability');
  assert(predWithPolymarket.awayWin === predWithoutOdds.awayWin, 'PolymarketOdds does not alter public awayWin probability');
  assert(predWithPolymarket.candidates.polymarket && predWithPolymarket.candidates.polymarket.usedInModel === false, 'Polymarket candidate recorded with usedInModel: false');
}

setTimeout(() => {
  console.log(`\n==============================================`);
  console.log(`✅ ${passed} passed  ❌ ${failed} failed`);
  console.log(`==============================================`);
  process.exit(failed ? 1 : 0);
}, 200);
