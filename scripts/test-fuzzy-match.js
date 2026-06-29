#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  levenshteinDistance,
  calculateMatchScore,
  fuzzyMatchPlayer,
  derivePlayerRating,
  mapId
} = require('../lib/fuzzy-match');

let passed = 0, failed = 0;
function check(cond, label) {
  try {
    assert(cond);
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('=== Fuzzy Match Tests ===\n');

console.log('📊 Levenshtein Distance:');
check(levenshteinDistance('kitten', 'sitting') === 3, 'kitten -> sitting = 3');
check(levenshteinDistance('flitten', 'flitten') === 0, 'exact match = 0');
check(levenshteinDistance('a', '') === 1, 'empty string');
check(levenshteinDistance('Vinicius', 'Vini') === 4, 'Vinicius -> Vini = 4');

console.log('\n📊 Calculate Match Score:');
const s1 = { name: 'Lionel Messi', num: 10, pos: 'RW' };
const t1 = { name: 'Lionel Messi', num: 10, pos: 'RW' };
check(calculateMatchScore(s1, t1) === 1.0, 'Exact match = 1.0');

const s2 = { name: 'Vinicius Junior', num: 7, pos: 'LW' };
const t2 = { name: 'Vini Jr', num: 7, pos: 'LW' };
// Name len: 15. Dist(vinicius junior, vini jr) -> v i n i c i u s   j u n i o r
// v i n i   j r -> 8 edits.
const score2 = calculateMatchScore(s2, t2);
check(score2 > 0.5 && score2 < 1.0, 'Partial name match');

const s3 = { name: 'Neymar', num: 10, pos: 'CAM' };
const t3 = { name: 'Neymar', num: 11, pos: 'LW' }; // wrong num, wrong pos
check(calculateMatchScore(s3, t3) === 0.5, 'Only name matches perfectly = 0.5');

console.log('\n📊 Fuzzy Match Player:');
const squad = [
  { name: 'Alisson Becker', num: 1, pos: 'GK' },
  { name: 'Eder Militao', num: 3, pos: 'CB' },
  { name: 'Vinicius Junior', num: 7, pos: 'LW' },
  { name: 'Richarlison', num: 9, pos: 'ST' }
];

const bestMatch1 = fuzzyMatchPlayer({ name: 'Vinicius Jr', num: 7, pos: 'LW' }, squad, 0.75);
check(bestMatch1 && bestMatch1.name === 'Vinicius Junior', 'Matches Vinicius with Vinicius Jr');

const bestMatch2 = fuzzyMatchPlayer({ name: 'Pele', num: 10, pos: 'CAM' }, squad, 0.75);
check(bestMatch2 === null, 'No match for Pele');

console.log('\n📊 Derive Player Rating:');
check(derivePlayerRating(50, 15, 1) === 99, 'Max stats gives 99 (Elite club, 50 caps, 15 wcApps)');
check(derivePlayerRating(0, 0, 3) === 60, 'Min stats gives 60');
check(derivePlayerRating(25, 5, 2) === 78, 'Mid tier: 60 + 10(tier2) + 5(caps) + 3(wc) = 78');

console.log('\n📊 Map ID:');
const bridge = { 'ext-123': 'int-abc' };
check(mapId('ext-123', bridge) === 'int-abc', 'Maps existing ID');
check(mapId('ext-456', bridge) === 'ext-456', 'Returns original if missing');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
