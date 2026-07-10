#!/usr/bin/env node
/**
 * Owner E — unit tests for OOS helpers (SYNTHETIC data only).
 *
 * These tests verify the MATH/LOGIC of the OOS pipeline:
 *   - poissonIRLS recovers known coefficients on synthetic Poisson data
 *   - outcomeProbs returns valid (sum-to-1) probabilities; stronger Elo -> higher
 *     home-win probability; symmetry holds for rest_diff
 *   - buildDesign yields 2*N rows (home + away)
 *   - vif ≈ 1 for orthogonal synthetic regressors
 *
 * They use NO real pool data and write NOTHING to any research artifact.
 * Per boundary: synthetic data is permitted only for unit testing.
 */
'use strict';
const assert = require('assert');
const oos = require('./research-environment-oos');

// --- 1) poissonIRLS recovers known coefficients on synthetic Poisson data ---
(function testIRLSrecovery() {
  // y ~ Poisson(exp(b0 + b1*x)), x ~ U(-1,1), b0=0.4, b1=0.3
  const N = 4000, b0 = 0.4, b1 = 0.3;
  const X = [], y = [];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < N; i++) {
    const x = rnd() * 2 - 1;
    const lam = Math.exp(b0 + b1 * x);
    let k = 0, p = Math.exp(-lam), s = p, u = rnd();
    while (s < u && k < 25) { k++; p *= lam / k; s += p; }
    X.push([1, x]); y.push(k);
  }
  const b = oos.poissonIRLS(X, y, [0, 0.5]);
  assert.ok(Math.abs(b[0] - b0) < 0.05, `intercept ${b[0]} ~ ${b0}`);
  assert.ok(Math.abs(b[1] - b1) < 0.05, `slope ${b[1]} ~ ${b1}`);
  console.log('✓ poissonIRLS recovers synthetic coefficients', b.map(v => +v.toFixed(4)));
})();

// --- 2) outcomeProbs: valid probs, Elo monotonicity, rest symmetry ---
(function testOutcomeProbs() {
  const beta = [0.1, 0.35, 0.002, -0.00003, -0.05, 0.39];
  const mWeak = { eloH: 1500, eloA: 1700, rest_home: 5, rest_away: 5, cross_confed: false };
  const mStrong = { eloH: 1700, eloA: 1500, rest_home: 5, rest_away: 5, cross_confed: false };
  const pW = oos.outcomeProbs(beta, mWeak);
  const pS = oos.outcomeProbs(beta, mStrong);
  for (const p of [pW, pS]) {
    const s = p[0] + p[1] + p[2];
    assert.ok(Math.abs(s - 1) < 1e-9, `probs sum to 1 (got ${s})`);
    for (const v of p) assert.ok(v >= 0 && v <= 1, `prob in [0,1] (got ${v})`);
  }
  // stronger home Elo -> higher home-win prob
  assert.ok(pS[0] > pW[0], `stronger home Elo raises home-win (${pS[0]} > ${pW[0]})`);
  // rest symmetry: with home advantage neutralized, the rest term enters the two
  // teams equal-and-opposite, so flipping rest_home/rest_away swaps home/away win.
  const betaNoHome = [beta[0], 0, beta[2], beta[3], beta[4], beta[5]];
  const mA = { eloH: 1600, eloA: 1600, rest_home: 10, rest_away: 4, cross_confed: false };
  const mB = { eloH: 1600, eloA: 1600, rest_home: 4, rest_away: 10, cross_confed: false };
  const pA = oos.outcomeProbs(betaNoHome, mA);
  const pB = oos.outcomeProbs(betaNoHome, mB);
  assert.ok(Math.abs(pA[0] - pB[2]) < 1e-12, `symmetry: home-win(mA)==away-win(mB) (${pA[0]} vs ${pB[2]})`);
  assert.ok(Math.abs(pA[2] - pB[0]) < 1e-12, `symmetry: away-win(mA)==home-win(mB) (${pA[2]} vs ${pB[0]})`);
  console.log('✓ outcomeProbs valid + Elo-monotone + rest-symmetric');
})();

