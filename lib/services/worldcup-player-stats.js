'use strict';

const fs = require('fs');
const { db } = require('../db');
const { resolveDataPath } = require('../data-resolver');

let cached = null;
let officialSnapshotCache = null;
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}
function loadTournamentFiles() {
  if (cached) return cached;
  try {
    cached = {
      squads: JSON.parse(fs.readFileSync(resolveDataPath('squads.json'), 'utf8')),
      matches: JSON.parse(fs.readFileSync(resolveDataPath('matches.json'), 'utf8')).matches || [],
      lineups: JSON.parse(fs.readFileSync(resolveDataPath('lineups.json'), 'utf8')),
    };
  } catch {
    cached = { squads: {}, matches: [], lineups: {} };
  }
  return cached;
}

function loadOfficialPlayerStatistics() {
  try {
    const filePath = resolveDataPath('fifa_player_statistics.json');
    const stat = fs.statSync(filePath);
    if (officialSnapshotCache?.path === filePath && officialSnapshotCache.mtimeMs === stat.mtimeMs) return officialSnapshotCache.data;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    officialSnapshotCache = { path: filePath, mtimeMs: stat.mtimeMs, data };
    return data;
  } catch {
    return null;
  }
}

function getOfficialTournamentScorers() {
  const snapshot = loadOfficialPlayerStatistics();
  if (!snapshot || !Array.isArray(snapshot.players)) return null;
  return {
    players: snapshot.players,
    source: snapshot.source,
    retrievedAt: snapshot.retrievedAt,
    scope: snapshot.scope,
  };
}

function getWorldCupPlayerStats(name) {
  const files = loadTournamentFiles();
  const key = normalize(name);
  let player = null;
  let teamCode = null;
  for (const [code, team] of Object.entries(files.squads)) {
    const found = (team.players || []).find(candidate => normalize(candidate.name) === key);
    if (found) { player = found; teamCode = code; break; }
  }
  if (!player) return null;
  const official = getOfficialTournamentScorers();
  const officialPlayer = official?.players.find(candidate => normalize(candidate.name) === key) || null;

  const finishedIds = new Set(files.matches.filter(match => match.status === 'finished').map(match => String(match.id)));
  let starts = 0;
  let appearances = 0;
  for (const [matchId, lineup] of Object.entries(files.lineups)) {
    if (!finishedIds.has(String(matchId))) continue;
    const homeXI = lineup.home?.xi || [];
    const awayXI = lineup.away?.xi || [];
    const started = [...homeXI, ...awayXI].some(candidate => normalize(candidate.name) === key);
    const substitutedOn = [...(lineup.home?.substitutions || []), ...(lineup.away?.substitutions || [])]
      .some(sub => {
        const players = [...(lineup.home?.subs || []), ...(lineup.away?.subs || [])];
        return normalize(players.find(candidate => String(candidate.id) === String(sub.on))?.name) === key;
      });
    if (started || substitutedOn) appearances += 1;
    if (started) starts += 1;
  }

  const goalRows = db.prepare(`
    SELECT COUNT(*) AS count FROM player_match_events
    WHERE lower(replace(player_name, 'é', 'e')) LIKE ? AND event_type = 'goal'
  `).get(`%${String(name).toLowerCase().replace('é', 'e')}%`);
  const eventLedgerGoals = Number(goalRows?.count || 0);
  // squads.json is the FIFA-synchronised tournament player-stat snapshot. The
  // event ledger is useful for audit, but can lag when a scorer sync misses an
  // event (as it currently does for Mbappé), so it must never overwrite it.
  const tournamentGoals = officialPlayer?.goals ?? player.wcGoals ?? eventLedgerGoals;

  return {
    teamCode,
    caps: player.caps ?? null,
    goals: player.goals ?? null,
    tournamentApps: appearances || player.wcApps || 0,
    tournamentStarts: starts || null,
    tournamentGoals,
    tournamentAssists: officialPlayer?.assists ?? null,
    tournamentMinutes: officialPlayer?.minutes ?? null,
    tournamentRank: officialPlayer?.rank ?? null,
    tournamentYellow: player.wcYellow ?? 0,
    tournamentRed: player.wcRed ?? 0,
    dataQuality: 'tournament-live',
    source: officialPlayer ? 'FIFA official player-statistics snapshot (primary) + lineups + player_match_events (audit)' : 'wc2026 squads (primary) + lineups + player_match_events (audit)',
    sourceUrl: officialPlayer ? official.source : null,
    sourceRetrievedAt: officialPlayer ? official.retrievedAt : null,
    eventLedgerGoals,
    eventLedgerComplete: eventLedgerGoals === tournamentGoals,
  };
}

module.exports = { getWorldCupPlayerStats, getOfficialTournamentScorers, normalize };
