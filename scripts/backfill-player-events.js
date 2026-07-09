#!/usr/bin/env node
/**
 * Backfill player_match_events from ESPN match summaries (KO-4)
 *
 * Iterates over completed matches (from match_snapshot_schedule.json), pulls
 * each ESPN summary, extracts goal/assist/card events for individual players,
 * and persists them idempotently into player_match_events. Re-runnable: the
 * UNIQUE(match_id, player_name, event_type, minute, minute_added) constraint
 * makes INSERT OR IGNORE safe to repeat.
 *
 * Usage:
 *   node scripts/backfill-player-events.js                 # all completed matches
 *   node scripts/backfill-player-events.js --limit=10      # first N
 *   node scripts/backfill-player-events.js --matchId=760484
 */

const { fetchJSON } = require('../services/espn');
const { extractPlayerEvents, upsertPlayerEvents, roundFromSummary } = require('../lib/services/player-events');
const { db } = require('../lib/db');

const schedule = require('../data/match_snapshot_schedule.json');
const completed = (schedule.matches || []).filter((m) => m.status && m.status.completed);

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : completed.length;
const matchArg = args.find((a) => a.startsWith('--matchId='));
const targets = matchArg
  ? completed.filter((m) => String(m.matchId) === matchArg.split('=')[1])
  : completed.slice(0, limit);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSummary(matchId) {
  return fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${matchId}`);
}

// roundFromSummary is imported from lib/services/player-events.js (line 18) so
// the backfill and the live moment-sync capture store identical `round` strings
// and remain idempotent under INSERT OR IGNORE.

(async () => {
  let total = 0;
  let matchesDone = 0;
  for (const m of targets) {
    let data = null;
    try {
      data = await fetchSummary(m.matchId);
    } catch (e) {
      console.error(`  ⚠️  skip ${m.matchId}: ${e.message}`);
      continue;
    }
    const round = roundFromSummary(data);
    const keyEvents = data?.keyEvents ?? [];
    const meta = {
      homeTeamId: m.teams?.home?.id,
      awayTeamId: m.teams?.away?.id,
      stage: m.stage ?? null,
      round,
    };
    const events = extractPlayerEvents(m.matchId, keyEvents, meta);
    const n = upsertPlayerEvents(events);
    total += n;
    matchesDone += 1;
    console.log(`  ✅ ${m.matchId} round=${round || '?'} events=${events.length} (upserted ${n})`);
    await sleep(120); // be polite to the API
  }
  console.log(`\nDONE: ${matchesDone} matches scanned, ${total} player-event rows upserted (idempotent).`);
})();
