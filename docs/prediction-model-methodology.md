Language: **English** · [中文](./prediction-model-methodology.zh.md)

# The PitchSignal Prediction Model: Architecture, Evaluation, and Limitations

*PitchSignal Project · Working paper, 2026-07 · Companion evidence log: [prediction-methodology-review.md](./prediction-methodology-review.md)*

## Abstract

PitchSignal predicts 2026 FIFA World Cup match outcomes with a two-track architecture: an Elo-plus-independent-Poisson core with a Dixon-Coles low-score correction for pre-match forecasts, and a separate, gated live-repricing layer that only lets a signal move win probability after it has been backtested against a base rate. This paper documents the model's exact parameters, the evaluation protocol used to test it, and the results of a 964-match walk-forward backtest (1930-2022, World Cup finals only). The headline result is a 57.88% match-outcome accuracy (95% CI: 54.8-61.1%), which overlaps the published baseline for comparable Elo-based systems (60.0%) and is consistent with the broader literature's finding that this model family has a practical ceiling somewhere in the high 50s to low 60s for single-elimination international tournaments. We also report a negative result: adding a Dixon-Coles low-score correction has no statistically distinguishable effect on outcome accuracy in our evaluation, despite two independent peer projects reporting it as actively harmful in theirs. We keep the correction because its value lies in the score-distribution display, not the win/draw/loss call, and removing it would be a behavior change without a measured benefit. The main contribution of this work is not a novel algorithm — the underlying methods (independent Poisson, Dixon-Coles, Elo) are forty-plus-year-old statistical tools — but a documented, leak-checked evaluation protocol and an architecture pattern that keeps unvalidated in-match signals (shots on target, corners, possession) from silently becoming probability, a failure mode we believe is common and rarely disclosed in public sports-prediction tools.

## 1. Introduction

Public football prediction tools generally fall into one of two categories: point-estimate calculators that report a probability with no stated uncertainty or evaluation methodology, and machine-learning demonstrations that report an accuracy figure without a walk-forward protocol, which makes the figure vulnerable to look-ahead leakage (using future information, directly or through data ordering, to predict the past). Neither category typically distinguishes between signals that have been shown to predict outcomes and signals that merely correlate with an entertaining narrative during a live broadcast.

This paper describes a system built around one constraint: a signal is only allowed to move a reported probability if it has passed a backtest showing it beats a base rate. Everything else — in-match pressure, tactical commentary, AI-generated post-match analysis — is displayed but does not touch the number. Section 2 places the mathematical core in the context of existing systems and academic literature. Section 3 describes the architecture in full, including the parts that are deliberately excluded from the probability calculation. Section 4 describes the evaluation protocol. Section 5 reports results, including a negative result on the Dixon-Coles correction. Section 6 discusses what we can and cannot conclude from these results. Section 7 states limitations plainly.

## 2. Related Work

Credibility is marked per source: **[primary]** means we read the original documentation, paper, or source code directly; **[secondary]** means multiple independent sources cross-reference the claim but we did not verify against a primary text; **[marketing]** means the source discloses no methodology and the number should not be treated as evidence.

### 2.1 Institutional systems

| System | Core mechanism | Key parameters | Credibility |
|---|---|---|---|
| FiveThirtyEight SPI (discontinued 2023) | Offense/defense split ratings from four inputs (actual goals, garbage-time-discounted goals, shot xG, non-shot xG); 75% match data / 25% roster data; Poisson + Monte Carlo | 2020-season Brier 0.161 on a different scoring convention than ours; overconfident on favorites, underconfident on upsets | [secondary] — original page returned 404 by the time of this review; figures cross-referenced across multiple archives |
| ClubElo | Standard Elo; goal-difference multiplier = sqrt(goal_diff); home-field advantage **self-calibrates daily** per country: `HFA += Σ(ΔElo) · 0.075` | K = 20, fixed | [secondary] — summarized from the site's own System page |
| FIFA World Ranking (2018 revision) | `P' = P + I·(W − We)`, `We = 1 / (10^(−Δ/600) + 1)` — note **c = 600**, not chess's 400, which makes the same rating gap predict a less lopsided result than in Elo; deliberately **excludes** home advantage and margin of victory | Importance weight I ranges 5-10 for friendlies up to 60 for World Cup quarterfinals onward — a **12x span**, versus our own K-factor's 2x span across match types | [primary] — FIFA's own procedural documentation |
| Opta / Stats Perform | Elo-style Power Rankings (0-1000) fused with bookmaker odds, resolved by Monte Carlo (10,000+ runs); xG is a separate shot-quality model with no confirmed direct link to the rating | Public claims of "60-65% accuracy" | [marketing] — no published methodology paper |

