#!/usr/bin/env node
/**
 * 预测融合引擎测试 - v3
 * 使用真实 ratings.json（从 2018+2022 历史数据生成的 Elo）
 */
const PredictionEngine = require('../lib/prediction');
const QualificationSimulator = require('../lib/qualification');

const engine = new PredictionEngine();
const ratings = require('../data/ratings.json').teams;

console.log('=== 预测融合引擎测试 (v3) ===\n');

// ========== 测试 1: 真实比赛预测 ==========
console.log('📊 测试 1: Australia vs Türkiye (真实结果 2-0)');
const aus = ratings['Australia'];
const tur = ratings['Türkiye'];
const pred1 = engine.predict({
  homeId: 'Australia', awayId: 'Türkiye',
  homeRating: aus, awayRating: tur,
});

console.log(`  主胜: ${(pred1.homeWin * 100).toFixed(1)}%`);
console.log(`  平局: ${(pred1.draw * 100).toFixed(1)}%`);
console.log(`  客胜: ${(pred1.awayWin * 100).toFixed(1)}%`);
console.log(`  最可能比分: ${pred1.likelyScore}`);
console.log(`  Expected Goals: ${pred1.goals.homeExpected} - ${pred1.goals.awayExpected}`);
console.log(`  Poisson 有效: ${pred1.components.poisson.valid}`);

// ========== 测试 2: 强队 vs 弱队 ==========
console.log('\n📊 测试 2: Germany vs Haiti');
const ger = ratings['Germany'];
const hai = ratings['Haiti'];
const pred2 = engine.predict({
  homeId: 'Germany', awayId: 'Haiti',
  homeRating: ger, awayRating: hai,
});
console.log(`  Germany: Elo=${ger.rating} attack=${ger.attack_strength} defense=${ger.defense_strength}`);
console.log(`  Haiti: Elo=${hai.rating} attack=${hai.attack_strength} defense=${hai.defense_strength}`);
console.log(`  主胜: ${(pred2.homeWin * 100).toFixed(1)}%`);
console.log(`  平局: ${(pred2.draw * 100).toFixed(1)}%`);
console.log(`  客胜: ${(pred2.awayWin * 100).toFixed(1)}%`);
console.log(`  最可能比分: ${pred2.likelyScore}`);
console.log(`  Expected Goals: ${pred2.goals.homeExpected} - ${pred2.goals.awayExpected}`);

// ========== 测试 3: 势均力敌 ==========
console.log('\n📊 测试 3: Switzerland vs Sweden (势均力敌)');
const swi = ratings['Switzerland'];
const swe = ratings['Sweden'];
const pred3 = engine.predict({
  homeId: 'Switzerland', awayId: 'Sweden',
  homeRating: swi, awayRating: swe,
});
console.log(`  主胜: ${(pred3.homeWin * 100).toFixed(1)}%`);
console.log(`  平局: ${(pred3.draw * 100).toFixed(1)}%`);
console.log(`  客胜: ${(pred3.awayWin * 100).toFixed(1)}%`);
console.log(`  最可能比分: ${pred3.likelyScore}`);

// ========== 测试 4: Elo 引导 vs 纯 Poisson ==========
console.log('\n📊 测试 4: Elo 引导效果对比');
console.log('  Australia vs Türkiye（Elo 几乎相等）：');
const poissonComponent = pred1.components.poisson;
console.log(`    Poisson 原始 λ: ${poissonComponent.homeLambda} - ${poissonComponent.awayLambda}`);
console.log(`    Elo 引导 λ: ${pred1.goals.homeExpected} - ${pred1.goals.awayExpected}`);

console.log('\n  Germany vs Haiti（Elo 差 349）：');
const poissonComponent2 = pred2.components.poisson;
console.log(`    Poisson 原始 λ: ${poissonComponent2.homeLambda} - ${poissonComponent2.awayLambda}`);
console.log(`    Elo 引导 λ: ${pred2.goals.homeExpected} - ${pred2.goals.awayExpected}`);

// ========== 测试 5: 出线模拟 ==========
console.log('\n📊 测试 5: 小组出线模拟 (1000 次)');
const qs = new QualificationSimulator({
  simulations: 1000,
  predictionEngine: engine,
});

const groups = qs.loadGroupsFromDB();
console.log(`  加载了 ${groups.length} 个分组`);

// 展示 D 组（已有 Australia 2-0 结果）
const groupD = groups.find(g => g.name === 'Group D');
if (groupD) {
  console.log('\n  Group D 出线概率:');
  const result = qs.simulateGroup(groupD);
  for (const r of result.results) {
    console.log(`    ${r.name.padEnd(15)} 出线=${(r.qualifyProb*100).toFixed(1)}% 均位=${r.avgPosition}`);
  }
}

// ========== 融合权重 ==========
console.log('\n📊 融合权重（Dynamic Weights）:');
console.log('  ', pred1.weights);

// ========== 评分分布 ==========
console.log('\n📊 评分 Top 10:');
const sorted = Object.entries(ratings).sort((a,b) => b[1].rating - a[1].rating);
sorted.slice(0, 10).forEach(([name, data]) => {
  console.log(`  ${name.padEnd(20)} Elo=${data.rating} 攻=${data.attack_strength} 防=${data.defense_strength}`);
});
console.log('\n📊 评分 Bottom 5:');
sorted.slice(-5).forEach(([name, data]) => {
  console.log(`  ${name.padEnd(20)} Elo=${data.rating} 攻=${data.attack_strength} 防=${data.defense_strength}`);
});

console.log('\n✅ 全部测试完成!');
console.log(`  球队数量: ${Object.keys(ratings).length}`);
