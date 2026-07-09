'use strict';

/**
 * lineups-source.js
 * Match formation/starting XI/substitution data source
 *
 * Responsibilities:
 * - Given ESPN match ID, query lineups.json via match ID bridge
 * - Output { homeFormation, awayFormation, homeXI, awayXI, substitutions } according to formation rules
 * - Formation rule: if last 2 real tactics for the team match -> use it; if different -> use most recent; no history -> default formation
 *
 * Does not touch matchup-spatial.js (integrated by orchestrator)
 */

const fs = require('fs');
const path = require('path');
const playerNameZh = require('./player-name-zh');
const { resolveDataPath } = require('./data-resolver');

const ROOT_DATA = path.join(__dirname, '..', 'data');

// === Lazy loaded singletons ===
let _bridge = null;
let _lineups = null;
let _matches = null;
let _schedule = null;
let _ratings = null;

function loadBridge() {
  if (!_bridge) {
    try {
      _bridge = JSON.parse(fs.readFileSync(resolveDataPath('match_id_bridge.json'), 'utf8'));
    } catch { console.debug('lineups-source: id_bridge lookup failed for fifa code'); console.debug('lineups-source: failed to parse player-ratings.json'); console.debug('lineups-source: failed to parse match_snapshot_schedule.json'); console.debug('lineups-source: failed to parse matches.json'); console.debug('lineups-source: failed to parse lineups.json'); console.debug('lineups-source: failed to parse match_id_bridge.json');
      _bridge = { bridge: {}, reverseBridge: {} };
    }
  }
  return _bridge;
}

function loadLineups() {
  if (!_lineups) {
    try {
      _lineups = JSON.parse(fs.readFileSync(resolveDataPath('lineups.json'), 'utf8'));
    } catch {
      _lineups = {};
    }
  }
  return _lineups;
}

function loadMatches() {
  if (!_matches) {
    try {
      _matches = JSON.parse(fs.readFileSync(resolveDataPath('matches.json'), 'utf8'));
    } catch {
      _matches = { matches: [] };
    }
  }
  return _matches;
}

function loadSchedule() {
  if (!_schedule) {
    try {
      const dataDir = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
      _schedule = JSON.parse(fs.readFileSync(path.join(dataDir, 'match_snapshot_schedule.json'), 'utf8'));
    } catch {
      _schedule = { matches: [] };
    }
  }
  return _schedule;
}

function loadRatings() {
  if (!_ratings) {
    try {
      _ratings = JSON.parse(fs.readFileSync(resolveDataPath('player-ratings.json'), 'utf8'));
    } catch {
      _ratings = { data: {} };
    }
  }
  return _ratings;
}

/**
 * Lookup FIFA match ID via ESPN match ID
 */
function espnToFifa(espnMatchId) {
  const bridge = loadBridge();
  return bridge.reverseBridge?.[String(espnMatchId)] || null;
}

/**
 * Lookup ESPN match ID via FIFA match ID
 */
function fifaToEspn(fifaMatchId) {
  const bridge = loadBridge();
  const entry = bridge.bridge?.[String(fifaMatchId)];
  return entry ? entry.fifa_match_id : null;
}

/**
 * Get ESPN team ID corresponding to team code
 */
function getEspnTeamId(fifaCode) {
  try {
    const idBridge = JSON.parse(fs.readFileSync(resolveDataPath('id_bridge.json'), 'utf8'));
    return idBridge[fifaCode]?.espn_id || null;
  } catch {
    return null;
  }
}

/**
 * Get team default formation (from player-ratings.json)
 */
function getTeamDefaultFormation(fifaCode) {
  const espnId = getEspnTeamId(fifaCode);
  if (!espnId) return null;

  const ratings = loadRatings();
  const teamData = ratings.data?.[String(espnId)];
  return teamData?.formation || null;
}

/**
 * Get a team's historical formations across all lineups (sorted by match date)
 * Returns [{ fifaMatchId, tactics, date, opponentCode, isHome }]
 */
