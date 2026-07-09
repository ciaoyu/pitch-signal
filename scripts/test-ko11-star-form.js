const assert = require('assert');
const { db } = require('../lib/db');
const { buildStarFormSection } = require('../lib/services/star-form');
const { buildKnockoutIntel } = require('../lib/services/knockout-intel');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('=== KO-11: Star Form Index Test Suite ===');

test('1. returns null when player_match_events table has no matches for teamId (downgrades gracefully)', () => {
  const res = buildStarFormSection({ homeTeamId: '999999', awayTeamId: '888888' });
  assert.strictEqual(res, null, 'Should return null gracefully when no events exist');
});

test('2. computes top star form with trend up/normal/down and caps at 3 players per team using authoritative KO-4 schema', () => {
  const stmt = db.prepare('INSERT INTO player_match_events (match_id, team_id, player_name, event_type, minute) VALUES (?, ?, ?, ?, ?)');
  const insertedIds = [];

  try {
    // Insert 3 recent goals + 1 assist for Kylian Mbappé (France team_id = '4441') across matches 1001, 1002, 1003
    insertedIds.push(stmt.run('1003', '4441', 'Kylian Mbappé', 'goal', 10).lastInsertRowid);
    insertedIds.push(stmt.run('1002', '4441', 'Kylian Mbappé', 'goal', 20).lastInsertRowid);
    insertedIds.push(stmt.run('1001', '4441', 'Kylian Mbappé', 'goal', 30).lastInsertRowid);
    insertedIds.push(stmt.run('1001', '4441', 'Kylian Mbappé', 'assist', 40).lastInsertRowid);

    // Insert 1 goal for Antoine Griezmann
    insertedIds.push(stmt.run('1002', '4441', 'Antoine Griezmann', 'goal', 15).lastInsertRowid);

    const res = buildStarFormSection({ homeTeamId: '4441', awayTeamId: '9999' });
    assert.ok(res, 'Should return starForm section');
    assert.strictEqual(res.confidence, 'medium');
    assert.strictEqual(res.source, 'player-match-events');
    assert.strictEqual(res.usedInModel, false);

    assert.ok(res.home.length > 0 && res.home.length <= 3);
    const mbappe = res.home.find(p => p.player === 'Kylian Mbappé');
    assert.ok(mbappe);
    assert.strictEqual(mbappe.last3GA, 4);
    assert.strictEqual(mbappe.trend, 'up');
    if (mbappe.playerZh) {
      assert.strictEqual(typeof mbappe.playerZh, 'string');
    }
  } finally {
    if (insertedIds.length > 0) {
      const del = db.prepare('DELETE FROM player_match_events WHERE id = ?');
      insertedIds.forEach(id => del.run(id));
    }
  }
});

test('3. buildKnockoutIntel includes starForm section in sections map', () => {
  const stmt = db.prepare('INSERT INTO player_match_events (match_id, team_id, player_name, event_type, minute) VALUES (?, ?, ?, ?, ?)');
  const insertedIds = [];

  try {
    insertedIds.push(stmt.run('2001', '4442', 'Harry Kane', 'goal', 50).lastInsertRowid);
    const intel = buildKnockoutIntel({
      matchId: '2005',
      homeTeamId: '4442',
      awayTeamId: '4443',
      stage: 'QF'
    });
    assert.ok(intel.sections.starForm, 'Should include starForm section');
    assert.strictEqual(intel.sections.starForm.home[0].player, 'Harry Kane');
  } finally {
    if (insertedIds.length > 0) {
      const del = db.prepare('DELETE FROM player_match_events WHERE id = ?');
      insertedIds.forEach(id => del.run(id));
    }
  }
});

console.log('All KO-11 tests passed!');
