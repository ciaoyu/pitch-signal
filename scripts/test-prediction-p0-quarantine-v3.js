#!/usr/bin/env node
/**
 * Owner A — P0 quarantine v3 acceptance test (engine + service + API).
 *
 * Scope (per remediation master plan §5 / reviewer rework notes v2 -> v3):
 *  - Coach / capacity-Venue / Fatigue truly removed from the probability.
 *  - Neutral-venue rule: nominal home advantage CLOSED for ALL World Cup
 *    matches; host is a recorded FACT only (hostSide), even when the host is
 *    the nominal away team. Host effect size is NOT applied (waits for Owner E).
 *  - Manual KO λ shrinkage removed (regulation identical for KO vs group).
 *  - Environmental hand-tuned β (0.03 / 0.01 / 32°C) downgraded to shadow/display.
 *  - advance is UNAVAILABLE (home:null / away:null), never a pseudo 50/50.
 *  - configHash is a COMPLETE model contract.
 *
 * v3 NEW (reviewer blockers from the v2 rejection):
 *  B1. P0 PUBLIC probability is formed ONLY from Elo + Poisson. odds / Market
 *      Value / Continental are candidate-only and CANNOT change the public
 *      number even when injected / even when the env gate is open.
 *  B2. World Cup neutral-venue detection is FAIL-CLOSED: decided by the schedule
 *      snapshot (authoritative WC fixture list), NOT by venue parsing. Venue
 *      parse failure keeps neutralVenue=true (hostSide='none').
 *  B3. The two hand-tuned "confidence" outputs are renamed to
 *      heuristicUncertainty / heuristicConfidence and marked status:'unvalidated'
 *      — no statistical-CI / "95% CI" semantics.
 *
 *  A v4 (reviewer acceptance follow-up): the SERVICE-LAYER result metadata must
 *  not contradict B1. predictionSource = 'elo_poisson' (never 'baseline_plus_odds');
 *  externalOddsUsed / marketValueSignalUsed / continentalStrengthSignalUsed are
 *  ALWAYS false; externalOddsAvailable / marketValueCandidateAvailable /
 *  continentalCandidateAvailable are true ONLY when the raw signal was observed
 *  (so it can still be shown as a transparent, non-fused candidate). Frontend,
 *  audit records and paper readers must never infer a candidate signal entered
 *  the public probability.
 */

const assert = require('assert');
const PredictionEngine = require('../lib/prediction');
const PredictionService = require('../lib/services/PredictionService');
const createPredictionRoutes = require('../lib/routes/prediction');
const { detectKnockout } = require('../lib/knockoutStage');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const ratings = require('../data/ratings.json').teams;
const engine = new PredictionEngine();

