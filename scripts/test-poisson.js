#!/usr/bin/env node
/**
 * Poisson 回归模型测试
 */
const PoissonModel = require('../lib/poisson');

const model = new PoissonModel({ globalAvgGoals: 2.5, homeAdvantage: 1.2 });

console.log('=== Poisson 回归模型测试 ===\n');

// 1. PMF 测试
console.log('📊 Poisson PMF (λ=2.5):');
for (let k = 0; k <= 5; k++) {
  console.log(`  P(X=${k}) = ${model.poissonPMF(k, 2.5).toFixed(4)} (${(model.poissonPMF(k, 2.5) * 100).toFixed(1)}%)`);
}

// 2. 进球期望值
console.log('\n📊 进球期望值 λ:');
console.log(`  强队攻(1.3) vs 弱队守(1.2), 主场: ${model.calculateLambda(1.3, 1.2, true).toFixed(3)}`);
console.log(`  弱队攻(0.8) vs 强队守(0.7), 客场: ${model.calculateLambda(0.8, 0.7, false).toFixed(3)}`);

// 3. 概率矩阵
console.log('\n📊 Brazil (atk=1.3, def=0.8) vs Germany (atk=1.2, def=0.9):');
const prediction = model.predictMatch(
  { attack_strength: 1.3, defense_strength: 0.8 },
  { attack_strength: 1.2, defense_strength: 0.9 }
);
console.log(`  主队 λ: ${prediction.homeLambda}`);
console.log(`  客队 λ: ${prediction.awayLambda}`);
console.log(`  主胜: ${(prediction.homeWinProb * 100).toFixed(1)}%`);
console.log(`  平局: ${(prediction.drawProb * 100).toFixed(1)}%`);
console.log(`  客胜: ${(prediction.awayWinProb * 100).toFixed(1)}%`);
console.log(`  最可能比分: ${prediction.likelyScore} (${(prediction.likelyScoreProb * 100).toFixed(1)}%)`);
console.log('  Top 5 比分:');
prediction.topScores.forEach(s => {
  console.log(`    ${s.score}: ${(s.prob * 100).toFixed(1)}%`);
});

// 4. 势均力敌比赛
console.log('\n📊 Argentina (atk=1.1, def=0.9) vs France (atk=1.1, def=0.9):');
const even = model.predictMatch(
  { attack_strength: 1.1, defense_strength: 0.9 },
  { attack_strength: 1.1, defense_strength: 0.9 }
);
console.log(`  主胜: ${(even.homeWinProb * 100).toFixed(1)}%`);
console.log(`  平局: ${(even.drawProb * 100).toFixed(1)}%`);
console.log(`  客胜: ${(even.awayWinProb * 100).toFixed(1)}%`);
console.log(`  最可能比分: ${even.likelyScore}`);

// 5. 历史数据训练测试
console.log('\n📊 历史数据训练测试:');
const mockMatches = [
  { home_team: 'Brazil', away_team: 'Germany', home_score: 3, away_score: 1 },
  { home_team: 'Brazil', away_team: 'Argentina', home_score: 2, away_score: 2 },
  { home_team: 'Brazil', away_team: 'France', home_score: 1, away_score: 0 },
  { home_team: 'Germany', away_team: 'Brazil', home_score: 2, away_score: 1 },
  { home_team: 'Germany', away_team: 'Argentina', home_score: 1, away_score: 3 },
  { home_team: 'Argentina', away_team: 'France', home_score: 2, away_score: 1 },
  { home_team: 'Argentina', away_team: 'Brazil', home_score: 0, away_score: 1 },
  { home_team: 'France', away_team: 'Brazil', home_score: 2, away_score: 0 },
  { home_team: 'France', away_team: 'Germany', home_score: 1, away_score: 1 },
  { home_team: 'France', away_team: 'Argentina', home_score: 3, away_score: 2 },
];
const strengths = model.trainFromMatches(mockMatches);
console.log(`  全局场均进球: ${model.globalAvgGoals.toFixed(2)}`);
for (const [team, s] of Object.entries(strengths)) {
  console.log(`  ${team}: 攻=${s.attack_strength}, 守=${s.defense_strength}, 场均进=${s.avgGoalsFor}, 场均失=${s.avgGoalsAgainst}`);
}

console.log('\n✅ Poisson 测试完成!');
