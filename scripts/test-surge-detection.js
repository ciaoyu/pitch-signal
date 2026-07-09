'use strict';

/**
  * Regression test for sustained_pressure_alert detection (defect fix)
 *
  * Background: the original detectSurge used strict consecutive counting ("count back from the latest snapshot, break at the first < threshold"),
  * but the pressure index itself is a per-minute delta, so a single dip breaks the consecutive count, causing a real 3-minute surge
  * to never alert as long as one jitter is in between (systematic false negatives). Also the original logic didn't check "no goal during the period", risking false positives.
 *
  * This test verifies:
  *   1. a real surge with one dip in the middle (3 of 4 snapshots ≥65) should trigger
  *   2. a real consecutive 3-minute high pressure triggers
  *   3. fewer than 3 high-PI snapshots does not trigger
  *   4. if the team has already scored within the window, it does not trigger (no goal during the period)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_surge_detection.db');
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
process.env.TEST_DB_PATH = TEST_DB_PATH;

const { db } = require('../lib/db');
const { detectSurge } = require('../lib/services/pressure-index');

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

const MATCH = 'surge-test-match';

function clear() {
  db.prepare('DELETE FROM match_live_stats WHERE match_id = ?').run(MATCH);
  db.prepare('DELETE FROM match_moments WHERE match_id = ?').run(MATCH);
}

function insertSnapshot(minute, ph, pa) {
  db.prepare(`
    INSERT OR REPLACE INTO match_live_stats
      (match_id, minute, pressure_home, pressure_away, pressure_dominant, captured_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(MATCH, minute, ph, pa, ph >= pa ? 'home' : 'away', new Date().toISOString());
}

function insertGoal(minute, teamId) {
  db.prepare(`
    INSERT INTO match_moments
      (match_id, type, minute, minute_added, team_id, importance, source, detected_at)
    VALUES (?, 'goal', ?, 0, ?, 80, 'espn', ?)
  `).run(MATCH, minute, teamId, new Date().toISOString());
}

console.log('=== sustained_pressure_alert detection (fix for missed detections) test ===\n');

test('1. 中间夹一次低谷的真实猛攻应被识别（修复前会漏报）', () => {
  clear();
  // home keeps high pressure from 70~73, but the 71st-minute PI dips below the threshold
  insertSnapshot(70, 66, 40);
  insertSnapshot(71, 64, 40); // jitter dip
  insertSnapshot(72, 67, 40);
  insertSnapshot(73, 68, 40); // current minute triggers detection
  const r = detectSurge(MATCH, 'home', 73);
  assert.strictEqual(r.surge, true, '4 快照中 3 个 ≥65 应触发');
  assert.strictEqual(r.suppressedByGoal, false);
  assert.strictEqual(r.highCount, 3);
});

test('2. 真实连续 3 分钟高压触发', () => {
  clear();
  insertSnapshot(80, 70, 30);
  insertSnapshot(81, 72, 30);
  insertSnapshot(82, 74, 30);
  const r = detectSurge(MATCH, 'home', 82);
  assert.strictEqual(r.surge, true);
});

test('3. 不足 3 个高 PI 快照不触发', () => {
  clear();
  insertSnapshot(90, 66, 30);
  insertSnapshot(91, 40, 30);
  const r = detectSurge(MATCH, 'home', 91);
  assert.strictEqual(r.surge, false);
});

test('4. 窗口内该队已进球则不触发（期间未进球）', () => {
  clear();
  insertSnapshot(100, 70, 30);
  insertSnapshot(101, 72, 30);
  insertSnapshot(102, 74, 30);
  insertGoal(101, 'HOME_TEAM_ID'); // that team (home) scores in the 101st minute
  const r = detectSurge(MATCH, 'home', 102, { matchState: { homeTeamId: 'HOME_TEAM_ID', awayTeamId: 'AWAY_TEAM_ID' } });
  assert.strictEqual(r.surge, false, '窗口内该队进球应否决');
  assert.strictEqual(r.suppressedByGoal, true);
});

test('5. 窗口内对方进球（该队未进球）仍触发', () => {
  clear();
  insertSnapshot(110, 70, 30);
  insertSnapshot(111, 72, 30);
  insertSnapshot(112, 74, 30);
  insertGoal(111, 'AWAY_TEAM_ID'); // opponent scores; home still trailing and hasn't scored
  const r = detectSurge(MATCH, 'home', 112, { matchState: { homeTeamId: 'HOME_TEAM_ID', awayTeamId: 'AWAY_TEAM_ID' } });
  assert.strictEqual(r.surge, true, '对方进球不影响该队"未进球"判定');
});

console.log(`\nPassed ${passed} / Failed ${failed}`);
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
process.exit(failed > 0 ? 1 : 0);
