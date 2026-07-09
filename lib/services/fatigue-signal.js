'use strict';

/**
 * Fatigue index signal (KO-5)
 *
 * Computes a match-level fatigue signal for knockout fixtures using the KO-1
 * shared infrastructure: rest days (schedule-lookup), previous-match ET status
 * (matches.went_to_et), and travel distance between venues (venue-distance).
 *
 * Design constraints from knockout-intel-plan:
 *   - Hard-bounded probability tilt: max ±2.5% per outcome.
 *   - Neutral + confidence 0 when input data is missing.
 *   - No player-level minute modeling; match-level ET burden only.
 *   - usedInModel: true; weight is a documented tunable parameter.
 *
 * The signal is passed into prediction.js as the 8th signal (mirroring
 * continentalStrength) and is also exposed as the knockout-intel `fatigue` section.
 */

const { previousMatch, restDaysBeforeMatch, travelKmToMatch } = require('./schedule-lookup');
const teamResolver = require('../team_resolver');

const DEFAULT_PARAMS = Object.freeze({
  // Tunable model weight (also shown in the intel section as signalApplied.weight).
  weight: 0.04,
  // Component weights for the composite fatigue score.
  restWeight: 0.35,
  etWeight: 0.35,
  travelWeight: 0.10,
  baseline: 0.20,
  // Rest-day scoring: 2 days => max fatigue, 5 days => rested.
  minRestDays: 2,
  maxRestDays: 5,
  // Travel scoring: 0 km => none, 4000 km => max.
  maxTravelKm: 4000,
  // Hard probability-displacement cap (±2.5%).
  maxTilt: 0.025,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeProbs(home, draw, away) {
  const total = home + draw + away;
  if (total === 0) return { home: 0.33, draw: 0.34, away: 0.33 };
  return {
    home: Math.round((home / total) * 10000) / 10000,
    draw: Math.round((draw / total) * 10000) / 10000,
    away: Math.round((away / total) * 10000) / 10000,
  };
}

function restScore(restDays, opts) {
  if (restDays == null || restDays === 0) return 0;
  if (restDays >= opts.maxRestDays) return 0;
  if (restDays <= opts.minRestDays) return 1;
  return (opts.maxRestDays - restDays) / (opts.maxRestDays - opts.minRestDays);
}

function travelScore(travelKm, opts) {
  if (travelKm == null || travelKm <= 0) return 0;
  return clamp(travelKm / opts.maxTravelKm, 0, 1);
}

function lookupPreviousMatchStatus(prevMatch, db) {
  if (!db || !prevMatch) return null;
  try {
    const homeRid = teamResolver.getRatingsIdByEspnId(prevMatch.homeId);
    const awayRid = teamResolver.getRatingsIdByEspnId(prevMatch.awayId);
    if (!homeRid || !awayRid) return null;
    const row = db.prepare(`
      SELECT went_to_et, decided_by_pens
      FROM matches
      WHERE (home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?)
      LIMIT 1
    `).get(homeRid, awayRid, awayRid, homeRid);
    return row || null;
  } catch (_) {
    return null;
  }
}

function computeTeamFatigue({ matchId, teamId, db, options }) {
  const prev = previousMatch(matchId, teamId);
  if (!prev) return null; // No previous match in this tournament -> no fatigue signal.

  const restDays = restDaysBeforeMatch(matchId, teamId);
  const travelKm = travelKmToMatch(matchId, teamId);
  const status = lookupPreviousMatchStatus(prev, db);
  const prevWentToEt = status ? status.went_to_et === 1 : null;
  // Match-level approximation: 30 minutes of extra-time burden (no player minutes).
  const cumEtMinutes = prevWentToEt ? 30 : 0;

  const dataAvailable = restDays != null && prevWentToEt != null;

  const rScore = restScore(restDays, options);
  const etScore = prevWentToEt ? 1 : 0;
  const tScore = travelScore(travelKm, options);
  const score = options.baseline
    + rScore * options.restWeight
    + etScore * options.etWeight
    + tScore * options.travelWeight;

  return {
    restDays,
    prevWentToEt: prevWentToEt === true,
    cumEtMinutes,
    travelKm,
    score: Math.round(score * 1000) / 1000,
    dataAvailable,
  };
}

function confidenceLabel(n) {
  if (n >= 0.7) return 'high';
  if (n >= 0.4) return 'medium';
  return 'low';
}

/**
 * Build the fatigue signal.
 *
 * @param {object} params - { matchId, homeId, awayId, db }
 * @param {object} [options] - tunable parameters (DEFAULT_PARAMS is merged in)
 * @returns {object|null} Signal object for the engine + section, or null if no
 *                        previous match exists for either team.
 */
function buildSignal(params, options = {}) {
  const { matchId, homeId, awayId, db } = params || {};
  if (!matchId || !homeId || !awayId) return null;

  const opts = { ...DEFAULT_PARAMS, ...options };

  const home = computeTeamFatigue({ matchId, teamId: homeId, db, options: opts });
  const away = computeTeamFatigue({ matchId, teamId: awayId, db, options: opts });
  if (!home || !away) return null;

  const dataAvailable = home.dataAvailable && away.dataAvailable;

  // Differential: positive => home more fatigued => reduce home probability.
  const differential = home.score - away.score;
  const tilt = dataAvailable
    ? clamp(differential * opts.maxTilt, -opts.maxTilt, opts.maxTilt)
    : 0;

  const probs = normalizeProbs(0.33 - tilt, 0.34, 0.33 + tilt);
  const confidence = dataAvailable ? 0.75 : 0.0;

  return {
    // Engine-facing probability vector (mirrors continentalStrength).
    home: probs.home,
    draw: probs.draw,
    away: probs.away,
    confidence,

    // Section-facing raw components and applied direction.
    homeTeam: home,
    awayTeam: away,
    differential: Math.round(differential * 1000) / 1000,
    signalApplied: {
      weight: opts.weight,
      tilt: {
        home: Math.round(-tilt * 10000) / 10000,
        draw: 0,
        away: Math.round(tilt * 10000) / 10000,
      },
    },
    source: 'schedule+venues',
    usedInModel: true,
  };
}

/**
 * Build the knockout-intel `fatigue` section.
 * @param {object} ctx - knockout-intel context { matchId, homeTeamId, awayTeamId, db }
 */
function buildFatigueSection(ctx = {}) {
  const sig = buildSignal({
    matchId: ctx.matchId,
    homeId: ctx.homeTeamId,
    awayId: ctx.awayTeamId,
    db: ctx.db,
  });
  if (!sig) return null;

  return {
    confidence: confidenceLabel(sig.confidence),
    source: sig.source,
    usedInModel: sig.usedInModel,
    home: {
      restDays: sig.homeTeam.restDays,
      prevWentToEt: sig.homeTeam.prevWentToEt,
      cumEtMinutes: sig.homeTeam.cumEtMinutes,
      travelKm: sig.homeTeam.travelKm,
      score: sig.homeTeam.score,
    },
    away: {
      restDays: sig.awayTeam.restDays,
      prevWentToEt: sig.awayTeam.prevWentToEt,
      cumEtMinutes: sig.awayTeam.cumEtMinutes,
      travelKm: sig.awayTeam.travelKm,
      score: sig.awayTeam.score,
    },
    differential: sig.differential,
    signalApplied: sig.signalApplied,
  };
}

module.exports = {
  DEFAULT_PARAMS,
  buildSignal,
  buildFatigueSection,
  computeTeamFatigue,
  restScore,
  travelScore,
};
