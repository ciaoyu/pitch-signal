/**
 * P2-3: Model vs Market Odds Divergence
 *
 * Purpose: Benchmark only, do not feed odds into the model.
 * Divergence threshold: |model_prob − market_prob| > 0.08 flagged as divergence.
 *
 * Exports:
 *   computeDivergence(modelProbs, marketProbs)
 *   impliedProbabilitiesFromDecimal(homeDec, drawDec, awayDec)
 *   DIVERGENCE_THRESHOLD = 0.08
 */

'use strict';

const DIVERGENCE_THRESHOLD = 0.08;

/**
 * Derive devigged implied probabilities from decimal odds.
 * @returns {{ home: number, draw: number, away: number } | null}
 */
function impliedProbabilitiesFromDecimal(homeDec, drawDec, awayDec) {
  if (!homeDec || !drawDec || !awayDec) return null;
  const invHome = 1 / homeDec;
  const invDraw = 1 / drawDec;
  const invAway = 1 / awayDec;
  const total = invHome + invDraw + invAway;
  if (!total || !Number.isFinite(total)) return null;
  return {
    home: Math.round((invHome / total) * 10000) / 10000,
    draw: Math.round((invDraw / total) * 10000) / 10000,
    away: Math.round((invAway / total) * 10000) / 10000,
  };
}

/**
 * Compute divergence between model probabilities and market implied probabilities.
 * @returns {{ deltaHome, deltaDraw, deltaAway, maxAbsDelta, divergence, direction } | null}
 */
function computeDivergence(modelProbs, marketProbs) {
  if (!modelProbs || !marketProbs) return null;

  const deltaHome = Math.round((modelProbs.home - marketProbs.home) * 10000) / 10000;
  const deltaDraw = Math.round((modelProbs.draw - marketProbs.draw) * 10000) / 10000;
  const deltaAway = Math.round((modelProbs.away - marketProbs.away) * 10000) / 10000;
  const maxAbsDelta = Math.max(Math.abs(deltaHome), Math.abs(deltaDraw), Math.abs(deltaAway));
  const divergence = maxAbsDelta > DIVERGENCE_THRESHOLD;

  let direction = 'none';
  if (divergence) {
    // Direction: determine which side has the largest difference
    if (Math.abs(deltaHome) >= Math.abs(deltaAway)) {
      direction = deltaHome > 0 ? 'model_home_lean' : 'market_home_lean';
    } else {
      direction = deltaAway > 0 ? 'model_away_lean' : 'market_away_lean';
    }
  }

  return { deltaHome, deltaDraw, deltaAway, maxAbsDelta, divergence, direction };
}

/**
 * Create odds-divergence routes.
 */
