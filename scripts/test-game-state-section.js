'use strict';

const assert = require('assert');
const { computeTeamGameStateStats, buildGameStateSection } = require('../lib/services/game-state-section');
const { db } = require('../lib/db');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(e);
    process.exit(1);
  }
}

console.log('=== KO-13: Leading/Trailing Game State Portrait Test Suite ===');

test('1. computeTeamGameStateStats returns null rates when no matches played', () => {
  const stats = computeTeamGameStateStats('nonexistent_team', db);
  assert.strictEqual(stats.matchesAnalyzed, 0);
  assert.strictEqual(stats.holdRate, null);
  assert.strictEqual(stats.recoveryRate, null);
});

test('2. computes tookLead and fellBehind correctly from goal timeline', () => {
  // Insert synthetic player events for team 991 and opponent 992
  db.prepare(`
    INSERT OR IGNORE INTO player_match_events (match_id, team_id, player_name, event_type, minute)
    VALUES ('m_gs_1', '991', 'Striker A', 'goal', 15),
           ('m_gs_1', '992', 'Opponent A', 'goal', 40),
           ('m_gs_1', '991', 'Striker B', 'goal', 85)
  `).run();

  const stats = computeTeamGameStateStats('991', db);
  assert.strictEqual(stats.matchesAnalyzed, 1);
  assert.strictEqual(stats.tookLeadMatches, 1);
  assert.strictEqual(stats.heldLeadMatches, 1); // Won 2-1 after taking lead
  assert.strictEqual(stats.holdRate, 1);
});

test('3. buildGameStateSection outputs valid portrait for home and away', () => {
  const sec = buildGameStateSection({
    matchId: 'm_gs_test',
    homeTeamId: '991',
    awayTeamId: 'nonexistent_team',
    homeName: 'Team 991',
    awayName: 'Team None',
    db,
  });

  assert.ok(sec);
  assert.strictEqual(sec.usedInModel, false);
  assert.strictEqual(sec.confidence, 'medium');
  assert.strictEqual(sec.home.tookLeadMatches, 1);
  assert.strictEqual(sec.away.matchesAnalyzed, 0);
});

console.log('All KO-13 tests passed!');
