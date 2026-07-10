'use strict';

const assert = require('assert');
const { detectFromEspn } = require('../lib/services/moment-detector');
const { injectMomentProbabilities } = require('../lib/jobs/moment-sync');

let passed = 0;
function test(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

const stateAtPoll = { homeScore: 1, awayScore: 1 };
const goals = [
  { type: { text: 'Goal', type: 'goal' }, scoringPlay: true, clock: { displayValue: "30'" }, team: { id: 'home' }, text: 'Goal! Spain 1, Belgium 0.' },
  { type: { text: 'Goal - Header', type: 'goal---header' }, scoringPlay: true, clock: { displayValue: "41'" }, team: { id: 'away' }, text: 'Goal! Spain 1, Belgium 1.' },
  { type: { text: 'Goal', type: 'goal' }, scoringPlay: true, clock: { displayValue: "88'" }, team: { id: 'home' }, text: 'Goal! Spain 2, Belgium 1.' },
];

console.log('=== Live goal moment timing regression ===');
const moments = detectFromEspn('760511', goals, stateAtPoll);

test('all ESPN scoring-play variants become goal moments', () => {
  assert.strictEqual(moments.length, 3);
  assert.deepStrictEqual(moments.map(m => m.type), ['goal', 'goal', 'goal']);
});

test('every goal retains its own post-goal score rather than the polling score', () => {
  assert.deepStrictEqual(moments.map(m => m.scoreState), [
    { home: 1, away: 0 },
    { home: 1, away: 1 },
    { home: 2, away: 1 },
  ]);
});

injectMomentProbabilities(moments, {
  home_expected_goals: 1.2,
  away_expected_goals: 1.4,
  home_win_prob: 0.264,
  draw_prob: 0.283,
  away_win_prob: 0.453,
}, { isKnockout: true, currentMinute: 88 });

test('the 30 minute lead raises home probability and the 41 minute equalizer reverses it', () => {
  assert.ok(moments[0].probHomeWin > moments[1].probHomeWin);
  assert.ok(moments[0].probHomeWin > 0.5);
  assert.ok(moments[1].probDraw > moments[0].probDraw);
});

test('the 88 minute winning goal becomes near-certain', () => {
  assert.ok(moments[2].probHomeWin > 0.95);
  assert.ok(moments[2].probAwayWin < 0.01);
});

console.log(`${passed} passed, 0 failed`);
