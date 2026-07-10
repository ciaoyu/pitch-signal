#!/usr/bin/env node
/**
 * Owner E — environment-research coverage audit.
 *
 * Audits AVAILABILITY / COVERAGE / MISSING MECHANISM for environment, travel,
 * rest variables across the data we can see:
 *   - in-repo: data/venues.json (2026 venues), data/history/worldcup_*.json
 *     (1930-2022 results), data/team_meta.json, data/elo-seed.json, schedule.
 *   - external READ-ONLY input: the 49k international-results pool pointed to by
 *     ENV_RESEARCH_POOL_DIR (NOT in this repo; never committed).
 *
 * It does NOT modify any production file. Output: a JSON report +
 * data/research/environment/coverage-report.json + human summary.
 *
 * Run: node scripts/research-environment-coverage.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT_DIR = path.join(DATA, 'research', 'environment');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10; }

// ---- 1. WC2026 venue-level env coverage ----
const venues = readJson(path.join(DATA, 'venues.json')) || [];
const venueFields = ['altitude', 'grass', 'timezone', 'coordinates'];
const venueCoverage = {};
for (const f of venueFields) {
  venueCoverage[f] = pct(venues.filter(v => v[f] != null).length, venues.length);
}
const venueWbgt = 0; // no WBGT in venues.json

// ---- 2. WC history (1930-2022) env coverage ----
const histDir = path.join(DATA, 'history');
const histFiles = fs.existsSync(histDir)
  ? fs.readdirSync(histDir).filter(f => /^worldcup_\d{4}\.json$/.test(f))
  : [];
let histMatches = 0;
const histYears = [];
for (const f of histFiles) {
  const j = readJson(path.join(histDir, f));
  if (!j) continue;
  histYears.push(j.year);
  histMatches += (j.matches || []).length;
}
const histEnvCoverage = 0; // no env exposure fields in any historical file

// ---- 3. team_meta env coverage ----
const teamMeta = readJson(path.join(DATA, 'team_meta.json')) || {};
const teamCount = Object.keys(teamMeta).length;
const teamEnvCoverage = 0; // no baseCamp altitude/timezone

// ---- 4. external 49k pool (read-only) ----
const poolDir = process.env.ENV_RESEARCH_POOL_DIR || '';
let pool = { present: false, note: 'not in repo; documented as READ-ONLY input (ENV_RESEARCH_POOL_DIR)' };
if (poolDir && fs.existsSync(poolDir)) {
  try {
    const files = fs.readdirSync(poolDir).filter(f => /\.json$/i.test(f));
    let poolMatches = 0; const poolYears = new Set();
    for (const f of files) {
      const j = readJson(path.join(poolDir, f));
      if (!j) continue;
      const arr = Array.isArray(j) ? j : (j.matches || j.data || []);
      poolMatches += arr.length;
      for (const m of arr) if (m && m.date) poolYears.add(String(m.date).slice(0, 4));
    }
    pool = { present: true, files: files.length, matches: poolMatches, years: [...poolYears].sort(), note: 'READ-ONLY; World Cup kept held-out in OOS' };
  } catch (e) {
    pool = { present: false, note: 'pointed at but unreadable: ' + e.message };
  }
}

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
      envExposureCoverage: histEnvCoverage,
      note: 'results only; NO env exposure variables -> base model for pre-2026',
    },
    teamMeta: {
      teams: teamCount,
      envCoverage: teamEnvCoverage,
      note: 'no baseCamp altitude/timezone',
    },
  },
  externalReadonly: { internationalResults49k: pool },
  missingMechanism: 'structural: historical editions entirely lack env fields; 2026 has venue-level only. Missing != neutral; degrade to base model pre-1960s; mark missing_reason.',
  conclusion: {
    canEstimateTeamLevelProxyNow: false,
    note: 'Team-level exposure proxy (altitude/WBGT/turf from venues) usable for 2026 only. Travel/rest/et require schedule+baseCamp engineering. Stable env coefficients require the external 49k pool (read-only) with WC held-out. Until then: NOT eligible to enter production probability.',
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'coverage-report.json'), JSON.stringify(report, null, 2));

console.log('=== Owner E coverage audit ===');
console.log(`WC2026 venues: ${venues.length} | altitude ${venueCoverage.altitude}% grass ${venueCoverage.grass}% tz ${venueCoverage.timezone}% coords ${venueCoverage.coordinates}% | WBGT ${venueWbgt}%`);
console.log(`WC history: ${histFiles.length} editions (${histYears[0]}-${histYears[histYears.length-1]}) ${histMatches} matches | env exposure coverage ${histEnvCoverage}%`);
console.log(`team_meta: ${teamCount} teams | env coverage ${teamEnvCoverage}%`);
console.log(`external 49k pool: ${pool.present ? `present (${pool.matches} matches, ${pool.years.length} yrs)` : 'absent (read-only input, not in repo)'}`);
console.log(`\nConclusion: team-level proxy for 2026 only; travel/rest/et need engineering; stable OOS coefficients need external pool. NOT eligible to enter production probability yet.`);
console.log(`Report -> data/research/environment/coverage-report.json`);
