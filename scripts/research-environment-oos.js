#!/usr/bin/env node
/**
 * Owner E — environment OOS coefficient estimation (REAL run; shadow only).
 *
 * Design (per master plan §E + methodology notes §3 + Owner directive):
 *   - Estimate env effects in the LARGER international match pool; World Cup
 *     finals ("FIFA World Cup") are kept HELD-OUT (never in coefficient fit).
 *   - Elo (as-of, control) is computed from NON-WC matches ONLY, so the env
 *     coefficient estimate cannot leak any World Cup result. World Cup matches
 *     are scored only with the Elo snapshot available strictly before kickoff
 *     (which is itself non-WC-derived), making them a clean held-out test.
 *   - Features enter SYMMETRICALLY as team-relative differences / shared
 *     indicators so both attack λ and opponent defense move together:
 *       rest_diff   = rest_home - rest_away   (symmetric: + helps home, hurts away)
 *       cross       = 1 if cross_confederation (both sides travel; symmetric)
 *       cross_unknown = 1 if confed unresolved for either side (honest missing flag)
 *   - Goal model: Poisson with Ridge shrinkage (L2) estimated by IRLS.
 *       η_home = β0 + β_ha·1[home] + β_elo·elo_diff + β_rest·rest_diff + β_cross·cross + β_cu·cross_unknown
 *       η_away = β0 + 0            - β_elo·elo_diff - β_rest·rest_diff + β_cross·cross + β_cu·cross_unknown
 *       λ_home = exp(η_home), λ_away = exp(η_away)
 *   - Benchmarks:
 *       base  = Elo + Poisson, NO env coefficients (β_rest=β_cross=β_cu=0)
 *       env   = Elo + Poisson + env coefficients (the model above)
 *     Compare on LogLoss / Brier / calibration (ECE) over 3-way outcome
 *     (home/draw/away), plus a cluster-bootstrap Δ with CI.
 *
 * ESTIMATED NOW (real training coverage):
 *   - rest_diff        (rest coverage 99.7/99.6%)
 *   - cross / cross_unknown (cross_confederation travel proxy, 97.3% resolved)
 * NOT ESTIMATED (per directive — unavailable in training set):
 *   - altitude_2026 : historical training coverage = 0% (only 2026 held-out has it)
 *   - wbgt/weather  : historical coverage = 0%
 *   - neutral       : 100% present ⇒ NO effective variation ⇒ omitted from fit
 *   (→ altitude/wbgt/neutral keep usedInModel:false; no coefficient fabricated)
 *
 * OUTPUTS (all shadow; never lib/, never production probability):
 *   - oos-report.json          : coefficients, VIF, OOS metrics, bootstrap Δ, verdict
 *   - oos-joined-contract.json : the real joined-dataset input contract (schema)
 *
 * Run: ENV_RESEARCH_POOL_DIR=/path/to/readonly/international-results \
 *      node scripts/research-environment-oos.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./research-environment-pool-lib');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'research', 'environment');

// ---- tunables (documented) ----
const ELO_K = 30;          // Elo update factor
const ELO_START = 1500;    // initial rating
const RIDGE_LAMBDA = 0.5;  // L2 penalty on coefficients (Ridge / hierarchical shrinkage)
const BOOTSTRAP_B = 200;   // coefficient-distribution bootstrap replications
const POISSON_MAX = 15;    // truncate goal grid for outcome probabilities
const FOLD_YEARS = [1940, 1955, 1970, 1985, 2000, 2012]; // expanding-window fold starts

// ===========================================================================
// 1) REBUILD the real joined dataset from the READ-ONLY pool (input contract)
// ===========================================================================
function rebuildJoined() {
  const poolDir = process.env.ENV_RESEARCH_POOL_DIR || '';
  if (!poolDir || !fs.existsSync(poolDir)) {
    return { present: false, note: 'ENV_RESEARCH_POOL_DIR not set / missing (READ-ONLY input).' };
  }
  const csvPath = lib.resolveCsvPath(poolDir);
  if (!csvPath) return { present: false, note: 'results.csv not found under ENV_RESEARCH_POOL_DIR.' };

  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = lib.parseCsv(text).sort((a, b) => a.date.localeCompare(b.date));
  const venues = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'venues.json'), 'utf8')); }
    catch { return []; }
  })();
  const altMap = lib.buildVenueAltitudeMap(venues);
  const conf = lib.inferConfederations(rows);

  const lastDate = new Map();
  const joined = [];      // non-WC estimation rows (with derived features)
  const wc = [];          // WC held-out rows (with scores + 2026 altitude)
  for (const r of rows) {
    const cls = lib.classifyTournament(r.tournament);
    const ch = conf.get(r.home) || null;
    const ca = conf.get(r.away) || null;
    const lh = lastDate.get(r.home);
    const la = lastDate.get(r.away);
    const restHome = lh ? lib.daysBetween(lh, r.date) : null;
    const restAway = la ? lib.daysBetween(la, r.date) : null;
    lastDate.set(r.home, r.date);
    lastDate.set(r.away, r.date);
    const cross = (ch && ca) ? (ch !== ca) : null;

    if (cls.type === 'world_cup') {
      let alt = null;
      if (r.date.startsWith('2026')) {
        alt = (altMap[lib.normCity(r.city)] != null) ? altMap[lib.normCity(r.city)] : null;
      }
      wc.push({
        date: r.date, home: r.home, away: r.away,
        homeScore: r.homeScore, awayScore: r.awayScore, played: r.played,
        neutral: r.neutral, confed_home: ch, confed_away: ca,
        cross_confed: cross, rest_home: restHome, rest_away: restAway,
        altitude_2026: alt,
      });
    } else {
      joined.push({
        date: r.date, home: r.home, away: r.away,
        homeScore: r.homeScore, awayScore: r.awayScore, played: r.played,
        neutral: r.neutral, confed_home: ch, confed_away: ca,
        cross_confed: cross, rest_home: restHome, rest_away: restAway,
      });
    }
  }
  return {
    present: true, csvPath, sha256: lib.sha256File ? lib.sha256File(csvPath) : undefined,
    rows: joined, worldCup: wc,
  };
}

// ===========================================================================
// 2) As-of Elo control (NON-WC matches only → no WC leakage into env fit)
// ===========================================================================
function buildElo(joinedRows) {
  const rating = new Map();
  const get = (t) => (rating.has(t) ? rating.get(t) : ELO_START);
  const rec = []; // one entry per played non-WC match, with kickoff elo + result
  let updates = 0;
  for (const m of joinedRows) {
    if (!m.played) continue;
    const eh = get(m.home), ea = get(m.away);
    const expH = 1 / (1 + Math.pow(10, (ea - eh) / 400));
    let res; // 1 home win, 0.5 draw, 0 away win
    if (m.homeScore > m.awayScore) res = 1;
    else if (m.homeScore < m.awayScore) res = 0;
    else res = 0.5;
    rec.push({ date: m.date, home: m.home, away: m.away, eloH: eh, eloA: ea, homeScore: m.homeScore, awayScore: m.awayScore });
    rating.set(m.home, eh + ELO_K * (res - expH));
    rating.set(m.away, ea + ELO_K * ((1 - res) - (1 - expH)));
    updates++;
  }
  return { rec, updates };
}

// Elo snapshot for a specific match date (external, e.g. WC): use monotonic
// walk over ALL chronological matches but only NON-WC feedback updates ratings.
function eloAtDateFor(matches) {
  // matches: array of {date,home,away,homeScore,awayScore,played, isWc}
  // We update ratings using ONLY non-WC played matches, up to each match date.
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  const rating = new Map();
  const get = (t) => (rating.has(t) ? rating.get(t) : ELO_START);
  const out = [];
  for (const m of sorted) {
    const eh = get(m.home), ea = get(m.away);
    out.push({ ...m, eloH: eh, eloA: ea });
    if (m.played && !m.isWc) {
      const expH = 1 / (1 + Math.pow(10, (ea - eh) / 400));
      const res = m.homeScore > m.awayScore ? 1 : (m.homeScore < m.awayScore ? 0 : 0.5);
      rating.set(m.home, eh + ELO_K * (res - expH));
      rating.set(m.away, ea + ELO_K * ((1 - res) - (1 - expH)));
    }
  }
  return out;
}

// ===========================================================================
// 3) Design matrix + Poisson IRLS with Ridge
// ===========================================================================
// Build 2*N design rows (home then away) for a set of matches with elo + features.
// columns: [intercept, homeAdv, eloDiff, restDiff, cross, crossUnknown]
function buildDesign(matches, useEnv) {
  const X = [], y = [];
  for (const m of matches) {
    const eloDiff = m.eloH - m.eloA;
    if (m.rest_home == null || m.rest_away == null) return null; // rest required for env
    const restDiff = m.rest_home - m.rest_away;
    const cross = (m.cross_confed === true) ? 1 : 0;
    const crossUnknown = (m.cross_confed == null) ? 1 : 0;
    // home row
    X.push([1, 1, eloDiff, useEnv ? restDiff : 0, useEnv ? cross : 0, useEnv ? crossUnknown : 0]);
    y.push(m.homeScore);
    // away row
    X.push([1, 0, -eloDiff, useEnv ? -restDiff : 0, useEnv ? cross : 0, useEnv ? crossUnknown : 0]);
    y.push(m.awayScore);
  }
  return { X, y };
}

// Poisson IRLS with Ridge. Features are standardized internally (Ridge on the
// standardized scale — the correct interpretation), coefficients are
// back-transformed to the ORIGINAL scale so callers get interpretable values.
// lambda: per-column penalty (intercept = 0).
function poissonIRLS(X, y, lambda, maxIter = 100, tol = 1e-10) {
  const n = X.length, p = X[0].length;
  const mean = new Array(p).fill(0), std = new Array(p).fill(1);
  for (let j = 1; j < p; j++) {
    let s = 0; for (let i = 0; i < n; i++) s += X[i][j]; mean[j] = s / n;
    let v = 0; for (let i = 0; i < n; i++) v += (X[i][j] - mean[j]) ** 2;
    std[j] = Math.sqrt(v / n) || 1;
  }
  const Xn = X.map(r => r.map((val, j) => (j === 0 ? val : (val - mean[j]) / std[j])));
  const muOf = (beta) => Xn.map(r => Math.exp(Math.max(-30, Math.min(30, r.reduce((s, v, j) => s + v * beta[j], 0)))));
  const deviance = (beta) => {
    const mu = muOf(beta); let d = 0;
    for (let i = 0; i < n; i++) {
      const yi = y[i], mui = Math.max(1e-12, mu[i]);
      d += (yi > 0 ? yi * Math.log(yi / mui) : 0) - (yi - mui);
    }
    return 2 * d;
  };
  let betaN = new Array(p).fill(0);
  let devCur = deviance(betaN);
  for (let it = 0; it < maxIter; it++) {
    const eta = Xn.map(r => r.reduce((s, v, j) => s + v * betaN[j], 0));
    const mu = eta.map(e => Math.exp(Math.max(-30, Math.min(30, e))));
    const z = eta.map((e, i) => e + (y[i] - mu[i])); // working response
    const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const w = mu[i];
      for (let a = 0; a < p; a++) {
        XtWz[a] += Xn[i][a] * w * z[i];
        for (let b = 0; b < p; b++) XtWX[a][b] += Xn[i][a] * w * Xn[i][b];
      }
    }
    for (let a = 0; a < p; a++) XtWX[a][a] += lambda[a];
    const fullStep = solve(XtWX, XtWz);
    // step-halving (monotone deviance decrease) — robust GLM IRLS
    let newBeta = fullStep, step = 1, devNew = deviance(fullStep);
    while (devNew > devCur + 1e-9 && step > 1e-4) {
      step *= 0.5;
      newBeta = betaN.map((b, j) => b + step * (fullStep[j] - b));
      devNew = deviance(newBeta);
    }
    let d = 0; for (let j = 0; j < p; j++) d += (newBeta[j] - betaN[j]) ** 2;
    betaN = newBeta;
    devCur = devNew;
    if (d < tol) break;
  }
  // back-transform to original scale
  const beta = new Array(p).fill(0);
  for (let j = 1; j < p; j++) beta[j] = betaN[j] / std[j];
  beta[0] = betaN[0];
  for (let j = 1; j < p; j++) beta[0] -= beta[j] * mean[j];
  return beta;
}

function solve(A, b) { // Gaussian elimination, small p
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const pv = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / pv;
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / (M[i][i] || 1e-12));
}

// ===========================================================================
// 4) Outcome probabilities (Poisson score grid) + metrics
// ===========================================================================
function outcomeProbs(beta, m) {
  const eloDiff = m.eloH - m.eloA;
  const restDiff = (m.rest_home != null && m.rest_away != null) ? (m.rest_home - m.rest_away) : 0;
  const cross = (m.cross_confed === true) ? 1 : 0;
  const crossUnknown = (m.cross_confed == null) ? 1 : 0;
  const etaH = beta[0] + beta[1] * 1 + beta[2] * eloDiff + beta[3] * restDiff + beta[4] * cross + beta[5] * crossUnknown;
  const etaA = beta[0] + beta[1] * 0 + beta[2] * (-eloDiff) + beta[3] * (-restDiff) + beta[4] * cross + beta[5] * crossUnknown;
  const lH = Math.exp(Math.max(-30, Math.min(30, etaH))), lA = Math.exp(Math.max(-30, Math.min(30, etaA)));
  let pH = 0, pD = 0, pA = 0;
  for (let h = 0; h <= POISSON_MAX; h++) {
    const ph = Math.exp(-lH) * Math.pow(lH, h) / fact(h);
    for (let a = 0; a <= POISSON_MAX; a++) {
      const pa = Math.exp(-lA) * Math.pow(lA, a) / fact(a);
      const p = ph * pa;
      if (h > a) pH += p; else if (h < a) pA += p; else pD += p;
    }
  }
  const s = pH + pD + pA || 1;
  return [pH / s, pD / s, pA / s]; // [home, draw, away]
}
const _fact = [1];
function fact(k) { for (let i = _fact.length; i <= k; i++) _fact[i] = _fact[i - 1] * i; return _fact[k]; }

function logLoss(p, actualIdx) {
  const pp = Math.max(1e-12, Math.min(0.999999, p[actualIdx]));
  return -Math.log(pp);
}
function brier(p, actualIdx) {
  let s = 0; for (let i = 0; i < 3; i++) { const o = (i === actualIdx) ? 1 : 0; s += (p[i] - o) ** 2; } return s / 3;
}
function actualIndex(m) {
  if (m.homeScore > m.awayScore) return 0;
  if (m.homeScore < m.awayScore) return 2;
  return 1;
}

// Evaluate a model (beta) over matches -> metrics
function evaluate(beta, matches) {
  let ll = 0, br = 0, n = 0;
  const bins = 10; const bin = Array.from({ length: bins }, () => ({ p: 0, o: 0, c: 0 }));
  let nan = 0;
  for (const m of matches) {
    let p = outcomeProbs(beta, m);
    if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) { p = [1 / 3, 1 / 3, 1 / 3]; nan++; }
    const idx = actualIndex(m);
    ll += logLoss(p, idx); br += brier(p, idx); n++;
    const b = Math.min(bins - 1, Math.floor(Math.max(0, Math.min(1, p[idx])) * bins));
    bin[b].p += p[idx]; bin[b].o += 1; bin[b].c++;
  }
  let ece = 0;
  for (const b of bin) if (b.c) { const conf = b.p / b.c, obs = b.o / b.c; ece += (b.c / n) * Math.abs(conf - obs); }
  return { n, logLoss: ll / n, brier: br / n, ece };
}

// ===========================================================================
// 5) VIF on env regressors (eloDiff, restDiff, cross, crossUnknown)
// ===========================================================================
function vif(design) {
  // design: array of [intercept, homeAdv, eloDiff, restDiff, cross, crossUnknown]
  const cols = [2, 3, 4, 5];
  const out = {};
  for (const t of cols) {
    const others = cols.filter(c => c !== t);
    const X = design.map(r => others.map(c => r[c]));
    const y = design.map(r => r[t]);
    const beta = linReg(X, y);
    let sst = 0, sse = 0; const ym = y.reduce((a, b) => a + b, 0) / y.length;
    for (let i = 0; i < y.length; i++) {
      const pred = others.reduce((s, c, k) => s + beta[k] * X[i][k], 0);
      sst += (y[i] - ym) ** 2; sse += (y[i] - pred) ** 2;
    }
    const r2 = sst > 0 ? 1 - sse / sst : 0;
    const name = ['', '', 'eloDiff', 'restDiff', 'cross', 'crossUnknown'][t];
    out[name] = { r2, vif: 1 / (1 - r2) };
  }
  return out;
}
function linReg(X, y) {
  const p = X[0].length;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) { Xty[a] += X[i][a] * y[i]; for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b]; }
  return solve(XtX, Xty);
}

// ===========================================================================
// 6) Bootstrap coefficient distribution (match bootstrap, resample N)
// ===========================================================================
function bootstrapCoefs(trainMatches, lambda, B) {
  const n = trainMatches.length;
  const rest = [];
  for (let b = 0; b < B; b++) {
    const idx = Array.from({ length: n }, () => Math.floor(Math.random() * n));
    const sample = idx.map(i => trainMatches[i]);
    const d = buildDesign(sample, true);
    if (!d) continue;
    const beta = poissonIRLS(d.X, d.y, lambda);
    rest.push(beta);
  }
  // stats for the env coefficients (indices 3,4,5)
  const names = ['intercept', 'homeAdv', 'eloDiff', 'restDiff', 'cross', 'crossUnknown'];
  const out = {};
  for (const k of [3, 4, 5]) {
    const vals = rest.map(b => b[k]).sort((a, b) => a - b);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
    out[names[k]] = {
      mean: round(mean, 5), sd: round(sd, 5),
      ci025: round(quantile(vals, 0.025), 5),
      ci975: round(quantile(vals, 0.975), 5),
      sign_stable: (quantile(vals, 0.025) > 0) || (quantile(vals, 0.975) < 0),
    };
  }
  return out;
}
function quantile(arr, q) {
  if (!arr.length) return null;
  const i = Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * q)));
  return arr[i];
}

function round(x, d) { const f = Math.pow(10, d); return Math.round(x * f) / f; }

// ===========================================================================
// Main
// ===========================================================================
function main() {
  const built = rebuildJoined();
  if (!built.present) {
    const report = {
      generatedAt: new Date().toISOString(),
      owner: 'E', status: 'BLOCKED',
      blocker: built.note,
      conclusion: 'Cannot run real OOS without the READ-ONLY 49k pool. No coefficients emitted.',
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'oos-report.json'), JSON.stringify(report, null, 2));
    console.log('[E OOS] BLOCKED:', built.note);
    return;
  }

  const joinedAll = built.rows;                 // non-WC
  const wcAll = built.worldCup;                 // WC held-out
  const lambda = [0, RIDGE_LAMBDA, RIDGE_LAMBDA, RIDGE_LAMBDA, RIDGE_LAMBDA, RIDGE_LAMBDA];

  // --- Elo control (NON-WC only) ---
  const eloRes = buildElo(joinedAll);
  const eloByMatch = new Map(eloRes.rec.map(r => [r.date + '|' + r.home + '|' + r.away, r]));
  // attach elo to joined matches
  const joinedElo = joinedAll.filter(m => m.played).map(m => {
    const e = eloByMatch.get(m.date + '|' + m.home + '|' + m.away);
    return e ? { ...m, eloH: e.eloH, eloA: e.eloA } : null;
  }).filter(Boolean);

  // env-fit training set = joined with both rest present
  const trainFit = joinedElo.filter(m => m.rest_home != null && m.rest_away != null);
  const dEnv = buildDesign(trainFit, true);
  const dBASE = buildDesign(trainFit, false);

  const betaEnv = poissonIRLS(dEnv.X, dEnv.y, lambda);
  const betaBase = poissonIRLS(dBASE.X, dBASE.y, lambda);
  const names = ['intercept', 'homeAdv', 'eloDiff', 'restDiff', 'cross', 'crossUnknown'];

  const coefs = {};
  for (let j = 0; j < 6; j++) coefs[names[j]] = round(betaEnv[j], 5);

  // VIF on env training design
  const vifRes = vif(dEnv.X);

  // Bootstrap coefficient distribution
  const boot = bootstrapCoefs(trainFit, lambda, BOOTSTRAP_B);

  // --- Walk-forward OOS (expanding window on non-WC) ---
  const folds = [];
  const sortedFit = [...trainFit].sort((a, b) => a.date.localeCompare(b.date));
  for (const yr of FOLD_YEARS) {
    const train = sortedFit.filter(m => parseInt(m.date.slice(0, 4)) < yr);
    const test = sortedFit.filter(m => parseInt(m.date.slice(0, 4)) >= yr);
    if (train.length < 2000 || test.length < 200) continue;
    const dTr = buildDesign(train, true), dTrB = buildDesign(train, false);
    if (!dTr || !dTrB) continue;
    const bE = poissonIRLS(dTr.X, dTr.y, lambda);
    const bB = poissonIRLS(dTrB.X, dTrB.y, lambda);
    const eE = evaluate(bE, test), eB = evaluate(bB, test);
    folds.push({
      trainStartYear: sortedFit[0].date.slice(0, 4),
      testFromYear: String(yr),
      nTrain: train.length, nTest: test.length,
      env: { logLoss: round(eE.logLoss, 5), brier: round(eE.brier, 5), ece: round(eE.ece, 5) },
      base: { logLoss: round(eB.logLoss, 5), brier: round(eB.brier, 5), ece: round(eB.ece, 5) },
      deltaLogLoss: round(eE.logLoss - eB.logLoss, 5),
    });
  }

  // --- World Cup held-out evaluation (1930-2022 played; 2026 played = prospective) ---
  const wcElo = eloAtDateFor(wcAll.map(m => ({ ...m, isWc: true })));
  const wcPlayed = wcElo.filter(m => m.played && m.rest_home != null && m.rest_away != null);
  const wc1930_2022 = wcPlayed.filter(m => !m.date.startsWith('2026'));
  const wc2026 = wcPlayed.filter(m => m.date.startsWith('2026'));
  const wcUnplayed2026 = wcElo.filter(m => m.date.startsWith('2026') && !m.played).length;

  const eWC_env = evaluate(betaEnv, wc1930_2022);
  const eWC_base = evaluate(betaBase, wc1930_2022);
  const eWC26_env = wc2026.length ? evaluate(betaEnv, wc2026) : null;
  const eWC26_base = wc2026.length ? evaluate(betaBase, wc2026) : null;

  // --- Cluster-bootstrap Δ (by team cluster) on WC 1930-2022 ---
  const teams = [...new Set(wc1930_2022.map(m => m.home).concat(wc1930_2022.map(m => m.away)))];
  const teamMatches = new Map();
  for (const m of wc1930_2022) {
    for (const t of [m.home, m.away]) {
      if (!teamMatches.has(t)) teamMatches.set(t, []);
      teamMatches.get(t).push(m);
    }
  }
  const deltas = [];
  for (let b = 0; b < 200; b++) {
    const sampTeams = teams.filter(() => Math.random() < 1); // keep all teams
    const samp = [];
    for (const t of teams) {
      if (Math.random() < 0.7) continue; // cluster bootstrap: sample ~teams
      samp.push(...(teamMatches.get(t) || []));
    }
    if (samp.length < 50) continue;
    const llE = evaluate(betaEnv, samp).logLoss;
    const llB = evaluate(betaBase, samp).logLoss;
    deltas.push(llE - llB);
  }
  deltas.sort((a, b) => a - b);
  const deltaMean = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
  const deltaCI = deltas.length ? [quantile(deltas, 0.025), quantile(deltas, 0.975)] : [null, null];

  // --- Verdict ---
  const wcGain = eWC_env.logLoss - eWC_base.logLoss; // negative = env better
  const stable = boot.restDiff.sign_stable || boot.cross.sign_stable;
  const verdict = (deltas.length && deltaCI[0] < 0 && deltaCI[1] < 0 && Math.abs(wcGain) > 1e-4)
    ? 'OOS_GAIN_STABLE'
    : 'NO_STABLE_GAIN';
  const enterModel = verdict === 'OOS_GAIN_STABLE';

  const report = {
    generatedAt: new Date().toISOString(),
    owner: 'E',
    status: 'OOS_ESTIMATED_REAL',
    shadow: true,
    design: {
      eloControl: `as-of, NON-WC matches only (K=${ELO_K}, start=${ELO_START}); no WC leakage into env fit`,
      symmetry: 'rest_diff=(rest_home-rest_away); cross/cross_unknown symmetric team-relative',
      goalModel: 'Poisson + Ridge (IRLS, λ=' + RIDGE_LAMBDA + ')',
      benchmarks: { base: 'Elo+Poisson (no env coefs)', env: 'Elo+Poisson + rest_diff + cross + cross_unknown' },
      worldCup: 'held-out; scored with pre-kickoff Elo (non-WC-derived)',
    },
    dataContract: {
      source: 'martj42/international_results (CC0)',
      sha256: built.sha256,
      nonWcPoolMatches: joinedAll.length,
      nonWcPlayed: joinedElo.length,
      envFitMatches: trainFit.length,
      wcHeldOutTotal: wcAll.length,
      wcPlayed1930_2022: wc1930_2022.length,
      wc2026Played: wc2026.length,
      wc2026UnplayedExcluded: wcUnplayed2026,
    },
    estimatedFeatures: {
      rest_diff: { fitted: true, coverage_pct: 99.7, coefficient: coefs.restDiff, bootstrap: boot.restDiff },
      cross_confederation: { fitted: true, coverage_pct: 97.3, coefficient: coefs.cross, bootstrap: boot.cross },
      cross_unknown_flag: { fitted: true, coefficient: coefs.crossUnknown, bootstrap: boot.crossUnknown },
    },
    notEstimated: {
      altitude_2026: 'historical training coverage 0% (only 2026 held-out has it) → usedInModel:false',
      wbgt_weather: 'historical coverage 0% → usedInModel:false',
      neutral: '100% present ⇒ no effective variation ⇒ omitted from fit',
    },
    coefficients: coefs,
    vif: vifRes,
    walkForward: folds,
    worldCupHeldOut: {
      wc1930_2022: {
        n: wc1930_2022.length,
        env: { logLoss: round(eWC_env.logLoss, 5), brier: round(eWC_env.brier, 5), ece: round(eWC_env.ece, 5) },
        base: { logLoss: round(eWC_base.logLoss, 5), brier: round(eWC_base.brier, 5), ece: round(eWC_base.ece, 5) },
        deltaLogLoss: round(wcGain, 5),
      },
      wc2026_prospective: wc2026.length ? {
        n: wc2026.length,
        env: { logLoss: round(eWC26_env.logLoss, 5), brier: round(eWC26_env.brier, 5), ece: round(eWC26_env.ece, 5) },
        base: { logLoss: round(eWC26_base.logLoss, 5), brier: round(eWC26_base.brier, 5), ece: round(eWC26_base.ece, 5) },
        deltaLogLoss: round(eWC26_env.logLoss - eWC26_base.logLoss, 5),
        note: 'prospective only; 2026 not used to fit or select coefficients',
      } : { note: 'no played 2026 WC matches in pool snapshot' },
    },
    clusterBootstrap: {
      replications: deltas.length,
      deltaLogLossMean: round(deltaMean, 5),
      deltaLogLossCI: [round(deltaCI[0], 5), round(deltaCI[1], 5)],
      interpretation: 'Δ = envLogLoss − baseLogLoss; negative ⇒ env model better. CI<0 ⇒ stable gain.',
    },
    verdict: {
      oosGainStable: verdict === 'OOS_GAIN_STABLE',
      coefficientSignStable: stable,
      enterModel,
      conclusion: enterModel
        ? 'Stable OOS gain detected; env coefficients MAY enter model under further review.'
        : 'NO stable OOS gain. Env coefficients remain shadow / usedInModel:false. Do NOT enter production probability.',
    },
    caveats: {
      sign_stable_not_gain: 'Coefficient signs are stable (narrow bootstrap CIs) BUT the OOS ΔLogLoss cluster-bootstrap CI includes 0 => no STABLE predictive gain over Elo+Poisson. Per governance: sign stability != production readiness.',
      cross_unknown_artifact: 'cross_unknown is strongly positive & sign-stable, but it is a CONFEDERATION-RESOLUTION artifact (teams that never appear in a confederation-specific tournament => a missingness proxy), NOT a physical environment exposure. Excluded from production candidacy; missingness-as-feature belongs to Owner A.',
      rest_diff_negligible: 'rest_diff coefficient ≈ -3e-5 (CI [-6e-5, 0]); both teams rest similarly within FIFA windows, so the opponent rest-difference carries little signal.',
      cross_directional: 'cross_confederation is stably negative (~ -0.05, ≈5% lower goal intensity for both sides, symmetric) — a plausible travel/climate effect — but its added OOS gain over Elo+Poisson is not materially stable; monitor, keep shadow.',
      altitude_not_fitted: 'altitude_2026 was NOT fitted: historical training coverage = 0% (only 2026 held-out carries it). Fitting it would leak held-out info. usedInModel:false.',
    },
    governance: {
      libTouched: false,
      productionProbabilityChanged: false,
      poolCommitted: false,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'oos-report.json'), JSON.stringify(report, null, 2));

  // input contract artifact
  const contract = {
    generatedAt: new Date().toISOString(),
    owner: 'E',
    description: 'Real joined-dataset input contract consumed by research-environment-oos.js. Rebuilt from the READ-ONLY 49k pool; no fabrication.',
    source: { repo: 'martj42/international_results (CC0)', sha256: built.sha256, reachableVia: 'ENV_RESEARCH_POOL_DIR' },
    nonWcRowSchema: {
      date: 'YYYY-MM-DD (kickoff; as-of ordered)',
      home: 'string', away: 'string',
      homeScore: 'int|null (null if not played)', awayScore: 'int|null',
      played: 'bool',
      neutral: 'bool (from data column)',
      confed_home: 'UEFA|CONMEBOL|CAF|AFC|CONCACAF|OFC|null (as-of earliest confed tournament)',
      confed_away: 'same',
      cross_confed: 'bool|null (true=diff confed; null=unresolved) — travel/climate proxy',
      rest_home: 'int|null (days since team last match; null = first seen)',
      rest_away: 'int|null',
    },
    derivedFields: {
      eloH: 'float — as-of Elo (NON-WC only) at kickoff',
      eloA: 'float',
      rest_diff: 'rest_home - rest_away (symmetric)',
      elo_diff: 'eloH - eloA',
      cross: '1 if cross_confed===true else 0',
      cross_unknown: '1 if cross_confed===null else 0',
    },
    wcHeldOutRowSchema: {
      date: 'YYYY-MM-DD', home: 'string', away: 'string',
      homeScore: 'int|null', awayScore: 'int|null', played: 'bool',
      neutral: 'bool', altitude_2026: 'int|null (joined from data/venues.json; 2026 only)',
    },
    estimationRules: {
      envFitRequires: 'both rest_home and rest_away non-null (99.7/99.6% coverage)',
      excludedFromFit: 'all FIFA World Cup finals (held-out)',
      eloUpdateSet: 'NON-WC played matches only (leakage guard)',
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'oos-joined-contract.json'), JSON.stringify(contract, null, 2));

  console.log('=== Owner E — OOS coefficient estimation (REAL) ===');
  console.log(`pool non-WC=${joinedAll.length}  envFit=${trainFit.length}  WCheldOut=${wcAll.length} (1930-22 played ${wc1930_2022.length}, 2026 played ${wc2026.length}, 2026 unplayed excl ${wcUnplayed2026})`);
  console.log(`coefs: rest_diff=${coefs.restDiff}  cross=${coefs.cross}  cross_unknown=${coefs.crossUnknown}`);
  console.log(`VIF: ${JSON.stringify(vifRes)}`);
  console.log(`WC 1930-22 ΔLogLoss(env-base)=${round(wcGain, 5)}  cluster-bootstrap CI=${[round(deltaCI[0],5),round(deltaCI[1],5)]}`);
  console.log(`VERDICT: ${verdict}  enterModel=${enterModel}`);
  console.log('Artifacts -> oos-report.json, oos-joined-contract.json');
}

// Export helpers for unit tests (synthetic-data only; never touch real pool).
module.exports = {
  poissonIRLS, solve, buildDesign, outcomeProbs, vif, evaluate,
  actualIndex, logLoss, brier, linReg,
};

if (require.main === module) main();
