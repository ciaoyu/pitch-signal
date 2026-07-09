'use strict';

/**
 * Official FIFA API Client
 *
 * Endpoint: https://api.fifa.com/api/v3/
 * No API key required, no rate limits. Returns official schedule, real-time lineup coordinates, and substitution events.
 *
 * Competition ID: 17 (FIFA World Cup)
 * Season ID: 285023 (2026)
 */

const https = require('https');

const BASE = 'https://api.fifa.com/api/v3';
const COMP = 17;
const SEASON = 285023;

const { getCached, setCache, cache } = require('../../middleware/cache');

let _apiStatus = 'ok'; // 'ok' | 'stale' | 'down'
let _lastSyncAt = null;

function getStatus() {
  return _apiStatus;
}

function getLastSyncAt() {
  return _lastSyncAt ? new Date(_lastSyncAt).toISOString() : null;
}

function _resetStatus() {
  _apiStatus = 'ok';
  _lastSyncAt = null;
}

function _getFresh(key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts < ttlMs) {
    return entry.data;
  }
  return null;
}

function _getStale(key) {
  const entry = cache.get(key);
  return entry ? entry.data : null;
}

function validateCalendarSchema(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.Results)) return false;
  if (data.Results.length > 0) {
    const first = data.Results[0];
    if (!first || typeof first !== 'object') return false;
    if (!('IdMatch' in first) && !('IdStage' in first) && !('HomeTeam' in first)) return false;
  }
  return true;
}

function validateLiveMatchSchema(data) {
  if (!data || typeof data !== 'object') return false;
  if (!('IdMatch' in data) || !('IdStage' in data)) return false;
  if (data.HomeTeam && typeof data.HomeTeam !== 'object') return false;
  if (data.AwayTeam && typeof data.AwayTeam !== 'object') return false;
  return true;
}

function _handleFailure(url, resolve) {
  const staleData = _getStale(url);
  if (staleData) {
    _apiStatus = 'stale';
    resolve({ data: staleData, stale: true });
  } else {
    _apiStatus = 'down';
    resolve({ data: null, stale: false, down: true });
  }
}

function fetchJsonWithFallback(url, ttlMs = 30000, schemaValidator = null) {
  const fresh = _getFresh(url, ttlMs);
  if (fresh) {
    return Promise.resolve({ data: fresh, stale: false });
  }

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            throw new Error(`HTTP ${res.statusCode}`);
          }
          const data = JSON.parse(raw);
          if (schemaValidator && !schemaValidator(data)) {
            throw new Error('Schema validation failed');
          }
          setCache(url, data);
          _apiStatus = 'ok';
          _lastSyncAt = Date.now();
          resolve({ data, stale: false });
        } catch {
          _handleFailure(url, resolve);
        }
      });
    });
    req.on('error', () => _handleFailure(url, resolve));
    req.setTimeout(12000, () => {
      req.destroy();
      _handleFailure(url, resolve);
    });
  });
}

/**
 * Fetch calendar schedule list
 * Returns all WC2026 matches, including IdMatch, MatchStatus, start time, and both teams' IdCountry
 * MatchStatus: 0=finished, 1=scheduled, 3=live, 12=lineup_confirmed
 */
async function fetchCalendar() {
  const url = `${BASE}/calendar/matches?idCompetition=${COMP}&idSeason=${SEASON}&count=500&language=en`;
  const result = await fetchJsonWithFallback(url, 5 * 60 * 1000, validateCalendarSchema);
  const results = result.data?.Results ?? [];
  if (result.stale) results.stale = true;
  if (result.down) results.down = true;
  return results;
}

/**
 * Fetch live match data for a single match
 * Returns actual tactical formation string, player positional coordinates, and substitution events
 *
 * @param {string} idStage - FIFA Stage ID (from calendar result)
 * @param {string} idMatch - FIFA Match UUID
 */
async function fetchLiveMatch(idStage, idMatch) {
  const url = `${BASE}/live/football/${COMP}/${SEASON}/${idStage}/${idMatch}?language=en`;
  const result = await fetchJsonWithFallback(url, 20000, validateLiveMatchSchema);
  if (!result.data) return null;

  const parsed = parseLiveMatch(result.data);
  if (result.stale) parsed.stale = true;
  if (result.down) parsed.down = true;
  return parsed;
}

