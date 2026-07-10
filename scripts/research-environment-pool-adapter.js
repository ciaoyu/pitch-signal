#!/usr/bin/env node
/**
 * Owner E — 49k international-results READ-ONLY adapter (CLI).
 *
 * Reads the external CC0 pool (martj42/international_results results.csv) and
 * writes derived research artifacts. NEVER writes the pool, NEVER edits lib/.
 *
 * Run:
 *   export ENV_RESEARCH_POOL_DIR=/path/to/readonly/international-results
 *   node scripts/research-environment-pool-adapter.js
 *   # optional: dump full joined rows (outside repo) for later OOS:
 *   node scripts/research-environment-pool-adapter.js --emit-joined /tmp/e-joined.jsonl
 */
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./research-environment-pool-lib');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'research', 'environment');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

function main() {
  const poolArg = process.env.ENV_RESEARCH_POOL_DIR ||
    (process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : null);
  const emitIdx = process.argv.indexOf('--emit-joined');
  const emitJoinedPath = emitIdx !== -1 ? process.argv[emitIdx + 1] : null;

  const venues = readJson(path.join(ROOT, 'data', 'venues.json')) || [];

  const result = lib.analyzePool(poolArg, { venues, emitJoinedPath });

  if (!result.present) {
    console.log('[adapter] pool NOT present. Set ENV_RESEARCH_POOL_DIR (read-only CC0 copy). Nothing written.');
    process.exit(0);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Pool coverage (venue / weather / travel / rest feature coverage)
  const poolCoverage = {
    source: result.source,
    csvPath: result.csvPath,
    sha256: result.sha256,
    generatedAt: result.generatedAt,
    years: result.years,
    pool: result.pool,
    heldOut: result.heldOut,
    featureCoverage: result.coverage,
    missingReasons: result.missingReasons,
    note: 'World Cup finals held out; venue altitude joined for 2026 only; weather/WBGT unavailable; travel via cross_confederation proxy; rest via date-ordered gap. No fabrication.',
  };
  fs.writeFileSync(path.join(OUT_DIR, 'pool-coverage.json'), JSON.stringify(poolCoverage, null, 2));

  // World Cup held-out manifest (for later OOS)
  const heldOutManifest = {
    source: result.source,
    sha256: result.sha256,
    generatedAt: result.generatedAt,
    count: result.worldCupHeldOut.length,
    note: 'Exact "FIFA World Cup" matches excluded from the estimation pool. played=false rows are scheduled (NA scores) at download time.',
    matches: result.worldCupHeldOut,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'wc-heldout-manifest.json'), JSON.stringify(heldOutManifest, null, 2));

  const cov = result.coverage;
  console.log('=== Owner E — 49k pool adapter ===');
  console.log(`source: ${result.source}`);
  console.log(`sha256: ${result.sha256}`);
  console.log(`years : ${result.years.min}–${result.years.max}`);
  console.log(`pool (non-WC): ${result.pool.total_non_wc} matches (${result.pool.played_non_wc} played)`);
  console.log(`WC held-out: ${result.heldOut.world_cup_total} (2026: ${result.heldOut.world_cup_2026}, altitude joined ${result.heldOut.world_cup_2026_altitude_joined_pct}%)`);
  console.log('--- feature coverage (non-WC pool) ---');
  console.log(`  rest_days_home            ${cov.rest_days_home_pct}%`);
  console.log(`  rest_days_away            ${cov.rest_days_away_pct}%`);
  console.log(`  neutral                   ${cov.neutral_pct}%`);
  console.log(`  tournament_type           ${cov.tournament_type_pct}%`);
  console.log(`  confed_home resolved      ${cov.confed_home_resolved_pct}%`);
  console.log(`  confed_away resolved      ${cov.confed_away_resolved_pct}%`);
  console.log(`  cross_confederation resol ${cov.cross_confederation_resolved_pct}%`);
  console.log(`  altitude (historical)     ${cov.altitude_historical_pct}%  (unavailable)`);
  console.log(`  weather/WBGT              ${cov.weather_wbgt_pct}%  (unavailable)`);
  console.log(`\nArtifacts -> data/research/environment/pool-coverage.json, wc-heldout-manifest.json`);
}

main();
