#!/usr/bin/env node
/**
 * PF-2: recent-stats sample window regression test
 *
 * Verifies the `?n=` window clamp on GET /api/team/:id/recent-stats:
 *   - default (no n)         -> 5
 *   - floor                  -> 2
 *   - cap                     -> 10
 *   - matches actually used   == min(pastMatches, sampleSize)
 *
 * Network-free: deps (espn/loader/getCached) are mocked so the route runs
 * end-to-end without hitting ESPN.
 */

const createRecentRoutes = require('../lib/routes/recent');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

const TEAM_ID = '478';
const TOTAL_PAST = 15; // more than the cap so the cap is exercised

// Build a schedule with TOTAL_PAST completed matches for TEAM_ID.
const matchIds = [];
const scheduleMatches = [];
for (let i = 0; i < TOTAL_PAST; i++) {
  const mid = `m${i}`;
  matchIds.push(mid);
  scheduleMatches.push({
    matchId: mid,
    kickoffUtc: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    kickoffBjt: '',
    stage: 'group',
    status: { state: 'post' },
    teams: {
      home: { id: TEAM_ID, name: 'France' },
      away: { id: `opp${i}`, name: `Opp${i}` },
    },
    venue: 'V',
  });
}

const deps = {
  getCached: () => null,            // force real compute path
  setCache: () => {},
  getTeamNameI18n: () => null,
  parseEvent: (ev) => ev,
  loader: { getSchedule: () => ({ matches: scheduleMatches }) },
  espn: async (path) => {
    if (path.includes('/scoreboard')) {
      return { events: matchIds.map((id) => ({ id })) };
    }
    if (path.includes('/summary')) {
      // Two-team boxscore so the route assembles teamStats.
      return {
        boxscore: {
          teams: [
            { statistics: [{ name: 'Possession', displayValue: '55' }, { name: 'Shots', displayValue: '12' }] },
            { statistics: [{ name: 'Possession', displayValue: '45' }, { name: 'Shots', displayValue: '8' }] },
          ],
        },
      };
    }
    return {};
  },
};

const routes = createRecentRoutes(deps);
const recentStats = routes['GET /api/team/:id/recent-stats'];

async function run() {
  // Default (no n) -> 5, and 5 matches consumed.
  {
    const r = await recentStats({ id: TEAM_ID });
    assert(r.sampleSize === 5, `no n -> sampleSize=5 (got ${r.sampleSize})`);
    assert(r.matches === 5, `no n -> 5 matches consumed (got ${r.matches})`);
    assert(r.stats !== null, 'no n -> aggregated stats produced');
  }

  // Floor: n=1 -> 2
  {
    const r = await recentStats({ id: TEAM_ID, n: '1' });
    assert(r.sampleSize === 2, `n=1 -> sampleSize floored to 2 (got ${r.sampleSize})`);
    assert(r.matches === 2, `n=1 -> 2 matches consumed (got ${r.matches})`);
  }

  // Mid value passes through: n=3 -> 3
  {
    const r = await recentStats({ id: TEAM_ID, n: '3' });
    assert(r.sampleSize === 3, `n=3 -> sampleSize=3 (got ${r.sampleSize})`);
    assert(r.matches === 3, `n=3 -> 3 matches consumed (got ${r.matches})`);
  }

  // Cap reached: n=12 -> 10 (not 12)
  {
    const r = await recentStats({ id: TEAM_ID, n: '12' });
    assert(r.sampleSize === 10, `n=12 -> sampleSize capped at 10 (got ${r.sampleSize})`);
    assert(r.matches === 10, `n=12 -> 10 matches consumed, not 12 (got ${r.matches})`);
  }

  // Cap above range: n=20 -> 10
  {
    const r = await recentStats({ id: TEAM_ID, n: '20' });
    assert(r.sampleSize === 10, `n=20 -> sampleSize capped at 10 (got ${r.sampleSize})`);
    assert(r.matches === 10, `n=20 -> only 10 matches consumed (got ${r.matches})`);
  }

  // Never exceeds the number of past matches available.
  {
    const r = await recentStats({ id: TEAM_ID, n: '5' });
    assert(r.matches <= TOTAL_PAST, `matches consumed (${r.matches}) <= available past (${TOTAL_PAST})`);
  }
}

run().then(() => {
  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
