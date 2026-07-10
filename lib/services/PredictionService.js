const fs = require('fs');
const path = require('path');
const { createLogger } = require('../logger');
const { resolveDataPath } = require('../data-resolver');
const DATA_DIR = path.resolve(__dirname, '../../data');
const logger = createLogger('PredictionService');
const PredictionEngine = require('../prediction');
const { savePredictionSnapshot } = require('../postMatchReview');
const teamResolver = require('../team_resolver');
const { applyOutputRules } = require('../output-rules');
const marketValueSignal = require('./market-value-signal');
const continentalStrengthSignal = require('./continental-strength-signal');
const fatigueSignal = require('./fatigue-signal');
const { detectKnockout, normalizeStage } = require('../knockoutStage');

// Cached read of the match schedule snapshot (KO-3 stage source). Read once per
// process; the snapshot is static for a given tournament build.
let _scheduleMatchesCache = null;
function getScheduleMatches() {
  if (_scheduleMatchesCache) return _scheduleMatchesCache;
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'match_snapshot_schedule.json'), 'utf8');
    _scheduleMatchesCache = JSON.parse(raw).matches || [];
  } catch (e) {
    logger.debug('KO-3: schedule snapshot unavailable', { error: e.message });
    _scheduleMatchesCache = [];
  }
  return _scheduleMatchesCache;
}

// Resolve the knockout context for a match straight from the schedule snapshot
// (KO-3: stage read directly, does not depend on KO-1). Returns the raw stage
// string plus the normalized { isKnockout, knockoutRound } tuple.
function getKnockoutContextForMatch(matchId) {
  const matches = getScheduleMatches();
  const m = matches.find(x => String(x.matchId) === String(matchId));
  const stage = m ? m.stage : null;
  const ko = detectKnockout(stage);
  return { stage, isKnockout: ko.isKnockout, knockoutRound: ko.knockoutRound };
}

class PredictionService {
  constructor(deps) {
    this.deps = deps;
  }

  async fetchExternalOdds(matchId, { allowCache = true, homeId = null, awayId = null } = {}) {
    const { getCached, setCache } = this.deps;
    const oddsKey = `analysis_odds_${matchId}`;
    if (allowCache) {
      const cached = getCached(oddsKey, 300000);
      if (cached) return cached;
    }

    const ODDS_KEY = process.env.THE_ODDS_API_KEY || '';
    if (!ODDS_KEY) return null;

    try {
      const { fetchMatchOdds } = require('./the-odds-api');
      const result = await fetchMatchOdds(homeId, awayId, ODDS_KEY);
      if (result) {
        setCache(oddsKey, result);
        return result;
      }
    } catch (error) {
      logger.warn(`External odds lookup failed for ${matchId}:`, { error: error.message });
    }

    return null;
  }

  getRatingTeam(input) {
    const { RATINGS } = this.deps;
    const resolved = teamResolver.resolve(input);
    const ratingsId = resolved?.ratings_id || String(input || '');
    // Try ratings.teams[name_official] (e.g. "Germany")
    let team = RATINGS.teams?.[ratingsId] || RATINGS.teams?.[String(input || '')];
    // Fallback to estimated when id_bridge has no ratings (do not throw error)
    if (!team) {
      return { ratingsId, team: null, source: 'estimated', _note: 'No ratings data — using estimated baseline' };
    }
    return { ratingsId, team, source: 'ratings' };
  }

  calcAvg(team, source) {
    // Fallback: return estimated default values when no ratings data
    if (!team) {
      return { rating: 1500, attack_strength: 1.0, defense_strength: 1.0, source: 'estimated_default' };
    }
    if (team?.rating) {
      return {
        rating: team.rating,
        attack_strength: team.attack_strength || 1.0,
        defense_strength: team.defense_strength || 1.0,
      };
    }
    const players = team?.players || [];
    if (!players.length) return { rating: 1500, attack_strength: 1.0, defense_strength: 1.0 };
    const avg = players.reduce((s, p) => s + (p.rating || 70), 0) / players.length;
    const atk = players.filter(p => ['LW','RW','ST','CF','F','AM','CAM'].includes(p.pos));
    const def = players.filter(p => ['GK','CB','LB','RB','LWB','RWB','D'].includes(p.pos));
    const atkAvg = atk.length ? atk.reduce((s, p) => s + (p.rating || 70), 0) / atk.length : avg;
    const defAvg = def.length ? def.reduce((s, p) => s + (p.rating || 70), 0) / def.length : avg;
    return {
      rating: Math.round(avg * 10) + 1000,
      attack_strength: Math.round((atkAvg / 75) * 1000) / 1000,
      defense_strength: Math.round((defAvg / 75) * 1000) / 1000,
    };
  }

