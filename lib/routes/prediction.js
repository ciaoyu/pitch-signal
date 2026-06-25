/**
 * 预测相关路由
 * /api/predict/*, /api/elo/*, /api/qualification-probabilities, /api/match-review
 */
const PredictionEngine = require('../prediction');
const QualificationSimulator = require('../qualification');
const MatchReviewEngine = require('../matchReview');
const {
  savePredictionSnapshot,
  getPredictionSnapshot,
  buildPostMatchReview,
  savePostMatchReview,
  getSavedPostMatchReview,
  shouldUseSavedPostMatchReview,
} = require('../postMatchReview');
const { constantTimeEqual } = require('../security');

function extractKeyEvents(commentary) {
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

// T15: extractMatchContext and extractNewsEvidence removed — use ReviewService methods instead
// T15: toNumber, clamp, normalizeThreeWay, buildLiveAnalysis moved to PredictionService

function mergeEvidence(existing = {}, incoming = {}) {
  if (!incoming || typeof incoming !== 'object') return existing || {};
  return {
    ...(existing || {}),
    ...incoming,
    events: incoming.events ?? existing?.events ?? [],
    news: incoming.news ?? existing?.news ?? [],
    commentary: incoming.commentary ?? existing?.commentary ?? [],
  };
}

// T15: buildLiveAnalysis moved to PredictionService.buildLiveAnalysis

function generateManualPostMatchReview(body, routeMatchId) {
  const { match, evidence, aiPostmortem } = body || {};
  const matchId = routeMatchId || body?.matchId;
  if (!matchId) return { error: 'Missing required field: matchId' };

  const existing = getSavedPostMatchReview(matchId);

  if (!match) {
    if (!existing) return { error: 'Missing required field: match' };
    const review = {
      ...existing,
      evidence: mergeEvidence(existing.evidence, evidence),
      aiPostmortem: aiPostmortem ? {
        ...(existing.aiPostmortem || {}),
        ...aiPostmortem,
        status: aiPostmortem.status || existing.aiPostmortem?.status || 'provided',
      } : existing.aiPostmortem,
      generatedAt: new Date().toISOString(),
    };
    savePostMatchReview(matchId, review);
    return review;
  }

  const snapshot = getPredictionSnapshot(matchId);
  const review = buildPostMatchReview({
    matchId,
    match,
    snapshot,
    evidence: evidence ?? existing?.evidence ?? {},
    generatedBy: 'manual-post',
  });
  if (aiPostmortem) {
    review.aiPostmortem = {
      ...review.aiPostmortem,
      ...aiPostmortem,
      status: aiPostmortem.status || 'provided',
    };
  } else if (existing?.aiPostmortem) {
    review.aiPostmortem = existing.aiPostmortem;
  }

  savePostMatchReview(matchId, review);
  return review;
}

const PredictionService = require("../services/PredictionService");
const ReviewService = require("../services/ReviewService");

module.exports = function createPredictionRoutes(deps) {
  const { getCached, setCache, espn, RATINGS, getTeamNameZh, getTeamNameI18n, routes, TEAM_FLAGS } = deps;
  const predictionService = new PredictionService(deps);
  const reviewService = new ReviewService(deps);

  const checkAdminAuth = (params, req) => {
    const expected = process.env.WRITE_API_TOKEN || process.env.ADMIN_TOKEN || '';
    if (!expected) {
      const err = new Error('Write operations are disabled in public beta');
      err.statusCode = 403;
      throw err;
    }
    const authHeader = req?.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const provided = authHeader.slice(7).trim();
      if (constantTimeEqual(provided, expected)) return;
    }
    const token = req?.headers?.['x-admin-token'] || params?.admin_token || params?.token || '';
    if (!constantTimeEqual(token, expected)) {
      const err = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }
  };

  return {
    // === 综合预测 ===
    "GET /api/predict/:matchId": async (params) => {
      try {
        return await predictionService.predictMatch(params.matchId);
      } catch (e) {
        return { error: "Prediction failed", message: e.message };
      }
    },

    'POST /api/predict-live/:matchId': async (params, body) => {
      try {
        const liveStats = body?.liveStats || body || {};
        return await predictionService.predictLive(params.matchId, liveStats);
      } catch (e) {
        return { error: 'Live prediction failed', message: e.message };
      }
    },

    // === Elo 排名（优先从 DB 读取，fallback 到内存计算） ===
    'GET /api/elo/rankings': async () => {
      try {
        return await predictionService.getEloRankings();
      } catch (e) {
        return { error: 'Elo rankings failed', message: e.message };
      }
    },

    // === 单队 Elo（优先从 DB 读取） ===
    'GET /api/elo/:team': async (params) => {
      try {
        return await predictionService.getTeamElo(params.team);
      } catch (e) {
        return { error: 'Team Elo lookup failed', message: e.message };
      }
    },

    // === 出线形势（从 DB 加载真实分组） ===
    'GET /api/qualification-probabilities': async () => {
      const cached = getCached('qualification_probs', 1800000);
      if (cached) return cached;

      try {
        const engine = new PredictionEngine();
        const sim = new QualificationSimulator({
          simulations: 10000,
          predictionEngine: engine,
        });

        // 从 DB 加载分组
        const groups = sim.loadGroupsFromDB();
        const results = {};
        for (const group of groups) {
          results[group.name] = sim.simulateGroup(group);
        }
        setCache('qualification_probs', results);
        return results;
      } catch (e) {
        return { error: 'Simulation failed', message: e.message };
      }
    },

    // === 比赛回顾 + 预测偏差分析 ===
    'GET /api/match-review/:matchId': async (params) => {
      try {
        const matchData = await espn(`/summary?event=${params.matchId}`, `mr_${params.matchId}`, 120000);
        if (!matchData?.header?.competitions?.[0]?.competitors) return { error: 'Match not found' };

        const comp = matchData.header.competitions[0];
        const homeComp = comp.competitors.find(c => c.homeAway === 'home');
        const awayComp = comp.competitors.find(c => c.homeAway === 'away');
        const homeId = homeComp?.team?.id;
        const awayId = awayComp?.team?.id;

        // 真实比分
        const homeScore = parseInt(comp.competitors.find(c => c.homeAway === 'home')?.score || '0');
        const awayScore = parseInt(comp.competitors.find(c => c.homeAway === 'away')?.score || '0');

        const engine = new PredictionEngine();
        const reviewer = new MatchReviewEngine({ predictionEngine: engine });
        const review = reviewer.generateReview({
          homeId, awayId, homeScore, awayScore,
          group: comp.group?.name || comp.league?.name || 'Unknown',
          matchDate: comp.date || matchData.header.date,
          venue: comp.venue?.fullName || 'TBD',
          events: extractKeyEvents(matchData.commentary),
        });

        review.match.homeName = getTeamNameZh(homeId);
        review.match.awayName = getTeamNameZh(awayId);
        review.match.homeNameI18n = getTeamNameI18n ? getTeamNameI18n(homeId, homeComp?.team?.displayName) : null;
        review.match.awayNameI18n = getTeamNameI18n ? getTeamNameI18n(awayId, awayComp?.team?.displayName) : null;
        review.match.homeLogo = homeComp?.team?.logos?.[0]?.href;
        review.match.awayLogo = awayComp?.team?.logos?.[0]?.href;
        review.match.status = comp.status?.type?.name || 'STATUS_FINAL';

        return review;
      } catch (e) {
        return { error: 'Match review failed', message: e.message };
      }
    },

    // === 赛后预测闭环：赛前快照 vs 实际结果 + 新闻/评论证据 ===
    "GET /api/post-match-review/:matchId": async (params) => {
      try {
        return await reviewService.reviewMatch(params.matchId);
      } catch (e) {
        return { error: "Post-match review failed", message: e.message };
      }
    },

    // === 手动赛后复盘：允许外部 AI/评论采集团队注入 evidence ===
    'POST /api/post-match-review': async (params, body, req) => {
      try {
        checkAdminAuth(params, req);
        return generateManualPostMatchReview(body);
      } catch (e) {
        throw e;
      }
    },

    'POST /api/post-match-review/:matchId': async (params, body, req) => {
      try {
        checkAdminAuth(params, req);
        return generateManualPostMatchReview(body, params.matchId);
      } catch (e) {
        throw e;
      }
    },

    // === 手动比赛回顾（通过 JSON body）—— 需要管理员 token ===
    'POST /api/match-review': async (params, body, req) => {
      try {
        checkAdminAuth(params, req);
        const { homeId, awayId, homeScore, awayScore, group, matchDate, venue } = body || {};
        if (!homeId || !awayId || homeScore == null || awayScore == null) {
          return { error: 'Missing required fields: homeId, awayId, homeScore, awayScore' };
        }

        const engine = new PredictionEngine();
        const reviewer = new MatchReviewEngine({ predictionEngine: engine });

        const review = reviewer.generateReview({
          homeId, awayId, homeScore, awayScore,
          group: group || 'Unknown',
          matchDate: matchDate || new Date().toISOString().split('T')[0],
          venue: venue || 'TBD',
        });

        review.match.homeName = getTeamNameZh(homeId);
        review.match.awayName = getTeamNameZh(awayId);
        review.match.homeNameI18n = getTeamNameI18n ? getTeamNameI18n(homeId) : null;
        review.match.awayNameI18n = getTeamNameI18n ? getTeamNameI18n(awayId) : null;

        return review;
      } catch (e) {
        return { error: e.message || 'Review generation failed', statusCode: e.statusCode || 500 };
      }
    },
  };
};
