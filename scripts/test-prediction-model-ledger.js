'use strict';

/**
 * Owner B Dedicated Acceptance Tests — Immutable Prediction Ledger & Calibration Filtering
 *
 * Verifies:
 * 1. A v4 Model Contract solidification (modelVersion, configHash, activeSignals, candidate *Used=false semantics)
 * 2. Immutable ledger semantics (no silent overwrite; modelVersion/configHash change creates new record)
 * 3. Legacy migration & non-masquerade marking (missing fields stay missing, verificationStatus='legacy')
 * 4. Calibration & backtest strict filtering by fixed modelVersion
 * 5. Prospective vs retrospective separation & pre-match kickoff guard
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Create temporary isolated test database
const tmpDir = path.join(__dirname, '..', 'data');
const testDbPath = path.join(tmpDir, 'test_prediction_model_ledger.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = testDbPath;
delete require.cache[require.resolve('../lib/db')];
delete require.cache[require.resolve('../lib/postMatchReview')];
delete require.cache[require.resolve('../lib/backtest-calibration')];

// Let lib/db initialize its full schema
const dbModule = require('../lib/db');
const db = dbModule.db;

const predictionService = require('../lib/services/PredictionService');
const { savePredictionSnapshot, getPredictionSnapshot } = require('../lib/postMatchReview');
const { fetchSnapshotRows, buildCalibrationReport } = require('../lib/backtest-calibration');
const { migratePredictionLedger } = require('./migrate-prediction-ledger');

function runTests() {
  console.log('=== Owner B — Immutable Prediction Ledger & Calibration Filtering ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
      console.error(err.stack);
      failed++;
    }
  }

  // Ensure migrations run on our test DB
  migratePredictionLedger(testDbPath);

  console.log('📊 Section 1: Solidifying A v4 Immutable Model Contract');

  test('B1.1: savePredictionSnapshot records all A v4 contract fields in ledger', () => {
    const mockPrediction = {
      matchId: '10001',
      match: { homeId: 'BRA', awayId: 'FRA', homeName: 'Brazil', awayName: 'France' },
      likelyScore: '1-1',
      homeWin: 0.352,
      draw: 0.281,
      awayWin: 0.367,
      goals: { homeExpected: 1.25, awayExpected: 1.30 },
      modelContract: {
        modelVersion: 'p0-quarantine-v3-2026-07-10',
        configHash: '2066763607e5',
        activeSignals: ['elo', 'poisson'],
        candidates: {
          odds: { usedInModel: false },
          marketValue: { usedInModel: false },
          continentalStrength: { usedInModel: false }
        },
        dataSources: { source: 'elo_poisson', inputVersion: '2026-07' }
      },
      neutralVenue: true,
      hostSide: 'none',
      applyHome: false
    };

    const saved = savePredictionSnapshot('10001', mockPrediction, {
      createdAt: '2026-06-10T10:00:00Z',
      requestPath: 'api/predict/10001'
    });

    assert.ok(saved, 'Snapshot should be saved');
    assert.strictEqual(saved.modelVersion, 'p0-quarantine-v3-2026-07-10');
    assert.strictEqual(saved.configHash, '2066763607e5');
    assert.deepStrictEqual(saved.activeSignals, ['elo', 'poisson']);
    assert.strictEqual(saved.candidates.odds.usedInModel, false);
    assert.strictEqual(saved.candidates.marketValue.usedInModel, false);
    assert.strictEqual(saved.candidates.continentalStrength.usedInModel, false);
    assert.strictEqual(saved.venueSemantics.neutralVenue, true);
    assert.strictEqual(saved.venueSemantics.applyHome, false);
    assert.strictEqual(saved.requestPath, 'api/predict/10001');
    assert.strictEqual(saved.verificationStatus, 'verified');
  });

  test('B1.2: Public probabilities in ledger match A v4 exact bit-for-bit values', () => {
    const snap = getPredictionSnapshot('10001');
    assert.strictEqual(snap.homeWin, 0.352);
    assert.strictEqual(snap.draw, 0.281);
    assert.strictEqual(snap.awayWin, 0.367);
  });

  console.log('\n📊 Section 2: Immutability Against Silent Overwrite');

  test('B2.1: Re-saving snapshot with SAME modelVersion and configHash does not duplicate or overwrite', () => {
    const beforeCount = db.prepare('SELECT count(*) as count FROM prediction_snapshots WHERE match_id = ?').get('10001').count;
    assert.strictEqual(beforeCount, 1);

    const samePred = {
      matchId: '10001',
      homeWin: 0.352, draw: 0.281, awayWin: 0.367,
      modelContract: {
        modelVersion: 'p0-quarantine-v3-2026-07-10',
        configHash: '2066763607e5'
      }
    };

    const resaved = savePredictionSnapshot('10001', samePred, { createdAt: '2026-06-10T11:00:00Z' });
    const afterCount = db.prepare('SELECT count(*) as count FROM prediction_snapshots WHERE match_id = ?').get('10001').count;

    assert.strictEqual(afterCount, 1, 'Row count must remain 1');
    assert.strictEqual(resaved.createdAt, '2026-06-10T10:00:00Z', 'Must preserve original creation timestamp');
  });

  test('B2.2: Saving prediction with CHANGED modelVersion or configHash inserts a NEW immutable record', () => {
    const upgradedPred = {
      matchId: '10001',
      homeWin: 0.360, draw: 0.280, awayWin: 0.360,
      modelContract: {
        modelVersion: 'p0-quarantine-v3.1-2026-07-11',
        configHash: 'abcdef123456'
      }
    };

    const savedNew = savePredictionSnapshot('10001', upgradedPred, { createdAt: '2026-06-11T10:00:00Z' });
    const rows = db.prepare('SELECT * FROM prediction_snapshots WHERE match_id = ? ORDER BY created_at ASC').all('10001');

    assert.strictEqual(rows.length, 2, 'Must retain old record AND create new record');
    assert.strictEqual(rows[0].model_version, 'p0-quarantine-v3-2026-07-10');
    assert.strictEqual(rows[1].model_version, 'p0-quarantine-v3.1-2026-07-11');
    assert.strictEqual(savedNew.modelVersion, 'p0-quarantine-v3.1-2026-07-11');
  });

  console.log('\n📊 Section 3: Legacy Data Migration & Non-Masquerade');

  test('B3.1: Legacy snapshot without modelVersion is marked verificationStatus="legacy"', () => {
    // Insert raw legacy snapshot without model_version
    const legacyPayload = JSON.stringify({ matchId: '10002', homeWin: 0.50, draw: 0.25, awayWin: 0.25 });
    db.prepare(`
      INSERT INTO prediction_snapshots (
        match_id, home_team_name, away_team_name, home_win_prob, draw_prob, away_win_prob,
        payload_json, source, created_at, model_version, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'legacy')
    `).run('10002', 'Argentina', 'Croatia', 0.50, 0.25, 0.25, legacyPayload, 'legacy-import', '2026-06-01T12:00:00Z');

    const snap = getPredictionSnapshot('10002');
    assert.strictEqual(snap.modelVersion, null, 'Missing modelVersion must stay missing (no fabrication)');
    assert.strictEqual(snap.verificationStatus, 'legacy');
  });

  test('B3.2: Old path cannot masquerade as verified A v4', () => {
    const auditReport = migratePredictionLedger(testDbPath);
    assert.strictEqual(auditReport.invalidMasquerades, 0);
    assert.strictEqual(auditReport.integrityCheck, 'PASSED');
  });

  test('B3.3: Raw DB insert without model fields defaults to legacy and leaves model semantics null', () => {
    const rawPayload = JSON.stringify({ matchId: '10009', homeWin: 0.45, draw: 0.30, awayWin: 0.25 });
    db.prepare(`
      INSERT INTO prediction_snapshots (
        match_id, home_team_name, away_team_name, home_win_prob, draw_prob, away_win_prob,
        payload_json, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('10009', 'Spain', 'Germany', 0.45, 0.30, 0.25, rawPayload, 'old-path', '2026-06-02T12:00:00Z');

    const row = db.prepare('SELECT verification_status FROM prediction_snapshots WHERE match_id = ?').get('10009');
    assert.strictEqual(row.verification_status, 'legacy', 'DB default verification_status must be legacy');

    const snap = getPredictionSnapshot('10009');
    assert.strictEqual(snap.verificationStatus, 'legacy', 'Must not be identified as verified A v4');
    assert.strictEqual(snap.modelVersion, null);
    assert.strictEqual(snap.configHash, null);
    assert.strictEqual(snap.activeSignals, null, 'activeSignals must stay null (no default elo/poisson fabrication)');
    assert.strictEqual(snap.candidates, null, 'candidates must stay null');
    assert.strictEqual(snap.dataSources, null, 'dataSources must stay null (no default elo_poisson)');
    assert.strictEqual(snap.requestPath, null, 'requestPath must stay null');
    assert.strictEqual(snap.venueSemantics, null, 'venueSemantics must stay null (no default isKnockout:false fabrication)');
  });

  test('B3.4: Record with modelVersion/configHash but verification_status="legacy" stays legacy without verified semantics', () => {
    const payload = JSON.stringify({ matchId: '10010', modelVersion: 'p0-quarantine-v3-2026-07-10', configHash: '2066763607e5' });
    db.prepare(`
      INSERT INTO prediction_snapshots (
        match_id, home_team_name, away_team_name, home_win_prob, draw_prob, away_win_prob,
        payload_json, source, created_at, model_version, config_hash, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'legacy')
    `).run('10010', 'Italy', 'France', 0.40, 0.30, 0.30, payload, 'old-path', '2026-06-03T12:00:00Z', 'p0-quarantine-v3-2026-07-10', '2066763607e5');

    const snap = getPredictionSnapshot('10010');
    assert.strictEqual(snap.verificationStatus, 'legacy', 'Must stay legacy when database column is legacy');
    assert.strictEqual(snap.activeSignals, null, 'activeSignals must stay null for legacy status');
    assert.strictEqual(snap.candidates, null, 'candidates must stay null for legacy status');
    assert.strictEqual(snap.dataSources, null, 'dataSources must stay null for legacy status');
    assert.strictEqual(snap.venueSemantics, null, 'venueSemantics must stay null for legacy status');
  });

  console.log('\n📊 Section 4: Calibration & Backtest Filtering by Fixed Model Version');

  test('B4.1: fetchSnapshotRows filters strictly by modelVersion', () => {
    const v1Id = db.prepare('SELECT id FROM prediction_snapshots WHERE match_id = ? AND model_version = ?').get('10001', 'p0-quarantine-v3-2026-07-10').id;
    const v2Id = db.prepare('SELECT id FROM prediction_snapshots WHERE match_id = ? AND model_version = ?').get('10001', 'p0-quarantine-v3.1-2026-07-11').id;
    const legacyId = db.prepare('SELECT id FROM prediction_snapshots WHERE match_id = ? AND verification_status = ?').get('10002', 'legacy').id;

    const now = '2026-06-11T12:00:00Z';
    db.prepare('INSERT INTO post_match_reviews (match_id, prediction_snapshot_id, actual_home_score, actual_away_score, review_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('10001_v1', v1Id, 1, 1, '{}', now, now);
    db.prepare('INSERT INTO post_match_reviews (match_id, prediction_snapshot_id, actual_home_score, actual_away_score, review_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('10001_v2', v2Id, 1, 1, '{}', now, now);
    db.prepare('INSERT INTO post_match_reviews (match_id, prediction_snapshot_id, actual_home_score, actual_away_score, review_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('10002', legacyId, 2, 0, '{}', now, now);

    const allRows = fetchSnapshotRows(db);
    assert.strictEqual(allRows.length, 3, 'Total 3 calibrated rows');

    const v3Rows = fetchSnapshotRows(db, { modelVersion: 'p0-quarantine-v3-2026-07-10' });
    assert.strictEqual(v3Rows.length, 1);
    assert.strictEqual(v3Rows[0].modelVersion, 'p0-quarantine-v3-2026-07-10');

    const legacyRows = fetchSnapshotRows(db, { modelVersion: 'legacy' });
    assert.strictEqual(legacyRows.length, 1);
    assert.strictEqual(legacyRows[0].verificationStatus, 'legacy');
  });

  test('B4.2: buildCalibrationReport reflects modelVersion filter cleanly without mixing models', () => {
    const rep = buildCalibrationReport({ db, modelVersion: 'p0-quarantine-v3-2026-07-10' });
    assert.strictEqual(rep.modelVersionFilter, 'p0-quarantine-v3-2026-07-10');
    assert.strictEqual(rep.sampleSize, 1);
    assert.strictEqual(rep.status, 'ok');
  });

  console.log('\n📊 Section 5: Prospective vs Retrospective Separation & Pre-Match Guard');

  test('B5.1: Retrospective predictions are stored in retrospective_predictions table without mixing into prediction_snapshots', () => {
    db.prepare(`
      INSERT INTO retrospective_predictions (match_id, home_win_prob, payload_json, generated_at)
      VALUES (?, ?, ?, ?)
    `).run('10003', 0.40, JSON.stringify({ homeWin: 0.40 }), '2026-07-10T12:00:00Z');

    const prospectiveSnap = getPredictionSnapshot('10003');
    assert.strictEqual(prospectiveSnap, null, 'Retrospective prediction must NOT leak into getPredictionSnapshot');

    const retroCount = db.prepare('SELECT count(*) as count FROM retrospective_predictions WHERE match_id = ?').get('10003').count;
    assert.strictEqual(retroCount, 1);
  });

  console.log('\n============================');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('============================\n');

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  delete process.env.TEST_DB_PATH;
  delete require.cache[require.resolve('../lib/db')];
  delete require.cache[require.resolve('../lib/postMatchReview')];
  delete require.cache[require.resolve('../lib/backtest-calibration')];

  if (failed > 0) process.exit(1);
}

runTests();
