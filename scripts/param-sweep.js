#!/usr/bin/env node
'use strict';

/**
 * Parameter Sweep Grid-Search Tool for PitchSignal
 * Sweeps:
 *   - Elo K-factor (world cup): 30, 40, 50, 60, 70, 80
 *   - Dixon-Coles rho: -0.20, -0.15, -0.13, -0.10, -0.05
 *   - Elo weight: 0.20, 0.25, 0.30, 0.35, 0.40
 *   - Poisson weight: 0.15, 0.20, 0.25, 0.30, 0.35
 *
 * Uses Bootstrap CI overlap checking to determine significance.
 */

const BacktestRunner = require('../lib/backtest');

async function main() {
  const runner = new BacktestRunner();
  const { m2018, m2022 } = runner.loadHistory();
  const combinedMatches = [...m2018, ...m2022];

  if (combinedMatches.length === 0) {
    console.error('❌ No historical matches found for sweep.');
    process.exit(1);
  }

  console.log(`⚽ Starting Parameter Sweep across ${combinedMatches.length} historical matches...`);
  console.log('Calculating baseline performance...');
  
  const baseline = await runner._walkForward(combinedMatches);
  console.log(`📊 Baseline Results (Default Params):`);
  console.log(`  Brier:    ${baseline.meanBrier.toFixed(4)} [95% CI: ${baseline.brierCI[0].toFixed(4)}, ${baseline.brierCI[1].toFixed(4)}]`);
  console.log(`  Accuracy: ${(baseline.accuracy * 100).toFixed(2)}% [95% CI: ${(baseline.accuracyCI[0] * 100).toFixed(2)}%, ${(baseline.accuracyCI[1] * 100).toFixed(2)}%]`);
  console.log('----------------------------------------------------\n');

  // Sweep ranges
  const eloKs = [30, 40, 50, 60, 70, 80];
  const rhos = [-0.20, -0.15, -0.13, -0.10, -0.05];
  const weightsElo = [0.20, 0.25, 0.30, 0.35, 0.40];
  const weightsPoisson = [0.15, 0.20, 0.25, 0.30, 0.35];

  const totalRuns = eloKs.length * rhos.length * weightsElo.length * weightsPoisson.length;
  console.log(`Grid search space size: ${totalRuns} configurations.`);
  console.log('Sweeping parameters...\n');

  const results = [];
  let count = 0;
  const start = Date.now();

  for (const k of eloKs) {
    for (const rho of rhos) {
      for (const wElo of weightsElo) {
        for (const wPoisson of weightsPoisson) {
          count++;
          if (count % 50 === 0) {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            console.log(`  Progress: ${count}/${totalRuns} runs completed (${elapsed}s elapsed)...`);
          }

          const params = {
            elo: { kFactorWorldCup: k },
            poisson: { rho: rho },
            weights: { elo: wElo, poisson: wPoisson }
          };

          try {
            const res = await runner._walkForward(combinedMatches, params);
            
            // Check significance (CI overlap)
            const brierOverlap = res.brierCI[0] <= baseline.brierCI[1] && res.brierCI[1] >= baseline.brierCI[0];
            const accuracyOverlap = res.accuracyCI[0] <= baseline.accuracyCI[1] && res.accuracyCI[1] >= baseline.accuracyCI[0];

            const brierSig = !brierOverlap && res.meanBrier < baseline.meanBrier;
            const accuracySig = !accuracyOverlap && res.accuracy > baseline.accuracy;

            results.push({
              params,
              meanBrier: res.meanBrier,
              brierCI: res.brierCI,
              meanAccuracy: res.accuracy,
              accuracyCI: res.accuracyCI,
              brierSig,
              accuracySig,
              score: res.meanBrier // Lower is better
            });
          } catch (e) {
            console.warn(`Error running sweep config K=${k}, rho=${rho}:`, e.message);
          }
        }
      }
    }
  }

  // Sort by Brier score (ascending)
  results.sort((a, b) => a.meanBrier - b.meanBrier);

  console.log('\n====================================================');
  console.log('🏆 Parameter Sweep Complete — Top 10 Configurations');
  console.log('====================================================');
  
  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    const p = r.params;
    const sigStar = r.brierSig ? ' ★ SIGNIFICANT ★' : '';
    
    console.log(`\nRank #${i + 1}:${sigStar}`);
    console.log(`  Params: EloK=${p.elo.kFactorWorldCup}, rho=${p.poisson.rho}, weightElo=${p.weights.elo}, weightPoisson=${p.weights.poisson}`);
    console.log(`  Brier:    ${r.meanBrier.toFixed(4)} [95% CI: ${r.brierCI[0].toFixed(4)}, ${r.brierCI[1].toFixed(4)}] (vs Baseline: ${baseline.meanBrier.toFixed(4)})`);
    console.log(`  Accuracy: ${(r.meanAccuracy * 100).toFixed(2)}% [95% CI: ${(r.accuracyCI[0] * 100).toFixed(2)}%, ${(r.accuracyCI[1] * 100).toFixed(2)}%] (vs Baseline: ${(baseline.accuracy * 100).toFixed(2)}%)`);
  }

  console.log('\n====================================================');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Sweep finished in ${elapsed}s.`);
}

main().catch(err => {
  console.error('Fatal error during parameter sweep:', err);
  process.exit(1);
});
