'use strict';

/**
 * xG Data Service
 *
 * Responsibilities:
 * 1. Fetch xG statistics for finished matches from API-Football (100 req/day free tier, called by scheduled jobs)
 * 2. Store xG data into SQLite team_xg_stats table
 * 3. Expose getTeamXgProfile(teamId) for Poisson λ blending
 *
 * API-Football free tier: 100 req/day; frontend direct invocation is forbidden, only called via cron.
 * Key loaded from env: API_FOOTBALL_KEY
 */

const https = require('https');
const { db } = require('../db');

const API_BASE = 'https://v3.football.api-sports.io';
// FIFA World Cup 2026 league_id — API-Football ID to be confirmed and can be overridden in .env
const WC_LEAGUE_ID = process.env.API_FOOTBALL_WC_LEAGUE ?? '1';
const WC_SEASON    = process.env.API_FOOTBALL_WC_SEASON ?? '2026';

function fetchApiFootball(path) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = `${API_BASE}${path}`;
    const req = https.get(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 ? JSON.parse(raw) : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

/**
 * Query all completed WC2026 matches from API-Football
 * Returns fixture list where each item has fixture.id for fetching statistics
 */
async function fetchFinishedFixtures() {
  const data = await fetchApiFootball(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&status=FT`
  );
  return data?.response ?? [];
}

/**
 * Fetch match statistics for a single fixture, returning data including xG
 * @param {number} fixtureId
 */
async function fetchFixtureStats(fixtureId) {
  const data = await fetchApiFootball(`/fixtures/statistics?fixture=${fixtureId}`);
  return data?.response ?? [];
}

/**
 * Save xG data for a batch of fixtures to DB
 * Each cron run processes completed matches that do not yet have an xG record
 * Returns count of processed matches
 */
async function syncXgFromApiFootball() {
  if (!process.env.API_FOOTBALL_KEY) {
    console.log('[xg-service] API_FOOTBALL_KEY not set, skipping xG sync');
    return 0;
  }

  const fixtures = await fetchFinishedFixtures();
  if (!fixtures.length) return 0;

  let processed = 0;

  for (const fix of fixtures) {
    const fixtureId = fix.fixture?.id;
    const matchDate = (fix.fixture?.date ?? '').slice(0, 10);
    const homeTeam  = fix.teams?.home?.name ?? '';
    const awayTeam  = fix.teams?.away?.name ?? '';
    const homeId    = String(fix.teams?.home?.id ?? '');
    const awayId    = String(fix.teams?.away?.id ?? '');

    if (!fixtureId) continue;

    // Skip if record already exists (idempotency)
    const existing = db.prepare(
      `SELECT id FROM team_xg_stats WHERE fixture_id = ? LIMIT 1`
    ).get(fixtureId);
    if (existing) continue;

    const stats = await fetchFixtureStats(fixtureId);
    if (!stats.length) continue;

    for (const teamStats of stats) {
      const teamId   = String(teamStats.team?.id ?? '');
      const teamName = teamStats.team?.name ?? '';
      const isHome   = teamId === homeId;
      const oppId    = isHome ? awayId : homeId;
      const oppName  = isHome ? awayTeam : homeTeam;

      const xg = extractXg(teamStats.statistics ?? []);
      if (xg === null) continue;

      db.prepare(`
        INSERT OR IGNORE INTO team_xg_stats
          (fixture_id, match_date, team_id, team_name, opp_id, opp_name, xg, is_home)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fixtureId, matchDate, teamId, teamName, oppId, oppName, xg, isHome ? 1 : 0);
    }

    processed++;
    // Small delay to avoid exhausting 100 req/day quota in a short burst
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[xg-service] Synced xG for ${processed} fixtures`);
  return processed;
}

function extractXg(statistics) {
  const stat = statistics.find(s =>
    s.type === 'Expected Goals' || s.type === 'xG' || s.type === 'expected_goals'
  );
  if (!stat) return null;
  const val = parseFloat(stat.value);
  return Number.isFinite(val) ? val : null;
}

/**
 * For Poisson engine: returns team's xG offensive/defensive profile in this tournament
 * Returns null when sample size is insufficient (<2 matches), letting caller decide whether to fall back to mathematical λ
 *
 * @param {string} teamId  API-Football team id or ESPN id (requires mapping table)
 * @returns {{ avgXgFor, avgXgAgainst, matches } | null}
 */
function getTeamXgProfile(teamId) {
  if (!teamId) return null;
  const id = String(teamId);

  const rows = db.prepare(`
    SELECT xg, is_home FROM team_xg_stats WHERE team_id = ? ORDER BY match_date DESC LIMIT 10
  `).all(id);

  if (rows.length < 2) return null;

  const avgXgFor = rows.reduce((s, r) => s + r.xg, 0) / rows.length;

  // xG against: retrieve same-fixture records from opponent's perspective
  const against = db.prepare(`
    SELECT s.xg FROM team_xg_stats s
    WHERE s.opp_id = ?
    ORDER BY s.match_date DESC LIMIT 10
  `).all(id);

  const avgXgAgainst = against.length
    ? against.reduce((s, r) => s + r.xg, 0) / against.length
    : null;

  return { avgXgFor, avgXgAgainst, matches: rows.length };
}

module.exports = { syncXgFromApiFootball, getTeamXgProfile, fetchFinishedFixtures };
