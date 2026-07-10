#!/usr/bin/env node
/**
 * Owner E — read-only adapter for the 49k international-results pool.
 *
 * INPUT (READ-ONLY, never committed, never inside this repo):
 *   martj42/international_results  results.csv  (CC0, ~49.5k matches, 1872→present)
 *   Columns: date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
 *   Located via ENV_RESEARCH_POOL_DIR (a directory) or --csv <file>.
 *
 * WHAT THIS MODULE DOES (no fabrication):
 *   - parses + normalizes the pool to a canonical match schema;
 *   - JOINs environment candidate features that are *derivable from the data itself*
 *     or from the in-repo 2026 venues table — nothing invented:
 *       * rest_days_home / rest_days_away : days since each team's previous match
 *         (as-of: strictly earlier matches, date-ordered)
 *       * neutral                          : from the data column
 *       * tournament_type                  : world_cup / qualifier / continental / friendly / other
 *       * confederation (per team)         : inferred as-of from the EARLIEST
 *                                            confederation-specific tournament the team appears in
 *       * cross_confederation              : both confeds known AND differ
 *                                            (travel / climate-stress proxy; symmetric for both sides)
 *       * altitude_2026                    : joined from in-repo data/venues.json for 2026 WC only
 *   - World Cup finals ("FIFA World Cup") are HELD OUT: excluded from the estimation
 *     pool, emitted to a separate manifest for later OOS.
 *
 * HONESTLY UNAVAILABLE (reported as 0% coverage, NEVER faked):
 *   - venue altitude for historical (non-2026) matches (no city→altitude table exists)
 *   - weather / WBGT (never historically recorded for this pool)
 *
 * BOUNDARIES:
 *   - never writes the pool, never edits lib/, never edits any production file;
 *   - returns derived structures; the caller decides where (data/research/environment/) to write.
 *
 * Usage (library):  const lib = require('./research-environment-pool-lib');
 *                   const r = lib.analyzePool(dirOrCsv, { venues: [...] });
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const WC_TOURNAMENT = 'FIFA World Cup';

// ---------------------------------------------------------------------------
// CSV (quoted-field aware — mirrors scripts/build-elo-seed.js)
// ---------------------------------------------------------------------------
function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.length);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const date = f[col.date];
    const home = f[col.home_team];
    const away = f[col.away_team];
    if (!date || !home || !away) continue;
    const hs = f[col.home_score], as = f[col.away_score];
    const played = !(hs === 'NA' || as === 'NA' || hs === '' || as === '');
    rows.push({
      date,
      home,
      away,
      homeScore: played ? parseInt(hs, 10) : null,
      awayScore: played ? parseInt(as, 10) : null,
      tournament: f[col.tournament] || '',
      city: f[col.city] || '',
      country: f[col.country] || '',
      neutral: f[col.neutral] === 'TRUE',
      played,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Tournament classification + confederation hint
// ---------------------------------------------------------------------------
function tournamentConfederation(t) {
  if (/CONMEBOL|Copa América|Copa America/.test(t)) return 'CONMEBOL';
  if (/CONCACAF|CFU|Gold Cup/.test(t)) return 'CONCACAF';
  if (/CAF|African/.test(t)) return 'CAF';
  if (/AFC|Asian/.test(t)) return 'AFC';
  if (/OFC|Oceania/.test(t)) return 'OFC';
  if (/UEFA|European/.test(t)) return 'UEFA';
  return null;
}

function classifyTournament(t) {
  if (t === WC_TOURNAMENT) return { type: 'world_cup', confed: null };
  if (/qualification/i.test(t)) return { type: 'qualifier', confed: tournamentConfederation(t) };
  if (/Friendly/.test(t)) return { type: 'friendly', confed: null };
  const c = tournamentConfederation(t);
  if (c) return { type: 'continental', confed: c };
  return { type: 'other', confed: null };
}

// ---------------------------------------------------------------------------
// As-of confederation inference (earliest confederation-specific tournament)
// ---------------------------------------------------------------------------
function inferConfederations(rows) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const conf = new Map();
  for (const r of sorted) {
    const ch = classifyTournament(r.tournament).confed;
    if (ch) {
      if (!conf.has(r.home)) conf.set(r.home, ch);
      if (!conf.has(r.away)) conf.set(r.away, ch);
    }
  }
  return conf;
}

// ---------------------------------------------------------------------------
// Venue altitude join (2026 WC only) — from in-repo data/venues.json
// ---------------------------------------------------------------------------
// results.csv 2026 cities vs venues.json city labels need a few metro aliases.
const CITY_ALIASES = {
  dallas: 'arlington',      // AT&T Stadium (Arlington) labelled "Dallas" in pool
  guadalupe: 'monterrey',   // Estadio BBVA (Monterrey) labelled "Guadalupe"
  zapopan: 'guadalajara',   // Estadio Akron (Guadalajara) labelled "Zapopan"
};

function normCity(c) { return String(c || '').split(',')[0].trim().toLowerCase(); }

function buildVenueAltitudeMap(venues) {
  const map = {};
  for (const v of venues || []) {
    const c = normCity(v.city);
    if (c) map[c] = (typeof v.altitude === 'number') ? v.altitude : null;
  }
  for (const [from, to] of Object.entries(CITY_ALIASES)) {
    if (map[to] != null) map[from] = map[to];
  }
  return map;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysBetween(a, b) {
  const ms = Date.parse(b) - Date.parse(a);
  return Math.round(ms / 86400000);
}
function pct(n, d) { return d ? Math.round((n / d) * 1000) / 10 : 0; }
function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}
function resolveCsvPath(poolDirOrCsv) {
  if (!poolDirOrCsv) return null;
  if (fs.existsSync(poolDirOrCsv) && fs.statSync(poolDirOrCsv).isFile()) return poolDirOrCsv;
  if (fs.existsSync(poolDirOrCsv) && fs.statSync(poolDirOrCsv).isDirectory()) {
    const cand = path.join(poolDirOrCsv, 'results.csv');
    return fs.existsSync(cand) ? cand : null;
  }
  return null;
}
const path = require('path');

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------
function analyzePool(poolDirOrCsv, opts) {
  opts = opts || {};
  const csvPath = resolveCsvPath(poolDirOrCsv);
  if (!csvPath) {
    return { present: false, note: 'pool not found at ENV_RESEARCH_POOL_DIR / --csv' };
  }
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text).sort((a, b) => a.date.localeCompare(b.date));
  const venues = opts.venues || [];
  const altMap = buildVenueAltitudeMap(venues);
  const conf = inferConfederations(rows);

  const lastDate = new Map();
  const heldOut = [];
  let poolCount = 0, playedPool = 0;
  let wcCount = 0, wc2026 = 0, wc2026AltJoined = 0;
  const c = {
    rest_home: 0, rest_away: 0, neutral: 0, tournament_type: 0,
    confed_home: 0, confed_away: 0, cross_confed: 0,
    altitude_2026_joined: 0, altitude_historical: 0, weather_wbgt: 0,
  };
  let yearMin = null, yearMax = null;
  const emitJoined = opts.emitJoinedPath || null;
  const joinedOut = emitJoined ? fs.createWriteStream(emitJoined) : null;

  for (const r of rows) {
    const cls = classifyTournament(r.tournament);
    const ch = conf.get(r.home) || null;
    const ca = conf.get(r.away) || null;
    const lh = lastDate.get(r.home);
    const la = lastDate.get(r.away);
    const restHome = lh ? daysBetween(lh, r.date) : null;
    const restAway = la ? daysBetween(la, r.date) : null;
    lastDate.set(r.home, r.date);
    lastDate.set(r.away, r.date);
    const cross = (ch && ca) ? (ch !== ca) : null;
    const y = parseInt(String(r.date).slice(0, 4), 10);
    if (yearMin == null || y < yearMin) yearMin = y;
    if (yearMax == null || y > yearMax) yearMax = y;

    if (cls.type === 'world_cup') {
      wcCount++;
      let altitude = null;
      if (r.date.startsWith('2026')) {
        wc2026++;
        altitude = (altMap[normCity(r.city)] != null) ? altMap[normCity(r.city)] : null;
        if (altitude != null) { wc2026AltJoined++; c.altitude_2026_joined++; }
      }
      heldOut.push({
        date: r.date, home: r.home, away: r.away,
        homeScore: r.homeScore, awayScore: r.awayScore,
        neutral: r.neutral, city: r.city, country: r.country,
        played: r.played, altitude_2026: altitude,
      });
    } else {
      poolCount++;
      if (r.played) playedPool++;
      if (restHome != null) c.rest_home++;
      if (restAway != null) c.rest_away++;
      c.neutral++;
      c.tournament_type++;
      if (ch) c.confed_home++;
      if (ca) c.confed_away++;
      if (cross != null) c.cross_confed++;
      if (joinedOut) {
        joinedOut.write(JSON.stringify({
          date: r.date, home: r.home, away: r.away, tournament: r.tournament,
          neutral: r.neutral, confed_home: ch, confed_away: ca,
          cross_confed: cross, rest_home: restHome, rest_away: restAway,
        }) + '\n');
      }
    }
  }
  if (joinedOut) joinedOut.end();

  const poolDen = poolCount || 1;
  const coverage = {
    rest_days_home_pct: pct(c.rest_home, poolDen),
    rest_days_away_pct: pct(c.rest_away, poolDen),
    neutral_pct: pct(c.neutral, poolDen),
    tournament_type_pct: pct(c.tournament_type, poolDen),
    confed_home_resolved_pct: pct(c.confed_home, poolDen),
    confed_away_resolved_pct: pct(c.confed_away, poolDen),
    cross_confederation_resolved_pct: pct(c.cross_confed, poolDen),
    altitude_historical_pct: 0,                 // never available for non-2026
    weather_wbgt_pct: 0,                        // never available
  };

  const missingReasons = {
    altitude_historical: 'No city→altitude table for historical (pre-2026) matches in this pool; venues.json covers 2026 WC only. Missing != neutral; degrade to base model.',
    weather_wbgt: 'WBGT/weather never recorded historically for this pool; cannot fabricate. Mark missing_reason.',
    confed_unresolved: 'Teams that appear ONLY in Friendlies / generic "FIFA World Cup qualification" (no confederation word) and never in a confederation-specific tournament cannot have a confederation inferred; cross_confederation is null for their matches (documented, not imputed).',
  };

  return {
    present: true,
    source: 'martj42/international_results (CC0)',
    csvPath,
    sha256: sha256File(csvPath),
    generatedAt: new Date().toISOString(),
    years: { min: yearMin, max: yearMax },
    pool: {
      total_non_wc: poolCount,
      played_non_wc: playedPool,
    },
    heldOut: {
      world_cup_total: wcCount,
      world_cup_2026: wc2026,
      world_cup_2026_altitude_joined: wc2026AltJoined,
      world_cup_2026_altitude_joined_pct: pct(wc2026AltJoined, wc2026 || 1),
    },
    coverage,
    missingReasons,
    worldCupHeldOut: heldOut,
  };
}

module.exports = {
  WC_TOURNAMENT,
  parseCsv,
  parseCsvLine,
  classifyTournament,
  tournamentConfederation,
  inferConfederations,
  buildVenueAltitudeMap,
  normCity,
  daysBetween,
  sha256File,
  analyzePool,
  resolveCsvPath,
};
