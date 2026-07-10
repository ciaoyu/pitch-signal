/**
 * Prediction Fusion Engine v4 - Feature normalization + Confidence dynamic weighting
 * 
 * Improvements:
 * 1. Min-Max normalization: unify each signal output to [0,1]
 * 2. Confidence weighting: each signal has a confidence score, weight *= confidence
 * 3. Dynamic weighting: automatically adjust based on signal quality
 * 4. Dixon-Coles τ correction: draw probability correction
 */
const EloRating = require('./elo');
const PoissonModel = require('./poisson');
const fs = require('fs');
const path = require('path');

class PredictionEngine {
  constructor(options = {}) {
    this.elo = new EloRating(options.elo || {});
    this.poisson = new PoissonModel(options.poisson || {});
    this.eloGuidedBaseLambda = options.eloGuidedBaseLambda ?? 1.5;

    // Base weights (dynamically adjusted by confidence)
    this.baseWeights = Object.assign({
      elo: 0.30,
      poisson: 0.25,
      coach: 0.15,
      venue: 0.10,
      odds: 0.20,
      marketValue: 0.10,
      continentalStrength: 0.04,
      fatigue: 0.04,
    }, options.weights);

    // Load coach data
    try {
      this.coaches = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'coaches.json'), 'utf8'));
    } catch (e) {
      this.coaches = {};
    }
  }

  /**
   * Min-Max normalization: normalize probability triplet to [0,1] summing to 1
   * @param {number} home - Home win probability
   * @param {number} draw - Draw probability
   * @param {number} away - Away win probability
   * @returns {{ home, draw, away }} Normalized probabilities
   */
  normalizeProbs(home, draw, away) {
    const total = home + draw + away;
    if (total <= 0) return { home: 0.33, draw: 0.34, away: 0.33 };
    return {
      home: Math.round((home / total) * 1000) / 1000,
      draw: Math.round((draw / total) * 1000) / 1000,
      away: Math.round((away / total) * 1000) / 1000,
    };
  }

  /**
   * Elo-guided λ
   */
  eloGuidedLambda(eloWinProb, rawLambda, eloRating, oppRating) {
    const ratingDiff = eloRating - oppRating;
    const baseLambda = this.eloGuidedBaseLambda;
    const eloLambda = baseLambda + (ratingDiff / 100) * 0.4;
    // Blend 80% raw Poisson (which contains knockout shrinkage logic) with 20% Elo expectation
    const blended = rawLambda * 0.8 + eloLambda * 0.2;
    return Math.max(0.2, Math.min(4.0, blended));
  }

  /**
   * Async wrapper to fetch live Polymarket data and inject it into the prediction flow.
   *
   * ⚠️ POLYMARKET Gate (disabled by default)
   * Currently polymarketClient.js generates mock odds using team name hash (_mockFetchMarket).
   * Actual test: opening the gate drops backtest Brier from 0.5519 to 0.6726, accuracy from 59% to 46% -
   * mock data actively degrades the model. Enable POLYMARKET_ENABLED=true after integrating real gamma-api data in Phase 3.
   * When gate is closed, this method equals predict(), engine falls back to honest baseline.
   */
  async predictWithMarket(params) {
    // POLYMARKET gate (forced closed during controlled public Beta)
    const POLYMARKET_ENABLED = false;
    if (!POLYMARKET_ENABLED) {
      return this.predict(params);
    }
    if (!this.polymarket) {
      const PolymarketClient = require('./polymarketClient');
      this.polymarket = new PolymarketClient();
    }

    const marketData = await this.polymarket.fetchMatchMarkets(params.homeId, params.awayId);
    if (marketData) {
      const implied = this.polymarket.extractImpliedProbabilities(marketData);
      if (implied) {
        params.polymarketOdds = {
          ...implied,
          liquidity: this.polymarket.assessLiquidity(marketData.volumeUsd)
        };
      }
    }

    return this.predict(params);
  }

  /**
   * AI Brain Injection (Shadow mode) - thin wrapper over predictWithMarket.
   *
   * Design principles:
   *   - Do not modify final probabilities (pure addition result.aiContext); compareBaseline still passes identically.
   *   - "Sent influence": combine crossMatchEffect (same group + global lessons) +
   *     teamContext.getContext (recent 5 match lessons for both teams) -> result.aiContext.
   *   - Phase 2 (Activation): feed result.aiContext to Claude to produce "bounded ±5%
   *     adjustment + natural language attribution", and write to components.ai. Currently only assemble + snapshot,
   *     no LLM token consumption, no probability modification.
   *
   * @param {object} params - Same as predictWithMarket; optionally pass groupName (for cross-match effects)
   * @returns {Promise<object>} Same shape as predict(), with additional aiContext field
   */
  async predictWithAI(params) {
    const result = await this.predictWithMarket(params);

    const crossMatchEffect = require('./crossMatchEffect');
    const teamContext = require('./teamContext');

    const groupName = params.groupName || null;
    let crossMatchPrompt = null;
    if (groupName) {
      try {
        crossMatchPrompt = crossMatchEffect.compileCrossMatchPrompt(
          params.homeId,
          params.awayId,
          groupName
        );
      } catch (e) {
        crossMatchPrompt = `(cross-match analysis failed: ${e.message})`;
      }
    }

    let homeContext = null;
    let awayContext = null;
    try {
      // P2-5: Prewarm news cache - fetch news first into teamContext, then retrieve via getContext.
      // newsCache TTL=30min, repeated calls for same match_id will not re-fetch (intercepted by cache).
      const newsOpts = { lang: params.lang || 'en', maxItems: 8 };
      await Promise.all([
        teamContext.requestTeamNews(params.homeId, newsOpts),
        teamContext.requestTeamNews(params.awayId, newsOpts),
      ]);
      [homeContext, awayContext] = await Promise.all([
        teamContext.getContext(params.homeId),
        teamContext.getContext(params.awayId),
      ]);
    } catch (e) {
      // teamContext failure should not affect prediction; record fallback signal
      homeContext = { error: e.message };
      awayContext = { error: e.message };
    }

    result.aiContext = {
      shadowMode: true,         // Currently collection only, does not affect probability
      applied: false,           // Set true once Claude produces ±5% adjustment
      groupName,
      crossMatchPrompt,
      homeContext,
      awayContext,
      // Future fields: claudeAdjustment, claudeRationale (injected in Phase 2)
    };
    return result;
  }

  /**
   * Comprehensive prediction (v4 feature normalization version)
   */
  predict(params) {
    const { homeId, awayId, homeEspnId, awayEspnId, homeRating, awayRating, odds, venue, marketValueSignal, continentalStrengthSignal, fatigueSignal } = params;

    // ============================================
    // 1. Independent signal calculation + confidence
    // ============================================

    // --- Elo signal ---
    const eloPred = this.elo.predictMatch(
      homeRating?.rating || 1500,
      awayRating?.rating || 1500
    );
    const eloConfidence = this.calcEloConfidence(
      homeRating?.rating || 1500,
      awayRating?.rating || 1500
    );
    const eloNorm = this.normalizeProbs(eloPred.homeWin, eloPred.draw, eloPred.awayWin);

    // --- Poisson signal ---
    const homeRawLambda = this.poisson.calculateLambda(
      homeRating?.attack_strength || 1.0,
      awayRating?.defense_strength || 1.0,
      true,
      { isKnockout: params.isKnockout, knockoutRound: params.knockoutRound, opponentIsEliteDefense: awayRating?.isEliteDefense }
    );
    const awayRawLambda = this.poisson.calculateLambda(
      awayRating?.attack_strength || 1.0,
      homeRating?.defense_strength || 1.0,
      false,
      { isKnockout: params.isKnockout, knockoutRound: params.knockoutRound, opponentIsEliteDefense: homeRating?.isEliteDefense }
    );
    const homeLambda = this.eloGuidedLambda(eloPred.homeWin, homeRawLambda, homeRating?.rating || 1500, awayRating?.rating || 1500);
    const awayLambda = this.eloGuidedLambda(eloPred.awayWin, awayRawLambda, awayRating?.rating || 1500, homeRating?.rating || 1500);

    // --- Environmental factor (altitude/heat attenuation): λ' = λ · β_alt · β_temp ---
    // When data is missing β=1, equivalent to unchanged λ, falling back to original baseline (Est.).
    // When params.matchId is missing (e.g., direct call in test-prediction.js) also falls back without affecting existing behavior.
    let envFactor = null;
    let homeEnvBeta = 1, awayEnvBeta = 1;
    if (params.matchId) {
      try {
        const venueFactors = require('./venueFactors');
        envFactor = venueFactors.computeForMatch(params.matchId, params.homeId, params.awayId);
        homeEnvBeta = envFactor.home.beta;
        awayEnvBeta = envFactor.away.beta;
      } catch (e) {
        envFactor = { error: e.message };
      }
    }
    const homeLambdaAdj = homeLambda * homeEnvBeta;
    const awayLambdaAdj = awayLambda * awayEnvBeta;

    const poissonPred = this.poisson.predictMatchWithLambda(homeLambdaAdj, awayLambdaAdj);
    
    // Poisson confidence: based on λ distinction + Dixon-Coles correction
    const poissonValid = Math.abs(poissonPred.homeWinProb - poissonPred.awayWinProb) > 0.05;
    const poissonConfidence = poissonValid ? 0.85 : 0.40;
    const poissonNorm = this.normalizeProbs(poissonPred.homeWinProb, poissonPred.drawProb, poissonPred.awayWinProb);

    // --- Coach signal ---
    // coaches.json is keyed by ESPN ID; homeId/awayId are ratings_ids.
    // Fall back to ratings_id so the lookup degrades gracefully when ESPN ID is absent.
    const coachFactor = this.calcCoachFactor(homeEspnId || homeId, awayEspnId || awayId);
    const coachConfidence = this.calcCoachConfidence(homeEspnId || homeId, awayEspnId || awayId);
    const coachNorm = this.normalizeProbs(coachFactor.homeAdjust, 0.34, coachFactor.awayAdjust);

    // --- Venue signal ---
    const venueFactor = venue ? this.calcVenueFactor(venue) : { homeAdvantage: 1.0 };
    const venueConfidence = venue ? 0.60 : 0.0;
    // Venue only affects home win probability; draw and away distributed proportionally
    const venueHomeBoost = (venueFactor.homeAdvantage - 1) * 5; // 0~0.25
    const venueNorm = this.normalizeProbs(0.45 + venueHomeBoost, 0.28, 0.27 - venueHomeBoost);

    // --- Odds signal ---
    // Filter out estimated mock odds to prevent circular rating fusion
    const isMockOdds = odds && odds.source === 'estimated';
    const oddsFactor = (odds && !isMockOdds) ? this.calcOddsFactor(odds) : null;
    const oddsConfidence = oddsFactor ? this.calcOddsConfidence(odds) : 0;
    const oddsNorm = oddsFactor
      ? this.normalizeProbs(oddsFactor.homeWinProb, oddsFactor.drawProb, oddsFactor.awayWinProb)
      : { home: 0.33, draw: 0.34, away: 0.33 };

    // --- Squad market value signal (P4-2) ---
    // marketValueSignal is not passed by default, leaving production probabilities unchanged.
    // PredictionService injects this signal only when both data source and explicit gate are enabled.
    const marketValueNorm = marketValueSignal
      ? this.normalizeProbs(marketValueSignal.home, marketValueSignal.draw, marketValueSignal.away)
      : { home: 0.33, draw: 0.34, away: 0.33 };
    const marketValueConfidence = marketValueSignal ? marketValueSignal.confidence || 0.55 : 0;

    // --- Continental strength head (P4-3) ---
    // Effective only when explicitly injected via service layer env gate or compareBaseline candidate configuration.
    const continentalStrengthNorm = continentalStrengthSignal
      ? this.normalizeProbs(continentalStrengthSignal.home, continentalStrengthSignal.draw, continentalStrengthSignal.away)
      : { home: 0.33, draw: 0.34, away: 0.33 };
    const continentalStrengthConfidence = continentalStrengthSignal ? continentalStrengthSignal.confidence || 0.55 : 0;

    // --- Fatigue index (KO-5) ---
    // Only applies to knockout fixtures and only when KO-1 shared infra has data.
    const fatigueNorm = fatigueSignal
      ? this.normalizeProbs(fatigueSignal.home, fatigueSignal.draw, fatigueSignal.away)
      : { home: 0.33, draw: 0.34, away: 0.33 };
    const fatigueConfidence = fatigueSignal ? fatigueSignal.confidence || 0 : 0;

    // ============================================
    // 2. Confidence dynamic weighting
    // ============================================
    const signals = [
      { name: 'elo', norm: eloNorm, confidence: eloConfidence },
      { name: 'poisson', norm: poissonNorm, confidence: poissonConfidence },
      { name: 'coach', norm: coachNorm, confidence: coachConfidence },
      { name: 'venue', norm: venueNorm, confidence: venueConfidence },
      { name: 'odds', norm: oddsNorm, confidence: oddsConfidence },
      { name: 'marketValue', norm: marketValueNorm, confidence: marketValueConfidence },
      { name: 'continentalStrength', norm: continentalStrengthNorm, confidence: continentalStrengthConfidence },
      { name: 'fatigue', norm: fatigueNorm, confidence: fatigueConfidence },
    ];

    // Dynamic weight = base weight * confidence
    const dynamicWeights = {};
    let totalWeight = 0;
    for (const sig of signals) {
      const w = (this.baseWeights[sig.name] || 0) * sig.confidence;
      dynamicWeights[sig.name] = w;
      totalWeight += w;
    }

    // Normalize weights to [0,1]
    if (totalWeight > 0) {
      for (const k of Object.keys(dynamicWeights)) {
        dynamicWeights[k] = Math.round((dynamicWeights[k] / totalWeight) * 1000) / 1000;
      }
    }

    // ============================================
    // 3. Weighted fusion
    // ============================================
    let fusedHome = 0, fusedDraw = 0, fusedAway = 0;
    for (const sig of signals) {
      const w = dynamicWeights[sig.name] || 0;
      fusedHome += sig.norm.home * w;
      fusedDraw += sig.norm.draw * w;
      fusedAway += sig.norm.away * w;
    }

    // Basic mathematical fusion
    let fused = this.normalizeProbs(fusedHome, fusedDraw, fusedAway);

    // ============================================
    // 4. Polymarket Bayesian fusion (Continuous Sigmoid)
    // ============================================
    // DESIGN FIX: Replaced hard 80/20 threshold switch (which caused prediction
    // jumps at 14.9%→15.1% divergence) with a smooth Sigmoid function.
    // Architecture Review ADR-005: Continuous Bayesian weighting.
    let polymarketApplied = false;
    let conflictResolved = null;
    let originalProb = { home: fused.home, draw: fused.draw, away: fused.away };
    let marketProb = null;

    if (params.polymarketOdds) {
      const pm = params.polymarketOdds;
      const pmNorm = this.normalizeProbs(pm.homeWin, pm.draw, pm.awayWin);
      marketProb = pmNorm;
      
      // Calculate divergence (max diff across outcomes)
      const maxDiff = Math.max(
        Math.abs(fused.home - pmNorm.home),
        Math.abs(fused.draw - pmNorm.draw),
        Math.abs(fused.away - pmNorm.away)
      );

      // Liquidity normalization: 'high' = 1.0, 'medium' = 0.5, 'low' = 0.1
      const liqMap = { high: 1.0, medium: 0.5, low: 0.1 };
      const liqNorm = liqMap[pm.liquidity] || 0.3;

      // Sigmoid continuous weighting:
      // w_market smoothly transitions from baseline (0.30) toward max (0.80)
      // as divergence and liquidity increase.
      // At dev=0, w_market ≈ 0.30 (baseline)
      // At dev=0.15 with high liquidity, w_market ≈ 0.55
      // At dev=0.30 with high liquidity, w_market ≈ 0.75
      const k = 20; // steepness of sigmoid
      const sigmoid = 1 / (1 + Math.exp(-k * (maxDiff - 0.15) * liqNorm));
      const marketWeight = Math.min(0.80, 0.30 + 0.50 * sigmoid);
      const mathWeight = 1.0 - marketWeight;

      if (maxDiff > 0.15 && liqNorm >= 0.5) {
        conflictResolved = 'sigmoid_market_weighted';
      } else if (maxDiff > 0.15 && liqNorm < 0.5) {
        conflictResolved = 'sigmoid_math_weighted_low_liquidity';
      }

      let finalHome = (fused.home * mathWeight) + (pmNorm.home * marketWeight);
      let finalDraw = (fused.draw * mathWeight) + (pmNorm.draw * marketWeight);
      let finalAway = (fused.away * mathWeight) + (pmNorm.away * marketWeight);
      
      fused = this.normalizeProbs(finalHome, finalDraw, finalAway);
      polymarketApplied = true;
    }

    // ============================================
    // Display score: rounded expected goals (expected score).
    // NOT the Poisson joint mode — that is stored in poissonModeScore.
    // When both λ ∈ [1, 2) the joint mode is always 1-1 regardless of
    // team strength. round(λ) reflects the expected goal difference and
    // thus the predicted winner instead.
    //
    // If round(λ) produces a draw but one team has >60% win probability,
    // nudge the score to preserve the predicted winner.
    // This is a display correction only — it does not modify any probabilities.
    const DOMINANCE_THRESHOLD = 0.60;
    // Align to the same 1-decimal precision used by goals.homeExpected/awayExpected
    // before rounding to integer, so that e.g. rawLambda=1.47 → display=1.5 → round=2
    // instead of rawLambda=1.47 → round=1 (inconsistent with goals display).
    const dispHome = Math.round(homeLambdaAdj * 10) / 10;
    const dispAway = Math.round(awayLambdaAdj * 10) / 10;
    let expHome = Math.round(dispHome);
    let expAway = Math.round(dispAway);

    if (expHome === expAway) {
      if (fused.home > DOMINANCE_THRESHOLD)      expHome = expAway + 1;
      else if (fused.away > DOMINANCE_THRESHOLD) expAway = expHome + 1;
    } else if (fused.home > DOMINANCE_THRESHOLD && expHome < expAway) {
      // Rare: home team heavily favoured but λ is inverted (counter-attack setup)
      expHome = expAway + 1;
    } else if (fused.away > DOMINANCE_THRESHOLD && expAway < expHome) {
      expAway = expHome + 1;
    }

    const expectedScore = `${expHome}-${expAway}`;

    return {
      homeWin: fused.home,
      draw: fused.draw,
      awayWin: fused.away,
      expectedScore,
      poissonModeScore: poissonPred.likelyScore,
      poissonModeProb: Math.round(poissonPred.likelyScoreProb * 1000) / 1000,
      likelyScore: expectedScore,          // backward compat
      likelyScoreProb: Math.round(poissonPred.likelyScoreProb * 1000) / 1000,
      topScores: Array.isArray(poissonPred.topScores) ? poissonPred.topScores.slice(0, 5) : [],
      goals: {
        homeExpected: Math.round(homeLambdaAdj * 10) / 10,
        awayExpected: Math.round(awayLambdaAdj * 10) / 10,
      },
      components: {
        elo: { ...eloNorm, confidence: eloConfidence },
        poisson: { ...poissonNorm, homeLambda, awayLambda, homeLambdaAdj, awayLambdaAdj, envApplied: Boolean(envFactor && !envFactor.error && (envFactor.home?.applied || envFactor.away?.applied)), valid: poissonValid, confidence: poissonConfidence, dixonColes: poissonPred.dixonColes },
        coach: { ...coachNorm, confidence: coachConfidence },
        venue: { ...venueNorm, confidence: venueConfidence },
        odds: oddsFactor ? { ...oddsNorm, confidence: oddsConfidence } : null,
        marketValue: marketValueSignal ? { ...marketValueNorm, confidence: marketValueConfidence, meta: marketValueSignal } : null,
        continentalStrength: continentalStrengthSignal ? { ...continentalStrengthNorm, confidence: continentalStrengthConfidence, meta: continentalStrengthSignal } : null,
        fatigue: fatigueSignal ? { ...fatigueNorm, confidence: fatigueConfidence, meta: fatigueSignal } : null,
      },
      // Environmental factor (altitude/heat attenuation): λ' = λ · β_alt · β_temp
      // When data is missing β=1, applied=false, equivalent to unchanged λ (falling back to Est. baseline).
      // Teams without espn_id like CPV: venueFactors still resolved via teams.json without throwing error.
      venueFactor: envFactor && !envFactor.error ? {
        applied: envFactor.home?.applied || envFactor.away?.applied,
        home: envFactor.home,
        away: envFactor.away,
      } : (envFactor?.error ? { applied: false, error: envFactor.error } : { applied: false }),
      weights: dynamicWeights,
      // Neutral field names: external market signal gate is always closed (applied: false) during public Beta.
      // Avoids using "polymarket" wording to prevent exposing competitor narrative in API responses/snapshots/logs.
      marketSignalFusion: polymarketApplied ? { applied: true, conflictResolved, originalProb, marketProb } : { applied: false },
      _fusion: 'v7_math_purified',
      // Confidence interval: reflects signal divergence, xG sample size, and lineup uncertainty
      confidence: this.calcConfidenceInterval({
        homeWin: fused.home,
        draw:    fused.draw,
        awayWin: fused.away,
        eloNorm,
        poissonNorm,
        xgMatchesPlayed: params.xgMatchesPlayed ?? 0,
        lineupUncertainty: params.lineupUncertainty ?? 0,
        isKnockout: Boolean(params.isKnockout),
      }),
    };
  }

  /**
   * Confidence interval calculation
   *
   * Width sources:
   *   1. Divergence between Elo and Poisson (max impact ±8%)
   *   2. xG sample size (WC matches played, 0 -> widest, >=5 -> narrowed)
   *   3. Lineup uncertainty 0-1 (pass 0.5~1.0 when lineup unannounced)
   *   4. Draw probability in knockouts is naturally wider
   *
   * Output [lo, hi] centered on point estimate, ensuring lo >= 0, hi <= 1.
   * level: 'high' | 'medium' | 'low'
   */
  calcConfidenceInterval({ homeWin, draw, awayWin, eloNorm, poissonNorm, xgMatchesPlayed, lineupUncertainty, isKnockout }) {
    // Signal divergence: max difference between Elo and Poisson
    const divergence = Math.max(
      Math.abs(eloNorm.home - poissonNorm.home),
      Math.abs(eloNorm.draw - poissonNorm.draw),
      Math.abs(eloNorm.away - poissonNorm.away)
    );

    // Sample penalty: 0 matches=1.0 (widest), 3 matches=0.6, >=6 matches=0.3
    const samplePenalty = Math.max(0.3, 1.0 - xgMatchesPlayed * 0.12);

    // Base half-width = 5% (when signals align, sample sufficient, lineup confirmed)
    const baseHalf = 0.05;
    const halfWidth = Math.min(0.18,
      baseHalf
      + divergence * 0.5        // Divergence contributes up to +10%
      + samplePenalty * 0.06    // Insufficient sample contributes up to +6%
      + lineupUncertainty * 0.05 // Lineup uncertainty +5%
      + (isKnockout ? 0.02 : 0)  // Knockout extra +2%
    );

    const clamp = (v) => Math.max(0, Math.min(1, v));
    const r3 = (v) => Math.round(v * 1000) / 1000;

    const level = halfWidth < 0.08 ? 'high' : halfWidth < 0.13 ? 'medium' : 'low';

    return {
      homeWin: [r3(clamp(homeWin - halfWidth)), r3(clamp(homeWin + halfWidth))],
      draw:    [r3(clamp(draw    - halfWidth)), r3(clamp(draw    + halfWidth))],
      awayWin: [r3(clamp(awayWin - halfWidth)), r3(clamp(awayWin + halfWidth))],
      halfWidth: r3(halfWidth),
      level,
    };
  }

  /**
   * Elo confidence: based on rating difference (larger diff -> more confident)
   * ratingDiff 0 -> confidence 0.5, ratingDiff 300 -> confidence 0.95
   */
  calcEloConfidence(homeRating, awayRating) {
    const diff = Math.abs(homeRating - awayRating);
    return Math.min(0.95, 0.50 + diff / 600);
  }

  /**
   * Coach confidence: based on data completeness
   */
  calcCoachConfidence(homeId, awayId) {
    const homeCoach = this.coaches[homeId];
    const awayCoach = this.coaches[awayId];
    let conf = 0.30; // Baseline
    if (homeCoach) conf += 0.15;
    if (awayCoach) conf += 0.15;
    // Parse tenure (e.g., "8y" → 8)
    const parseTenure = (coach) => {
      if (!coach?.tenure) return 0;
      const match = coach.tenure.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    if (parseTenure(homeCoach) > 5) conf += 0.10;
    if (parseTenure(awayCoach) > 5) conf += 0.10;
    return Math.min(0.80, conf);
  }

  /**
   * Odds confidence: based on odds rationality
   */
  calcOddsConfidence(odds) {
    const homeDec = parseFloat(odds.homeWin);
    const drawDec = parseFloat(odds.draw);
    const awayDec = parseFloat(odds.awayWin);
    if (!homeDec || !drawDec || !awayDec) return 0;
    // overround between 1.0~1.15 is normal
    const overround = (1 / homeDec) + (1 / drawDec) + (1 / awayDec);
    if (overround < 0.9 || overround > 1.3) return 0.30; // Abnormal odds
    return 0.85;
  }

  /**
   * Most likely scoreline
   */
  mostLikelyScore(homeLambda, awayLambda, homeWinProb, drawProb, awayWinProb) {
    const matrix = this.poisson.goalProbabilityMatrix(homeLambda, awayLambda);
    let maxProb = 0, bestScore = '0-0';
    for (let i = 0; i <= 5; i++) {
      for (let j = 0; j <= 5; j++) {
        if (matrix[i][j] > maxProb) {
          maxProb = matrix[i][j];
          bestScore = `${i}-${j}`;
        }
      }
    }
    return { score: bestScore, prob: maxProb };
  }

  /**
   * Parse coach style from Chinese descriptions into numeric signals.
   * Returns { attackBias, defenseBias } where each is 0~1.
   */
  _parseCoachStyle(style) {
    if (!style) return { attackBias: 0, defenseBias: 0 };
    const s = style.toLowerCase();
    let attackBias = 0, defenseBias = 0;
    // Attacking keywords (Chinese)
    if (s.includes('进攻') || s.includes('逼抢') || s.includes('高压') || s.includes('压迫')) attackBias += 0.6;
    if (s.includes('高位') || s.includes('快速') || s.includes('技术流')) attackBias += 0.3;
    if (s.includes('控球')) attackBias += 0.2;
    // Defensive keywords (Chinese)
    if (s.includes('防守') || s.includes('反击')) defenseBias += 0.6;
    if (s.includes('纪律') || s.includes('稳固') || s.includes('身体对抗')) defenseBias += 0.3;
    if (s.includes('保守') || s.includes('实用')) defenseBias += 0.2;
    // Clamp
    attackBias = Math.min(1, attackBias);
    defenseBias = Math.min(1, defenseBias);
    return { attackBias, defenseBias };
  }

  /**
   * Parse tenure string (e.g., "8y") into numeric years.
   */
  _parseTenure(coach) {
    if (!coach?.tenure) return 0;
    const match = coach.tenure.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Coach factor
   */
  calcCoachFactor(homeId, awayId) {
    const homeCoach = this.coaches[homeId];
    const awayCoach = this.coaches[awayId];
    let homeAdjust = 0.5, awayAdjust = 0.5;
    if (homeCoach) {
      const tenure = this._parseTenure(homeCoach);
      homeAdjust = 0.5 + tenure * 0.002;
      const style = this._parseCoachStyle(homeCoach.style);
      homeAdjust += style.attackBias * 0.04 - style.defenseBias * 0.02;
    }
    if (awayCoach) {
      const tenure = this._parseTenure(awayCoach);
      awayAdjust = 0.5 + tenure * 0.002;
      const style = this._parseCoachStyle(awayCoach.style);
      awayAdjust += style.attackBias * 0.02 - style.defenseBias * 0.04;
    }
    const total = homeAdjust + awayAdjust;
    return {
      homeAdjust: Math.round((homeAdjust / total) * 1000) / 1000,
      awayAdjust: Math.round((awayAdjust / total) * 1000) / 1000,
    };
  }

  /**
   * Venue factor
   */
  calcVenueFactor(venue) {
    if (!venue) return { homeAdvantage: 1.0 };
    const capacityFactor = Math.min(1, (venue.capacity || 50000) / 100000);
    return { homeAdvantage: 1.0 + capacityFactor * 0.05 };
  }

  /**
   * Shin's devigging method (Shin, 1993)
   *
   * Simple proportional devigging evenly distributes the overround across all three outcomes;
   * Shin's method assigns more juice to longshots, better reflecting real-world dynamics where
   * informed/insider trading drives up favorite prices - recognized academically and industry-wide
   * as more accurate for tournaments with frequent longshots (e.g. World Cup group stage).
   * See docs/prediction-methodology-review.md P4-1.
   *
   * z in [0,1) is the implied proportion of informed traders; solved numerically via bisection
   * (60 iterations, sufficient convergence in double precision, zero external dependencies).
   *
   * @param {number[]} rawProbs - Implied probabilities 1/decimalOdds before devigging, sum = overround
   * @returns {number[]} True probabilities after devigging, sum = 1
   */
  shinDevig(rawProbs) {
    const B = rawProbs.reduce((s, b) => s + b, 0);
    if (!(B > 1)) return rawProbs.map(b => b / B); // No juice / inverted: fall back to proportional devigging

    const trueProbsForZ = (z) => rawProbs.map(b =>
      (Math.sqrt(z * z + 4 * (1 - z) * b * b / B) - z) / (2 * (1 - z))
    );
    const sumAt = (z) => trueProbsForZ(z).reduce((s, p) => s + p, 0);

    // sumAt(z) monotonically decreases from sqrt(B)(>1) at z=0; bisect after finding upper bound sumAt(hi)<1
    let lo = 0, hi = 0.2;
    while (sumAt(hi) > 1 && hi < 0.99) hi = Math.min(0.99, hi * 2);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (sumAt(mid) > 1) lo = mid; else hi = mid;
    }
    const probs = trueProbsForZ((lo + hi) / 2);
    // Numerical fallback: ensure normalized to 1
    const total = probs.reduce((s, p) => s + p, 0);
    return probs.map(p => p / total);
  }

  /**
   * Odds factor
   */
  calcOddsFactor(odds) {
    if (!odds) return null;
    const homeDec = parseFloat(odds.homeWin);
    const drawDec = parseFloat(odds.draw);
    const awayDec = parseFloat(odds.awayWin);
    if (!homeDec || !drawDec || !awayDec) return null;
    const [homeWinProb, drawProb, awayWinProb] = this.shinDevig([1 / homeDec, 1 / drawDec, 1 / awayDec]);
    return {
      homeWinProb: Math.round(homeWinProb * 1000) / 1000,
      drawProb: Math.round(drawProb * 1000) / 1000,
      awayWinProb: Math.round(awayWinProb * 1000) / 1000,
    };
  }
}

module.exports = PredictionEngine;