function createOddsDivergenceRoutes(deps) {
  const { getCached, setCache } = deps;
  const db = require('../db');

  /**
   * Normalize probabilities (ensure sum equal to 1).
   */
  function normalize(probs) {
    const sum = (probs.home || 0) + (probs.draw || 0) + (probs.away || 0);
    if (sum <= 0) return probs;
    return {
      home: Math.round((probs.home / sum) * 10000) / 10000,
      draw: Math.round((probs.draw / sum) * 10000) / 10000,
      away: Math.round((probs.away / sum) * 10000) / 10000,
    };
  }

  return {

    // ── Summary of all divergence entries (for frontend alert list) ──
    'GET /api/odds-divergence': async () => {
      const cacheKey = 'odds_divergence_summary';
      const cached = getCached(cacheKey, 120000);
      if (cached) return cached;

      let items = [];
      try {
        items = db.all(`
          SELECT match_id, model_home_prob, model_draw_prob, model_away_prob,
                 market_home_prob, market_draw_prob, market_away_prob,
                 delta_home, delta_draw, delta_away, divergence_flag,
                 odds_source, computed_at
          FROM match_odds_benchmark
          ORDER BY divergence_flag DESC,
                   ABS(delta_home) + ABS(delta_away) DESC
          LIMIT 30
        `);
      } catch (e) {
        // Table might not exist yet
      }

      const result = {
        totalSnapshots: items.length,
        flagged: items.filter(r => r.divergence_flag).length,
        items: items.map(r => ({
          matchId: r.match_id,
          modelProbs: { home: r.model_home_prob, draw: r.model_draw_prob, away: r.model_away_prob },
          marketProbs: { home: r.market_home_prob, draw: r.market_draw_prob, away: r.market_away_prob },
          delta: { home: r.delta_home, draw: r.delta_draw, away: r.delta_away },
          divergence: Boolean(r.divergence_flag),
          source: r.odds_source,
          computedAt: r.computed_at,
        })),
        generatedAt: new Date().toISOString(),
      };
      setCache(cacheKey, result);
      return result;
    },

    // ── Single match divergence (DB-only for market data; never fetches odds live) ──
    'GET /api/odds-divergence/:matchId': async (params) => {
      const matchId = String(params.matchId);
      const cacheKey = `div_match_${matchId}`;
      const cached = getCached(cacheKey, 300000);
      if (cached) return cached;

      // 1) Query DB
      try {
        const row = db.get(`
          SELECT match_id, model_home_prob, model_draw_prob, model_away_prob,
                 market_home_prob, market_draw_prob, market_away_prob,
                 delta_home, delta_draw, delta_away, divergence_flag,
                 odds_source, computed_at
          FROM match_odds_benchmark
          WHERE match_id = ?
        `, matchId);

        if (row) {
          return {
            matchId: row.match_id,
            modelProbs: { home: row.model_home_prob, draw: row.model_draw_prob, away: row.model_away_prob },
            marketProbs: { home: row.market_home_prob, draw: row.market_draw_prob, away: row.market_away_prob },
            delta: { home: row.delta_home, draw: row.delta_draw, away: row.delta_away },
            divergence: Boolean(row.divergence_flag),
            source: row.odds_source,
            computedAt: row.computed_at,
            cached: true,
          };
        }
      } catch (e) {
        // Table does not exist or query failed, continue live compute
      }

      // 2) No benchmark row yet — do NOT fetch market odds live from this
      // route. This used to chain up to two real the-odds-api requests on
      // every uncached page view (this endpoint is public, unauthenticated,
      // and called for every upcoming match on the homepage), which is what
      // drained the account's quota. Market odds are now captured exactly
      // once per (match, milestone) by lib/services/odds-milestone.js on a
      // schedule tied to real kickoff times, and written into
      // match_odds_benchmark from there — by the time a match nears kickoff,
      // this DB row should already exist. Here we still compute the model's
      // own (free, no-odds) view so the panel has something real to show
      // while market data is pending, instead of a blank/broken state.
      const PredictionService = require('../services/PredictionService');
      try {
        const ps = new PredictionService(deps);
        const predPure = await ps.predictMatch(matchId, { includeExternalOdds: false });
        if (predPure?.error) return { matchId, error: 'Prediction unavailable', detail: predPure.error };

        const modelProbs = normalize({
          home: Number(predPure.homeWin || predPure.homeWinProb || 0),
          draw: Number(predPure.draw || predPure.drawProb || 0),
          away: Number(predPure.awayWin || predPure.awayWinProb || 0),
        });

        const result = { matchId, divergence: false, note: 'market_data_pending', modelProbs };
        setCache(cacheKey, result);
        return result;
      } catch (computeErr) {
        return { matchId, error: 'Divergence compute failed', detail: computeErr.message };
      }
    },
  };
}

module.exports = createOddsDivergenceRoutes;
module.exports.computeDivergence = computeDivergence;
module.exports.impliedProbabilitiesFromDecimal = impliedProbabilitiesFromDecimal;
module.exports.DIVERGENCE_THRESHOLD = DIVERGENCE_THRESHOLD;
