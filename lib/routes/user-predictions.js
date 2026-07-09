/**
 * P2-4: User Predictions
 *
 * Features:
 * - User submits prediction (POST /api/user-predictions)
 * - User queries own prediction (GET /api/user-predictions/:matchId)
 * - Aggregated user predictions for match (GET /api/user-predictions/:matchId/aggregate)
 * - User vs Model prediction comparison (GET /api/user-predictions/:matchId/compare)
 *
 * Core principles:
 * - Anonymous-first, no mandatory login (user_id = 'anonymous', cookie session tracking)
 * - Does not pollute prediction model input; user predictions are presentation-layer only
 */

'use strict';

const COOKIE_UID = 'ps_uid';

function createUserPredictionsRoutes(deps) {
  const { getCached, setCache } = deps;
  const db = require('../db');

  /**
   * Get or generate anonymous user ID (read from cookie header, set Set-Cookie on response).
   * Parse raw string from request.headers['cookie'].
   */
  function getUid(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_UID}=([^;]+)`));
    return match ? match[1].trim() : null;
  }

  /**
   * Construct Set-Cookie header value.
   */
  function uidCookie(uid) {
    return `${COOKIE_UID}=${uid}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  /**
   * Generate random anonymous uid (does not expose real user_id, anonymous identifier only).
   */
  function anonUid() {
    return 'anon_' + Math.random().toString(36).slice(2, 10);
  }

  return {

    // ── POST: Submit / Update user prediction ─────────────────────
    'POST /api/user-predictions': async (params, ctx) => {
      const body = ctx?.body || {};
      const { matchId, choice, confidence, notes } = body;

      if (!matchId || !choice) {
        return { error: 'matchId and choice are required', code: 400 };
      }
      if (!['home', 'draw', 'away'].includes(choice)) {
        return { error: 'choice must be home, draw, or away', code: 400 };
      }
      if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
        return { error: 'confidence must be a number between 0 and 1', code: 400 };
      }

      // Anonymous user ID: read from cookie, set back on response
      const rawCookie = ctx?.headers?.cookie || '';
      let uid = getUid(rawCookie) || anonUid();

      const setCookieHeader = uidCookie(uid);

      try {
        db.run(`
          INSERT INTO user_predictions (match_id, user_id, choice, confidence, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(match_id, user_id) DO UPDATE SET
            choice    = excluded.choice,
            confidence = excluded.confidence,
            notes     = excluded.notes,
            created_at = datetime('now')
        `, matchId, uid, choice, confidence ?? null, notes ?? null);
      } catch (e) {
        return { error: 'Failed to save prediction', detail: e.message, code: 500 };
      }

      // Clear aggregate cache for this match
      setCache(`up_agg_${matchId}`, null);
      setCache(`up_compare_${matchId}`, null);

      return {
        ok: true,
        matchId,
        choice,
        confidence: confidence ?? null,
        uid,   // Client should store uid and pass back on subsequent requests
        _setCookie: setCookieHeader,
      };
    },

    // ── GET: Query user's personal prediction for this match ──────
    'GET /api/user-predictions/:matchId': async (params, ctx) => {
      const matchId = String(params.matchId);
      const rawCookie = ctx?.headers?.cookie || '';
      const uid = getUid(rawCookie);

      if (!uid) {
        return { matchId, hasPrediction: false, note: 'no_cookie' };
      }

      let row;
      try {
        row = db.get(`
          SELECT match_id, choice, confidence, notes, created_at
          FROM user_predictions
          WHERE match_id = ? AND user_id = ?
        `, matchId, uid);
      } catch (e) {
        return { matchId, error: 'DB read failed', detail: e.message };
      }

      if (!row) return { matchId, hasPrediction: false, uid };
      return {
        matchId: row.match_id,
        hasPrediction: true,
        choice: row.choice,
        confidence: row.confidence,
        notes: row.notes,
        createdAt: row.created_at,
        uid,
      };
    },

    // ── GET: Aggregated user predictions (votes / percentage per choice) ──
    'GET /api/user-predictions/:matchId/aggregate': async (params) => {
      const matchId = String(params.matchId);
      const cacheKey = `up_agg_${matchId}`;
      const cached = getCached(cacheKey, 30000); // 30 s
      if (cached) return cached;

      let rows;
      try {
        rows = db.all(`
          SELECT choice, COUNT(*) as cnt
          FROM user_predictions
          WHERE match_id = ?
          GROUP BY choice
        `, matchId);
      } catch (e) {
        rows = [];
      }

      const total = rows.reduce((s, r) => s + r.cnt, 0);
      const votes = { home: 0, draw: 0, away: 0 };
      for (const r of rows) votes[r.choice] = r.cnt;

      const result = {
        matchId,
        totalVotes: total,
        votes,
        percentages: total > 0 ? {
          home: Math.round((votes.home / total) * 1000) / 10,
          draw:  Math.round((votes.draw  / total) * 1000) / 10,
          away:  Math.round((votes.away  / total) * 1000) / 10,
        } : { home: 0, draw: 0, away: 0 },
        generatedAt: new Date().toISOString(),
      };
      setCache(cacheKey, result);
      return result;
    },

    // ── GET: Compare user predictions vs model predictions ────────
    'GET /api/user-predictions/:matchId/compare': async (params, ctx) => {
      const matchId = String(params.matchId);
      const cacheKey = `up_compare_${matchId}`;
      const cached = getCached(cacheKey, 60000); // 60 s
      if (cached) return cached;

      const rawCookie = ctx?.headers?.cookie || '';
      const uid = getUid(rawCookie);

      // Fetch user aggregate + model prediction in parallel
      const [aggResult, PredictionService] = await Promise.all([
        // Aggregate
        (async () => {
          try {
            const rows = db.all(`
              SELECT choice, COUNT(*) as cnt FROM user_predictions WHERE match_id = ? GROUP BY choice
            `, matchId);
            const total = rows.reduce((s, r) => s + r.cnt, 0);
            const votes = { home: 0, draw: 0, away: 0 };
            for (const r of rows) votes[r.choice] = r.cnt;
            return { total, votes, pct: total > 0 ? {
              home: Math.round((votes.home / total) * 1000) / 10,
              draw:  Math.round((votes.draw  / total) * 1000) / 10,
              away:  Math.round((votes.away  / total) * 1000) / 10,
            } : { home: 0, draw: 0, away: 0 } };
          } catch (_) { return null; }
        })(),
        import('../services/PredictionService').then(m => m.default || m),
      ]);

      let modelProbs = null;
      try {
        const ps = new PredictionService(deps);
        const pred = await ps.predictMatch(matchId, { bypassCache: true });
        if (pred && !pred.error) {
          modelProbs = {
            home: Number(pred.homeWin || pred.homeWinProb || 0),
            draw: Number(pred.draw || pred.drawProb || 0),
            away: Number(pred.awayWin || pred.awayWinProb || 0),
          };
        }
      } catch (_) {}

      // Normalize model probabilities
      if (modelProbs) {
        const s = modelProbs.home + modelProbs.draw + modelProbs.away;
        if (s > 0) {
          modelProbs.home = Math.round((modelProbs.home / s) * 1000) / 10;
          modelProbs.draw  = Math.round((modelProbs.draw  / s) * 1000) / 10;
          modelProbs.away  = Math.round((modelProbs.away  / s) * 1000) / 10;
        }
      }

      // User's own choice
      let userChoice = null;
      if (uid) {
        try {
          const row = db.get(`
            SELECT choice FROM user_predictions WHERE match_id = ? AND user_id = ?
          `, matchId, uid);
          userChoice = row?.choice || null;
        } catch (_) {}
      }

      const result = {
        matchId,
        modelProbs,          // Percentage 0-100
        userVotes: aggResult || { total: 0, votes: { home: 0, draw: 0, away: 0 }, pct: { home: 0, draw: 0, away: 0 } },
        userChoice,           // Anonymous user's choice (if uid in cookie)
        generatedAt: new Date().toISOString(),
      };
      setCache(cacheKey, result);
      return result;
    },
  };
}

module.exports = createUserPredictionsRoutes;
module.exports.COOKIE_UID = COOKIE_UID;
