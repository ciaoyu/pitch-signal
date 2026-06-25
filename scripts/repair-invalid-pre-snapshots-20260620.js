'use strict';

// Removes only the known invalid snapshots created by the first server scheduler
// run after their respective kickoffs. See 2026-06-20 scheduler incident.

const fs = require('fs');
const path = require('path');
const { db } = require('../lib/db');

const ROOT = path.resolve(__dirname, '..');
const RUNS_FILE = path.join(ROOT, 'data', 'match_snapshot_runs.json');
const SNAPSHOT_CUTOFF = '2026-06-20T10:09:00.000Z';
const PREDICTION_CUTOFF = '2026-06-20 10:09:00';

const invalidSnapshots = db.prepare(`
  SELECT id, match_id, created_at
  FROM prediction_snapshots
  WHERE created_at >= ?
  ORDER BY id
`).all(SNAPSHOT_CUTOFF);

const invalidPredictions = db.prepare(`
  SELECT id, match_id, created_at
  FROM predictions
  WHERE created_at >= ?
  ORDER BY id
`).all(PREDICTION_CUTOFF);

const snapshotIds = invalidSnapshots.map((row) => row.id);
const invalidMatchIds = new Set(invalidSnapshots.map((row) => String(row.match_id)));

db.transaction(() => {
  if (snapshotIds.length) {
    const placeholders = snapshotIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM prediction_snapshots WHERE id IN (${placeholders})`).run(...snapshotIds);
  }
  if (invalidPredictions.length) {
    const placeholders = invalidPredictions.map(() => '?').join(', ');
    db.prepare(`DELETE FROM predictions WHERE id IN (${placeholders})`).run(...invalidPredictions.map((row) => row.id));
  }
})();

let runs = { matches: {} };
try { runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8')); } catch {}
for (const matchId of invalidMatchIds) {
  const state = runs.matches?.[matchId];
  if (!state) continue;
  delete state.preSnapshotAt;
  delete state.preSnapshotId;
  delete state.preSnapshotSummary;
  state.preMissedAt ||= new Date().toISOString();
  state.preMissReason = 'scheduler_created_after_kickoff_repaired';
}
runs.updatedAt = new Date().toISOString();
runs.repairedInvalidPreSnapshotsAt = new Date().toISOString();
fs.writeFileSync(RUNS_FILE, `${JSON.stringify(runs, null, 2)}\n`);

console.log(JSON.stringify({
  removedPredictionSnapshots: invalidSnapshots,
  removedPredictions: invalidPredictions,
}, null, 2));
