'use strict';

/**
 * Paired Delta Evaluation with Clustered Bootstrap Resampling
 *
 * Implements tournament-level clustered bootstrap (§2.2) to evaluate paired differences
 * between models/baselines without relying on the overlapping CI fallacy.
 */

class PairedDeltaEvaluator {
  /**
   * Compute clustered paired delta statistics between Model A and Model B.
   *
   * @param {Array<Object>} records - Array of evaluated match items with clusterKey (e.g. tournamentYear)
   *                                  and metrics { brierA, brierB, accuracyA, accuracyB, logLossA, logLossB }
   * @param {Object} options - { nResamples: 1000, alpha: 0.05, seed: 42 }
   */
  static computeClusteredPairedDelta(records, options = {}) {
    const nResamples = options.nResamples || 1000;
    const alpha = options.alpha || 0.05;

    // Group records by cluster (tournament edition)
    const clusters = {};
    for (const rec of records) {
      const key = rec.clusterKey || rec.tournamentYear || 'all';
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(rec);
    }
    const clusterKeys = Object.keys(clusters);
    const nClusters = clusterKeys.length;

    // Original full-sample mean deltas
    const totalMatches = records.length;
    let sumBrierDelta = 0;
    let sumAccuracyDelta = 0;
    let sumLogLossDelta = 0;

    for (const r of records) {
      sumBrierDelta += (r.brierA - r.brierB);
      sumAccuracyDelta += (r.accuracyA - r.accuracyB);
      sumLogLossDelta += (r.logLossA - r.logLossB);
    }

    const meanBrierDelta = totalMatches > 0 ? sumBrierDelta / totalMatches : 0;
    const meanAccuracyDelta = totalMatches > 0 ? sumAccuracyDelta / totalMatches : 0;
    const meanLogLossDelta = totalMatches > 0 ? sumLogLossDelta / totalMatches : 0;

    // Simple deterministic PRNG for reproducible bootstrap when seed is provided
    let seed = options.seed !== undefined ? options.seed : 42;
    const nextRandom = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const brierDeltas = [];
    const accuracyDeltas = [];
    const logLossDeltas = [];

    for (let i = 0; i < nResamples; i++) {
      let bSum = 0;
      let aSum = 0;
      let lSum = 0;
      let count = 0;

      for (let c = 0; c < nClusters; c++) {
        const randIdx = Math.floor(nextRandom() * nClusters);
        const clusterRecords = clusters[clusterKeys[randIdx]];
        for (const r of clusterRecords) {
          bSum += (r.brierA - r.brierB);
          aSum += (r.accuracyA - r.accuracyB);
          lSum += (r.logLossA - r.logLossB);
          count++;
        }
      }

      brierDeltas.push(count > 0 ? bSum / count : 0);
      accuracyDeltas.push(count > 0 ? aSum / count : 0);
      logLossDeltas.push(count > 0 ? lSum / count : 0);
    }

    brierDeltas.sort((a, b) => a - b);
    accuracyDeltas.sort((a, b) => a - b);
    logLossDeltas.sort((a, b) => a - b);

    const lowIdx = Math.floor(nResamples * (alpha / 2));
    const highIdx = Math.floor(nResamples * (1 - alpha / 2));

    // P-value estimate for Brier improvement (fraction of bootstrap samples where deltaBrier >= 0)
    const nonImprovingCount = brierDeltas.filter(d => d >= 0).length;
    const pValueBrier = nonImprovingCount / nResamples;

    const brierCI = [
      Number(brierDeltas[lowIdx].toFixed(6)),
      Number(brierDeltas[highIdx].toFixed(6))
    ];
    const isBrierSignificant = brierCI[1] < 0 || brierCI[0] > 0;

    return {
      clusterCount: nClusters,
      sampleSize: totalMatches,
      brier: {
        deltaMean: Number(meanBrierDelta.toFixed(6)),
        ci95: brierCI,
        pValue: Number(pValueBrier.toFixed(4)),
        significant: isBrierSignificant
      },
      accuracy: {
        deltaMean: Number(meanAccuracyDelta.toFixed(6)),
        ci95: [
          Number(accuracyDeltas[lowIdx].toFixed(6)),
          Number(accuracyDeltas[highIdx].toFixed(6))
        ]
      },
      logLoss: {
        deltaMean: Number(meanLogLossDelta.toFixed(6)),
        ci95: [
          Number(logLossDeltas[lowIdx].toFixed(6)),
          Number(logLossDeltas[highIdx].toFixed(6))
        ]
      },
      methodologyNote: 'Paired significance evaluated via clustered bootstrap on match-level paired differences clustered by tournament edition (§2.2), avoiding the overlapping CI fallacy.'
    };
  }
}

module.exports = PairedDeltaEvaluator;
