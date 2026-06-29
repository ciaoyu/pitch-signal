#!/usr/bin/env node
/**
 * Poisson 回归模型测试
 */
const PoissonModel = require('../lib/poisson');

const model = new PoissonModel({ globalAvgGoals: 2.5, homeAdvantage: 1.2 });
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function assertNear(actual, expected, epsilon, label) {
  const ok = Math.abs(actual - expected) <= epsilon;
  if (ok) { console.log(`  ✅ ${label} (${actual.toFixed(4)})`); passed++; }
  else { console.error(`  ❌ ${label}: expected ~${expected}, got ${actual}`); failed++; }
}

function failIfNoAssert() {
  // No-op; assertions are explicit.
}

console.log('=== Poisson 回归模型测试 ===\n');

// 1. PMF 测试
console.log('📊 Poisson PMF (λ=2.5):');
assertNear(model.poissonPMF(0, 2.5), 0.0821, 0.001, 'P(X=0) ≈ 0.0821');
assertNear(model.poissonPMF(1, 2.5), 0.2052, 0.001, 'P(X=1) ≈ 0.2052');
assertNear(model.poissonPMF(2, 2.5), 0.2565, 0.001, 'P(X=2) ≈ 0.2565');

// Sum of PMF 0–5 should be close to 1 (rest is tail)
let pmfSum = 0;
for (let k = 0; k <= 10; k++) pmfSum += model.poissonPMF(k, 2.5);
assertNear(pmfSum, 1, 0.01, 'PMF sum ≈ 1');

// 2. 进球期望值
console.log('\n📊 进球期望值 λ:');
const lambdaStrong = model.calculateLambda(1.3, 1.2, true);
const lambdaWeak = model.calculateLambda(0.8, 0.7, false);
assert(lambdaStrong > 2.0, 'Strong attack vs weak defense → λ > 2');
assert(lambdaWeak < 1.5, 'Weak attack vs strong defense → λ < 1.5');
assert(lambdaStrong > lambdaWeak, 'Stronger attack → higher lambda');

// 3. 概率矩阵
console.log('\n📊 Brazil (atk=1.3, def=0.8) vs Germany (atk=1.2, def=0.9):');
const prediction = model.predictMatch(
  { attack_strength: 1.3, defense_strength: 0.8 },
  { attack_strength: 1.2, defense_strength: 0.9 }
);
assert(prediction.homeLambda > prediction.awayLambda, 'Home λ > Away λ (home advantage + stronger attack)');
assertNear(prediction.homeWinProb + prediction.drawProb + prediction.awayWinProb, 1, 0.01, 'Probabilities sum to ~1');
assert(prediction.homeWinProb > prediction.awayWinProb, 'Home team more likely to win');
assert(prediction.topScores.length >= 3, 'At least 3 top scores returned');
assert(typeof prediction.likelyScore === 'string', 'likelyScore is a string');

// 4. 势均力敌比赛
console.log('\n📊 Argentina (atk=1.1, def=0.9) vs France (atk=1.1, def=0.9):');
const even = model.predictMatch(
  { attack_strength: 1.1, defense_strength: 0.9 },
  { attack_strength: 1.1, defense_strength: 0.9 }
);
assertNear(even.homeWinProb + even.drawProb + even.awayWinProb, 1, 0.01, 'Probabilities sum to ~1');
assert(even.homeWinProb > even.awayWinProb, 'Home advantage gives edge in even match');

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
assert(Object.keys(strengths).length === 4, '4 teams trained');
assert(strengths['Brazil'].avgGoalsFor > 0, 'Brazil has positive avg goals');
assert(typeof strengths['Brazil'].attack_strength === 'number', 'Attack strength is number');
assert(typeof strengths['Brazil'].defense_strength === 'number', 'Defense strength is number');

// 6. λ单调性检查
console.log('\n📊 λ单调性检查:');
const λhiHi = model.calculateLambda(2.0, 0.5, true);
const λloLo = model.calculateLambda(0.5, 2.0, false);
const λmid = model.calculateLambda(1.0, 1.0, true);
assert(λhiHi > λloLo, 'Strong offense/weak defense yields higher λ than weak/strong');
assert(λmid > λloLo, 'Average matchup yields higher λ than worst-case');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