### 2.2 Academic baseline

- **Maher (1982)** [primary]: independent Poisson with λ = attack strength × opponent defense strength × home factor. This is structurally identical to `calculateLambda()` in our implementation (Section 3.2).
- **Dixon & Coles (1997)** [primary]: the τ correction we use (`dixonColesCorrection()`) matches the published formula term for term — τ₀₀ = 1 − λμρ, τ₁₀ = 1 + μρ, τ₀₁ = 1 + λρ, τ₁₁ = 1 − ρ. Published ρ values for domestic league football fall between −0.03 and −0.15; our −0.13 is inside that range, though we note the original estimate was fit on club football, not international tournaments. The paper's recommended exponential time-decay half-life (60-300 days) also brackets our 180-day value.
- **Karlis & Ntzoufras (2003)** [primary, structure verified]: bivariate Poisson with an added covariance term λ₃, intended to capture the correlation between two teams' goal counts directly rather than through a post-hoc correction. We found no published number showing it materially outperforms Dixon-Coles on outcome accuracy, and did not adopt it (Decision D5, Section 6).

### 2.3 Does machine learning help? Three independent findings

- **arXiv:2408.08331**, "Match predictions in soccer: ML vs. Poisson approaches" [primary]: tested across Europe's top five leagues; the paper's own conclusion is that "feature selection and model selection both have only a marginal effect on prediction quality."
- **Groll, Ley, Schauberger & Van Eetvelde (2018)**, arXiv:1806.03208 [primary, paraphrased]: the actual finding is more specific than "random forests don't help" — a random forest fit on **ranking-based team-strength features** outperformed plain Poisson/ranking methods across 2002-2014 tournaments. The gain traces to feature quality (a good strength proxy), not the algorithm; swapping in a fancier model without that feature did not reproduce the effect.
- **hjjbh1314/worldcup-predictor** [primary, reproducible code]: on the same martj42 dataset, gradient boosting with added features (form, fatigue, fixture congestion, neutral-venue flag) moved accuracy from an Elo baseline of 60.0% to 60.0% — "essentially nothing." Permutation importance assigned +0.34 to `elo_diff` alone; every other feature scored below 0.01.
- Claims of "94% accuracy" that circulate publicly for this problem class are, without exception in what we reviewed, unaccompanied by a walk-forward evaluation; several visible Kaggle notebooks for World Cup prediction split data randomly rather than by time, which leaks future Elo state into training. On small samples, complexity does not reliably help even where careful evaluation is used: a comparison of eleven models on Towards Data Science found logistic regression beating XGBoost and a neural network after cross-validation.

### 2.4 Open-source peer projects, 2026 World Cup cycle

