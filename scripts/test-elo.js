#!/usr/bin/env node
/**
 * Elo 评分引擎测试
 */
const EloRating = require('../lib/elo');

const elo = new EloRating({ kFactor: 40, homeAdvantage: 100 });
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function assertNear(actual, expected, epsilon, label) {
  const ok = Math.abs(actual - expected) <= epsilon;
  if (ok) { console.log(`  ✅ ${label} (${actual.toFixed(3)})`); passed++; }
  else { console.error(`  ❌ ${label}: expected ~${expected}, got ${actual}`); failed++; }
}

console.log('=== Elo 评分引擎测试 ===\n');

// 1. 预期胜率测试
console.log('📊 预期胜率测试:');
assertNear(elo.expectedScore(2100, 1500), 0.969, 0.001, '2100 vs 1500 (强队预期)');
assertNear(elo.expectedScore(1500, 1500), 0.5, 0.001, '1500 vs 1500 (势均力敌)');
assertNear(elo.expectedScore(1200, 1800), 0.031, 0.001, '1200 vs 1800 (弱队预期)');

// 2. FIFA 排名转换
console.log('\n📊 FIFA 排名 → Elo 转换:');
assert(elo.initFromFifaRank(1) === 2100, 'Rank 1 → Elo 2100');
assert(elo.initFromFifaRank(10) === 1992, 'Rank 10 → Elo 1992');
assert(elo.initFromFifaRank(50) === 1512, 'Rank 50 → Elo 1512');

// 3. 模拟比赛评分更新
console.log('\n📊 模拟比赛: Brazil (1800) vs Germany (1750), 3-1');
const result = elo.updateRatings(1800, 1750, 3, 1);
assertNear(result.expectedHome, 0.703, 0.01, 'Expected home win rate');
assertNear(result.expectedAway, 0.297, 0.01, 'Expected away win rate');
assert(result.homeRating > 1800, 'Home rating increased (won)');
assert(result.awayRating < 1750, 'Away rating decreased (lost)');
assert(result.goalDiffMultiplier > 1, 'Goal diff multiplier > 1 for 2-goal margin');

// 4. 模拟平局
console.log('\n📊 模拟比赛: Argentina (1850) vs France (1850), 1-1');
const draw = elo.updateRatings(1850, 1850, 1, 1);
assert(draw.homeRating !== 1850, 'Home rating changed on draw');
assert(draw.awayRating !== 1850, 'Away rating changed on draw');
// With equal ratings and draw, home should lose points (home advantage expected more)
assert(draw.homeRating < 1850, 'Home lost Elo on draw (home advantage penalty)');
assert(draw.awayRating > 1850, 'Away gained Elo on draw (away bonus)');

// 5. 比赛预测
console.log('\n📊 比赛预测: Brazil (1800) vs Switzerland (1600)');
const pred = elo.predictMatch(1800, 1600);
assert(pred.homeWin > 0 && pred.homeWin < 1, 'Home win probability in range');
assert(pred.draw > 0 && pred.draw < 1, 'Draw probability in range');
assert(pred.awayWin > 0 && pred.awayWin < 1, 'Away win probability in range');
assertNear(pred.homeWin + pred.draw + pred.awayWin, 1, 0.01, 'Probabilities sum to ~1');
assert(pred.homeWin > pred.awayWin, 'Stronger team has higher win probability');

// 6. 排名计算
console.log('\n📊 球队排名:');
const teams = {
  '476': { name: 'Argentina', rating: 1900 },
  '472': { name: 'France', rating: 1880 },
  '473': { name: 'Spain', rating: 1870 },
  '448': { name: 'Germany', rating: 1850 },
  '205': { name: 'Brazil', rating: 1840 },
  '471': { name: 'England', rating: 1830 },
};
const rankings = elo.rankings(teams);
assert(rankings.length === 6, 'All 6 teams ranked');
assert(rankings[0].name === 'Argentina' && rankings[0].rank === 1, 'Highest Elo → rank 1');
assert(rankings[5].name === 'England' && rankings[5].rank === 6, 'Lowest Elo → rank 6');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
