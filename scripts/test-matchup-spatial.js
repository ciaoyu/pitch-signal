#!/usr/bin/env node
'use strict';
/**
 * lib/matchup-spatial.js 测试
 * 覆盖：resolveTeam, getPlayerRatingData, buildSpatialMatchup (public API)
 * 私有函数 (parseFormation, pickLineup, calcFormationCoords) 通过 buildSpatialMatchup 间接覆盖
 */
const assert = require('assert');

let passed = 0, failed = 0;
function check(cond, label) {
  try { assert(cond); console.log(`  ✅ ${label}`); passed++; }
  catch (e) { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== Matchup Spatial Tests ===\n');

// Mock player ratings data with a full squad
const mockRatings = {
  data: {
    'Brazil': {
      formation: '4-3-3',
      players: {
        gk1: { name: 'Alisson', pos: 'GK', rating: 88, jersey: 1 },
        gk2: { name: 'Ederson', pos: 'GK', rating: 86, jersey: 12 },
        df1: { name: 'Marquinhos', pos: 'CB', rating: 87, jersey: 4 },
        df2: { name: 'Danilo', pos: 'RB', rating: 83, jersey: 2 },
        df3: { name: 'Sandro', pos: 'LB', rating: 82, jersey: 6 },
        df4: { name: 'Bremer', pos: 'CB', rating: 84, jersey: 3 },
        df5: { name: 'Militao', pos: 'CB', rating: 85, jersey: 14 },
        mf1: { name: 'Casemiro', pos: 'CDM', rating: 87, jersey: 5 },
        mf2: { name: 'Paqueta', pos: 'CM', rating: 85, jersey: 8 },
        mf3: { name: 'Neymar', pos: 'CAM', rating: 90, jersey: 10 },
        mf4: { name: 'Guimaraes', pos: 'CM', rating: 83, jersey: 15 },
        mf5: { name: 'Fred', pos: 'CDM', rating: 81, jersey: 17 },
        fw1: { name: 'Vinicius', pos: 'LW', rating: 91, jersey: 7 },
        fw2: { name: 'Richarlison', pos: 'ST', rating: 84, jersey: 9 },
        fw3: { name: 'Raphinha', pos: 'RW', rating: 85, jersey: 11 },
      },
    },
    'Germany': {
      formation: '4-2-3-1',
      players: {
        gk1: { name: 'Neuer', pos: 'GK', rating: 89, jersey: 1 },
        df1: { name: 'Rudiger', pos: 'CB', rating: 86, jersey: 2 },
        df2: { name: 'Sule', pos: 'CB', rating: 83, jersey: 15 },
        df3: { name: 'Raum', pos: 'LB', rating: 82, jersey: 3 },
        df4: { name: 'Kimmich', pos: 'RB', rating: 85, jersey: 6 },
        mf1: { name: 'Gundogan', pos: 'CM', rating: 87, jersey: 8 },
        mf2: { name: 'Goretzka', pos: 'CDM', rating: 84, jersey: 18 },
        mf3: { name: 'Musiala', pos: 'CAM', rating: 88, jersey: 10 },
        mf4: { name: 'Sane', pos: 'LM', rating: 85, jersey: 19 },
        fw1: { name: 'Havertz', pos: 'ST', rating: 84, jersey: 7 },
        fw2: { name: 'Muller', pos: 'CF', rating: 86, jersey: 13 },
        fw3: { name: 'Gnabry', pos: 'LW', rating: 83, jersey: 14 },
      },
    },
  },
};

const initMatchupSpatial = require('../lib/matchup-spatial');
const matchup = initMatchupSpatial({
  teamResolver: {
    resolve: (name) => {
      if (name === 'Brazil') return { ratings_id: 'Brazil', espn_id: '205', flag: '🇧🇷' };
      if (name === 'Germany') return { ratings_id: 'Germany', espn_id: '4819', flag: '🇩🇪' };
      return null;
    }
  },
  PLAYER_RATINGS: mockRatings,
  TEAM_FLAGS: {},
  getTeamNameZh: (id) => id === '205' ? '巴西' : id === '4819' ? '德国' : id,
});

// ── resolveTeam ──
console.log('📊 resolveTeam():');
const rt1 = matchup.resolveTeam('Brazil');
check(rt1.requestedId === 'Brazil', 'resolveTeam preserves requestedId');
check(rt1.ratingsId === 'Brazil', 'resolved to ratings_id Brazil');
check(rt1.espnId === '205', 'resolved espn_id=205');

const rt2 = matchup.resolveTeam(205); // number input
check(typeof rt2.ratingsId === 'string', 'resolveTeam handles numeric input');

// ── getPlayerRatingData ──
console.log('\n📊 getPlayerRatingData():');
const prd = matchup.getPlayerRatingData('Brazil');
check(prd.team != null, 'Brazil team data found');
check(Object.keys(prd.team.players).length >= 11, `Brazil has >= 11 players (got ${Object.keys(prd.team.players).length})`);
check(prd.team.formation === '4-3-3', 'Brazil formation = 4-3-3');

const prd2 = matchup.getPlayerRatingData('Atlantis');
check(prd2.team === null, 'Unknown team → team=null');

// ── buildSpatialMatchup (indirectly tests parseFormation, pickLineup, calcFormationCoords, pairPlayers) ──
console.log('\n📊 buildSpatialMatchup():');
const result = matchup.buildSpatialMatchup('Brazil', 'Germany', mockRatings);

check(result.error == null, 'Build succeeds (no error)');
check(result.matchId === 'Brazil_vs_Germany', 'matchId = Brazil_vs_Germany');
check(result.home.name === '巴西', 'Home name = 巴西 (from getTeamNameZh)');
check(result.away.name === '德国', 'Away name = 德国');
check(result.home.formation === '4-3-3', 'Home formation = 4-3-3');
check(result.away.formation === '4-2-3-1', 'Away formation = 4-2-3-1');

// Player count: 1 GK + 4 D + 3 M + 3 F = 11 (4-3-3) and 1 GK + 4 D + 5 M + 1 F = 11 (4-2-3-1 → mid=5)
const homePlayers = result.home.players;
const awayPlayers = result.away.players;
check(homePlayers.length === 11, `Home has 11 players (got ${homePlayers.length})`);
check(awayPlayers.length === 11, `Away has 11 players (got ${awayPlayers.length})`);

// GK exists
check(homePlayers.some(p => p.pos === 'GK'), 'Home has GK');
check(awayPlayers.some(p => p.pos === 'GK'), 'Away has GK');

// Coordinates: home GK near bottom, home FW near top
const homeGK = homePlayers.find(p => p.pos === 'GK');
const homeFW = homePlayers.find(p => p.pos === 'LW' || p.pos === 'ST' || p.pos === 'RW' || p.pos === 'CF');
check(homeGK.y < 20, 'Home GK y < 20');
check(homeFW.y > 60, 'Home FW y > 60');

// Away coordinates mirrored
const awayGK = awayPlayers.find(p => p.pos === 'GK');
const awayFW = awayPlayers.find(p => p.pos === 'ST' || p.pos === 'CF');
check(awayGK.y > 80, 'Away GK y > 80 (mirrored)');
check(awayFW.y < 40, 'Away FW y < 40 (mirrored)');

// Each player has x, y, rating
check(homePlayers.every(p => typeof p.x === 'number' && typeof p.y === 'number'), 'All home players have x,y');
check(homePlayers.every(p => typeof p.rating === 'number' && p.rating > 0), 'All home players have positive rating');

// Pairs exist
check(Array.isArray(result.pairs), 'pairs is array');
check(result.pairs.length > 0, 'Has at least one positional pair');

// Summary
check(typeof result.summary.homeAdvantages === 'number', 'summary.homeAdvantages is number');
check(typeof result.summary.awayAdvantages === 'number', 'summary.awayAdvantages is number');
check(typeof result.summary.avgGap === 'number', 'summary.avgGap is number');

// Composite score
check(typeof result.composite.home === 'number', 'composite.home is number');
check(Math.abs(result.composite.home + result.composite.away - 100) < 0.5, 'Composite home+away ≈ 100');
check(['high', 'medium', 'low'].includes(result.composite.confidence), 'composite.confidence is valid');

// ── Lineup Input & Fuzzy Matching ──
console.log('\n📊 Lineup Input & Fuzzy Matching:');
const lineupResult = matchup.buildSpatialMatchup('Brazil', 'Germany', mockRatings, {
  homeLineup: [
    { name: 'Alisson', pos: 'GK', jersey: 1, x: 50, y: 10 },
    { name: 'Vini Jr', pos: 'LW', jersey: 7, x: 20, y: 80 }
  ],
  awayLineup: [
    { name: 'Neuer', pos: 'GK', jersey: 1 }
  ]
});

const lineupHome = lineupResult.home.players;
const lineupAway = lineupResult.away.players;
check(lineupHome.find(p => p.pos === 'GK').y === 10, 'Real coordinates used for homeLineup (y=10)');
check(lineupHome.find(p => p.pos === 'LW').rating === 91, 'Fuzzy match derived rating 91 for Vini Jr -> Vinicius');
check(lineupHome.find(p => p.pos === 'LW').name === 'Vinicius', 'Fuzzy match updated name to Vinicius');

const neuer = lineupAway.find(p => p.pos === 'GK');
check(neuer.y !== undefined && neuer.y > 80, 'Fallback coords used for awayLineup (no coords provided)');
check(neuer.rating === 89, 'Exact match rating applied for Neuer');

// ── Error cases ──
console.log('\n📊 buildSpatialMatchup error cases:');
const err1 = matchup.buildSpatialMatchup('Atlantis', 'Germany', mockRatings);
check(err1.error != null, 'Unknown home team → error');
check(err1.error.includes('Atlantis'), 'Error message mentions missing team');

const err2 = matchup.buildSpatialMatchup('Brazil', 'Germany', null);
check(err2.error != null, 'Null ratings → error');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
