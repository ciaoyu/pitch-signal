/**
 * Prediction related routes
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
const { resolveMatchState } = require('../services/live-state-machine');
const { constantTimeEqual } = require('../security');
const {
  translateFootballCommentaryToZh,
  translateEventToBilingual,
  computeEventImportance,
  extractKeyEvents,
} = require('../keyEvents');


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
  // Use deps-injected instances when available (server.js creates them for background jobs),
  // otherwise create module-local instances as fallback.
  const predictionService = deps.predictionService || new PredictionService(deps);
  const reviewService = deps.reviewService || new ReviewService(deps);

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
    // === Comprehensive Prediction ===
    "GET /api/predict/:matchId": async (params) => {
      try {
        // THE_ODDS_API_KEY is the variable actually read by PredictionService.fetchExternalOdds()
        // (see lib/services/PredictionService.js:25); previously misidentified as BALLDONTLIE_API_KEY,
        // which caused external odds not to be fed into the prediction pipeline even when THE_ODDS_API_KEY was set.
        const hasOddsKey = Boolean(process.env.THE_ODDS_API_KEY);
        return await predictionService.predictMatch(params.matchId, { includeExternalOdds: hasOddsKey });
      } catch (e) {
        return { error: "Prediction failed", message: e.message };
      }
    },

    // §1.1 Track-A discipline: the only public in-play probability path is
    // GET /api/match/:id/live-probability, which routes through lib/live-reprice.reprice()
    // (pure math on hard facts: score/time/red cards). This POST endpoint instead feeds
    // unverified soft signals (shots/possession/cards) and double-counts external odds via
    // buildLiveAnalysis, so it is restricted to admin use only. Public beta has no
    // WRITE_API_TOKEN/ADMIN_TOKEN set, so every public caller receives 403 (or 401 if a
    // token is configured but not supplied). Frontend already uses the live-probability path.
    'POST /api/predict-live/:matchId': async (params, body, req) => {
      checkAdminAuth(params, req);
      try {
        const liveStats = body?.liveStats || body || {};
        return await predictionService.predictLive(params.matchId, liveStats);
      } catch (e) {
        return { error: 'Live prediction failed', message: e.message };
      }
    },

    // === Elo Rankings (prefer DB read, fallback to in-memory compute) ===
    'GET /api/elo/rankings': async () => {
      try {
        return await predictionService.getEloRankings();
      } catch (e) {
        return { error: 'Elo rankings failed', message: e.message };
      }
    },

    // === Single Team Elo (prefer DB read) ===
    'GET /api/elo/:team': async (params) => {
      try {
        return await predictionService.getTeamElo(params.team);
      } catch (e) {
        return { error: 'Team Elo lookup failed', message: e.message };
      }
    },

    // === Qualification Scenarios (load real groups from DB) ===
    'GET /api/qualification-probabilities': async () => {
      const cached = getCached('qualification_probs', 1800000);
      if (cached) return cached;

      try {
        const engine = new PredictionEngine();
        const sim = new QualificationSimulator({
          simulations: 10000,
          predictionEngine: engine,
        });

        // Load groups from DB
        const groups = sim.loadGroupsFromDB();
        const results = sim.simulateGroups(groups);
        setCache('qualification_probs', results);
        return results;
      } catch (e) {
        return { error: 'Simulation failed', message: e.message };
      }
    },

    // === Match Review + Prediction Deviation Analysis ===
    'GET /api/match-review/:matchId': async (params) => {
      try {
        const matchData = await espn(`/summary?event=${params.matchId}`, `mr_${params.matchId}`, 120000);
        if (!matchData?.header?.competitions?.[0]?.competitors) return { error: 'Match not found' };

        const comp = matchData.header.competitions[0];
        const homeComp = comp.competitors.find(c => c.homeAway === 'home');
        const awayComp = comp.competitors.find(c => c.homeAway === 'away');
        const homeId = homeComp?.team?.id;
        const awayId = awayComp?.team?.id;

        // Actual scores
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

    // === Post-match prediction loop: Pre-match snapshot vs actual result + news/commentary evidence ===
    "GET /api/post-match-review/:matchId": async (params) => {
      try {
        return await reviewService.reviewMatch(params.matchId);
      } catch (e) {
        return { error: "Post-match review failed", message: e.message };
      }
    },

    // === Manual post-match review: allow external AI/commentary team to inject evidence ===
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

    // === Manual match review (via JSON body) -- requires admin token ===
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

    /**
     * GET /api/match/:id/pressure
     * Return Pressure Index curve + current pressure + surge alerts
     */
    'GET /api/match/:id/pressure': async (params) => {
      try {
        const { getPressureCurve } = require('../services/pressure-index');
        const { db } = require('../db');
        const matchId = params.id;

        const curve = getPressureCurve(matchId);

        // Current pressure (latest snapshot)
        const latest = curve[curve.length - 1] ?? null;

        // All surge alert moments for this match
        const alerts = db.prepare(`
          SELECT minute, raw_json, detected_at
          FROM match_moments
          WHERE match_id = ? AND type = 'sustained_pressure_alert'
          ORDER BY minute ASC
        `).all(matchId).map(r => ({
          minute: r.minute,
          detectedAt: r.detected_at,
          ...JSON.parse(r.raw_json ?? '{}'),
        }));

        return {
          matchId,
          current: latest ? {
            home: latest.pressure_home,
            away: latest.pressure_away,
            dominant: latest.pressure_dominant,
            atMinute: latest.minute,
          } : null,
          curve,
          surgeAlerts: alerts,
        };
      } catch (e) {
        return { error: e.message, statusCode: 500 };
      }
    },

    /**
     * GET /api/match/:id/live-probability
     * Track A in-play probability: mathematical repricing based on current score + time + red cards
     * Requires query parameters: ?minute=&homeScore=&awayScore=&homeRed=&awayRed=&isKnockout=
     */
    'GET /api/match/:id/live-probability': async (params) => {
      try {
        const { reprice } = require('../live-reprice');
        const { db } = require('../db');
        const matchId = params.id;

        // Fetch pre-match snapshot lambda baseline; compute live if missing
        let snap = db.prepare(`
          SELECT home_expected_goals, away_expected_goals, home_win_prob, draw_prob, away_win_prob
          FROM prediction_snapshots WHERE match_id = ? ORDER BY created_at ASC LIMIT 1
        `).get(matchId);

        if (!snap) {
          try {
            const pred = await predictionService.predictMatch(matchId);
            if (pred && pred.homeWin != null) {
              snap = {
                home_expected_goals: pred.goals?.homeExpected ?? pred.components?.poisson?.homeLambda ?? 1.2,
                away_expected_goals: pred.goals?.awayExpected ?? pred.components?.poisson?.awayLambda ?? 1.0,
                home_win_prob: pred.homeWin,
                draw_prob: pred.draw,
                away_win_prob: pred.awayWin,
              };
            }
          } catch (_) {}
        }

        if (!snap) return { error: 'No pre-match snapshot found', matchId };

        const liveProb = reprice({
          preLambdaHome:  snap.home_expected_goals ?? 1.2,
          preLambdaAway:  snap.away_expected_goals ?? 1.0,
          homeScore:      Number(params.homeScore ?? 0),
          awayScore:      Number(params.awayScore ?? 0),
          minuteElapsed:  Number(params.minute ?? 0),
          addedTime:      Number(params.addedTime ?? 0),
          homeRedCards:   Number(params.homeRed ?? 0),
          awayRedCards:   Number(params.awayRed ?? 0),
          isKnockout:     params.isKnockout === 'true',
        });

        // Retrieve recorded probability curve for this match (sorted by time)
        const curve = db.prepare(`
          SELECT minute, minute_added, type, prob_home_win, prob_draw, prob_away_win, detected_at
          FROM match_moments
          WHERE match_id = ? AND prob_home_win IS NOT NULL
          ORDER BY minute ASC, minute_added ASC
        `).all(matchId);

        const score = {
          home: params.homeScore !== undefined && params.homeScore !== '-' ? Number(params.homeScore) : 0,
          away: params.awayScore !== undefined && params.awayScore !== '-' ? Number(params.awayScore) : 0,
        };
        const liveState = resolveMatchState({
          statusName: params.statusName || '',
          statusState: params.state || '',
          minute: Number(params.minute || 0),
          displayClock: params.displayClock || '',
          hasPenalties: params.hasPenalties === 'true',
        });

        return {
          matchId,
          score,
          liveState,
          preMatch: {
            homeWin: snap.home_win_prob,
            draw:    snap.draw_prob,
            awayWin: snap.away_win_prob,
          },
          current: liveProb,
          curve,
        };
      } catch (e) {
        return { error: e.message, statusCode: 500 };
      }
    },
  };
};
