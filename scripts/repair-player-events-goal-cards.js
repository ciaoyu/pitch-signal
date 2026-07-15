#!/usr/bin/env node
'use strict';

/**
 * Repair: purge player_match_events card rows fabricated from GOAL events.
 *
 * Root cause (fixed in lib/services/player-events.js): classifyPlayerEventType
 * used a bare /red/ test, so ESPN goal events whose type.text merely contains
 * the substring "red" — "Penalty - Scored" (sco-RED), "Own Goal - Scored" —
 * were written as event_type='red'. lib/suspension.js then read those rows and
 * fabricated suspensions (e.g. Oyarzabal's 22' penalty in the France 0-2 Spain
 * semi-final, ESPN 760514, shown as "straight red" and limiting his final).
 *
 * This script re-classifies every stored card row (red/yellow/secondyellow)
 * against the CORRECTED classifier using its persisted raw_json (typeText+text).
 * Rows whose corrected classification is no longer that card are deletions.
 * Legitimate bookings — including second-yellow rows stored with type.text
 * "Red Card" — reclassify to themselves and are left untouched.
 *
 * Idempotent and safe to re-run. Local + production must both be cleaned; run
 * against the production DB per the Railway discipline (do NOT push/deploy from
 * here — coordinate the production run with the maintainer).
 *
 * Usage:
 *   node scripts/repair-player-events-goal-cards.js                 # data/predictions.db
 *   node scripts/repair-player-events-goal-cards.js --dry-run       # report only
 *   node scripts/repair-player-events-goal-cards.js --db=/path/to/predictions.db
 */

const path = require('path');
const Database = require('better-sqlite3');
const { classifyPlayerEventType } = require('../lib/services/player-events');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dbArg = args.find((a) => a.startsWith('--db='));
const DB_PATH = dbArg
  ? dbArg.split('=')[1]
  : (process.env.DB_PATH || path.join(__dirname, '..', 'data', 'predictions.db'));

const CARD_TYPES = new Set(['red', 'yellow', 'secondyellow']);

const db = new Database(DB_PATH, { fileMustExist: true });

const rows = db
  .prepare(
    `SELECT id, match_id, player_name, event_type, raw_json
       FROM player_match_events
      WHERE event_type IN ('red','yellow','secondyellow')`
  )
  .all();

const bad = [];
for (const r of rows) {
  let typeText = null;
  let text = null;
  try {
    const raw = JSON.parse(r.raw_json || '{}');
    typeText = raw.typeText ?? null;
    text = raw.text ?? null;
  } catch (_) {
    // Unparseable raw_json: cannot verify, leave it alone.
    continue;
  }
  if (typeText == null) continue; // nothing to reclassify against — skip conservatively

  const corrected = classifyPlayerEventType(typeText, text);
  // A stored card that the corrected classifier no longer treats as that same
  // card is a goal-event leak (corrected -> null/goal/assist). Delete it.
  if (corrected !== r.event_type && !CARD_TYPES.has(corrected)) {
    bad.push({ ...r, typeText, corrected });
  }
}

console.log(`DB: ${DB_PATH}`);
console.log(`Scanned ${rows.length} card rows; ${bad.length} fabricated from goal events.\n`);
for (const b of bad) {
  console.log(
    `  ${dryRun ? 'WOULD DELETE' : 'DELETE'} id=${b.id} match=${b.match_id} ` +
    `player=${b.player_name} stored=${b.event_type} typeText="${b.typeText}" -> corrected=${b.corrected ?? 'null'}`
  );
}

if (bad.length === 0) {
  console.log('Nothing to clean. ✅');
  db.close();
  process.exit(0);
}

if (dryRun) {
  console.log('\n--dry-run: no rows deleted.');
  db.close();
  process.exit(0);
}

const del = db.prepare('DELETE FROM player_match_events WHERE id = ?');
const tx = db.transaction((items) => {
  let n = 0;
  for (const b of items) n += del.run(b.id).changes;
  return n;
});
const deleted = tx(bad);
console.log(`\nDeleted ${deleted} fabricated card row(s). ✅`);
db.close();
process.exit(0);
