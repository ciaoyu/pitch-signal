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

    // ── Single match divergence (check DB first, compute live and store if miss) ──
    'GET /api/odds-divergence/:matchId': async (params) => {
      const matchId = String(params.matchId);

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

      // 2) Live compute: fetch model prediction + odds
      const PredictionService = require('../services/PredictionService');
      const OddsRoute = require('./odds');

      try {
        const ps = new PredictionService(deps);

        // The divergence page exists solely to independently compare model view vs market view.
        // Use separate call to get pure model probability (without includeExternalOdds) — if
        // modelProbs already blends 20% market weight, divergence is systematically compressed
        // and distorts product narrative.
        const predPure = await ps.predictMatch(matchId, { includeExternalOdds: false, bypassCache: true });
        if (predPure?.error) return { matchId, error: 'Prediction unavailable', detail: predPure.error };

        const predWithOdds = await ps.predictMatch(matchId, { includeExternalOdds: true, bypassCache: true });

        // Model probabilities (normalized, pure model output without market signals)
        const rawModel = {
          home: Number(predPure.homeWin || predPure.homeWinProb || 0),
          draw: Number(predPure.draw || predPure.drawProb || 0),
          away: Number(predPure.awayWin || predPure.awayWinProb || 0),
        };
        const modelProbs = normalize(rawModel);

        // Market probabilities: prefer decimal odds from externalOdds
        let marketProbs = null;
        let oddsSource = 'unknown';

        if (predWithOdds?.externalOdds) {
          const eo = predWithOdds.externalOdds;
          const hDec = Number(eo.homeWin);
          const dDec = Number(eo.draw);
          const aDec = Number(eo.awayWin);
          marketProbs = impliedProbabilitiesFromDecimal(hDec, dDec, aDec);
          oddsSource = eo.source || 'external_odds';
        }

        // fallback: fetch live odds directly from odds route
        if (!marketProbs && OddsRoute) {
          try {
            const oddsData = await OddsRoute({ params: { matchId } }, deps);
            if (oddsData?.odds?.[0]) {
              const o = oddsData.odds[0];
              const hDec = Number(o.homeWin || o.price_home);
              const dDec = Number(o.draw || o.price_draw);
              const aDec = Number(o.awayWin || o.price_away);
              marketProbs = impliedProbabilitiesFromDecimal(hDec, dDec, aDec);
              oddsSource = o.source || o.vendor || 'odds_api';
            }
          } catch (_) {}
        }

        if (!marketProbs) {
          return { matchId, divergence: false, note: 'no_market_data', modelProbs };
        }

        // 3) Compute divergence and store in DB
        const div = computeDivergence(modelProbs, marketProbs);

        try {
          db.run(`
            INSERT INTO match_odds_benchmark
              (match_id, model_home_prob, model_draw_prob, model_away_prob,
               market_home_prob, market_draw_prob, market_away_prob,
               delta_home, delta_draw, delta_away, divergence_flag, odds_source,
               model_version, computed_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(match_id) DO UPDATE SET
              model_home_prob=excluded.model_home_prob,
              model_draw_prob=excluded.model_draw_prob,
              model_away_prob=excluded.model_away_prob,
              market_home_prob=excluded.market_home_prob,
              market_draw_prob=excluded.market_draw_prob,
              market_away_prob=excluded.market_away_prob,
              delta_home=excluded.delta_home,
              delta_draw=excluded.delta_draw,
              delta_away=excluded.delta_away,
              divergence_flag=excluded.divergence_flag,
              odds_source=excluded.odds_source,
              computed_at=datetime('now'),
              updated_at=datetime('now')
          `,
            matchId,
            modelProbs.home, modelProbs.draw, modelProbs.away,
            marketProbs.home, marketProbs.draw, marketProbs.away,
            div.deltaHome, div.deltaDraw, div.deltaAway,
            div.divergence ? 1 : 0,
            oddsSource,
            'v4'
          );
        } catch (dbErr) {
          // Silently ignore when table does not exist; do not block prediction flow
        }

        return {
          matchId,
          modelProbs,
          marketProbs,
          delta: { home: div.deltaHome, draw: div.deltaDraw, away: div.deltaAway },
          divergence: div.divergence,
          direction: div.direction,
          maxAbsDelta: div.maxAbsDelta,
          threshold: DIVERGENCE_THRESHOLD,
          source: oddsSource,
          computedAt: new Date().toISOString(),
          cached: false,
        };
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
