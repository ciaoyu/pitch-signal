'use strict';

/**
 * bracket-updater.js
 *
 * Parse abstract slot tokens from bracket_2026.json (A1, B2, 3rd C/E/F/H/I, W R32-1)
 * into real team names and construct a fully renderable bracket.
 *
 * Three-layer logic:
 *   Layer 1: group-position resolution (A1 -> Spain)
 *   Layer 2: best third-place allocation (top 8 of 12 groups, bipartite graph matching for 8 slots)
 *   Layer 3: knockout stage result propagation (skeleton, to be implemented after 6/28)
 */

const fs = require('fs');
const path = require('path');
const { resolveDataPath } = require('./data-resolver');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ===== Lazy loading =====
let _bracket = null;
let _slotMap = null;
let _schedule = null;
let _matchIdBridge = null;

const STAGE_SLOT_PREFIX = {
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
};

function loadBracket() {
  if (!_bracket) _bracket = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bracket_2026.json'), 'utf8'));
  return _bracket;
}

function loadSlotMap() {
  if (!_slotMap) _slotMap = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bracket_slot_map.json'), 'utf8'));
  return _slotMap;
}

function loadSchedule() {
  if (!_schedule) _schedule = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'match_snapshot_schedule.json'), 'utf8'));
  return _schedule;
}

function loadMatchIdBridge() {
  if (!_matchIdBridge) {
    try {
      _matchIdBridge = JSON.parse(fs.readFileSync(resolveDataPath('match_id_bridge.json'), 'utf8'));
    } catch (e) {
      _matchIdBridge = { bridge: {}, reverseBridge: {} };
    }
  }
  return _matchIdBridge;
}

function loadFifaMatches() {
  try {
    return JSON.parse(fs.readFileSync(resolveDataPath('matches.json'), 'utf8')).matches || [];
  } catch (e) {
    return [];
  }
}

function fifaPlaceholderToBracketSlot(token) {
  if (!token || typeof token !== 'string') return token;
  const groupSlot = token.match(/^([12])([A-L])$/);
  if (groupSlot) return `${groupSlot[2]}${groupSlot[1]}`;
  const thirdPlaceSlot = token.match(/^3([A-L]+)$/);
  if (thirdPlaceSlot) return `3rd ${thirdPlaceSlot[1].split('').join('/')}`;
  return token;
}

function sortedStageMatches(fifaMatches, stage) {
  return fifaMatches
    .filter(m => m.stage === stage)
    .sort((a, b) => {
      const an = Number(a.n) || Number.MAX_SAFE_INTEGER;
      const bn = Number(b.n) || Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
    });
}

function buildNode(id, matches, seen = new Set()) {
  if (!id || !matches[id] || seen.has(id)) return id ? { id } : null;
  seen.add(id);
  const match = matches[id];
  const children = [match.feedA, match.feedB]
    .filter(Boolean)
    .map(childId => buildNode(childId, matches, new Set(seen)));
  return children.length > 0 ? { id, children } : { id };
}

function buildTreeFromOfficialMatches(matches) {
  const tree = { left: [], right: [], center: [] };
  if (matches['FINAL']) {
    tree.center.push(buildNode('FINAL', matches));
  }
  if (matches['SF-1']) tree.left.push(buildNode('SF-1', matches));
  if (matches['SF-2']) tree.right.push(buildNode('SF-2', matches));
  if (tree.left.length || tree.right.length || tree.center.length) return tree;

  // Fallback for partial fixtures used by tests or early-stage data.
  const qfIds = Object.keys(matches).filter(id => id.startsWith('QF-')).sort();
  if (qfIds.length) {
    tree.left = qfIds.slice(0, Math.ceil(qfIds.length / 2)).map(id => buildNode(id, matches));
    tree.right = qfIds.slice(Math.ceil(qfIds.length / 2)).map(id => buildNode(id, matches));
    return tree;
  }
  const r16Ids = Object.keys(matches).filter(id => id.startsWith('R16-')).sort();
  tree.left = r16Ids.slice(0, Math.ceil(r16Ids.length / 2)).map(id => buildNode(id, matches));
  tree.right = r16Ids.slice(Math.ceil(r16Ids.length / 2)).map(id => buildNode(id, matches));
  return tree;
}

