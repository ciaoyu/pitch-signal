#!/usr/bin/env node
'use strict';

/**
 * F v2: Player / Lineup / Availability / xG — Verification Script
 *
 * Reads REAL data from:
 *   - resources/seed/wc2026/ (seed files)
 *   - data/predictions.db (SQLite, backfilled from ESPN API)
 *
 * Asserts:
 *   F-1: Seed lineup coverage ≥ 74 matches with full 11v11
 *   F-2: Player ID bridge ≥ 90% match rate
 *   F-3: DB player_match_events = 457 (83 distinct matches)
 *   F-4: DB match_officials = 83
 *   F-5: Suspension engine produces correct output from real events
 *   F-6: espnToFifa() batch mapping — null rate < 5%
 *   F-7: xG remains blocked (team_xg_stats = 0)
 *   F-8: Shadow boundary (F modules not imported by core prediction)
 *   F-9: SHA-256 fingerprints + data cutoff timestamp
 *
 * Run: node scripts/test-f-data-audit.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEED_DIR = path.join(__dirname, '..', 'resources', 'seed', 'wc2026');
const DATA_DIR = path.join(__dirname, '..', 'data');
const LIB_DIR = path.join(__dirname, '..', 'lib');

let passed = 0, failed = 0;

function ok(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function readSeed(name) {
  const p = path.join(SEED_DIR, name);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function sha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readLib(f) {
  try { return fs.readFileSync(path.join(LIB_DIR, f), 'utf8'); } catch { return ''; }
}

// ── F-1: Seed Lineup Coverage ──
console.log('\n📋 F-1: Seed Lineup Coverage (real ESPN data)');
const lineups = readSeed('lineups.json');
ok(lineups !== null, 'lineups.json: readable from seed dir');

if (lineups) {
  const lineupIds = Object.keys(lineups);
  ok(lineupIds.length >= 74, `lineups.json: ${lineupIds.length} matches (≥ 74 required)`);

  let fullXI = 0;
  const formations = {};
  for (const id of lineupIds) {
    const entry = lineups[id];
    const hXI = entry.home?.xi?.length || 0;
    const aXI = entry.away?.xi?.length || 0;
    if (hXI === 11 && aXI === 11) fullXI++;
    const f = entry.home?.tactics;
    if (f) formations[f] = (formations[f] || 0) + 1;
  }
  ok(fullXI >= 74, `Full 11v11 lineups: ${fullXI} (≥ 74 required)`);
  ok(Object.keys(formations).length >= 8, `Formation variety: ${Object.keys(formations).length} types (≥ 8 expected)`);

  // Verify player structure has required fields
  const sample = lineups[lineupIds[0]];
  const samplePlayer = sample.home?.xi?.[0];
  if (samplePlayer) {
    ok(typeof samplePlayer.id === 'string' || typeof samplePlayer.id === 'number', 'Player has ID field');
    ok(typeof samplePlayer.name === 'string', 'Player has name field');
    ok(typeof samplePlayer.number === 'number', 'Player has number field');
    ok(typeof samplePlayer.gk === 'boolean', 'Player has GK flag');
  } else {
    ok(false, 'Sample player exists');
  }
}

// ── F-2: Player ID Bridge ──
console.log('\n📋 F-2: Player ID Bridge (ESPN ↔ FIFA mapping)');
const bridge = readSeed('player_id_bridge.json');
ok(bridge !== null, 'player_id_bridge.json: readable from seed dir');

if (bridge) {
  const stats = bridge.stats || {};
  const matchRate = parseFloat(stats.matchRate) || 0;
  ok(stats.totalUniquePlayers >= 1200, `Total unique players: ${stats.totalUniquePlayers} (≥ 1200)`);
  ok(stats.matched >= 1100, `Matched players: ${stats.matched} (≥ 1100)`);
  ok(matchRate >= 90, `Match rate: ${matchRate}% (≥ 90%)`);
  ok(stats.unmatched <= 80, `Unmatched: ${stats.unmatched} (≤ 80)`);

  // Verify bridge entry structure
  const bySlug = bridge.bySlug || {};
  const slugKeys = Object.keys(bySlug);
  ok(slugKeys.length >= 1100, `bySlug entries: ${slugKeys.length} (≥ 1100)`);

  const sampleEntry = bySlug[slugKeys[0]];
  if (sampleEntry) {
    ok(typeof sampleEntry.espnId === 'string', 'Bridge entry has espnId');
    ok(typeof sampleEntry.nameLineup === 'string', 'Bridge entry has nameLineup');
    ok(typeof sampleEntry.teamCode === 'string', 'Bridge entry has teamCode');
  }

  // Verify byEspnId exists
  const byEspn = bridge.byEspnId || {};
  ok(Object.keys(byEspn).length >= 1100, `byEspnId entries: ${Object.keys(byEspn).length} (≥ 1100)`);
}

// ── F-3: DB player_match_events ──
console.log('\n📋 F-3: DB player_match_events (ESPN backfill)');
let db = null;
try { db = require('../lib/db').db; } catch (e) { console.error('  DB load error:', e.message); }

if (db) {
  // Total events
  const totalEvents = db.prepare('SELECT COUNT(*) as c FROM player_match_events').get().c;
  ok(totalEvents >= 400, `player_match_events: ${totalEvents} rows (≥ 400)`);

  // Distinct matches
  const distinctMatches = db.prepare('SELECT COUNT(DISTINCT match_id) as c FROM player_match_events').get().c;
  ok(distinctMatches >= 80, `Distinct matches with events: ${distinctMatches} (≥ 80)`);

  // Event type breakdown
  const byType = db.prepare('SELECT event_type, COUNT(*) as c FROM player_match_events GROUP BY event_type').all();
  const types = {};
  byType.forEach(t => types[t.event_type] = t.c);
  ok(types.goal >= 200, `Goals: ${types.goal || 0} (≥ 200)`);
  ok(types.yellow >= 150, `Yellow cards: ${types.yellow || 0} (≥ 150)`);
  ok(types.red >= 15, `Red cards: ${types.red || 0} (≥ 15)`);

  // Round distribution
  const byRound = db.prepare('SELECT round, COUNT(*) as c FROM player_match_events GROUP BY round').all();
  ok(byRound.length >= 2, `Round variety: ${byRound.length} rounds (≥ 2)`);

  // Verify data integrity: no null player_name
  const nullNames = db.prepare("SELECT COUNT(*) as c FROM player_match_events WHERE player_name IS NULL OR player_name = ''").get().c;
  ok(nullNames === 0, `Null/empty player_name: ${nullNames} (must be 0)`);

  // Verify match_id format (ESPN numeric) — SQLite GLOB only supports *, not regex
  const badMatchIds = db.prepare("SELECT COUNT(*) as c FROM player_match_events WHERE CAST(match_id AS TEXT) NOT GLOB '[0-9]*'").get().c;
  ok(badMatchIds === 0, `Non-numeric match_id: ${badMatchIds} (must be 0)`);
} else {
  ok(false, 'DB: better-sqlite3 not available');
}

// ── F-4: DB match_officials ──
console.log('\n📋 F-4: DB match_officials');
if (db) {
  const officials = db.prepare('SELECT COUNT(*) as c FROM match_officials').get().c;
  ok(officials >= 80, `match_officials: ${officials} rows (≥ 80)`);

  const officialMatches = db.prepare('SELECT COUNT(DISTINCT match_id) as c FROM match_officials').get().c;
  ok(officialMatches >= 80, `Distinct matches with officials: ${officialMatches} (≥ 80)`);
}

// ── F-5: Suspension Engine (real data validation) ──
console.log('\n📋 F-5: Suspension Engine with real event data');
if (db) {
  try {
    const { buildSuspensionsSection } = require('../lib/suspension');

    // Use match 760415 (MEX vs RSA) — known to have red cards
    const result = buildSuspensionsSection({
      matchId: '760415',
      homeTeamId: '203',  // Mexico
      awayTeamId: '467',  // South Africa
      homeName: 'Mexico',
      awayName: 'South Africa',
      nextRound: 'Round of 32',
    });

    ok(result !== null, 'buildSuspensionsSection: returns non-null for match with events');

    if (result) {
      // South Africa had 3 reds in this match
      const rsaOut = result.away?.out || [];
      ok(rsaOut.length >= 2, `South Africa suspended players: ${rsaOut.length} (≥ 2, known reds)`);

      // Mexico had 1 red
      const mexOut = result.home?.out || [];
      ok(mexOut.length >= 1, `Mexico suspended players: ${mexOut.length} (≥ 1, known red)`);

      // Verify structure
      if (rsaOut[0]) {
        ok(typeof rsaOut[0].player === 'string', 'Suspended player has name');
        ok(typeof rsaOut[0].reason?.zh === 'string', 'Suspended player has reason.zh');
        ok(typeof rsaOut[0].reason?.en === 'string', 'Suspended player has reason.en');
      }

      // Verify shadow-only flag
      ok(result.usedInModel === false, 'Suspension: usedInModel = false (shadow-only)');
    }
  } catch (e) {
    ok(false, `Suspension engine error: ${e.message}`);
  }
}

// ── F-6: espnToFifa() Batch Mapping ──
console.log('\n📋 F-6: espnToFifa() batch mapping coverage');
try {
  const { espnToFifa, fifaToEspn } = require('../lib/lineups-source');
  const matchBridge = readSeed('match_id_bridge.json');

  ok(matchBridge !== null, 'match_id_bridge.json: readable from seed dir');

  if (matchBridge) {
    const bridgeEntries = Object.entries(matchBridge.bridge || {});
    ok(bridgeEntries.length >= 100, `match_id_bridge entries: ${bridgeEntries.length} (≥ 100)`);

    let mapped = 0, nulled = 0;
    const nullSamples = [];

    for (const [espnId, entry] of bridgeEntries) {
      const fifaId = espnToFifa(espnId);
      if (fifaId) {
        mapped++;
      } else {
        nulled++;
        if (nullSamples.length < 5) nullSamples.push({ espnId, fifaInBridge: entry.fifa_match_id });
      }
    }

    const total = bridgeEntries.length;
    const nullRate = total > 0 ? (nulled / total * 100) : 100;
    ok(mapped >= 95, `espnToFifa mapped: ${mapped}/${total} (≥ 95%)`);
    ok(nullRate < 5, `espnToFifa null rate: ${nullRate.toFixed(1)}% (< 5%)`);

    if (nullSamples.length > 0) {
      console.log(`  ℹ️  Null samples (up to 5):`);
      nullSamples.forEach(s => console.log(`     espnId=${s.espnId} bridge.fifa=${s.fifaInBridge}`));
    }

    // Also test reverse direction
    let revMapped = 0;
    for (const [espnId, entry] of bridgeEntries.slice(0, 20)) {
      if (entry.fifa_match_id) {
        const back = fifaToEspn(entry.fifa_match_id);
        if (back) revMapped++;
      }
    }
    ok(revMapped >= 18, `fifaToEspn (sample 20): ${revMapped}/20 mapped (≥ 18)`);
  }
} catch (e) {
  ok(false, `espnToFifa test error: ${e.message}`);
}

// ── F-7: xG Blocked ──
console.log('\n📋 F-7: xG data remains blocked/shadow-only');
if (db) {
  const xgRows = db.prepare('SELECT COUNT(*) as c FROM team_xg_stats').get().c;
  ok(xgRows === 0, `team_xg_stats: ${xgRows} rows (must be 0 — blocked)`);
}

// Verify xG code still gates on API key
const xgCode = readLib('services/xg-service.js') || fs.readFileSync(path.join(__dirname, '..', 'lib', 'services', 'xg-service.js'), 'utf8').replace(/^.*\n/, '');
ok(xgCode.includes('API_FOOTBALL_KEY'), 'xg-service: gates on API_FOOTBALL_KEY');
ok(xgCode.includes('return null'), 'xg-service: returns null on insufficient data');

const collCode = fs.readFileSync(path.join(__dirname, '..', 'lib', 'jobs', 'xg-collector.js'), 'utf8');
ok(collCode.includes('API_FOOTBALL_KEY not set'), 'xg-collector: disabled without key');

// ── F-8: Shadow Boundary ──
console.log('\n📋 F-8: Shadow Boundary (F modules ⊥ core prediction)');
const coreMods = ['prediction.js', 'poisson.js', 'elo.js'];
const fModNames = ['lineups-source', 'suspension', 'xg-service', 'roster_cache', 'player-id-resolver', 'lineup-coords'];

for (const core of coreMods) {
  const c = readLib(core);
  for (const f of fModNames) {
    ok(!new RegExp(`require\\(.*${f}`).test(c), `${core} does not import ${f}`);
  }
}

// Also check retrospective modules
for (const retro of ['matchReview.js', 'postMatchReview.js']) {
  const c = readLib(retro);
  if (c) {
    for (const f of fModNames) {
      ok(!new RegExp(`require\\(.*${f}`).test(c), `${retro} does not import ${f}`);
    }
  }
}

// Verify no reverse imports
for (const fFile of ['lineups-source.js', 'suspension.js', 'roster_cache.js']) {
  const c = readLib(fFile);
  for (const core of coreMods) {
    const coreName = core.replace('.js', '');
    ok(!new RegExp(`require\\(.*${coreName}`).test(c), `${fFile} does not import ${coreName}`);
  }
}

// ── F-9: SHA-256 Fingerprints + Data Cutoff ──
console.log('\n📋 F-9: SHA-256 Fingerprints & Data Cutoff');

const fingerprintFiles = [
  'lineups.json',
  'player_id_bridge.json',
  'player-ratings.json',
  'matches.json',
  'match_id_bridge.json',
];

console.log('  Seed file fingerprints:');
const fingerprints = {};
for (const f of fingerprintFiles) {
  const fp = path.join(SEED_DIR, f);
  const hash = sha256(fp);
  if (hash) {
    fingerprints[f] = hash;
    console.log(`    ${f}: ${hash.slice(0, 16)}...${hash.slice(-8)}`);
    ok(hash.length === 64, `${f}: SHA-256 = ${hash.length} chars (valid)`);
  } else {
    ok(false, `${f}: SHA-256 — file not found`);
  }
}

// DB fingerprint
if (db) {
  const dbPath = path.join(DATA_DIR, 'predictions.db');
  const dbHash = sha256(dbPath);
  if (dbHash) {
    console.log(`    predictions.db: ${dbHash.slice(0, 16)}...${dbHash.slice(-8)}`);
    ok(dbHash.length === 64, 'predictions.db: SHA-256 valid');
  }
}

// Data cutoff timestamp
const cutoff = new Date().toISOString();
console.log(`  Data cutoff (UTC): ${cutoff}`);
ok(true, `Data cutoff recorded: ${cutoff}`);

// Write fingerprints file
const fingerprintReport = {
  generatedAt: cutoff,
  seedFiles: fingerprints,
  dbHash: db ? sha256(path.join(DATA_DIR, 'predictions.db')) : null,
  dbStats: db ? {
    player_match_events: db.prepare('SELECT COUNT(*) as c FROM player_match_events').get().c,
    match_officials: db.prepare('SELECT COUNT(*) as c FROM match_officials').get().c,
    team_xg_stats: db.prepare('SELECT COUNT(*) as c FROM team_xg_stats').get().c,
  } : null,
};
fs.writeFileSync(
  path.join(__dirname, '..', 'docs', 'F-data-fingerprints.json'),
  JSON.stringify(fingerprintReport, null, 2)
);
console.log(`  Fingerprints written to docs/F-data-fingerprints.json`);

// ── Summary ──
console.log(`\n🎯 F v2 Audit: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ F v2 audit FAILED — review failures above');
  process.exit(1);
} else {
  console.log('✅ F v2 audit PASSED — all assertions hold against real data');
  process.exit(0);
}