async function main() {
  console.log('=== Owner A — P0 quarantine v3 (engine + service + API) ===\n');

  // =====================================================================
  // A. ENGINE: neutral-venue / host rule
  // =====================================================================
  console.log('📊 A. Neutral venue & host rule');
  {
    const A = ratings['Germany'];
    const B = ratings['France'];

    const predAB = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B, neutralVenue: true });
    const predBA = engine.predict({ homeId: 'France', awayId: 'Germany', homeRating: B, awayRating: A, neutralVenue: true });

    check(near(predAB.homeWin, predBA.awayWin, 1e-9), 'neutral: swap home/away swaps homeWin/awayWin (no home advantage)');
    check(near(predAB.awayWin, predBA.homeWin, 1e-9), 'neutral: swap home/away swaps awayWin/homeWin');
    check(predAB.host && predAB.host.applyHome === false, 'neutral: host.applyHome === false');
    check(predAB.host && predAB.host.neutralVenue === true, 'neutral: host.neutralVenue === true');

    const predHostHome = engine.predict({ homeId: 'USA', awayId: 'Mexico', homeRating: ratings['USA'], awayRating: ratings['Mexico'], neutralVenue: true, hostTeamId: 'USA' });
    const predNoHost = engine.predict({ homeId: 'USA', awayId: 'Mexico', homeRating: ratings['USA'], awayRating: ratings['Mexico'], neutralVenue: true });
    check(near(predHostHome.homeWin, predNoHost.homeWin, 1e-9), 'host-as-home: no host bonus applied (hostSide is fact-only)');
    check(predHostHome.host.hostSide === 'home' && predHostHome.host.applyHome === false, 'host-as-home: hostSide=home but applyHome=false');

    const predHostAway = engine.predict({ homeId: 'Mexico', awayId: 'USA', homeRating: ratings['Mexico'], awayRating: ratings['USA'], neutralVenue: true, hostTeamId: 'USA' });
    check(predHostAway.host.hostSide === 'away' && predHostAway.host.applyHome === false, 'host-as-away: hostSide=away, applyHome=false (rejection case handled)');
    check(near(predHostAway.homeWin, predNoHost.awayWin, 1e-9), 'host-as-away: probability equals the swapped no-host case (no advantage)');

    const predNeutral = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B, neutralVenue: true });
    const predLegacy = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B });
    check(predLegacy.homeWin > predNeutral.homeWin, 'legacy (non-neutral): home advantage boosts home team vs neutral');
    check(predLegacy.awayWin < predNeutral.awayWin, 'legacy (non-neutral): away team penalized vs neutral');
  }

  // =====================================================================
  // B. ENGINE: Coach / capacity-Venue / Fatigue removed from probability
  // =====================================================================
  console.log('\n📊 B. Coach / capacity-Venue / Fatigue removed');
  {
    const A = ratings['Germany'];
    const B = ratings['France'];
    const base = { homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B };

    const pred = engine.predict(base);

    check(!('coach' in pred.components), 'components.coach absent');
    check(!('venue' in pred.components), 'components.venue absent');
    check(!('fatigue' in pred.components), 'components.fatigue absent');
    check(!('coach' in pred.weights), 'weights.coach absent');
    check(!('venue' in pred.weights), 'weights.venue absent');
    check(!('fatigue' in pred.weights), 'weights.fatigue absent');

    const predWithEspn = engine.predict({ ...base, homeEspnId: '1', awayEspnId: '2' });
    check(near(pred.homeWin, predWithEspn.homeWin, 1e-9) &&
          near(pred.draw, predWithEspn.draw, 1e-9) &&
          near(pred.awayWin, predWithEspn.awayWin, 1e-9),
      'coach not used: result identical with/without ESPN coach ids');

    const venueObj = { name: 'SoFi Stadium', capacity: 70000 };
    const predWithVenue = engine.predict({ ...base, venue: venueObj });
    check(near(pred.homeWin, predWithVenue.homeWin, 1e-9),
      'capacity-venue not used: result identical with/without venue object');

    check(Array.isArray(pred.quarantinedSignals) &&
          pred.quarantinedSignals.includes('coach') &&
          pred.quarantinedSignals.includes('venue') &&
          pred.quarantinedSignals.includes('fatigue'),
      'quarantinedSignals lists coach/venue/fatigue');
  }

  // =====================================================================
  // C. ENGINE: KO λ shrinkage quarantined; regulation/advance split
  // =====================================================================
  console.log('\n📊 C. KO shrink quarantined + regulation/advance split');
  {
    const A = ratings['Germany'];
    const B = ratings['France'];
    const base = { homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B };

    const predGroup = engine.predict(base);
    const predKO = engine.predict({ ...base, isKnockout: true, knockoutRound: 'QF' });

    check(near(predGroup.homeWin, predKO.homeWin, 1e-9) &&
          near(predGroup.draw, predKO.draw, 1e-9) &&
          near(predGroup.awayWin, predKO.awayWin, 1e-9),
      'regulation (90-min) identical for KO vs group');
    check(near(predGroup.goals.homeExpected, predKO.goals.homeExpected, 1e-9), 'expected goals identical for KO vs group');

    check(predKO.advance && predKO.advance.available === false, 'advance.available === false');
    check(predKO.advance && predKO.advance.home === null && predKO.advance.away === null,
      'advance returns home:null/away:null (NOT a 50/50 split)');
    check(predKO.advance && predKO.advance.usedInModel === false, 'advance.usedInModel === false');
    check(predGroup.advance === null, 'group match: advance === null');

    check(predKO.knockout && predKO.knockout.isKnockout === true &&
          predKO.knockout.lambdaShrinkageQuarantined === true,
      'knockout.lambdaShrinkageQuarantined === true');
  }

  // =====================================================================
  // D. ENGINE: Environmental β quarantined to shadow/display
  // =====================================================================
  console.log('\n📊 D. Environmental β shadow-only');
  {
    const A = ratings['Germany'];
    const B = ratings['France'];
    const pred = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B, matchId: '760484' });

    const poissonComp = pred.components.poisson;
    check(poissonComp.envApplied === false, 'poisson.envApplied === false');
    check(poissonComp.envAppliedInModel === false, 'poisson.envAppliedInModel === false');
    check(poissonComp.homeLambdaAdj === poissonComp.homeLambda, 'env does NOT change λ (homeLambdaAdj === homeLambda)');
    check(poissonComp.awayLambdaAdj === poissonComp.awayLambda, 'env does NOT change λ (awayLambdaAdj === awayLambda)');
    check(pred.venueFactor && pred.venueFactor.appliedInModel === false, 'venueFactor.appliedInModel === false');
    check(pred.venueFactor && pred.venueFactor.status === 'shadow_only', 'venueFactor.status === shadow_only');
  }

  // =====================================================================
  // E. ENGINE: complete modelContract + configHash
  // =====================================================================
  console.log('\n📊 E. modelContract + configHash (complete)');
  {
    const pred = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: ratings['Germany'], awayRating: ratings['France'] });
    check(/^[0-9a-f]{12}$/.test(pred.configHash), `configHash is 12-hex (${pred.configHash})`);
    check(pred.modelVersion === 'p0-quarantine-v3-2026-07-10', 'modelVersion is p0-quarantine-v3-2026-07-10');
    const mc = pred.modelContract;
    check(mc && mc.activeSignals.join(',') === 'elo,poisson', 'activeSignals = [elo,poisson]');
    check(Array.isArray(mc.publicFusionSignals) && mc.publicFusionSignals.join(',') === 'elo,poisson', 'publicFusionSignals = [elo,poisson]');
    check(Array.isArray(mc.p0PublicFusionExcludes) &&
          mc.p0PublicFusionExcludes.join(',') === 'odds,marketValue,continentalStrength',
      'p0PublicFusionExcludes = odds,marketValue,continentalStrength');
    check(mc.candidates && mc.candidates.odds.usedInModel === false &&
          mc.candidates.marketValue.usedInModel === false &&
          mc.candidates.continentalStrength.usedInModel === false,
      'modelContract.candidates.*.usedInModel === false');
    check(mc.baseWeights.fatigue === 0 && mc.baseWeights.coach === 0 && mc.baseWeights.venue === 0,
      'modelContract weights: coach/venue/fatigue = 0');
    check(mc.baseWeights.odds === 0 && mc.baseWeights.marketValue === 0 && mc.baseWeights.continentalStrength === 0,
      'modelContract weights: odds/marketValue/continentalStrength = 0 (candidate-only)');
    check(mc.poisson && typeof mc.poisson.rho === 'number', 'modelContract covers poisson.rho');
    check(mc.envFactors && mc.envFactors.status === 'shadow_only' && mc.envFactors.appliedInModel === false,
      'modelContract covers env β (shadow_only)');
    check(mc.gates && mc.gates.polymarket === false, 'modelContract gates.polymarket === false');
    check(mc.knockoutShrinkage && mc.knockoutShrinkage.quarantined === true, 'modelContract knockoutShrinkage.quarantined === true');
    const tweaked = new PredictionEngine({ weights: { elo: 0.6, poisson: 0.4 } });
    check(tweaked.configHash !== pred.configHash, 'configHash changes when weights change (contract is complete)');
  }

  // =====================================================================
  // F. BLOCKER B1: P0 public path = Elo + Poisson ONLY
  //    Injecting odds / Market Value / Continental must NOT change the public
  //    probability, even with the env gate open.
  // =====================================================================
  console.log('\n📊 F. [B1] P0 public probability = Elo + Poisson only (candidates cannot change it)');
  {
    const A = ratings['Germany'];
    const B = ratings['France'];
    const base = { homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B };

    const basePred = engine.predict(base);

    // Inject a strongly market-value-leaning signal (home 0.60) — must be ignored.
    const withMV = engine.predict({ ...base, marketValueSignal: { home: 0.60, draw: 0.20, away: 0.20, confidence: 0.8 } });
    // Inject a strongly continental-leaning signal (away 0.60) — must be ignored.
    const withCont = engine.predict({ ...base, continentalStrengthSignal: { home: 0.20, draw: 0.20, away: 0.60, confidence: 0.8 } });
    // Inject real-ish external odds (source 'api', not 'estimated') — must be ignored.
    const withOdds = engine.predict({ ...base, odds: { homeWin: 1.50, draw: 3.50, awayWin: 9.00, source: 'api' } });
    // Inject all three at once — still must be identical to the base.
    const withAll = engine.predict({ ...base,
      marketValueSignal: { home: 0.95, draw: 0.03, away: 0.02, confidence: 0.9 },
      continentalStrengthSignal: { home: 0.02, draw: 0.03, away: 0.95, confidence: 0.9 },
      odds: { homeWin: 6.00, draw: 4.00, awayWin: 1.40, source: 'api' },
    });

    for (const [label, p] of [['marketValue', withMV], ['continental', withCont], ['odds', withOdds], ['all-three', withAll]]) {
      check(near(basePred.homeWin, p.homeWin, 1e-12) &&
            near(basePred.draw, p.draw, 1e-12) &&
            near(basePred.awayWin, p.awayWin, 1e-12),
        `[B1] injecting ${label} leaves public probability BIT-IDENTICAL (${basePred.homeWin.toFixed(3)}/${basePred.draw.toFixed(3)}/${basePred.awayWin.toFixed(3)})`);
    }

    // The injected signals ARE present (computed) but flagged candidate-only.
    check(withAll.candidates && withAll.candidates.marketValue &&
          withAll.candidates.marketValue.usedInModel === false,
      '[B1] marketValue is computed but candidates.marketValue.usedInModel === false');
    check(withAll.candidates && withAll.candidates.continentalStrength &&
          withAll.candidates.continentalStrength.usedInModel === false,
      '[B1] continentalStrength is computed but usedInModel === false');
    check(withAll.candidates && withAll.candidates.odds &&
          withAll.candidates.odds.usedInModel === false,
      '[B1] odds is computed but usedInModel === false');
    check(!('marketValue' in withAll.weights) && !('continentalStrength' in withAll.weights) && !('odds' in withAll.weights),
      '[B1] candidate signals are NOT in the fusion weights map');
    check(basePred.homeWin > 0 && basePred.homeWin < 1, '[B1] sanity: base probability is a valid number');
  }

  // =====================================================================
  // G. BLOCKER B2: FAIL-CLOSED neutral venue in PredictionService
  //    WC membership is from the schedule snapshot; venue parse failure must
  //    keep neutralVenue=true (hostSide='none').
  // =====================================================================
  console.log('\n📊 G. [B2] fail-closed neutral venue (WC by schedule, venue-parse failure stays neutral)');
  {
    // (G1) WC match in schedule (760415 = group) but venue FAILS to parse
    //      (name not in venues.json) -> must STILL be neutral, hostSide='none'.
    const cacheG1 = {};
    const svcFail = new PredictionService(depsFor2({ fullName: 'NonExistent Venue XYZ 9999' }, cacheG1));
    const failRes = await svcFail.predictMatch('760415', { persist: false });
    check(failRes.host && failRes.host.neutralVenue === true,
      '[B2] WC match (760415) with unparseable venue -> neutralVenue === true (fail-closed)');
    check(failRes.host && failRes.host.hostSide === 'none',
      '[B2] venue parse failure -> hostSide === "none" (host not falsely attributed)');
    check(failRes.host && failRes.host.applyHome === false,
      '[B2] venue parse failure -> applyHome === false (no nominal home advantage)');

    // (G2) WC KO match (760484) with a REAL host venue (MetLife Stadium -> USA)
    //      -> neutral + hostSide='home'.
    const cacheG2 = {};
    const svcOk = new PredictionService(depsFor2({ fullName: 'MetLife Stadium' }, cacheG2));
    const okRes = await svcOk.predictMatch('760484', { persist: false });
    check(okRes.host && okRes.host.neutralVenue === true, '[B2] WC KO (760484) -> neutralVenue === true');
    check(okRes.host && okRes.host.hostSide === 'home', '[B2] WC KO host venue -> hostSide === "home" (USA)');
    check(okRes.host && okRes.host.applyHome === false, '[B2] WC KO -> applyHome === false');

    // (G3) Non-WC matchId (999999 not in schedule) -> legacy home advantage.
    const cacheG3 = {};
    const svcLeague = new PredictionService(depsFor2({ fullName: 'MetLife Stadium' }, cacheG3));
    const leagueRes = await svcLeague.predictMatch('999999', { persist: false });
    check(leagueRes.host && leagueRes.host.neutralVenue === false,
      '[B2] non-WC matchId (999999) -> neutralVenue === false (legacy home advantage)');
  }

  // =====================================================================
  // H. BLOCKER B3: confidence renamed + unvalidated; no CI semantics
  // =====================================================================
  console.log('\n📊 H. [B3] confidence -> heuristicUncertainty / heuristicConfidence (unvalidated)');
  {
    const pred = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: ratings['Germany'], awayRating: ratings['France'] });
    check(pred.confidence === undefined, '[B3] result.confidence removed (renamed)');
    check(pred.heuristicUncertainty && typeof pred.heuristicUncertainty.halfWidth === 'number',
      '[B3] result.heuristicUncertainty present with halfWidth');
    check(pred.heuristicUncertainty.status === 'unvalidated',
      '[B3] result.heuristicUncertainty.status === "unvalidated"');
    check(!('level' in pred.heuristicUncertainty) && 'band' in pred.heuristicUncertainty,
      '[B3] no CI "level" field; uses heuristic "band"');

    // via service + output rules
    const cacheH = {};
    const svcH = new PredictionService(depsFor2({ fullName: 'MetLife Stadium' }, cacheH));
    const hRes = await svcH.predictMatch('760484', { persist: false });
    check(hRes.heuristicUncertainty && hRes.heuristicUncertainty.status === 'unvalidated',
      '[B3] service result.heuristicUncertainty.status === "unvalidated"');
    check(hRes.outputMeta && hRes.outputMeta.confidence === undefined,
      '[B3] outputMeta.confidence removed');
    check(hRes.outputMeta && hRes.outputMeta.heuristicConfidence &&
          hRes.outputMeta.heuristicConfidence.status === 'unvalidated',
      '[B3] outputMeta.heuristicConfidence present with status "unvalidated"');
  }

  // =====================================================================
  // I. SERVICE: schedule KO detection + neutral venue + sanitized result
  // =====================================================================
  console.log('\n📊 I. PredictionService (schedule KO + venue neutral detection)');
  {
    const cache = {};
    const deps = {
      getCached: (k) => cache[k] || null,
      setCache: (k, v) => { cache[k] = v; },
      espn: async () => ({
        header: {
          competitions: [{
            venue: { fullName: 'MetLife Stadium' },
            status: { type: { name: 'STATUS_SCHEDULED' } },
            competitors: [
              { homeAway: 'home', team: { id: 'USA', displayName: 'USA' } },
              { homeAway: 'away', team: { id: 'Mexico', displayName: 'Mexico' } },
            ],
          }],
        },
      }),
      getTeamNameZh: (id) => id,
      getTeamNameI18n: (id, fb) => ({ zh: id, en: fb || id }),
      TEAM_FLAGS: { USA: '🇺🇸', Mexico: '🇲🇽' },
      RATINGS: ratings,
      routes: {},
    };

    const svc = new PredictionService(deps);

    const koRes = await svc.predictMatch('760484', { persist: false });
    check(koRes && koRes.knockout && koRes.knockout.isKnockout === true, 'schedule KO detection: result.knockout.isKnockout === true');
    check(koRes.host && koRes.host.neutralVenue === true, 'service: neutralVenue detected (WC by schedule)');
    check(koRes.host && koRes.host.hostSide === 'home', 'service: hostSide = home (USA is home)');
    check(koRes.host && koRes.host.applyHome === false, 'service: applyHome === false (nominal home advantage closed)');
    check(!('coach' in koRes.components) && !('venue' in koRes.components) && !('fatigue' in koRes.components),
      'service: components have no coach/venue/fatigue');
    check(koRes.advance && koRes.advance.home === null && koRes.advance.away === null,
      'service: advance home/away null (unavailable)');
    check(koRes.candidates && koRes.candidates.marketValue === null && koRes.candidates.continentalStrength === null,
      'service: candidates (marketValue/continental) are null unless injected (gate closed)');
    check(koRes.venueFactor && koRes.venueFactor.appliedInModel === false, 'service: venueFactor.appliedInModel === false');

    const grpRes = await svc.predictMatch('760415', { persist: false });
    check(grpRes.knockout && grpRes.knockout.isKnockout === false, 'group match: knockout.isKnockout === false');
    check(grpRes.advance === null, 'group match: advance === null');
    check(grpRes.host && grpRes.host.neutralVenue === true, 'group match: neutralVenue true (WC by schedule)');
  }

  // =====================================================================
  // J. API: route handler returns sanitized result
  // =====================================================================
  console.log('\n📊 J. API route (GET /api/predict/:matchId)');
  {
    const cache = {};
    const deps = {
      getCached: (k) => cache[k] || null,
      setCache: (k, v) => { cache[k] = v; },
      espn: async () => ({
        header: {
          competitions: [{
            venue: { fullName: 'MetLife Stadium' },
            status: { type: { name: 'STATUS_SCHEDULED' } },
            competitors: [
              { homeAway: 'home', team: { id: 'USA', displayName: 'USA' } },
              { homeAway: 'away', team: { id: 'Mexico', displayName: 'Mexico' } },
            ],
          }],
        },
      }),
      getTeamNameZh: (id) => id,
      getTeamNameI18n: (id, fb) => ({ zh: id, en: fb || id }),
      TEAM_FLAGS: { USA: '🇺🇸', Mexico: '🇲🇽' },
      RATINGS: ratings,
      routes: {},
    };
    const routes = createPredictionRoutes(deps);
    const apiRes = await routes['GET /api/predict/:matchId']({ matchId: '760484' });
    check(apiRes && !apiRes.error, 'API: returns a result (no error)');
    check(apiRes.host && apiRes.host.neutralVenue === true && apiRes.host.applyHome === false,
      'API: neutralVenue + applyHome=false');
    check(!('coach' in apiRes.components) && !('venue' in apiRes.components) && !('fatigue' in apiRes.components),
      'API: components sanitized (no coach/venue/fatigue)');
    check(apiRes.advance && apiRes.advance.home === null, 'API: advance unavailable (null)');
    check(apiRes.confidence === undefined && apiRes.heuristicUncertainty, 'API: confidence renamed -> heuristicUncertainty');
    // detectKnockout still maps schedule "knockout" correctly (wiring sanity).
    const ko = detectKnockout('knockout');
    check(ko.isKnockout === true && ko.knockoutRound === null, 'detectKnockout("knockout") wired');
  }

  // =====================================================================
  // K. [A v4] service-layer metadata must NOT claim candidate signals are used
  //    predictionSource = 'elo_poisson'
  //    externalOddsUsed / marketValueSignalUsed / continentalStrengthSignalUsed = false
  //    externalOddsAvailable / marketValueCandidateAvailable / continentalCandidateAvailable = true (only when observed)
  // =====================================================================
  console.log('\n📊 K. [A v4] service metadata: candidate-only (used=false, available=observed)');
  {
    // --- K1: DEFAULT (no env gate, no odds) -> everything false/zero ---
    const cacheDef = {};
    const svcDef = new PredictionService(depsFor2({ fullName: 'MetLife Stadium' }, cacheDef));
    const defRes = await svcDef.predictMatch('760415', { persist: false });
    check(defRes.predictionSource === 'elo_poisson',
      '[A v4] default predictionSource === "elo_poisson" (public contract)');
    check(defRes.externalOddsUsed === false && defRes.marketValueSignalUsed === false &&
          defRes.continentalStrengthSignalUsed === false,
      '[A v4] default *_Used === false (candidates never enter the public probability)');
    check(defRes.externalOddsAvailable === false && defRes.marketValueCandidateAvailable === false &&
          defRes.continentalCandidateAvailable === false,
      '[A v4] default *_Available === false (nothing observed)');

    // --- K2: AVAILABLE (env gates open + odds injected) -> Used stays false, Available true ---
    // Patch the two signal modules in require.cache so buildSignal returns a
    // non-null observation deterministically, then re-require a fresh
    // PredictionService whose internal bindings pick up the mocks.
    const mvPath = require.resolve('../lib/services/market-value-signal');
    const csPath = require.resolve('../lib/services/continental-strength-signal');
    const origMv = require.cache[mvPath];
    const origCs = require.cache[csPath];
    const psPath = require.resolve('../lib/services/PredictionService');
    const origPs = require.cache[psPath];
    require.cache[mvPath] = {
      id: mvPath, filename: mvPath, loaded: true,
      exports: { buildSignal: () => ({ home: 0.4, draw: 0.3, away: 0.3, confidence: 0.7, source: 'mock' }) },
    };
    require.cache[csPath] = {
      id: csPath, filename: csPath, loaded: true,
      exports: { buildSignal: () => ({ home: 0.3, draw: 0.3, away: 0.4, confidence: 0.7, source: 'mock' }) },
    };
    const prevMv = process.env.MARKET_VALUE_SIGNAL_ENABLED;
    const prevCs = process.env.CONTINENTAL_STRENGTH_SIGNAL_ENABLED;
    process.env.MARKET_VALUE_SIGNAL_ENABLED = 'true';
    process.env.CONTINENTAL_STRENGTH_SIGNAL_ENABLED = 'true';
    delete require.cache[psPath];
    const MockedService = require('../lib/services/PredictionService');

    const cacheAvail = {};
    const svcAvail = new MockedService(depsFor2({ fullName: 'MetLife Stadium' }, cacheAvail));
    // Force a non-null external odds so the "available" flag flips on.
    svcAvail.fetchExternalOdds = async () => ({ homeWin: 1.50, draw: 3.50, awayWin: 9.00, source: 'api' });

    const availRes = await svcAvail.predictMatch('760415', { persist: false, includeExternalOdds: true });

    check(availRes.predictionSource === 'elo_poisson',
      '[A v4] available: predictionSource STILL "elo_poisson" (not "baseline_plus_odds")');
    check(availRes.externalOddsUsed === false &&
          availRes.marketValueSignalUsed === false &&
          availRes.continentalStrengthSignalUsed === false,
      '[A v4] available: ALL *_Used === false even when odds/MarketValue/Continental are observed');
    check(availRes.externalOddsAvailable === true,
      '[A v4] available: externalOddsAvailable === true (odds observed)');
    check(availRes.marketValueCandidateAvailable === true,
      '[A v4] available: marketValueCandidateAvailable === true (signal observed)');
    check(availRes.continentalCandidateAvailable === true,
      '[A v4] available: continentalCandidateAvailable === true (signal observed)');
    // The observed-but-unused signals are still exposed transparently (not fused).
    check(availRes.candidates && availRes.candidates.odds && availRes.candidates.odds.usedInModel === false,
      '[A v4] available: observed odds exposed as candidate (usedInModel:false)');
    check(availRes.candidates && availRes.candidates.marketValue &&
          availRes.candidates.marketValue.usedInModel === false,
      '[A v4] available: observed marketValue exposed as candidate (usedInModel:false)');
    check(availRes.candidates && availRes.candidates.continentalStrength &&
          availRes.candidates.continentalStrength.usedInModel === false,
      '[A v4] available: observed continentalStrength exposed as candidate (usedInModel:false)');

    // restore cache + env so the rest of the process is unaffected
    require.cache[mvPath] = origMv;
    require.cache[csPath] = origCs;
    delete require.cache[psPath];
    require.cache[psPath] = origPs;
    if (prevMv === undefined) delete process.env.MARKET_VALUE_SIGNAL_ENABLED;
    else process.env.MARKET_VALUE_SIGNAL_ENABLED = prevMv;
    if (prevCs === undefined) delete process.env.CONTINENTAL_STRENGTH_SIGNAL_ENABLED;
    else process.env.CONTINENTAL_STRENGTH_SIGNAL_ENABLED = prevCs;
  }

  console.log(`\n============================`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('============================');
  process.exit(failed > 0 ? 1 : 0);
}

// Shared dep factory for the B2/B3 service tests (keeps a per-call cache).
function depsFor2(espnVenue, cache) {
  return {
    getCached: (k) => cache[k] || null,
    setCache: (k, v) => { cache[k] = v; },
    espn: async () => ({
      header: {
        competitions: [{
          venue: espnVenue,
          status: { type: { name: 'STATUS_SCHEDULED' } },
          competitors: [
            { homeAway: 'home', team: { id: 'USA', displayName: 'USA' } },
            { homeAway: 'away', team: { id: 'Mexico', displayName: 'Mexico' } },
          ],
        }],
      },
    }),
    getTeamNameZh: (id) => id,
    getTeamNameI18n: (id, fb) => ({ zh: id, en: fb || id }),
    TEAM_FLAGS: { USA: '🇺🇸', Mexico: '🇲🇽' },
    RATINGS: ratings,
    routes: {},
  };
}

main().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
