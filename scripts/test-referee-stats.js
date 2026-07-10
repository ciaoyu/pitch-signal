'use strict';

const assert = require('assert');
const {
  parseSummaryOfficials,
  extractAndPersistOfficials,
  getRefereeStats,
  buildRefereeSection,
} = require('../lib/services/referee-stats');
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

console.log('=== KO-10: Referee Stats Test Suite ===');

test('1. parseSummaryOfficials extracts referee correctly', () => {
  const summary = {
    gameInfo: {
      officials: [
        { fullName: 'Szymon Marciniak', position: { name: 'Referee' } },
        { fullName: 'Tomasz Listkiewicz', position: { name: 'Assistant Referee' } },
      ],
    },
  };

  const officials = parseSummaryOfficials(summary);
  assert.strictEqual(officials.length, 2);
  assert.strictEqual(officials[0].name, 'Szymon Marciniak');
  assert.strictEqual(officials[0].role, 'Referee');
});

test('2. extractAndPersistOfficials stores officials idempotently', () => {
  const summary = {
    officials: [
      { displayName: 'Daniele Orsato', position: { name: 'Referee' } },
    ],
  };

  const count1 = extractAndPersistOfficials('m_ref_1', summary, db);
  assert.strictEqual(count1, 1);

  const count2 = extractAndPersistOfficials('m_ref_1', summary, db);
  assert.strictEqual(count2, 0, 'Second run should be idempotent');
});

test('3. getRefereeStats computes card averages across refereed matches', () => {
  // Insert second match for Daniele Orsato
  extractAndPersistOfficials('m_ref_2', {
    officials: [{ fullName: 'Daniele Orsato', role: 'Referee' }],
  }, db);

  // Insert player events for m_ref_1 (3 yellows, 1 red)
  db.prepare(`
    INSERT OR IGNORE INTO player_match_events (match_id, player_name, event_type, minute)
    VALUES ('m_ref_1', 'Player A', 'yellow', 10),
           ('m_ref_1', 'Player B', 'yellow', 30),
           ('m_ref_1', 'Player C', 'yellow', 50),
           ('m_ref_1', 'Player D', 'red', 80)
  `).run();

  // Insert player events for m_ref_2 (1 yellow)
  db.prepare(`
    INSERT OR IGNORE INTO player_match_events (match_id, player_name, event_type, minute)
    VALUES ('m_ref_2', 'Player E', 'yellow', 25)
  `).run();

  const stats = getRefereeStats('Daniele Orsato', db);
  assert.strictEqual(stats.matchesRefereed, 2);
  assert.strictEqual(stats.yellowsPerMatch, 2); // (3+1)/2 = 2.0
  assert.strictEqual(stats.redsPerMatch, 0.5);  // (1+0)/2 = 0.5
});

test('4. buildRefereeSection returns confidence and averages or gracefully absent', () => {
  const sec = buildRefereeSection({ matchId: 'm_ref_1', db });
  assert.ok(sec);
  assert.strictEqual(sec.refereeName, 'Daniele Orsato');
  assert.strictEqual(sec.confidence, 'medium');
  assert.strictEqual(sec.yellowsPerMatch, 2);
  assert.strictEqual(sec.usedInModel, false);

  const secMissing = buildRefereeSection({ matchId: 'm_nonexistent', db });
  assert.strictEqual(secMissing, null, 'Gracefully absent when no referee is assigned');
});

console.log('All KO-10 tests passed!');
