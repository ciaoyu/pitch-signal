const fs = require('fs');
const path = require('path');
const PredictionEngine = require('./prediction');

class BacktestRunner {
  constructor(options = {}) {
    this._options = options;
    this.engine = new PredictionEngine(options);
    this.ratingsPath = path.join(__dirname, '..', 'data', 'ratings.json');
    this.ratings = {};
    try {
      this.ratings = JSON.parse(fs.readFileSync(this.ratingsPath, 'utf8')).teams || {};
    } catch (e) {
      console.error('Failed to load ratings for backtesting:', e.message);
    }
  }

  loadHistory() {
    const p2018 = path.join(__dirname, '..', 'data', 'history', 'worldcup_2018.json');
    const p2022 = path.join(__dirname, '..', 'data', 'history', 'worldcup_2022.json');
    
    let m2018 = [];
    let m2022 = [];

    if (fs.existsSync(p2018)) {
      m2018 = JSON.parse(fs.readFileSync(p2018, 'utf8')).matches || [];
    }
    if (fs.existsSync(p2022)) {
      m2022 = JSON.parse(fs.readFileSync(p2022, 'utf8')).matches || [];
    }

    return { m2018, m2022 };
  }

  async _walkForward(matches, paramOverrides = null, evalFilter = null) {
    const engine = paramOverrides
      ? new PredictionEngine({ ...this._options, ...paramOverrides })
      : this.engine;

    const EloRating = require('./elo');
    const PoissonModel = require('./poisson');
    const eloEngine = new EloRating(paramOverrides || this._options);
    const poissonEngine = new PoissonModel(paramOverrides || this._options);

    const currentRatings = {};
    const getRating = (team) => currentRatings[team] || { rating: 1500, attack_strength: 1.0, defense_strength: 1.0 };

    let totalBrier = 0;
    let totalLogLoss = 0;
    let correctOutcomes = 0;
    let evaluatedCount = 0;

    const historyForPoisson = [];

    // Sort matches chronologically by date
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group matches by calendar date (YYYY-MM-DD only) to prevent same-day lookahead.
    // Truncating to date ensures matches at different kickoff times on the same day
    // are batched together: predict all → score all → update state all.
    const matchesByDate = {};
    for (const match of sortedMatches) {
      if (match.homeScore == null || match.awayScore == null) continue;
      const dateStr = String(match.date || '').slice(0, 10); // YYYY-MM-DD
      if (!matchesByDate[dateStr]) {
        matchesByDate[dateStr] = [];
      }
      matchesByDate[dateStr].push(match);
    }

    const sortedDates = Object.keys(matchesByDate).sort((a, b) => new Date(a) - new Date(b));

    for (const dateStr of sortedDates) {
      const dayMatches = matchesByDate[dateStr];
      const dayPredictions = [];

      // 1. PREDICT all matches on this date using the start-of-day state
      for (const match of dayMatches) {
        const homeTeam = match.home;
        const awayTeam = match.away;
        const homeRating = getRating(homeTeam);
        const awayRating = getRating(awayTeam);

        let isKnockout = false;
        let knockoutRound = null;
        if (match.stage) {
          const s = match.stage.toLowerCase();
          if (s.includes('round of 16')) {
            isKnockout = true; knockoutRound = 'R16';
          } else if (s.includes('quarter-final')) {
            isKnockout = true; knockoutRound = 'QF';
          } else if (s.includes('semi-final') || s.includes('third place')) {
            isKnockout = true; knockoutRound = 'SF';
          } else if (s === 'final' || s === 'finals') {
            isKnockout = true; knockoutRound = 'F';
          }
        }

        const pred = await engine.predictWithMarket({
          homeId: homeTeam,
          awayId: awayTeam,
          homeRating,
          awayRating,
          isKnockout,
          knockoutRound,
        });

        dayPredictions.push({ match, pred, homeRating, awayRating });
      }

      // 2. Evaluate Outcomes and prepare state updates
      const stateUpdates = [];
      for (const { match, pred, homeRating, awayRating } of dayPredictions) {
        const homeTeam = match.home;
        const awayTeam = match.away;

        let yH = 0, yD = 0, yA = 0;
        let actualOutcome = 'draw';
        if (match.homeScore > match.awayScore) {
          yH = 1;
          actualOutcome = 'home';
        } else if (match.homeScore < match.awayScore) {
          yA = 1;
          actualOutcome = 'away';
        } else {
          yD = 1;
        }

        let predOutcome = 'draw';
        if (pred.homeWin > pred.draw && pred.homeWin > pred.awayWin) {
          predOutcome = 'home';
        } else if (pred.awayWin > pred.draw && pred.awayWin > pred.homeWin) {
          predOutcome = 'away';
        }

        const shouldEval = evalFilter ? evalFilter(match) : true;
        if (shouldEval) {
          if (predOutcome === actualOutcome) {
            correctOutcomes++;
          }

          const brier = Math.pow(pred.homeWin - yH, 2) + Math.pow(pred.draw - yD, 2) + Math.pow(pred.awayWin - yA, 2);
          totalBrier += brier;

          const eps = 1e-15;
          const pH = Math.max(eps, Math.min(1 - eps, pred.homeWin));
          const pD = Math.max(eps, Math.min(1 - eps, pred.draw));
          const pA = Math.max(eps, Math.min(1 - eps, pred.awayWin));
          const logLoss = -(yH * Math.log(pH) + yD * Math.log(pD) + yA * Math.log(pA));
          totalLogLoss += logLoss;

          evaluatedCount++;
        }

        const eloUpdate = eloEngine.updateRatings(homeRating.rating, awayRating.rating, match.homeScore, match.awayScore, { matchType: 'world_cup' });
        
        historyForPoisson.push({
          home_team: homeTeam,
          away_team: awayTeam,
          home_score: match.homeScore,
          away_score: match.awayScore,
          date: match.date
        });

        stateUpdates.push({
          homeTeam,
          awayTeam,
          newRatingHome: eloUpdate.homeRating,
          newRatingAway: eloUpdate.awayRating,
        });
      }

      // 3. Update ratings and train Poisson once at the end of the day
      const historyWithDaysAgo = historyForPoisson.map(h => {
        const diffMs = new Date(dateStr) - new Date(h.date);
        const daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          ...h,
          days_ago: daysAgo
        };
      });

      const newStrengths = poissonEngine.trainFromMatches(historyWithDaysAgo);

      for (const update of stateUpdates) {
        currentRatings[update.homeTeam] = {
          rating: update.newRatingHome,
          attack_strength: newStrengths[update.homeTeam]?.attack_strength || 1.0,
          defense_strength: newStrengths[update.homeTeam]?.defense_strength || 1.0
        };
        currentRatings[update.awayTeam] = {
          rating: update.newRatingAway,
          attack_strength: newStrengths[update.awayTeam]?.attack_strength || 1.0,
          defense_strength: newStrengths[update.awayTeam]?.defense_strength || 1.0
        };
      }
    }

