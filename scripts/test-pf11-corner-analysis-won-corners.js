#!/usr/bin/env node
'use strict';

/**
 * PF-11 regression: corner-analysis must read recent-stats wonCorners.avg.
 * The recent-stats route stores ESPN boxscore keys by their original names,
 * so stats.corners is not a valid source field.
 */

const assert = require('assert');
const createMatchupRoutes = require('../lib/routes/matchup');

const MATCH_ID = '760514';
const HOME_ID = '478';
const AWAY_ID = '605';

const deps = {
  espn: async (path) => {
    if (path.includes('/summary')) {
      return {
        boxscore: {
          teams: [
            { statistics: [{ name: 'wonCorners', abbreviation: 'CK', displayValue: '2' }] },
            { statistics: [{ name: 'wonCorners', abbreviation: 'CK', displayValue: '1' }] },
          ],
        },
        header: {
          competitions: [
            {
              competitors: [
                { id: HOME_ID, homeAway: 'home' },
                { id: AWAY_ID, homeAway: 'away' },
              ],
              status: { displayClock: "45'+2'" },
            },
          ],
        },
      };
    }
    if (path === '/scoreboard') {
      return {
        events: [],
      };
    }
    return {};
  },
  getCached: () => null,
  setCache: () => {},
  routes: {
    'GET /api/coach/:teamId': async () => ({ style: '均衡型' }),
    'GET /api/team/:id/recent-stats': async ({ id }) => ({
      teamId: id,
      stats: {
        wonCorners: {
          avg: id === HOME_ID ? 6.8 : 7.3,
          count: 6,
        },
        cornersAgainst: {
          avg: id === HOME_ID ? 3.0 : 1.2,
          count: 6,
        },
      },
      source: 'mock',
    }),
  },
  getPlayerRatingData: (id) => ({ espnId: id, team: { players: {} } }),
  getTeamNameI18n: (id) => ({
    zh: id === HOME_ID ? '法国' : '摩洛哥',
    en: id === HOME_ID ? 'France' : 'Morocco',
  }),
};

async function run() {
  const routes = createMatchupRoutes(deps);
  const result = await routes['GET /api/corner-analysis/:id']({ id: MATCH_ID });

  assert.strictEqual(result.historical.homeAvg, 6.8);
  assert.strictEqual(result.historical.awayAvg, 7.3);
  assert.strictEqual(result.historical.homeAgainstAvg, 3.0);
  assert.strictEqual(result.historical.awayAgainstAvg, 1.2);
  assert.strictEqual(result.predicted.total, 9.2);
  assert.notStrictEqual(result.predicted.total, 20.9);
  assert.strictEqual(result.odds.line, 8.5);
  assert.strictEqual(result.odds.kind, 'reference');
  assert.strictEqual(result.odds.source, 'manual_reference');
  assert.notStrictEqual(result.verdict.confidence, 'high');
  assert.strictEqual(result.minute, 47);
}

run()
  .then(() => {
    console.log('✅ PF-11 corner-analysis wonCorners regression passed');
  })
  .catch((error) => {
    console.error('❌ PF-11 corner-analysis wonCorners regression failed');
    console.error(error);
    process.exit(1);
  });