function getTeamFormationHistory(fifaCode) {
  const lineups = loadLineups();
  const matches = loadMatches();

  // Build fast index of FIFA match ID -> match info
  const matchIndex = new Map();
  for (const m of (matches.matches || [])) {
    matchIndex.set(String(m.id), m);
  }

  const history = [];

  for (const [fifaMatchId, entry] of Object.entries(lineups)) {
    const matchInfo = matchIndex.get(fifaMatchId);
    if (!matchInfo) continue;

    const homeCode = (matchInfo.home?.code || '').trim().toUpperCase();
    const awayCode = (matchInfo.away?.code || '').trim().toUpperCase();
    const targetCode = fifaCode.trim().toUpperCase();

    let tactics = null;
    let isHome = false;
    let opponentCode = '';

    if (homeCode === targetCode && entry.home?.tactics) {
      tactics = entry.home.tactics;
      isHome = true;
      opponentCode = awayCode;
    } else if (awayCode === targetCode && entry.away?.tactics) {
      tactics = entry.away.tactics;
      isHome = false;
      opponentCode = homeCode;
    }

    if (tactics) {
      history.push({
        fifaMatchId,
        tactics,
        date: matchInfo.date || null,
        opponentCode,
        isHome,
      });
    }
  }

  // Sort by date (ascending, most recent last)
  history.sort((a, b) => {
    const da = Date.parse(a.date) || 0;
    const db = Date.parse(b.date) || 0;
    return da - db;
  });

  return history;
}

/**
 * Formation rules:
 * - If last 2 real tactics match -> use it
 * - If different -> use most recent
 * - If no history -> team default formation (from player-ratings.json; fallback to 4-3-3 acceptable)
 *
 * If current match already has lineups (formation published), prioritize current match real formation
 */
function resolveFormation(fifaCode, currentFifaMatchId) {
  // If current match already has real formation, return directly
  if (currentFifaMatchId) {
    const lineups = loadLineups();
    const entry = lineups[currentFifaMatchId];
    if (entry) {
      const matches = loadMatches();
      const matchIndex = new Map();
      for (const m of (matches.matches || [])) {
        matchIndex.set(String(m.id), m);
      }
      const matchInfo = matchIndex.get(currentFifaMatchId);
      if (matchInfo) {
        const homeCode = (matchInfo.home?.code || '').trim().toUpperCase();
        const awayCode = (matchInfo.away?.code || '').trim().toUpperCase();
        if (homeCode === fifaCode.trim().toUpperCase() && entry.home?.tactics) {
          return { formation: entry.home.tactics, source: 'current_lineups' };
        } else if (awayCode === fifaCode.trim().toUpperCase() && entry.away?.tactics) {
          return { formation: entry.away.tactics, source: 'current_lineups' };
        }
      }
    }
  }

  // Historical formation rules
  const history = getTeamFormationHistory(fifaCode);

  if (history.length >= 2) {
    const last = history[history.length - 1].tactics;
    const secondLast = history[history.length - 2].tactics;

    if (last === secondLast) {
      return { formation: last, source: 'last_2_same', historyCount: history.length };
    } else {
      return { formation: last, source: 'latest', historyCount: history.length };
    }
  } else if (history.length === 1) {
    return { formation: history[0].tactics, source: 'only_1_historical', historyCount: 1 };
  }

  // No history -> default formation
  const defaultFormation = getTeamDefaultFormation(fifaCode);
  return {
    formation: defaultFormation || '4-3-3',
    source: defaultFormation ? 'player_ratings' : 'fallback_433',
    historyCount: 0,
  };
}

/**
 * Get match formation, starting XI, and substitution data
 *
 * @param {string|number} espnMatchId - ESPN match ID (e.g., 760415)
 * @returns {{
 *   espnMatchId: string,
 *   fifaMatchId: string|null,
 *   homeFormation: string|null,
 *   awayFormation: string|null,
 *   homeFormationSource: string|null,
 *   awayFormationSource: string|null,
 *   homeXI: object[]|null,
 *   awayXI: object[]|null,
 *   substitutions: object[],
 *   hasRealLineups: boolean,
 * }} 
 */
