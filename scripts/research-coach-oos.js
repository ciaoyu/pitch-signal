#!/usr/bin/env node
/**
 * Owner H — coach value-added OOS coefficient skeleton (honest, no fabrication).
 *
 * Design (when external read-only inputs are present):
 *   - Walk-forward windows with strict as-of cutoff (see coach-leakage-guard.md)
 *   - Hierarchical shrinkage: coach_effect_c ~ N(mu_global, tau^2)
 *   - Target: residual of xg_diff after controlling Elo/playerQuality/opponent/
 *     competition/venue/rest
 *   - Posterior / sampled distribution reported per coach
 *   - OOS metrics: LogLoss, Brier, calibration, delta vs base (no coach)
 *
 * BLOCKED (not faked) when required inputs are absent.
 *
 * Run: node scripts/research-coach-oos.js
 * Env (optional, read-only):
 *   COACH_RESEARCH_TENURE_DIR  -> coach tenure history (start/end + source)
 *   COACH_RESEARCH_POOL_DIR    -> international results pool (qualifiers/continental/friendlies/WC)
 *   COACH_RESEARCH_XG_REF      -> F's xG/lineup artifact (reference only)
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const outDir = path.join(ROOT, 'data', 'research', 'coach');

function dirHasData(envVar) {
  const dir = process.env[envVar];
  if (!dir) return { ok: false, reason: `env ${envVar} not set` };
  if (!fs.existsSync(dir)) return { ok: false, reason: `path ${dir} does not exist` };
  const files = fs.readdirSync(dir).filter((f) => /\.(json|csv)$/.test(f));
  if (!files.length) return { ok: false, reason: `no data files in ${dir}` };
  return { ok: true, files: files.length };
}

const tenure = dirHasData('COACH_RESEARCH_TENURE_DIR');
const pool = dirHasData('COACH_RESEARCH_POOL_DIR');
const xg = process.env.COACH_RESEARCH_XG_REF
  ? (fs.existsSync(process.env.COACH_RESEARCH_XG_REF)
      ? { ok: true } : { ok: false, reason: 'xg ref missing' })
  : { ok: false, reason: 'COACH_RESEARCH_XG_REF not set (F artifact reference)' };

// ---- Honest gate: block if inputs missing (do NOT fabricate coefficients) ----
const required = [
  ['tenure history', tenure],
  ['international results pool', pool],
  ['xG/lineup reference', xg],
];

const blockers = required.filter(([, s]) => !s.ok).map(([n, s]) => `${n}: ${s.reason}`);

const report = {
  owner: 'H',
  task: 'coach-value-added-oos',
  generated_at: new Date().toISOString(),
  base_commit: '78da1b5',
  status: blockers.length ? 'BLOCKED' : 'RUNNABLE',
  design: {
    oos_scheme: 'walk-forward with strict as-of cutoff',
    shrinkage: 'hierarchical: coach_effect_c ~ N(mu_global, tau^2); mu_global~N(0,..); tau~HalfCauchy',
    target: 'residual of xg_diff after controlling Elo/playerQuality/opponent/competition/venue/rest',
    posterior: 'per-coach sampled/posterior distribution required in deliverable',
    metrics: ['LogLoss', 'Brier', 'calibration', 'delta_vs_base'],
    short_tenure_guard: 'match count < 10 -> strong shrinkage to mu_global, wide posterior',
    collinearity: 'report VIF of coach_effect vs playerQuality; ridge prior if VIF>5',
    selection_bias: 'control pre-tenure xg_diff sliding mean (as-of) to strip rebound effect',
    enter_model_rule: 'only if OOS shows stable positive delta AND cross-era stable AND short-tenure interval not degraded; else usedInModel:false'
  },
  input_checks: {
    tenure: tenure,
    pool: pool,
    xg_ref: xg
  },
  blockers: blockers,
  coefficients: null,
  oos_metrics: null,
  posterior_samples: null,
  conclusion: blockers.length
    ? 'OOS estimation BLOCKED: required read-only inputs missing. No coefficients fabricated. ' +
      'Coach effect remains usedInModel:false. Supply COACH_RESEARCH_TENURE_DIR, ' +
      'COACH_RESEARCH_POOL_DIR and (for xg residual) COACH_RESEARCH_XG_REF to run.'
    : 'Inputs present — would run walk-forward OOS and emit coefficients/posterior/metrics here.'
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'oos-report.json'), JSON.stringify(report, null, 2));

console.log('=== Owner H coach OOS skeleton ===');
if (blockers.length) {
  console.log('STATUS: BLOCKED (honest — no fabricated coefficients)');
  for (const b of blockers) console.log('  - ' + b);
  console.log('Conclusion: coach effect stays usedInModel:false until inputs supplied + OOS positive.');
} else {
  console.log('STATUS: RUNNABLE — external inputs present (run full estimation path).');
}
console.log('Report written to data/research/coach/oos-report.json');
