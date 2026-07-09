/**
 * Match Review & Prediction Bias Analysis Engine
 * After each match ends, provides:
 * 1. Match summary (process + key moments)
 * 2. Bias analysis of AI prediction vs actual result
 */
const fs = require('fs');
const path = require('path');

class MatchReviewEngine {
  constructor(options = {}) {
    this.predictionEngine = options.predictionEngine || null;
    
    // Load team ratings
    try {
      this.ratings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ratings.json'), 'utf8')).teams;
    } catch (e) { this.ratings = {}; }

    // Team name mapping
    try {
      this.teamNamesZh = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'team_names_zh.json'), 'utf8'));
    } catch (e) { this.teamNamesZh = {}; }

    // Bias analysis impact factors definition
    this.biasFactors = {
      elo_gap: 'Elo 实力差',           // Elo gap vs actual score
      home_advantage: '主场优势',       // Actual home advantage higher/lower than model expectation
      form_vs_rating: '近期状态 vs 历史能力', // Team recent performance deviates from long-term Elo
      upset_factor: '爆冷系数',        // Underdog win / draw against favorite
      scoreline_variance: '比分方差',   // Degree to which actual goals deviate from expected goals
      defensive_collapse: '防守崩溃',   // Goals conceded far exceed opponent average goals conceded
      attacking_boom: '进攻爆发',       // Goals scored far exceed opponent average goals conceded
    };
  }

  getTeamName(teamId) {
    const zh = this.teamNamesZh[teamId];
    return zh ? `${zh.zh} ${zh.en}` : teamId;
  }

  getTeamNameI18n(teamId) {
    const zh = this.teamNamesZh[teamId];
    const en = zh?.en || String(teamId || '');
    return {
      zh: zh?.zh || en,
      en,
    };
  }

  i18n(zh, en) {
    return { zh, en };
  }

  resultLabelI18n(result, homeName, awayName, homeNameEn, awayNameEn) {
    if (result === 'home') return this.i18n(`${homeName}胜`, `${homeNameEn} win`);
    if (result === 'away') return this.i18n(`${awayName}胜`, `${awayNameEn} win`);
    if (result === 'draw') return this.i18n('平局', 'draw');
    return this.i18n('未知', 'unknown');
  }

  getTeamRating(teamId) {
    return this.ratings[teamId] || { rating: 1500, attack_strength: 1.0, defense_strength: 1.0 };
  }

  /**
   * Generate match review report
   * @param {object} matchData - { homeId, awayId, homeScore, awayScore, group, matchDate, venue, events? }
   * @returns {object} Full match review
   */
  generateReview(matchData) {
    const { homeId, awayId, homeScore, awayScore, group, matchDate, venue } = matchData;

    // ========== 1. AI Prediction ==========
    const homeRating = this.getTeamRating(homeId);
    const awayRating = this.getTeamRating(awayId);

    let prediction = null;
    if (this.predictionEngine) {
      prediction = this.predictionEngine.predict({
        homeId, awayId,
        homeRating, awayRating,
        venue: venue ? { name: venue } : undefined,
      });
    }

    // ========== 2. Match Summary ==========
    const summary = this.generateMatchSummary(matchData, homeRating, awayRating, prediction);

    // ========== 3. Bias Analysis ==========
    const biasAnalysis = this.analyzeBias(matchData, homeRating, awayRating, prediction);

    // ========== 4. Rating Changes ==========
    const eloChange = this.calculateEloChange(matchData, homeRating, awayRating, prediction);

    // ========== 5. Key Events ==========
    const keyEvents = matchData.events || this.generateDefaultEvents(matchData);

    return {
      match: {
        home: { id: homeId, name: this.getTeamName(homeId), score: homeScore },
        away: { id: awayId, name: this.getTeamName(awayId), score: awayScore },
        group,
        date: matchDate,
        venue: venue || 'TBD',
        result: homeScore > awayScore ? 'home' : (homeScore < awayScore ? 'away' : 'draw'),
        goalDiff: homeScore - awayScore,
      },
      aiPrediction: prediction ? {
        homeWin: Math.round(prediction.homeWin * 1000) / 10,
        draw: Math.round(prediction.draw * 1000) / 10,
        awayWin: Math.round(prediction.awayWin * 1000) / 10,
        predictedScore: prediction.likelyScore,
        predictedGoalDiff: Math.round((prediction.goals.homeExpected - prediction.goals.awayExpected) * 10) / 10,
        homeExpectedGoals: Math.round(prediction.goals.homeExpected * 10) / 10,
        awayExpectedGoals: Math.round(prediction.goals.awayExpected * 10) / 10,
        weights: prediction.weights,
        poissonValid: prediction.components.poisson.valid,
        eloComponent: prediction.components.elo,
      } : null,
      matchSummary: summary,
      biasAnalysis,
      eloChange,
      keyEvents,
    };
  }

  /**
   * Match summary - based on data and statistics
   */
  generateMatchSummary(matchData, homeRating, awayRating, prediction) {
    const { homeId, awayId, homeScore, awayScore } = matchData;
    const homeName = this.getTeamName(homeId);
    const awayName = this.getTeamName(awayId);
    const homeNameEn = this.getTeamNameI18n(homeId).en;
    const awayNameEn = this.getTeamNameI18n(awayId).en;

    const goalDiff = homeScore - awayScore;
    const totalGoals = homeScore + awayScore;

    // Match type
    let matchTypeKey = 'normal';
    if (totalGoals >= 5) matchTypeKey = 'goal_fest';
    else if (totalGoals === 0) matchTypeKey = 'defensive_draw';
    else if (goalDiff >= 3) matchTypeKey = 'dominant_win';
    else if (goalDiff <= -3) matchTypeKey = 'heavy_defeat';
    else if (Math.abs(goalDiff) === 0) matchTypeKey = 'tight_draw';
    const matchTypeMap = {
      normal: this.i18n('普通比赛', 'Normal match'),
      goal_fest: this.i18n('进球大战', 'Goal fest'),
      defensive_draw: this.i18n('防守大战（0-0）', 'Defensive battle (0-0)'),
      dominant_win: this.i18n('碾压大胜', 'Dominant win'),
      heavy_defeat: this.i18n('惨败', 'Heavy defeat'),
      tight_draw: this.i18n('胶着平局', 'Tight draw'),
    };
    const matchTypeI18n = matchTypeMap[matchTypeKey];
    const matchType = matchTypeI18n.zh;

    // Strong vs weak matchup
    const eloDiff = (homeRating?.rating || 1500) - (awayRating?.rating || 1500);
    let upsetText = '';
    let upsetTextI18n = null;
    if (homeScore > awayScore && eloDiff < -50) {
      upsetText = `${homeName}以弱胜强！Elo 评分低于对手 ${Math.abs(Math.round(eloDiff))} 分的情况下取胜。`;
      upsetTextI18n = this.i18n(upsetText, `${homeNameEn} upset a stronger opponent despite being ${Math.abs(Math.round(eloDiff))} Elo points lower.`);
    } else if (awayScore > homeScore && eloDiff > 50) {
      upsetText = `${awayName}以弱胜强！Elo 评分低于对手 ${Math.abs(Math.round(eloDiff))} 分的情况下取胜。`;
      upsetTextI18n = this.i18n(upsetText, `${awayNameEn} upset a stronger opponent despite being ${Math.abs(Math.round(eloDiff))} Elo points lower.`);
    } else if (homeScore === awayScore && Math.abs(eloDiff) > 100) {
      upsetText = `尽管双方 Elo 相差 ${Math.abs(Math.round(eloDiff))} 分，最终仍战平。`;
      upsetTextI18n = this.i18n(upsetText, `The teams drew despite a ${Math.abs(Math.round(eloDiff))}-point Elo gap.`);
    }

    // Attack / defense analysis
    const homeAvgGF = homeRating?.avgGF || 1.0;
    const homeAvgGA = homeRating?.avgGA || 1.0;
    const awayAvgGF = awayRating?.avgGF || 1.0;
    const awayAvgGA = awayRating?.avgGA || 1.0;

    let homeAttackNote = '';
    let homeAttackNoteEn = '';
    if (homeScore > homeAvgGF * 1.5) {
      homeAttackNote = `${homeName}打进 ${homeScore} 球，远超其历史场均 ${homeAvgGF} 球，进攻表现超出预期。`;
      homeAttackNoteEn = `${homeNameEn} scored ${homeScore}, well above its historical average of ${homeAvgGF}, so the attack beat expectations.`;
    } else if (homeScore < homeAvgGF * 0.5) {
      homeAttackNote = `${homeName}仅进 ${homeScore} 球，低于历史场均 ${homeAvgGF} 球，进攻受阻。`;
      homeAttackNoteEn = `${homeNameEn} scored only ${homeScore}, below its historical average of ${homeAvgGF}, so the attack was contained.`;
    }

    let awayAttackNote = '';
    let awayAttackNoteEn = '';
    if (awayScore > awayAvgGF * 1.5) {
      awayAttackNote = `${awayName}打进 ${awayScore} 球，远超其历史场均 ${awayAvgGF} 球。`;
      awayAttackNoteEn = `${awayNameEn} scored ${awayScore}, well above its historical average of ${awayAvgGF}.`;
    }

    let homeDefenseNote = '';
    let homeDefenseNoteEn = '';
    if (awayScore > homeAvgGA * 1.5) {
      homeDefenseNote = `${homeName}失 ${awayScore} 球，远超其场均失球 ${homeAvgGA}，防守出现漏洞。`;
      homeDefenseNoteEn = `${homeNameEn} conceded ${awayScore}, far above its average of ${homeAvgGA}, exposing defensive gaps.`;
    } else if (awayScore < homeAvgGA * 0.5 && homeScore > awayScore) {
      homeDefenseNote = `${homeName}防守稳固，仅失 ${awayScore} 球（场均 ${homeAvgGA}）。`;
      homeDefenseNoteEn = `${homeNameEn} defended well, conceding only ${awayScore} against an average of ${homeAvgGA}.`;
    }

    const notes = [homeAttackNote, awayAttackNote, homeDefenseNote].filter(Boolean).join(' ');
    const notesEn = [homeAttackNoteEn, awayAttackNoteEn, homeDefenseNoteEn].filter(Boolean).join(' ');
    const overview = `${matchType} — ${homeName} ${homeScore}-${awayScore} ${awayName}。${notes}`;

    return {
      matchTypeKey,
      matchType,
      matchTypeI18n,
      overview,
      overviewI18n: this.i18n(overview, `${matchTypeI18n.en} - ${homeNameEn} ${homeScore}-${awayScore} ${awayNameEn}. ${notesEn}`.trim()),
      upsetText,
      upsetTextI18n,
      stats: {
        totalGoals,
        homeAvgGF, homeAvgGA, awayAvgGF, awayAvgGA,
        eloDiff: Math.round(eloDiff),
      },
    };
  }

  /**
   * Bias analysis of AI prediction vs actual result
   */
  analyzeBias(matchData, homeRating, awayRating, prediction) {
    const { homeId, awayId, homeScore, awayScore } = matchData;
    const homeName = this.getTeamName(homeId);
    const awayName = this.getTeamName(awayId);
    const homeNameEn = this.getTeamNameI18n(homeId).en;
    const awayNameEn = this.getTeamNameI18n(awayId).en;

    // Actual result encoding
    let actualResult;
    if (homeScore > awayScore) actualResult = 'home';
    else if (homeScore < awayScore) actualResult = 'away';
    else actualResult = 'draw';

    // Predicted result
    let predictedResult;
    let predictedConfidence = 0;
    if (prediction) {
      if (prediction.homeWin > prediction.draw && prediction.homeWin > prediction.awayWin) {
        predictedResult = 'home';
        predictedConfidence = prediction.homeWin;
      } else if (prediction.awayWin > prediction.draw && prediction.awayWin > prediction.homeWin) {
        predictedResult = 'away';
        predictedConfidence = prediction.awayWin;
      } else {
        predictedResult = 'draw';
        predictedConfidence = prediction.draw;
      }
    }

    // Whether predicted result is correct
    const resultCorrect = predictedResult === actualResult;

    // Score bias
    const predictedHomeG = prediction?.goals?.homeExpected || 1.5;
    const predictedAwayG = prediction?.goals?.awayExpected || 1.5;
    const homeGoalError = homeScore - predictedHomeG;
    const awayGoalError = awayScore - predictedAwayG;
    const goalDiffActual = homeScore - awayScore;
    const goalDiffPredicted = predictedHomeG - predictedAwayG;
    const goalDiffError = goalDiffActual - goalDiffPredicted;

    // Bias factors analysis
    const factors = [];

    // 1. Elo bias - if underdog won/drew against favorite
    const eloDiff = (homeRating?.rating || 1500) - (awayRating?.rating || 1500);
    if ((resultCorrect === false) && Math.abs(eloDiff) > 60) {
      factors.push({
        key: 'elo_gap',
        factor: this.biasFactors.elo_gap,
        factorI18n: this.i18n(this.biasFactors.elo_gap, 'Elo strength gap'),
        detail: `Elo 差距 ${Math.abs(Math.round(eloDiff))} 分未能反映在结果中。${
          (eloDiff > 0 && actualResult === 'away') || (eloDiff < 0 && actualResult === 'home')
            ? '弱队表现超出 Elo 预期。'
            : '强队未发挥出 Elo 优势。'
        }`,
        detailI18n: this.i18n(
          `Elo 差距 ${Math.abs(Math.round(eloDiff))} 分未能反映在结果中。${(eloDiff > 0 && actualResult === 'away') || (eloDiff < 0 && actualResult === 'home') ? '弱队表现超出 Elo 预期。' : '强队未发挥出 Elo 优势。'}`,
          `The ${Math.abs(Math.round(eloDiff))}-point Elo gap did not show in the result. ${(eloDiff > 0 && actualResult === 'away') || (eloDiff < 0 && actualResult === 'home') ? 'The weaker side outperformed Elo expectations.' : 'The stronger side did not turn its Elo edge into the result.'}`,
        ),
        impact: 'high',
      });
    }

    // 2. Scoreline variance - goals deviate from Poisson expectation
    if (Math.abs(homeGoalError) > 1.5) {
      factors.push({
        key: 'scoreline_variance_home',
        factor: this.biasFactors.scoreline_variance,
        factorI18n: this.i18n(this.biasFactors.scoreline_variance, 'Scoreline variance'),
        detail: `${homeName}实际进 ${homeScore} 球，模型预期 ${predictedHomeG.toFixed(1)} 球（偏差 ${homeGoalError > 0 ? '+' : ''}${homeGoalError.toFixed(1)}）`,
        detailI18n: this.i18n(`${homeName}实际进 ${homeScore} 球，模型预期 ${predictedHomeG.toFixed(1)} 球（偏差 ${homeGoalError > 0 ? '+' : ''}${homeGoalError.toFixed(1)}）`, `${homeNameEn} scored ${homeScore}; the model expected ${predictedHomeG.toFixed(1)} goals (${homeGoalError > 0 ? '+' : ''}${homeGoalError.toFixed(1)}).`),
        impact: Math.abs(homeGoalError) > 2 ? 'high' : 'medium',
      });
    }
    if (Math.abs(awayGoalError) > 1.5) {
      factors.push({
        key: 'scoreline_variance_away',
        factor: this.biasFactors.scoreline_variance,
        factorI18n: this.i18n(this.biasFactors.scoreline_variance, 'Scoreline variance'),
        detail: `${awayName}实际进 ${awayScore} 球，模型预期 ${predictedAwayG.toFixed(1)} 球（偏差 ${awayGoalError > 0 ? '+' : ''}${awayGoalError.toFixed(1)}）`,
        detailI18n: this.i18n(`${awayName}实际进 ${awayScore} 球，模型预期 ${predictedAwayG.toFixed(1)} 球（偏差 ${awayGoalError > 0 ? '+' : ''}${awayGoalError.toFixed(1)}）`, `${awayNameEn} scored ${awayScore}; the model expected ${predictedAwayG.toFixed(1)} goals (${awayGoalError > 0 ? '+' : ''}${awayGoalError.toFixed(1)}).`),
        impact: Math.abs(awayGoalError) > 2 ? 'high' : 'medium',
      });
    }

    // 3. Defensive collapse
    const homeAvgGA = homeRating?.avgGA || 1.0;
    const awayAvgGA = awayRating?.avgGA || 1.0;
    if (awayScore > homeAvgGA * 2 && awayScore >= 3) {
      factors.push({
        key: 'defensive_collapse_home',
        factor: this.biasFactors.defensive_collapse,
        factorI18n: this.i18n(this.biasFactors.defensive_collapse, 'Defensive collapse'),
        detail: `${homeName}失 ${awayScore} 球，远超场均 ${homeAvgGA.toFixed(1)} 球，防守体系崩溃。`,
        detailI18n: this.i18n(`${homeName}失 ${awayScore} 球，远超场均 ${homeAvgGA.toFixed(1)} 球，防守体系崩溃。`, `${homeNameEn} conceded ${awayScore}, far above its ${homeAvgGA.toFixed(1)} average, indicating a defensive collapse.`),
        impact: 'high',
      });
    }
    if (homeScore > awayAvgGA * 2 && homeScore >= 3) {
      factors.push({
        key: 'defensive_collapse_away',
        factor: this.biasFactors.defensive_collapse,
        factorI18n: this.i18n(this.biasFactors.defensive_collapse, 'Defensive collapse'),
        detail: `${awayName}失 ${homeScore} 球，远超场均 ${awayAvgGA.toFixed(1)} 球，防守体系崩溃。`,
        detailI18n: this.i18n(`${awayName}失 ${homeScore} 球，远超场均 ${awayAvgGA.toFixed(1)} 球，防守体系崩溃。`, `${awayNameEn} conceded ${homeScore}, far above its ${awayAvgGA.toFixed(1)} average, indicating a defensive collapse.`),
        impact: 'high',
      });
    }

    // 4. Attacking surge
    const homeAvgGF = homeRating?.avgGF || 1.0;
    const awayAvgGF = awayRating?.avgGF || 1.0;
    if (homeScore > homeAvgGF * 2 && homeScore >= 3) {
      factors.push({
        key: 'attacking_boom_home',
        factor: this.biasFactors.attacking_boom,
        factorI18n: this.i18n(this.biasFactors.attacking_boom, 'Attacking surge'),
        detail: `${homeName}进 ${homeScore} 球，远超场均 ${homeAvgGF.toFixed(1)} 球，进攻端爆发。`,
        detailI18n: this.i18n(`${homeName}进 ${homeScore} 球，远超场均 ${homeAvgGF.toFixed(1)} 球，进攻端爆发。`, `${homeNameEn} scored ${homeScore}, far above its ${homeAvgGF.toFixed(1)} average, showing an attacking surge.`),
        impact: 'high',
      });
    }
    if (awayScore > awayAvgGF * 2 && awayScore >= 3) {
      factors.push({
        key: 'attacking_boom_away',
        factor: this.biasFactors.attacking_boom,
        factorI18n: this.i18n(this.biasFactors.attacking_boom, 'Attacking surge'),
        detail: `${awayName}进 ${awayScore} 球，远超场均 ${awayAvgGF.toFixed(1)} 球，进攻端爆发。`,
        detailI18n: this.i18n(`${awayName}进 ${awayScore} 球，远超场均 ${awayAvgGF.toFixed(1)} 球，进攻端爆发。`, `${awayNameEn} scored ${awayScore}, far above its ${awayAvgGF.toFixed(1)} average, showing an attacking surge.`),
        impact: 'high',
      });
    }

    // 5. Poisson model validity
    if (prediction && !prediction.components.poisson.valid) {
      factors.push({
        key: 'poisson_low_separation',
        factor: 'Poisson 区分度不足',
        factorI18n: this.i18n('Poisson 区分度不足', 'Low Poisson separation'),
        detail: '双方攻防评分接近，Poisson 模型无法有效区分实力，预测更多依赖 Elo。',
        detailI18n: this.i18n('双方攻防评分接近，Poisson 模型无法有效区分实力，预测更多依赖 Elo。', 'The teams had similar attack and defense ratings, so the Poisson model could not clearly separate them and relied more on Elo.'),
        impact: 'low',
      });
    }

    // 6. Home advantage may be overestimated/underestimated
    if (predictedResult === 'home' && actualResult !== 'home') {
      factors.push({
        key: 'home_advantage_overrated',
        factor: this.biasFactors.home_advantage,
        factorI18n: this.i18n(this.biasFactors.home_advantage, 'Home advantage'),
        detail: '模型高估了主场优势。',
        detailI18n: this.i18n('模型高估了主场优势。', 'The model overestimated home advantage.'),
        impact: 'medium',
      });
    }

    // Overall evaluation
    let accuracy = 'perfect';
    if (!resultCorrect) accuracy = 'wrong_result';
    else if (Math.abs(homeGoalError) > 1 || Math.abs(awayGoalError) > 1) accuracy = 'result_correct_score_wrong';
    else if (Math.abs(homeGoalError) <= 0.5 && Math.abs(awayGoalError) <= 0.5) accuracy = 'highly_accurate';

    // Bias summary
    let summary = '';
    let summaryI18n = null;
    if (accuracy === 'perfect' || accuracy === 'highly_accurate') {
      summary = 'AI 预测与实际结果高度吻合。';
      summaryI18n = this.i18n(summary, 'The AI forecast closely matched the actual result.');
    } else if (accuracy === 'result_correct_score_wrong') {
      summary = '结果方向正确，但比分预测有偏差。';
      let summaryEn = 'The result direction was correct, but the score prediction was off.';
      if (goalDiffError > 1) summary += `实际净胜差(${goalDiffActual > 0 ? '+' : ''}${goalDiffActual})大于预期(${goalDiffPredicted > 0 ? '+' : ''}${goalDiffPredicted.toFixed(1)})。`;
      if (goalDiffError > 1) summaryEn += ` The actual goal difference (${goalDiffActual > 0 ? '+' : ''}${goalDiffActual}) was larger than expected (${goalDiffPredicted > 0 ? '+' : ''}${goalDiffPredicted.toFixed(1)}).`;
      else if (goalDiffError < -1) {
        summary += `实际净胜差(${goalDiffActual})小于预期(${goalDiffPredicted.toFixed(1)})。`;
        summaryEn += ` The actual goal difference (${goalDiffActual}) was smaller than expected (${goalDiffPredicted.toFixed(1)}).`;
      }
      summaryI18n = this.i18n(summary, summaryEn);
    } else {
      const predictedLabel = this.resultLabelI18n(predictedResult, homeName, awayName, homeNameEn, awayNameEn);
      const actualLabel = this.resultLabelI18n(actualResult, homeName, awayName, homeNameEn, awayNameEn);
      summary = `结果预测错误。模型预测 ${predictedLabel.zh}，但实际 ${actualLabel.zh}。`;
      summaryI18n = this.i18n(summary, `The result prediction was wrong. The model expected ${predictedLabel.en}, but the actual result was ${actualLabel.en}.`);
    }

    return {
      predictedResult,
      actualResult,
      resultCorrect,
      accuracy,
      summary,
      summaryI18n,
      homeGoalError: Math.round(homeGoalError * 10) / 10,
      awayGoalError: Math.round(awayGoalError * 10) / 10,
      goalDiffError: Math.round(goalDiffError * 10) / 10,
      predictedConfidence: Math.round(predictedConfidence * 1000) / 10,
      factors,
    };
  }

  /**
   * Calculate post-match Elo change
   */
  calculateEloChange(matchData, homeRating, awayRating, prediction) {
    const { homeId, awayId, homeScore, awayScore } = matchData;
    
    const EloRating = require('./elo');
    const elo = new EloRating();

    const result = elo.updateRatings(
      homeRating?.rating || 1500,
      awayRating?.rating || 1500,
      homeScore,
      awayScore
    );

    return {
      homeBefore: Math.round(homeRating?.rating || 1500),
      awayBefore: Math.round(awayRating?.rating || 1500),
      homeAfter: Math.round(result.homeRating),
      awayAfter: Math.round(result.awayRating),
      homeChange: Math.round(result.homeRating - (homeRating?.rating || 1500)),
      awayChange: Math.round(result.awayRating - (awayRating?.rating || 1500)),
      expectedHome: result.expectedHome,
      expectedAway: result.expectedAway,
      goalDiffMultiplier: result.goalDiffMultiplier,
    };
  }

  /**
   * Default key events (derived from scoreline)
   */
  generateDefaultEvents(matchData) {
    const { homeId, awayId, homeScore, awayScore } = matchData;
    const events = [];
    const homeName = this.getTeamName(homeId);
    const awayName = this.getTeamName(awayId);
    const homeNameEn = this.getTeamNameI18n(homeId).en;
    const awayNameEn = this.getTeamNameI18n(awayId).en;

    // Simulate key events (deduced from final scoreline)
    const totalGoals = homeScore + awayScore;
    const goalEvents = [];
    
    // If no goals
    if (totalGoals === 0) {
      const text = `${homeName} 和 ${awayName} 互交白卷，防守端表现出色。`;
      events.push({
        minute: '全场',
        type: 'highlight',
        text,
        textI18n: this.i18n(text, `${homeNameEn} and ${awayNameEn} finished scoreless, with both defenses performing well.`),
      });
      return events;
    }

    // Evenly distribute goal times
    const homeGoalMinutes = this.distributeGoals(homeScore, 'home', homeName, awayName);
    const awayGoalMinutes = this.distributeGoals(awayScore, 'away', homeName, awayName);
    
    const allGoals = [...homeGoalMinutes, ...awayGoalMinutes]
      .sort((a, b) => a.minute - b.minute);

    allGoals.forEach((g, i) => {
      const scorerEn = g.side === 'home' ? homeNameEn : awayNameEn;
      const text = `${g.team} 进球！${g.player}`;
      const playerEn = `Player #${i + 1}`;
      events.push({
        minute: g.minute + "'",
        type: 'goal',
        text,
        textI18n: this.i18n(text, `${scorerEn} goal. ${playerEn}`),
        score: `${g.scoreAtTime}`,
      });
    });

    // Key event analysis
    const firstGoal = allGoals[0];
    const firstGoalTeamEn = firstGoal.side === 'home' ? homeNameEn : awayNameEn;
    const firstGoalText = `${firstGoal.team}在第 ${firstGoal.minute} 分钟首开记录，${
      firstGoal.team === homeName ? '主队' : '客队'
    }取得领先。`;
    events.push({
      minute: '分析',
      type: 'analysis',
      text: firstGoalText,
      textI18n: this.i18n(firstGoalText, `${firstGoalTeamEn} opened the scoring in the ${firstGoal.minute}th minute, giving the ${firstGoal.side === 'home' ? 'home' : 'away'} side the lead.`),
    });

    if (totalGoals === 1) {
      const text = '全场唯一进球，比赛节奏较慢。';
      events.push({
        minute: '分析',
        type: 'analysis',
        text,
        textI18n: this.i18n(text, 'The only goal of the match came in a slower-paced game.'),
      });
    }

    if (homeScore >= 3 || awayScore >= 3) {
      const teamZh = homeScore >= 3 ? homeName : awayName;
      const teamEn = homeScore >= 3 ? homeNameEn : awayNameEn;
      const text = `${teamZh} 打出 ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} 的大比分，进攻端表现活跃。`;
      events.push({
        minute: '分析',
        type: 'highlight',
        text,
        textI18n: this.i18n(text, `${teamEn} produced a ${Math.max(homeScore, awayScore)}-${Math.min(homeScore, awayScore)} scoreline with a lively attacking display.`),
      });
    }

    return events;
  }

  /**
   * Distribute goal times (simulated)
   */
  distributeGoals(count, side, teamName, oppName) {
    const minutes = [];
    if (count <= 0) return minutes;

    // Goal time distribution pattern in real matches
    const possibleMinutes = [8, 15, 23, 28, 34, 40, 45, 45, 48, 52, 58, 63, 67, 72, 78, 82, 86, 90, 90, 90];
    
    const shuffled = [...possibleMinutes].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count).sort((a, b) => a - b);

    // Score simulation
    let homeScore = 0, awayScore = 0;
    selected.forEach((minute, i) => {
      if (side === 'home') homeScore++;
      else awayScore++;
      minutes.push({
        minute,
        side,
        team: side === 'home' ? teamName : oppName,
        player: `球员 #${i + 1}`,
        scoreAtTime: `${homeScore}-${awayScore}`,
      });
    });

    return minutes;
  }
}

module.exports = MatchReviewEngine;
