#!/usr/bin/env node
/**
 * KO-8a: penalty shootout round-by-round spike analysis tests
 */

const { analyzeShootout, shootoutWinProbability, kickSuccessRate } = require('../lib/services/penalty-shootout');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== KO-8a penalty shootout analysis test ===\n');

// ---- 1. Helpers ----
console.log('📊 helpers');
{
  check(kickSuccessRate('home', { successRate: 0.8 }) === 0.8, 'custom success rate');
  check(kickSuccessRate('home', { successRates: { home: 0.7 } }) === 0.7, 'per-side success rate');
  check(kickSuccessRate('home', {}) === 0.75, 'default success rate');
}

// ---- 2. Empty shootout ----
console.log('\n📊 empty shootout');
{
  const res = analyzeShootout([]);
  check(Math.abs(res.homeWin - 0.5) < 0.001, 'empty shootout homeWin ~ 0.5');
  check(Math.abs(res.awayWin - 0.5) < 0.001, 'empty shootout awayWin ~ 0.5');
  check(res.currentScore.home === 0 && res.currentScore.away === 0, 'score 0-0');
  check(res.roundHistory.length === 0, 'no round history');
  check(res.suddenDeath === false, 'not sudden death');
}

// ---- 3. Home scores first kick ----
console.log('\n📊 home scores first kick');
{
  const res = analyzeShootout([{ side: 'home', result: 'scored' }]);
  check(res.currentScore.home === 1 && res.currentScore.away === 0, 'score 1-0');
  check(res.homeWin > 0.5, 'home favored after scoring first');
  check(res.roundHistory.length === 1, 'one round in history');
  check(res.roundHistory[0].spike.home > 0, 'positive home spike');
  check(res.roundHistory[0].spike.away < 0, 'negative away spike');
}

// ---- 4. Away misses first kick (home still 0) ----
console.log('\n📊 away misses first kick');
{
  const res = analyzeShootout([
    { side: 'home', result: 'scored' },
    { side: 'away', result: 'missed' },
  ]);
  check(res.currentScore.home === 1 && res.currentScore.away === 0, 'score 1-0');
  check(res.homeWin > 0.6, 'home strongly favored after 1-0 round');
  check(res.roundHistory.length === 1, 'one completed round');
  check(res.roundHistory[0].events.length === 2, 'two events in round 1');
}

// ---- 5. Completed shootout 5-4 ----
console.log('\n📊 completed shootout 5-4');
{
  const kicks = [
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' }, // 1-1
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' }, // 2-2
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' }, // 3-3
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' }, // 4-4
    { side: 'home', result: 'scored' }, { side: 'away', result: 'missed' }, // 5-4
  ];
  const res = analyzeShootout(kicks);
  check(res.currentScore.home === 5 && res.currentScore.away === 4, 'score 5-4');
  check(res.homeWin === 1, 'home wins = 1');
  check(res.awayWin === 0, 'away wins = 0');
  check(res.roundHistory.length === 5, 'five rounds');
  check(res.roundHistory[4].spike.home > 0, 'clinching spike for home');
}

// ---- 6. Sudden death ----
console.log('\n📊 sudden death');
{
  const kicks = [
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' },
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' },
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' },
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' },
    { side: 'home', result: 'missed' }, { side: 'away', result: 'missed' }, // 4-4 after 5
    { side: 'home', result: 'scored' }, // sudden death, home scores
  ];
  const res = analyzeShootout(kicks);
  check(res.currentScore.home === 5 && res.currentScore.away === 4, 'sudden-death score 5-4');
  check(res.suddenDeath === true, 'in sudden death');
  check(res.nextTaker === 'away', 'away must kick next to stay alive');
  check(res.homeWin > 0.5, 'home favored after sudden-death score');
}

// ---- 7. Round-by-round spike magnitude decreases after equal rounds ----
console.log('\n📊 spike magnitude after equal rounds');
{
  const kicks = [
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' },
    { side: 'home', result: 'scored' }, { side: 'away', result: 'scored' },
  ];
  const res = analyzeShootout(kicks);
  check(res.roundHistory.length === 2, 'two rounds');
  check(Math.abs(res.roundHistory[0].spike.home) < 0.001, 'round 1 equal => no net spike');
  check(Math.abs(res.roundHistory[1].spike.home) < 0.001, 'round 2 equal => no net spike');
  check(Math.abs(res.homeWin - 0.5) < 0.001, 'score still tied => 50/50');
}

// ---- 8. shootoutWinProbability base cases ----
console.log('\n📊 shootoutWinProbability base cases');
{
  // Home has already won: 3-0 with 0 away kicks remaining
  check(shootoutWinProbability(3, 0, 0, 0, 'home') === 1, 'home already won');
  // Away has already won
  check(shootoutWinProbability(0, 3, 0, 0, 'home') === 0, 'away already won');
  // Tied after regulation -> sudden death still ~50/50
  const prob = shootoutWinProbability(4, 4, 0, 0, 'home');
  check(Math.abs(prob - 0.5) < 0.001, 'tied after regulation -> 50/50');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