function buildOfficialBracketFromFifaMatches(fifaMatches) {
  const knockout = fifaMatches.filter(m => m && m.stage && m.stage !== 'group' && m.stage !== 'third');
  if (!knockout.length) return null;

  const matches = {};
  const slotByFifaNumber = {};

  for (const stage of ['r32', 'r16', 'qf', 'sf']) {
    const prefix = STAGE_SLOT_PREFIX[stage];
    sortedStageMatches(knockout, stage).forEach((match, index) => {
      const id = `${prefix}-${index + 1}`;
      slotByFifaNumber[String(match.n)] = id;
      matches[id] = {
        teamA: fifaPlaceholderToBracketSlot(match.phA),
        teamB: fifaPlaceholderToBracketSlot(match.phB),
        fifaMatchId: match.id,
        fifaMatchNumber: match.n,
        fifaStage: match.stage,
        fifaHomeCode: match.home?.code || null,
        fifaAwayCode: match.away?.code || null,
        fifaStatus: match.status || null,
      };
    });
  }

  const finalMatch = sortedStageMatches(knockout, 'final')[0];
  if (finalMatch) {
    slotByFifaNumber[String(finalMatch.n)] = 'FINAL';
    matches.FINAL = {
      teamA: fifaPlaceholderToBracketSlot(finalMatch.phA),
      teamB: fifaPlaceholderToBracketSlot(finalMatch.phB),
      fifaMatchId: finalMatch.id,
      fifaMatchNumber: finalMatch.n,
      fifaStage: finalMatch.stage,
      fifaHomeCode: finalMatch.home?.code || null,
      fifaAwayCode: finalMatch.away?.code || null,
      fifaStatus: finalMatch.status || null,
    };
  }

  for (const match of Object.values(matches)) {
    for (const side of ['A', 'B']) {
      const key = `team${side}`;
      const feedKey = `feed${side}`;
      const winnerRef = typeof match[key] === 'string' ? match[key].match(/^W(\d+)$/) : null;
      if (winnerRef) {
        const feed = slotByFifaNumber[winnerRef[1]];
        if (feed) {
          match[feedKey] = feed;
          match[key] = `W ${feed}`;
        }
      }
    }
  }

  return {
    matches,
    tree: buildTreeFromOfficialMatches(matches),
  };
}

function codeFromScheduleTeam(team) {
  return String(team?.abbreviation || team?.code || '').toUpperCase();
}

function buildScheduleTeamCodeMap(scheduleMatches) {
  const map = {};
  for (const match of scheduleMatches || []) {
    for (const team of [match.teams?.home, match.teams?.away]) {
      const code = codeFromScheduleTeam(team);
      if (code && team?.name && !/^RD\d+|QF|SF|SFW|QW/.test(code)) {
        map[code] = { name: team.name, id: team.id || null };
      }
    }
  }
  return map;
}

function sameKickoff(a, b, toleranceMs = 90 * 1000) {
  const at = new Date(a || 0).getTime();
  const bt = new Date(b || 0).getTime();
  return Number.isFinite(at) && Number.isFinite(bt) && Math.abs(at - bt) <= toleranceMs;
}

function findScheduleForFifaMatch(fifaMatch, scheduleMatches, bridgeData) {
  if (!fifaMatch) return null;
  const reverseBridge = bridgeData?.reverseBridge || {};
  const bridgedEspnId = reverseBridge[fifaMatch.id] || reverseBridge[String(fifaMatch.id)];
  if (bridgedEspnId) {
    const bridged = scheduleMatches.find(s => String(s.matchId) === String(bridgedEspnId));
    if (bridged) return bridged;
  }

  const knockoutMatches = scheduleMatches.filter(m => m.stage === 'knockout');
  const homeCode = String(fifaMatch.home?.code || '').toUpperCase();
  const awayCode = String(fifaMatch.away?.code || '').toUpperCase();
  if (homeCode && awayCode) {
    const teamMatch = knockoutMatches.find(s => {
      const sh = codeFromScheduleTeam(s.teams?.home);
      const sa = codeFromScheduleTeam(s.teams?.away);
      const sameTeams = (sh === homeCode && sa === awayCode) || (sh === awayCode && sa === homeCode);
      return sameTeams && (!fifaMatch.date || sameKickoff(s.kickoffUtc, fifaMatch.date, 36 * 60 * 60 * 1000));
    });
    if (teamMatch) return teamMatch;
  }

  return knockoutMatches.find(s => sameKickoff(s.kickoffUtc, fifaMatch.date));
}

