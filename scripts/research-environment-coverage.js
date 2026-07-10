#!/usr/bin/env node
/**
 * Owner E — environment-research coverage audit (data-collection phase).
 *
 * Audits AVAILABILITY / COVERAGE / MISSING MECHANISM for environment, travel,
 * rest variables. Combines:
 *   - in-repo: data/venues.json (2026 venues), data/history/worldcup_*.json
 *     (1930-2022 results, parsed as {matches:[...]} OBJECTS), data/team_meta.json
 *   - external READ-ONLY input: the 49k international-results pool
 *     (martj42/international_results CC0) pointed to by ENV_RESEARCH_POOL_DIR.
 *     When present, the pool adapter computes REAL feature coverage
 *     (venue/weather/travel/rest) and a World Cup held-out manifest.
 *
 * It does NOT modify any production file. Output: data/research/environment/
 * coverage-report.json + human summary.
 *
 * Run: node scripts/research-environment-coverage.js
 *      (set ENV_RESEARCH_POOL_DIR for real 49k pool coverage)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./research-environment-pool-lib');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT_DIR = path.join(DATA, 'research', 'environment');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10; }

// ---- 1. WC2026 venue-level env coverage (in-repo) ----
const venues = readJson(path.join(DATA, 'venues.json')) || [];
const venueFields = ['altitude', 'grass', 'timezone', 'coordinates'];
const venueCoverage = {};
for (const f of venueFields) {
  venueCoverage[f] = pct(venues.filter(v => v[f] != null).length, venues.length);
}
const venueWbgt = 0; // no WBGT in venues.json

// ---- 2. WC history (1930-2022) — OBJECT format {matches:[...]} ----
const histDir = path.join(DATA, 'history');
const histFiles = fs.existsSync(histDir)
  ? fs.readdirSync(histDir).filter(f => /^worldcup_\d{4}\.json$/.test(f))
  : [];
let histMatches = 0;
const histYears = [];
for (const f of histFiles) {
  const j = readJson(path.join(histDir, f));
  if (!j || !Array.isArray(j.matches)) continue;
  histYears.push(j.year);
  histMatches += j.matches.length;
}

// ---- 3. team_meta env coverage ----
const teamMeta = readJson(path.join(DATA, 'team_meta.json')) || {};
const teamCount = Object.keys(teamMeta).length;
const teamEnvCoverage = 0; // no baseCamp altitude/timezone in team_meta.json

// ---- 4. external 49k pool (read-only) — REAL coverage when present ----
const poolDir = process.env.ENV_RESEARCH_POOL_DIR || '';
let pool = { present: false, note: 'not in repo; provide ENV_RESEARCH_POOL_DIR (read-only CC0 copy)' };
let poolResult = null;
if (poolDir && lib.resolveCsvPath(poolDir)) {
  poolResult = lib.analyzePool(poolDir, { venues });
  if (poolResult.present) {
    pool = {
      present: true,
      source: poolResult.source,
      sha256: poolResult.sha256,
      years: poolResult.years,
      pool_non_wc: poolResult.pool.total_non_wc,
      pool_played: poolResult.pool.played_non_wc,
      heldOut_wc_total: poolResult.heldOut.world_cup_total,
      heldOut_wc_2026_altitude_joined_pct: poolResult.heldOut.world_cup_2026_altitude_joined_pct,
      featureCoverage: poolResult.coverage,
      missingReasons: poolResult.missingReasons,
    };
  }
}

// ---- 5. Unified feature coverage (venue / weather / travel / rest) ----
// venue: 2026 altitude real (venues.json); historical altitude 0% (no table)
// weather: 0% (never recorded)
// travel: neutral (data) + cross_confederation proxy (pool-derived)
// rest: date-ordered gap (pool-derived)
const featureCoverage = {
  venue: {
    altitude_2026_pct: venueCoverage.altitude,                 // real, 2026 venues
    altitude_historical_pct: pool.present ? pool.featureCoverage.altitude_historical_pct : 0,
    note: '2026 venue altitude from in-repo venues.json. Historical (pre-2026) pool matches have NO altitude table -> 0%.',
  },
  weather: {
    wbgt_pct: 0,
    note: 'WBGT/weather never historically recorded for this pool; cannot fabricate.',
  },
  travel: {
    neutral_pct: pool.present ? pool.featureCoverage.neutral_pct : 0,
    cross_confederation_resolved_pct: pool.present ? pool.featureCoverage.cross_confederation_resolved_pct : 0,
    note: 'Travel/climate-stress proxied by neutral flag (data) + cross_confederation (pool-derived, as-of). Symmetric for both sides.',
  },
  rest: {
    rest_days_home_pct: pool.present ? pool.featureCoverage.rest_days_home_pct : 0,
    rest_days_away_pct: pool.present ? pool.featureCoverage.rest_days_away_pct : 0,
    note: 'Rest = days since each team previous match (date-ordered, as-of).',
  },
};

const report = {
  generatedAt: new Date().toISOString(),
  owner: 'E',
  baseline: '78da1b5',
  inRepo: {
    venues2026: {
      count: venues.length,
      coverage: venueCoverage,
      wbgtCoverage: venueWbgt,
      note: 'venue-level only; no WBGT/travel/rest/et/player-minute',
    },
    wcHistory: {
      editions: histFiles.length,
      years: histYears.sort(),
      matches: histMatches,
      note: 'results only (parsed as {matches:[...]} objects); NO env exposure fields',
    },
    teamMeta: {
      teams: teamCount,
      envCoverage: teamEnvCoverage,
      note: 'no baseCamp altitude/timezone',
    },
  },
  externalReadonly: { internationalResults49k: pool },
  featureCoverage,
  wcHeldOut: {
    historyDirEditions_matches: histMatches,          // 1930-2022 (data/history)
    poolWorldCup_matches: pool.present ? pool.heldOut_wc_total : 'pool absent',
    note: 'World Cup finals held out from estimation pool. Reconcile: history dir = 1930-2022; pool adds 2026 (scheduled).',
  },
  missingMechanism: 'structural: historical editions lack env fields; 2026 has venue-level only; weather/WBGT never recorded. Missing != neutral; degrade to base model; mark missing_reason.',
  conclusion: {
    canEstimateTeamLevelProxyNow: pool.present,
    note: pool.present
      ? 'Real 49k pool joined: rest + travel(cross_confed) + 2026 altitude available. Stable env coefficients still need walk-forward OOS (WC held-out) with ridge/hierarchical shrinkage + VIF. NOT eligible to enter production probability until OOS shows gain.'
      : 'Pool absent. Team-level proxy for 2026 only; travel/rest/et need the external pool. NOT eligible to enter production probability yet.',
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'coverage-report.json'), JSON.stringify(report, null, 2));

console.log('=== Owner E coverage audit ===');
console.log(`WC2026 venues: ${venues.length} | altitude ${venueCoverage.altitude}% grass ${venueCoverage.grass}% tz ${venueCoverage.timezone}% coords ${venueCoverage.coordinates}% | WBGT ${venueWbgt}%`);
console.log(`WC history: ${histFiles.length} editions ${histMatches} matches | no env exposure fields`);
console.log(`team_meta: ${teamCount} teams | env coverage ${teamEnvCoverage}%`);
if (pool.present) {
  const fc = pool.featureCoverage;
  console.log(`49k pool: ${pool.pool_non_wc} non-WC matches (${pool.pool_played} played) | WC held-out ${pool.heldOut_wc_total} | sha256 ${pool.sha256.slice(0, 12)}…`);
  console.log(`  rest_days_home ${fc.rest_days_home_pct}% | rest_days_away ${fc.rest_days_away_pct}%`);
  console.log(`  travel: neutral ${fc.neutral_pct}% | cross_confed resol ${fc.cross_confederation_resolved_pct}%`);
  console.log(`  altitude historical ${fc.altitude_historical_pct}% | weather/WBGT ${fc.weather_wbgt_pct}%`);
} else {
  console.log(`49k pool: ABSENT (set ENV_RESEARCH_POOL_DIR for real coverage)`);
}
console.log(`\nConclusion: ${report.conclusion.note}`);
console.log(`Report -> data/research/environment/coverage-report.json`);
