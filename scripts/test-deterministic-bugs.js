#!/usr/bin/env node
'use strict';

/**
 * W1-B — Deterministic bug fixes (roadmap §1.2, §1.3)
 *
 * 1. blendXg: the original ternary `isHome ? avgXgFor : avgXgFor` had two identical
 *    branches (copy-paste bug). Latent today — the main engine's predictMatch never
 *    passes xgProfile — so backtest numbers are unaffected; this fixes the logic so
 *    the self profile's avgXgFor is used consistently.
 * 2. timeRatio: capped at 1.0 so kickoff + long added time cannot inflate the
 *    remaining λ above the pre-match baseline (§1.3 timeRatio semantics).
 *
 * Run: node scripts/test-deterministic-bugs.js
 */

const assert = require('assert');
const PoissonModel = require('../lib/poisson');
const { reprice } = require('../lib/live-reprice');

let passed = 0;
let failed = 0;

function testAssert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('\n📋 W1-B Test 1: blendXg boundary (matches < 2 → unchanged)');
const poisson = new PoissonModel();
const r1 = poisson.blendXg(1.5, { matches: 1, avgXgFor: 2.0 }, true);
testAssert(r1 === 1.5, `blendXg with <2 matches returns lambdaMath unchanged (got ${r1})`);

console.log('\n📋 W1-B Test 2: blendXg blends with self avgXgFor');
const r2 = poisson.blendXg(1.5, { matches: 3, avgXgFor: 2.0 }, true);
const r2b = poisson.blendXg(1.5, { matches: 3, avgXgFor: 2.0 }, false);
testAssert(Number.isFinite(r2) && r2 !== 1.5, `blendXg blends toward avgXgFor when data sufficient (got ${r2})`);
testAssert(r2 === r2b, `home/away self-profile give identical blend (no copy-paste divergence)`);

console.log('\n📋 W1-B Test 3: timeRatio never exceeds 1 at kickoff + added time');
const kick = reprice({ preLambdaHome: 1.5, preLambdaAway: 1.2, minuteElapsed: 0, addedTime: 10 });
testAssert(kick.lambdaHomeRemaining <= 1.5 + 1e-9, `kickoff+addedTime λ_remaining ≤ preLambda (got ${kick.lambdaHomeRemaining})`);
testAssert(kick.lambdaHomeRemaining === 1.5, `kickoff+addedTime λ_remaining capped at preLambda (got ${kick.lambdaHomeRemaining})`);

console.log('\n📋 W1-B Test 4: timeRatio linear in normal play');
const mid = reprice({ preLambdaHome: 1.5, preLambdaAway: 1.2, minuteElapsed: 45, addedTime: 0 });
testAssert(mid.lambdaHomeRemaining === 0.75, `minute 45, no added time → λ_remaining = 0.75 (got ${mid.lambdaHomeRemaining})`);

console.log('\n📋 W1-B Test 5: timeRatio across added-time grid stays ≤ 1');
let allCapped = true;
for (const at of [0, 5, 10, 15]) {
  const r = reprice({ preLambdaHome: 1.5, minuteElapsed: 0, addedTime: at });
  if (r.lambdaHomeRemaining > 1.5001) allCapped = false;
}
testAssert(allCapped, 'λ_remaining never exceeds preLambda for any added time at kickoff');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
