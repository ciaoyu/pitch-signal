'use strict';

/**
 * Track A 盘中重定价引擎
 *
 * 纯数学：只接受已知硬事实（比分、时间、红牌、阵容强度）。
 * 不接受未经验证的软信号（动量、压力指数等）。
 *
 * 核心公式：
 *   剩余比赛时间里，双方进球数仍服从 Poisson 分布，
 *   但 λ 按剩余时间比例缩放，并乘以红牌惩罚系数。
 *   最终：
 *     P(home wins) = sum_{i,j: homeScore+i > awayScore+j} P(home scores i more) * P(away scores j more)
 *
 * 加时赛支持：
 *   isKnockout=true 时，平局后进入 30 分钟加时（额外 λ），
 *   加时后仍平则点球大战（50/50 by default，可传 penaltySkill）。
 */

const PoissonModel = require('./poisson');

const poisson = new PoissonModel();

// 红牌对进攻 λ 的惩罚系数（基于历史数据：10人队进球率约降至 72%）
const RED_CARD_LAMBDA_FACTOR = 0.72;

// 加时赛时长（分钟）
const EXTRA_TIME_MINUTES = 30;

/**
 * 主函数：给定当前比赛状态，返回更新后的概率
 *
 * @param {object} params
 * @param {number} params.preLambdaHome     赛前主队 λ（90分钟）
 * @param {number} params.preLambdaAway     赛前客队 λ（90分钟）
 * @param {number} params.homeScore         当前主队比分
 * @param {number} params.awayScore         当前客队比分
 * @param {number} params.minuteElapsed     已过时间（0-90+）
 * @param {number} [params.addedTime=0]     补时分钟数（已知时传入）
 * @param {number} [params.homeRedCards=0]  主队红牌数
 * @param {number} [params.awayRedCards=0]  客队红牌数
 * @param {boolean}[params.isKnockout=false] 是否淘汰赛（平局→加时→点球）
 * @param {number} [params.penaltySkillHome=0.5] 主队点球大战胜率
 * @param {number} [params.penaltySkillAway=0.5] 客队点球大战胜率
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
function reprice(params) {
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

  // ── 剩余时间 ──────────────────────────────────────────────────────────────
  const totalMinutes = 90 + addedTime;
  const elapsed = Math.min(minuteElapsed, totalMinutes);
  const minutesRemaining = Math.max(0, totalMinutes - elapsed);
  const timeRatio = minutesRemaining / 90; // 相对于完整 90 分钟

  // ── 红牌惩罚 ─────────────────────────────────────────────────────────────
  // 多张红牌时指数惩罚，实际上很少见
  const homeFactor = Math.pow(RED_CARD_LAMBDA_FACTOR, homeRedCards);
  const awayFactor = Math.pow(RED_CARD_LAMBDA_FACTOR, awayRedCards);

  // ── 剩余 λ ───────────────────────────────────────────────────────────────
  const lambdaHomeRemaining = preLambdaHome * timeRatio * homeFactor;
  const lambdaAwayRemaining = preLambdaAway * timeRatio * awayFactor;

  // ── 额外进球的概率矩阵（未来） ────────────────────────────────────────────
  const matrix = poisson.goalProbabilityMatrix(
    lambdaHomeRemaining,
    lambdaAwayRemaining,
    maxGoals
  );

  // ── 90 分钟后三种结果概率 ─────────────────────────────────────────────────
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

  // 归一化防浮点误差
  const total90 = homeWin + draw + awayWin;
  homeWin /= total90;
  draw    /= total90;
  awayWin /= total90;

  // ── 加时赛（淘汰赛平局时）────────────────────────────────────────────────
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

    // draw 的概率按 ET 结果分配
    homeWinAfterET = draw * etResult.homeWinInET;
    awayWinAfterET = draw * etResult.awayWinInET;
    penaltyHomeWin = draw * etResult.penaltyHomeWin;
    penaltyAwayWin = draw * etResult.penaltyAwayWin;

    // 最终胜率（含加时和点球）
    homeWin += homeWinAfterET + penaltyHomeWin;
    awayWin += awayWinAfterET + penaltyAwayWin;
    draw     = 0; // 淘汰赛不存在平局最终结果
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
 * 加时赛（30 分钟）后的概率拆解
 */
function repriceExtraTime(lambdaHome90, lambdaAway90, penHome, penAway, maxGoals) {
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

  // 点球大战
  const penaltyHomeWin = drawAfterET * penHome;
  const penaltyAwayWin = drawAfterET * penAway;

  return { homeWinInET, awayWinInET, penaltyHomeWin, penaltyAwayWin };
}

/**
 * 比较赛前快照和盘中概率，返回概率漂移摘要
 * 用于 moment 记录里存"这个触发点改变了多少"
 */
function probDelta(prePred, liveProb) {
  return {
    deltaHomeWin: round3((liveProb.homeWin ?? 0) - (prePred.homeWin ?? prePred.homeWinProb ?? 0)),
    deltaDraw:    round3((liveProb.draw    ?? 0) - (prePred.draw    ?? prePred.drawProb    ?? 0)),
    deltaAwayWin: round3((liveProb.awayWin ?? 0) - (prePred.awayWin ?? prePred.awayWinProb ?? 0)),
  };
}

function round3(n) {
  return Math.round((n ?? 0) * 1000) / 1000;
}

module.exports = { reprice, repriceExtraTime, probDelta };
