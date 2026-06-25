'use strict';

const fs = require('fs');
const path = require('path');
const { db } = require('../lib/db');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(ROOT, 'data', 'match_snapshot_schedule.json');
const RUNS_FILE = path.join(ROOT, 'data', 'match_snapshot_runs.json');
const repair = process.argv.includes('--repair');

const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
const kickoffByMatchId = new Map(schedule.matches.map((match) => [String(match.matchId), Date.parse(match.kickoffUtc)]));
const snapshots = db.prepare('SELECT id, match_id, created_at FROM prediction_snapshots').all();
const invalid = snapshots.filter((snapshot) => {
  const kickoff = kickoffByMatchId.get(String(snapshot.match_id));
  const createdAt = Date.parse(snapshot.created_at);
  return Number.isFinite(kickoff) && Number.isFinite(createdAt) && createdAt >= kickoff;
});

if (repair && invalid.length) {
  const ids = invalid.map((snapshot) => snapshot.id);
  const placeholders = ids.map(() => '?').join(', ');
  db.transaction(() => {
    db.prepare(`UPDATE post_match_reviews SET prediction_snapshot_id = NULL WHERE prediction_snapshot_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM prediction_snapshots WHERE id IN (${placeholders})`).run(...ids);
  })();

  let runs = { matches: {} };
  try { runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8')); } catch {}
  for (const snapshot of invalid) {
    const state = runs.matches?.[String(snapshot.match_id)];
    if (!state) continue;
    delete state.preSnapshotAt;
    delete state.preSnapshotId;
    delete state.preSnapshotSummary;
    state.preMissedAt ||= new Date().toISOString();
    state.preMissReason = 'post_kickoff_snapshot_audit_repaired';
  }
  runs.updatedAt = new Date().toISOString();
  runs.lastPreSnapshotAuditAt = new Date().toISOString();
  fs.writeFileSync(RUNS_FILE, `${JSON.stringify(runs, null, 2)}\n`);
}

console.log(JSON.stringify({ repair, invalid }, null, 2));
process.exitCode = invalid.length && !repair ? 1 : 0;
