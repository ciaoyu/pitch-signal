/**
 * Event Parsing Module - PitchSignal
 * 
 * Responsibilities:
 * - Parse ESPN event data
 * - Calculate formatted time display
 * - Provide time utility functions
 */

const { createLogger } = require('./logger');
const { TEAM_TO_GROUP } = require('./standings-helper');
const logger = createLogger('parse-event');

/**
 * Time utility function: Beijing Time display
 * @param {string} iso - ISO formatted time string
 * @returns {string} Formatted time string
 */
function bjt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  } catch {
    return iso;
  }
}

/**
 * Time utility function: Beijing Time short format
 * @param {string} iso - ISO formatted time string
 * @returns {string} Formatted short time string
 */
function bjtShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { 
      timeZone: 'Asia/Shanghai', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  } catch {
    return iso;
  }
}

/**
 * Parse event data
 * @param {Object} ev - ESPN event object
 * @param {Object} deps - Dependencies
 * @param {Object} deps.TEAM_NAMES_ZH - Team Chinese name mapping
 * @param {Function} deps.getTeamNameI18n - Function to get localized team name
 * @param {Object} deps.RATINGS - Team ratings data
 * @param {Object} deps.ELO_RANK_MAP - ELO rank mapping
 * @param {Object} deps.TEAM_FLAGS - Team flag mapping
 * @param {Object} deps.TEAM_LOGOS - Team logo mapping
 * @returns {Object} Parsed event object
 */
function parseEvent(ev, deps) {
  const { 
    TEAM_NAMES_ZH, 
    getTeamNameI18n, 
    RATINGS, 
    ELO_RANK_MAP, 
    TEAM_FLAGS, 
    TEAM_LOGOS 
  } = deps;
  
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  let home = {}, away = {};
  
  for (const c of cs) {
    const teamId = c.team?.id || '';
    const zhName = TEAM_NAMES_ZH[teamId];
    const teamDisplayName = c.team?.shortDisplayName || c.team?.displayName || c.team?.name || '';
    const nameI18n = getTeamNameI18n(teamId, teamDisplayName);
    const displayName = zhName ? `${zhName.zh} ${teamDisplayName}` : (teamDisplayName || String(teamId));
    const ratingEntry = RATINGS?.teams?.[teamDisplayName] || RATINGS?.teams?.[c.team?.name] || null;
    
    const t = {
      name: displayName,
      fullName: zhName ? `${zhName.zh} ${zhName.en}` : (teamDisplayName || String(teamId)),
      nameI18n,
      abbr: c.team?.abbreviation || '',
      logo: c.team?.logos?.[0]?.href || TEAM_LOGOS[teamId] || '',
      score: c.score || '0',
      rank: c.curatedRank?.current || ELO_RANK_MAP[c.team?.displayName] || 99,
      elo: ratingEntry?.rating || null,
      id: teamId,
      flag: TEAM_FLAGS[teamId] || '🏳️',
    };
    
    if (c.homeAway === 'home') home = t; else away = t;
  }
  
  const st = comp.status?.type || {};
  const state = st.state || 'pre';
  let status, sClass;
  
  if (state === 'in') { 
    status = comp.status?.displayClock || '进行中'; 
    sClass = 'live'; 
  }
  else if (state === 'post') { 
    status = st.shortDetail || '已结束'; 
    sClass = 'finished'; 
  }
  else { 
    status = bjtShort(ev.date); 
    sClass = 'upcoming'; 
  }
  
  let group = '';
  for (const n of (comp.notes || [])) {
    if (n.type === 'event') { 
      group = n.headline || n.text || ''; 
      break; 
    }
  }

  const seasonSlug = ev.season?.slug || '';
  let stage = '';
  if (seasonSlug.includes('group')) stage = 'Group Stage';
  else if (seasonSlug.includes('32')) stage = 'R32';
  else if (seasonSlug.includes('16')) stage = 'R16';
  else if (seasonSlug.includes('quarter')) stage = 'QF';
  else if (seasonSlug.includes('semi')) stage = 'SF';
  else if (seasonSlug.includes('third')) stage = '3rd Place';
  else if (seasonSlug.includes('final')) stage = 'Final';

  if (!group && TEAM_TO_GROUP && home.id && away.id && (!stage || stage === 'Group Stage')) {
    const homeGroup = TEAM_TO_GROUP[home.id];
    if (homeGroup && homeGroup === TEAM_TO_GROUP[away.id]) {
      group = `Group ${homeGroup}`;
    }
  }

  // Calculate basic Elo win/draw/loss probabilities
  let homeWin = 0, draw = 0, awayWin = 0;
  if (home.elo && away.elo) {
    const diff = home.elo - away.elo;
    const expectedHome = 1 / (1 + Math.pow(10, -diff / 400));
    const drawProb = Math.max(0.15, 0.28 - Math.abs(diff) * 0.0003);
    homeWin = Math.round((1 - drawProb) * expectedHome * 100);
    draw = Math.round(drawProb * 100);
    awayWin = Math.max(0, 100 - homeWin - draw);
  }
  
  return {
    id: ev.id || '', 
    name: ev.name || '', 
    date: ev.date || '',
    dateBJT: bjt(ev.date), 
    timeBJT: bjtShort(ev.date),
    status, 
    sClass, 
    state, 
    home, 
    away, 
    group,
    venue: comp.venue?.fullName || '', 
    venueId: comp.venue?.id || '',
    homeWin, 
    draw, 
    awayWin,
    stage,
  };
}

/**
 * Create parseEvent function with bound dependencies
 * @param {Object} deps - Dependencies
 * @returns {Function} parseEvent function with bound dependencies
 */
function createParseEvent(deps) {
  return (ev) => parseEvent(ev, deps);
}

module.exports = {
  parseEvent,
  createParseEvent,
  bjt,
  bjtShort,
};