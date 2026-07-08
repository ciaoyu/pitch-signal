const { createLogger } = require('../logger');
const logger = createLogger('ReviewService');
const { db } = require('../db');
const {
  getPredictionSnapshot,
  buildPostMatchReview,
  savePostMatchReview,
  getSavedPostMatchReview,
  shouldUseSavedPostMatchReview,
} = require('../postMatchReview');
const { filterMatchEvents } = require('../eventFilter');

/**
 * 从 match_moments 表取出本场比赛带实时概率快照的节点，映射成
 * lib/postMatchReview.js 中 summarizeSnapshotNode() 认识的 node 形状，
 * 供赛后复盘 AI 引用真实的补水/中场分钟数与概率漂移。
 *
 * 去重：substitution_key 偶发重复记录，按 `${minute}-${type}-${teamId}` 去重，
 * 既折叠真正的重复行，也保留同一分钟两支不同球队的合法换人。
 *
 * 概率数据可能为 null（赛前快照缺失时 moment-sync 无法注入 reprice 结果），
 * 此时仍然返回节点，只是省略 odds/drift 部分——AI 至少能引用具体分钟数和比分状态。
 *
 * @param {string|number} matchId
 * @param {string} homeName
 * @param {string} awayName
 * @returns {Array<object>} 节点数组（空数组表示无实时数据，安全降级）
 */
