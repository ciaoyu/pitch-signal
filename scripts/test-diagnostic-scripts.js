#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildReport } = require('./diagnose-venue-factor');
const { scheduleRound, validate } = require('./validate-bracket-ids');

let passed = 0;

function check(description, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${description}`);
}

check('group third-place placeholder is classified as round of 32', () => {
  assert.strictEqual(scheduleRound({
    name: 'Third Place Group A/B/C/D/F at Group E Winner',
    shortName: '3RD @ 1E',
  }), 'round of 32');
});

check('semifinal loser fixture is classified as third-place match', () => {
  assert.strictEqual(scheduleRound({
    name: 'Semifinal 2 Loser at Semifinal 1 Loser',
    shortName: 'SF L2 @ SF L1',
  }), 'third-place');
});

check('bracket validation covers every rendered node with no failures', () => {
  const report = validate();
  assert.strictEqual(report.checked, report.bracketSlots);
  assert.strictEqual(report.failures, 0);
});

check('venue diagnosis separates model no-effect from data mismatch', () => {
  const report = buildReport({
    matches: [{
      matchId: '760415',
      stage: 'group',
      venue: 'Estadio Banorte',
      teams: {
        home: { abbreviation: 'MEX' },
        away: { abbreviation: 'RSA' },
      },
    }],
  });
  assert.strictEqual(report.total, 1);
  assert.notStrictEqual(report.matches[0].status, 'mismatch');
  assert.ok(['applied', 'no_effect', 'unverifiable'].includes(report.matches[0].status));
});

console.log(`${passed} passed, 0 failed`);
