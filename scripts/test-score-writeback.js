'use strict';

/**
  * P0-3 Final score writeback (Score Writeback) test suite
 * 
  * Covered scenarios:
  * 1. Normal final score writeback (played = 1, home_score, away_score persisted)
  * 2. Idempotency test (re-writing identical scores is a no-op)
  * 3. Overwrite-protection test (already-written correct scores are not overwritten by later differing scores or bad API data)
  * 4. Home/away swap mapping test (correctly auto-maps scores when input home/away order is reversed vs DB seed data)
  * 5. Unfinished match status is not written back
  * 6. Team name & ID (ESPN ID / FIFA Code) auto-conversion parsing
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Prepare isolated test env variables
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_score_writeback.db');
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
process.env.TEST_DB_PATH = TEST_DB_PATH;

const { db } = require('../lib/db');
const { writebackMatchScore, resolveTeamToRatingsId } = require('../lib/services/score-writeback');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('=== Running P0-3 Score Writeback Tests ===\n');

// Prepare test data rows
db.prepare(`
  INSERT INTO groups (id, group_name) VALUES (99, 'Test Group')
`).run();

db.prepare(`
  INSERT INTO matches (group_id, match_number, home_team_id, away_team_id, home_score, away_score, played, match_date, venue)
  VALUES 
    (99, 101, 'USA', 'Mexico', NULL, NULL, 0, '2026-06-15', 'Test Stadium 1'),
    (99, 102, 'Brazil', 'France', NULL, NULL, 0, '2026-06-16', 'Test Stadium 2'),
    (99, 103, 'Argentina', 'Spain', NULL, NULL, 0, '2026-06-17', 'Test Stadium 3')
`).run();

test('1. resolveTeamToRatingsId 解析测试', () => {
  assert.strictEqual(resolveTeamToRatingsId('USA'), 'USA');
  assert.strictEqual(resolveTeamToRatingsId('United States'), 'USA');
  assert.strictEqual(resolveTeamToRatingsId('203'), 'Mexico'); // ESPN ID 203 -> Mexico
});

test('2. 正常终场比分回写 (USA vs Mexico 2-1)', () => {
  const res = writebackMatchScore({
    homeTeam: 'USA',
    awayTeam: 'Mexico',
    homeScore: 2,
    awayScore: 1,
    statusName: 'STATUS_FINAL',
    source: 'fifa'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated, true);
  assert.strictEqual(res.homeScore, 2);
  assert.strictEqual(res.awayScore, 1);

  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(res.matchId);
  assert.strictEqual(row.played, 1);
  assert.strictEqual(row.home_score, 2);
  assert.strictEqual(row.away_score, 1);
});

test('3. 严格幂等性测试 (重复回写相同比分 2-1)', () => {
  const res = writebackMatchScore({
    homeTeam: 'USA',
    awayTeam: 'Mexico',
    homeScore: 2,
    awayScore: 1,
    statusName: 'STATUS_FULL_TIME',
    source: 'espn'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated, false);
  assert.strictEqual(res.reason, 'already_written');

  const row = db.prepare("SELECT * FROM matches WHERE home_team_id = 'USA' AND away_team_id = 'Mexico'").get();
  assert.strictEqual(row.played, 1);
  assert.strictEqual(row.home_score, 2);
  assert.strictEqual(row.away_score, 1);
});

test('4. 防覆盖保护测试 (防止已确立比分被错误接口 0-0 覆盖)', () => {
  const res = writebackMatchScore({
    homeTeam: 'USA',
    awayTeam: 'Mexico',
    homeScore: 0,
    awayScore: 0,
    statusName: 'STATUS_FINAL',
    source: 'espn_glitch'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated, false);
  assert.strictEqual(res.reason, 'idempotent_protected');

  // DB data unchanged
  const row = db.prepare("SELECT * FROM matches WHERE home_team_id = 'USA' AND away_team_id = 'Mexico'").get();
  assert.strictEqual(row.played, 1);
  assert.strictEqual(row.home_score, 2);
  assert.strictEqual(row.away_score, 1);
});

test('5. 主客队颠倒映射回写测试 (DB seeded: Brazil vs France, API: France vs Brazil 3-2)', () => {
  // API reports home team France scored 3, away team Brazil scored 2
  const res = writebackMatchScore({
    homeTeam: 'France',
    awayTeam: 'Brazil',
    homeScore: 3,
    awayScore: 2,
    statusName: 0, // FIFA status 0 = finished
    source: 'fifa'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.updated, true);

  // In DB, Brazil is home_team_id, so should map to home_score = 2, away_score = 3
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(res.matchId);
  assert.strictEqual(row.home_team_id, 'Brazil');
  assert.strictEqual(row.away_team_id, 'France');
  assert.strictEqual(row.home_score, 2);
  assert.strictEqual(row.away_score, 3);
  assert.strictEqual(row.played, 1);
});

test('6. 非终场状态比赛不回写 (STATUS_FIRST_HALF)', () => {
  const res = writebackMatchScore({
    homeTeam: 'Argentina',
    awayTeam: 'Spain',
    homeScore: 1,
    awayScore: 0,
    statusName: 'STATUS_FIRST_HALF',
    source: 'espn'
  });

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.updated, false);
  assert.strictEqual(res.reason, 'not_finished');

  const row = db.prepare("SELECT * FROM matches WHERE home_team_id = 'Argentina' AND away_team_id = 'Spain'").get();
  assert.strictEqual(row.played, 0);
  assert.strictEqual(row.home_score, null);
});

// Clean up temporary test DB
db.close();
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

console.log(`\n============================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed`);
console.log(`============================\n`);

if (failed > 0) {
  process.exit(1);
}
