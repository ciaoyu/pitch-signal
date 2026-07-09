#!/usr/bin/env node
'use strict';

/**
 * PF-10 regression: /api/bracket must prefer the current official FIFA
 * knockout match graph over the stale static bracket scaffold.
 */

const assert = require('assert');
const { buildResolvedBracket } = require('../lib/bracket-updater');

const staleBracket = {
  matches: {
    'R32-1': { teamA: 'A2', teamB: 'B2' },
    'R16-1': { teamA: 'W R32-1', teamB: 'W R32-2', feedA: 'R32-1', feedB: 'R32-2' },
    'QF-1': { teamA: 'W R16-1', teamB: 'W R16-2', feedA: 'R16-1', feedB: 'R16-2' },
  },
  tree: { left: [{ id: 'QF-1' }], right: [], center: [] },
};

const fifaMatches = [
  {
    id: 'f73', n: 73, stage: 'r32', date: '2026-06-30T01:00:00Z',
    phA: '1F', phB: '2C',
    home: { code: 'MAR', score: 2 }, away: { code: 'NED', score: 1 },
    status: 'finished', winner: 'MAR',
  },
  {
    id: 'f74', n: 74, stage: 'r32', date: '2026-06-30T21:00:00Z',
    phA: '1I', phB: '3CDFGH',
    home: { code: 'FRA', score: 3 }, away: { code: 'SWE', score: 0 },
    status: 'finished', winner: 'FRA',
  },
  {
    id: 'f89', n: 89, stage: 'r16', date: '2026-07-04T21:00:00Z',
    phA: 'W74', phB: 'W73',
    home: { code: 'FRA', score: 2 }, away: { code: 'MAR', score: 1 },
    status: 'finished', winner: 'FRA',
  },
  {
    id: 'f90', n: 90, stage: 'r16', date: '2026-07-05T20:00:00Z',
    phA: 'W75', phB: 'W76',
    home: { code: 'MAR', score: 1 }, away: { code: 'MEX', score: 0 },
    status: 'finished', winner: 'MAR',
  },
  {
    id: 'f97', n: 97, stage: 'qf', date: '2026-07-09T20:00:00Z',
    phA: 'W89', phB: 'W90',
    home: { code: 'FRA' }, away: { code: 'MAR' },
    status: 'scheduled', winner: null,
  },
];

const schedule = {
  matches: [
    {
      matchId: '8900',
      stage: 'knockout',
      kickoffUtc: '2026-07-04T21:00:00.000Z',
      shortName: 'MAR @ FRA',
      teams: {
        home: { id: '478', name: 'France', abbreviation: 'FRA' },
        away: { id: '2869', name: 'Morocco', abbreviation: 'MAR' },
      },
      status: { state: 'post' },
    },
    {
      matchId: '9000',
      stage: 'knockout',
      kickoffUtc: '2026-07-05T20:00:00.000Z',
      shortName: 'MEX @ MAR',
      teams: {
        home: { id: '2869', name: 'Morocco', abbreviation: 'MAR' },
        away: { id: '203', name: 'Mexico', abbreviation: 'MEX' },
      },
      status: { state: 'post' },
    },
    {
      matchId: '9700',
      stage: 'knockout',
      kickoffUtc: '2026-07-09T20:00:00.000Z',
      shortName: 'MAR @ FRA',
      teams: {
        home: { id: '478', name: 'France', abbreviation: 'FRA' },
        away: { id: '2869', name: 'Morocco', abbreviation: 'MAR' },
      },
      status: { state: 'pre' },
    },
  ],
};

const result = buildResolvedBracket({
  posMap: {},
  thirdPlaceData: {},
  bracket: staleBracket,
  schedule,
  deps: { fifaMatches },
});

const qf = result.matches['QF-1'];
assert.ok(qf, 'QF-1 should be present');
assert.strictEqual(qf.matchId, '9700');
assert.strictEqual(qf.teamA.name, 'France');
assert.strictEqual(qf.teamB.name, 'Morocco');
assert.notStrictEqual(qf.teamB.name, 'Mexico');
assert.strictEqual(qf.feedA, 'R16-1');
assert.strictEqual(qf.feedB, 'R16-2');

console.log('✅ PF-10 official bracket graph regression passed');
