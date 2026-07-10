#!/usr/bin/env node
/**
 * Owner A — P0 quarantine v2 acceptance test (engine + service + API).
 *
 * Covers the rejection notes from the v1 review:
 *  - Coach / capacity-Venue / Fatigue truly removed from the probability (no
 *    weight, no component, no effect on the fused number).
 *  - Neutral-venue rule: nominal home advantage CLOSED for ALL World Cup
 *    matches; host is a recorded FACT only (hostSide), even when the host is
 *    the nominal away team. Host effect size is NOT applied (waits for Owner E).
 *  - Manual KO λ shrinkage removed (regulation identical for KO vs group).
 *  - Environmental hand-tuned β (0.03 / 0.01 / 32°C) downgraded to shadow/display.
 *  - advance is UNAVAILABLE (home:null / away:null), never a pseudo 50/50.
 *  - configHash is a COMPLETE model contract (active signals, weights, rho,
 *    env params, gate policies).
 *  - Service/API level: schedule KO detection feeds the engine; venue parsing
 *    drives neutral detection; result shape sanitized.
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
  console.log('=== Owner A — P0 quarantine v2 (engine + service + API) ===\n');

  // =====================================================================
  // A. ENGINE: neutral-venue / host rule
  // =====================================================================
  console.log('📊 A. Neutral venue & host rule');
  {
    const A = ratings['Germany'];
    const B = ratings['France'];

    const predAB = engine.predict({ homeId: 'Germany', awayId: 'France', homeRating: A, awayRating: B, neutralVenue: true });
    const predBA = engine.predict({ homeId: 'France', awayId: 'Germany', homeRating: B, awayRating: A, neutralVenue: true });

    // No home advantage => swapping teams swaps probabilities (symmetry).
    check(near(predAB.homeWin, predBA.awayWin, 1e-9), 'neutral: swap home/away swaps homeWin/awayWin (no home advantage)');
    check(near(predAB.awayWin, predBA.homeWin, 1e-9), 'neutral: swap home/away swaps awayWin/homeWin');
    check(predAB.host && predAB.host.applyHome === false, 'neutral: host.applyHome === false');
    check(predAB.host && predAB.host.neutralVenue === true, 'neutral: host.neutralVenue === true');

    // Host-as-home: host effect must NOT be applied (probability unchanged vs no host).
    const predHostHome = engine.predict({ homeId: 'USA', awayId: 'Mexico', homeRating: ratings['USA'], awayRating: ratings['Mexico'], neutralVenue: true, hostTeamId: 'USA' });
    const predNoHost = engine.predict({ homeId: 'USA', awayId: 'Mexico', homeRating: ratings['USA'], awayRating: ratings['Mexico'], neutralVenue: true });
    check(near(predHostHome.homeWin, predNoHost.homeWin, 1e-9), 'host-as-home: no host bonus applied (hostSide is fact-only)');
    check(predHostHome.host.hostSide === 'home' && predHostHome.host.applyHome === false, 'host-as-home: hostSide=home but applyHome=false');

    // Host-as-away: correctly handled — still no advantage, hostSide recorded as away.
    const predHostAway = engine.predict({ homeId: 'Mexico', awayId: 'USA', homeRating: ratings['Mexico'], awayRating: ratings['USA'], neutralVenue: true, hostTeamId: 'USA' });
    check(predHostAway.host.hostSide === 'away' && predHostAway.host.applyHome === false, 'host-as-away: hostSide=away, applyHome=false (rejection case handled)');
    check(near(predHostAway.homeWin, predNoHost.awayWin, 1e-9), 'host-as-away: probability equals the swapped no-host case (no advantage)');

    // Legacy (non-WC) context: home advantage preserved when neutralVenue falsy.
    // Same fixture: with home advantage the home team's win prob must EXCEED the
    // neutral-venue case (no bonus).
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

    // Components must NOT contain the quarantined signals.
    check(!('coach' in pred.components), 'components.coach absent');
    check(!('venue' in pred.components), 'components.venue absent');
    check(!('fatigue' in pred.components), 'components.fatigue absent');

    // Weights must NOT contain the quarantined signals.
    check(!('coach' in pred.weights), 'weights.coach absent');
    check(!('venue' in pred.weights), 'weights.venue absent');
    check(!('fatigue' in pred.weights), 'weights.fatigue absent');

    // Coach removed proof: providing ESPN coach ids must NOT change the result.
    const predWithEspn = engine.predict({ ...base, homeEspnId: '1', awayEspnId: '2' });
    check(near(pred.homeWin, predWithEspn.homeWin, 1e-9) &&
          near(pred.draw, predWithEspn.draw, 1e-9) &&
          near(pred.awayWin, predWithEspn.awayWin, 1e-9),
      'coach not used: result identical with/without ESPN coach ids');

    // Capacity-venue removed proof: providing a venue object must NOT change result.
    const venueObj = { name: 'SoFi Stadium', capacity: 70000 };
    const predWithVenue = engine.predict({ ...base, venue: venueObj });
    check(near(pred.homeWin, predWithVenue.homeWin, 1e-9),
      'capacity-venue not used: result identical with/without venue object');

    // quarantinedSignals recorded.
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

    // Regulation identical (KO no longer changes 90-min probability).
    check(near(predGroup.homeWin, predKO.homeWin, 1e-9) &&
          near(predGroup.draw, predKO.draw, 1e-9) &&
          near(predGroup.awayWin, predKO.awayWin, 1e-9),
      'regulation (90-min) identical for KO vs group');
    check(near(predGroup.goals.homeExpected, predKO.goals.homeExpected, 1e-9), 'expected goals identical for KO vs group');

    // advance: present only for KO, but UNAVAILABLE => nulls (no pseudo 50/50).
    check(predKO.advance && predKO.advance.available === false, 'advance.available === false');
    check(predKO.advance && predKO.advance.home === null && predKO.advance.away === null,
      'advance returns home:null/away:null (NOT a 50/50 split)');
    check(predKO.advance && predKO.advance.usedInModel === false, 'advance.usedInModel === false');
    check(predGroup.advance === null, 'group match: advance === null');

    // Knockout bookkeeping records quarantine.
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
    // λ is NOT modified by env (shadow only): adjusted λ === raw λ.
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
    check(pred.modelVersion === 'p0-quarantine-v2-2026-07-10', 'modelVersion is p0-quarantine-v2-2026-07-10');
    const mc = pred.modelContract;
    check(mc && mc.activeSignals.join(',') === 'elo,poisson', 'activeSignals = [elo,poisson]');
    check(mc.baseWeights.fatigue === 0 && mc.baseWeights.coach === 0 && mc.baseWeights.venue === 0,
      'modelContract weights: coach/venue/fatigue = 0');
    check(mc.poisson && typeof mc.poisson.rho === 'number', 'modelContract covers poisson.rho');
    check(mc.envFactors && mc.envFactors.status === 'shadow_only' && mc.envFactors.appliedInModel === false,
      'modelContract covers env β (shadow_only)');
    check(mc.gates && mc.gates.polymarket === false, 'modelContract gates.polymarket === false');
    check(mc.gates && mc.gates.odds === 'env-gated:THE_ODDS_API_KEY', 'modelContract gates.odds declared');
    check(mc.knockoutShrinkage && mc.knockoutShrinkage.quarantined === true, 'modelContract knockoutShrinkage.quarantined === true');
    // configHash must change if a weight changes (proves it is covered).
    const tweaked = new PredictionEngine({ weights: { elo: 0.6, poisson: 0.4 } });
    check(tweaked.configHash !== pred.configHash, 'configHash changes when weights change (contract is complete)');
  }

  // =====================================================================
  // F. SERVICE: schedule KO detection + neutral venue + sanitized result
  // =====================================================================
  console.log('\n📊 F. PredictionService (schedule KO + venue neutral detection)');
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

    // (F1) Real KO match from schedule (760484 -> stage "knockout").
    const koRes = await svc.predictMatch('760484', { persist: false });
    check(koRes && koRes.knockout && koRes.knockout.isKnockout === true, 'schedule KO detection: result.knockout.isKnockout === true');
    check(koRes.host && koRes.host.neutralVenue === true, 'service: neutralVenue detected from venue country (USA)');
    check(koRes.host && koRes.host.hostSide === 'home', 'service: hostSide = home (USA is home)');
    check(koRes.host && koRes.host.applyHome === false, 'service: applyHome === false (nominal home advantage closed)');
    check(!('coach' in koRes.components) && !('venue' in koRes.components) && !('fatigue' in koRes.components),
      'service: components have no coach/venue/fatigue');
    check(koRes.advance && koRes.advance.home === null && koRes.advance.away === null,
      'service: advance home/away null (unavailable)');
    check(/^[0-9a-f]{12}$/.test(koRes.configHash), 'service: configHash present (12-hex)');
    check(koRes.venueFactor && koRes.venueFactor.appliedInModel === false, 'service: venueFactor.appliedInModel === false');

    // (F2) Group match (matchId not in schedule) at a host venue.
    const grpRes = await svc.predictMatch('999999', { persist: false });
    check(grpRes.knockout && grpRes.knockout.isKnockout === false, 'group match: knockout.isKnockout === false');
    check(grpRes.advance === null, 'group match: advance === null');
    check(grpRes.host && grpRes.host.neutralVenue === true, 'group match: neutralVenue still true (host venue)');
  }

  // =====================================================================
  // G. API: route handler returns sanitized result
  // =====================================================================
  console.log('\n📊 G. API route (GET /api/predict/:matchId)');
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
    check(/^[0-9a-f]{12}$/.test(apiRes.configHash), 'API: configHash present');
    // detectKnockout still maps schedule "knockout" correctly (wiring sanity).
    const ko = detectKnockout('knockout');
    check(ko.isKnockout === true && ko.knockoutRound === null, 'detectKnockout("knockout") wired');
  }

  console.log(`\n============================`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('============================');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
