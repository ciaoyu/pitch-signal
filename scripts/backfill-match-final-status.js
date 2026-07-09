#!/usr/bin/env node
/**
 * Backfill final-status flags (KO-1)
 *
 * One-time script: marks matches that went to extra time / were decided by
 * penalties in the `matches` table (went_to_et / decided_by_pens columns added
 * by the KO-1 db migration). Detection reads the ESPN summary status:
 *   - detail "AET"            => went to extra time
 *   - detail "FT-Pens"        => decided by penalties (and therefore ET)
 *   - competitors[].shootoutScore present => decided by penalties (cross-check)
 *
 * Only knockout matches can reach ET/Pens, so group fixtures are skipped.
 * Idempotent: re-running is safe (writeFinalStatusFlags is set-true-only, and
 * writebackMatchScore guards existing scores).
 *
 * Usage:
 *   node scripts/backfill-match-final-status.js
 *   node scripts/backfill-match-final-status.js --limit=5
 *   node scripts/backfill-match-final-status.js --matchId=760488
 */

const { fetchJSON } = require('../services/espn');
const { writebackMatchScore } = require('../lib/services/score-writeback');

const schedule = require('../data/match_snapshot_schedule.json');
const completed = (schedule.matches || []).filter(
  (m) => m.status && m.status.completed && m.stage && m.stage !== 'group'
);

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : completed.length;
const matchArg = args.find((a) => a.startsWith('--matchId='));
const targets = matchArg
  ? completed.filter((m) => String(m.matchId) === matchArg.split('=')[1])
  : completed.slice(0, limit);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectFinalStatus(comp) {
  const detail = comp?.status?.type?.detail || '';
  const short = comp?.status?.type?.shortDetail || '';
  const text = `${detail} ${short}`.toUpperCase();
  let decidedByPens = /PENS/.test(text);
  let wentToEt = /AET/.test(text) || decidedByPens;
  const comps = comp?.competitors || [];
  if (comps.some((c) => c.shootoutScore != null && c.shootoutScore !== '')) decidedByPens = true;
  return { wentToEt, decidedByPens };
}

(async () => {
  let etCount = 0;
  let pensCount = 0;
  let done = 0;
  for (const m of targets) {
    let comp = null;
    try {
      const data = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${m.matchId}`);
      comp = data?.header?.competitions?.[0];
    } catch (e) {
      console.error(`  ⚠️  skip ${m.matchId}: ${e.message}`);
      continue;
    }
    if (!comp) { console.error(`  ⚠️  skip ${m.matchId}: no competitions`); continue; }

    const { wentToEt, decidedByPens } = detectFinalStatus(comp);
    const competitors = comp.competitors || [];
    const homeC = competitors.find((c) => c.homeAway === 'home') || competitors[0];
    const awayC = competitors.find((c) => c.homeAway === 'away') || competitors[1];
    const homeScore = homeC?.score;
    const awayScore = awayC?.score;
    const statusName = comp.status?.type?.state || comp.status?.type?.name || 'post';

    const res = writebackMatchScore({
      espnId: m.matchId,
      homeTeam: m.teams?.home?.id,
      awayTeam: m.teams?.away?.id,
      homeScore,
      awayScore,
      statusName,
      matchDate: (m.kickoffUtc || '').slice(0, 10),
      stage: m.stage,
      venue: m.venue,
      source: 'espn-backfill',
      wentToEt,
      decidedByPens,
    });

    if (wentToEt) etCount++;
    if (decidedByPens) pensCount++;
    done++;
    const tag = [wentToEt ? 'ET' : null, decidedByPens ? 'Pens' : null].filter(Boolean).join('+') || 'FT';
    console.log(`  ✅ ${m.matchId} ${m.stage} [${tag}] (${res.reason || 'ok'})`);
    await sleep(120);
  }
  console.log(`\nDONE: ${done} KO matches scanned, ${etCount} went to ET, ${pensCount} decided by penalties (idempotent).`);
})();
