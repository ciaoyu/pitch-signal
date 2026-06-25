#!/usr/bin/env node
'use strict';
/**
 * lib/output-rules.js 测试
 * 覆盖：fuseProbabilities, scoreConfidence, gatherExternalSignals, applyOutputRules
 */
const assert = require('assert');
const { fuseProbabilities, scoreConfidence, gatherExternalSignals, applyOutputRules } = require('../lib/output-rules');

let passed = 0, failed = 0;
function check(cond, label) {
  try { assert(cond); console.log(`  ✅ ${label}`); passed++; }
  catch (e) { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== Output Rules Tests ===\n');

// ── fuseProbabilities ──
console.log('📊 fuseProbabilities:');

const r1 = fuseProbabilities({ homeWin: 0.5, draw: 0.25, awayWin: 0.25 }, null);
check(r1.fusionStrategy === 'single_source', 'Null external → single_source');
check(r1.externalUsed === false, 'Null external → externalUsed=false');
check(r1.homeWin === 0.5 && r1.draw === 0.25 && r1.awayWin === 0.25, 'Passes through primary probabilities');
check(Math.abs(r1.homeWin + r1.draw + r1.awayWin - 1) < 0.01, 'Probabilities sum to ~1');

const r2 = fuseProbabilities({ homeWin: 0.6, draw: 0.3, awayWin: 0.1 }, { homeWin: 0.7, draw: 0.2, awayWin: 0.1 });
check(r2.fusionStrategy === 'weighted_avg_80_20', 'External present → weighted_avg_80_20');
check(r2.externalUsed === true, 'External present → externalUsed=true');
check(r2.homeWin > 0.6 && r2.homeWin < 0.7, 'Home win blended toward external (0.6→0.62)');
check(Math.abs(r2.homeWin + r2.draw + r2.awayWin - 1) < 0.01, 'Blended probabilities still sum to ~1');

// alt property names (homeWinProb, drawProb, awayWinProb)
const r3 = fuseProbabilities({ homeWinProb: 0.55, drawProb: 0.25, awayWinProb: 0.20 }, null);
check(r3.homeWin === 0.55 && r3.fusionStrategy === 'single_source', 'Accepts homeWinProb/drawProb/awayWinProb aliases');

// ── scoreConfidence ──
console.log('\n📊 scoreConfidence:');

const c1 = scoreConfidence({ homeWin: 0.5, draw: 0.3, awayWin: 0.2, components: {} });
check(c1.score >= 40 && c1.score <= 55, 'Baseline score ~45-50 with no components');
check(['high', 'medium', 'low'].includes(c1.band), 'Band is valid string');
check(Array.isArray(c1.factors), 'factors is array');
check(c1.factors.includes('no_market_signal'), 'no_market_signal factor present (POLYMARKET off)');

const c2 = scoreConfidence({
  homeWin: 0.65, draw: 0.25, awayWin: 0.10,
  components: { elo: { homeWin: 0.65, awayWin: 0.10 }, poisson: {}, odds: {} }
});
check(c2.score >= 60, 'Multi-component + clear Elo edge → score >= 60');
check(c2.factors.includes('multi_signal'), 'multi_signal factor present');
check(c2.factors.includes('elo_clear_edge'), 'elo_clear_edge factor present');
check(c2.factors.includes('concentrated_prob'), 'concentrated_prob factor present (max > 0.55)');

const c3 = scoreConfidence({
  homeWin: 0.35, draw: 0.35, awayWin: 0.30,
  components: { elo: { homeWin: 0.5, awayWin: 0.5 } }
});
check(c3.score <= 50, 'Flat probabilities + no edge → score <= 50');
check(c3.factors.includes('flat_prob'), 'flat_prob factor present (max < 0.40)');
check(c3.band === 'low' || c3.band === 'medium', 'Flat → low or medium band');

const c4 = scoreConfidence({
  homeWin: 0.8, draw: 0.15, awayWin: 0.05,
  components: { elo: { homeWin: 0.8, awayWin: 0.05 }, poisson: {}, odds: {}, venue: {} }
});
check(c4.score >= 70, 'Strong edge + 4 components → score >= 70');
check(c4.band === 'high', 'Strong prediction → high band');

// ── gatherExternalSignals ──
console.log('\n📊 gatherExternalSignals:');

const sig = gatherExternalSignals('test-match');
check(sig.polymarket === null, 'Polymarket signal is null (Gate 1 closed)');
check(sig.pundit === null, 'Pundit signal is null');
check(sig.autoCalibration === null, 'Auto-calibration signal is null');
check(typeof sig._note === 'string', '_note is a string');

// ── applyOutputRules ──
console.log('\n📊 applyOutputRules:');

const mockResult = {
  homeWin: 0.52, draw: 0.22, awayWin: 0.26,
  components: { elo: { homeWin: 0.5, awayWin: 0.5 }, poisson: {} }
};
const meta = applyOutputRules(mockResult, 'test-match');
check(meta.outputMeta != null, 'Returns outputMeta');
check(meta.outputMeta.fusion != null, 'Has fusion');
check(meta.outputMeta.confidence != null, 'Has confidence');
check(meta.outputMeta.externalSignals != null, 'Has externalSignals');
check(typeof meta.outputMeta.accuracyDisclaimer === 'string', 'Has accuracy disclaimer text');
check(meta.outputMeta._gate.polymarket === false, 'Gate: polymarket=false');
check(meta.outputMeta._gate.pundit === false, 'Gate: pundit=false');
check(meta.outputMeta._gate.autoCalibration === false, 'Gate: autoCalibration=false');
check(meta.outputMeta._gate.aiProbabilityEdit === false, 'Gate: aiProbabilityEdit=false');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