/**
 * Parse live match response and extract required fields
 */
function parseLiveMatch(raw) {
  const home = raw.HomeTeam ?? {};
  const away = raw.AwayTeam ?? {};

  return {
    matchId: raw.IdMatch,
    stageId: raw.IdStage,
    status: raw.MatchStatus, // 0=finished, 1=scheduled, 3=live
    minute: raw.MatchTime ?? null,
    homeScore: raw.HomeTeam?.Score ?? 0,
    awayScore: raw.AwayTeam?.Score ?? 0,
    homeTeam: {
      id: home.IdCountry ?? home.IdTeam ?? null,
      name: home.TeamName ?? home.Name ?? null,
    },
    awayTeam: {
      id: away.IdCountry ?? away.IdTeam ?? null,
      name: away.TeamName ?? away.Name ?? null,
    },

    // Actual tactical formation string
    homeTactics: home.Tactics ?? null,
    awayTactics: away.Tactics ?? null,

    // Player positions (FIFA normalized coordinates 0-100)
    homePlayers: parsePlayers(home.Players ?? []),
    awayPlayers: parsePlayers(away.Players ?? []),

    // Event stream (goals, substitutions, red/yellow cards)
    events: parseEvents(raw.MatchEvents ?? []),
  };
}

function parsePlayers(players) {
  return players.map(p => ({
    id: p.IdPlayer,
    name: p.PlayerName?.[0]?.Description ?? '',
    shirtNumber: p.ShirtNumber,
    position: p.Position, // GK=0, DF=2, MF=3, FW=4
    positionX: p.PositionX ?? p.LineupX ?? null,
    positionY: p.PositionY ?? p.LineupY ?? null,
    status: p.Status, // 1=starter, 2=substituted_in, 3=substituted_out
    minuteIn: p.SubstitutedIn ?? null,
    minuteOut: p.SubstitutedOut ?? null,
  }));
}

function parseEvents(events) {
  return events.map(e => ({
    id: e.IdEvent,
    type: e.Type,       // 0=goal, 2=yellow_card, 3=red_card, 5=substitution, 6=VAR, 65=own_goal
    minute: e.MatchMinute,
    minuteAdded: e.MatchMinuteExtra ?? 0,
    team: e.IdTeam,
    player: e.IdPlayer,
    playerOff: e.IdPlayerOff ?? null, // Player substituted off during substitution
    description: e.TypeLocalized?.[0]?.Description ?? '',
  }));
}

/**
 * Lookup IdMatch by team FIFA country codes
 * Used to map two team FIFA codes retrieved from ESPN match_id to a FIFA match
 *
 * @param {string} homeCode - e.g. "ARG"
 * @param {string} awayCode - e.g. "AUT"
 * @param {string} [datePrefix] - e.g. "2026-06-30" (optional, speeds up search)
 */
async function findMatchByTeams(homeCode, awayCode, datePrefix) {
  const matches = await fetchCalendar();
  return matches.find(m => {
    const h = m.HomeTeam?.IdCountry;
    const a = m.AwayTeam?.IdCountry;
    const matchDate = (m.Date ?? '').slice(0, 10);
    const dateOk = !datePrefix || matchDate === datePrefix;
    return dateOk && (
      (h === homeCode && a === awayCode) ||
      (h === awayCode && a === homeCode)
    );
  }) ?? null;
}

/**
 * FIFA MatchStatus code -> semantic string
 */
function statusLabel(code) {
  const map = { 0: 'finished', 1: 'scheduled', 3: 'live', 12: 'lineup_confirmed' };
  return map[code] ?? 'unknown';
}

module.exports = {
  fetchCalendar,
  fetchLiveMatch,
  findMatchByTeams,
  statusLabel,
  getStatus,
  getLastSyncAt,
  // Export for testing
  _parseLiveMatch: parseLiveMatch,
  _validateCalendarSchema: validateCalendarSchema,
  _validateLiveMatchSchema: validateLiveMatchSchema,
  _fetchJsonWithFallback: fetchJsonWithFallback,
  _resetStatus,
};
