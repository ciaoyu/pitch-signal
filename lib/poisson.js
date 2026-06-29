/**
 * Poisson 回归模型 - 足球比分预测
 * 基于统计学 Poisson 分布，计算进球概率矩阵
 */
class PoissonModel {
  constructor(options = {}) {
    // World Cup per-team-per-game average is ~1.2; attack_strength values in
    // ratings.json are calibrated against this figure (avgGF / attack ≈ 1.2).
    // The old default of 2.5 inflated λ to ~2.7 which made 2-2 the mode for
    // every match regardless of team strength.
    this.globalAvgGoals = options.globalAvgGoals || 1.2;
    this.homeAdvantage = options.homeAdvantage || 1.2;
    this.rho = options.rho !== undefined ? options.rho : -0.13;
    this._factorialCache = {};
  }

  /**
   * Poisson 概率质量函数 P(X=k) = e^(-λ) * λ^k / k!
   * @param {number} k - 进球数
   * @param {number} lambda - 期望进球数
   * @returns {number} 概率
   */
  poissonPMF(k, lambda) {
    return Math.exp(-lambda) * Math.pow(lambda, k) / this.factorial(k);
  }

  /**
   * 阶乘（带缓存）
   */
  factorial(n) {
    if (n <= 1) return 1;
    if (this._factorialCache[n]) return this._factorialCache[n];
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    this._factorialCache[n] = result;
    return result;
  }

  calculateLambda(teamAttack, opponentDefense, isHome = true, options = {}) {
    let lambda = this.globalAvgGoals * teamAttack * opponentDefense;
    if (isHome) lambda *= this.homeAdvantage;

    // Knockout Defense Logic ("Defense Wins Championships")
    if (options.isKnockout || options.knockoutRound) {
      // General shrinkage for knockouts (historically tighter matches)
      const shrinkMap = { 'R16': 0.90, 'QF': 0.87, 'SF': 0.83, 'F': 0.80 };
      const shrinkage = shrinkMap[options.knockoutRound] || 0.87; // default to QF average if not specified
      lambda *= shrinkage;

      // Defensive premium: If the opponent has elite defensive metrics (e.g., low xGA, high PPDA)
      if (options.opponentIsEliteDefense) {
        lambda *= shrinkage; // Additional reduction to attacking expected goals
      }
    }

    return lambda;
  }

  /**
   * 生成进球概率矩阵（0-maxGoals 球）
   * @param {number} homeLambda - 主队 λ
   * @param {number} awayLambda - 客队 λ
   * @param {number} maxGoals - 最大进球数
   * @returns {array} 二维概率矩阵
   */
  goalProbabilityMatrix(homeLambda, awayLambda, maxGoals = 5) {
    const matrix = [];
    for (let i = 0; i <= maxGoals; i++) {
      matrix[i] = [];
      for (let j = 0; j <= maxGoals; j++) {
        matrix[i][j] = this.poissonPMF(i, homeLambda) * this.poissonPMF(j, awayLambda);
      }
    }
    return matrix;
  }

