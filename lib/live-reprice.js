'use strict';

/**
 * Track A In-Play Repricing Engine
 *
 * Pure mathematics: only accepts known hard facts (score, time, red cards, squad strength).
 * Does not accept unverified soft signals (momentum, pressure index, etc.).
 *
 * Core formula:
 *   In remaining match time, goals scored by both sides still follow Poisson distribution,
 *   but λ is scaled by remaining time ratio and multiplied by red card penalty factor.
 *   Final:
 *     P(home wins) = sum_{i,j: homeScore+i > awayScore+j} P(home scores i more) * P(away scores j more)
 *
 * Extra time support:
 *   When isKnockout=true, draw leads to 30 minutes extra time (additional λ),
 *   if still draw after extra time then penalty shootout (50/50 by default, penaltySkill can be passed).
 *
 * Return shape (C refactor):
 *   regulation: { homeWin, draw, awayWin }          — 90-minute result probabilities
 *   advance:    { homeWin, awayWin,                 — final progression (null for group stage)
 *                 homeWinAfterET, awayWinAfterET,
 *                 penaltyHomeWin, penaltyAwayWin }
 *
 * Deprecated top-level flat fields kept for transition:
 *   homeWin, draw, awayWin — now equal to regulation (no longer merged with advance)
 */

const PoissonModel = require('./poisson');
const { safeExecSync, loggers } = require('./logger');

const poisson = new PoissonModel();

// Red card penalty factor on attacking λ (based on historical data: 10-man team scoring rate drops to approx 72%)
const RED_CARD_LAMBDA_FACTOR = 0.72;

// Extra time duration (minutes)
const EXTRA_TIME_MINUTES = 30;

/**
 * Main function: given current match state, returns updated probabilities
 *
 * @param {object} params
 * @param {number} params.preLambdaHome     Pre-match home λ (90 mins)
 * @param {number} params.preLambdaAway     Pre-match away λ (90 mins)
 * @param {number} params.homeScore         Current home score
 * @param {number} params.awayScore         Current away score
 * @param {number} params.minuteElapsed     Elapsed time (0-90+)
 * @param {number} [params.addedTime=0]     Added time minutes (passed when known)
 * @param {number} [params.homeRedCards=0]  Home red cards count
 * @param {number} [params.awayRedCards=0]  Away red cards count
 * @param {boolean}[params.isKnockout=false] Whether knockout match (draw -> extra time -> penalties)
 * @param {number} [params.penaltySkillHome=0.5] Home penalty shootout win probability
 * @param {number} [params.penaltySkillAway=0.5] Away penalty shootout win probability
 * @param {number} [params.maxGoals=6]
 *
 * @returns {{
 *   regulation:          { homeWin: number, draw: number, awayWin: number },
 *   advance:             { homeWin: number, awayWin: number,
 *                          homeWinAfterET: number, awayWinAfterET: number,
 *                          penaltyHomeWin: number, penaltyAwayWin: number } | null,
 *   isKnockout:          boolean,
 *   lambdaHomeRemaining: number, lambdaAwayRemaining: number,
 *   minuteElapsed: number, minutesRemaining: number,
 *   source: 'live_reprice'
 * }}
 */
function reprice(params = {}) {
  return safeExecSync(() => _repriceCalc(params), {
    jobName: 'live-reprice',
    matchId: params?.matchId || null,
    source: 'live_reprice',
    stage: 'reprice_calc',
    reason: 'reprice_calculation_error',
    fallback: {
      regulation: { homeWin: 0.333, draw: 0.334, awayWin: 0.333 },
      advance: params?.isKnockout
        ? { homeWin: 0.5, awayWin: 0.5, homeWinAfterET: 0, awayWinAfterET: 0, penaltyHomeWin: 0, penaltyAwayWin: 0 }
        : null,
      isKnockout: params?.isKnockout ?? false,
      lambdaHomeRemaining: params?.preLambdaHome || 1.2,
      lambdaAwayRemaining: params?.preLambdaAway || 1.0,
      minuteElapsed: params?.minuteElapsed || 0,
      minutesRemaining: Math.max(0, 90 - (params?.minuteElapsed || 0)),
      source: 'live_reprice',
    }
  }, loggers.liveReprice);
}