function teamFromScheduleOrCode(code, schedInfo, side, teamCodeMap = {}) {
  if (!code) return null;
  const normalized = String(code).toUpperCase();
  const preferred = schedInfo?.teams?.[side];
  if (codeFromScheduleTeam(preferred) === normalized) {
    return { name: preferred.name || normalized, nameI18n: null, seed: normalized, id: preferred.id };
  }
  for (const candidate of [schedInfo?.teams?.home, schedInfo?.teams?.away]) {
    if (codeFromScheduleTeam(candidate) === normalized) {
      return { name: candidate.name || normalized, nameI18n: null, seed: normalized, id: candidate.id };
    }
  }
  if (teamCodeMap[normalized]) {
    return { name: teamCodeMap[normalized].name, nameI18n: null, seed: normalized, id: teamCodeMap[normalized].id };
  }
  return { name: normalized, nameI18n: null, seed: normalized };
}

// ===== R32 shortName matching =====

/**
 * Convert bracket slot tokens to ESPN schedule shortName format.
 * Example: teamA="A2", teamB="B2" -> "2B @ 2A"
 *          teamA="E1", teamB="3rd A/B/C/D/F" -> "3RD @ 1E"
 */
function slotToScheduleShortName(teamA, teamB) {
  function token(slot) {
    if (!slot) return null;
    if (slot.startsWith('3rd ')) return '3RD';
    const m = slot.match(/^([A-L])(\d+)$/);
    if (m) return `${m[2]}${m[1]}`;
    return null;
  }
  const a = token(teamA);
  const b = token(teamB);
  if (!a || !b) return null;
  return `${b} @ ${a}`;
}

/**
 * Build R32 bracket-slot to ESPN schedule-match mapping.
 * @returns {Object} { "R32-1": { matchId, kickoff, ... }, ... }
 */
function buildR32MatchMap(bracket, scheduleMatches) {
  const knockoutMatches = scheduleMatches.filter(m => m.stage === 'knockout');
  const map = {};
  const bridgeData = loadMatchIdBridge();
  const reverseBridge = bridgeData.reverseBridge || {};

  let fifaMatches = [];
  try {
    fifaMatches = JSON.parse(fs.readFileSync(resolveDataPath('matches.json'), 'utf8')).matches || [];
  } catch (e) {}

  for (const [slotId, m] of Object.entries(bracket.matches)) {
    if (!slotId.startsWith('R32-')) continue;
    const shortName = slotToScheduleShortName(m.teamA, m.teamB);
    if (!shortName) continue;

    let schedMatch = knockoutMatches.find(s => s.shortName === shortName);
    
    // If shortName fails to match because team names were resolved, try finding corresponding FIFA knockout match from matches.json and bridge back to ESPN matchId
    if (!schedMatch) {
      const token = (slot) => {
        if (!slot) return null;
        if (slot.startsWith('3rd ')) return '3RD';
        const match = slot.match(/^([A-L])(\d+)$/);
        return match ? `${match[2]}${match[1]}` : null;
      };
      const sa = token(m.teamA);
      const sb = token(m.teamB);

      const matchesPlaceholder = (f, e) => {
        if (f === e) return true;
        if (e === '3RD' && f.startsWith('3')) return true;
        if (f === '3RD' && e.startsWith('3')) return true;
        return false;
      };

      const fifaMatch = fifaMatches.find(fm => {
        return fm.stage === 'r32' && (
          (matchesPlaceholder(fm.phA, sa) && matchesPlaceholder(fm.phB, sb)) ||
          (matchesPlaceholder(fm.phA, sb) && matchesPlaceholder(fm.phB, sa))
        );
      });

      if (fifaMatch) {
        const espnMatchId = reverseBridge[fifaMatch.id];
        if (espnMatchId) {
          schedMatch = knockoutMatches.find(s => String(s.matchId) === String(espnMatchId));
        }
      }
    }

    if (schedMatch) {
      map[slotId] = {
        matchId: schedMatch.matchId,
        kickoff: schedMatch.kickoffUtc,
        venue: schedMatch.venue,
        teams: schedMatch.teams,
        status: schedMatch.status,
      };
    }
  }
  return map;
}

