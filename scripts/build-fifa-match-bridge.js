#!/usr/bin/env node
'use strict';

/**
 * build-fifa-match-bridge.js
 *
 * Fetch IdMatch + IdStage (UUID) from the official FIFA API,
 * and align with the local match_id_bridge.json (ESPN match_id + date + team codes),
 * then write into the SQLite fifa_match_bridge table.
 *
 * With this table, moment-sync.js can call the FIFA live API for real-time formations and substitution data.
 *
 * Usage:
 *   node scripts/build-fifa-match-bridge.js
 *   node scripts/build-fifa-match-bridge.js --dry-run
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Read local ESPN bridge ────────────────────────────────────────────────────
const { resolveDataPath } = require('../lib/data-resolver');
const { db } = require('../lib/db');

function loadLocalBridge() {
  try {
    const p = resolveDataPath('match_id_bridge.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    // bridge structure: { "espnId": { espn_match_id, home, away, date, ... } }
    return d.bridge ?? {};
  } catch (e) {
    console.error('❌ match_id_bridge.json not found, run build-match-id-bridge.js first');
    process.exit(1);
  }
}

// ─── FIFA Calendar API ────────────────────────────────────────────────────────
function fetchFifaCalendar() {
  const url = 'https://api.fifa.com/api/v3/calendar/matches' +
    '?idCompetition=17&idSeason=285023&count=500&language=en';

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(raw);
          resolve(d?.Results ?? []);
        } catch (e) {
          reject(new Error('FIFA API parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('FIFA API timeout')); });
  });
}

function norm(code) { return (code ?? '').trim().toUpperCase(); }
function dateStr(iso) { return (iso ?? '').slice(0, 10); }

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔗 Building FIFA match bridge...');

  const localBridge = loadLocalBridge();
  // localBridge: { espnId → { espn_match_id, fifa_match_id, home, away, date } }
  // fifa_match_id comes from 26worldcup and matches the FIFA API's IdMatch numeric ID exactly

  console.log(`   Local ESPN entries: ${Object.keys(localBridge).length}`);

  let fifaCalendar;
  try {
    fifaCalendar = await fetchFifaCalendar();
    console.log(`   FIFA calendar entries: ${fifaCalendar.length}`);
  } catch (e) {
    console.error('❌ FIFA API error:', e.message);
    process.exit(1);
  }

  // FIFA index: IdMatch → entry (numeric ID matches 26worldcup)
  const fifaById = {};
  for (const f of fifaCalendar) {
    if (f.IdMatch) fifaById[String(f.IdMatch)] = f;
  }

  const now = new Date().toISOString();
  let matched = 0, skipped = 0;

  const upsert = DRY_RUN ? null : db.prepare(`
    INSERT INTO fifa_match_bridge
      (espn_id, fifa_match_id, fifa_stage_id, home_fifa_code, away_fifa_code, match_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(espn_id) DO UPDATE SET
      fifa_match_id  = excluded.fifa_match_id,
      fifa_stage_id  = excluded.fifa_stage_id,
      home_fifa_code = excluded.home_fifa_code,
      away_fifa_code = excluded.away_fifa_code,
      match_date     = excluded.match_date,
      updated_at     = excluded.updated_at
  `);

  for (const local of Object.values(localBridge)) {
    const espnId     = String(local.espn_match_id);
    const fifaMatchId = String(local.fifa_match_id ?? '');

    const hit = fifaById[fifaMatchId];
    if (!hit) {
      console.warn(`  ⚠️  FIFA ID ${fifaMatchId} not in calendar (ESPN ${espnId}: ${local.home} vs ${local.away})`);
      skipped++;
      continue;
    }

    const fifaStageId = String(hit.IdStage ?? '');
    const homeCode    = norm(hit.Home?.IdCountry);
    const awayCode    = norm(hit.Away?.IdCountry);
    const matchDate   = dateStr(hit.Date);

    if (DRY_RUN) {
      console.log(`  [dry] ESPN ${espnId} → FIFA ${fifaMatchId} stage=${fifaStageId} (${homeCode} vs ${awayCode})`);
    } else {
      upsert.run(espnId, fifaMatchId, fifaStageId, homeCode, awayCode, matchDate, now);
    }
    matched++;
  }

  console.log(`\n✅ Done. Matched: ${matched}, Skipped: ${skipped}`);
  if (DRY_RUN) console.log('   (dry-run — nothing written to DB)');
}

main().catch(e => { console.error(e); process.exit(1); });