function _repriceCalc(params) {
  const {
    preLambdaHome,
    preLambdaAway,
    homeScore = 0,
    awayScore = 0,
    minuteElapsed = 0,
    addedTime = 0,
    homeRedCards = 0,
    awayRedCards = 0,
    isKnockout = false,
    penaltySkillHome = 0.5,
    penaltySkillAway = 0.5,
    maxGoals = 6,
  } = params;

  // ── Remaining Time ─────────────────────────────────────────────────────────
  const totalMinutes = 90 + addedTime;
  const elapsed = Math.min(minuteElapsed, totalMinutes);
  const minutesRemaining = Math.max(0, totalMinutes - elapsed);
  // W1-B (§1.3): pre-match λ is calibrated for a regular 90-minute match.
  // With long added time, totalMinutes > 90 so minutesRemaining/90 can exceed 1.0
  // at kickoff and inflate the remaining λ above the pre-match baseline.
  // Cap the ratio at 1.0 so the live λ never exceeds the pre-match expectation.
  const timeRatio = Math.min(1, minutesRemaining / 90); // Relative to full 90 minutes

  // ── Red Card Penalty ───────────────────────────────────────────────────────
  // Exponential penalty for multiple red cards, rarely seen in practice
  const homeFactor = Math.pow(RED_CARD_LAMBDA_FACTOR, homeRedCards);
  const awayFactor = Math.pow(RED_CARD_LAMBDA_FACTOR, awayRedCards);

  // ── Remaining λ ────────────────────────────────────────────────────────────
  const lambdaHomeRemaining = preLambdaHome * timeRatio * homeFactor;
  const lambdaAwayRemaining = preLambdaAway * timeRatio * awayFactor;

  // ── Additional Goals Probability Matrix (Future) ───────────────────────────
  const matrix = poisson.goalProbabilityMatrix(
    lambdaHomeRemaining,
    lambdaAwayRemaining,
    maxGoals
  );

  // ── Regulation (90 minutes) probabilities ──────────────────────────────────
  let regHomeWin = 0, regDraw = 0, regAwayWin = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = matrix[i][j];
      const finalHome = homeScore + i;
      const finalAway = awayScore + j;

      if (finalHome > finalAway) regHomeWin += p;
      else if (finalHome === finalAway) regDraw += p;
      else regAwayWin += p;
    }
  }

  // Normalize regulation
  const total90 = regHomeWin + regDraw + regAwayWin;
  regHomeWin /= total90;
  regDraw    /= total90;
  regAwayWin /= total90;

  // ── Advance (extra time + penalties) — only for knockout ──────────────────
  let advanceResult = null;

  if (isKnockout && regDraw > 0) {
    const etResult = repriceExtraTime(
      preLambdaHome * homeFactor,
      preLambdaAway * awayFactor,
      penaltySkillHome,
      penaltySkillAway,
      maxGoals
    );

    const homeWinAfterET  = regDraw * etResult.homeWinInET;
    const awayWinAfterET  = regDraw * etResult.awayWinInET;
    const penaltyHomeWin  = regDraw * etResult.penaltyHomeWin;
    const penaltyAwayWin  = regDraw * etResult.penaltyAwayWin;

    // Final advance probability = regulation win + extra-time win + penalty win
    const advanceHome = regHomeWin + homeWinAfterET + penaltyHomeWin;
    const advanceAway = regAwayWin + awayWinAfterET + penaltyAwayWin;

    advanceResult = {
      homeWin:         round3(advanceHome),
      awayWin:         round3(advanceAway),
      homeWinAfterET:  round3(homeWinAfterET),
      awayWinAfterET:  round3(awayWinAfterET),
      penaltyHomeWin:  round3(penaltyHomeWin),
      penaltyAwayWin:  round3(penaltyAwayWin),
    };
  }

  const regulation = {
    homeWin: round3(regHomeWin),
    draw:    round3(regDraw),
    awayWin: round3(regAwayWin),
  };

  return {
    // Canonical fields (C refactor)
    regulation,
    advance: advanceResult,
    isKnockout,

    // Deprecated top-level flat fields for transition compatibility.
    // Consumers should migrate to regulation.* / advance.*
    homeWin:   regulation.homeWin,
    draw:      regulation.draw,
    awayWin:   regulation.awayWin,
    homeWinAfterET:  advanceResult?.homeWinAfterET ?? 0,
    awayWinAfterET:  advanceResult?.awayWinAfterET ?? 0,
    penaltyHomeWin:  advanceResult?.penaltyHomeWin ?? 0,
    penaltyAwayWin:  advanceResult?.penaltyAwayWin ?? 0,

    // Metadata
    lambdaHomeRemaining: round3(lambdaHomeRemaining),
    lambdaAwayRemaining: round3(lambdaAwayRemaining),
    minuteElapsed: elapsed,
    minutesRemaining,
    source: 'live_reprice',
  };
}

