/**
 * Elo rating engine - soccer match strength evaluation
 * Based on standard chess Elo formula, adapted with soccer goal difference multiplier
 */
class EloRating {
  constructor(options = {}) {
    this.defaultRating = options.defaultRating || 1500;
    this.kFactor = options.kFactor || 40;
    this.homeAdvantage = options.homeAdvantage || 100; // Home advantage bonus
    this.maxGoalDiff = options.maxGoalDiff || 5;
    
    // Dynamic K factor by match type
    this.kFactorByType = {
      'world_cup': options.kFactorWorldCup || options.kFactor || 60,        // World Cup
      'continental': 50,      // Continental championship
      'qualifier': 45,        // Qualifiers
      'friendly': 30,         // Friendlies
      'default': options.kFactor || 40,
    };
  }
  
  /**
   * Get K factor for match type
   */
  getKFactor(matchType) {
    return this.kFactorByType[matchType] || this.kFactor;
  }

  /**
   * Calculate expected win probability
   * @param {number} ratingA - Team A rating
   * @param {number} ratingB - Team B rating
   * @param {number} [homeAdvantage] - Elo points added to Team A (home side).
   *   Defaults to 0; callers (predictMatch / updateRatings) pass this.homeAdvantage.
   *   Pass 0 to disable home advantage (neutral venue / non-host team — P0
   *   quarantine for World Cup: see
   *   docs/prediction-system-remediation-master-plan-2026-07.md §2.2.1).
   * @returns {number} Team A expected score (0-1)
   */
  expectedScore(ratingA, ratingB, homeAdvantage = 0) {
    return 1 / (1 + Math.pow(10, ((ratingB - ratingA) - homeAdvantage) / 400));
  }

  /**
   * Goal difference multiplier
   * Large margin victories yield greater rating changes
   * @param {number} goalDiff - goal difference (positive = home win)
   * @param {number} eloDiff - Elo rating difference
   * @returns {number} multiplier (>= 1)
   */
  goalDiffMultiplier(goalDiff, eloDiff) {
    const absDiff = Math.abs(goalDiff);
    if (absDiff <= 1) return 1.0;
    if (absDiff === 2) return 1.5;
    if (absDiff === 3) return 1.75;
    return 1.75 + (absDiff - 3) / 8;
  }

  /**
   * Update ratings for both match sides
   * @param {number} homeRating - home team current rating
   * @param {number} awayRating - away team current rating
   * @param {number} homeScore - home goals
   * @param {number} awayScore - away goals
   * @param {object} options - optional parameters { kFactor }
   * @returns {object} new ratings and details
   */
  updateRatings(homeRating, awayRating, homeScore, awayScore, options = {}) {
    let k = options.kFactor || (options.matchType ? this.getKFactor(options.matchType) : this.kFactor);

    // Exponential time decay (Form Factor)
    // Matches from the last 6 months (~180 days) get nearly full K factor, 
    // while matches from years ago get heavily decayed K factor.
    // Base lambda 0.00385 gives half-life of 180 days. We can tune this.
    if (options.daysAgo !== undefined && options.daysAgo >= 0) {
      const lambda = options.decayLambda || 0.00385;
      k = k * Math.exp(-lambda * options.daysAgo);
    }
    const goalDiff = homeScore - awayScore;

    // Expected score (including home advantage, if applicable).
    // P0 quarantine: the home bonus is explicit and callers (predictMatch) pass 0
    // for neutral World Cup venues (§2.2.1). updateRatings is legacy (post-match
    // rating updates) and keeps the nominal-home assumption.
    const expectedHome = this.expectedScore(homeRating, awayRating, this.homeAdvantage);
    const expectedAway = 1 - expectedHome;

    // Actual outcome
    let actualHome, actualAway;
    if (goalDiff > 0) { actualHome = 1; actualAway = 0; }
    else if (goalDiff < 0) { actualHome = 0; actualAway = 1; }
    else { actualHome = 0.5; actualAway = 0.5; }

    // Goal difference multiplier
    const multiplier = this.goalDiffMultiplier(goalDiff, homeRating - awayRating);

    // New ratings
    const newHomeRating = homeRating + k * multiplier * (actualHome - expectedHome);
    const newAwayRating = awayRating + k * multiplier * (actualAway - expectedAway);

    return {
      homeRating: Math.round(newHomeRating * 100) / 100,
      awayRating: Math.round(newAwayRating * 100) / 100,
      expectedHome: Math.round(expectedHome * 1000) / 1000,
      expectedAway: Math.round(expectedAway * 1000) / 1000,
      goalDiffMultiplier: Math.round(multiplier * 1000) / 1000,
      goalDiff,
      kFactor: k,
    };
  }

  /**
   * Initialize Elo rating based on FIFA ranking
   * Linear mapping: rank 1 -> 2100, rank 50 -> 1500
   * @param {number} rank - FIFA ranking
   * @returns {number} Elo rating
   */
  initFromFifaRank(rank) {
    return Math.max(1200, 2100 - (rank - 1) * 12);
  }

  /**
   * Predict match outcome probabilities
   * @param {number} homeRating - home team Elo rating
   * @param {number} awayRating - away team Elo rating
   * @param {number} [homeAdvantage] - Elo points added to home side. Pass 0 to
   *   disable (neutral venue / non-host team). Defaults to this.homeAdvantage.
   * @returns {object} win/draw/loss probabilities
   */
  predictMatch(homeRating, awayRating, homeAdvantage = this.homeAdvantage) {
    const expectedHome = this.expectedScore(homeRating, awayRating, homeAdvantage);
    const drawProb = this.estimateDrawProb(homeRating, awayRating);

    let homeWin = expectedHome - 0.5 * drawProb;
    let awayWin = (1 - expectedHome) - 0.5 * drawProb;

    // Truncate at 0 and renormalize if necessary
    if (homeWin < 0 || awayWin < 0) {
      homeWin = Math.max(0, homeWin);
      awayWin = Math.max(0, awayWin);
      const total = homeWin + drawProb + awayWin;
      if (total > 0) {
        homeWin = homeWin / total;
        awayWin = awayWin / total;
      }
    }

    return {
      homeWin: Math.round(homeWin * 1000) / 1000,
      draw: Math.round(drawProb * 1000) / 1000,
      awayWin: Math.round(awayWin * 1000) / 1000,
      expectedHome: Math.round(expectedHome * 1000) / 1000,
    };
  }

  /**
   * Estimate draw probability
   * Smaller rating difference yields higher draw probability
   * @param {number} homeRating - home team rating
   * @param {number} awayRating - away team rating
   * @returns {number} draw probability (0.15 ~ 0.30)
   */
  estimateDrawProb(homeRating, awayRating) {
    const ratingDiff = Math.abs(homeRating - awayRating);
    return Math.max(0.15, 0.30 - (ratingDiff * 0.0003));
  }

  /**
   * Batch calculate rankings
   * @param {object} teams - { teamId: { name, rating } }
   * @returns {array} array sorted by rating
   */
  rankings(teams) {
    return Object.entries(teams)
      .map(([id, t]) => ({ teamId: id, name: t.name, rating: t.rating }))
      .sort((a, b) => b.rating - a.rating)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }
}

module.exports = EloRating;
