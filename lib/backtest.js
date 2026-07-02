const fs = require('fs');
const path = require('path');
const PredictionEngine = require('./prediction');
const { detectKnockout } = require('./knockoutStage');

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
    // Elo 热启动种子（scripts/build-elo-seed.js 生成）：
    // 每届世界杯开赛前的全历史 Elo 快照，修复冷启动（所有队 1500 起步）
    // 与生产口径（ratings.json 种子分）不一致的问题。缺文件时自动退回冷启动。
    this.eloSeed = null;
    try {
      const seedPath = options.eloSeedPath || path.join(__dirname, '..', 'data', 'elo-seed.json');
      this.eloSeed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    } catch (e) {
      this.eloSeed = null;
    }
  }

  /**
   * 扫描 data/history/worldcup_*.json 全部年份。
   * 返回值保留 { m2018, m2022 } 具名键（既有测试依赖此结构），
   * 另加 byYear 映射与按时间排序的扁平数组 all。
   */
  loadHistory() {
    const dir = path.join(__dirname, '..', 'data', 'history');
    const byYear = {};
    let files = [];
    try {
      files = fs.readdirSync(dir);
    } catch (e) {
      files = [];
    }
    for (const f of files) {
      const m = f.match(/^worldcup_(\d{4})\.json$/);
      if (!m) continue;
      try {
        byYear[m[1]] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).matches || [];
      } catch (e) {
        console.error(`Failed to load ${f}:`, e.message);
      }
    }
    const all = Object.keys(byYear)
      .sort()
      .flatMap(y => byYear[y]);
    return {
      m2018: byYear['2018'] || [],
      m2022: byYear['2022'] || [],
      byYear,
      all,
    };
  }

  async _walkForward(matches, paramOverrides = null, evalFilter = null, opts = {}) {
    const engine = paramOverrides
      ? new PredictionEngine({ ...this._options, ...paramOverrides })
      : this.engine;

    const EloRating = require('./elo');
    const PoissonModel = require('./poisson');
    const eloEngine = new EloRating(paramOverrides || this._options);
    const poissonEngine = new PoissonModel(paramOverrides || this._options);

    // Elo 热启动：opts.eloSeed 提供每届开赛前的全历史快照。
    // 每跨入新一届（按比赛日年份切换），用该届快照重置 Elo——快照里
    // 包含了两届之间的预选赛/友谊赛信息，严格优于只靠世界杯场次延续。
    // 不传 opts.eloSeed 时保持原冷启动行为（1500 起步，测试依赖此路径）。
    const seedSnapshots = opts.eloSeed?.snapshots || null;
    let seedTeams = null;
    let currentTournamentYear = null;

    const currentRatings = {};
    const getRating = (team) => currentRatings[team] || {
      rating: (seedTeams && seedTeams[team] !== undefined) ? seedTeams[team] : 1500,
      attack_strength: 1.0,
      defense_strength: 1.0,
    };

    let totalBrier = 0;
    let totalLogLoss = 0;
    let correctOutcomes = 0;
    let evaluatedCount = 0;

    const brierScores = [];
    const logLossScores = [];
    const accuracyScores = [];

    const historyForPoisson = [];

    // Sort matches chronologically by date
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group matches by calendar date (YYYY-MM-DD only) to prevent same-day lookahead.
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

      // 跨届边界：切换到该届开赛前的 Elo 快照
      if (seedSnapshots) {
        const year = dateStr.slice(0, 4);
        if (year !== currentTournamentYear) {
          currentTournamentYear = year;
          const snap = seedSnapshots[year];
          if (snap && snap.teams) {
            seedTeams = snap.teams;
            // 已有条目也覆盖：快照含两届间隔期信息，优于 WC-only 延续值
            for (const t of Object.keys(currentRatings)) {
              if (seedTeams[t] !== undefined) currentRatings[t].rating = seedTeams[t];
            }
          }
        }
      }

      // 1. PREDICT all matches on this date using the start-of-day state
      for (const match of dayMatches) {
        const homeTeam = match.home;
        const awayTeam = match.away;
        const homeRating = getRating(homeTeam);
        const awayRating = getRating(awayTeam);

        const { isKnockout, knockoutRound } = detectKnockout(match.stage);

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
          let outcomeCorrect = 0;
          if (predOutcome === actualOutcome) {
            correctOutcomes++;
            outcomeCorrect = 1;
          }
          accuracyScores.push(outcomeCorrect);

          const brier = Math.pow(pred.homeWin - yH, 2) + Math.pow(pred.draw - yD, 2) + Math.pow(pred.awayWin - yA, 2);
          totalBrier += brier;
          brierScores.push(brier);

          const eps = 1e-15;
          const pH = Math.max(eps, Math.min(1 - eps, pred.homeWin));
          const pD = Math.max(eps, Math.min(1 - eps, pred.draw));
          const pA = Math.max(eps, Math.min(1 - eps, pred.awayWin));
          const logLoss = -(yH * Math.log(pH) + yD * Math.log(pD) + yA * Math.log(pA));
          totalLogLoss += logLoss;
          logLossScores.push(logLoss);

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
      return {
        evaluatedCount: 0,
        meanBrier: null,
        meanLogLoss: null,
        accuracy: null,
        brierCI: null,
        logLossCI: null,
        accuracyCI: null,
        finalRatings: currentRatings
      };
    }

    const brierCIRes = bootstrapCI(brierScores);
    const logLossCIRes = bootstrapCI(logLossScores);
    const accuracyCIRes = bootstrapCI(accuracyScores);

    return {
      evaluatedCount,
      meanBrier: totalBrier / evaluatedCount,
      meanLogLoss: totalLogLoss / evaluatedCount,
      accuracy: correctOutcomes / evaluatedCount,
      brierCI: [brierCIRes.ciLower, brierCIRes.ciUpper],
      logLossCI: [logLossCIRes.ciLower, logLossCIRes.ciUpper],
      accuracyCI: [accuracyCIRes.ciLower, accuracyCIRes.ciUpper],
      finalRatings: currentRatings
    };
  }

  _printResult(label, r) {
    console.log(`📊 ${label}`);
    console.log(`  Evaluated Matches: ${r.evaluatedCount}`);
    console.log(`  Result Accuracy:   ${(r.accuracy * 100).toFixed(2)}% [95% CI: ${(r.accuracyCI[0] * 100).toFixed(2)}%, ${(r.accuracyCI[1] * 100).toFixed(2)}%]`);
    console.log(`  Mean Brier Score:  ${r.meanBrier.toFixed(4)} [95% CI: ${r.brierCI[0].toFixed(4)}, ${r.brierCI[1].toFixed(4)}]`);
    console.log(`  Mean Log Loss:     ${r.meanLogLoss.toFixed(4)}`);
    console.log('----------------------------------------------------');
  }

  async run() {
    const history = this.loadHistory();
    const { m2018, m2022 } = history;
    const all = history.all && history.all.length
      ? history.all
      : [...m2018, ...m2022];
    const combined20182022 = [...m2018, ...m2022];

    console.log('⚽ FIFA World Cup Prediction Backtesting Engine (Walk-Forward) ⚽');
    console.log(`History: ${all.length} matches | Elo seed: ${this.eloSeed ? 'loaded' : 'absent (cold start)'}\n`);

    // 1. 旧口径基线：2018+2022、冷启动——与历史记录的 42.2% 直接可比
    const legacy = await this._walkForward(combined20182022);
    this._printResult('2018+2022 cold-start (legacy baseline)', legacy);

    if (this.eloSeed) {
      // 2. 新口径：全部年份 + 每届 Elo 热启动，整体指标
      const fullSeeded = await this._walkForward(all, null, null, { eloSeed: this.eloSeed });
      this._printResult(`Full history ${all.length ? String(all[0].date).slice(0, 4) : ''}-2022 + Elo hot-start (all evaluated)`, fullSeeded);

      // 3. 新口径下的 2018+2022 评估子集——与旧基线同评估集、同样本量对比
      const modernSeeded = await this._walkForward(all, null, m => new Date(m.date) >= new Date('2018-01-01'), { eloSeed: this.eloSeed });
      this._printResult('2018+2022 eval subset under hot-start (apples-to-apples vs legacy)', modernSeeded);
    }
  }

  async compareBaseline(proposedParams, baseline = null) {
    if (proposedParams && Object.keys(proposedParams).some(k => !['elo', 'poisson', 'weights'].includes(k))) {
       throw new Error(`compareBaseline rejected unknown configurations: ${Object.keys(proposedParams).join(', ')}`);
    }

    // 统一口径：全部年份 + Elo 热启动（有种子时）；基线与候选参数在同一口径下对比
    const history = this.loadHistory();
    const combinedMatches = history.all && history.all.length
      ? history.all
      : [...history.m2018, ...history.m2022];
    const wfOpts = this.eloSeed ? { eloSeed: this.eloSeed } : {};

    let BASELINE = baseline;
    if (!BASELINE) {
      const baselineResult = await this._walkForward(combinedMatches, null, null, wfOpts);
      BASELINE = {
        brier: baselineResult.meanBrier,
        accuracy: baselineResult.accuracy,
        brierCI: baselineResult.brierCI,
        accuracyCI: baselineResult.accuracyCI,
      };
    }

    const result = await this._walkForward(combinedMatches, proposedParams, null, wfOpts);
    const proposed = {
      brier: Math.round(result.meanBrier * 10000) / 10000,
      accuracy: Math.round(result.accuracy * 10000) / 10000,
      brierCI: result.brierCI,
      accuracyCI: result.accuracyCI,
    };

    const brierDelta = proposed.brier - BASELINE.brier;
    const brierOk = brierDelta <= 0.01;
    const accuracyOk = proposed.accuracy >= BASELINE.accuracy;
    const accepted = brierOk && accuracyOk;

    // Check overlap of 95% Confidence Intervals
    const brierOverlap = proposed.brierCI[0] <= BASELINE.brierCI[1] && proposed.brierCI[1] >= BASELINE.brierCI[0];
    const accuracyOverlap = proposed.accuracyCI[0] <= BASELINE.accuracyCI[1] && proposed.accuracyCI[1] >= BASELINE.accuracyCI[0];

    const brierSigText = brierOverlap ? '差异不显著 (CIs overlap)' : (proposed.brier < BASELINE.brier ? '显著改进 (CIs separate)' : '显著变差');
    const accuracySigText = accuracyOverlap ? '差异不显著 (CIs overlap)' : (proposed.accuracy > BASELINE.accuracy ? '显著改进 (CIs separate)' : '显著变差');

    let reason;
    if (accepted) {
      reason = [
        `通过（${result.evaluatedCount} 场）`,
        `Brier ${proposed.brier.toFixed(4)} [95% CI: ${proposed.brierCI[0].toFixed(4)}, ${proposed.brierCI[1].toFixed(4)}] vs 基线 ${BASELINE.brier.toFixed(4)} [95% CI: ${BASELINE.brierCI[0].toFixed(4)}, ${BASELINE.brierCI[1].toFixed(4)}] (${brierSigText})`,
        `准确率 ${(proposed.accuracy * 100).toFixed(2)}% vs 基线 ${(BASELINE.accuracy * 100).toFixed(2)}% (${accuracySigText})`,
      ].join('，');
    } else {
      const issues = [];
      if (!brierOk) {
        issues.push(`Brier ${proposed.brier.toFixed(4)} 超过基线 ${BASELINE.brier.toFixed(4)}`);
      }
      if (!accuracyOk) {
        issues.push(`准确率 ${(proposed.accuracy * 100).toFixed(2)}% 低于基线 ${(BASELINE.accuracy * 100).toFixed(2)}%`);
      }
      reason = `拒绝（${result.evaluatedCount} 场）：${issues.join('；')}；Brier: ${brierSigText}，Accuracy: ${accuracySigText}`;
    }

    return {
      accepted,
      baseline: { brier: BASELINE.brier, accuracy: BASELINE.accuracy, brierCI: BASELINE.brierCI, accuracyCI: BASELINE.accuracyCI },
      proposed,
      reason,
    };
  }
}

/**
 * Bootstrap 重采样置信区间计算 (1000次重采样)
 */
function bootstrapCI(scores, n = 1000, alpha = 0.05) {
  if (!scores || scores.length === 0) return { mean: 0, ciLower: 0, ciUpper: 0 };
  
  const len = scores.length;
  const means = [];
  
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < len; j++) {
      const idx = Math.floor(Math.random() * len);
      sum += scores[idx];
    }
    means.push(sum / len);
  }
  
  means.sort((a, b) => a - b);
  const lowIdx = Math.floor(n * (alpha / 2));
  const highIdx = Math.floor(n * (1 - alpha / 2));
  
  const originalMean = scores.reduce((s, v) => s + v, 0) / len;
  
  return {
    mean: originalMean,
    ciLower: means[lowIdx],
    ciUpper: means[highIdx]
  };
}

module.exports = BacktestRunner;
