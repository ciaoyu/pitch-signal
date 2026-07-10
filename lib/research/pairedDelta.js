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

    // Sort for percentile CI
    const sortedBrierDeltas = [...brierDeltas].sort((a, b) => a - b);
    const sortedAccuracyDeltas = [...accuracyDeltas].sort((a, b) => a - b);
    const sortedLogLossDeltas = [...logLossDeltas].sort((a, b) => a - b);

    const lowIdx = Math.floor(nResamples * (alpha / 2));
    const highIdx = Math.floor(nResamples * (1 - alpha / 2));

    // Null-centered bootstrap two-sided p-value for H0: deltaMean = 0
    // Recenter bootstrap distribution around 0 by subtracting observed mean difference
    const nullExtremeBrierCount = brierDeltas.filter(d => Math.abs(d - meanBrierDelta) >= Math.abs(meanBrierDelta)).length;
    const pValueTwoSidedNullCentered = nullExtremeBrierCount / nResamples;

    // One-sided empirical p-value: fraction of bootstrap resamples where deltaBrier >= 0 (no improvement)
    const nonImprovingCount = brierDeltas.filter(d => d >= 0).length;
    const pValueOneSided = nonImprovingCount / nResamples;

    const brierCI = [
      Number(sortedBrierDeltas[lowIdx].toFixed(6)),
      Number(sortedBrierDeltas[highIdx].toFixed(6))
    ];
    const isBrierSignificantTwoSided = brierCI[1] < 0 || brierCI[0] > 0;

    const formatPValueDisplay = (p) => (p === 0 ? '<0.001 (0/1000)' : p.toFixed(3));

    return {
      clusterCount: nClusters,
      sampleSize: totalMatches,
      brier: {
        deltaMean: Number(meanBrierDelta.toFixed(6)),
        ci95TwoSided: brierCI,
        pValueTwoSided: Number(pValueTwoSidedNullCentered.toFixed(4)),
        pValueDisplay: formatPValueDisplay(pValueTwoSidedNullCentered),
        pValueOneSided: Number(pValueOneSided.toFixed(4)),
        significantTwoSidedAtAlpha05: isBrierSignificantTwoSided
      },
      accuracy: {
        deltaMean: Number(meanAccuracyDelta.toFixed(6)),
        ci95TwoSided: [
          Number(sortedAccuracyDeltas[lowIdx].toFixed(6)),
          Number(sortedAccuracyDeltas[highIdx].toFixed(6))
        ]
      },
      logLoss: {
        deltaMean: Number(meanLogLossDelta.toFixed(6)),
        ci95TwoSided: [
          Number(sortedLogLossDeltas[lowIdx].toFixed(6)),
          Number(sortedLogLossDeltas[highIdx].toFixed(6))
        ]
      },
      methodologyNote: 'Paired significance evaluated via clustered bootstrap on match-level paired differences clustered by tournament edition (§2.2), reporting aligned two-sided 95% percentile confidence intervals and null-centered bootstrap p-values (H0: delta = 0), avoiding the overlapping CI fallacy.'
    };
  }
}

module.exports = PairedDeltaEvaluator;
