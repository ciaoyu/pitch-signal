#!/usr/bin/env node
'use strict';

/**
 * PF-11 regression: corner-analysis must read recent-stats wonCorners.avg.
 * The recent-stats route stores ESPN boxscore keys by their original names,
 * so stats.corners is not a valid source field.
 */

const assert = require('assert');
const createMatchupRoutes = require('../lib/routes/matchup');

const MATCH_ID = '760999';
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
            { status: { displayClock: '0' } },
          ],
        },
      };
    }
    if (path === '/scoreboard') {
      return {
        events: [
          {
            id: MATCH_ID,
            competitions: [
              {
                competitors: [
                  { id: HOME_ID, homeAway: 'home' },
                  { id: AWAY_ID, homeAway: 'away' },
                ],
              },
            ],
          },
        ],
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
          avg: id === HOME_ID ? 6.7 : 2.4,
          count: 5,
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

  assert.strictEqual(result.historical.homeAvg, 6.7);
  assert.strictEqual(result.historical.awayAvg, 2.4);
  assert.notStrictEqual(result.historical.homeAvg, 4.5);
  assert.notStrictEqual(result.historical.awayAvg, 3.8);
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