// --- 3) buildDesign yields 2*N rows, rest-null row rejected ---
(function testBuildDesign() {
  const matches = [
    { eloH: 1600, eloA: 1500, rest_home: 5, rest_away: 3, cross_confed: true, homeScore: 2, awayScore: 1 },
    { eloH: 1500, eloA: 1600, rest_home: 4, rest_away: 6, cross_confed: false, homeScore: 0, awayScore: 0 },
  ];
  const d = oos.buildDesign(matches, true);
  assert.strictEqual(d.X.length, 4, '2 matches -> 4 rows (home+away)');
  // home row has homeAdv=1, away row homeAdv=0
  assert.strictEqual(d.X[0][1], 1);
  assert.strictEqual(d.X[1][1], 0);
  // rest-null -> null (design rejected)
  const bad = [{ eloH: 1600, eloA: 1500, rest_home: null, rest_away: 3, cross_confed: true, homeScore: 1, awayScore: 1 }];
  assert.strictEqual(oos.buildDesign(bad, true), null);
  console.log('✓ buildDesign: 2N rows, home-away coding, rest-null rejected');
})();

// --- 4) VIF >= 1 for orthogonal synthetic regressors (catches the v1 without-intercept bug) ---
(function testVif() {
  const X = [];
  let seed = 999; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 2000; i++) {
    const a = rnd() * 2 - 1, b = rnd() * 2 - 1, c = rnd() > 0.5 ? 1 : 0, d = rnd() > 0.5 ? 1 : 0;
    // all four env regressors mutually independent
    X.push([1, 0, a, b, c, d]);
  }
  const v = oos.vif(X);
  // standard VIF must be >= 1; the orth(near-independent) regressors give VIF ~ 1
  for (const k of ['eloDiff', 'restDiff', 'cross', 'crossUnknown']) {
    assert.ok(v[k].vif >= 1 - 1e-9, `VIF(${k}) must be >= 1 (got ${v[k].vif})`);
  }
  assert.ok(v.eloDiff.vif < 1.1 && v.restDiff.vif < 1.1, `orthogonal VIF ~1 (got ${v.eloDiff.vif}, ${v.restDiff.vif})`);
  console.log('✓ VIF >= 1 and ≈ 1 for orthogonal regressors', { eloDiff: +v.eloDiff.vif.toFixed(3), restDiff: +v.restDiff.vif.toFixed(3), cross: +v.cross.vif.toFixed(3) });
})();

// --- 5) Fixed-seed cluster bootstrap is reproducible across reruns (catches non-determinism) ---
(function testSeedReproducibility() {
  const betaEnv = [0.1, 0.35, 0.002, -0.00003, -0.05, 0.39];
  const betaBase = [0.1, 0.35, 0.002, -0.00003, 0, 0];
  const years = [1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966];
  const matches = [];
  let s = 4242; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (const y of years) {
    const n = 20 + Math.floor(rnd() * 10);
    for (let i = 0; i < n; i++) {
      matches.push({
        date: `${y}-0${1 + Math.floor(rnd() * 6)}-1${Math.floor(rnd() * 9)}`,
        eloH: 1500 + rnd() * 300, eloA: 1500 + rnd() * 300,
        rest_home: rnd() * 10, rest_away: rnd() * 10,
        cross_confed: rnd() > 0.5,
        homeScore: Math.floor(rnd() * 5), awayScore: Math.floor(rnd() * 5),
      });
    }
  }
  const B = 300, SEED = 20260711;
  const boot1 = oos.clusterBootstrapDelta(matches, betaEnv, betaBase, B, oos.mulberry32(SEED));
  const boot2 = oos.clusterBootstrapDelta(matches, betaEnv, betaBase, B, oos.mulberry32(SEED));
  // identical seed => identical draw sequence => identical deltas + CI
  assert.deepStrictEqual(boot1.deltas, boot2.deltas, 'fixed seed must reproduce identical ΔLogLoss draws');
  assert.deepStrictEqual(boot1.ci, boot2.ci, 'fixed seed must reproduce identical CI');
  // a different seed must diverge (guard against a constant / ignored rng)
  const boot3 = oos.clusterBootstrapDelta(matches, betaEnv, betaBase, B, oos.mulberry32(SEED + 1));
  const diverged = boot3.deltas.length !== boot1.deltas.length ||
    boot3.deltas.some((d, i) => Math.abs(d - boot1.deltas[i]) > 1e-12);
  assert.ok(diverged, 'different seed must produce a different draw (rng is actually consumed)');
  console.log('✓ fixed-seed cluster bootstrap is reproducible (CI =', boot1.ci.map(v => +v.toFixed(5)), ', seed', SEED, ')');
})();

console.log('\nAll OOS helper unit tests passed (synthetic data only, no artifact written).');
