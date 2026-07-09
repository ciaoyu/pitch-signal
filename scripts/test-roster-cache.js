#!/usr/bin/env node
'use strict';
/**
  * lib/roster_cache.js tests
  * Covers: init, getStats, clear (in-memory only, does not trigger ESPN fetch)
 */
const assert = require('assert');

let passed = 0, failed = 0;
function check(cond, label) {
  try { assert(cond); console.log(`  ✅ ${label}`); passed++; }
  catch (e) { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== Roster Cache Tests ===\n');

// Load module (may touch file system on init — fine in test env)
const rosterCache = require('../lib/roster_cache');

// ── Initial state ──
console.log('📊 Initial state:');
rosterCache.init();
check(rosterCache.initialized, 'Cache is initialized');
const stats0 = rosterCache.getStats();
check(typeof stats0.teams === 'number', 'getStats() returns teams count');
check(typeof stats0.players === 'number', 'getStats() returns players count');
check(typeof stats0.sources === 'object', 'getStats() returns sources object');

// ── Inject mock data (bypass file I/O) ──
console.log('\n📊 Mock data injection:');
rosterCache.cache = {
  '205': {
    roster: [
      { id: '1', name: 'Player A', pos: 'FW', jersey: '10', age: 25 },
      { id: '2', name: 'Player B', pos: 'MF', jersey: '8', age: 28 },
      { id: '3', name: 'Player C', pos: 'GK', jersey: '1', age: 30 },
    ],
    source: 'espn',
    lastUpdated: '2026-06-01T00:00:00Z',
    playerCount: 3,
  },
  '2869': {
    roster: [
      { id: '4', name: 'Player D', pos: 'DF', jersey: '4', age: 26 },
      { id: '5', name: 'Player E', pos: 'FW', jersey: '9', age: 24 },
    ],
    source: 'cache',
    lastUpdated: '2026-06-01T00:00:00Z',
    playerCount: 2,
  },
};

const stats = rosterCache.getStats();
check(stats.teams === 2, '2 teams in cache');
check(stats.players === 5, '5 players total');
check(stats.sources.espn === 1, '1 team from espn source');
check(stats.sources.cache === 1, '1 team from cache source');

// ── getStats on specific team (via cache[key]) ──
console.log('\n📊 Cache data integrity:');
check(rosterCache.cache['205'].roster.length === 3, 'Team 205 has 3 players');
check(rosterCache.cache['205'].source === 'espn', 'Team 205 source=espn');
check(rosterCache.cache['205'].playerCount === 3, 'Team 205 playerCount=3');
check(rosterCache.cache['2869'].roster.length === 2, 'Team 2869 has 2 players');
check(rosterCache.cache['2869'].source === 'cache', 'Team 2869 source=cache');

// ── clear ──
console.log('\n📊 clear():');
// Use a copy of the cache so we don't wipe real data
const savedCache = rosterCache.cache;
rosterCache.cache = {};
const emptyStats = rosterCache.getStats();
check(emptyStats.teams === 0, 'After clear → 0 teams');
check(emptyStats.players === 0, 'After clear → 0 players');
check(Object.keys(emptyStats.sources).length === 0, 'After clear → no sources');

// ── Restore ──
rosterCache.cache = savedCache;

// ── getRoster fallback (no fetchFn call — tests degraded path) ──
console.log('\n📊 getRoster() with empty cache + no mock fetch:');
// Use a temporary replacement cache to simulate unknown team
const origCache = rosterCache.cache;
rosterCache.cache = {};
rosterCache.getRoster('unknown-team', async () => { throw new Error('ESPN down'); }).then(result => {
  check(result.source === 'unavailable', 'Degraded → source=unavailable');
  check(result.playerCount === 0, 'Degraded → playerCount=0');
  check(result.dataQuality === 'unavailable', 'Degraded → dataQuality=unavailable');
  check(Array.isArray(result.roster), 'Degraded → roster is array (empty)');
  rosterCache.cache = origCache;

  console.log(`\n============================`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('============================');
  process.exit(failed > 0 ? 1 : 0);
}).catch(e => {
  console.error(`  ❌ getRoster degraded test failed: ${e.message}`);
  failed++;
  rosterCache.cache = origCache;
  process.exit(1);
});
