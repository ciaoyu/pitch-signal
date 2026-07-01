#!/usr/bin/env node
'use strict';

const assert = require('assert');
const QualificationSimulator = require('../lib/qualification');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function buildGroup(index) {
  const letter = String.fromCharCode(65 + index);
  const thirdPoints = 12 - index;
  return {
    name: `Group ${letter}`,
    teams: [
      { id: `${letter}1`, name: `${letter}1`, pts: 20, gf: 10, ga: 0, gd: 10, played: 3 },
      { id: `${letter}2`, name: `${letter}2`, pts: 18, gf: 8, ga: 1, gd: 7, played: 3 },
      { id: `${letter}3`, name: `${letter}3`, pts: thirdPoints, gf: 4, ga: 3, gd: 1, played: 3 },
      { id: `${letter}4`, name: `${letter}4`, pts: 0, gf: 0, ga: 10, gd: -10, played: 3 },
    ],
    matches: [],
  };
}

const simulator = new QualificationSimulator({ simulations: 5 });
const groups = Array.from({ length: 12 }, (_, index) => buildGroup(index));
const result = simulator.simulateGroups(groups);
const thirdTeams = groups.map(group => result[group.name].results.find(team => team.id.endsWith('3')));

test('exactly eight third-placed teams qualify', () => {
  assert.strictEqual(thirdTeams.reduce((sum, team) => sum + team.thirdPlaceQualifyProb, 0), 8);
  assert.strictEqual(thirdTeams.filter(team => team.thirdPlaceQualifyProb === 1).length, 8);
});

test('third-place probability follows cross-group standings order', () => {
  for (let index = 1; index < thirdTeams.length; index++) {
    assert.ok(
      thirdTeams[index - 1].thirdPlaceQualifyProb >= thirdTeams[index].thirdPlaceQualifyProb,
      `${thirdTeams[index - 1].id} should not rank below ${thirdTeams[index].id}`
    );
  }
  assert.strictEqual(thirdTeams[7].thirdPlaceQualifyProb, 1);
  assert.strictEqual(thirdTeams[8].thirdPlaceQualifyProb, 0);
});

test('first- and second-place qualification logic is unchanged', () => {
  for (const group of groups) {
    const teams = result[group.name].results;
    assert.strictEqual(teams.find(team => team.id.endsWith('1')).qualifyProb, 1);
    assert.strictEqual(teams.find(team => team.id.endsWith('2')).qualifyProb, 1);
    assert.strictEqual(teams.find(team => team.id.endsWith('3')).qualifyProb, 0);
  }
});

test('elimination probability accounts for qualified third places', () => {
  assert.strictEqual(thirdTeams[0].eliminatedProb, 0);
  assert.strictEqual(thirdTeams[11].eliminatedProb, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
