/**
 * Unit tests for lib/eventFilter.js
 * Run: node scripts/test-eventFilter.js
 */
'use strict';

const assert = require('assert');
const { filterMatchEvents } = require('../lib/eventFilter');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
  }
}

// ============================================================
// 1. Event Classification
// ============================================================
test('classifyEvent: goal from "goal" type', () => {
  const r = filterMatchEvents([{ type: 'goal', text: 'Goal!' }], {});
  assert.strictEqual(r.keyEvents.length, 1);
  assert.strictEqual(r.keyEvents[0].type, 'goal');
});

test('classifyEvent: own_goal detected', () => {
  const r = filterMatchEvents([{ type: 'own-goal', text: 'Own goal' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'own_goal');
});

test('classifyEvent: var / VAR detected', () => {
  const r = filterMatchEvents([{ type: 'var', text: 'VAR review' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'var');
});

test('classifyEvent: penalty detected', () => {
  const r = filterMatchEvents([{ type: 'penalty', text: 'Penalty kick' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'penalty');
});

test('classifyEvent: card (red card)', () => {
  const r = filterMatchEvents([{ type: 'red-card', text: 'Red card!' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'card');
});

test('classifyEvent: card with "yellow card" (space)', () => {
  const r = filterMatchEvents([{ type: 'yellow card', text: 'Yellow' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'card');
});

test('classifyEvent: card with "yellow-card" (hyphen) - ESPN format', () => {
  const r = filterMatchEvents([{ type: 'yellow-card', text: 'Yellow #1' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'card');
});

test('classifyEvent: substitution detected', () => {
  const r = filterMatchEvents([{ type: 'substitution', text: 'Sub on' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'substitution');
});

test('classifyEvent: shot detected', () => {
  const r = filterMatchEvents([{ type: 'shot', text: 'Shot on target' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'shot');
});

test('classifyEvent: "Shot on goal" is classified as shot, not goal', () => {
  const r = filterMatchEvents([{ type: 'attempt', text: 'Shot on goal' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'shot');
});

test('classifyEvent: "Missed goal" is classified as shot, not goal', () => {
  const r = filterMatchEvents([{ type: 'attempt', text: 'Missed goal' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'shot');
});

test('classifyEvent: normal Goal is classified as goal', () => {
  const r = filterMatchEvents([{ type: 'score', text: 'Goal scored by striker' }], {});
  assert.strictEqual(r.keyEvents[0].type, 'goal');
});

test('classifyEvent: unknown event skipped', () => {
  const r = filterMatchEvents([{ type: 'whistle', text: 'Blow whistle' }], {});
  assert.strictEqual(r.keyEvents.length, 0);
});

// ============================================================
// 2. Score Context & Goal Tracking
// ============================================================
test('score context tracks home goals', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Home goal', homeAway: 'home' },
    { type: 'goal', text: 'Another home', homeAway: 'home' },
  ], { homeName: 'Brazil', awayName: 'Argentina' });
  assert.strictEqual(r.keyEvents[0].gameState, '0-0');
  assert.strictEqual(r.keyEvents[1].gameState, '1-0');
});

test('score context tracks away goals', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Home scores', homeAway: 'home' },
    { type: 'goal', text: 'Away equalizer', homeAway: 'away' },
  ], { homeName: 'A', awayName: 'B' });
  assert.strictEqual(r.keyEvents[1].gameState, '1-0');
});

test('own_goal flips side for scoring', () => {
  const r = filterMatchEvents([
    { type: 'own-goal', text: 'Own goal by home defender', homeAway: 'home' },
  ], { homeName: 'H', awayName: 'A' });
  // Own goal by home team counts as away goal; away wins 1-0 with 0 shots from either
  assert.strictEqual(r.matchScript, 'control_win'); // away won without needing comeback
});

// ============================================================
// 3. Momentum Buckets
// ============================================================
test('momentum buckets: shots grouped into 15-min windows', () => {
  const r = filterMatchEvents([
    { type: 'shot', text: 'Shot 1', minute: '5', homeAway: 'home' },
    { type: 'shot', text: 'Shot 2', minute: '17', homeAway: 'away' },
    { type: 'shot', text: 'Shot 3', minute: '25', homeAway: 'home' },
  ], {});
  assert.strictEqual(r.momentumBuckets.length, 2); // 0-15 and 15-30
  const b0 = r.momentumBuckets.find(b => b.window === '0-15');
  const b1 = r.momentumBuckets.find(b => b.window === '15-30');
  assert.strictEqual(b0.homeShots, 1);
  assert.strictEqual(b1.awayShots, 1);
  assert.strictEqual(b1.homeShots, 1);
});

test('momentum buckets: goals counted in bucket', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Goal!', minute: '10', homeAway: 'home' },
    { type: 'goal', text: 'Equalizer', minute: '22', homeAway: 'away' },
  ], {});
  const b0 = r.momentumBuckets.find(b => b.window === '0-15');
  assert.strictEqual(b0.goals, 1);
});

test('keyEvents preserve bilingual text for the Chinese and English UI', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Goal! Argentina 1, Switzerland 0. Alexis Mac Allister (Argentina) header from the box.', minute: '10', homeAway: 'home' },
  ], {});
  assert.strictEqual(r.keyEvents.length, 1);
  assert.ok(r.keyEvents[0].textI18n?.zh.startsWith('进球：'));
  assert.ok(r.keyEvents[0].textI18n?.en.startsWith('Goal!'));
});

test('momentum buckets: non-shot events still create buckets (but with zero shots)', () => {
  const r = filterMatchEvents([
    { type: 'card', text: 'Yellow', minute: '10', homeAway: 'home' },
    { type: 'substitution', text: 'Sub', minute: '60', homeAway: 'away' },
  ], {});
  // getBucket() is called for ALL events with valid minutes, but only shots increment counts
  assert(r.momentumBuckets.length >= 2);
  // Both buckets should have zero shots
  const totalShots = r.momentumBuckets.reduce((s, b) => s + b.homeShots + b.awayShots, 0);
  assert.strictEqual(totalShots, 0);
});

// ============================================================
// 4. Match Script Detection
// ============================================================
test('matchScript: collapse when leading team concedes lead to draw', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Home leads', minute: '10', homeAway: 'home' },
    { type: 'goal', text: 'Away equalizes', minute: '20', homeAway: 'away' },
  ], {});
  // Home led then conceded → collapse (lead blown), not even
  assert.strictEqual(r.matchScript, 'collapse');
});

test('matchScript: comeback when trailing team wins', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Away leads', minute: '5', homeAway: 'away' },
    { type: 'goal', text: 'Home equalizer', minute: '40', homeAway: 'home' },
    { type: 'goal', text: 'Home winner!', minute: '80', homeAway: 'home' },
  ], {});
  assert.strictEqual(r.matchScript, 'comeback');
});

test('matchScript: collapse when leading team concedes late to draw', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Home up', minute: '10', homeAway: 'home' },
    { type: 'goal', text: 'Home two up', minute: '50', homeAway: 'home' },
    { type: 'goal', text: 'Away pulls one back', minute: '70', homeAway: 'away' },
    { type: 'goal', text: 'Away equalizer!', minute: '85', homeAway: 'away' },
  ], {});
  assert.strictEqual(r.matchScript, 'collapse');
});