// ===== Layer 1: slot resolution =====

/**
 * Resolve a single bracket slot into team info.
 * @param {string} slot - e.g. "A1", "B2", "3rd C/E/F/H/I", "W R32-1"
 * @param {Object} posMap - group-position -> team name, e.g. { A1: "Spain", ... }
 * @param {Object} thirdPlaceMap - "3rd X/Y/Z" -> team name (generated by resolveThirdPlaceTeams)
 * @param {Object} [posMapI18n] - group-position -> { zh, en } (optional)
 */
function resolveSlot(slot, posMap, thirdPlaceMap, posMapI18n) {
  if (!slot) return { name: 'TBD', seed: null };

  if (slot.startsWith('W ')) {
    // "W R32-1" -> depends on upstream match results (TBD at current stage)
    return { name: 'TBD', seed: slot };
  }

  if (slot.startsWith('3rd ')) {
    const team = thirdPlaceMap ? thirdPlaceMap[slot] : null;
    if (team) return { name: team.name, nameI18n: team.nameI18n, seed: slot, id: team.id };
    return { name: '待定', seed: slot };
  }

  // Direct group-position: "A1", "B2", etc.
  const name = posMap[slot];
  const i18n = posMapI18n ? posMapI18n[slot] : null;
  if (name) return { name, nameI18n: i18n, seed: slot };
  return { name: 'TBD', seed: slot };
}

// ===== Layer 2: best third-place =====

/**
 * Sort top 8 of 12 group third-place teams and allocate them to bracket "3rd ..." slots.
 * Use bipartite graph maximum matching (augmenting path) to ensure globally optimal allocation.
 *
 * @param {Object} thirdPlaceData - { A: { name, id, pts, gd, gf }, B: { ... }, ... }
 * @param {Object} bracketMatches - matches section of bracket_2026.json
 * @returns {Object} thirdPlaceMap - { "3rd A/B/C/D/F": { name, id, nameI18n }, ... }
 */
