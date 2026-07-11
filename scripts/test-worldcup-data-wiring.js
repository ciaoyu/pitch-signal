#!/usr/bin/env node
'use strict';
const assert = require('assert');
const lineups = require('../lib/lineups-source');
const { getWorldCupPlayerStats, getOfficialTournamentScorers } = require('../lib/services/worldcup-player-stats');
const match = lineups.getLineups('760511');
assert(match.hasRealLineups, '760511 resolves its FIFA-keyed published lineups');
assert.strictEqual(match.homeXI.length, 11, 'published Spain XI is exposed');
assert.strictEqual(match.awayXI.length, 11, 'published Belgium XI is exposed');
assert.strictEqual(match.substitutions.length, 9, 'all published substitutions are exposed');
const mbappe = getWorldCupPlayerStats('Kylian Mbappé');
assert.strictEqual(mbappe.tournamentGoals, 8, 'FIFA tournament player snapshot supplies Mbappé’s 8 goals');
assert.strictEqual(mbappe.tournamentAssists, 3, 'official FIFA player-stat snapshot supplies Mbappé’s 3 assists');
assert.strictEqual(mbappe.tournamentMinutes, 563, 'official FIFA player-stat snapshot supplies Mbappé’s 563 minutes');
// The suite intentionally points at an isolated TEST_DB_PATH. In production
// predictions.db the audit ledger currently has 7 rows; an empty test DB must
// remain a valid audit result rather than changing the production semantics.
if (process.env.TEST_MODE === '1') assert(mbappe.eventLedgerGoals >= 0, 'test DB may have no event ledger rows');
else assert.strictEqual(mbappe.eventLedgerGoals, 7, 'event ledger discrepancy remains observable for repair, not silently substituted');
assert(mbappe.tournamentApps > 0, 'World Cup lineup ledger supplies player appearances');
const officialScorers = getOfficialTournamentScorers();
assert.strictEqual(officialScorers.players.length, 50, 'official scorer snapshot retains the full rendered leaderboard, not one player');
assert.deepStrictEqual(officialScorers.players.slice(0, 4).map(p => [p.name, p.goals, p.assists, p.minutes]), [
  ['Kylian Mbappe', 8, 3, 563], ['Lionel Messi', 8, 1, 468], ['Erling Haaland', 7, 0, 416], ['Harry Kane', 6, 1, 489],
], 'official leaderboard ordering and headline fields are preserved');
console.log('✅ World Cup player and lineup data wiring regression passed');
