'use strict';

/**
 * Owner G: Market Shadow Ledger Service
 *
 * Responsibilities:
 * 1. Controlled Odds Archival & Quota Protection: Permanent storage of raw odds, bookmaker metadata,
 *    and timestamps without arbitrary truncation.
 * 2. Dual Devigging: Computes both Proportional devigging and Shin's method devigging for every snapshot.
 * 3. As-Of Anti-Leakage Audit: Verifies that every market snapshot timestamp is strictly before kickoff time.
 * 4. OOS Shadow Benchmarking: Compares pre-match quarantined model probabilities against market consensus
 *    while strictly enforcing usedInModel: false.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PredictionEngine = require('../prediction');

const engine = new PredictionEngine();

class MarketShadowLedger {
  /**
   * Compute proportional devigging from decimal odds { homeWin, draw, awayWin }
   */
  static devigProportional(odds) {
    if (!odds || !odds.homeWin || !odds.draw || !odds.awayWin) return null;
    const h = Number(odds.homeWin);
    const d = Number(odds.draw);
    const a = Number(odds.awayWin);
    if (h <= 1 || d <= 1 || a <= 1) return null;

    const impH = 1 / h;
    const impD = 1 / d;
    const impA = 1 / a;
    const overround = impH + impD + impA;

    return {
      homeWin: Number((impH / overround).toFixed(4)),
      draw: Number((impD / overround).toFixed(4)),
      awayWin: Number((impA / overround).toFixed(4)),
      overround: Number(overround.toFixed(4))
    };
  }

  /**
   * Compute Shin's method devigging from decimal odds { homeWin, draw, awayWin }
   */
  static devigShin(odds) {
    if (!odds || !odds.homeWin || !odds.draw || !odds.awayWin) return null;
    const h = Number(odds.homeWin);
    const d = Number(odds.draw);
    const a = Number(odds.awayWin);
    if (h <= 1 || d <= 1 || a <= 1) return null;

    const rawImps = [1 / h, 1 / d, 1 / a];
    const probs = engine.shinDevig(rawImps);

    return {
      homeWin: Number(probs[0].toFixed(4)),
      draw: Number(probs[1].toFixed(4)),
      awayWin: Number(probs[2].toFixed(4))
    };
  }

  /**
   * Verify As-Of anti-leakage guarantee: snapshot timestamp must be strictly before kickoff time.
   */
  static verifyAsOfAntiLeakage(snapshotTs, kickoffTime) {
    if (!snapshotTs || !kickoffTime) return false;
    const snapMs = new Date(snapshotTs).getTime();
    const kickMs = new Date(kickoffTime).getTime();
    if (isNaN(snapMs) || isNaN(kickMs)) return false;
    return snapMs < kickMs;
  }

  /**
   * Record a permanent odds snapshot to disk without truncating historical snapshots.
   */
  static recordSnapshot({ matchKey, kickoffTime, bookmaker, odds, rawResponse, dataDir, milestone }) {
    if (!matchKey || !odds) {
      throw new Error('matchKey and odds are required to record snapshot');
    }

    const ts = new Date().toISOString();
    const asOfValid = Boolean(kickoffTime && MarketShadowLedger.verifyAsOfAntiLeakage(ts, kickoffTime));

    const proportional = MarketShadowLedger.devigProportional(odds);
    const shin = MarketShadowLedger.devigShin(odds);

    const rawResponseSha256 = rawResponse
      ? crypto.createHash('sha256').update(JSON.stringify(rawResponse)).digest('hex')
      : null;

    const snapshot = {
      snapshotId: `${matchKey}_${ts}`,
      ts,
      kickoffTime: kickoffTime || null,
      milestone: milestone || null,
      asOfAntiLeakageVerified: asOfValid,
      bookmaker: bookmaker || 'consensus',
      rawOdds: {
        homeWin: Number(odds.homeWin),
        draw: Number(odds.draw),
        awayWin: Number(odds.awayWin)
      },
      devig: {
        proportional,
        shin
      },
      rawResponseSha256,
      rawResponse: rawResponse || null
    };

    if (dataDir) {
      const sanitizedKey = String(matchKey).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const histFile = path.join(dataDir, `odds_${sanitizedKey}.json`);
      let history = { matchKey, created: ts, snapshots: [] };
      if (fs.existsSync(histFile)) {
        try {
          history = JSON.parse(fs.readFileSync(histFile, 'utf8'));
        } catch {
          // Fallback if corrupted
        }
      }
      if (!Array.isArray(history.snapshots)) history.snapshots = [];

      history.snapshots.push(snapshot);
      // Owner G rule: Permanent archival — never truncate historical snapshots with slice(-200)
      fs.writeFileSync(histFile, JSON.stringify(history, null, 2), 'utf8');
    }

    return snapshot;
  }

  /**
   * Compare model prediction against market consensus snapshot.
   * Enforces usedInModel: false and returns OOS Brier / LogLoss metrics.
   */
  static compareModelVsMarket({ matchId, kickoffTime, modelPred, marketOdds, actualOutcome }) {
    if (!marketOdds || !marketOdds.homeWin || !marketOdds.draw || !marketOdds.awayWin) {
      return {
        matchId,
        status: 'unavailable',
        usedInModel: false,
        note: 'Odds snapshot unavailable or incomplete for match'
      };
    }

    const propDevig = MarketShadowLedger.devigProportional(marketOdds);
    const shinDevig = MarketShadowLedger.devigShin(marketOdds);

    if (!propDevig || !shinDevig) {
      return {
        matchId,
        status: 'unavailable',
        usedInModel: false,
        note: 'Failed to compute devigged probabilities from odds'
      };
    }

    // Fail-closed As-Of Anti-Leakage Check:
    // If either kickoffTime or marketOdds.ts is missing/invalid, or snapshot is post-kickoff -> false
    const asOfValid = Boolean(
      kickoffTime &&
      marketOdds.ts &&
      MarketShadowLedger.verifyAsOfAntiLeakage(marketOdds.ts, kickoffTime)
    );

    let metrics = null;
    // Post-kickoff / leaked odds MUST NOT enter OOS metrics
    if (asOfValid && actualOutcome && ['home', 'draw', 'away'].includes(actualOutcome)) {
      const yH = actualOutcome === 'home' ? 1 : 0;
      const yD = actualOutcome === 'draw' ? 1 : 0;
      const yA = actualOutcome === 'away' ? 1 : 0;

      const calcBrier = (p) => Number((
        Math.pow(p.homeWin - yH, 2) + Math.pow(p.draw - yD, 2) + Math.pow(p.awayWin - yA, 2)
      ).toFixed(6));

      const eps = 1e-15;
      const calcLogLoss = (p) => {
        const pH = Math.max(eps, Math.min(1 - eps, p.homeWin));
        const pD = Math.max(eps, Math.min(1 - eps, p.draw));
        const pA = Math.max(eps, Math.min(1 - eps, p.awayWin));
        return Number((-(yH * Math.log(pH) + yD * Math.log(pD) + yA * Math.log(pA))).toFixed(6));
      };

      const modelBrier = calcBrier(modelPred);
      const shinBrier = calcBrier(shinDevig);
      const propBrier = calcBrier(propDevig);

      metrics = {
        model: { brier: modelBrier, logLoss: calcLogLoss(modelPred) },
        marketShin: { brier: shinBrier, logLoss: calcLogLoss(shinDevig) },
        marketProportional: { brier: propBrier, logLoss: calcLogLoss(propDevig) },
        deltaBrierShin: Number((modelBrier - shinBrier).toFixed(6)),
        deltaBrierProportional: Number((modelBrier - propBrier).toFixed(6))
      };
    }

    return {
      matchId,
      status: 'shadow_benchmark',
      usedInModel: false,
      asOfAntiLeakageVerified: asOfValid,
      devig: {
        proportional: propDevig,
        shin: shinDevig
      },
      metrics,
      governanceConclusion: 'SHADOW_ONLY: Market odds are archived and benchmarked as shadow candidates (usedInModel: false). They are strictly prohibited from modifying core prediction probabilities until learned fusion and OOS validation pass in Wave 3.'
    };
  }

  /**
   * Generate a comprehensive Shadow Benchmark Report across a set of matches.
   */
  static generateShadowBenchmarkReport(records = []) {
    const totalMatches = records.length;
    let coveredRaw = 0;
    let asOfEligible = 0;
    let excludedLeakage = 0;
    let missingMatches = 0;

    let sumModelBrier = 0;
    let sumShinBrier = 0;
    let sumPropBrier = 0;
    let evaluatedCount = 0;

    for (const r of records) {
      if (r.status === 'shadow_benchmark' && r.devig) {
        coveredRaw++;
        if (r.asOfAntiLeakageVerified) {
          asOfEligible++;
          if (r.metrics) {
            sumModelBrier += r.metrics.model.brier;
            sumShinBrier += r.metrics.marketShin.brier;
            sumPropBrier += r.metrics.marketProportional.brier;
            evaluatedCount++;
          }
        } else {
          excludedLeakage++;
        }
      } else {
        missingMatches++;
      }
    }

    return {
      dataSource: {
        provider: 'The Odds API / Polymarket consensus snapshots',
        license: 'Open Database License (ODbL) / Commercial API terms'
      },
      coverage: {
        totalMatches,
        coveredRaw,
        coveredMatches: coveredRaw, // alias for backwards compatibility
        asOfEligible,
        excludedLeakage,
        missingMatches,
        coverageRate: totalMatches > 0 ? Number((coveredRaw / totalMatches).toFixed(4)) : 0
      },
      antiLeakageAudit: {
        asOfVerifiedMatches: asOfEligible,
        asOfFailedMatches: excludedLeakage,
        leakageFreeRate: coveredRaw > 0 ? Number((asOfEligible / coveredRaw).toFixed(4)) : 1.0
      },
      outOfSampleBenchmark: evaluatedCount > 0 ? {
        sampleSize: evaluatedCount,
        meanModelBrier: Number((sumModelBrier / evaluatedCount).toFixed(4)),
        meanMarketShinBrier: Number((sumShinBrier / evaluatedCount).toFixed(4)),
        meanMarketProportionalBrier: Number((sumPropBrier / evaluatedCount).toFixed(4)),
        deltaBrierShin: Number(((sumModelBrier - sumShinBrier) / evaluatedCount).toFixed(4)),
        note: 'Shin 去水具有热门/冷门非线性修正；真实精度优劣待 shadow ledger 累积后比较。'
      } : null,
      governanceConclusion: {
        permittedInCoreModel: false,
        usedInModelFlag: false,
        ruling: 'SHADOW_ONLY: Market odds provide independent external calibration benchmarks and shadow records. All core public match probabilities remain strictly governed by pre-match quarantined Elo+Poisson weights.'
      }
    };
  }
}

module.exports = MarketShadowLedger;
