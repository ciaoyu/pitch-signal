#!/usr/bin/env node
'use strict';
/**
 * lib/team_resolver.js 测试
 * 覆盖：levenshtein, resolve (精确匹配), getRatingsIdByEspnId, getAllTeams, resolveMatch
 */
const assert = require('assert');
const resolver = require('../lib/team_resolver');

let passed = 0, failed = 0;
function check(cond, label) {
  try { assert(cond); console.log(`  ✅ ${label}`); passed++; }
  catch (e) { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== Team Resolver Tests ===\n');

// ── Levenshtein distance (pure function) ──
console.log('📊 levenshtein():');
check(resolver.levenshtein('kitten', 'sitting') === 3, 'kitten → sitting = 3');
check(resolver.levenshtein('abc', 'abc') === 0, 'Identical strings = 0');
check(resolver.levenshtein('', 'abc') === 3, 'Empty vs "abc" = 3');
check(resolver.levenshtein('abc', '') === 3, '"abc" vs empty = 3');
check(resolver.levenshtein('', '') === 0, 'Both empty = 0');
check(resolver.levenshtein('brazil', 'Brazil') === 1, 'Case difference: brazil vs Brazil = 1');
check(resolver.levenshtein('Germany', 'Germanyy') === 1, 'One extra char = 1');
check(resolver.levenshtein('abcd', 'dcba') === 4, 'Reverse string → distance > 1');

// ── Initialize ──
console.log('\n📊 init() + getAllTeams():');
resolver.init();
check(resolver.initialized, 'Resolver is initialized');
const allTeams = resolver.getAllTeams();
check(Array.isArray(allTeams), 'getAllTeams returns array');
check(allTeams.length >= 32, `At least 32 teams (got ${allTeams.length})`);
const teamWithBoth = allTeams.find(t => t.ratings_id && t.espn_id);
check(teamWithBoth != null, 'At least one team has both ratings_id and espn_id');

// ── getRatingsIdByEspnId ──
console.log('\n📊 getRatingsIdByEspnId():');
// Use Saudi Arabia (known: espn_id=655, ratings_id="Saudi Arabia")
const saRatingsId = resolver.getRatingsIdByEspnId('655');
check(saRatingsId === 'Saudi Arabia', `ESPN 655 → ratings_id "Saudi Arabia" (got "${saRatingsId}")`);
check(resolver.getRatingsIdByEspnId('nonexistent') === null, 'Nonexistent espn_id → null');

// ── getEspnIdByRatingsId ──
console.log('\n📊 getEspnIdByRatingsId():');
const saEspnId = resolver.getEspnIdByRatingsId('Saudi Arabia');
check(saEspnId === '655', `ratings_id "Saudi Arabia" → ESPN 655 (got "${saEspnId}")`);
check(resolver.getEspnIdByRatingsId('Atlantis') === null, 'Nonexistent ratings_id → null');

// ── resolve (exact match paths) ──
console.log('\n📊 resolve():');

// By ESPN id
const r1 = resolver.resolve('655');
check(r1 != null, 'ESPN id "655" resolves');
check(r1.ratings_id === 'Saudi Arabia', 'ESPN 655 → Saudi Arabia');
check(r1.matchedBy === 'espn_id', 'matchedBy=espn_id (via reverse map)');

// By ratings_id directly
const r2 = resolver.resolve('Saudi Arabia');
check(r2 != null, 'ratings_id "Saudi Arabia" resolves');
check(r2.confidence === 1.0, 'Exact match → confidence=1.0');

// By zh_name
const r3 = resolver.resolve('沙特阿拉伯');
check(r3 != null, 'zh_name "沙特阿拉伯" resolves');
check(r3.ratings_id === 'Saudi Arabia', 'zh_name → Saudi Arabia');
check(r3.matchedBy === 'zh_name', 'matchedBy=zh_name');

// By alias
const r4 = resolver.resolve('KSA');
check(r4 != null, 'Alias "KSA" resolves');
check(r4.ratings_id === 'Saudi Arabia', 'Alias KSA → Saudi Arabia');
check(r4.matchedBy === 'alias', 'matchedBy=alias');

// Fuzzy — close misspelling
const r5 = resolver.resolve('Saudi Arabi');
check(r5 != null, 'Fuzzy "Saudi Arabi" resolves (missing "a")');
check(r5.matchedBy === 'fuzzy', 'matchedBy=fuzzy');
check(r5.confidence >= 0.6 && r5.confidence < 1.0, 'Fuzzy confidence is in [0.6, 1.0)');

// Partial match
const r6 = resolver.resolve('Saudi');
check(r6 != null, 'Partial "Saudi" resolves');
check(r6.ratings_id === 'Saudi Arabia', 'Partial → Saudi Arabia');

// Null input
check(resolver.resolve(null) === null, 'null → null');
check(resolver.resolve('') === null, 'Empty string → null');

// ── resolveMatch ──
console.log('\n📊 resolveMatch():');
const m1 = resolver.resolveMatch('655', 'Germany');
check(m1.bothResolved, 'resolveMatch(Saudi Arabia ESPN, Germany) → bothResolved');
check(m1.home.ratings_id === 'Saudi Arabia', 'Home resolved to Saudi Arabia');
check(m1.confidence >= 0.6, 'Both resolved → confidence >= 0.6');

const m2 = resolver.resolveMatch('Atlantis', 'Germany');
check(!m2.bothResolved, 'resolveMatch(Atlantis, Germany) → not bothResolved');
check(m2.home === null, 'Unknown home → null');
check(m2.confidence === 0, 'Partial resolve → confidence=0');

// ── getAllTeams (data integrity) ──
console.log('\n📊 getAllTeams() data integrity:');
const teams = resolver.getAllTeams();
const uniqueRatingsIds = new Set(teams.map(t => t.ratings_id));
check(uniqueRatingsIds.size === teams.length, 'All ratings_ids are unique');
const teamsWithEspn = teams.filter(t => t.espn_id).length;
check(teamsWithEspn >= 20, `At least 20 teams have espn_id (got ${teamsWithEspn})`);
const teamsWithZh = teams.filter(t => t.zh_name).length;
check(teamsWithZh >= 20, `At least 20 teams have zh_name (got ${teamsWithZh})`);

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