| Project | Method | Key finding | Relevance to us |
|---|---|---|---|
| [hjjbh1314/worldcup-predictor](https://github.com/hjjbh1314/worldcup-predictor) (Python, MIT) | Standard eloratings.net Elo + multinomial logistic outcome head; 49k matches, 8,021-match test set | Elo baseline 60.0% / RPS 0.171; **Dixon-Coles made results worse** (58.4% vs. 60.5% for calibrated Elo alone); continental-strength correction added +1.5pp on cross-confederation matches (UEFA +117, CONMEBOL +104, OFC −171); grid search confirmed eloratings.net's default parameters were already near-optimal | 60% appears to be the practical ceiling for this model family; continental correction is a plausible increment; first independent warning on Dixon-Coles |
| [playmobil/worldcup-forecast](https://github.com/playmobil/worldcup-forecast) (Python, 127 stars) | Hierarchical Bayesian Poisson (PyMC) with Klement-style structural priors (GDP, population, climate, football culture) plus leak-checked Elo; 305-match locked-window paired bootstrap | **Dixon-Coles ρ ≈ 0, no effect**; LightGBM performed materially worse than the Bayesian model; **squad market value is a useful anchor** (closes roughly 30% of the gap to market-implied probabilities on lopsided fixtures); continental factors fed as a plain feature added nothing; explicit design stance that market data should never be a model input, only a benchmark | Second independent warning on Dixon-Coles; second and independent vote for squad-value as a signal; "market as benchmark, not input" is a legitimate alternative design philosophy to ours |
| [SilvioBaratto/worldcup-2026-prediction](https://github.com/SilvioBaratto/worldcup-2026-prediction) (Python) | Dixon-Coles bivariate Poisson with an Elo prior (weight 0.8) and a squad-value prior (weight 0.7), resolved by 100,000-run Monte Carlo | Squad-value prior tracked bookmaker consensus (FanDuel) more closely than Elo alone (L1 = 0.139, Spearman = 0.93) | Third independent vote for squad value |
| [AhmedHazem02/fifa-world-cup-2026-prediction-agent](https://github.com/AhmedHazem02/fifa-world-cup-2026-prediction-agent) (TypeScript, 84 stars) | Ensemble: Elo 35% / Poisson 30% / recent form 20% / squad value 15% | Ships six named weight presets (balanced, elo-heavy, form-heavy, etc.) that users can switch between | Same language stack as ours; the idea of a small number of named, auditable weight presets rather than one fixed blend is worth considering |
| BrazilianFootball/WorldCup2026 (academic, FGV) | Parallel Stan Bayesian MCMC and frequentist Dixon-Coles pipelines, model selection by Brier score | The production model that was actually selected is a Poisson-with-ranking-prior variant, not plain Dixon-Coles | Academic practice converges on the same Poisson-plus-strength-prior family, not a more exotic method |

**Cross-check on data provenance.** All of the above use martj42/international_results (CC0). We independently verified openfootball/worldcup.json against our own hand-checked 2018 and 2022 records — zero discrepancies across 128 matches. Our own 49,000-match Elo replay produced a pre-2026 top five (Spain 2235, Argentina 2212, France 2145, England 2102, Brazil 2094) within 30 points of hjjbh1314's independent implementation (2224, 2187, 2128, 2088, 2066) — a useful sanity check that two independently written Elo replays over the same public data converge.

### 2.5 Market odds (scoped for future work, not yet implemented)

Both the academic literature and the peer projects above agree that market odds are the one input class with a consistently demonstrated edge over pure statistical models — though the edge is modest: one study found model and market Brier scores statistically indistinguishable in most league-seasons at conventional significance levels, and typical football-model Brier scores cluster around 0.25-0.27 on a normalized three-outcome basis. The standard de-vigging method (removing bookmaker margin to recover implied probabilities) is Shin's method (1993), designed to account for the favorite-longshot bias introduced by informed betting; naive proportional normalization, which is what our current `calcOddsFactor()` implementation uses, is known to be inferior. Scraping bookmaker sites violates their terms of service; the legitimate path is a licensed aggregator API such as the-odds-api.com, for which hjjbh1314's `predict_with_odds.py` is a usable reference implementation. This is scoped as independent future work (Section 8), not yet built.

## 3. System Architecture

### 3.1 Elo core

Base rating 1500. K-factor is set by competition tier: 60 for World Cup matches, 50 for continental championships, 45 for qualifiers, 30 for friendlies. Home advantage adds a flat 100 Elo points to the home team's rating before computing expected score, using the standard logistic form `E = 1 / (1 + 10^((R_away − R_home) / 400))`. A cold-start team (no history) is seeded from FIFA ranking via a linear map, rank 1 → 2100, decreasing by 12 points per rank position, floored at 1200.

Two adjustments beyond textbook Elo:

- **Margin-of-victory multiplier.** Rating changes scale with goal difference: ×1.0 for a one-goal result, ×1.5 for two goals, ×1.75 for three, and ×(1.75 + (diff − 3)/8) beyond that.
- **Exponential recency decay.** A match's effective K-factor decays as `K · e^(−0.00385 · days_ago)`, a half-life of roughly 180 days, so a friendly from three years ago barely moves a team's current rating while a match from the same tournament carries close to full weight.

Draw probability is estimated heuristically as `max(0.15, 0.30 − 0.0003 · |rating_diff|)` — closely matched teams draw more often, with a floor of 15% regardless of the rating gap. This floor is a deliberate calibration choice discussed further in Section 6.3.

### 3.2 Independent Poisson core with Dixon-Coles correction

Each side's expected goals are computed as `λ = 1.2 · attack_strength · opponent_defense_strength`, multiplied by a further 1.2 if the team is at home. The constant 1.2 is the empirical average goals per team per match across recent World Cups; attack and defense strengths in the seed ratings are calibrated against that same figure, so a league-average attacking team has `attack_strength ≈ 1.0`.

When in-tournament expected-goals (xG) data is available, λ is blended with a real xG estimate rather than the purely historical figure: 20% weight to xG once a team has at least two matches of data, rising to 40% once it has five or more. With fewer than two matches, the model falls back to the historical estimate with no xG contribution, and this fallback is disclosed to the user rather than hidden.

For knockout matches, λ is shrunk to reflect historically tighter, lower-scoring football: 0.90× in the round of 16, 0.87× in the quarterfinal, 0.83× in the semifinal, 0.80× in the final, with an additional multiplicative shrink applied when the opponent has elite defensive metrics.

The resulting goal-probability matrix (0-5 goals each side) is adjusted with the Dixon-Coles τ correction (ρ = −0.13, Section 2.2) before the win/draw/loss probabilities and the most likely scoreline are read off.

### 3.3 Pre-match fusion

The pre-match number shown to a user is not the Poisson output alone. Five signals are combined by weighted average — Elo 0.30, Poisson 0.25, market odds 0.20, head coach factor 0.15, venue/travel factor 0.10 — with each signal's weight adjusted by a confidence term specific to that signal (for example, the Poisson signal's confidence drops from 0.85 to 0.40 if the two sides' win probabilities are within 5 percentage points of each other, since a near-even Poisson output carries less information than a clearly separated one; the venue signal's confidence is zero when no venue data is available for the fixture).

We describe this as a hierarchical structure rather than a flat ensemble: Elo functions as a slow-moving prior reflecting a team's long-run quality, and current-tournament xG functions as fast-updating evidence that is weighted more heavily as the sample size within the tournament grows. The output is reported as a confidence interval, not a point estimate — for example "58-75%, medium confidence" rather than "68%" — with interval width driven by four factors: how much the Elo and Poisson signals disagree with each other, how little current-tournament xG data exists (as few as three matches per team in the group stage), how uncertain the starting lineup is, and, in the knockout stage, the added variance from extra time and penalties.

### 3.4 Live repricing: Track A and Track B

This is the part of the system we consider the most consequential design decision, and the one most public prediction tools do not appear to make explicit.

**Track A — moves probability, accepts only hard facts.** Score, elapsed time, red cards, and knockout status. Remaining-match goal expectation is rescaled proportionally to time remaining under a continued-Poisson assumption; a red card multiplies the affected team's λ by 0.72, based on the historical scoring-rate reduction for ten-man teams. As concrete anchors: a 1-0 home lead at the 60th minute corresponds to roughly 82% home win probability in our model; a 1-1 draw in a knockout match at the 90th minute gives both sides roughly 51% (the remainder being the extra-time/penalty branch).

**Track B — display only, does not move probability until backtested.** Shots on target, corners, possession, and crosses are converted into a Pressure Index from 0 to 100 (Section 3.5). This index is deliberately not wired into the win-probability output. The reasoning: converting "more corners" directly into "+3 percentage points of win probability" is simply moving a hand-authored weight from the pre-match model into the live model, dressed up as real-time intelligence. Before any Track B signal is allowed to move probability, it must pass the same kind of backtest the pre-match signals did — specifically, a test of whether that signal's appearance predicts a goal in the following 5, 10, or 15 minutes at a rate above the base rate for that game state. No signal has cleared that bar yet in our evaluation; all Track B output today is descriptive.

The Track A/B split was motivated by watching three matches during the 2026 tournament — Jordan vs. Algeria, Argentina vs. Austria, and Portugal vs. Uzbekistan — where the trailing side visibly built shot and corner volume for several minutes before the eventual goal. The design goal is a model that can, once validated, start moving before the goal rather than only reacting after it, without pretending that goal already happened.

### 3.5 Pressure Index

The Pressure Index measures how much attacking threat a team has accumulated over the preceding roughly 15 minutes; it is explicitly not a win-probability estimate. It is computed as a weighted sum of per-15-minute rates: shots on target 35% (the single strongest individual signal), total shots 20%, corners 20%, possession 15% (used as a level, not a delta), crosses 10%. Each component is normalized against a reference ceiling for a 15-minute window — 4 shots on target, 5 corners, 70% possession are each treated as maximal.

A **surge alert** fires when a trailing team's Pressure Index stays at or above 65 for three consecutive snapshots (roughly three minutes) without a goal — the pattern observed ahead of Algeria's 69th-minute equalizer against Jordan. The Pressure Index and Track A win probability are shown side by side rather than merged, so a user can see, for instance, that a team is under heavy pressure (Track B) while the scoreboard leader's win probability has not moved (Track A), and understand why both statements are simultaneously true.

### 3.6 Structural trigger points

Rather than polling continuously, the system snapshots state and reprices at defined moments: kickoff, the roughly 30th-minute hydration break, every goal, substitutions flagged as tactically significant, the 45th minute, first-half stoppage time, the 75th-minute hydration break, the 90th minute, second-half stoppage time, and — for knockout draws — each 15-minute period of extra time, its stoppage time, and the penalty shootout. Hydration breaks and halftime have no dedicated event type in the underlying data feed and are inferred from match clock alone. A goal always triggers an immediate reprice, since scoreline is a stronger state variable than elapsed time: at an identical match minute, a 1-0 lead versus a 0-1 deficit can correspond to a win-probability swing exceeding 60 percentage points.

### 3.7 Post-match learning loop

After a match concludes, the system passes the pre-match snapshot, final score, key events, and available news evidence to a large language model, which is asked to categorize the outcome into one of seven failure modes (tactical mismatch, an unknown pre-match injury, weather, a refereeing effect, deliberate tactical deception, a black-swan event such as an early red card, or ordinary statistical variance) and to produce two kinds of lessons: team-specific observations tied to a concrete minute range or statistic (not generic statements like "needs to defend better"), and a global-model lesson describing a specific, mechanical change to the prediction engine.

Each lesson is required to register a falsifiable, checkable prediction — for example, "does the box-entry rate rise after this substitution pattern in the team's next match" — which is automatically checked against that next match. A lesson that does not outperform the base rate has its weight decayed, and a lesson unverified after three matches expires. We regard this verification step as the part of the loop that actually matters: a "lesson" that is only ever written and never checked is not a learning loop, it is a diary. The AI layer operates strictly in what we call shadow mode — it can read match data, write lessons, and explain the model's own reasoning, but it cannot output a probability number or alter one. Only a signal that has separately cleared a backtest can be promoted into the mathematical layers described in Sections 3.1-3.5.

## 4. Evaluation Methodology

Evaluation uses walk-forward backtesting rather than a random train/test split, because a random split allows a team's post-tournament Elo rating (which reflects results the model is being asked to predict) to leak into the features used to predict those same results. Matches are grouped by kickoff date; every match on a given date is predicted using only state available before that date, and ratings are updated only after all of that date's predictions have been made, which prevents same-day information leakage between simultaneous fixtures.

Two issues were identified and corrected in the course of this evaluation:

1. **Cold-start bias.** The original 128-match evaluation set (2018 and 2022 World Cups only) started every team from a default 1500 Elo rating with no history, which is a materially different (and easier to get wrong) situation than a team entering the tournament with an accurate rating built from years of prior results. We corrected this by replaying all 49,487 completed matches in the martj42/international_results dataset in chronological order and taking a rating snapshot immediately before each of 24 World Cups (1930-2022), stored in `data/elo-seed.json` with team-name alias mapping to handle historical name changes (e.g., West Germany / Germany). This produces a warm-start rating for the backtest that mirrors how the production system's seed ratings are actually built, with no information from the tournament itself leaking into the pre-tournament snapshot.
2. **Sample size.** The 128-match evaluation set covered two tournaments. We expanded it to 964 matches across all 24 World Cup finals tournaments (1930-2022) using openfootball/worldcup.json (CC0), cross-validated against our own hand-checked 2018/2022 data with zero discrepancies across the overlapping 128 matches.

Uncertainty is reported as a 95% bootstrap confidence interval. Extra-time scorelines are recorded as the cumulative score at the end of extra time (for example, the 2022 final is recorded 3-3, not the penalty-shootout result, which is never used as a match outcome). The abandoned 1938 Sweden-Austria fixture is excluded for lack of a recorded score, and the 1950 final round, which was a round-robin rather than a knockout format, is not treated as a knockout match in the evaluation.

## 5. Results

| Evaluation set | Matches | Outcome accuracy [95% CI] | Brier | Log loss |
|---|---|---|---|---|
| 2018 + 2022, cold-start | 128 | 42.19% [33.6%, 51.6%] | 0.6533 | 1.0808 |
| Same 128 matches, warm-start only | 128 | 49.22% [41.4%, 57.8%] | 0.6168 | 1.0349 |
| **Full history, warm-start** | **964** | **57.88% [54.8%, 61.1%]** | **0.5708** | **0.9644** |
| Reference: hjjbh1314 Elo baseline | 8,021 | 60.0% | 0.5137 | 0.8735 |

Read together, the cold-start fix alone accounts for +7.0 percentage points on the identical 128-match set (42.19% → 49.22%); the remainder of the gap to 57.88% reflects sample size and era composition — earlier World Cups had more lopsided matchups than the historically close 2018 and 2022 tournaments. The 964-match confidence interval [54.8%, 61.1%] overlaps the 60.0% Elo-baseline reference from an independent 8,021-match implementation, which we read as evidence that this engine performs within the normal range for its model family rather than exhibiting an implementation defect. The remaining Brier gap (0.5708 vs. 0.5137) is discussed in Section 6.3.

### 5.1 Dixon-Coles ablation

Two peer projects (Section 2.4) independently reported that the Dixon-Coles low-score correction was neutral or actively harmful for international outcome prediction, which prompted us to test the correction directly on our own 964-match set:

| Configuration | Accuracy | Brier |
|---|---|---|
| ρ = −0.13 (current) | 57.88% | 0.5708 |
| ρ = 0 (correction disabled) | 58.09% | 0.5692 |

The confidence intervals for these two configurations overlap; the difference is not statistically distinguishable. We read this as the correction being "neither helpful nor harmful" in our pipeline specifically — not a contradiction of the peer reports, since in our implementation the τ correction acts only on the score matrix and is renormalized before the win/draw/loss probabilities are read off, which structurally limits how much it can move the 1x2 outcome regardless of sign. Our decision (Section 6, D1) is to leave the code as-is: an untested change with no measured accuracy benefit is not worth the behavior risk, and the correction retains value in the score-distribution display even where it does not move the outcome call.

## 6. Discussion

**What actually drove the improvement.** The single largest, most confidently attributable gain in this evaluation is the cold-start fix (+7.0pp on a matched 128-match set), not any change to the mathematical model itself. This matches a pattern we saw across the peer-project literature (Section 2.3): gains in this problem class tend to come from getting the input data right, not from a more sophisticated model.

**What did not help.** Three independent lines of evidence (an arXiv comparison paper, a replicated finding from Groll et al. 2018, and an independent gradient-boosting replication by a peer project) converge on the same conclusion: adding model complexity on top of Elo-quality features does not move outcome accuracy in this domain, and can perform worse on the small sample sizes a single World Cup provides. We treat this as the strongest reason not to add a machine-learning layer to the outcome prediction (Decision D4).

**Dixon-Coles: a genuinely mixed signal.** We do not think Section 5.1's result should be read as "Dixon-Coles is fine, ignore the peer warnings." The honest reading is that its effect on 1x2 outcome accuracy is close enough to zero, in our specific pipeline, that we cannot distinguish it from noise with 964 matches — which is a different claim from "it helps." We kept it because removing it is a behavior change we have no positive evidence to justify, and because its actual value in our product is the displayed scoreline probability matrix (where the low-score correction is directly meaningful), not the outcome call this ablation measured.

### 6.3 Why the Brier score still trails the reference baseline

Our 964-match Brier score (0.5708) is worse than the independent 8,021-match Elo-baseline reference (0.5137) even though the two accuracy figures' confidence intervals overlap. Brier score is more sensitive than raw accuracy to how confidently a model states an incorrect answer, and two specific design choices in our pipeline widen it relative to a leaner Elo-only baseline: a deliberate 15% floor on estimated draw probability regardless of rating gap (Section 3.1), which costs Brier score in the (common) case of a genuinely lopsided match that nonetheless does not end in a draw; and the additional variance introduced by fusing five signals rather than reporting Elo alone, each with its own estimation noise. We consider this a calibration issue rather than a directional one, and expect the future calibration-layer work in Section 8 to narrow it, though the achievable ceiling is limited by the size of the effect (a few hundredths of a Brier point on a 0-1 scale).

## 7. Limitations

- **Single-domain generalization is untested.** All evaluation here is on FIFA World Cup finals matches. We make no claim about performance on domestic league football, continental tournaments, or qualifiers, where different K-factors, opponent-strength distributions, and (for leagues) a much larger within-competition sample would apply.
- **Small within-tournament sample.** A team plays as few as three matches in the group stage, which limits how much weight current-tournament xG can carry (Section 3.2) and is one reason confidence intervals are reported rather than point estimates.
- **Unofficial data source.** Live scores, events, and rosters are drawn from ESPN's public JSON API, which is not an officially documented or licensed interface; it is widely used across open-source sports projects but availability and schema stability are outside our control.
- **The one signal known to have a consistent edge is not yet integrated.** Market odds are, by the literature reviewed in Section 2.5, the most reliable outperformer of pure statistical models, and are explicitly scoped as future work rather than shipped.
- **Self-evaluated.** All figures in this paper come from our own backtesting pipeline; none of it has been independently audited by a third party, and we have not submitted these results to peer review. We have tried to compensate for this by citing peer projects' own numbers rather than only our own, and by reporting a negative result (Section 5.1) rather than omitting it.
- **The AI explanation layer is unaudited for bias.** The post-match learning loop (Section 3.7) depends on a large language model's categorization of failure modes; we have not measured whether that categorization is itself systematically biased toward any particular failure category.

## 8. Future Work

Ranked by expected value based on the evidence in Section 2:

1. **Market-odds track.** Replace the current naive-proportional de-vigging in `calcOddsFactor()` with Shin's (1993) method; integrate a licensed odds API; decide, as an explicit design choice rather than a default, whether the market signal is fused into the probability (our original design intent) or shown as an independent benchmark alongside the model (the design stance taken by playmobil/worldcup-forecast, Section 2.4). This is the only signal class in Section 2 with consistent literature support for outperforming pure statistical models.
2. **Squad-value signal.** Supported independently by three peer projects (Section 2.4). Requires a data-availability assessment (Transfermarkt or similar) and would be evaluated as a blended weight on the Elo prior via the same `compareBaseline` gate used for the Dixon-Coles ablation.
3. **Continental-strength adjustment.** hjjbh1314 measured a +1.5pp gain from a continental correction on cross-confederation matches; our own 49,000-match dataset already contains what is needed to fit per-confederation adjustments, provided they are injected into the probability head directly rather than fed as a plain feature (which playmobil found to be ineffective).
4. **Calibration layer.** A Platt or temperature-scaling pass to close the Brier gap discussed in Section 6.3; hjjbh1314 measured a small but real gain from an equivalent step (RPS 0.1704 → 0.1698). This would also be a natural place to address the post-pandemic home-advantage decay noted in the peer literature but not yet corrected for here.
5. **Parameter cleanup (low priority).** An unused legacy constant (`baseLambda = 1.5`) remains in `prediction.js` from before the Poisson core's default was recalibrated to 1.2 (Section 3.2); it does not affect current behavior but should be removed, gated by `compareBaseline`, now that a 964-match baseline exists to verify against.

## 9. Conclusion

We do not claim this system outperforms the published literature; the 964-match result places it inside the normal range for Elo-plus-Poisson systems, not ahead of it. What we think is worth documenting and reusing is the evaluation discipline that got us to a trustworthy number in the first place — same-day leak isolation, a corrected cold-start procedure, and a bootstrap confidence interval reported alongside the point estimate — and the architectural pattern of gating live in-match signals behind a backtest before they are allowed to move a displayed probability. Both are less about football and more about not fooling ourselves, which we suspect is the more transferable part of this work.

## References

1. Maher, M. J. (1982). Modelling association football scores. *Statistica Neerlandica*, 36(3).
2. Dixon, M. J., & Coles, S. G. (1997). Modelling Association Football Scores and Inefficiencies in the Football Betting Market. *Journal of the Royal Statistical Society: Series C*, 46(2).
3. Karlis, D., & Ntzoufras, I. (2003). Analysis of sports data by using bivariate Poisson models. *Journal of the Royal Statistical Society: Series D*, 52(3).
4. Groll, A., Ley, C., Schauberger, G., & Van Eetvelde, H. (2018). A hybrid random forest to predict soccer matches in international tournaments. arXiv:1806.03208.
5. Match predictions in soccer: ML vs. Poisson approaches. arXiv:2408.08331.
6. Shin, H. S. (1993). Measuring the Incidence of Insider Trading in a Market for State-Contingent Claims. *The Economic Journal*, 103(420).
7. FIFA World Ranking: Procedure. FIFA.com technical documentation.
8. FiveThirtyEight, Soccer Power Index methodology (archived, service discontinued 2023).
9. ClubElo.com, World Football Elo Ratings — System description.
10. [hjjbh1314/worldcup-predictor](https://github.com/hjjbh1314/worldcup-predictor) (GitHub, MIT license).
11. [playmobil/worldcup-forecast](https://github.com/playmobil/worldcup-forecast) (GitHub).
12. [SilvioBaratto/worldcup-2026-prediction](https://github.com/SilvioBaratto/worldcup-2026-prediction) (GitHub).
13. [AhmedHazem02/fifa-world-cup-2026-prediction-agent](https://github.com/AhmedHazem02/fifa-world-cup-2026-prediction-agent) (GitHub).
14. martj42/international_results (GitHub, CC0) — full-history international match results.
15. openfootball/worldcup.json (GitHub, CC0) — World Cup finals match data, 1930-2022.

---

*Implementation references: `lib/elo.js`, `lib/poisson.js`, `lib/prediction.js`, `lib/live-reprice.js`, `lib/services/pressure-index.js`, `lib/services/moment-detector.js`, `lib/postMatchReview.js`, `lib/jobs/ai-postmortem.js`, `lib/backtest.js`. Evidence log with full data-collection detail: [prediction-methodology-review.md](./prediction-methodology-review.md).*
