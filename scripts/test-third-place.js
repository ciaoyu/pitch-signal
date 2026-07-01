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

test('complete tie uses conduct score then latest FIFA ranking', () => {
  const base = { pts: 4, gd: 0, gf: 3 };
  assert.ok(
    simulator.compareStandings(
      { ...base, id: 'conduct-high', teamConductScore: -2, fifaRank: 40 },
      { ...base, id: 'conduct-low', conduct: -5, fifaRanking: 1 }
    ) < 0,
    'higher team conduct score should rank first'
  );
  assert.ok(
    simulator.compareStandings(
      { ...base, id: 'rank-high', conduct: -2, fifaRanking: 8 },
      { ...base, id: 'rank-low', teamConductScore: -2, fifaRank: 12 }
    ) < 0,
    'lower FIFA ranking number should rank first'
  );
});

test('missing FIFA ranking uses Elo without group-order bias', () => {
  const tiedGroups = Array.from({ length: 12 }, (_, index) => {
    const group = buildGroup(index);
    group.teams[2].pts = 4;
    group.teams[2].gd = 0;
    group.teams[2].gf = 3;
    group.teams[2].ga = 3;
    group.teams[2].teamConductScore = -2;
    return group;
  });
  const tiedSimulator = new QualificationSimulator({ simulations: 1 });
  tiedSimulator.ratings = Object.fromEntries(
    tiedGroups.map((group, index) => [group.teams[2].id, { rating: 1600 + index }])
  );

  const forward = tiedSimulator.simulateGroups(tiedGroups);
  const reversed = tiedSimulator.simulateGroups([...tiedGroups].reverse());
  const qualified = output => tiedGroups
    .filter(group => output[group.name].results.find(team => team.id.endsWith('3')).thirdPlaceQualifyProb === 1)
    .map(group => group.teams[2].id)
    .sort();

  assert.deepStrictEqual(qualified(forward), qualified(reversed));
  assert.deepStrictEqual(qualified(forward), ['E3', 'F3', 'G3', 'H3', 'I3', 'J3', 'K3', 'L3']);
});

test('equal Elo falls back to stable team ID', () => {
  const tied = { pts: 4, gd: 0, gf: 3, teamConductScore: -2 };
  simulator.ratings['Alpha'] = { rating: 1500 };
  simulator.ratings['Zulu'] = { rating: 1500 };

  assert.ok(simulator.compareStandings(
    { ...tied, id: 'Alpha' },
    { ...tied, id: 'Zulu' }
  ) < 0);
  assert.ok(simulator.compareStandings(
    { ...tied, id: 'Zulu' },
    { ...tied, id: 'Alpha' }
  ) > 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