/**
 * Probability breakdown after extra time (30 minutes)
 */
function repriceExtraTime(lambdaHome90, lambdaAway90, penHome, penAway, maxGoals) {
  return safeExecSync(() => _repriceExtraTimeCalc(lambdaHome90, lambdaAway90, penHome, penAway, maxGoals), {
    jobName: 'live-reprice',
    source: 'live_reprice',
    stage: 'reprice_extra_time',
    reason: 'extra_time_reprice_error',
    fallback: { homeWinInET: 0, awayWinInET: 0, penaltyHomeWin: 0, penaltyAwayWin: 0 }
  }, loggers.liveReprice);
}

function _repriceExtraTimeCalc(lambdaHome90, lambdaAway90, penHome, penAway, maxGoals) {
  const etRatio = EXTRA_TIME_MINUTES / 90;
  const etLambdaHome = lambdaHome90 * etRatio;
  const etLambdaAway = lambdaAway90 * etRatio;

  const matrix = poisson.goalProbabilityMatrix(etLambdaHome, etLambdaAway, maxGoals);

  let homeWinInET = 0, awayWinInET = 0, drawAfterET = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = matrix[i][j];
      if (i > j) homeWinInET += p;
      else if (i < j) awayWinInET += p;
      else drawAfterET += p;
    }
  }

  // Penalty shootout
  const penaltyHomeWin = drawAfterET * penHome;
  const penaltyAwayWin = drawAfterET * penAway;

  return { homeWinInET, awayWinInET, penaltyHomeWin, penaltyAwayWin };
}

/**
 * Compare pre-match snapshot and live probabilities, return probability drift summary.
 * Updated for C refactor: uses regulation fields when available.
 */
function probDelta(prePred, liveProb) {
  return safeExecSync(() => ({
    deltaHomeWin: round3((liveProb.regulation?.homeWin ?? liveProb.homeWin ?? 0)
                        - (prePred.homeWin ?? prePred.homeWinProb ?? 0)),
    deltaDraw:    round3((liveProb.regulation?.draw ?? liveProb.draw ?? 0)
                        - (prePred.draw ?? prePred.drawProb ?? 0)),
    deltaAwayWin: round3((liveProb.regulation?.awayWin ?? liveProb.awayWin ?? 0)
                        - (prePred.awayWin ?? prePred.awayWinProb ?? 0)),
  }), {
    jobName: 'live-reprice',
    source: 'live_reprice',
    stage: 'prob_delta_calc',
    reason: 'prob_delta_calculation_error',
    fallback: { deltaHomeWin: 0, deltaDraw: 0, deltaAwayWin: 0 }
  }, loggers.liveReprice);
}

function round3(n) {
  return Math.round((n ?? 0) * 1000) / 1000;
}

module.exports = { reprice, repriceExtraTime, probDelta };
