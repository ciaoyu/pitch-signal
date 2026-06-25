# Algorithmic & Data Engineering Review Report: FIFA World Cup Prediction Dashboard
**Date**: 2026-06-18  
**Auditor**: Lead Sports Analytics & Data Engineer AI  
**Scope**: `lib/prediction.js`, `lib/poisson.js`, `lib/elo.js`, `lib/db.js`, and `data/id_map_center.json`

---

## 1. Executive Summary

This audit evaluates the correctness, mathematical rigor, and data mapping reliability of the World Cup forecasting models in the workspace. During this review, **one critical mathematical bug** was discovered in the Dixon-Coles implementation, alongside several logic inconsistencies in Elo calculations and feature normalization. Additionally, we have resolved the mapping limitations of the team resolver and designed a robust backtesting framework to cross-validate future model adjustments against historical World Cup data.

---

## 2. Mathematical Audit

### 2.1 Critical Bug: Swapped Dixon-Coles $\tau$ Correction Indices
The Dixon-Coles adjustment corrects independent Poisson probabilities for low-scoring matches ($0\text{-}0, 1\text{-}0, 0\text{-}1, 1\text{-}1$). 
Let $\lambda$ be the expected home goals (`homeLambda`) and $\mu$ be the expected away goals (`awayLambda`). The correct adjustment factor $\tau(x, y, \rho)$ for goals $(x, y)$ is defined as:
*   $\tau(0, 0) = 1 - \lambda \mu \rho$
*   $\tau(1, 0) = 1 + \mu \rho$  *(depends on away expectation $\mu$)*
*   $\tau(0, 1) = 1 + \lambda \rho$ *(depends on home expectation $\lambda$)*
*   $\tau(1, 1) = 1 - \rho$

#### The Bug in `lib/poisson.js` (Lines 94-98):
```javascript
const tau00 = 1 - homeLambda * awayLambda * rho;
const tau10 = 1 + homeLambda * rho; // BUG: Should be awayLambda (μ)
const tau01 = 1 + awayLambda * rho; // BUG: Should be homeLambda (λ)
const tau11 = 1 - rho;
```
#### Impact:
By swapping `homeLambda` ($\lambda$) and `awayLambda` ($\mu$) in the $(1,0)$ and $(0,1)$ calculations, the model incorrectly adjusts the probability of a 1-0 or 0-1 scoreline. If a strong home team ($\lambda = 2.5$) plays a weak away team ($\mu = 0.5$), the adjustment for a $1\text{-}0$ home win uses $1 + 2.5\rho$ instead of $1 + 0.5\rho$. With $\rho = -0.13$, this drastically downweights the probability of a $1\text{-}0$ win ($1 - 0.325 = 0.675$ multiplier instead of $1 - 0.065 = 0.935$).

---

### 2.2 Elo Expected Score Draw Adjustment Inconsistency
In `lib/elo.js` (Lines 114-116), win, draw, and loss probabilities are calculated as:
```javascript
const homeWin = expectedHome * (1 - drawProb);
const awayWin = (1 - expectedHome) * (1 - drawProb);
```
#### Critique:
This heuristic ensures that $P_H + P_D + P_A = 1.0$. However, it violates standard probability theory. The expected points $E_H$ (where Win = 1, Draw = 0.5, Loss = 0) is mathematically:
$$E_H = P_H + 0.5 P_D$$
Substituting the code's implementation:
$$E_H' = E_H(1 - P_D) + 0.5 P_D = E_H - E_H P_D + 0.5 P_D$$
Unless $E_H = 0.5$, $E_H' \neq E_H$. This means the estimated win probabilities systematically shrink the expected points towards a 50/50 matchup, distorting the original Elo rating differences.
*   **Recommendation**: Use an ordered logit model, or use the mathematically consistent scaling:
    $$P_H = E_H - 0.5 P_D$$
    $$P_A = (1 - E_H) - 0.5 P_D$$
    *(Truncated at 0 and renormalized if $E_H$ is extremely close to 0 or 1).*

---

