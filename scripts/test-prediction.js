#!/usr/bin/env node
/**
 * 预测融合引擎测试 - v4
 * 使用真实 ratings.json（从 2018+2022 历史数据生成的 Elo）
 */
const PredictionEngine = require('../lib/prediction');
let QualificationSimulator = null;
try {
  QualificationSimulator = require('../lib/qualification');
} catch (e) {
  if (e.message && (e.message.includes('NODE_MODULE_VERSION') || e.message.includes('better_sqlite3') || e.message.includes('better-sqlite3'))) {
    // DB unavailable
  } else {
    throw e;
  }
}

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

const engine = new PredictionEngine();
const ratings = require('../data/ratings.json').teams;

// PRECHECK: ratings must be loaded
assert(Object.keys(ratings).length >= 40, `Ratings loaded: ${Object.keys(ratings).length} teams`);

console.log('=== 预测融合引擎测试 (v4) ===\n');

// ========== 1. 真实比赛预测 ==========
console.log('📊 Test 1: Australia vs Türkiye');
const aus = ratings['Australia'];
const tur = ratings['Türkiye'];
assert(aus && tur, 'Both teams found in ratings');
const pred1 = engine.predict({
  homeId: 'Australia', awayId: 'Türkiye',
  homeRating: aus, awayRating: tur,
});
assert(pred1 && typeof pred1 === 'object', 'Prediction result is object');
assert(typeof pred1.homeWin === 'number', 'homeWin is number');
assert(typeof pred1.draw === 'number', 'draw is number');
assert(typeof pred1.awayWin === 'number', 'awayWin is number');
assertNear(pred1.homeWin + pred1.draw + pred1.awayWin, 1, 0.01, 'Probabilities sum to ~1');
assert(typeof pred1.likelyScore === 'string', 'likelyScore is string');
assert(pred1.goals && typeof pred1.goals.homeExpected === 'number', 'homeExpected goals is number');
assert(pred1.goals && typeof pred1.goals.awayExpected === 'number', 'awayExpected goals is number');
assert(pred1.components && typeof pred1.components === 'object', 'components object exists');
assert(typeof pred1.components.poisson === 'object', 'poisson component exists');

// ========== 2. 强队 vs 弱队 ==========
console.log('\n📊 Test 2: Germany vs Haiti');
const ger = ratings['Germany'];
const hai = ratings['Haiti'];
assert(ger && hai, 'Both teams found');
const pred2 = engine.predict({
  homeId: 'Germany', awayId: 'Haiti',
  homeRating: ger, awayRating: hai,
});
assert(pred2.homeWin > pred2.awayWin, 'Stronger team has higher win probability');
assert(pred2.homeWin > 0.5, 'Germany strong favorite (homeWin > 50%)');
assert(pred2.awayWin < 0.3, 'Haiti heavy underdog (awayWin < 30%)');

// ========== 3. 势均力敌 ==========
console.log('\n📊 Test 3: Switzerland vs Sweden (势均力敌)');
const swi = ratings['Switzerland'];
const swe = ratings['Sweden'];
assert(swi && swe, 'Both teams found');
const pred3 = engine.predict({
  homeId: 'Switzerland', awayId: 'Sweden',
  homeRating: swi, awayRating: swe,
});
const maxDiff = Math.max(pred3.homeWin, pred3.draw, pred3.awayWin) - Math.min(pred3.homeWin, pred3.draw, pred3.awayWin);
assert(maxDiff < 0.5, 'Balanced match: probabilities within 0.5 range');

// ========== 4. Elo 引导效果 ==========
console.log('\n📊 Test 4: Elo 引导效果');
assert(pred1.components.poisson.valid !== undefined, 'Poisson valid flag exists');

// ========== 5. 出线模拟 (requires DB) ==========
console.log('\n📊 Test 5: 小组出线模拟');
let dbAvailable = false;
try {
  // require db to test whether the native module loads
  require('../lib/db').db;
  dbAvailable = true;
} catch (e) {
  if (e.message && (e.message.includes('NODE_MODULE_VERSION') || e.message.includes('better_sqlite3') || e.message.includes('better-sqlite3'))) {
    // expected: better-sqlite3 native binding mismatch
  } else {
    throw e;
  }
}

if (dbAvailable && QualificationSimulator) {
  const qs = new QualificationSimulator({ simulations: 1000, predictionEngine: engine });
  let groups = qs.loadGroupsFromDB();

  if (groups.length === 0) {
    console.log('  ℹ️  DB loaded but returned 0 groups. Injecting a fixed fixture group.');
    groups = [{
      name: 'Group Test',
      teams: [
        { id: 'Australia', name: 'Australia', pts: 0, gf: 0, ga: 0, played: 0 },
        { id: 'Türkiye', name: 'Türkiye', pts: 0, gf: 0, ga: 0, played: 0 },
        { id: 'Germany', name: 'Germany', pts: 0, gf: 0, ga: 0, played: 0 },
        { id: 'Haiti', name: 'Haiti', pts: 0, gf: 0, ga: 0, played: 0 },
      ],
      matches: [
        { homeId: 'Australia', awayId: 'Türkiye', played: false },
        { homeId: 'Germany', awayId: 'Haiti', played: false },
        { homeId: 'Australia', awayId: 'Germany', played: false },
        { homeId: 'Türkiye', awayId: 'Haiti', played: false },
        { homeId: 'Haiti', awayId: 'Australia', played: false },
        { homeId: 'Türkiye', awayId: 'Germany', played: false },
      ]
    }];
  }

  assert(groups.length > 0, `Using ${groups.length} groups for simulation test`);
  const group = groups[0];
  const result = qs.simulateGroup(group);
  assert(Array.isArray(result.results), `${group.name} simulation has results array`);
  assert(result.results.length === 4, `${group.name} has 4 teams`);
  for (const r of result.results) {
    assert(r.qualifyProb >= 0 && r.qualifyProb <= 1, `${r.name} qualifyProb in [0,1]`);
  }
} else {
  console.log('  ⚠️  SKIP: Database unavailable (better-sqlite3 NODE_MODULE_VERSION mismatch)');
}

// ========== 6. Weights ==========
console.log('\n📊 Test 6: Fusion weights');
assert(pred1.weights && typeof pred1.weights === 'object', 'Weights object exists');

// ========== 7. Ratings integrity ==========
console.log('\n📊 Test 7: Ratings integrity');
const sorted = Object.entries(ratings).sort((a, b) => b[1].rating - a[1].rating);
assert(sorted.length >= 40, `${sorted.length} teams in ratings`);
assert(sorted[0][1].rating > sorted[sorted.length - 1][1].rating, 'Top rating > bottom rating (differentiation exists)');
// Check attack/defense ranges are reasonable (not all identical)
const attacks = sorted.map(([, d]) => d.attack_strength);
const defenses = sorted.map(([, d]) => d.defense_strength);
assert(Math.max(...attacks) > Math.min(...attacks), 'Attack strengths have variance');
assert(Math.max(...defenses) > Math.min(...defenses), 'Defense strengths have variance');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`Teams: ${Object.keys(ratings).length}`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