test('matchScript: control_win with dominant shot difference', () => {
  const events = [
    { type: 'goal', text: 'Home goal', minute: '30', homeAway: 'home' },
    { type: 'shot', text: 'Home shot 1', minute: '10', homeAway: 'home' },
    { type: 'shot', text: 'Home shot 2', minute: '45', homeAway: 'home' },
    { type: 'shot', text: 'Home shot 3', minute: '60', homeAway: 'home' },
    { type: 'shot', text: 'Home shot 4', minute: '75', homeAway: 'home' },
    { type: 'shot', text: 'Away only shot', minute: '80', homeAway: 'away' },
  ];
  const r = filterMatchEvents(events, {});
  assert.strictEqual(r.matchScript, 'control_win');
});

test('matchScript: unknown for no goals', () => {
  const r = filterMatchEvents([], {});
  assert.strictEqual(r.matchScript, 'unknown');
});

// ============================================================
// 5. Hydration Break Windows
// ============================================================
test('hydration window: event at 28 min flagged', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Goal near HT break', minute: '28' },
  ], {});
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  const hbNotes = r.notes.filter(n => noteText(n).includes('hydration'));
  assert(hbNotes.length > 0);
});

test('hydration window: event at 76 min flagged', () => {
  const r = filterMatchEvents([
    { type: 'card', text: 'Yellow near full time', minute: '76' },
  ], {});
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  const hbNotes = r.notes.filter(n => noteText(n).includes('hydration'));
  assert(hbNotes.length > 0);
});

