#!/usr/bin/env node
/**
 * KO-3: knockout prediction parameter wiring test (P0 quarantine v2 — Owner A)
 *
 * Verifies that the knockout context (detectKnockout(stage) -> isKnockout /
 * knockoutRound) is still plumbed into the engine, but that the HAND-TUNED λ
 * shrinkage (R16/QF/SF/F = 0.90/0.87/0.83/0.80) is QUARANTINED and no longer
 * alters the 90-minute (regulation) probability. The shrinkage was merged but
 * never OOS-estimated; Owner A removed it from the probability path.
 *
 * Acceptance focus (per remediation master plan §2.2.1 + rejection notes):
 *   - isKnockout / knockoutRound are still wired through (recorded in result)
 *   - λ is NOT shrunk under knockout (quarantine flag set)
 *   - regulation (90-min) probabilities are IDENTICAL for KO vs group
 *   - confidence interval still widens (+2%) for knockout (display metadata)
 *   - group-stage output is byte-identical to the unfed path
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

console.log('=== KO-3 knockout prediction wiring test (P0 quarantine v2) ===\n');

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

// ========== 2. Poisson λ shrinkage is QUARANTINED (no λ change) ==========
console.log('\n📊 Test 2: Poisson λ shrinkage QUARANTINED (knockout vs group)');
const engine = new PredictionEngine();
const ATT = 1.15, DEF = 0.95; // representative attack/defense strengths
const lambdaGroupHome = engine.poisson.calculateLambda(ATT, DEF, true, {});
const lambdaKODefault = engine.poisson.calculateLambda(ATT, DEF, true, { isKnockout: true });
check(approxEqual(lambdaKODefault, lambdaGroupHome, 1e-9),
  `home λ is UNCHANGED under knockout (group=${lambdaGroupHome.toFixed(4)} == ko=${lambdaKODefault.toFixed(4)})`);

// Round granularity must also produce identical λ (no 0.90/0.87/0.83/0.80 shrink)
const lambdaR16 = engine.poisson.calculateLambda(ATT, DEF, true, { isKnockout: true, knockoutRound: 'R16' });
const lambdaF = engine.poisson.calculateLambda(ATT, DEF, true, { isKnockout: true, knockoutRound: 'F' });
check(approxEqual(lambdaF, lambdaR16, 1e-9) && approxEqual(lambdaR16, lambdaGroupHome, 1e-9),
  `round granularity has NO effect (F == R16 == group)`);

// Quarantine audit flag must be set on the options object
check(lambdaKODefault === lambdaGroupHome && (function () {
  const opts = { isKnockout: true };
  engine.poisson.calculateLambda(ATT, DEF, true, opts);
  return opts._knockoutShrinkageQuarantined === true;
})(), 'options._knockoutShrinkageQuarantined === true (audit trail)');

// ========== 3. Engine-level wiring: same fixture, knockout vs group ==========
console.log('\n📊 Test 3: engine.predict knockout vs group (regulation identical)');
const ratings = require('../data/ratings.json').teams;
const home = ratings['Germany'];
const away = ratings['France'];
check(home && away, 'fixture teams (Germany vs France) found in ratings');

const baseParams = { homeId: 'Germany', awayId: 'France', homeRating: home, awayRating: away };
const predGroup = engine.predict(baseParams);
const predKO = engine.predict({ ...baseParams, isKnockout: true, knockoutRound: null });

check(approxEqual(predKO.goals.homeExpected, predGroup.goals.homeExpected, 1e-9),
  `homeExpected goals identical in knockout (${predGroup.goals.homeExpected} == ${predKO.goals.homeExpected})`);
check(approxEqual(predKO.goals.awayExpected, predGroup.goals.awayExpected, 1e-9),
  `awayExpected goals identical in knockout (${predGroup.goals.awayExpected} == ${predKO.goals.awayExpected})`);
check(approxEqual(predKO.draw, predGroup.draw, 1e-9),
  `draw probability UNCHANGED in knockout (${predGroup.draw} == ${predKO.draw})`);
check(approxEqual(predKO.homeWin, predGroup.homeWin, 1e-9) &&
      approxEqual(predKO.awayWin, predGroup.awayWin, 1e-9),
  'regulation (90-min) probabilities identical for KO vs group');

// Knockout context must still be recorded in the result
check(predKO.knockout && predKO.knockout.isKnockout === true,
  'result.knockout.isKnockout === true (wiring preserved)');
check(predKO.knockout && predKO.knockout.lambdaShrinkageQuarantined === true,
  'result.knockout.lambdaShrinkageQuarantined === true');

// advance must be present (KO) but UNAVAILABLE (nulls, not 50/50)
check(predKO.advance && predKO.advance.available === false &&
      predKO.advance.home === null && predKO.advance.away === null,
  'advance is unavailable with home:null/away:null (no pseudo 50/50)');

// Heuristic uncertainty spread STILL widens for knockout (display metadata, not probability)
check(predKO.heuristicUncertainty.halfWidth > predGroup.heuristicUncertainty.halfWidth,
  `heuristic uncertainty widens in knockout (${predGroup.heuristicUncertainty.halfWidth} -> ${predKO.heuristicUncertainty.halfWidth})`);

// ========== 4. Group output byte-identical to pre-fed (unfed) path ==========
console.log('\n📊 Test 4: group-stage output unchanged (KO-3 must not alter group predictions)');
const predFed = engine.predict({ ...baseParams, isKnockout: false, knockoutRound: null });
const fields = ['homeWin', 'draw', 'awayWin',
  'goals.homeExpected', 'goals.awayExpected',
  'heuristicUncertainty.halfWidth'];
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
