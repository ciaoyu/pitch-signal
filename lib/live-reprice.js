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
 *   homeWin: number, draw: number, awayWin: number,
 *   homeWinAfterET: number, awayWinAfterET: number,
 *   penaltyHomeWin: number, penaltyAwayWin: number,
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
      homeWin: 0.333,
      draw: params?.isKnockout ? 0 : 0.334,
      awayWin: 0.333,
      homeWinAfterET: 0,
      awayWinAfterET: 0,
      penaltyHomeWin: 0,
      penaltyAwayWin: 0,
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
  const timeRatio = minutesRemaining / 90; // Relative to full 90 minutes

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

  // ── Probabilities of Three Outcomes After 90 Minutes ────────────────────────
  let homeWin = 0, draw = 0, awayWin = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = matrix[i][j];
      const finalHome = homeScore + i;
      const finalAway = awayScore + j;

      if (finalHome > finalAway) homeWin += p;
      else if (finalHome === finalAway) draw += p;
      else awayWin += p;
    }
  }

  // Normalize to prevent floating point errors
  const total90 = homeWin + draw + awayWin;
  homeWin /= total90;
  draw    /= total90;
  awayWin /= total90;

  // ── Extra Time (when knockout draw) ────────────────────────────────────────
  let homeWinAfterET  = 0;
  let awayWinAfterET  = 0;
  let penaltyHomeWin  = 0;
  let penaltyAwayWin  = 0;

  if (isKnockout && draw > 0) {
    const etResult = repriceExtraTime(
      preLambdaHome * homeFactor,
      preLambdaAway * awayFactor,
      penaltySkillHome,
      penaltySkillAway,
      maxGoals
    );

    // Distribute draw probability according to ET results
    homeWinAfterET = draw * etResult.homeWinInET;
    awayWinAfterET = draw * etResult.awayWinInET;
    penaltyHomeWin = draw * etResult.penaltyHomeWin;
    penaltyAwayWin = draw * etResult.penaltyAwayWin;

    // Final win probability (including extra time and penalties)
    homeWin += homeWinAfterET + penaltyHomeWin;
    awayWin += awayWinAfterET + penaltyAwayWin;
    draw     = 0; // Knockout matches have no final draw result
  }

  return {
    homeWin:   round3(homeWin),
    draw:      round3(isKnockout ? 0 : draw),
    awayWin:   round3(awayWin),
    homeWinAfterET:  round3(homeWinAfterET),
    awayWinAfterET:  round3(awayWinAfterET),
    penaltyHomeWin:  round3(penaltyHomeWin),
    penaltyAwayWin:  round3(penaltyAwayWin),
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
 * Compare pre-match snapshot and live probabilities, return probability drift summary
 * Used in moment records to store "how much this trigger point changed"
 */
function probDelta(prePred, liveProb) {
  return safeExecSync(() => ({
    deltaHomeWin: round3((liveProb.homeWin ?? 0) - (prePred.homeWin ?? prePred.homeWinProb ?? 0)),
    deltaDraw:    round3((liveProb.draw    ?? 0) - (prePred.draw    ?? prePred.drawProb    ?? 0)),
    deltaAwayWin: round3((liveProb.awayWin ?? 0) - (prePred.awayWin ?? prePred.awayWinProb ?? 0)),
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
