#!/usr/bin/env node
/**
 * KO-3: knockout prediction parameter wiring test
 *
 * Verifies that the knockout calibration (previously dead code in
 * lib/prediction.js / lib/poisson.js) is actually driven once
 * detectKnockout(stage) feeds isKnockout / knockoutRound into the engine.
 *
 * Acceptance focus (per knockout-intel-plan-2026-07.md KO-3):
 *   - λ shrinkage takes effect for knockout fixtures
 *   - draw probability rises (tighter matches)
 *   - confidence interval widens (+2%)
 *   - group-stage output is byte-identical to the pre-KO-3 (unfed) path
 */

const assert = require('assert');
const PredictionEngine = require('../lib/prediction');
const { detectKnockout } = require('../lib/knockoutStage');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function approxEqual(a, b, eps) {
  return Math.abs(a - b) <= eps;
}

console.log('=== KO-3 knockout prediction wiring test ===\n');

// ========== 1. detectKnockout vocabulary (incl. live schedule "knockout") ==========
console.log('📊 Test 1: detectKnockout stage mapping');
{
  const group = detectKnockout('group');
  check(group.isKnockout === false && group.knockoutRound === null,
    'group -> { isKnockout:false, knockoutRound:null }');

  const ko = detectKnockout('knockout');
  check(ko.isKnockout === true && ko.knockoutRound === null,
    'live-schedule "knockout" -> { isKnockout:true, knockoutRound:null }');

  // Granular history stages must remain correct (regression guard)
  const granular = [
    ['Round of 32', 'R32'],
    ['Round of 16', 'R16'],
    ['Quarter-finals', 'QF'],
    ['Semi-finals', 'SF'],
    ['Final', 'F'],
    ['Final Round', null], // 1950 round-robin, NOT a knockout
  ];
  for (const [stage, round] of granular) {
    const r = detectKnockout(stage);
    const expectedKnockout = round !== null;
    check(r.isKnockout === expectedKnockout && r.knockoutRound === round,
      `detectKnockout("${stage}") -> { isKnockout:${expectedKnockout}, knockoutRound:${round} }`);
  }
}

// ========== 2. Poisson λ shrinkage fires on isKnockout ==========
console.log('\n📊 Test 2: Poisson λ shrinkage (knockout vs group)');
const engine = new PredictionEngine();
const ATT = 1.15, DEF = 0.95; // representative attack/defense strengths
const lambdaGroupHome = engine.poisson.calculateLambda(ATT, DEF, true, {});
const lambdaKODefault = engine.poisson.calculateLambda(ATT, DEF, true, { isKnockout: true });
check(lambdaKODefault < lambdaGroupHome,
  `home λ shrinks under knockout (group=${lambdaGroupHome.toFixed(4)} -> ko=${lambdaKODefault.toFixed(4)})`);

// Round granularity: deeper rounds shrink more (F=0.80 < R16=0.90)
const lambdaR16 = engine.poisson.calculateLambda(ATT, DEF, true, { isKnockout: true, knockoutRound: 'R16' });
const lambdaF = engine.poisson.calculateLambda(ATT, DEF, true, { isKnockout: true, knockoutRound: 'F' });
check(lambdaF < lambdaR16 && lambdaR16 < lambdaGroupHome,
  `round granularity: F(${lambdaF.toFixed(4)}) < R16(${lambdaR16.toFixed(4)}) < group(${lambdaGroupHome.toFixed(4)})`);

// ========== 3. Engine-level wiring: same fixture, knockout vs group ==========
console.log('\n📊 Test 3: engine.predict knockout vs group (same fixture)');
const ratings = require('../data/ratings.json').teams;
const home = ratings['Germany'];
const away = ratings['France'];
check(home && away, 'fixture teams (Germany vs France) found in ratings');

const baseParams = { homeId: 'Germany', awayId: 'France', homeRating: home, awayRating: away };
const predGroup = engine.predict(baseParams);
const predKO = engine.predict({ ...baseParams, isKnockout: true, knockoutRound: null });

check(predKO.goals.homeExpected < predGroup.goals.homeExpected,
  `homeExpected goals lower in knockout (${predGroup.goals.homeExpected} -> ${predKO.goals.homeExpected})`);
check(predKO.goals.awayExpected < predGroup.goals.awayExpected,
  `awayExpected goals lower in knockout (${predGroup.goals.awayExpected} -> ${predKO.goals.awayExpected})`);
check(predKO.draw > predGroup.draw,
  `draw probability rises in knockout (${predGroup.draw} -> ${predKO.draw})`);
check(predKO.confidence.halfWidth > predGroup.confidence.halfWidth,
  `confidence interval widens in knockout (${predGroup.confidence.halfWidth} -> ${predKO.confidence.halfWidth})`);

// ========== 4. Group output byte-identical to pre-KO-3 (unfed) path ==========
console.log('\n📊 Test 4: group-stage output unchanged (KO-3 must not alter group predictions)');
const predFed = engine.predict({ ...baseParams, isKnockout: false, knockoutRound: null });
const fields = ['homeWin', 'draw', 'awayWin',
  'goals.homeExpected', 'goals.awayExpected',
  'confidence.halfWidth'];
function getPath(obj, p) { return p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
let identical = true;
for (const f of fields) {
  if (!approxEqual(getPath(predGroup, f), getPath(predFed, f), 1e-9)) {
    identical = false;
    console.error(`    diff @ ${f}: ${getPath(predGroup, f)} vs ${getPath(predFed, f)}`);
  }
}
check(identical, 'predict({}) equals predict({ isKnockout:false, knockoutRound:null }) across output fields');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
