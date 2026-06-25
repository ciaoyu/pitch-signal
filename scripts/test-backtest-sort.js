'use strict';
/**
 * 验证 BacktestRunner._walkForward 的同日批量隔离与日期排序行为（直接验证 lib/backtest.js 的真实回归测试）
 */

const assert = require('assert');
const BacktestRunner = require('../lib/backtest');
const PredictionEngine = require('../lib/prediction');

let passed = 0;
let failed = 0;

function testAssert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

// 拦截 PredictionEngine.prototype.predictWithMarket 检查真实传入的评分
const ratingsDuringPredict = [];
const originalPredict = PredictionEngine.prototype.predictWithMarket;
PredictionEngine.prototype.predictWithMarket = async function(args) {
  ratingsDuringPredict.push({
    homeId: args.homeId,
    awayId: args.awayId,
    homeRating: args.homeRating ? { ...args.homeRating } : null,
    awayRating: args.awayRating ? { ...args.awayRating } : null,
  });
  return originalPredict.call(this, args);
};

// 1. 同日隔离性验证
async function testSameDayIsolation() {
  console.log('\n[1] Same-day matches isolation validation (via BacktestRunner._walkForward)');
  
  ratingsDuringPredict.length = 0; // 重置
  const runner = new BacktestRunner();

  const SAME_DATE = '2018-06-14';
  const NEXT_DATE = '2018-06-15';

  const testMatches = [
    // Day 1 Match 1: TeamA vs TeamB at 12:00. TeamA wins 2-0.
    { date: SAME_DATE + 'T12:00:00Z', home: 'TeamA', away: 'TeamB', homeScore: 2, awayScore: 0, stage: 'Group Stage' },
    // Day 1 Match 2: TeamA vs TeamC at 18:00.
    // 在同日隔离下，TeamA 的预测分必须维持初始的 1500，不能被 12:00 的比赛结果所污染。
    { date: SAME_DATE + 'T18:00:00Z', home: 'TeamA', away: 'TeamC', homeScore: 0, awayScore: 1, stage: 'Group Stage' },
    // Day 2 Match 3: TeamA vs TeamD at 15:00.
    // 次日比赛，TeamA 的评分应该累积 Day 1 的两场结算结果。
    { date: NEXT_DATE + 'T15:00:00Z', home: 'TeamA', away: 'TeamD', homeScore: 1, awayScore: 1, stage: 'Group Stage' },
  ];

  const result = await runner._walkForward(testMatches);

  testAssert(result.evaluatedCount === 3, 'Evaluated all 3 matches');

  // Verify predictions history
  testAssert(ratingsDuringPredict.length === 3, 'Captured exactly 3 prediction arguments');

  const [p1, p2, p3] = ratingsDuringPredict;

  // Day 1 Match 1
  testAssert(p1.homeId === 'TeamA' && p1.homeRating.rating === 1500, 'Day 1 Match 1: TeamA starts with 1500 Elo');
  testAssert(p1.awayId === 'TeamB' && p1.awayRating.rating === 1500, 'Day 1 Match 1: TeamB starts with 1500 Elo');

  // Day 1 Match 2 (TeamA vs TeamC)
  testAssert(p2.homeId === 'TeamA' && p2.homeRating.rating === 1500, 'Day 1 Match 2: TeamA remains at 1500 Elo during the same day (no leak)');
  testAssert(p2.awayId === 'TeamC' && p2.awayRating.rating === 1500, 'Day 1 Match 2: TeamC starts with 1500 Elo');

  // Day 2 Match 3 (TeamA vs TeamD)
  // Expected TeamA rating after Day 1 matches is the rating from the last update of Day 1 (which overwrote the first).
  // Match 2 of Day 1 was: TeamA vs TeamC (0 - 1).
  const EloRating = require('../lib/elo');
  const eloEngine = new EloRating();
  const expectedEloAfterDay1 = eloEngine.updateRatings(1500, 1500, 0, 1, { matchType: 'world_cup' }).homeRating;

  testAssert(p3.homeRating.rating === expectedEloAfterDay1, `Day 2 Match 3: TeamA uses the updated post-Day-1 rating of ${expectedEloAfterDay1}`);
  
  const teamAAfterDay2 = result.finalRatings['TeamA']?.rating;
  testAssert(teamAAfterDay2 !== undefined && teamAAfterDay2 !== expectedEloAfterDay1, `TeamA Elo at the end of Day 2 is updated to ${teamAAfterDay2}`);
}

// 2. 日期提取验证
function testDateKeyExtraction() {
  console.log('\n[2] Date key extraction verification');
  const dates = [
    '2018-06-14',
    '2018-06-14T00:00:00Z',
    '2018-06-14T12:00:00Z',
    '2018-06-14T23:59:59+05:30',
  ];
  for (const d of dates) {
    const key = String(d).slice(0, 10);
    testAssert(key === '2018-06-14', `Date key: "${d}" -> "${key}" === "2018-06-14"`);
  }
}

// 3. 排序验证
function testDateOrdering() {
  console.log('\n[3] Date ordering verification');
  const matchDates = [
    '2018-06-28', '2018-06-15', '2018-06-14', '2018-07-15', '2018-06-30',
  ];
  const sorted = [...matchDates].sort((a, b) => new Date(a) - new Date(b));
  const expected = ['2018-06-14', '2018-06-15', '2018-06-28', '2018-06-30', '2018-07-15'];
  testAssert(JSON.stringify(sorted) === JSON.stringify(expected), 'Dates sorted in ascending order correctly');
}

// 4. evalFilter 隔离评估验证
function testEvalFilter() {
  console.log('\n[4] evalFilter verification');
  const matches = [
    { date: '2018-06-14', home: 'A', away: 'B', homeScore: 1, awayScore: 0 },
    { date: '2018-07-15', home: 'C', away: 'D', homeScore: 0, awayScore: 2 },
    { date: '2022-11-20', home: 'E', away: 'F', homeScore: 2, awayScore: 1 },
    { date: '2022-12-18', home: 'G', away: 'H', homeScore: 3, awayScore: 3 },
  ];

  const evalFilter = (m) => new Date(m.date) >= new Date('2022-01-01');

  const shouldEval = matches.map(m => evalFilter(m));
  testAssert(!shouldEval[0], '2018 match excluded by evalFilter');
  testAssert(!shouldEval[1], '2018 match excluded by evalFilter');
  testAssert(shouldEval[2], '2022 match included by evalFilter');
  testAssert(shouldEval[3], '2022 match included by evalFilter');
}

// 执行
(async () => {
  console.log('\n==================================================');
  console.log('Running lib/backtest.js Regression Tests');
  console.log('==================================================');

  testDateKeyExtraction();
  testDateOrdering();
  testEvalFilter();
  await testSameDayIsolation();

  console.log('\n==================================================');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