  async predictMatch(matchId, { persist = false, includeExternalOdds = false, bypassCache = false } = {}) {
    const { getCached, setCache, espn, getTeamNameZh, getTeamNameI18n, routes, TEAM_FLAGS } = this.deps;
    const dbInstance = require('../db').db;

    const predKey = `pred_${matchId}`;
    const cached = getCached(predKey, 300000);
    // Public reads may use the cache. Persistence jobs deliberately recalculate so
    // a prior public request cannot prevent creation of the scheduled snapshot.
    if (cached && !persist && !bypassCache && !includeExternalOdds) return cached;

    const engine = new PredictionEngine();
    const matchData = await espn(`/summary?event=${matchId}`, `m_${matchId}`, 120000);
    if (!matchData?.header?.competitions?.[0]?.competitors) return { error: 'Match not found' };

    const comp = matchData.header.competitions[0];
    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    const homeId = homeComp?.team?.id;
    const awayId = awayComp?.team?.id;

    const homeLookup = this.getRatingTeam(homeId);
    const awayLookup = this.getRatingTeam(awayId);
    const homeRating = this.calcAvg(homeLookup.team);
    const awayRating = this.calcAvg(awayLookup.team);

    // Venue lookup: extract name from ESPN summary, match against venues.json
    let venue = null;
    try {
      const espnVenueName = matchData.gameInfo?.venue?.fullName || matchData.gameInfo?.venue?.shortName || comp.venue?.fullName || comp.venue?.name || '';
      if (espnVenueName) {
        const venuesRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'venues.json'), 'utf8'));
        const venuesArr = Array.isArray(venuesRaw) ? venuesRaw : Object.values(venuesRaw);
        venue = venuesArr.find(v => v.name && v.name.toLowerCase() === espnVenueName.toLowerCase()) || null;
      }
    } catch { /* venue stays null — engine handles gracefully */ }

    // P0 quarantine (Owner A v3): FAIL-CLOSED neutral venue.
    // World Cup membership is decided by the schedule snapshot (the authoritative
    // 2026 WC fixture list), NOT by venue parsing. So even when ESPN changes the
    // venue name, venue data is missing, or parsing fails, a confirmed WC match
    // KEEPS neutralVenue=true (no nominal home advantage). Only matches that are
    // EXPLICITLY absent from the WC schedule (league / non-WC context) fall back
    // to the legacy home advantage. The host nation is a recorded FACT only
    // (hostSide); host effect SIZE waits for data estimation (Owner E). No new
    // ESPN knockout path is added — schedule-based KO detection below is reused.
    const inWorldCupSchedule = getScheduleMatches().some(x => String(x.matchId) === String(matchId));
    const HOST_COUNTRY_TEAM_ID = { USA: 'USA', Canada: 'Canada', Mexico: 'Mexico' };

    let neutralVenue;
    let hostTeamId = null;
    if (inWorldCupSchedule) {
      neutralVenue = true; // fail-closed default for any confirmed WC match
      // hostSide fact derived from venue country; if venue unresolved -> 'none'
      if (venue && venue.country && HOST_COUNTRY_TEAM_ID[venue.country]) {
        hostTeamId = HOST_COUNTRY_TEAM_ID[venue.country];
      }
    } else {
      // Explicitly non-WC / league context: legacy home advantage.
      neutralVenue = false;
    }

    // Public beta must not use live market data as a prediction input.  Keep the
    // plumbing in PredictionEngine for a future, separately approved phase.
    const odds = includeExternalOdds
      ? await this.fetchExternalOdds(matchId, { allowCache: !bypassCache, homeId: homeLookup.ratingsId, awayId: awayLookup.ratingsId })
      : null;

    const marketValueEnabled = process.env.MARKET_VALUE_SIGNAL_ENABLED === 'true';
    const squadMarketValueSignal = marketValueEnabled
      ? marketValueSignal.buildSignal(homeLookup.ratingsId, awayLookup.ratingsId)
      : null;
    const continentalStrengthEnabled = process.env.CONTINENTAL_STRENGTH_SIGNAL_ENABLED === 'true';
    const confedStrengthSignal = continentalStrengthEnabled
      ? continentalStrengthSignal.buildSignal(homeLookup.ratingsId, awayLookup.ratingsId)
      : null;

    // KO-3: resolve knockout stage from the schedule snapshot and feed it into
    // the engine so the (previously dead) knockout calibration actually fires.
    const koCtx = getKnockoutContextForMatch(matchId);
    logger.debug('KO-3: knockout context', { matchId, stage: koCtx.stage, isKnockout: koCtx.isKnockout, knockoutRound: koCtx.knockoutRound });

    // KO-5 fatigue index — QUARANTINED from the probability (P0, Owner A v2).
    // The signal (weight 0.04, maxTilt 0.025) was never OOS-estimated and must
    // not form any public probability. It is NO LONGER passed into the engine.
    // The knockout-intel `fatigue` SECTION remains display-only and is built
    // independently inside services/knockout-intel.js (usedInModel: false now).
    // (Previously: fatigueSignal.buildSignal(...) -> engine.)

    // Public beta hard gate: AI context must not enter the prediction pipeline,
    // regardless of an accidentally supplied environment variable.
    const aiEnabled = false;
    let groupName = null;
    if (aiEnabled) {
      try {
        const gRow = dbInstance.prepare(
          "SELECT g.group_name FROM matches m JOIN groups g ON m.group_id = g.id WHERE (m.home_team_id = ? OR m.away_team_id = ?) AND (m.home_team_id = ? OR m.away_team_id = ?) LIMIT 1"
        ).get(homeLookup.ratingsId, homeLookup.ratingsId, awayLookup.ratingsId, awayLookup.ratingsId);
        groupName = gRow?.group_name || null;
      } catch { logger.debug('PredictionService: group lookup failed for', { detail: `${homeId} vs ${awayId}` }); }
    }

    const result = aiEnabled
      ? await engine.predictWithAI({ matchId, homeId: homeLookup.ratingsId, awayId: awayLookup.ratingsId, homeEspnId: homeId, awayEspnId: awayId, homeRating, awayRating, odds, groupName, venue, neutralVenue, hostTeamId, isKnockout: koCtx.isKnockout, knockoutRound: koCtx.knockoutRound, marketValueSignal: squadMarketValueSignal, continentalStrengthSignal: confedStrengthSignal })
      : await engine.predictWithMarket({ matchId, homeId: homeLookup.ratingsId, awayId: awayLookup.ratingsId, homeEspnId: homeId, awayEspnId: awayId, homeRating, awayRating, odds, venue, neutralVenue, hostTeamId, isKnockout: koCtx.isKnockout, knockoutRound: koCtx.knockoutRound, marketValueSignal: squadMarketValueSignal, continentalStrengthSignal: confedStrengthSignal });

    if (odds) {
      result.externalOdds = odds;
    }
    // P0 quarantine v3 -> v4 (Owner A, B1 metadata fix): the PUBLIC probability is
    // formed ONLY from Elo + Poisson. odds / MarketValue / Continental are
    // candidate-only (engine sets usedInModel:false) and MUST NOT be reported as
    // "used" in the public probability. Frontend, audit records and paper readers
    // must not infer they entered the number. We therefore:
    //   - predictionSource = 'elo_poisson' (the real public contract)
    //   - *_Used = false for every candidate signal (regardless of availability)
    //   - *_Available = true ONLY when the raw signal was observed/passed, so it
    //     can still be shown as a transparent, non-fused observation.
    result.predictionSource = 'elo_poisson';
    result.externalOddsUsed = false;
    result.marketValueSignalUsed = false;
    result.continentalStrengthSignalUsed = false;
    result.externalOddsAvailable = Boolean(odds);
    result.marketValueCandidateAvailable = Boolean(squadMarketValueSignal);
    result.continentalCandidateAvailable = Boolean(confedStrengthSignal);
    
    result.match = {
      homeId,
      awayId,
      homeName: getTeamNameZh(homeId),
      awayName: getTeamNameZh(awayId),
      homeNameI18n: getTeamNameI18n ? getTeamNameI18n(homeId, homeComp?.team?.displayName) : null,
      awayNameI18n: getTeamNameI18n ? getTeamNameI18n(awayId, awayComp?.team?.displayName) : null,
      homeLogo: homeComp?.team?.logos?.[0]?.href,
      awayLogo: awayComp?.team?.logos?.[0]?.href,
      homeFlag: TEAM_FLAGS[homeId] || '🏳️',
      awayFlag: TEAM_FLAGS[awayId] || '🏳️',
      status: comp.status?.type?.name || 'STATUS_SCHEDULED',
    };

    // Read id_bridge probs as prior probability signal (3-way w/d/l) and inject into result.priors
    try {
      const probs = JSON.parse(fs.readFileSync(resolveDataPath('probs.json'), 'utf8'));
      const prior = probs[matchId];
      if (prior) {
        result.priors = {
          homeWin: prior.h / 100,
          draw: prior.d / 100,
          awayWin: prior.a / 100,
          source: 'id_bridge_probs',
        };
      }
    } catch (_) { /* Skip when probs.json is unavailable */ }
    try {
      Object.assign(result, applyOutputRules(result, matchId));
    } catch (ruleErr) {
      logger.warn('Output rules failed (non-fatal):', { error: ruleErr.message });
    }

    // Final-round tactical context layer: deterministic qualification scenarios + concurrent match + avoiding strong opponents in next round
    // Only populated in group stage final round (all 4 teams played===2); purely explanatory without modifying probabilities.
    try {
      const standingsResp = routes?.['GET /api/standings']
        ? await routes['GET /api/standings']()
        : null;
      const standingsGroups = standingsResp?.groups || null;
      if (standingsGroups) {
        const { buildFinalRoundContext } = require('../finalRoundContext');
        const scenario = buildFinalRoundContext({ homeId, awayId, standingsGroups });
        if (scenario?.applicable) result.tacticalScenario = scenario;
      }
    } catch (scenErr) {
      logger.warn('Final-round context failed (non-fatal):', { error: scenErr.message });
    }

    // KO-1: knockout-intel aggregation (suspensions + future sections). Gated on
    // isKnockout so group-stage matches omit the field entirely (card hidden,
    // bot context stays clean). Pure display/bot metadata — never fed back into
    // the prediction engine, so it cannot move the backtest numbers.
    try {
      if (koCtx.isKnockout) {
        const { buildKnockoutIntel } = require('../services/knockout-intel');
        const intel = buildKnockoutIntel({
          matchId,
          homeId,
          awayId,
          homeName: getTeamNameZh(homeId),
          awayName: getTeamNameZh(awayId),
          stage: koCtx.stage,
          nextRound: koCtx.knockoutRound,
          db: dbInstance,
        });
        if (intel) result.knockoutIntel = intel;
      }
    } catch (intelErr) {
      logger.warn('Knockout-intel build failed (non-fatal):', { error: intelErr.message });
    }

    if (persist) {
      try {
        savePredictionSnapshot(matchId, result);
      } catch (snapshotError) {
        logger.warn(`Prediction snapshot failed for ${matchId}:`, { error: snapshotError.message });
      }

      try {
        dbInstance.prepare(`
          INSERT INTO predictions (match_id, home_win_prob, draw_prob, away_win_prob, predicted_home_goals, predicted_away_goals, confidence, model_version, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          matchId,
          result.homeWin || result.homeWinProb || 0,
          result.draw || result.drawProb || 0,
          result.awayWin || result.awayWinProb || 0,
          result.goals?.homeExpected || result.expectedScore?.home || 0,
          result.goals?.awayExpected || result.expectedScore?.away || 0,
          result.components?.elo?.confidence || 0,
          result._fusion || 'v4',
        );
      } catch (predSaveErr) {
        logger.warn(`Prediction save failed for ${matchId}:`, { error: predSaveErr.message });
      }
    }

    if (!includeExternalOdds) setCache(predKey, result);
    return result;
  }

  // T15: Elo ranking logic (moved from routes/prediction.js)
  async getEloRankings() {
    const { getCached, setCache, RATINGS, getTeamNameZh, getTeamNameI18n, TEAM_FLAGS } = this.deps;
    const dbInstance = require('../db').db;

    const cached = getCached('elo_rankings', 600000);
    if (cached) return cached;

    // Prefer reading from SQLite
    try {
      const rows = dbInstance.prepare('SELECT team_id, team_name, rating FROM elo_ratings ORDER BY rating DESC').all();
      if (rows.length > 0) {
        const rankings = rows.map((r, i) => ({
          teamId: r.team_id,
          name: getTeamNameZh(r.team_id) || r.team_name,
          nameI18n: getTeamNameI18n ? getTeamNameI18n(r.team_id, r.team_name) : null,
          flag: TEAM_FLAGS[r.team_id] || '🏳️',
          rating: r.rating,
          rank: i + 1,
        }));
        setCache('elo_rankings', rankings);
        return rankings;
      }
    } catch (dbErr) {
      logger.warn('Elo rankings DB read failed, falling back to computation:', { error: dbErr.message });
    }

    // Fallback: in-memory computation
    const EloRating = require('../elo');
    const elo = new EloRating();
    const teams = {};
    for (const [id, team] of Object.entries(RATINGS.teams || {})) {
      if (team.rating) {
        teams[id] = { name: getTeamNameZh(id), nameI18n: getTeamNameI18n ? getTeamNameI18n(id, team.name) : null, flag: TEAM_FLAGS[id] || '🏳️', rating: team.rating };
      } else {
        const players = team.players || [];
        if (players.length > 0) {
          const avg = players.reduce((s, p) => s + (p.rating || 70), 0) / players.length;
          teams[id] = { name: getTeamNameZh(id), nameI18n: getTeamNameI18n ? getTeamNameI18n(id, team.name) : null, flag: TEAM_FLAGS[id] || '🏳️', rating: Math.round(avg * 10) + 1000 };
        }
      }
    }
    const rankings = elo.rankings(teams).map((row) => {
      const source = teams[row.teamId] || teams[row.name] || {};
      return {
        ...row,
        name: source.name || row.name,
        nameI18n: source.nameI18n || row.nameI18n || null,
        flag: source.flag || TEAM_FLAGS[row.teamId] || TEAM_FLAGS[row.name] || '🏳️',
      };
    });

    // T04: Remove DB write side-effects from public GET endpoint
    // Write operations should be handled by scheduled jobs or admin APIs, not during read operations

    setCache('elo_rankings', rankings);
    return rankings;
  }

  async getTeamElo(teamId) {
    const { RATINGS, getTeamNameZh, getTeamNameI18n, TEAM_FLAGS } = this.deps;
    const dbInstance = require('../db').db;
    const teamResolver = require('../team_resolver');

    // Prefer reading from DB
    try {
      const row = dbInstance.prepare('SELECT team_id, team_name, rating, peak_rating FROM elo_ratings WHERE team_id = ? OR team_name = ?').get(teamId, teamId);
      if (row) {
        const EloRating = require('../elo');
        const elo = new EloRating();
        return {
          teamId: row.team_id,
          requestedId: teamId,
          name: getTeamNameZh(row.team_id) || row.team_name,
          nameI18n: getTeamNameI18n ? getTeamNameI18n(row.team_id, row.team_name) : null,
          flag: TEAM_FLAGS[row.team_id] || TEAM_FLAGS[teamId] || '🏳️',
          rating: row.rating,
          peakRating: row.peak_rating,
          source: 'database',
          fifaEquiv: elo.initFromFifaRank(Math.max(1, Math.round((2100 - row.rating) / 12) + 1)),
        };
      }
    } catch { logger.warn('PredictionService.getTeamElo: DB lookup failed for', { detail: teamId }); }

    // Fallback
    const { ratingsId, team } = this.getRatingTeam(teamId);
    if (!team) return { error: 'Team not found' };

    const players = team.players || [];
    const avg = players.length ? players.reduce((s, p) => s + (p.rating || 70), 0) / players.length : null;
    const rating = team.rating || Math.round((avg || 70) * 10) + 1000;
    const EloRating = require('../elo');
    const elo = new EloRating();

    return {
      teamId: ratingsId,
      requestedId: teamId,
      name: getTeamNameZh(ratingsId),
      nameI18n: getTeamNameI18n ? getTeamNameI18n(ratingsId, team.name) : null,
      flag: TEAM_FLAGS[ratingsId] || TEAM_FLAGS[teamId] || '🏳️',
      rating,
      peakRating: rating,
      players: players.length,
      avgPlayerRating: avg == null ? null : Math.round(avg * 10) / 10,
      source: 'computed',
      fifaEquiv: elo.initFromFifaRank(Math.max(1, Math.round((2100 - rating) / 12) + 1)),
    };
  }

  // T15: Live prediction analysis (moved from routes/prediction.js)
  async predictLive(matchId, liveStats = {}) {
    const baseline = await this.predictMatch(matchId, {
      includeExternalOdds: true,
      bypassCache: true,
    });
    if (baseline?.error) return baseline;

    const liveAnalysis = PredictionService.buildLiveAnalysis(
      baseline,
      {
        homeName: baseline.match?.homeName || 'Home',
        awayName: baseline.match?.awayName || 'Away',
      },
      liveStats,
      baseline.externalOdds || null
    );

    return {
      matchId,
      match: baseline.match,
      predictionSource: baseline.externalOdds ? 'baseline_plus_odds' : 'baseline_only',
      externalOddsUsed: Boolean(baseline.externalOdds),
      baseline: {
        homeWin: baseline.homeWin,
        draw: baseline.draw,
        awayWin: baseline.awayWin,
        likelyScore: baseline.likelyScore,
        goals: baseline.goals,
      },
      externalOdds: baseline.externalOdds || null,
      liveAnalysis,
    };
  }

  // T15: Static helpers for live analysis (pure functions, no state)
  static _toNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  static _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static _normalizeThreeWay(homeWin, draw, awayWin) {
    const sum = homeWin + draw + awayWin;
    if (!sum || !Number.isFinite(sum)) {
      return { homeWin: 0.333, draw: 0.334, awayWin: 0.333 };
    }
    return {
      homeWin: Math.round((homeWin / sum) * 1000) / 1000,
      draw: Math.round((draw / sum) * 1000) / 1000,
      awayWin: Math.round((awayWin / sum) * 1000) / 1000,
    };
  }

  /**
   * C refactor: buildLiveAnalysis now delegates to reprice() (Track A canonical engine).
   *
   * Soft signals (shots/possession/yellows) and external odds are accepted for backwards
   * compatibility (the POST /api/predict-live admin endpoint still passes them), but they
   * NO LONGER change probability values. Only hard facts (score, time, red cards,
   * isKnockout) enter the Poisson matrix.
   *
   * The liveStats.stage field is used for server-authoritative isKnockout detection.
   * If unavailable, falls back to liveStats.isKnockout boolean.
   */
  static buildLiveAnalysis(basePrediction, matchMeta, liveStats = {}, _externalOdds = null) {
    const { reprice } = require('../live-reprice');
    const toNum = PredictionService._toNumber;
    const clamp = PredictionService._clamp;

    const minute = clamp(toNum(liveStats.minute) ?? 0, 0, 120);
    const homeScore = toNum(liveStats.homeScore) ?? 0;
    const awayScore = toNum(liveStats.awayScore) ?? 0;
    const homeRedCards = toNum(liveStats.homeRedCards) ?? 0;
    const awayRedCards = toNum(liveStats.awayRedCards) ?? 0;

    // isKnockout: server-authoritative (stage string), fallback to explicit boolean
    const stage = liveStats.stage ?? matchMeta?.stage ?? '';
    const isKnockout = stage ? !/group/i.test(stage) : Boolean(liveStats.isKnockout ?? false);

    const preLambdaHome = basePrediction.goals?.homeExpected
      ?? basePrediction.components?.poisson?.homeLambda
      ?? 1.2;
    const preLambdaAway = basePrediction.goals?.awayExpected
      ?? basePrediction.components?.poisson?.awayLambda
      ?? 1.0;

    const liveProb = reprice({
      preLambdaHome,
      preLambdaAway,
      homeScore,
      awayScore,
      minuteElapsed: minute,
      addedTime: toNum(liveStats.addedTime) ?? 0,
      homeRedCards,
      awayRedCards,
      isKnockout,
    });

    const scoreDiff = homeScore - awayScore;

    return {
      minute,
      score: { home: homeScore, away: awayScore },
      probabilities: {
        homeWin: liveProb.regulation.homeWin,
        draw:    liveProb.regulation.draw,
        awayWin: liveProb.regulation.awayWin,
      },
      regulation: liveProb.regulation,
      advance: liveProb.advance,
      expectedGoals: {
        home: Math.round(liveProb.lambdaHomeRemaining * 10) / 10,
        away: Math.round(liveProb.lambdaAwayRemaining * 10) / 10,
      },
      signals: {
        scoreDiff,
        shotDiff: 'ignored',
        shotsOnTargetDiff: 'ignored',
        possessionDiff: 'ignored',
        externalOddsUsed: false,
        note: 'C refactor: buildLiveAnalysis delegates to reprice(); soft signals and external odds no longer change probability.',
      },
      source: 'live_reprice',
      summary: {
        stateShift: scoreDiff >= 2 ? 'reinforced' : (scoreDiff !== 0 ? 'lean_reinforced' : 'still_live'),
        note: `${matchMeta.homeName} vs ${matchMeta.awayName} at ${minute}' — repriced via Track A reprice() (canonical Poisson engine).`,
      },
    };
  }
}

module.exports = PredictionService;