function getLineups(espnMatchId) {
  const espnId = String(espnMatchId);
  const fifaMatchId = espnToFifa(espnId);

  const result = {
    espnMatchId: espnId,
    fifaMatchId,
    homeFormation: null,
    awayFormation: null,
    homeFormationSource: null,
    awayFormationSource: null,
    homeXI: null,
    awayXI: null,
    substitutions: [],
    hasRealLineups: false,
  };

  if (!fifaMatchId) {
    // No bridge entry, try inferring formation from schedule
    return resolveFromScheduleOnly(result);
  }

  const lineups = loadLineups();
  const matches = loadMatches();

  // Look up match info
  const matchIndex = new Map();
  for (const m of (matches.matches || [])) {
    matchIndex.set(String(m.id), m);
  }
  const matchInfo = matchIndex.get(espnId);
  if (!matchInfo) {
    return resolveFromScheduleOnly(result);
  }

  const homeCode = (matchInfo.home?.code || '').trim().toUpperCase();
  const awayCode = (matchInfo.away?.code || '').trim().toUpperCase();

  // Check if real lineups exist
  const lineupEntry = lineups[espnId];

  if (lineupEntry) {
    // Has real lineups
    result.hasRealLineups = true;

    // Formation (published real)
    result.homeFormation = lineupEntry.home?.tactics || null;
    result.awayFormation = lineupEntry.away?.tactics || null;
    result.homeFormationSource = 'published_lineups';
    result.awayFormationSource = 'published_lineups';

    // Starting XI
    result.homeXI = formatXI(lineupEntry.home?.xi || []);
    result.awayXI = formatXI(lineupEntry.away?.xi || []);

    // Substitution events
    const playerNames = new Map();
    const playerNamesZh = new Map();
    const playerJerseys = new Map();
    const buildPlayerMap = (players) => {
      for (const p of players) {
        if (p.id) {
          if (p.name) playerNames.set(String(p.id), p.name);
          const zh = p.nameZh || playerNameZh.lookup(p.name) || null;
          if (zh) playerNamesZh.set(String(p.id), zh);
          if (p.number) playerJerseys.set(String(p.id), String(p.number));
        }
      }
    };
    if (lineupEntry.home?.xi) buildPlayerMap(lineupEntry.home.xi);
    if (lineupEntry.home?.subs) buildPlayerMap(lineupEntry.home.subs);
    if (lineupEntry.home?.bench) buildPlayerMap(lineupEntry.home.bench);
    if (lineupEntry.away?.xi) buildPlayerMap(lineupEntry.away.xi);
    if (lineupEntry.away?.subs) buildPlayerMap(lineupEntry.away.subs);
    if (lineupEntry.away?.bench) buildPlayerMap(lineupEntry.away.bench);

    const makeSub = (s, side, code) => ({
      off: s.off,
      offName: playerNames.get(String(s.off)) || '?',
      offNameZh: playerNamesZh.get(String(s.off)) || null,
      offJersey: playerJerseys.get(String(s.off)) || '?',
      on: s.on,
      onName: playerNames.get(String(s.on)) || '?',
      onNameZh: playerNamesZh.get(String(s.on)) || null,
      onJersey: playerJerseys.get(String(s.on)) || '?',
      minute: s.minute || '?',
      period: s.period ?? null,
      side,
      fifaCode: code,
    });

    const homeSubs = (lineupEntry.home?.substitutions || []).map(s => makeSub(s, 'home', homeCode));
    const awaySubs = (lineupEntry.away?.substitutions || []).map(s => makeSub(s, 'away', awayCode));
    result.substitutions = [...homeSubs, ...awaySubs].sort((a, b) => {
      // Sort by minute (parsed as integer)
      const ma = parseInt(a.minute) || 0;
      const mb = parseInt(b.minute) || 0;
      return ma - mb;
    });
  } else {
    // No real lineups -- formation derived by rules, XI=null
    if (homeCode) {
      const homeResolved = resolveFormation(homeCode, null);
      result.homeFormation = homeResolved.formation;
      result.homeFormationSource = homeResolved.source;
    }
    if (awayCode) {
      const awayResolved = resolveFormation(awayCode, null);
      result.awayFormation = awayResolved.formation;
      result.awayFormationSource = awayResolved.source;
    }
    // XI = null (engine derives projected XI)
  }

  return result;
}

/**
 * When bridge lookup fails, try getting team info from schedule and resolving formation
 */
function resolveFromScheduleOnly(result) {
  const schedule = loadSchedule();
  const espnId = result.espnMatchId;

  const espnMatch = (schedule.matches || []).find(
    m => String(m.matchId) === espnId
  );

  if (!espnMatch) return result;

  const homeAbbr = (espnMatch.teams?.home?.abbreviation || '').trim().toUpperCase();
  const awayAbbr = (espnMatch.teams?.away?.abbreviation || '').trim().toUpperCase();

  if (homeAbbr) {
    const resolved = resolveFormation(homeAbbr, null);
    result.homeFormation = resolved.formation;
    result.homeFormationSource = resolved.source;
  }
  if (awayAbbr) {
    const resolved = resolveFormation(awayAbbr, null);
    result.awayFormation = resolved.formation;
    result.awayFormationSource = resolved.source;
  }

  return result;
}

/**
 * Format XI data: extract key fields
 */
