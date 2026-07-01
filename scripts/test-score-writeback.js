'use strict';

/**
 * P0-3 终场比分回写 (Score Writeback) 测试套件
 * 
 * 覆盖场景：
 * 1. 正常终场比分回写 (played = 1, home_score, away_score 落库)
 * 2. 幂等性测试 (完全一样比分重复回写为 no-op)
 * 3. 防覆盖保护测试 (已回写的正确比分不会被后续不同比分或错误接口数据覆盖)
 * 4. 主客队映射颠倒测试 (传入的主客顺序与 DB seed 数据相反时正确自动映射比分)
 * 5. 未结束比赛状态不回写
 * 6. 球队名称与 ID (ESPN ID / FIFA Code) 自动转换解析
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// 准备隔离测试环境变量
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

// 准备测试数据行
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

  // DB 数据保持不变
  const row = db.prepare("SELECT * FROM matches WHERE home_team_id = 'USA' AND away_team_id = 'Mexico'").get();
  assert.strictEqual(row.played, 1);
  assert.strictEqual(row.home_score, 2);
  assert.strictEqual(row.away_score, 1);
});

test('5. 主客队颠倒映射回写测试 (DB seeded: Brazil vs France, API: France vs Brazil 3-2)', () => {
  // API 传过来的主队是 France 进了 3 球，客队是 Brazil 进了 2 球
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

  // DB 中 Brazil 是 home_team_id，因此应该映射为 home_score = 2, away_score = 3
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

// 清理临时测试库
db.close();
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

console.log(`\n============================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed`);
console.log(`============================\n`);

if (failed > 0) {
  process.exit(1);
}