function getMatchMomentsTimeline(matchId, homeName, awayName) {
  try {
    const rows = db.prepare(`
      SELECT minute, minute_added, type, team_id, score_state_json,
             prob_home_win, prob_draw, prob_away_win,
             delta_home_win, delta_draw, delta_away_win
      FROM match_moments
      WHERE match_id = ?
      ORDER BY minute ASC, minute_added ASC, detected_at ASC
    `).all(String(matchId));
    if (!rows.length) return [];

    const seen = new Set();
    const nodes = [];
    for (const row of rows) {
      const dedupKey = `${row.minute}-${row.type}-${row.team_id || ''}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      let scoreState = {};
      try { scoreState = JSON.parse(row.score_state_json || '{}'); } catch { scoreState = {}; }

      const drift = [];
      const fmtDelta = (v) => (v == null ? null : `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10}`);
      const dH = fmtDelta(row.delta_home_win);
      const dD = fmtDelta(row.delta_draw);
      const dA = fmtDelta(row.delta_away_win);
      if (dH != null) drift.push(`主胜Δ${dH}`);
      if (dD != null) drift.push(`平Δ${dD}`);
      if (dA != null) drift.push(`客胜Δ${dA}`);

      const hasProb = row.prob_home_win != null;
      nodes.push({
        trigger: row.type,
        minute: row.minute,
        home: { name: homeName, score: Number(scoreState.home ?? 0) },
        away: { name: awayName, score: Number(scoreState.away ?? 0) },
        odds: hasProb ? {
          homeWin: row.prob_home_win,
          draw: row.prob_draw,
          awayWin: row.prob_away_win,
        } : null,
        summary: drift.join(' ') || null,
      });
    }
    return nodes;
  } catch (e) {
    logger.warn('ReviewService: failed to build match_moments timeline', { detail: String(matchId), error: e?.message });
    return [];
  }
}

class ReviewService {
  constructor(deps) {
    this.deps = deps;
  }
  extractMatchContext(matchData, getTeamNameZh) {
    const comp = matchData?.header?.competitions?.[0];
    if (!comp?.competitors) return null;
    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    const status = comp.status?.type || {};

    return {
      comp,
      homeComp,
      awayComp,
      match: {
        homeId: homeComp?.team?.id,
        awayId: awayComp?.team?.id,
        homeName: getTeamNameZh(homeComp?.team?.id),
        awayName: getTeamNameZh(awayComp?.team?.id),
        homeScore: Number.parseInt(homeComp?.score || '0', 10),
        awayScore: Number.parseInt(awayComp?.score || '0', 10),
        status: status.name || '',
        completed: Boolean(status.completed || status.state === 'post' || status.name === 'STATUS_FINAL' || status.name === 'STATUS_FULL_TIME'),
        date: comp.date || matchData.header?.date || '',
        venue: comp.venue?.fullName || '',
      },
    };
  }

  extractKeyEvents(commentary) {
    if (!Array.isArray(commentary)) return null;
    return commentary.slice(0, 12).map((item) => {
      if (typeof item === 'string') return item;
      const text = item?.text || item?.description || item?.detail || '';
      if (!text) return '';
      return {
        minute: item?.time?.displayValue || item?.minute || '',
        type: item?.type || 'commentary',
        text,
        textI18n: item?.textI18n || { zh: text, en: text },
      };
    }).filter(Boolean);
  }

  extractNewsEvidence(newsPayload) {
    if (!newsPayload) return [];
    if (Array.isArray(newsPayload.news)) return newsPayload.news;
    if (Array.isArray(newsPayload.articles)) return newsPayload.articles;
    if (Array.isArray(newsPayload.items)) return newsPayload.items;
    return [];
  }

  async reviewMatch(matchId, { persist = false } = {}) {
    const { espn, getTeamNameZh, getTeamNameI18n, routes } = this.deps;

    const cachedReview = getSavedPostMatchReview(matchId);
    const matchData = await espn(`/summary?event=${matchId}`, `pmr_${matchId}`, 120000);
    const ctx = this.extractMatchContext(matchData, getTeamNameZh);
    if (!ctx) return cachedReview || { error: 'Match not found' };

    ctx.match.homeNameI18n = getTeamNameI18n ? getTeamNameI18n(ctx.match.homeId, ctx.homeComp?.team?.displayName) : null;
    ctx.match.awayNameI18n = getTeamNameI18n ? getTeamNameI18n(ctx.match.awayId, ctx.awayComp?.team?.displayName) : null;

    // Compute momentum from full ESPN commentary (not truncated 12-item extract).
    // Use ESPN display names (e.g. "Portugal") for side inference — the commentary
    // text is English, and Chinese+English names like "葡萄牙 Portugal" won't match.
    const momentumResult = filterMatchEvents(matchData.commentary || [], {
      homeName: ctx.homeComp?.team?.displayName || ctx.match.homeName,
      awayName: ctx.awayComp?.team?.displayName || ctx.match.awayName,
    });
    const momentum = {
      buckets: momentumResult.momentumBuckets,
      matchScript: momentumResult.matchScript,
      notes: momentumResult.notes,
    };
    const keyEvents = momentumResult.keyEvents || [];
    const moments = momentumResult.moments || [];
    // 接入 moment-sync 抓到的实时结构化节点（补水/中场/换人/进球分钟数 + 概率漂移），
    // 让赛后复盘 AI 真正吃到这份数据，而不是只靠 ESPN 文字直播。
    const liveTimeline = getMatchMomentsTimeline(matchId, ctx.match.homeName, ctx.match.awayName);

    if (shouldUseSavedPostMatchReview(cachedReview, ctx.match)) {
      const review = { ...cachedReview };
      if (!review.momentum) review.momentum = momentum;
      if (!review.keyEvents) review.keyEvents = keyEvents;
      if (!review.moments) review.moments = moments;
      // 老复盘可能是在接入实时 moment 之前生成的，补齐时间线（不覆盖已有）。
      if (!review.liveTimelineI18n || !review.liveTimelineI18n.length) {
        review.liveTimelineI18n = liveTimeline;
      }
      return review;
    }

    const snapshot = getPredictionSnapshot(matchId);
    const commentary = this.extractKeyEvents(matchData.commentary) || [];
    let news = [];
    try {
      const newsPayload = routes['GET /api/match/:id/news']
        ? await routes['GET /api/match/:id/news']({ id: matchId })
        : null;
      news = this.extractNewsEvidence(newsPayload);
    } catch { logger.warn('ReviewService: failed to fetch news evidence for', { detail: matchId }); }

    const review = buildPostMatchReview({
      matchId,
      match: ctx.match,
      snapshot,
      evidence: {
        events: commentary,
        commentary,
        news,
        timeline: liveTimeline,
      },
      generatedBy: 'post-match-framework',
    });
    review.momentum = momentum;
    review.keyEvents = keyEvents;
    review.moments = moments;

    if (persist && ctx.match.completed) savePostMatchReview(matchId, review);
    return review;
  }
}

// 暴露为静态方法，便于独立单测，同时不影响 `new ReviewService(deps)` 的调用方。
ReviewService.getMatchMomentsTimeline = getMatchMomentsTimeline;
module.exports = ReviewService;