function formatXI(xiArray) {
  return xiArray.map(p => ({
    fifaPlayerId: p.id || null,
    name: p.name || '',
    nameZh: p.nameZh || playerNameZh.lookup(p.name) || null,
    number: p.number || null,
    pos: p.gk ? 'GK' : p.fieldPos === 1 ? 'DF' : p.fieldPos === 2 ? 'MF' : p.fieldPos === 3 ? 'FW' : '??',
    gk: Boolean(p.gk),
    captain: Boolean(p.captain),
    fieldPos: p.fieldPos ?? null,
  }));
}

/**
 * Get match substitution data (for substitutions route)
 *
 * @param {string|number} espnMatchId
 * @returns {{ espnMatchId, fifaMatchId, substitutions: object[], hasData: boolean }}
 */
function getSubstitutions(espnMatchId) {
  const espnId = String(espnMatchId);
  const fifaMatchId = espnToFifa(espnId);

  if (!fifaMatchId) {
    return {
      espnMatchId: espnId,
      fifaMatchId: null,
      substitutions: [],
      hasData: false,
      error: 'no_bridge',
    };
  }

  const lineups = loadLineups();
  const matches = loadMatches();
  const lineupEntry = lineups[espnId];

  if (!lineupEntry) {
    return {
      espnMatchId: espnId,
      fifaMatchId,
      substitutions: [],
      hasData: false,
      note: 'no_lineups_yet',
    };
  }

  // Look up home/away team codes
  const matchIndex = new Map();
  for (const m of (matches.matches || [])) {
    matchIndex.set(String(m.id), m);
  }
  const matchInfo = matchIndex.get(espnId);
  const homeCode = matchInfo?.home?.code || '?';
  const awayCode = matchInfo?.away?.code || '?';

  // Build player name lookup table (from XI + subs) -- English + Chinese
  const playerNames = new Map();
  const playerNamesZh = new Map();
  const playerJerseys = new Map();
  const buildPlayerMap = (players) => {
    for (const p of players) {
      if (p.id) {
        if (p.name) playerNames.set(String(p.id), p.name);
        const zh = p.nameZh || playerNameZh.lookup(p.name) || null;
        if (zh) playerNamesZh.set(String(p.id), zh);
        if (p.number) playerJerseys.set(String(p.id), String(p.number));
      }
    }
  };
  if (lineupEntry.home?.xi) buildPlayerMap(lineupEntry.home.xi);
  if (lineupEntry.home?.subs) buildPlayerMap(lineupEntry.home.subs);
  if (lineupEntry.home?.bench) buildPlayerMap(lineupEntry.home.bench);
  if (lineupEntry.away?.xi) buildPlayerMap(lineupEntry.away.xi);
  if (lineupEntry.away?.subs) buildPlayerMap(lineupEntry.away.subs);
  if (lineupEntry.away?.bench) buildPlayerMap(lineupEntry.away.bench);

  const makeSub = (s, side, code) => ({
    off: s.off,
    offName: playerNames.get(String(s.off)) || '?',
    offNameZh: playerNamesZh.get(String(s.off)) || null,
    offJersey: playerJerseys.get(String(s.off)) || '?',
    on: s.on,
    onName: playerNames.get(String(s.on)) || '?',
    onNameZh: playerNamesZh.get(String(s.on)) || null,
    onJersey: playerJerseys.get(String(s.on)) || '?',
    minute: s.minute || '?',
    period: s.period ?? null,
    side,
    teamCode: code,
  });

  const homeSubs = (lineupEntry.home?.substitutions || []).map(s => makeSub(s, 'home', homeCode));
  const awaySubs = (lineupEntry.away?.substitutions || []).map(s => makeSub(s, 'away', awayCode));

  const allSubs = [...homeSubs, ...awaySubs].sort((a, b) => {
    const ma = parseInt(a.minute) || 0;
    const mb = parseInt(b.minute) || 0;
    return ma - mb;
  });

  return {
    espnMatchId: espnId,
    fifaMatchId,
    substitutions: allSubs,
    hasData: true,
    homeSubs: homeSubs.length,
    awaySubs: awaySubs.length,
    total: allSubs.length,
    teams: { home: homeCode, away: awayCode },
  };
}

/**
 * Clear cache (for reload after sync)
 */
function clearCache() {
  _bridge = null;
  _lineups = null;
  _matches = null;
  _schedule = null;
  _ratings = null;
}

module.exports = {
  getLineups,
  getSubstitutions,
  espnToFifa,
  fifaToEspn,
  resolveFormation,
  getTeamFormationHistory,
  clearCache,
};
