#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { db } = require('../lib/db');
const {
  linearSlope,
  computeSubstitutionImpact,
  updateSubstitutionImpacts,
  getSubstitutionImpacts,
} = require('../lib/services/substitution-impact');

let passed = 0;

function check(description, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${description}`);
}

const sufficientRows = [
  { minute: 50, pressure_home: 20, pressure_away: 55 },
  { minute: 55, pressure_home: 25, pressure_away: 50 },
  { minute: 60, pressure_home: 30, pressure_away: 45 },
  { minute: 65, pressure_home: 40, pressure_away: 42 },
  { minute: 70, pressure_home: 50, pressure_away: 39 },
];

check('linear regression computes pressure points per minute', () => {
  assert.strictEqual(linearSlope(sufficientRows.slice(0, 3), 'pressure_home'), 1);
});

check('sufficient before/after samples produce a positive impact', () => {
  const result = computeSubstitutionImpact(sufficientRows, 60, 70);
  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(result.home.beforeSnapshots, 3);
  assert.strictEqual(result.home.afterSnapshots, 3);
  assert.strictEqual(result.home.beforeSlope, 1);
  assert.strictEqual(result.home.afterSlope, 2);
  assert.strictEqual(result.home.slopeDelta, 1);
  assert.strictEqual(result.home.direction, 'positive');
});

check('an incomplete post-substitution window stays pending', () => {
  const result = computeSubstitutionImpact(sufficientRows, 60, 66);
  assert.strictEqual(result.status, 'pending');
  assert.strictEqual(result.home, undefined);
});

check('fewer than three snapshots is explicitly insufficient', () => {
  const rows = [sufficientRows[0], sufficientRows[2], sufficientRows[4]];
  const result = computeSubstitutionImpact(rows, 60, 70);
  assert.strictEqual(result.status, 'insufficient_data');
  assert.strictEqual(result.home.status, 'insufficient_data');
  assert.strictEqual(result.home.direction, null);
});

check('database update preserves raw player fields and stores impact', () => {
  const matchId = `sub_impact_test_${process.pid}`;
  try {
    db.prepare(`
      INSERT INTO match_moments
        (match_id, type, minute, minute_added, team_id, importance, source,
         score_state_json, raw_json, detected_at)
      VALUES (?, 'substitution_key', 60, 0, 'home', 70, 'test', '{}', ?, ?)
    `).run(matchId, JSON.stringify({ playerIn: 'Impact Player', playerOut: 'Starter' }), new Date().toISOString());

    const insertStat = db.prepare(`
      INSERT INTO match_live_stats
        (match_id, minute, pressure_home, pressure_away, captured_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const row of sufficientRows) {
      insertStat.run(matchId, row.minute, row.pressure_home, row.pressure_away, new Date().toISOString());
    }

    assert.strictEqual(updateSubstitutionImpacts(matchId, 70), 1);
    const [stored] = getSubstitutionImpacts(matchId);
    assert.strictEqual(stored.playerIn, 'Impact Player');
    assert.strictEqual(stored.playerOut, 'Starter');
    assert.strictEqual(stored.impact.home.direction, 'positive');
  } finally {
    db.prepare('DELETE FROM match_live_stats WHERE match_id = ?').run(matchId);
    db.prepare('DELETE FROM match_moments WHERE match_id = ?').run(matchId);
  }
});

console.log(`${passed} passed, 0 failed`);
