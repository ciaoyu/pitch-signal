#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-ko9.db');
try { fs.unlinkSync(process.env.TEST_DB_PATH); } catch (_) {}

const assert = require('assert');
const { db } = require('../lib/db');
const { buildSuperSubsSection, normalizeName } = require('../lib/services/super-subs-section');
const { teamMatches } = require('../lib/services/schedule-lookup');

const homeId = '203';
const awayId = '467';
const homeMatch = teamMatches(homeId).find(m => m.status?.completed);
const awayMatch = teamMatches(awayId).find(m => m.status?.completed && String(m.matchId) !== String(homeMatch?.matchId));
assert.ok(homeMatch && awayMatch, 'test teams have completed fixtures');

function insertEvent(matchId, teamId, playerName, eventType, minute, playerId = null) {
  db.prepare(`INSERT INTO player_match_events
    (match_id, team_id, player_name, player_id, event_type, minute, minute_added, stage, round, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'Group', 'Group', '{}')`)
    .run(String(matchId), String(teamId), playerName, playerId, eventType, minute);
}

insertEvent(homeMatch.matchId, homeId, 'Kylian Mbappe', 'goal', 70, 'espn-1');
insertEvent(homeMatch.matchId, '999', 'Opponent', 'goal', 82);
insertEvent(awayMatch.matchId, awayId, 'Bench Player', 'assist', 78, 'espn-2');

const mockSubs = matchId => {
  if (String(matchId) === String(homeMatch.matchId)) return {
    hasData: true,
    substitutions: [{ side: String(homeMatch.homeId) === homeId ? 'home' : 'away', onName: 'Kylian Mbappé', offName: 'Starter', minute: 55 }],
  };
  if (String(matchId) === String(awayMatch.matchId)) return {
    hasData: true,
    substitutions: [{ side: String(awayMatch.homeId) === awayId ? 'home' : 'away', onName: 'Bench Player', offName: 'Starter', minute: 40 }],
  };
  return { hasData: false, substitutions: [] };
};

assert.equal(buildSuperSubsSection({}), null);
const section = buildSuperSubsSection({ matchId: '760777', homeTeamId: homeId, awayTeamId: awayId, db, getSubstitutions: mockSubs });
assert.equal(section.usedInModel, false);
assert.equal(section.source, 'fifa-lineups+player-events');
const mbappe = section.home.superSubs.find(p => p.playerName === 'Kylian Mbappé');
assert.ok(mbappe, 'ordinary minute-55 substitution is included');
assert.equal(mbappe.goalsAfterSub, 1, 'accent-insensitive player goal join works');
assert.equal(mbappe.goalsFor, 1);
assert.equal(mbappe.goalsAgainst, 1);
assert.equal(mbappe.playerId, 'espn-1');
assert.equal(normalizeName('Kylian Mbappé'), normalizeName('Kylian Mbappe'));
const bench = section.away.superSubs.find(p => p.playerName === 'Bench Player');
assert.equal(bench.assistsAfterSub, 1);
console.log('super subs: all assertions passed');
