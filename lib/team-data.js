/**
 * Team data initialization and lookup functions
 * Extracted from server.js to reduce main file size
 */

let TEAM_NAMES = {};
let TEAM_FLAGS = {};
let TEAM_LOGOS = {};
let TEAM_NAMES_ZH = {};
let ELO_RANK_MAP = {};
let _teamResolver = null;
let _PLAYER_RATINGS = { data: {} };

/**
 * Initialize team data lookup tables
 * @param {Object} deps - Dependencies
 * @param {Object} deps.loader - Data loader
 * @param {Object} deps.teamResolver - Team resolver
 * @param {Object} deps.idBridge - ID bridge data
 * @param {Object} deps.PLAYER_RATINGS - Player ratings data
 */
function init({ loader, teamResolver, idBridge, PLAYER_RATINGS }) {
  _teamResolver = teamResolver;
  _PLAYER_RATINGS = PLAYER_RATINGS;
  
  // Reset tables
  TEAM_NAMES = {};
  TEAM_FLAGS = {};
  
  // Get RATINGS from loader
  const RATINGS = loader.getRatings();
  
  // Populate from RATINGS.teams
  for (const [id, team] of Object.entries(RATINGS.teams || {})) {
    TEAM_NAMES[id] = team.name || id;
    TEAM_FLAGS[id] = team.flag || '🏳️';
  }
  
  // Load ID_MAP
  const fs = require('fs');
  const path = require('path');
  let ID_MAP = {};
  try {
    ID_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'id_map_center.json'), 'utf8'));
  } catch (e) {
    console.warn('⚠️ id_map_center.json not loaded:', e.message);
  }
  
  // Override from ID_MAP
  for (const [name, info] of Object.entries(ID_MAP)) {
    if (info.espn_id) {
      TEAM_FLAGS[info.espn_id] = info.flag || TEAM_FLAGS[info.espn_id] || '🏳️';
      if (!TEAM_NAMES[info.espn_id]) TEAM_NAMES[info.espn_id] = info.zh_name || info.official_name;
    }
    TEAM_FLAGS[name] = info.flag || TEAM_FLAGS[name] || '🏳️';
    if (!TEAM_NAMES[name]) TEAM_NAMES[name] = info.zh_name || info.official_name;
  }
  
  // Populate from PLAYER_RATINGS.data for teams not in RATINGS.teams
  if (PLAYER_RATINGS && PLAYER_RATINGS.data) {
    for (const [id, team] of Object.entries(PLAYER_RATINGS.data)) {
      if (!TEAM_NAMES[id]) {
        TEAM_NAMES[id] = team.name || id;
        TEAM_FLAGS[id] = team.flag || '🏳️';
      }
    }
  }
  
  // Populate from id_bridge for 2026 teams not already mapped
  for (const [fifaCode, entry] of Object.entries(idBridge)) {
    const name = entry.name_official;
    if (!name) continue;
    if (!TEAM_FLAGS[name]) TEAM_FLAGS[name] = '🏳️';
    if (!TEAM_NAMES[name]) TEAM_NAMES[name] = entry.name_zh || name;
    if (entry.espn_id) {
      if (!TEAM_FLAGS[entry.espn_id]) TEAM_FLAGS[entry.espn_id] = TEAM_FLAGS[name];
      if (!TEAM_NAMES[entry.espn_id]) TEAM_NAMES[entry.espn_id] = TEAM_NAMES[name];
    }
  }
  console.log(`✅ Populated TEAM_NAMES: ${Object.keys(TEAM_NAMES).length} teams`);
  
  // Chinese team names (from unified loader)
  TEAM_NAMES_ZH = loader.getTeamNames();
  
  // Load team logos
  TEAM_LOGOS = {};
  try {
    TEAM_LOGOS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'team_logos.json'), 'utf8'));
    console.log(`🖼️ Loaded team logos: ${Object.keys(TEAM_LOGOS).length} teams`);
  } catch (e) {
    console.log('⚠️ team_logos.json not found');
  }
  
  // Build Elo rank map (team name → rank)
  ELO_RANK_MAP = {};
  try {
    const ratingsData = loader.getRatings();
    const teams = Object.values(ratingsData.teams);
    teams.sort((a, b) => b.rating - a.rating);
    teams.forEach((t, i) => { ELO_RANK_MAP[t.name] = i + 1; });
    console.log(`📊 Built Elo rank map: ${Object.keys(ELO_RANK_MAP).length} teams`);
  } catch (e) {
    console.log('⚠️ Could not build Elo rank map:', e.message);
  }
}

/**
 * Helper: get bilingual team name
 * @param {string} id - Team ID
 * @returns {string} - Bilingual team name
 */
function getTeamNameZh(id) {
  const zh = TEAM_NAMES_ZH[id];
  const en = TEAM_NAMES[id] || id;
  return zh ? `${zh.zh} ${zh.en}` : en;
}

/**
 * Helper: get i18n team name
 * @param {string} id - Team ID
 * @param {string} fallback - Fallback name
 * @returns {Object} - { zh, en } team names
 */
function getTeamNameI18n(id, fallback = '') {
  const zh = TEAM_NAMES_ZH[id];
  const en = TEAM_NAMES[id] || zh?.en || fallback || id;
  return {
    zh: zh?.zh || en,
    en: zh?.en || en,
  };
}

/**
 * Resolve team identifier
 * @param {string} input - Team identifier (espn_id, fifa_code, name, etc.)
 * @returns {Object} - Resolved team info
 */
function resolveTeam(input) {
  const raw = String(input || '');
  const resolved = _teamResolver.resolve(raw);
  return {
    requestedId: raw,
    ratingsId: resolved?.official_name || raw,
    espnId: resolved?.espn_id || raw,
    resolved,
  };
}

/**
 * Get player rating data for a team
 * @param {string} input - Team identifier
 * @returns {Object} - Player rating data
 */
function getPlayerRatingData(input) {
  const info = resolveTeam(input);
  return {
    ...info,
    team: _PLAYER_RATINGS?.data?.[info.ratingsId] || _PLAYER_RATINGS?.data?.[info.requestedId] || _PLAYER_RATINGS?.data?.[info.espnId] || null,
  };
}

module.exports = {
  init,
  getTeamNameZh,
  getTeamNameI18n,
  resolveTeam,
  getPlayerRatingData,
  // Export references for backward compatibility
  get TEAM_NAMES() { return TEAM_NAMES; },
  get TEAM_FLAGS() { return TEAM_FLAGS; },
  get TEAM_LOGOS() { return TEAM_LOGOS; },
  get TEAM_NAMES_ZH() { return TEAM_NAMES_ZH; },
  get ELO_RANK_MAP() { return ELO_RANK_MAP; },
};