  /**
   * 从概率矩阵计算胜平负概率
   * @param {array} matrix - 进球概率矩阵
   * @returns {object} 胜平负概率
   */
  matchOutcomeProbabilities(matrix) {
    let homeWin = 0, draw = 0, awayWin = 0;
    const maxGoals = matrix.length - 1;

    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        if (i > j) homeWin += matrix[i][j];
        else if (i === j) draw += matrix[i][j];
        else awayWin += matrix[i][j];
      }
    }

    return { homeWin, draw, awayWin };
  }
  
  /**
   * Dixon-Coles τ correction for low-scoring outcomes
   * Adjusts the probability of 0-0, 1-0, 0-1, 1-1 to better match real football data
   * @param {number} homeLambda - 主队 λ
   * @param {number} awayLambda - 客队 λ
   * @param {number} rho - 修正参数 (default: -0.13, typical range: -0.2 to -0.05)
   * @returns {object} 修正后的概率矩阵和胜平负概率
   */
  dixonColesCorrection(homeLambda, awayLambda, rho = -0.13) {
    const tau00 = 1 - homeLambda * awayLambda * rho;
    const tau10 = 1 + awayLambda * rho;
    const tau01 = 1 + homeLambda * rho;
    const tau11 = 1 - rho;
    
    return {
      tau: { '0-0': tau00, '1-0': tau10, '0-1': tau01, '1-1': tau11 },
      description: 'Dixon-Coles τ correction for low-scoring outcomes'
    };
  }

  applyDixonColes(matrix, homeLambda, awayLambda, rho = -0.13) {
    const correction = this.dixonColesCorrection(homeLambda, awayLambda, rho);
    if (matrix[0]?.[0] != null) matrix[0][0] *= correction.tau['0-0'];
    if (matrix[1]?.[0] != null) matrix[1][0] *= correction.tau['1-0'];
    if (matrix[0]?.[1] != null) matrix[0][1] *= correction.tau['0-1'];
    if (matrix[1]?.[1] != null) matrix[1][1] *= correction.tau['1-1'];

    const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, value) => rowSum + value, 0), 0);
    if (total > 0) {
      for (const row of matrix) {
        for (let i = 0; i < row.length; i++) row[i] /= total;
      }
    }

    return { matrix, correction };
  }

  /**
   * 完整比赛预测
   * @param {object} homeTeam - { attack_strength, defense_strength }
   * @param {object} awayTeam - { attack_strength, defense_strength }
   * @returns {object} 预测结果
   */
  /**
   * 根据给定的 λ 直接预测（不通过攻防强度计算）
   * 用于 prediction.js 中 Elo 引导的 λ
   */
  predictMatchWithLambda(homeLambda, awayLambda, maxGoals = 5) {
    const matrix = this.goalProbabilityMatrix(homeLambda, awayLambda, maxGoals);
    const { correction } = this.applyDixonColes(matrix, homeLambda, awayLambda, this.rho);
    const outcome = this.matchOutcomeProbabilities(matrix);

    let maxProb = 0, likelyScore = [0, 0];
    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        if (matrix[i][j] > maxProb) {
          maxProb = matrix[i][j];
          likelyScore = [i, j];
        }
      }
    }

    const scores = [];
    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        scores.push({ score: `${i}-${j}`, prob: matrix[i][j] });
      }
    }
    scores.sort((a, b) => b.prob - a.prob);

    return {
      homeLambda: Math.round(homeLambda * 1000) / 1000,
      awayLambda: Math.round(awayLambda * 1000) / 1000,
      homeWinProb: Math.round(outcome.homeWin * 1000) / 1000,
      drawProb: Math.round(outcome.draw * 1000) / 1000,
      awayWinProb: Math.round(outcome.awayWin * 1000) / 1000,
      likelyScore: `${likelyScore[0]}-${likelyScore[1]}`,
      likelyScoreProb: Math.round(maxProb * 1000) / 1000,
      topScores: scores.slice(0, 5).map(s => ({
        score: s.score,
        prob: Math.round(s.prob * 1000) / 1000,
      })),
      dixonColes: correction,
    };
  }

  /**
   * 完整比赛预测
   * @param {object} homeTeam - { attack_strength, defense_strength }
   * @param {object} awayTeam - { attack_strength, defense_strength }
   * @returns {object} 预测结果
   */
  predictMatch(homeTeam, awayTeam) {
    const homeLambda = this.calculateLambda(
      homeTeam.attack_strength || 1.0,
      awayTeam.defense_strength || 1.0,
      true
    );
    const awayLambda = this.calculateLambda(
      awayTeam.attack_strength || 1.0,
      homeTeam.defense_strength || 1.0,
      false
    );

    const matrix = this.goalProbabilityMatrix(homeLambda, awayLambda);
    const { correction } = this.applyDixonColes(matrix, homeLambda, awayLambda, this.rho);
    const outcome = this.matchOutcomeProbabilities(matrix);

    // 最可能的比分
    let maxProb = 0, likelyScore = [0, 0];
    for (let i = 0; i <= 5; i++) {
      for (let j = 0; j <= 5; j++) {
        if (matrix[i][j] > maxProb) {
          maxProb = matrix[i][j];
          likelyScore = [i, j];
        }
      }
    }

    // 常见比分 Top 5
    const scores = [];
    for (let i = 0; i <= 5; i++) {
      for (let j = 0; j <= 5; j++) {
        scores.push({ score: `${i}-${j}`, prob: matrix[i][j] });
      }
    }
    scores.sort((a, b) => b.prob - a.prob);

    return {
      homeLambda: Math.round(homeLambda * 1000) / 1000,
      awayLambda: Math.round(awayLambda * 1000) / 1000,
      homeWinProb: Math.round(outcome.homeWin * 1000) / 1000,
      drawProb: Math.round(outcome.draw * 1000) / 1000,
      awayWinProb: Math.round(outcome.awayWin * 1000) / 1000,
      likelyScore: `${likelyScore[0]}-${likelyScore[1]}`,
      likelyScoreProb: Math.round(maxProb * 1000) / 1000,
      topScores: scores.slice(0, 5).map(s => ({
        score: s.score,
        prob: Math.round(s.prob * 1000) / 1000,
      })),
      dixonColes: correction,
    };
  }

  /**
   * 从历史数据训练攻防强度
   * @param {array} matches - [{ home_team, away_team, home_score, away_score }]
   * @returns {object} 各队攻防强度
   */
  trainFromMatches(matches) {
    const teams = {};

    for (const match of matches) {
      const { home_team, away_team, home_score, away_score, days_ago } = match;
      if (home_score == null || away_score == null) continue;

      // Exponential time decay (Form Factor)
      // lambda = 0.00385 means 180 days (6 months) ~ 0.5 weight, 365 days ~ 0.25 weight
      let weight = 1.0;
      if (days_ago !== undefined && days_ago >= 0) {
        weight = Math.exp(-0.00385 * days_ago);
      }

      if (!teams[home_team]) teams[home_team] = { goalsFor: 0, goalsAgainst: 0, matches: 0 };
      if (!teams[away_team]) teams[away_team] = { goalsFor: 0, goalsAgainst: 0, matches: 0 };

      teams[home_team].goalsFor += home_score * weight;
      teams[home_team].goalsAgainst += away_score * weight;
      teams[home_team].matches += weight;

      teams[away_team].goalsFor += away_score * weight;
      teams[away_team].goalsAgainst += home_score * weight;
      teams[away_team].matches += weight;
    }

    // 计算全局平均进球
    const totalGoals = Object.values(teams).reduce((s, t) => s + t.goalsFor, 0);
    const totalMatches = Object.values(teams).reduce((s, t) => s + t.matches, 0);
    if (totalMatches > 0) this.globalAvgGoals = totalGoals / totalMatches;

    // 计算攻防强度
    const strengths = {};
    for (const [team, stats] of Object.entries(teams)) {
      if (stats.matches >= 3) {
        strengths[team] = {
          attack_strength: Math.round((stats.goalsFor / stats.matches) / this.globalAvgGoals * 1000) / 1000,
          defense_strength: Math.round((stats.goalsAgainst / stats.matches) / this.globalAvgGoals * 1000) / 1000,
          matches: stats.matches,
          avgGoalsFor: Math.round(stats.goalsFor / stats.matches * 100) / 100,
          avgGoalsAgainst: Math.round(stats.goalsAgainst / stats.matches * 100) / 100,
        };
      }
    }

    return strengths;
  }
}

module.exports = PoissonModel;