test('hydration window: event at 50 min NOT flagged', () => {
  const r = filterMatchEvents([
    { type: 'shot', text: 'Mid-game shot', minute: '50' },
  ], {});
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  const hbNotes = r.notes.filter(n => noteText(n).includes('hydration'));
  assert.strictEqual(hbNotes.length, 0);
});

// ============================================================
// 6. Yellow Card Accumulation Warning
// ============================================================
test('yellow cards: warning when team has 2+ yellows', () => {
  const r = filterMatchEvents([
    { type: 'yellow-card', text: 'Yellow #1 Brazil', minute: '10', homeAway: 'home' },
    { type: 'yellow-card', text: 'Yellow #2 Brazil', minute: '30', homeAway: 'home' },
    { type: 'yellow-card', text: 'Yellow Argentina', minute: '50', homeAway: 'away' },
  ], { homeName: 'Brazil', awayName: 'Argentina' });
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  const yellowNotes = r.notes.filter(n => noteText(n).includes('yellow cards') || noteText(n).includes('yellow'));
  assert(yellowNotes.some(n => noteText(n).includes('Brazil')));
});

test('yellow cards: no warning with only 1 yellow per team', () => {
  const r = filterMatchEvents([
    { type: 'yellow-card', text: 'Yellow #1', minute: '10', homeAway: 'home' },
    { type: 'yellow-card', text: 'Yellow #2', minute: '20', homeAway: 'away' },
  ], { homeName: 'Team A', awayName: 'Team B' });
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  const yellowNotes = r.notes.filter(n => noteText(n).includes('2 yellow'));
  // Neither team has 2 yellows
  assert(!yellowNotes.some(n => noteText(n).includes('Team A')) || !yellowNotes.some(n => noteText(n).includes('Team B')));
});

// ============================================================
// 7. Goalkeeper Error Detection
// ============================================================
test('GK error: detected in English', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: 'Goal after goalkeeper howler', minute: '35' },
  ], {});
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  assert(r.notes.some(n => noteText(n).includes('Goalkeeper error signal')));
});

test('GK error: detected in Chinese', () => {
  const r = filterMatchEvents([
    { type: 'goal', text: '门将送礼进球', minute: '70' },
  ], {});
  const noteText = n => typeof n === 'object' ? `${n.en || ''} ${n.zh || ''}` : String(n);
  assert(r.notes.some(n => noteText(n).includes('Goalkeeper error')));
});

// ============================================================
// 8. Edge Cases
// ============================================================
test('edge case: empty array returns safe defaults', () => {
  const r = filterMatchEvents([], {});
  assert.deepStrictEqual(r.keyEvents, []);
  assert.deepStrictEqual(r.momentumBuckets, []);
  assert.deepStrictEqual(r.notes, []);
  assert.strictEqual(r.matchScript, 'unknown');
});

test('edge case: null/undefined events returns safe defaults', () => {
  const r = filterMatchEvents(null, {});
  assert.deepStrictEqual(r.keyEvents, []);
});

test('edge case: event with no type/text still works', () => {
  const r = filterMatchEvents([{}], {});
  assert.strictEqual(r.keyEvents.length, 0);
});

test('edge case: string events handled', () => {
  const r = filterMatchEvents(['Goal!'], {});
  assert.strictEqual(r.keyEvents.length, 1);
  assert.strictEqual(r.keyEvents[0].type, 'goal');
});

// ============================================================
// Summary
// ============================================================
console.log('\n============================');
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');

if (failed > 0) {
  process.exit(1);
}
