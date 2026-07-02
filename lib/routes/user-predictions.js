/**
 * P2-4: 用户预测
 *
 * 功能：
 * - 用户提交预测（POST /api/user-predictions）
 * - 用户查询自己的预测（GET /api/user-predictions/:matchId）
 * - 全场用户预测聚合（GET /api/user-predictions/:matchId/aggregate）
 * - 用户 vs 模型预测对比（GET /api/user-predictions/:matchId/compare）
 *
 * 核心原则：
 * - 匿名优先，不强制登录（user_id = 'anonymous'，cookie session 跟踪）
 * - 不污染预测模型输入，用户预测仅用于展示层
 */

'use strict';

const COOKIE_UID = 'ps_uid';

function createUserPredictionsRoutes(deps) {
  const { getCached, setCache } = deps;
  const db = require('../db');

  /**
   * 获取或生成匿名用户 ID（从 cookie header 读取，响应时 Set-Cookie）。
   * 解析来自 request.headers['cookie'] 的原始字符串。
   */
  function getUid(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_UID}=([^;]+)`));
    return match ? match[1].trim() : null;
  }

  /**
   * 构造 Set-Cookie header 值。
   */
  function uidCookie(uid) {
    return `${COOKIE_UID}=${uid}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  /**
   * 生成随机匿名 uid（不暴露真实 user_id，仅作匿名标识）。
   */
  function anonUid() {
    return 'anon_' + Math.random().toString(36).slice(2, 10);
  }

  return {

    // ── POST: 提交 / 更新用户预测 ──────────────────────────────────
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

      // 匿名用户 ID：从 cookie 读，响应时写回
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

      // 清除该比赛的聚合缓存
      setCache(`up_agg_${matchId}`, null);
      setCache(`up_compare_${matchId}`, null);

      return {
        ok: true,
        matchId,
        choice,
        confidence: confidence ?? null,
        uid,   // 客户端需保存 uid 并在后续请求中传回
        _setCookie: setCookieHeader,
      };
    },

    // ── GET: 查询用户在该比赛的个人预测 ────────────────────────────
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

    // ── GET: 全场用户预测聚合（各选项人数 / 比例） ─────────────────
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

    // ── GET: 用户预测 vs 模型预测对比 ──────────────────────────────
    'GET /api/user-predictions/:matchId/compare': async (params, ctx) => {
      const matchId = String(params.matchId);
      const cacheKey = `up_compare_${matchId}`;
      const cached = getCached(cacheKey, 60000); // 60 s
      if (cached) return cached;

      const rawCookie = ctx?.headers?.cookie || '';
      const uid = getUid(rawCookie);

      // 并行拉用户聚合 + 模型预测
      const [aggResult, PredictionService] = await Promise.all([
        // 聚合
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

      // 归一化模型概率
      if (modelProbs) {
        const s = modelProbs.home + modelProbs.draw + modelProbs.away;
        if (s > 0) {
          modelProbs.home = Math.round((modelProbs.home / s) * 1000) / 10;
          modelProbs.draw  = Math.round((modelProbs.draw  / s) * 1000) / 10;
          modelProbs.away  = Math.round((modelProbs.away  / s) * 1000) / 10;
        }
      }

      // 用户本人选择
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
        modelProbs,          // 百分比 0-100
        userVotes: aggResult || { total: 0, votes: { home: 0, draw: 0, away: 0 }, pct: { home: 0, draw: 0, away: 0 } },
        userChoice,           // 匿名用户个人选择（若 uid 在 cookie）
        generatedAt: new Date().toISOString(),
      };
      setCache(cacheKey, result);
      return result;
    },
  };
}

module.exports = createUserPredictionsRoutes;
module.exports.COOKIE_UID = COOKIE_UID;
