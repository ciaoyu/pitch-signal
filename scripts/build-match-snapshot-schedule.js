'use strict';

/**
 * Build a per-match snapshot timetable from ESPN's World Cup scoreboard.
 *
 * The output is intentionally data-only. It is used by automation runners to
 * decide when a pre-match prediction snapshot and post-match review are due.
 */

const fs = require('fs');
const path = require('path');
const { fetchJSON, ESPN_BASE } = require('../services/espn');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'match_snapshot_schedule.json');
const START = process.env.SCHEDULE_START || '2026-06-10';
const END = process.env.SCHEDULE_END || '2026-07-20';
const PRE_MINUTES = Number.parseInt(process.env.PRE_SNAPSHOT_MINUTES || '60', 10);
const GROUP_POST_MINUTES = Number.parseInt(process.env.GROUP_POST_MINUTES || '135', 10);
const KNOCKOUT_POST_MINUTES = Number.parseInt(process.env.KNOCKOUT_POST_MINUTES || '225', 10);
const ANALYSIS_DELAY_MINUTES = Number.parseInt(process.env.ANALYSIS_DELAY_MINUTES || '15', 10);
const KNOCKOUT_START_UTC = Date.parse(process.env.KNOCKOUT_START_UTC || '2026-06-28T00:00:00Z');

function dateKey(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMinutes(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60 * 1000).toISOString();
}

function toBjt(iso) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function getCompetitors(event) {
  const comp = event.competitions?.[0] || {};
  const home = comp.competitors?.find((item) => item.homeAway === 'home') || {};
  const away = comp.competitors?.find((item) => item.homeAway === 'away') || {};
  return { comp, home, away };
}

function normalizeEvent(event) {
  const { comp, home, away } = getCompetitors(event);
  const kickoffUtc = event.date || comp.date;
  if (!event.id || !kickoffUtc || !home.team || !away.team) return null;

  const kickoffMs = Date.parse(kickoffUtc);
  const stage = kickoffMs >= KNOCKOUT_START_UTC ? 'knockout' : 'group';
  const postMinutes = stage === 'knockout' ? KNOCKOUT_POST_MINUTES : GROUP_POST_MINUTES;
  const postSnapshotAtUtc = addMinutes(kickoffUtc, postMinutes);
  const analysisAtUtc = addMinutes(postSnapshotAtUtc, ANALYSIS_DELAY_MINUTES);
  const statusType = comp.status?.type || event.status?.type || {};

  return {
    matchId: String(event.id),
    name: event.name || `${away.team.displayName} at ${home.team.displayName}`,
    shortName: event.shortName || '',
    stage,
    kickoffUtc: new Date(kickoffUtc).toISOString(),
    kickoffBjt: toBjt(kickoffUtc),
    preSnapshotAtUtc: addMinutes(kickoffUtc, -PRE_MINUTES),
    preSnapshotAtBjt: toBjt(addMinutes(kickoffUtc, -PRE_MINUTES)),
    postSnapshotAtUtc,
    postSnapshotAtBjt: toBjt(postSnapshotAtUtc),
    analysisAtUtc,
    analysisAtBjt: toBjt(analysisAtUtc),
    teams: {
      home: {
        id: String(home.team.id || ''),
        name: home.team.displayName || home.team.name || '',
        abbreviation: home.team.abbreviation || '',
      },
      away: {
        id: String(away.team.id || ''),
        name: away.team.displayName || away.team.name || '',
        abbreviation: away.team.abbreviation || '',
      },
    },
    venue: comp.venue?.fullName || event.venue?.fullName || '',
    status: {
      state: statusType.state || '',
      name: statusType.name || '',
      completed: Boolean(statusType.completed),
      detail: statusType.detail || '',
      shortDetail: statusType.shortDetail || '',
    },
    snapshotPolicy: {
      pre: `Run /api/predict/${event.id} after preSnapshotAtUtc and before kickoffUtc. If kickoff has passed with no pre snapshot, mark pre_missed; do not fabricate it.`,
      post: `Run /api/post-match-review/${event.id} after postSnapshotAtUtc. If the match is not final, retry later.`,
    },
  };
}

async function fetchDay(date) {
  const url = `${ESPN_BASE}/scoreboard?dates=${dateKey(date)}&limit=200`;
  const payload = await fetchJSON(url);
  return Array.isArray(payload.events) ? payload.events : [];
}

async function main() {
  const start = new Date(`${START}T00:00:00Z`);
  const end = new Date(`${END}T00:00:00Z`);
  const byId = new Map();

  for (let day = start; day <= end; day = addDays(day, 1)) {
    const events = await fetchDay(day);
    for (const event of events) {
      const normalized = normalizeEvent(event);
      if (normalized) byId.set(normalized.matchId, normalized);
    }
  }

  const matches = [...byId.values()].sort((a, b) => Date.parse(a.kickoffUtc) - Date.parse(b.kickoffUtc));
  const output = {
    generatedAt: new Date().toISOString(),
    source: ESPN_BASE,
    timezone: 'Asia/Shanghai',
    window: { start: START, end: END },
    policy: {
      preSnapshotMinutesBeforeKickoff: PRE_MINUTES,
      groupPostSnapshotMinutesAfterKickoff: GROUP_POST_MINUTES,
      knockoutPostSnapshotMinutesAfterKickoff: KNOCKOUT_POST_MINUTES,
      analysisDelayMinutesAfterPostSnapshot: ANALYSIS_DELAY_MINUTES,
      noBackfillAfterKickoff: true,
    },
    matchCount: matches.length,
    matches,
  };

  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${matches.length} matches to ${OUTPUT}`);
  if (matches[0]) console.log(`First: ${matches[0].matchId} ${matches[0].kickoffBjt} ${matches[0].name}`);
  if (matches[matches.length - 1]) console.log(`Last: ${matches[matches.length - 1].matchId} ${matches[matches.length - 1].kickoffBjt} ${matches[matches.length - 1].name}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
