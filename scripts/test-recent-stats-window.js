#!/usr/bin/env node
/**
 * PF-2: recent-stats sample window regression test
 *
 * Verifies the `?n=` window clamp on GET /api/team/:id/recent-stats:
 *   - default (no n)         -> all tournament matches, capped at 10
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

// This fixture is intentionally absent from the static snapshot. It models a
// knockout pairing resolved after the snapshot was generated.
const liveKnockoutEvent = {
  id: 'live-r16',
  date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  dateBJT: '',
  state: 'post',
  home: { id: TEAM_ID, name: 'France', abbr: 'FRA' },
  away: { id: 'knockout-opponent', name: 'Knockout Opponent', abbr: 'KOP' },
  stage: 'R16',
  venue: 'Live venue',
};

const deps = {
  getCached: () => null,            // force real compute path
  setCache: () => {},
  getTeamNameI18n: () => null,
  parseEvent: (ev) => ev,
  loader: { getSchedule: () => ({ matches: scheduleMatches }) },
  espn: async (path) => {
    if (path.includes('20260611-20260719')) {
      return { events: [liveKnockoutEvent] };
    }
    if (path.includes('/scoreboard')) {
      return { events: [...matchIds.map((id) => ({ id })), liveKnockoutEvent] };
    }
    if (path.includes('/summary')) {
      // Two-team boxscore so the route assembles teamStats.
      return {
        boxscore: {
          teams: [
            { statistics: [{ name: 'Possession', displayValue: '55' }, { name: 'Shots', displayValue: '12' }, { name: 'wonCorners', displayValue: '7' }] },
            { statistics: [{ name: 'Possession', displayValue: '45' }, { name: 'Shots', displayValue: '8' }, { name: 'wonCorners', displayValue: '3' }] },
          ],
        },
      };
    }
    return {};
  },
};

const routes = createRecentRoutes(deps);
const recentStats = routes['GET /api/team/:id/recent-stats'];
const recentMatches = routes['GET /api/team/:id/recent-matches'];

async function run() {
  // Default (no n) -> complete tournament record, capped at 10, including
  // the dynamically resolved knockout fixture absent from the snapshot.
  {
    const r = await recentStats({ id: TEAM_ID });
    assert(r.sampleSize === 10, `no n -> sampleSize cap=10 (got ${r.sampleSize})`);
    assert(r.window === 'tournament', `no n -> tournament window (got ${r.window})`);
    assert(r.matches === 10, `no n -> all available matches up to cap (got ${r.matches})`);
    assert(r.matchIds.includes('live-r16'), 'no n -> dynamically resolved knockout fixture included');
    assert(r.stats !== null, 'no n -> aggregated stats produced');
    assert(r.stats.wonCorners.avg === 7, `won corners aggregated (got ${r.stats.wonCorners.avg})`);
    assert(r.stats.cornersAgainst.avg === 3, `opponent corners derived (got ${r.stats.cornersAgainst.avg})`);
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
    assert(r.window === 'recent', `explicit n -> recent window (got ${r.window})`);
    assert(r.matches <= TOTAL_PAST, `matches consumed (${r.matches}) <= available past (${TOTAL_PAST})`);
  }

  // Team World Cup record must include a resolved knockout fixture that was
  // absent from match_snapshot_schedule.json at server startup.
  {
    const r = await recentMatches({ id: TEAM_ID });
    assert(r.matches.some(m => m.matchId === 'live-r16'), 'runtime knockout fixture is included in team record');
    assert(r.completed === TOTAL_PAST + 1, `completed record includes live knockout fixture (got ${r.completed})`);
  }
}

run().then(() => {
  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
