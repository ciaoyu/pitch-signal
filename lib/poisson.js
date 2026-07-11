/**
 * Poisson Regression Model - Football match score prediction
 * Based on statistical Poisson distribution, calculates goal probability matrix
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
   * Poisson probability mass function P(X=k) = e^(-λ) * λ^k / k!
   * @param {number} k - Goals scored
   * @param {number} lambda - Expected goals
   * @returns {number} Probability
   */
  poissonPMF(k, lambda) {
    return Math.exp(-lambda) * Math.pow(lambda, k) / this.factorial(k);
  }

  /**
   * Factorial (with cache)
   */
  factorial(n) {
    if (n <= 1) return 1;
    if (this._factorialCache[n]) return this._factorialCache[n];
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    this._factorialCache[n] = result;
    return result;
  }

  /**
   * When xgProfile has sufficient data (>= 2 matches), calibrate λ using actual xG.
   * Blending ratio: λ_math 60% + λ_xg 40% (when data is sufficient)
   * Transparent degradation when no xG data is available, keeping original logic unchanged.
   */
  blendXg(lambdaMath, xgProfile, _isHome) {
    if (!xgProfile || xgProfile.matches < 2) return lambdaMath;
    const globalXg = this.globalAvgGoals; // 1.2
    // Fix W1-B (§1.2): the original ternary `isHome ? avgXgFor : avgXgFor` had two
    // identical branches (copy-paste bug). Per the roadmap the caller passes the SELF
    // profile of the team whose λ is being computed (home λ ← home profile, away λ ←
    // away profile), so the blend always uses that team's expected goals for
    // (avgXgFor). `_isHome` is retained only for call-site symmetry.
    const teamXg = xgProfile.avgXgFor;
    if (!Number.isFinite(teamXg) || teamXg <= 0) return lambdaMath;
    // Scale xG to the same dimension as λ
    const lambdaXg = (teamXg / globalXg) * globalXg;
    const blend = xgProfile.matches >= 5 ? 0.4 : 0.2;
    return lambdaMath * (1 - blend) + lambdaXg * blend;
  }

  calculateLambda(teamAttack, opponentDefense, isHome = true, options = {}) {
    let lambda = this.globalAvgGoals * teamAttack * opponentDefense;

    // Home advantage multiplier (Poisson leg of the triple bonus).
    // P0 quarantine: disabled on neutral venues for the non-host team via
    // options.applyHomeAdvantage === false (see remediation master plan §2.2.1).
    // Defaults to true to preserve domestic/league semantics.
    const applyHomeAdvantage = options.applyHomeAdvantage !== false;
    if (isHome && applyHomeAdvantage) lambda *= this.homeAdvantage;

    // xG calibration (effective when actual data is available)
    if (options.xgProfile) {
      lambda = this.blendXg(lambda, options.xgProfile, isHome);
    }

    // Knockout Defense Logic — QUARANTINED (P0).
    // The hand-tuned λ shrinkages R16/QF/SF/F = 0.90/0.87/0.83/0.80 and the
    // elite-defense extra shrink were merged into main but NEVER estimated on a
    // held-out sample. They are isolated here: the round metadata is still
    // accepted (for downstream KO bookkeeping) but no longer alters λ. Re-enable
    // only after an OOS-estimated, parameter-audited shrinkage model exists.
    if (options.isKnockout || options.knockoutRound) {
      // Intentionally no λ modification. _knockoutShrinkageQuarantined marks
      // that the manual shrinkage path is disabled (audit trail only).
      options._knockoutShrinkageQuarantined = true;
    }

    return lambda;
  }

  /**
   * Generate goal probability matrix (0-maxGoals goals)
   * @param {number} homeLambda - Home team λ
   * @param {number} awayLambda - Away team λ
   * @param {number} maxGoals - Max goals
   * @returns {array} 2D probability matrix
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
   * Calculate win/draw/loss probabilities from probability matrix
   * @param {array} matrix - Goal probability matrix
   * @returns {object} Win/draw/loss probabilities
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
   * @param {number} homeLambda - Home team λ
   * @param {number} awayLambda - Away team λ
   * @param {number} rho - Correction parameter (default: -0.13, typical range: -0.2 to -0.05)
   * @returns {object} Corrected probability matrix and outcome probabilities
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
   * Full match prediction
   * @param {object} homeTeam - { attack_strength, defense_strength }
   * @param {object} awayTeam - { attack_strength, defense_strength }
   * @returns {object} Prediction result
   */
  /**
   * Predict directly based on given λ (without attack/defense strength calculation)
   * Used for Elo-guided λ in prediction.js
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
        // Preserve enough precision for the UI to distinguish close scorelines
        // (e.g. 8.93%, 8.91%, 8.86% should not collapse to 8.9%).
        prob: Math.round(s.prob * 10000) / 10000,
      })),
      dixonColes: correction,
    };
  }

  /**
   * Full match prediction
   * @param {object} homeTeam - { attack_strength, defense_strength }
   * @param {object} awayTeam - { attack_strength, defense_strength }
   * @returns {object} Prediction result
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

    // Most likely scoreline
    let maxProb = 0, likelyScore = [0, 0];
    for (let i = 0; i <= 5; i++) {
      for (let j = 0; j <= 5; j++) {
        if (matrix[i][j] > maxProb) {
          maxProb = matrix[i][j];
          likelyScore = [i, j];
        }
      }
    }

    // Top 5 common scorelines
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
        prob: Math.round(s.prob * 10000) / 10000,
      })),
      dixonColes: correction,
    };
  }

  /**
   * Train attack and defense strengths from historical data
   * @param {array} matches - [{ home_team, away_team, home_score, away_score }]
   * @returns {object} Attack and defense strengths for each team
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

    // Calculate global average goals
    const totalGoals = Object.values(teams).reduce((s, t) => s + t.goalsFor, 0);
    const totalMatches = Object.values(teams).reduce((s, t) => s + t.matches, 0);
    if (totalMatches > 0) this.globalAvgGoals = totalGoals / totalMatches;

    // Calculate attack and defense strengths
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