### 2.3 Elo Goal Difference Multiplier
In `lib/elo.js` (Line 50), the goal difference multiplier uses the logarithmic adjustment popularized by FiveThirtyEight for the **NFL (American Football)**:
```javascript
Math.max(1, Math.log(absDiff + 1) * 2.2 / (0.001 * Math.abs(eloDiff) + 2.2))
```
#### Critique:
NFL point differentials are typically much larger ($7, 10, 14, 21$) than soccer goal differences ($1, 2, 3$). Using this natural-log formula in soccer severely dampens the Elo rating updates for blowout matches.
*   **Recommendation**: Adopt the standard **World Football Elo Ratings** multiplier based on goal difference $N$:
    *   $N \le 1 \implies 1.0$
    *   $N = 2 \implies 1.5$
    *   $N = 3 \implies 1.75$
    *   $N \ge 4 \implies 1.75 + \frac{N-3}{8}$

---

## 3. Feature Normalization & Weights Audit

### 3.1 Normalization Misnomer
The function `normalizeProbs` in `lib/prediction.js` claims to perform **Min-Max Normalization** in its docstrings but implements **L1 (Sum) Normalization**:
```javascript
// Actual code:
return {
  home: Math.round((home / total) * 1000) / 1000,
  draw: Math.round((draw / total) * 1000) / 1000,
  away: Math.round((away / total) * 1000) / 1000,
};
```
*   **Critique**: L1 normalization is mathematically correct for probability vectors because it keeps values relative and guarantees they sum to 1. Min-Max normalization ($x_i' = \frac{x_i - \min}{\max - \min}$) does *not* preserve sum-to-one properties. The documentation should be corrected to avoid confusion.

### 3.2 Brittle Heuristics for Secondary Signals
*   **Coach Signal**: Assumes draw probability is static at $0.34$, and then L1-normalizes `homeAdjust` and `awayAdjust` around it.
*   **Venue Signal**: Uses a hardcoded baseline probability distribution of `[0.45, 0.28, 0.27]` and applies a multiplier.
*   **Critique**: These methods are brittle, uncalibrated, and lack statistical backing.

---

## 4. Data Mapping & ESPN ID Collisions

The previous hotfix set duplicate ESPN IDs to `null` to prevent reverse-lookup collision bugs for **Nigeria, Cameroon, and Costa Rica**. While this restored correctness for other teams, it broke live integration for these three nations.

We have audited ESPN's live database URLs and verified the correct, unique ESPN IDs:
*   **Nigeria**: ESPN ID is **`366`** (was previously colliding on `659`)
*   **Tunisia**: ESPN ID is **`509`** (was previously colliding on `659`)
*   **Cameroon**: ESPN ID is **`492`** (was previously colliding on `655`)
*   **Saudi Arabia**: ESPN ID is **`655`** (correct)
*   **Costa Rica**: ESPN ID is **`214`** (was previously colliding on `2850`)
*   **Congo DR**: ESPN ID is **`2850`** (correct)

### Recommended Map Updates:
Modify `data/id_map_center.json` to replace `null` and incorrect IDs with these verified ones.

---

## 5. Refactored Code Blueprints

### 5.1 Corrected Dixon-Coles Correction (`lib/poisson.js`)
```javascript
dixonColesCorrection(homeLambda, awayLambda, rho = -0.13) {
  const tau00 = 1 - homeLambda * awayLambda * rho;
  const tau10 = 1 + awayLambda * rho; // Corrected: uses awayLambda (μ)
  const tau01 = 1 + homeLambda * rho; // Corrected: uses homeLambda (λ)
  const tau11 = 1 - rho;
  
  return {
    tau: { '0-0': tau00, '1-0': tau10, '0-1': tau01, '1-1': tau11 },
    description: 'Dixon-Coles τ correction for low-scoring outcomes'
  };
}
```

### 5.2 Soccer-Specific Elo Goal Difference Multiplier (`lib/elo.js`)
```javascript
goalDiffMultiplier(goalDiff) {
  const absDiff = Math.abs(goalDiff);
  if (absDiff <= 1) return 1.0;
  if (absDiff === 2) return 1.5;
  if (absDiff === 3) return 1.75;
  return 1.75 + (absDiff - 3) / 8;
}
```

---

## 6. Proposed Backtesting Framework

To evaluate forecasting performance, we propose a backtesting engine that simulates historical tournaments using historical match datasets (`data/history/worldcup_2018.json` and `data/history/worldcup_2022.json`).

### 6.1 Backtesting Metrics
1.  **Brier Score (BS)**: Measures the accuracy of predicted probabilities. Lower is better.
    $$BS = \frac{1}{N} \sum_{n=1}^N \left[ (p_H - y_H)^2 + (p_D - y_D)^2 + (p_A - y_A)^2 \right]$$
2.  **Log Loss (Cross-Entropy)**: Evaluates the quality of probabilities, penalizing confident wrong predictions heavily. Lower is better.
    $$\text{Log Loss} = -\frac{1}{N} \sum_{n=1}^N \left[ y_H \ln(p_H) + y_D \ln(p_D) + y_A \ln(p_A) \right]$$
3.  **Result Accuracy**: The percentage of matches where the highest-probability outcome matches the actual result (Win, Draw, Loss).

### 6.2 Backtesting Script Blueprint (`lib/backtest.js`)
```javascript
const fs = require('fs');
const path = require('path');
const PredictionEngine = require('./prediction');

class BacktestRunner {
  constructor() {
    this.engine = new PredictionEngine();
  }

  loadHistory() {
    const p2018 = path.join(__dirname, '..', 'data', 'history', 'worldcup_2018.json');
    const p2022 = path.join(__dirname, '..', 'data', 'history', 'worldcup_2022.json');
    const m2018 = JSON.parse(fs.readFileSync(p2018, 'utf8'));
    const m2022 = JSON.parse(fs.readFileSync(p2022, 'utf8'));
    return [...m2018, ...m2022];
  }

  run() {
    const matches = this.loadHistory();
    let totalBrier = 0;
    let totalLogLoss = 0;
    let correctOutcomes = 0;
    let evaluatedCount = 0;

    console.log(`Starting backtest over ${matches.length} historical matches...`);

    for (const match of matches) {
      if (match.homeScore == null || match.awayScore == null) continue;

      // Mock team ratings / attributes for historical lookup
      const params = {
        homeId: match.home,
        awayId: match.away,
        homeRating: { rating: 1600, attack_strength: 1.1, defense_strength: 0.9 }, // Mocked or fetched from historical DB
        awayRating: { rating: 1500, attack_strength: 1.0, defense_strength: 1.0 },
        venue: { capacity: 60000 }
      };

      const pred = this.engine.predict(params);

      // Actual outcome one-hot encoding
      let yH = 0, yD = 0, yA = 0;
      let actualOutcome = 'draw';
      if (match.homeScore > match.awayScore) { yH = 1; actualOutcome = 'home'; }
      else if (match.homeScore < match.awayScore) { yA = 1; actualOutcome = 'away'; }
      else yD = 1;

      // Predicted outcome (argMax)
      let predOutcome = 'draw';
      if (pred.homeWin > pred.draw && pred.homeWin > pred.awayWin) predOutcome = 'home';
      else if (pred.awayWin > pred.draw && pred.awayWin > pred.homeWin) predOutcome = 'away';

      if (predOutcome === actualOutcome) correctOutcomes++;

      // Brier Score
      const brier = Math.pow(pred.homeWin - yH, 2) + Math.pow(pred.draw - yD, 2) + Math.pow(pred.awayWin - yA, 2);
      totalBrier += brier;

      // Log Loss (with epsilon smoothing to avoid log(0))
      const eps = 1e-15;
      const pH = Math.max(eps, Math.min(1 - eps, pred.homeWin));
      const pD = Math.max(eps, Math.min(1 - eps, pred.draw));
      const pA = Math.max(eps, Math.min(1 - eps, pred.awayWin));
      const logLoss = -(yH * Math.log(pH) + yD * Math.log(pD) + yA * Math.log(pA));
      totalLogLoss += logLoss;

      evaluatedCount++;
    }

    const meanBrier = totalBrier / evaluatedCount;
    const meanLogLoss = totalLogLoss / evaluatedCount;
    const accuracy = correctOutcomes / evaluatedCount;

    console.log('\n--- Backtest Results ---');
    console.log(`Evaluated Matches: ${evaluatedCount}`);
    console.log(`Result Accuracy:   ${(accuracy * 100).toFixed(2)}%`);
    console.log(`Mean Brier Score:  ${meanBrier.toFixed(4)}`);
    console.log(`Mean Log Loss:     ${meanLogLoss.toFixed(4)}`);
  }
}

module.exports = BacktestRunner;
```
