#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { buildClubStats, buildRecentForm } = require('../lib/services/player-stat-integrity');

const emptySeason = { displayName: '2026-27 LALIGA Stats', statistics: [{ name: 'totalGoals', displayValue: '' }] };
assert.strictEqual(buildClubStats(emptySeason).dataQuality, 'unavailable', 'empty season shell is not rendered as 0 stats');

const verifiedSeason = { displayName: '2025-26 LALIGA Stats', statistics: [
  { name: 'starts-subIns', displayValue: '20 (5)' }, { name: 'totalGoals', displayValue: '18' }, { name: 'goalAssists', displayValue: '4' },
] };
const club = buildClubStats(verifiedSeason);
assert.deepStrictEqual({ apps: club.appearances, goals: club.goals, assists: club.assists }, { apps: 25, goals: 18, assists: 4 }, 'keeps explicitly sourced club totals');

assert.strictEqual(buildRecentForm({ events: { a: { stats: [] } } }).dataQuality, 'unavailable', 'fixture shells are not counted as recent appearances');
const recent = buildRecentForm({ events: { a: { date: '2026-01-02', stats: [{ name: 'minutesPlayed', value: '90' }, { name: 'totalGoals', value: '1' }, { name: 'goalAssists', value: '0' }] } } });
assert.deepStrictEqual({ matches: recent.matches, minutes: recent.minutes, goals: recent.goals }, { matches: 1, minutes: 90, goals: 1 }, 'uses only verified player minutes');
console.log('✅ player-stat integrity regression passed');
