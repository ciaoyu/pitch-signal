'use strict';

/**
 * Owner B — Prediction Ledger Migration & Backfill Auditor
 * 
 * Solidifies A v4 immutable model contract in SQLite database:
 * - Ensures ledger schema columns exist (model_version, config_hash, active_signals_json, etc.)
 * - Marks legacy snapshots where model_version IS NULL with verification_status = 'legacy'
 * - Enforces non-masquerading rule: missing fields remain missing, no fabricated probabilities
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function migratePredictionLedger(dbPath) {
  const resolvedPath = path.resolve(dbPath || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'predictions.db'));
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Database not found at ${resolvedPath}`);
  }

  const db = new Database(resolvedPath);

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS prediction_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      home_team_id TEXT,
      away_team_id TEXT,
      home_team_name TEXT,
      away_team_name TEXT,
      predicted_score TEXT,
      home_win_prob REAL,
      draw_prob REAL,
      away_win_prob REAL,
      home_expected_goals REAL,
      away_expected_goals REAL,
      payload_json TEXT NOT NULL,
      source TEXT DEFAULT 'prediction-route',
      created_at TEXT NOT NULL,
      UNIQUE(match_id, created_at)
    );
  `);

  // Idempotently add columns
  const migrations = [
    `ALTER TABLE prediction_snapshots ADD COLUMN model_version TEXT`,
    `ALTER TABLE prediction_snapshots ADD COLUMN config_hash TEXT`,
    `ALTER TABLE prediction_snapshots ADD COLUMN active_signals_json TEXT`,
    `ALTER TABLE prediction_snapshots ADD COLUMN candidates_json TEXT`,
    `ALTER TABLE prediction_snapshots ADD COLUMN venue_semantics_json TEXT`,
    `ALTER TABLE prediction_snapshots ADD COLUMN data_sources_json TEXT`,
    `ALTER TABLE prediction_snapshots ADD COLUMN verification_status TEXT DEFAULT 'legacy'`,
  ];

  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  }

  // Mark legacy snapshots (do NOT fabricate model_version or probabilities)
  const legacyUpdateResult = db.prepare(`
    UPDATE prediction_snapshots
    SET verification_status = 'legacy'
    WHERE (model_version IS NULL OR config_hash IS NULL)
      AND (verification_status IS NULL OR verification_status = 'verified')
  `).run();

  // Audit counts
  const totalSnapshots = db.prepare('SELECT count(*) as count FROM prediction_snapshots').get().count;
  const verifiedSnapshots = db.prepare("SELECT count(*) as count FROM prediction_snapshots WHERE verification_status = 'verified' AND model_version IS NOT NULL AND config_hash IS NOT NULL").get().count;
  const legacySnapshots = db.prepare("SELECT count(*) as count FROM prediction_snapshots WHERE verification_status = 'legacy' AND (model_version IS NULL OR config_hash IS NULL)").get().count;
  const invalidMasquerades = db.prepare("SELECT count(*) as count FROM prediction_snapshots WHERE verification_status = 'legacy' AND model_version IS NOT NULL AND config_hash IS NOT NULL").get().count;

  let totalRetrospectives = 0;
  try {
    totalRetrospectives = db.prepare('SELECT count(*) as count FROM retrospective_predictions').get().count;
  } catch (_) { /* table might not exist in empty db */ }

  db.close();

  return {
    dbPath: resolvedPath,
    legacyRowsUpdated: legacyUpdateResult.changes,
    totalSnapshots,
    verifiedSnapshots,
    legacySnapshots,
    invalidMasquerades,
    totalRetrospectives,
    integrityCheck: invalidMasquerades === 0 ? 'PASSED' : 'FAILED',
  };
}

if (require.main === module) {
  const argDb = process.argv[2];
  try {
    const report = migratePredictionLedger(argDb);
    console.log('📦 Prediction Ledger Migration Report');
    console.log(JSON.stringify(report, null, 2));
    if (report.integrityCheck !== 'PASSED') {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Ledger migration failed:', err.message);
    process.exit(1);
  }
}

module.exports = {
  migratePredictionLedger,
};
