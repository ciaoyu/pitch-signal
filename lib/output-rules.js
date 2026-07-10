'use strict';

/**
 * Output Rules Layer - "Super Brain" strategy layer for probability fusion, AI scoring, and competitor signals
 *
 * Design principles:
 *   - Do not modify core prediction logic of PredictionEngine (pure addition / decorator pattern)
 *   - Called only at the final step of predictMatch output, attaching outputMeta field
 *   - All external signals (Polymarket / Pundit / Auto-calibration) are currently disabled
 *   - Accuracy claims are based on actual walk-forward metrics, not displaying legacy Brier 0.5516
 */

// ============================================================
// 1. Probability Fusion Rules
// ============================================================

/**
 * Current version: single source output (only PredictionEngine, external sources all disabled)
 * When external sources are enabled in future, define fusion strategy here (weighted average, Bayesian update, etc.)
 *
 * @param {object} primary   PredictionEngine output probabilities { homeWin, draw, awayWin }
 * @param {object|null} external   External signals (Polymarket / Odds API, etc.)
 * @returns {{ homeWin, draw, awayWin, fusionStrategy, externalUsed }}
 */
function fuseProbabilities(primary, external = null) {
  // External signals currently always null (Gate 1 closed)
  if (!external || process.env.POLYMARKET_ENABLED === 'true') {
    return {
      homeWin: primary.homeWin ?? primary.homeWinProb,
      draw:    primary.draw    ?? primary.drawProb,
      awayWin: primary.awayWin ?? primary.awayWinProb,
      fusionStrategy: 'single_source',
      externalUsed: false,
    };
  }

  // Reserved: two-source weighting (requires OOS validation before enabling weights in future)
  const W_PRIMARY  = 0.80;
  const W_EXTERNAL = 0.20;
  const h = primary.homeWin * W_PRIMARY + external.homeWin * W_EXTERNAL;
  const d = primary.draw    * W_PRIMARY + external.draw    * W_EXTERNAL;
  const a = primary.awayWin * W_PRIMARY + external.awayWin * W_EXTERNAL;
  const total = h + d + a;
  return {
    homeWin: Math.round((h / total) * 1000) / 1000,
    draw:    Math.round((d / total) * 1000) / 1000,
    awayWin: Math.round((a / total) * 1000) / 1000,
    fusionStrategy: 'weighted_avg_80_20',
    externalUsed: true,
  };
}

// ============================================================
// 2. AI Scoring Rules (Confidence Scoring)
// ============================================================

/**
 * Generate a 0-100 heuristic confidence score based on internal signal quality.
 *
 * ⚠️ P0 quarantine v3 (Owner A blocker #3): this is a HAND-TUNED heuristic score,
 * NOT a statistically valid confidence interval. It must NOT be surfaced with
 * "95% CI" / coverage semantics. A proper empirical coverage interval is owned
 * by Owner D. Renamed from scoreConfidence -> scoreHeuristicConfidence and the
 * output is marked status:'unvalidated'.
 *
 * @param {object} result   PredictionEngine full output
 * @returns {{ score, band, factors }}
 */
function scoreHeuristicConfidence(result) {
  let score = 50; // Base score
  const factors = [];

  // Signal coverage: number of components
  const comps = result.components || {};
  const componentCount = Object.keys(comps).filter(k => comps[k] != null).length;
  score += Math.min(20, componentCount * 4);
  if (componentCount >= 3) factors.push('multi_signal');

  // Clear Elo difference (diff > 100 points)
  const eloDiff = Math.abs((comps.elo?.homeWin || 0) - (comps.elo?.awayWin || 0));
  if (eloDiff > 0.15) { score += 10; factors.push('elo_clear_edge'); }

  // Odds alignment (if available)
  if (result.components?.odds) { score += 10; factors.push('odds_aligned'); }

  // Polymarket disabled -> missing external validation -> point deduction
  if (process.env.POLYMARKET_ENABLED !== 'true') { score -= 5; factors.push('no_market_signal'); }

  // Probability distribution concentration (max probability > 50% -> more confident)
  const maxProb = Math.max(
    result.homeWin ?? 0,
    result.draw    ?? 0,
    result.awayWin ?? 0
  );
  if (maxProb > 0.55) { score += 5; factors.push('concentrated_prob'); }
  if (maxProb < 0.40) { score -= 5; factors.push('flat_prob'); }

  score = Math.max(10, Math.min(90, Math.round(score)));

  const band =
    score >= 70 ? 'high' :
    score >= 50 ? 'medium' : 'low';

  return { score, band, factors };
}

// ============================================================
// 3. Competitor Signal Processing (Currently disabled placeholder)
// ============================================================

/**
 * Gather external competitor signals (Polymarket / Expert Pundit / Auto-calibration)
 * Define adoption rules here after integrating real data in Phase 3.
 * Currently returns null for all, without affecting primary prediction.
 *
 * Draft rules (future):
 *   - Polymarket for reference display only, not included in fusion (prior to OOS validation)
 *   - Pundit consensus > 70% can be included in external parameter of fuseProbabilities (weight 0.10)
 *   - Auto-calibration adjustment cap at ±5%, requiring 30 OOS match sample support
 */
function gatherExternalSignals(matchId) {
  return {
    polymarket: null,   // Gate 1: POLYMARKET_ENABLED=false
    pundit: null,       // Not integrated
    autoCalibration: null, // Not integrated
    _note: '外部信号当前全部禁用（公测 Beta 阶段）',
  };
}

// ============================================================
// 4. Accuracy Claim Generation
// ============================================================

// During controlled public Beta phase, public prediction responses do not return any model historical backtest or aggregate accuracy metrics (Brier/Accuracy).
// Only keep a single unified static safety disclaimer text.

// ============================================================
// 5. Full Output Rules Application (called in PredictionService)
// ============================================================

/**
 * Apply output rules layer to original PredictionEngine output.
 * Returned object is attached directly to API response (without modifying internal result fields).
 *
 * @param {object} result   Output of PredictionEngine.predictWithAI()
 * @param {string} matchId
 * @returns {object} outputMeta - Attached to response
 */
function applyOutputRules(result, matchId) {
  const externalSignals = gatherExternalSignals(matchId);
  const fusion = fuseProbabilities(result, null); // External signals currently null
  // P0 quarantine v3 (Owner A blocker #3): heuristic confidence is NOT a
  // statistically valid CI — renamed + marked unvalidated so it cannot be
  // mistaken for a formal uncertainty estimate (Owner D owns the real interval).
  const heuristicConfidence = scoreHeuristicConfidence(result);
  const disclaimer = '实验性足球概率模型，非投注建议。';

  return {
    outputMeta: {
      fusion,
      heuristicConfidence: { ...heuristicConfidence, status: 'unvalidated' },
      externalSignals,
      accuracyDisclaimer: disclaimer,
      _gate: {
        polymarket: false,   // Gate 1: Closed
        pundit: false,       // Not integrated
        autoCalibration: false, // Not integrated
        aiProbabilityEdit: false, // AI does not edit probability
      },
    },
  };
}

module.exports = {
  fuseProbabilities,
  scoreHeuristicConfidence,
  gatherExternalSignals,
  applyOutputRules,
};