function resolveThirdPlaceTeams(thirdPlaceData, bracketMatches) {
  if (!thirdPlaceData || Object.keys(thirdPlaceData).length < 12) return {};

  // 1. Sort all third-place teams: points -> goal difference -> goals scored
  const sorted = Object.entries(thirdPlaceData)
    .map(([group, data]) => ({ group, ...data }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

  // 2. Take top 8 teams
  const qualified = sorted.slice(0, 8);
  const qualifiedGroups = new Set(qualified.map(t => t.group));

  // 3. Collect "3rd ..." slots in bracket
  const thirdSlots = [];
  for (const [slotId, m] of Object.entries(bracketMatches)) {
    if (m.teamA && m.teamA.startsWith('3rd ')) {
      thirdSlots.push({ slotId, token: m.teamA, side: 'teamA' });
    }
    if (m.teamB && m.teamB.startsWith('3rd ')) {
      thirdSlots.push({ slotId, token: m.teamB, side: 'teamB' });
    }
  }

  // 4. Parse candidate groups for each slot
  const slotCandidates = thirdSlots.map(s => {
    const letters = s.token.replace('3rd ', '').split('/').map(x => x.trim());
    const matchingQualified = letters.filter(l => qualifiedGroups.has(l));
    return { ...s, letters, matchingQualified };
  });

  // 5. Bipartite graph maximum matching: qualifiedGroups <-> slotCandidates
  //    matchGroup[g] = slotIndex | -1
  const groupList = qualified.map(t => t.group);
  const matchGroup = {};
  for (const g of groupList) matchGroup[g] = -1;

  function findMatch(group, visited) {
    for (let si = 0; si < slotCandidates.length; si++) {
      const slot = slotCandidates[si];
      if (!slot.matchingQualified.includes(group)) continue;
      if (visited[si]) continue;
      visited[si] = true;
      // This slot is unoccupied, or an alternative slot can be found for current occupant
      const occupant = groupList.find(g => matchGroup[g] === si);
      if (occupant === undefined || findMatch(occupant, visited)) {
        matchGroup[group] = si;
        return true;
      }
    }
    return false;
  }

  // Find match for each qualified group sequentially
  for (const g of groupList) {
    if (matchGroup[g] === -1) {
      findMatch(g, {});
    }
  }

  // 6. Build thirdPlaceMap
  const assigned = {};
  for (const g of groupList) {
    const si = matchGroup[g];
    if (si >= 0 && si < slotCandidates.length) {
      const slot = slotCandidates[si];
      const teamData = thirdPlaceData[g];
      assigned[slot.token] = {
        name: teamData.name,
        nameI18n: teamData.nameI18n || null,
        id: teamData.id,
        group: g,
      };
    }
  }

  return assigned;
}

// ===== Layer 3: knockout stage result propagation (skeleton) =====

/**
 * Propagate knockout stage results to downstream bracket slots.
 *
 * Phase 1 (current): knockout stage not started, return bracket unmodified directly.
 * Phase 2 (6/28+):
 *   1. Read bracket_slot_map.json to get espnMatchId for R16+
 *   2. Iterate over knockout stage dates to query ESPN scoreboard
 *   3. Match R32 results via team composition
 *   4. Match R16+ results via espnMatchId
 *   5. Extract winner and write into downstream bracket slot teamA/teamB
 *
 * @param {Object} bracket - resolved bracket (output of buildResolvedBracket)
 * @param {Object} [deps] - { espn, parseEvent, getCached, setCache } (used in Phase 2)
 * @returns {Object} same bracket object (modified in-place)
 */
function propagateResults(bracket, deps) {
  const bridgeData = loadMatchIdBridge();
  const reverseBridge = bridgeData.reverseBridge || {};

  const fifaMatches = bracket._fifaMatches || loadFifaMatches();
  if (!fifaMatches.length) return bracket;

  const knockoutFifa = fifaMatches.filter(m => m.stage !== 'group');

  // 1. Synchronize match status and score, and use id_bridge to complete FIFA Match ID <-> ESPN Match ID mapping
  for (const [slotId, m] of Object.entries(bracket.matches)) {
    m.espnMatchId = m.matchId || null;
    let espnMatchId = m.matchId;
    let fifaMatch = m.fifaMatchId
      ? knockoutFifa.find(fm => String(fm.id) === String(m.fifaMatchId))
      : null;

    if (!espnMatchId && !fifaMatch) continue;

    // Try querying corresponding FIFA match in match_id_bridge by ESPN match ID
    const bridgeEntry = espnMatchId ? bridgeData.bridge[espnMatchId] : null;
    if (!fifaMatch && bridgeEntry && bridgeEntry.fifa_match_id) {
      fifaMatch = knockoutFifa.find(fm => String(fm.id) === String(bridgeEntry.fifa_match_id));
    }

    // Fallback: if bridge mapping is not generated, match by unique kickoff timestamp
    if (!fifaMatch && m.kickoff) {
      const mTime = new Date(m.kickoff).getTime();
      fifaMatch = knockoutFifa.find(fm => {
        const fmTime = new Date(fm.date).getTime();
        return Math.abs(fmTime - mTime) < 60000;
      });
    }

    if (fifaMatch) {
      // Reverse query ESPN ID by FIFA match ID and write to espnMatchId / matchId fields
      const espnId = reverseBridge[fifaMatch.id] || reverseBridge[String(fifaMatch.id)] || m.matchId;
      if (espnId) {
        m.espnMatchId = espnId;
        m.matchId = espnId;
      }

      if (fifaMatch.status === 'finished') {
        m.status = 'final';
        m.scoreA = fifaMatch.home?.score ?? null;
        m.scoreB = fifaMatch.away?.score ?? null;
        if (fifaMatch.winner) {
          m.winner = (fifaMatch.winner === fifaMatch.home?.code) ? 'A' : 
                     (fifaMatch.winner === fifaMatch.away?.code ? 'B' : null);
        }
      } else if (fifaMatch.status === 'live' || fifaMatch.status === 'in') {
        m.status = 'live';
        m.scoreA = fifaMatch.home?.score ?? null;
        m.scoreB = fifaMatch.away?.score ?? null;
      }
    }
  }

  // 2. Topological sort propagation of advancement results: R32 -> R16 -> QF -> SF
  const rounds = ['R32', 'R16', 'QF', 'SF'];
  rounds.forEach(round => {
    for (const [slotId, m] of Object.entries(bracket.matches)) {
      if (!slotId.startsWith(round + '-')) continue;

      if (m.status === 'final' && m.winner) {
        const winnerTeam = m.winner === 'A' ? m.teamA : m.teamB;

        for (const [downSlotId, downMatch] of Object.entries(bracket.matches)) {
          if (downMatch.feedA === slotId && !downMatch.fifaHomeCode) {
            downMatch.teamA = { name: winnerTeam.name, nameI18n: winnerTeam.nameI18n || null, seed: `W ${slotId}` };
          }
          if (downMatch.feedB === slotId && !downMatch.fifaAwayCode) {
            downMatch.teamB = { name: winnerTeam.name, nameI18n: winnerTeam.nameI18n || null, seed: `W ${slotId}` };
          }
        }
      }
    }
  });

  return bracket;
}

// ===== Main function =====

/**
 * Build fully resolved bracket.
 *
 * @param {Object} args
 * @param {Object} args.posMap - group-position -> team name, e.g. { A1: "Spain", ... }
 * @param {Object} [args.posMapI18n] - group-position -> { zh, en }
 * @param {Object} [args.thirdPlaceData] - { A: { name, id, pts, gd, gf }, ... }
 * @param {Object} [args.bracket] - bracket_2026.json content (defaults to loading from file)
 * @param {Object} [args.schedule] - match_snapshot_schedule.json content (defaults to loading from file)
 * @param {Object} [args.deps] - ESPN deps (passed to propagateResults)
 * @returns {Object} complete bracket
 */
function buildResolvedBracket({ posMap, posMapI18n, thirdPlaceData, bracket, schedule, deps }) {
  bracket = bracket || loadBracket();
  schedule = schedule || loadSchedule();
  const fifaMatches = deps?.fifaMatches || loadFifaMatches();
  const officialBracket = buildOfficialBracketFromFifaMatches(fifaMatches);
  if (officialBracket) bracket = officialBracket;
  const slotMapData = loadSlotMap();
  const bridgeData = loadMatchIdBridge();

  // Layer 2: best third-place allocation
  const thirdPlaceMap = resolveThirdPlaceTeams(thirdPlaceData || {}, bracket.matches);

  // Build R32 schedule mapping (get kickoff timestamp and matchId)
  const r32MatchMap = buildR32MatchMap(bracket, schedule.matches || []);

  // Build R16+ kickoff mapping (look up schedule via espnMatchId from bracket_slot_map.json)
  const knockoutSchedule = (schedule.matches || []).filter(m => m.stage === 'knockout');
  const espnIdToSchedule = {};
  for (const m of knockoutSchedule) espnIdToSchedule[m.matchId] = m;
  const scheduleTeamCodeMap = buildScheduleTeamCodeMap(schedule.matches || []);
  const fifaById = {};
  for (const m of fifaMatches) fifaById[String(m.id)] = m;

  // Resolve each bracket match
  const resolved = {};
  for (const [id, m] of Object.entries(bracket.matches)) {
    const teamAResolved = resolveSlot(m.teamA, posMap, thirdPlaceMap, posMapI18n);
    const teamBResolved = resolveSlot(m.teamB, posMap, thirdPlaceMap, posMapI18n);

    // Get kickoff timestamp and matchId
    let kickoff = null;
    let matchId = null;
    let statusObj = null;
    let schedInfo = null;
    const fifaMatch = m.fifaMatchId ? fifaById[String(m.fifaMatchId)] : null;

    if (fifaMatch) {
      schedInfo = findScheduleForFifaMatch(fifaMatch, schedule.matches || [], bridgeData);
      if (schedInfo) {
        kickoff = schedInfo.kickoffUtc;
        matchId = schedInfo.matchId;
        statusObj = schedInfo.status;
      } else {
        kickoff = fifaMatch.date || null;
      }
    } else if (id.startsWith('R32-')) {
      const r32info = r32MatchMap[id];
      if (r32info) {
        kickoff = r32info.kickoff;
        matchId = r32info.matchId;
        statusObj = r32info.status;
      }
    } else {
      // R16+: look up espnMatchId from bracket_slot_map
      const slotInfo = slotMapData.matches && slotMapData.matches[id];
      if (slotInfo && slotInfo.espnMatchId) {
        matchId = slotInfo.espnMatchId;
        schedInfo = espnIdToSchedule[slotInfo.espnMatchId];
        if (schedInfo) {
          kickoff = schedInfo.kickoffUtc;
          statusObj = schedInfo.status;
        }
      }
    }

    if (fifaMatch?.home?.code) {
      const team = teamFromScheduleOrCode(fifaMatch.home.code, schedInfo, 'home', scheduleTeamCodeMap);
      if (team) Object.assign(teamAResolved, team);
    }
    if (fifaMatch?.away?.code) {
      const team = teamFromScheduleOrCode(fifaMatch.away.code, schedInfo, 'away', scheduleTeamCodeMap);
      if (team) Object.assign(teamBResolved, team);
    }

    // Determine status
    let status = 'tbd';
    if (statusObj) {
      if (statusObj.state === 'post') status = 'final';
      else if (statusObj.state === 'in') status = 'live';
      else if (statusObj.state === 'pre') {
        // Count as scheduled only when both teams are determined, otherwise remain tbd
        const bothKnown = teamAResolved.name !== 'TBD' && teamBResolved.name !== 'TBD'
          && teamAResolved.name !== '待定' && teamBResolved.name !== '待定';
        status = bothKnown ? 'scheduled' : 'tbd';
      }
    } else if (teamAResolved.name !== 'TBD' && teamBResolved.name !== 'TBD') {
      status = 'scheduled'; // Both teams determined, but no schedule info yet
    }

    resolved[id] = {
      teamA: teamAResolved,
      teamB: teamBResolved,
      feedA: m.feedA || null,
      feedB: m.feedB || null,
      scoreA: null,  // Phase 2: fetch from ESPN
      scoreB: null,
      winner: null,  // Phase 2: fetch from ESPN
      status,
      kickoff,
      matchId,
      espnMatchId: matchId,
      fifaMatchId: m.fifaMatchId || null,
      fifaMatchNumber: m.fifaMatchNumber || null,
      fifaHomeCode: m.fifaHomeCode || null,
      fifaAwayCode: m.fifaAwayCode || null,
    };
  }

  // Special handling for 3RD-PLACE (not in bracket.matches, but in bracket_slot_map)
  let thirdPlaceMatch = null;
  const tpSlot = slotMapData.matches && slotMapData.matches['3RD-PLACE'];
  if (tpSlot) {
    const schedInfo = espnIdToSchedule[tpSlot.espnMatchId];
    thirdPlaceMatch = {
      matchId: tpSlot.espnMatchId,
      espnMatchId: tpSlot.espnMatchId,
      kickoff: schedInfo ? schedInfo.kickoffUtc : null,
      teamA: { name: 'TBD', seed: 'SF-1 Loser' },
      teamB: { name: 'TBD', seed: 'SF-2 Loser' },
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'tbd',
    };
  }

  const result = {
    matches: resolved,
    tree: bracket.tree,
    rounds: ['R32', 'R16', 'QF', 'SF', 'FINAL'],
    thirdPlaceResolved: Object.keys(thirdPlaceMap).length > 0,
    thirdPlaceMatch,
  };
  Object.defineProperty(result, '_fifaMatches', {
    value: fifaMatches,
    enumerable: false,
    configurable: true,
  });

  // Layer 3: result propagation (to be implemented in Phase 2)
  return propagateResults(result, deps);
}

module.exports = {
  buildResolvedBracket,
  resolveThirdPlaceTeams,
  resolveSlot,
  propagateResults,
  // Export internal functions for testing
  _internals: { slotToScheduleShortName, buildR32MatchMap, buildOfficialBracketFromFifaMatches, findScheduleForFifaMatch },
};
