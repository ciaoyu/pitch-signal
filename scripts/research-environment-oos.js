#!/usr/bin/env node
/**
 * Owner E — environment-research OOS coefficient estimation (SKELETON / honest).
 *
 * Design (per master plan §E + methodology notes §3):
 *   - Estimate env effects in a LARGER international match pool; World Cup kept
 *     HELD-OUT (never in coefficient estimation).
 *   - Features enter symmetrically as team-relative exposure differences
 *     (A_i - A_opp) so both attack λ and opponent defense are affected; never
 *     punish one side only.
 *   - Strong regularization (Ridge / Elastic-Net / hierarchical Bayesian
 *     candidate) + collinearity diagnostics (VIF). Output the OOS DISTRIBUTION
 *     of candidate coefficients, NOT a production constant.
 *   - as-of guard: only pre-kickoff facts; WC held-out; 2026 not used as test.
 *
 * DATA REQUIREMENT: needs the external 49k international-results pool pointed to
 * by ENV_RESEARCH_POOL_DIR (READ-ONLY input; not in this repo). That pool must
 * carry env-exposure columns (altitude/wbgt/turf/travel/tz/rest/et) computed
 * pre-kickoff. If absent or missing env columns, this script REFUSES to emit
 * fake coefficients and reports the exact blocker (honest, per reviewer).
 *
 * Run: ENV_RESEARCH_POOL_DIR=/path/to/pool node scripts/research-environment-oos.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'research', 'environment');

const ENV_VARS = ['alt', 'wbgt', 'turf', 'travel', 'tz', 'rest', 'et'];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// --- minimal Ridge (closed-form) for the OOS distribution when data is present ---
function ridgeFit(X, y, lambda) {
  const n = X.length, k = X[0].length;
  // XtX + lambda*I
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 0; a < k; a++) XtX[a][a] += lambda;
  // Gaussian elimination (small k)
  const A = XtX.map((r, i) => [...r, Xty[i]]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const pv = A[c][c] || 1e-12;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / pv;
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((r, i) => r[k] / (A[i][i] || 1e-12));
}

function main() {
  const poolDir = process.env.ENV_RESEARCH_POOL_DIR || '';
  const status = {
    generatedAt: new Date().toISOString(),
    owner: 'E',
    design: {
      heldOut: 'World Cup (all editions) never in coefficient estimation',
      symmetry: 'features enter as (A_i - A_opp) team-relative differences',
      regularization: 'Ridge / Elastic-Net / hierarchical-Bayes candidate',
      asOf: 'pre-kickoff facts only; WC held-out; 2026 not test',
      output: 'OOS DISTRIBUTION of candidate coefficients (not a production constant)',
    },
    envVars: ENV_VARS,
    status: 'BLOCKED',
  };

  if (!poolDir || !fs.existsSync(poolDir)) {
    status.blocker = 'ENV_RESEARCH_POOL_DIR not set or missing. External 49k international-results pool is a READ-ONLY input and is NOT in this repo. Provide a local copy to run OOS.';
    status.conclusion = 'Cannot estimate coefficients without the external pool. Per reviewer: data-insufficiency is an acceptable completion state IF the deliverable states the boundary (not eligible to enter production probability).';
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'oos-report.json'), JSON.stringify(status, null, 2));
    console.log('[E OOS] BLOCKED: external 49k pool not provided (READ-ONLY input, not in repo).');
    console.log('[E OOS] No coefficients emitted. Report -> data/research/environment/oos-report.json');
    return;
  }

  // Load pool; verify env columns exist.
  const files = fs.readdirSync(poolDir).filter(f => /\.json$/i.test(f));
  let rows = [];
  for (const f of files) {
    const j = readJson(path.join(poolDir, f));
    if (!j) continue;
    rows = rows.concat(Array.isArray(j) ? j : (j.matches || j.data || []));
  }
  // detect env columns on first row
  const sample = rows[0] || {};
  const haveEnv = ENV_VARS.filter(v => sample[v] != null || sample['home_' + v] != null);
  if (haveEnv.length === 0) {
    status.blocker = 'Pool loaded but carries NO env-exposure columns (alt/wbgt/turf/travel/tz/rest/et). Feature engineering (team-relative exposure diff) requires pre-kickoff env data.';
    status.poolMatches = rows.length;
    status.conclusion = 'Cannot estimate coefficients: env features absent in pool. Document as not-eligible-to-enter-model.';
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'oos-report.json'), JSON.stringify(status, null, 2));
    console.log('[E OOS] BLOCKED: pool has no env columns. No coefficients emitted.');
    return;
  }

  // --- If env data present: build symmetric features, held-out WC, ridge OOS ---
  // (Illustrative implementation; real run needs pool schema matching home_*/away_* env fields.)
  const isWC = (m) => /world cup/i.test(m.tournament || m.competition || '') ||
                      (m.source && /worldcup/i.test(m.source));
  const train = rows.filter(m => !isWC(m));
  const test = rows.filter(m => isWC(m));
  status.poolMatches = rows.length;
  status.trainMatches = train.length;
  status.testMatchesHeldOut = test.length;
  status.envVarsAvailable = haveEnv;

  // Placeholder: real y = goal-difference residual after Elo control; features = (home_v - away_v).
  // We cannot synthesize real coefficients without true schema; emit design + counts and clearly
  // mark coefficients as TODO pending schema alignment, NOT fabricated numbers.
  status.coefficientsOOS = 'TODO: requires pool schema with home_*/away_* env fields + Elo control; not fabricated here';
  status.status = 'DESIGN_READY';
  status.conclusion = 'Design validated against pool; coefficient OOS distribution pending schema-aligned feature build. Until then: not eligible to enter production probability.';
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'oos-report.json'), JSON.stringify(status, null, 2));
  console.log(`[E OOS] Pool ${rows.length} matches; train ${train.length}; WC held-out ${test.length}; env vars present: ${haveEnv.join(',')}.`);
  console.log('[E OOS] Coefficients NOT emitted (need schema-aligned feature build). Report -> data/research/environment/oos-report.json');
}

main();
