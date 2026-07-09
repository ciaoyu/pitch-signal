#!/usr/bin/env node
/**
  * Replay all matches in chronological order using martj42/international_results (CC0, 49k matches, 1872 to present),
  * generate an Elo snapshot before each World Cup kickoff, and write it to data/elo-seed.json.
 *
  * Solves the backtest cold-start problem: lib/backtest.js originally started every team at 1500, so the first-round prediction
  * had zero information; however production uses seed ratings from ratings.json, so the two sides were inconsistent.
 *
  * Usage:
  *   node scripts/build-elo-seed.js --csv <path to results.csv>
 *
  * Design notes:
  *   - Reuse kFactorByType from lib/elo.js for the K value (World Cup 60 / continental finals 50 / qualifiers 45 / friendlies 30 / other 40)
  *   - Neutral-venue matches get no +100 home advantage (use a second engine instance with homeAdvantage=0)
  *   - Snapshot scope: strictly all matches earlier than that World Cup's first match day (no future-information leakage)
  *   - Team-name aliases: martj42 uses current names retroactively (Russia/Germany/DR Congo), openfootball
  *     history files use contemporary names (Soviet Union/West Germany/Zaire); the snapshot writes both name sets
 */
const fs = require('fs');
const path = require('path');
const EloRating = require('../lib/elo');

// openfootball contemporary name -> martj42 current name
const ALIASES = {
  'USA': 'United States',
  'West Germany': 'Germany',
  'Soviet Union': 'Russia',
  'Zaire': 'DR Congo',
  'Dutch East Indies': 'Indonesia',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Ireland': 'Republic of Ireland',
  'Serbia and Montenegro': 'Serbia',
  'East Germany': 'German DR',
  "Côte d'Ivoire": 'Ivory Coast',
  // Note: 'China' is called "China" directly on both sides, no alias needed (verified during method audit; previously a wrong entry was added
  // 'China'->'China PR', but martj42 has no name "China PR" at all - pure dead code, already removed)
};

const CONTINENTAL_FINALS = /^(UEFA Euro|Copa América|African Cup of Nations|AFC Asian Cup|CONCACAF Championship|Gold Cup|CONCACAF Gold Cup|Oceania Nations Cup|OFC Nations Cup)$/;

function matchType(tournament) {
  if (tournament === 'FIFA World Cup') return 'world_cup';
  if (/qualification/i.test(tournament)) return 'qualifier';
  if (CONTINENTAL_FINALS.test(tournament)) return 'continental';
  if (tournament === 'Friendly') return 'friendly';
  return 'default';
}

/** Minimal CSV parser (handles quoted fields) */
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

function loadWorldCupStartDates() {
  const dir = path.join(__dirname, '..', 'data', 'history');
  const cutoffs = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^worldcup_(\d{4})\.json$/);
    if (!m) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const dates = (doc.matches || []).map(x => x.date).filter(Boolean).sort();
    if (dates.length) cutoffs[m[1]] = dates[0];
  }
    // 2026 edition (in progress, not in history dir): official opening match date
  if (!cutoffs['2026']) cutoffs['2026'] = '2026-06-11';
  return cutoffs;
}

function snapshot(ratings) {
  const out = {};
  for (const [team, r] of Object.entries(ratings)) {
    out[team] = Math.round(r * 10) / 10;
  }
    // write alias entries for openfootball's contemporary names
  for (const [oldName, newName] of Object.entries(ALIASES)) {
    if (out[newName] !== undefined) out[oldName] = out[newName];
  }
  return out;
}

function main() {
  const csvIdx = process.argv.indexOf('--csv');
  if (csvIdx === -1 || !process.argv[csvIdx + 1]) {
    console.error('Usage: node scripts/build-elo-seed.js --csv <results.csv>');
    process.exit(1);
  }
  const csvPath = process.argv[csvIdx + 1];

  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const hs = f[col.home_score], as = f[col.away_score];
    if (hs === 'NA' || as === 'NA' || hs === '' || as === '') continue; // not played
    rows.push({
      date: f[col.date],
      home: f[col.home_team],
      away: f[col.away_team],
      homeScore: parseInt(hs, 10),
      awayScore: parseInt(as, 10),
      type: matchType(f[col.tournament]),
      neutral: f[col.neutral] === 'TRUE',
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`Replaying ${rows.length} completed matches...`);

  const eloHome = new EloRating();               // true home: +100
    // Neutral venue: no home advantage. Cannot pass 0 -- lib/elo.js uses `options.homeAdvantage || 100`,
    // 0 is falsy and would be treated as "not passed", overriding back to the default 100; use a negligible tiny value to bypass this trap.
  const eloNeutral = new EloRating({ homeAdvantage: 0.0001 });
  const ratings = {};
  const get = (t) => ratings[t] !== undefined ? ratings[t] : 1500;

  const cutoffs = loadWorldCupStartDates();
  const cutoffList = Object.entries(cutoffs).sort((a, b) => a[1].localeCompare(b[1]));
  const snapshots = {};
  let cutoffPtr = 0;

  for (const m of rows) {
        // When crossing the cutoff, drop the snapshot first (state strictly before the kickoff date)
    while (cutoffPtr < cutoffList.length && m.date >= cutoffList[cutoffPtr][1]) {
      const [year, asOf] = cutoffList[cutoffPtr];
      snapshots[year] = { asOf, teams: snapshot(ratings) };
      cutoffPtr++;
    }
    const engine = m.neutral ? eloNeutral : eloHome;
    const upd = engine.updateRatings(get(m.home), get(m.away), m.homeScore, m.awayScore, { matchType: m.type });
    ratings[m.home] = upd.homeRating;
    ratings[m.away] = upd.awayRating;
  }
    // Cutoffs not yet crossed (future events) and final state
  while (cutoffPtr < cutoffList.length) {
    const [year, asOf] = cutoffList[cutoffPtr];
    snapshots[year] = { asOf, teams: snapshot(ratings) };
    cutoffPtr++;
  }
  snapshots.current = { asOf: rows[rows.length - 1].date, teams: snapshot(ratings) };

  const out = {
    source: 'martj42/international_results (CC0)',
    generatedAt: new Date().toISOString().slice(0, 10),
    method: 'full-history chronological Elo replay, kFactorByType from lib/elo.js, neutral-venue aware',
    aliases: ALIASES,
    snapshots,
  };
  const outPath = path.join(__dirname, '..', 'data', 'elo-seed.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote ${outPath} (${Object.keys(snapshots).length} snapshots)`);

    // Coverage check: every team name in each history file must be findable in the corresponding snapshot
  const dir = path.join(__dirname, '..', 'data', 'history');
  const misses = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^worldcup_(\d{4})\.json$/);
    if (!m || !snapshots[m[1]]) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const teams = snapshots[m[1]].teams;
    for (const match of doc.matches || []) {
      for (const t of [match.home, match.away]) {
        if (teams[t] === undefined) (misses[m[1]] = misses[m[1]] || new Set()).add(t);
      }
    }
  }
  if (Object.keys(misses).length) {
    console.warn('\nCoverage misses (will fall back to 1500 in backtest):');
    for (const [y, set] of Object.entries(misses)) console.warn(`  ${y}: ${[...set].join(', ')}`);
  } else {
    console.log('Coverage check: all history team names resolve in their snapshots.');
  }

    // Snapshot spot-check: Top 10 before 2026 kickoff
  const top = Object.entries(snapshots['2026'].teams).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\nTop 10 (pre-2026):');
  for (const [t, r] of top) console.log(`  ${t}: ${r}`);
}

main();
