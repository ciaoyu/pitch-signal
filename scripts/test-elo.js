#!/usr/bin/env node
/**
 * Elo 评分引擎测试
 */
const EloRating = require('../lib/elo');

const elo = new EloRating({ kFactor: 40, homeAdvantage: 100 });

console.log('=== Elo 评分引擎测试 ===\n');

// 1. 预期胜率测试
console.log('📊 预期胜率测试:');
console.log(`  2100 vs 1500: ${elo.expectedScore(2100, 1500).toFixed(3)} (强队预期)`);
console.log(`  1500 vs 1500: ${elo.expectedScore(1500, 1500).toFixed(3)} (势均力敌)`);
console.log(`  1200 vs 1800: ${elo.expectedScore(1200, 1800).toFixed(3)} (弱队预期)`);

// 2. FIFA 排名转换
console.log('\n📊 FIFA 排名 → Elo 转换:');
[1, 5, 10, 20, 30, 50].forEach(rank => {
  console.log(`  Rank ${rank} → Elo ${elo.initFromFifaRank(rank)}`);
});

// 3. 模拟比赛评分更新
console.log('\n📊 模拟比赛: Brazil (1800) vs Germany (1750), 3-1');
const result = elo.updateRatings(1800, 1750, 3, 1);
console.log(`  预期胜率: 主 ${result.expectedHome} / 客 ${result.expectedAway}`);
console.log(`  比分差加成: ${result.goalDiffMultiplier}`);
console.log(`  新评分: 主 ${result.homeRating} / 客 ${result.awayRating}`);
console.log(`  变动: 主 ${(result.homeRating - 1800).toFixed(2)} / 客 ${(result.awayRating - 1750).toFixed(2)}`);

// 4. 模拟平局
console.log('\n📊 模拟比赛: Argentina (1850) vs France (1850), 1-1');
const draw = elo.updateRatings(1850, 1850, 1, 1);
console.log(`  新评分: 主 ${draw.homeRating} / 客 ${draw.awayRating}`);

// 5. 比赛预测
console.log('\n📊 比赛预测: Brazil (1800) vs Switzerland (1600)');
const pred = elo.predictMatch(1800, 1600);
console.log(`  主胜: ${(pred.homeWin * 100).toFixed(1)}%`);
console.log(`  平局: ${(pred.draw * 100).toFixed(1)}%`);
console.log(`  客胜: ${(pred.awayWin * 100).toFixed(1)}%`);

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
elo.rankings(teams).forEach(t => {
  console.log(`  #${t.rank} ${t.name}: ${t.rating}`);
});

console.log('\n✅ Elo 测试完成!');