    if (evaluatedCount === 0) {
      return { evaluatedCount: 0, meanBrier: null, meanLogLoss: null, accuracy: null, finalRatings: currentRatings };
    }

    return {
      evaluatedCount,
      meanBrier: totalBrier / evaluatedCount,
      meanLogLoss: totalLogLoss / evaluatedCount,
      accuracy: correctOutcomes / evaluatedCount,
      finalRatings: currentRatings
    };
  }

  async run() {
    const { m2018, m2022 } = this.loadHistory();
    const combinedMatches = [...m2018, ...m2022];
    
    console.log('⚽ FIFA World Cup Prediction Backtesting Engine (Walk-Forward) ⚽\n');

    const result2018 = await this._walkForward(m2018);
    console.log(`📊 Dataset: 2018 FIFA World Cup (Train/Eval)`);
    console.log(`  Evaluated Matches: ${result2018.evaluatedCount}`);
    console.log(`  Result Accuracy:   ${(result2018.accuracy * 100).toFixed(2)}%`);
    console.log(`  Mean Brier Score:  ${result2018.meanBrier.toFixed(4)}`);
    console.log('----------------------------------------------------');

    const result2022OOS = await this._walkForward(combinedMatches, null, match => new Date(match.date) >= new Date('2022-01-01'));
    console.log(`📊 Dataset: 2022 FIFA World Cup (OOS Walk-Forward)`);
    console.log(`  Evaluated Matches: ${result2022OOS.evaluatedCount}`);
    console.log(`  Result Accuracy:   ${(result2022OOS.accuracy * 100).toFixed(2)}%`);
    console.log(`  Mean Brier Score:  ${result2022OOS.meanBrier.toFixed(4)}`);
    console.log('----------------------------------------------------');

    const resultCombined = await this._walkForward(combinedMatches);
    console.log(`📊 Dataset: 2018 + 2022 FIFA World Cup (True Walk-Forward Baseline)`);
    console.log(`  Evaluated Matches: ${resultCombined.evaluatedCount}`);
    console.log(`  Result Accuracy:   ${(resultCombined.accuracy * 100).toFixed(2)}%`);
    console.log(`  Mean Brier Score:  ${resultCombined.meanBrier.toFixed(4)}`);
    console.log('----------------------------------------------------');
  }

  async compareBaseline(proposedParams, baseline = null) {
    if (proposedParams && Object.keys(proposedParams).some(k => !['elo', 'poisson', 'weights'].includes(k))) {
       throw new Error(`compareBaseline rejected unknown configurations: ${Object.keys(proposedParams).join(', ')}`);
    }

    // Our new walk-forward baseline for 2018+2022 combined
    // Since we just changed the implementation, the old baseline of 0.5516 is invalid.
    // For safety, we will dynamically compute the baseline if it's not passed.
    let BASELINE = baseline;
    if (!BASELINE) {
      const { m2018, m2022 } = this.loadHistory();
      const combinedMatches = [...m2018, ...m2022];
      const baselineResult = await this._walkForward(combinedMatches);
      BASELINE = {
        brier: baselineResult.meanBrier,
        accuracy: baselineResult.accuracy,
      };
    }

    const { m2018, m2022 } = this.loadHistory();
    const combinedMatches = [...m2018, ...m2022];

    const result = await this._walkForward(combinedMatches, proposedParams);
    const proposed = {
      brier: Math.round(result.meanBrier * 10000) / 10000,
      accuracy: Math.round(result.accuracy * 10000) / 10000,
    };

    const brierDelta = proposed.brier - BASELINE.brier;
    const brierOk = brierDelta <= 0.01;
    const accuracyOk = proposed.accuracy >= BASELINE.accuracy;
    const accepted = brierOk && accuracyOk;

    let reason;
    if (accepted) {
      reason = [
        `通过（${result.evaluatedCount} 场）`,
        `Brier ${proposed.brier.toFixed(4)} ≤ 基线 ${BASELINE.brier.toFixed(4)} + 0.01`,
        `准确率 ${(proposed.accuracy * 100).toFixed(2)}% ≥ 基线 ${(BASELINE.accuracy * 100).toFixed(2)}%`,
      ].join('，');
    } else {
      const issues = [];
      if (!brierOk) {
        issues.push(`Brier ${proposed.brier.toFixed(4)} 超过基线 ${BASELINE.brier.toFixed(4)}`);
      }
      if (!accuracyOk) {
        issues.push(`准确率 ${(proposed.accuracy * 100).toFixed(2)}% 低于基线 ${(BASELINE.accuracy * 100).toFixed(2)}%`);
      }
      reason = `拒绝（${result.evaluatedCount} 场）：${issues.join('；')}`;
    }

    return {
      accepted,
      baseline: { brier: BASELINE.brier, accuracy: BASELINE.accuracy },
      proposed,
      reason,
    };
  }
}

module.exports = BacktestRunner;
