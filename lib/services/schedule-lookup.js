'use strict';

/**
 * Schedule lookup (KO-1 shared infra, consumed by KO-5 fatigue signal)
 *
 * Builds a per-team chronological view of the tournament from
 * data/match_snapshot_schedule.json: previous match date/venue/status and the
 * rest days available before a given fixture. Travel distance between the
 * previous venue and the current one is derived via lib/services/venue-distance.
 *
 * Pure / synchronous / idempotent. The schedule is loaded and indexed once.
 */

const path = require('path');
const schedule = require(path.join(__dirname, '..', '..', 'data', 'match_snapshot_schedule.json'));
const { distanceKm } = require('./venue-distance');

let _index = null;
function buildIndex() {
  if (_index) return _index;
  const byTeam = new Map();
  for (const m of schedule.matches || []) {
    const homeId = m.teams?.home?.id;
    const awayId = m.teams?.away?.id;
    const entry = {
      matchId: m.matchId,
      date: m.kickoffUtc || null,
      venue: m.venue || null,
      stage: m.stage || null,
      status: m.status || null,
      homeId,
      awayId,
    };
    for (const tid of [homeId, awayId]) {
      if (!tid) continue;
      if (!byTeam.has(tid)) byTeam.set(tid, []);
      byTeam.get(tid).push(entry);
    }
  }
  // Sort each team's matches by kickoff ascending.
  for (const list of byTeam.values()) {
    list.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }
  _index = byTeam;
  return _index;
}

// Days between two ISO date strings (absolute, rounded to 1 decimal).
function daysBetween(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!isFinite(ta) || !isFinite(tb)) return null;
  return Math.round((Math.abs(tb - ta) / 86400000) * 10) / 10;
}

/**
 * Chronologically ordered matches for a team (oldest first).
 * @param {string} teamId
 * @returns {Array} of match entries
 */
function teamMatches(teamId) {
  const idx = buildIndex();
  return (idx.get(String(teamId)) || []).slice();
}

/**
 * The fixture immediately preceding `matchId` for `teamId`.
 * @returns {object|null}
 */
function previousMatch(matchId, teamId) {
  const list = teamMatches(teamId);
  const i = list.findIndex((m) => String(m.matchId) === String(matchId));
  if (i <= 0) return null;
  return list[i - 1];
}

/**
 * Rest days available before `matchId` for `teamId` (gap vs the team's previous
 * match kickoff). Null if no previous match / dates unknown.
 * @param {string} matchId
 * @param {string} teamId
 * @returns {number|null}
 */
function restDaysBeforeMatch(matchId, teamId) {
  const prev = previousMatch(matchId, teamId);
  const cur = teamMatches(teamId).find((m) => String(m.matchId) === String(matchId));
  if (!prev || !cur || !prev.date || !cur.date) return null;
  return daysBetween(prev.date, cur.date);
}

/**
 * Travel distance (km) between the team's previous venue and the current venue.
 * Null if either venue cannot be resolved.
 * @param {string} matchId
 * @param {string} teamId
 * @returns {number|null}
 */
function travelKmToMatch(matchId, teamId) {
  const prev = previousMatch(matchId, teamId);
  const cur = teamMatches(teamId).find((m) => String(m.matchId) === String(matchId));
  if (!prev || !cur || !prev.venue || !cur.venue) return null;
  return distanceKm(prev.venue, cur.venue);
}

module.exports = { teamMatches, previousMatch, restDaysBeforeMatch, travelKmToMatch, buildIndex };
