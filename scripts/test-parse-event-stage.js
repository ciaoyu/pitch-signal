#!/usr/bin/env node

const assert = require('assert');
const { createParseEvent } = require('../lib/parse-event');
const { TEAM_TO_GROUP } = require('../lib/standings-helper');

const TEAM_NAMES_ZH = {};
const getTeamNameI18n = (id, def) => def;
const RATINGS = {};
const ELO_RANK_MAP = {};
const TEAM_FLAGS = {};
const TEAM_LOGOS = {};

const deps = {
  TEAM_NAMES_ZH,
  getTeamNameI18n,
  RATINGS,
  ELO_RANK_MAP,
  TEAM_FLAGS,
  TEAM_LOGOS,
  TEAM_TO_GROUP
};

const parseEvent = createParseEvent(deps);

function mockEvent(seasonSlug, homeId, awayId, notes = []) {
  return {
    id: '123',
    date: '2026-06-11T19:00Z',
    season: { slug: seasonSlug },
    competitions: [{
      competitors: [
        { team: { id: homeId }, homeAway: 'home' },
        { team: { id: awayId }, homeAway: 'away' }
      ],
      notes: notes.map(n => ({ type: 'event', text: n }))
    }],
    status: { type: { state: 'pre' } }
  };
}

// TEAM_TO_GROUP mock check. Assuming '203' and '467' are in Group A.
// Let's rely on actual TEAM_TO_GROUP mapping.
// Let's pick '203' (Mexico) and '467' (South Africa) which are in Group A.
const homeId = '203';
const awayId = '467';
assert(TEAM_TO_GROUP[homeId] === 'A', 'Test fixture home ID must be in Group A');
assert(TEAM_TO_GROUP[awayId] === 'A', 'Test fixture away ID must be in Group A');

// 1. Group Stage、notes 缺失、双方同组 → 补出 Group
const evt1 = mockEvent('group-stage', homeId, awayId);
const parsed1 = parseEvent(evt1);
assert.strictEqual(parsed1.group, 'Group A');
assert.strictEqual(parsed1.stage, 'Group Stage');
console.log('✅ Group Stage fallback works');

// 2. R32、双方原本同组 → 不得补 Group
const evt2 = mockEvent('round-of-32', homeId, awayId);
const parsed2 = parseEvent(evt2);
assert.strictEqual(parsed2.group, '');
assert.strictEqual(parsed2.stage, 'R32');
console.log('✅ R32 does not fallback to group');

// 3. R32/R16/QF/SF/Third Place/Final slug 映射
const mappingTests = {
  'round-of-32': 'R32',
  'round-of-16': 'R16',
  'quarterfinals': 'QF',
  'semifinals': 'SF',
  'third-place-play-off': '3rd Place',
  'final': 'Final'
};

for (const [slug, expectedStage] of Object.entries(mappingTests)) {
  const parsed = parseEvent(mockEvent(slug, homeId, awayId));
  assert.strictEqual(parsed.stage, expectedStage);
}
console.log('✅ Knockout stages mapped correctly');

// 4. Test when notes are provided
const evt3 = mockEvent('group-stage', '203', '660', ['Group Z']);
const parsed3 = parseEvent(evt3);
assert.strictEqual(parsed3.group, 'Group Z');
console.log('✅ Notes override fallback');

console.log('✅ parse-event boundary tests passed.');
