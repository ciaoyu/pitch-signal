'use strict';

/**
  * Task D regression test: moment-sync live-data integration into post-match review
 *
  * Verifies:
  *   1. getMatchMomentsTimeline() maps match_moments rows into the node shape that summarizeSnapshotNode()
  *      recognizes (trigger/minute/home/away/odds + probability-drift summary),
  *      odds taken directly from prob_home_win/prob_draw/prob_away_win.
  *   2. occasional duplicate substitution_key records are deduplicated by `${minute}-${type}-${teamId}`,
  *      but legitimate substitutions by two different teams in the same minute keep both rows.
  *   3. buildPostMatchReview() converts evidence.timeline into liveTimelineI18n,
  *      new types (e.g. kickoff) get the correct zh label (e.g. "opening") instead of an English snake_case,
  *      and the AI prompt context (aiPromptContext.liveTimelineI18n) also carries the real data.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.TEST_MODE = '1';
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_moment_review.db');
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
process.env.TEST_DB_PATH = TEST_DB_PATH;

const { db } = require('../lib/db');
const { getMatchMomentsTimeline } = require('../lib/services/ReviewService');
const { buildPostMatchReview } = require('../lib/postMatchReview');

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

console.log('=== Match Moments → Post-Match Review Integration Tests ===\n');

const MID = '999999';
const HOME = '测试主队';
const AWAY = '测试客队';

function insertMoment(over) {
  const m = Object.assign({
    match_id: MID,
    type: 'kickoff',
    minute: 0,
    minute_added: 0,
    team_id: null,
    importance: 50,
    source: 'inferred',
    score_state_json: JSON.stringify({ home: 0, away: 0 }),
    raw_json: '{}',
    prob_home_win: 0.5,
    prob_draw: 0.3,
    prob_away_win: 0.2,
    delta_home_win: 0.02,
    delta_draw: -0.01,
    delta_away_win: -0.01,
    detected_at: new Date().toISOString(),
  }, over);
  db.prepare(`INSERT INTO match_moments
    (match_id, type, minute, minute_added, team_id, importance, source, score_state_json, raw_json,
     prob_home_win, prob_draw, prob_away_win, delta_home_win, delta_draw, delta_away_win, detected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    m.match_id, m.type, m.minute, m.minute_added, m.team_id, m.importance, m.source,
    m.score_state_json, m.raw_json, m.prob_home_win, m.prob_draw, m.prob_away_win,
    m.delta_home_win, m.delta_draw, m.delta_away_win, m.detected_at,
  );
}

test('1. getMatchMomentsTimeline 映射 node 形状 + odds + 概率漂移', () => {
  insertMoment({
    type: 'kickoff', minute: 0,
    score_state_json: JSON.stringify({ home: 0, away: 0 }),
    prob_home_win: 0.5, prob_draw: 0.3, prob_away_win: 0.2,
    delta_home_win: 0.02, delta_draw: -0.01, delta_away_win: -0.01,
  });
  insertMoment({
    type: 'hydration_break', minute: 30,
    score_state_json: JSON.stringify({ home: 1, away: 0 }),
    prob_home_win: 0.62, prob_draw: 0.24, prob_away_win: 0.14,
    delta_home_win: 0.1, delta_draw: -0.03, delta_away_win: -0.07,
  });

  const nodes = getMatchMomentsTimeline(MID, HOME, AWAY);
  assert.ok(nodes.length >= 2, `应有 >=2 节点, got ${nodes.length}`);

  const k = nodes.find(n => n.trigger === 'kickoff');
  assert.ok(k, 'kickoff 节点存在');
  assert.strictEqual(k.minute, 0);
  assert.strictEqual(k.home.name, HOME);
  assert.strictEqual(k.home.score, 0);
  assert.strictEqual(k.away.name, AWAY);
  assert.strictEqual(k.away.score, 0);
  assert.strictEqual(k.odds.homeWin, 0.5);
  assert.strictEqual(k.odds.draw, 0.3);
  assert.strictEqual(k.odds.awayWin, 0.2);
  assert.ok(k.summary.includes('主胜Δ+2'), `summary 应含概率漂移, got: "${k.summary}"`);

  const h = nodes.find(n => n.trigger === 'hydration_break');
  assert.strictEqual(h.home.score, 1, '补水时比分应为 1-0');
  assert.strictEqual(h.away.score, 0);
});

test('2. substitution_key 跨 tick 重复（minute_added 不同）被去重，不同球队合法换人保留', () => {
    // The DB's UNIQUE(match_id,type,minute,minute_added,team_id) already uses INSERT OR IGNORE
    // to drop fully duplicate rows; real occasional duplicates come from the same substitution recorded with different minute_added on adjacent ticks.
    // This is exactly the scenario that getMatchMomentsTimeline's dedupe by `${minute}-${type}-${teamId}` must cover.
  insertMoment({ type: 'substitution_key', minute: 75, minute_added: 0, team_id: 'TEAMA', prob_home_win: 0.6, prob_draw: 0.25, prob_away_win: 0.15 });
  insertMoment({ type: 'substitution_key', minute: 75, minute_added: 1, team_id: 'TEAMA', prob_home_win: 0.6, prob_draw: 0.25, prob_away_win: 0.15 }); // same substitution, different tick
  insertMoment({ type: 'substitution_key', minute: 75, minute_added: 0, team_id: 'TEAMB', prob_home_win: 0.55, prob_draw: 0.25, prob_away_win: 0.2 }); // different team

  const nodes = getMatchMomentsTimeline(MID, HOME, AWAY);
  const subs = nodes.filter(n => n.trigger === 'substitution_key');
  assert.strictEqual(subs.length, 2, `75\' 两支不同球队换人应保留 2 条, got ${subs.length}`);
});

test('3. buildPostMatchReview 把 timeline 转成中文标签 liveTimelineI18n（非 snake_case）', () => {
  const nodes = getMatchMomentsTimeline(MID, HOME, AWAY);
  const review = buildPostMatchReview({
    matchId: MID,
    match: {
      homeName: HOME, awayName: AWAY, homeScore: 2, awayScore: 1,
      completed: true, homeId: 'H', awayId: 'A', status: 'STATUS_FINAL', date: '', venue: '',
    },
    snapshot: null,
    evidence: { events: [], commentary: [], news: [], timeline: nodes },
    generatedBy: 'test',
  });

  assert.ok(review.liveTimelineI18n && review.liveTimelineI18n.length > 0, 'liveTimelineI18n 非空');

  const kickoff = review.liveTimelineI18n.find(n => n.trigger === 'kickoff');
  assert.ok(kickoff, 'kickoff 进入 liveTimelineI18n');
  assert.strictEqual(kickoff.titleI18n.zh, '开场', `中文标签应为"开场", got "${kickoff.titleI18n.zh}"`);
  assert.ok(!kickoff.titleI18n.zh.includes('kickoff'), '不应是英文 snake_case');

  const hydration = review.liveTimelineI18n.find(n => n.trigger === 'hydration_break');
  assert.ok(hydration, 'hydration_break 进入 liveTimelineI18n');
  assert.strictEqual(hydration.titleI18n.zh, '补水时间', `中文标签应为"补水时间", got "${hydration.titleI18n.zh}"`);

    // AI prompt context also carries liveTimelineI18n
  assert.ok(
    Array.isArray(review.aiPromptContext.liveTimelineI18n) && review.aiPromptContext.liveTimelineI18n.length > 0,
    'aiPromptContext 应含 liveTimelineI18n',
  );
});

test('4. 无概率数据（prob_home_win=null）的 moments 仍返回，odds 为 null', () => {
    // when pre-match snapshots are missing, moment-sync cannot inject reprice probabilities; prob_home_win is all null.
    // getMatchMomentsTimeline should not filter out these rows, but return nodes with odds=null,
    // so the AI can at least reference the specific minute and score state.
  const MID2 = '888888';
  db.prepare(`INSERT INTO match_moments
    (match_id, type, minute, minute_added, team_id, importance, source, score_state_json, raw_json,
     prob_home_win, prob_draw, prob_away_win, delta_home_win, delta_draw, delta_away_win, detected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    MID2, 'halftime', 45, 0, null, 70, 'inferred',
    JSON.stringify({ home: 1, away: 0 }), '{}',
    null, null, null, null, null, null, new Date().toISOString(),
  );
  db.prepare(`INSERT INTO match_moments
    (match_id, type, minute, minute_added, team_id, importance, source, score_state_json, raw_json,
     prob_home_win, prob_draw, prob_away_win, delta_home_win, delta_draw, delta_away_win, detected_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    MID2, 'hydration_break', 73, 0, null, 40, 'inferred',
    JSON.stringify({ home: 1, away: 0 }), '{}',
    null, null, null, null, null, null, new Date().toISOString(),
  );

  const nodes = getMatchMomentsTimeline(MID2, HOME, AWAY);
  assert.strictEqual(nodes.length, 2, `应返回 2 条无概率 moments, got ${nodes.length}`);
  assert.strictEqual(nodes[0].odds, null, 'odds 应为 null');
  assert.strictEqual(nodes[0].summary, null, 'summary 应为 null（无概率漂移）');
  assert.strictEqual(nodes[0].trigger, 'halftime');
  assert.strictEqual(nodes[1].trigger, 'hydration_break');
});

db.close();
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

console.log(`\n============================`);
console.log(`Test Summary: ${passed} passed, ${failed} failed`);
console.log(`============================\n`);

if (failed > 0) {
  process.exit(1);
}
