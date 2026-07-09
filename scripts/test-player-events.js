#!/usr/bin/env node
/**
 * KO-4: player-event extraction + classification unit tests
 *
 * Verifies lib/services/player-events.js:
 *   - classifyPlayerEventType maps ESPN keyEvent text -> our event_type
 *   - SECOND-YELLOW sending-off is detected even though ESPN reports it as a
 *     "Yellow Card" type with text "Second Yellow Card"
 *   - parseClock handles base minute + added time ("45'+2'")
 *   - extractPlayerEvents returns goal/assist/yellow/red/secondyellow and
 *     SKIPS substitutions
 */

const { classifyPlayerEventType, parseClock, extractPlayerEvents } = require('../lib/services/player-events');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== KO-4 player-event extraction test ===\n');

// ---- classification ----
console.log('📊 classifyPlayerEventType');
check(classifyPlayerEventType('Goal', 'Goal') === 'goal', 'Goal -> goal');
check(classifyPlayerEventType('Assist', 'Assist') === 'assist', 'Assist -> assist');
check(classifyPlayerEventType('Yellow Card', 'Yellow Card') === 'yellow', 'Yellow Card -> yellow');
check(classifyPlayerEventType('Red Card', 'Red Card') === 'red', 'Red Card -> red');
check(classifyPlayerEventType('Yellow Card', 'Second Yellow Card') === 'secondyellow',
  'Second Yellow Card (type=Yellow) -> secondyellow');
check(classifyPlayerEventType('Red Card', 'Second Yellow Card') === 'secondyellow',
  'Second Yellow Card (type=Red) -> secondyellow');
check(classifyPlayerEventType('Substitution', 'Substitution') === null, 'Substitution -> null (skip)');
check(classifyPlayerEventType('Shot On Target', 'x') === null, 'irrelevant event -> null');

// ---- clock ----
console.log('\n📊 parseClock');
{
  const a = parseClock("23'");
  check(a.minute === 23 && a.minuteAdded === 0, "23' -> {23,0}");
  const b = parseClock("45'+2'");
  check(b.minute === 45 && b.minuteAdded === 2, "45'+2' -> {45,2}");
  const c = parseClock("90'+5'");
  check(c.minute === 90 && c.minuteAdded === 5, "90'+5' -> {90,5}");
  const d = parseClock('');
  check(d.minute === 0 && d.minuteAdded === 0, "empty -> {0,0}");
}

// ---- end-to-end extraction ----
console.log('\n📊 extractPlayerEvents');
{
  const keyEvents = [
    { type: { text: 'Goal' }, clock: { displayValue: "23'" }, team: { id: '203' },
      participants: [{ athlete: { displayName: 'Lionel Messi', id: '302' } }], text: 'Goal' },
    { type: { text: 'Assist' }, clock: { displayValue: "23'" }, team: { id: '203' },
      participants: [{ athlete: { displayName: 'Julian Alvarez', id: '310' } }], text: 'Assist' },
    { type: { text: 'Yellow Card' }, clock: { displayValue: "45'+2'" }, team: { id: '203' },
      participants: [{ athlete: { displayName: 'Rodri', id: '450' } }], text: 'Yellow Card' },
    { type: { text: 'Red Card' }, clock: { displayValue: "67'" }, team: { id: '88' },
      participants: [{ athlete: { displayName: 'Cristian Romero', id: '512' } }], text: 'Red Card' },
    { type: { text: 'Yellow Card' }, clock: { displayValue: "70'" }, team: { id: '88' },
      participants: [{ athlete: { displayName: 'Cristian Romero', id: '512' } }], text: 'Second Yellow Card' },
    { type: { text: 'Substitution' }, clock: { displayValue: "80'" }, team: { id: '203' },
      participants: [{ athlete: { displayName: 'Sub Player', id: '999' } }], text: 'Substitution' },
    { type: { text: 'Goal' }, clock: { displayValue: "90'+5'" }, team: { id: '88' },
      participants: [{ athlete: { displayName: 'Kylian Mbappe', id: '180' } }], text: 'Goal' },
  ];
  const meta = { homeTeamId: '203', awayTeamId: '88', stage: 'group', round: 'Group' };
  const events = extractPlayerEvents('760415', keyEvents, meta);

  check(events.length === 6, `extracts 6 player events, skips the sub (got ${events.length})`);
  const byName = Object.fromEntries(events.map(e => [e.player_name, e]));

  check(byName['Lionel Messi'].event_type === 'goal' && byName['Lionel Messi'].team_id === '203',
    'Messi goal attributed to home');
  check(byName['Lionel Messi'].minute === 23, 'Messi minute 23');
  check(byName['Julian Alvarez'].event_type === 'assist', 'Alvarez assist');
  check(byName['Rodri'].event_type === 'yellow' && byName['Rodri'].minute === 45 && byName['Rodri'].minute_added === 2,
    'Rodri yellow 45+2');
  check(byName['Cristian Romero'].event_type === 'secondyellow',
    'Romero second-yellow detected (type=Yellow Card)');
  check(byName['Kylian Mbappe'].minute === 90 && byName['Kylian Mbappe'].minute_added === 5,
    'Mbappe goal 90+5');
  check(!events.some(e => e.player_name === 'Sub Player'), 'substitution skipped');
  check(events.every(e => e.match_id === '760415' && e.stage === 'group' && e.round === 'Group'),
    'all events carry match_id/stage/round metadata');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
