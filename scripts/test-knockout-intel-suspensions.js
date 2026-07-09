#!/usr/bin/env node
/**
 * KO-4: knockout-intel `suspensions` section contract test
 *
 * Verifies:
 *   - buildKnockoutIntel wires the suspensions section in (section-registry, isolated)
 *   - the section conforms to the KO batch contract:
 *       { confidence, source:'espn-events+fifa-rules', usedInModel:false,
 *         note:{zh,en}, home:{out,atRisk}, away:{out,atRisk} }
 *   - suspended players go under `home.out`/`away.out` with bilingual reason +
 *     bansRemaining; at-risk players under `atRisk`
 *   - a match with no cards yields NO suspensions section (consumer skips it)
 *
 * Uses an in-memory SQLite DB so it never touches the suite DB.
 */

const Database = require('better-sqlite3');
const { buildKnockoutIntel } = require('../lib/services/knockout-intel');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE player_match_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL, team_id TEXT, player_name TEXT NOT NULL, player_id TEXT,
      event_type TEXT NOT NULL, minute INTEGER NOT NULL DEFAULT 0, minute_added INTEGER NOT NULL DEFAULT 0,
      stage TEXT, round TEXT, raw_json TEXT, created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(match_id, player_name, event_type, minute, minute_added)
    );
  `);
  return db;
}

function insert(db, rows) {
  const stmt = db.prepare(
    `INSERT INTO player_match_events (match_id, team_id, player_name, event_type, minute, round)
     VALUES (@match_id, @team_id, @player_name, @event_type, @minute, @round)`
  );
  const tx = db.transaction((rs) => { for (const r of rs) stmt.run(r); });
  tx(rows);
}

console.log('=== KO-4 knockout-intel suspensions section test ===\n');

// ---- 1. Match with real suspension cases (two-yellow + straight red) ----
// Assessing the QF fixture (nextRound='Quarter-finals'):
//   - window-2 yellows (R32 + R16) survive the group-stage reset => 2 yellows => ban
//   - a straight red in R16 => suspended (reds ignore the reset)
//   - a single R16 yellow => at-risk
console.log('📊 buildKnockoutIntel includes suspensions section');
{
  const db = makeDb();
  insert(db, [
    { match_id: 'm1', team_id: 'H', player_name: 'Home TwoYellow', event_type: 'yellow', minute: 20, round: 'Round of 32' },
    { match_id: 'm2', team_id: 'H', player_name: 'Home TwoYellow', event_type: 'yellow', minute: 55, round: 'Round of 16' },
    { match_id: 'm3', team_id: 'A', player_name: 'Away Red', event_type: 'red', minute: 40, round: 'Round of 16' },
    { match_id: 'm4', team_id: 'H', player_name: 'Home AtRisk', event_type: 'yellow', minute: 30, round: 'Round of 16' },
  ]);

  const { sections } = buildKnockoutIntel({
    matchId: 'upcoming', homeId: 'H', awayId: 'A', stage: 'Quarter-finals', db,
  });

  check(sections.suspensions, 'suspensions section present');
  const s = sections.suspensions;
  check(s.source === 'espn-events+fifa-rules', 'source === "espn-events+fifa-rules"');
  check(s.usedInModel === false, 'usedInModel === false (display/bot only)');
  check(s.confidence === 'high', 'confidence high when someone is out');
  check(s.note && s.note.zh && s.note.en, 'bilingual note {zh,en}');

  check(Array.isArray(s.home.out) && s.home.out.length === 1, 'home.out has 1 suspended (two-yellow)');
  const homeOut = s.home.out[0];
  check(homeOut.player === 'Home TwoYellow', 'home out = two-yellow player');
  check(homeOut.reason && homeOut.reason.zh && homeOut.reason.en, 'reason is bilingual {zh,en}');
  check(homeOut.bansRemaining === 1, 'bansRemaining === 1');

  check(Array.isArray(s.away.out) && s.away.out.length === 1, 'away.out has 1 suspended (straight red)');
  check(s.away.out[0].player === 'Away Red' && s.away.out[0].pendingDisciplinary === true,
    'straight red flagged pendingDisciplinary');

  check(Array.isArray(s.home.atRisk) && s.home.atRisk.length === 1, 'home.atRisk has 1 (single R16 yellow)');
  check(s.home.atRisk[0].player === 'Home AtRisk' && !('bansRemaining' in s.home.atRisk[0]),
    'at-risk entry has no bansRemaining');
}

// ---- 2. Match with NO cards => section absent ----
console.log('\n📊 no cards => no suspensions section (consumer skips)');
{
  const db = makeDb();
  const { sections } = buildKnockoutIntel({
    matchId: 'clean', homeId: 'H', awayId: 'A', stage: 'Semi-finals', db,
  });
  check(!sections.suspensions, 'suspensions section absent when no cards');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
