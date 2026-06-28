/**
 * Unified Data Loader — PitchSignal
 * Single entry point for all static JSON data.
 * Loads once at startup, caches in memory.
 * 
 * T07: 尊重DATA_PATH环境变量，使用运行时数据目录
 */
const fs = require('fs');
const path = require('path');

// T07: 优先使用DATA_PATH环境变量，否则使用默认的data目录
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname);

// Internal cache
let _ratings = null;
let _coaches = null;
let _venues = null;       // array
let _venuesById = null;   // Map<id, venue>
let _venuesBySlug = null; // Map<slug, venue>
let _teamNames = null;
let _schedule = null;     // match_snapshot_schedule.json
let _h2hIndex = null;     // Map<string, Array<H2HMatch>>

// ── Ratings ──────────────────────────────────────────────
function loadRatings() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ratings.json'), 'utf8'));
    // Normalize: support both {data: {...}} and {teams: {...}}
    if (!raw.data && raw.teams && typeof raw.teams === 'object') {
      raw.data = raw.teams;
    }
    _ratings = raw;
    console.log(`✅ Loaded ratings: ${Object.keys(_ratings.data || {}).length} teams`);
  } catch (e) {
    console.error('❌ ratings.json:', e.message);
    _ratings = { data: {} };
  }
}

// ── Coaches ──────────────────────────────────────────────
function loadCoaches() {
  try {
    _coaches = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'coaches.json'), 'utf8'));
    console.log(`👔 Loaded coaches: ${Object.keys(_coaches).length} teams`);
  } catch (e) {
    console.log('⚠️ No coaches.json found');
    _coaches = {};
  }
}

// ── Venues ───────────────────────────────────────────────
// Slug mapping: venue name → slug (matches server.js hardcoded code)
const SLUG_MAP = {
  'SoFi Stadium': 'sofi',
  'MetLife Stadium': 'metlife',
  'AT&T Stadium': 'att',
  'Hard Rock Stadium': 'hardrock',
  'Mercedes-Benz Stadium': 'mercedes',
  'Lumen Field': 'lumen',
  'Gillette Stadium': 'gillette',
  'Lincoln Financial Field': 'lincoln',
  'NRG Stadium': 'nrg',
  'Arrowhead Stadium': 'arrowhead',
  "Levi's Stadium": 'levi',
  'BMO Field': 'bmo_toronto',
  'BC Place': 'bcplace',
  'Estadio Azteca': 'azteca',
  'Estadio BBVA': 'monterrey',
  'Estadio Akron': 'guadalajara',
  'BMO Stadium': 'bmo',
};

function loadVenues() {
  try {
    _venues = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'venues.json'), 'utf8'));
    _venuesById = new Map();
    _venuesBySlug = new Map();

    for (const v of _venues) {
      // Index by numeric ID string
      _venuesById.set(String(v.id), v);
      // Index by slug
      const slug = SLUG_MAP[v.name] || v.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      _venuesBySlug.set(slug, v);
      v._slug = slug; // attach slug for convenience
    }

    console.log(`🏟️ Loaded venues: ${_venues.length} stadiums`);
  } catch (e) {
    console.log('⚠️ No venues.json found');
    _venues = [];
    _venuesById = new Map();
    _venuesBySlug = new Map();
  }
}

// ── Team Names (Chinese) ─────────────────────────────────
function loadTeamNames() {
  try {
    _teamNames = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'team_names_zh.json'), 'utf8'));
    console.log(`🇨🇳 Loaded Chinese team names: ${Object.keys(_teamNames).length} teams`);
  } catch (e) {
    console.log('⚠️ No team_names_zh.json found');
    _teamNames = {};
  }
}

// ── Schedule ─────────────────────────────────────────────
function loadSchedule() {
  try {
    _schedule = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'match_snapshot_schedule.json'), 'utf8'));
    console.log(`📅 Loaded schedule: ${(_schedule.matches || []).length} matches`);
  } catch (e) {
    console.log('⚠️ No match_snapshot_schedule.json found');
    _schedule = { matches: [] };
  }
}

// ── H2H Index (CSV) ─────────────────────────────────────
function loadH2HIndex() {
  try {
    const csvPath = path.join(__dirname, 'sources', 'world-cup-history', 'WorldCupMatches.csv');
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      console.log('⚠️ WorldCupMatches.csv is empty or has no data rows');
      _h2hIndex = new Map();
      return;
    }
    
    // Parse header
    const header = lines[0].split(',').map(h => h.trim());
    const yearIdx = header.indexOf('Year');
    const datetimeIdx = header.indexOf('Datetime');
    const stageIdx = header.indexOf('Stage');
    const stadiumIdx = header.indexOf('Stadium');
    const cityIdx = header.indexOf('City');
    const homeTeamIdx = header.indexOf('Home Team Name');
    const homeGoalsIdx = header.indexOf('Home Team Goals');
    const awayGoalsIdx = header.indexOf('Away Team Goals');
    const awayTeamIdx = header.indexOf('Away Team Name');
    
    if (homeTeamIdx === -1 || awayTeamIdx === -1) {
      console.log('⚠️ WorldCupMatches.csv missing required columns');
      _h2hIndex = new Map();
      return;
    }
    
    // Normalize team name for indexing
    const normalize = (name) => {
      if (!name) return '';
      return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    _h2hIndex = new Map();
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < Math.max(homeTeamIdx, awayTeamIdx) + 1) continue;
      
      const homeTeam = cols[homeTeamIdx];
      const awayTeam = cols[awayTeamIdx];
      if (!homeTeam || !awayTeam) continue;
      
      const year = parseFloat(cols[yearIdx]) || 0;
      const homeGoals = parseInt(cols[homeGoalsIdx], 10) || 0;
      const awayGoals = parseInt(cols[awayGoalsIdx], 10) || 0;
      
      const match = {
        year,
        date: cols[datetimeIdx] || `${year}`,
        stage: cols[stageIdx] || 'Unknown',
        stadium: cols[stadiumIdx] || '',
        city: cols[cityIdx] || '',
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        score: `${homeGoals}-${awayGoals}`,
        competition: 'World Cup',
      };
      
      // Index both directions
      const key1 = `${normalize(homeTeam)}|${normalize(awayTeam)}`;
      const key2 = `${normalize(awayTeam)}|${normalize(homeTeam)}`;
      
      if (!_h2hIndex.has(key1)) _h2hIndex.set(key1, []);
      _h2hIndex.get(key1).push(match);
      
      if (!_h2hIndex.has(key2)) _h2hIndex.set(key2, []);
      _h2hIndex.get(key2).push({ ...match, homeTeam: awayTeam, awayTeam: homeTeam, homeGoals: awayGoals, awayGoals: homeGoals, score: `${awayGoals}-${homeGoals}` });
    }
    
    console.log(`📊 Loaded H2H index: ${_h2hIndex.size} team pairs, ${lines.length - 1} matches`);
  } catch (e) {
    console.log('⚠️ No WorldCupMatches.csv found or parse error:', e.message);
    _h2hIndex = new Map();
  }
}

// ── Init (call once at startup) ──────────────────────────
function init() {
  loadRatings();
  loadCoaches();
  loadVenues();
  loadTeamNames();
  loadSchedule();
  loadH2HIndex();
}

// ── Getters ──────────────────────────────────────────────
function getRatings() { return _ratings; }
function getCoaches() { return _coaches; }
function getCoach(teamId) { return _coaches ? _coaches[String(teamId)] : null; }
function getVenues() { return _venues; }
function getVenue(idOrSlug) {
  if (!_venuesById) return null;
  // Try numeric ID first, then slug
  const key = String(idOrSlug);
  return _venuesById.get(key) || _venuesBySlug.get(key) || _venues.find(v => v.name === key) || null;
}
function getTeamNames() { return _teamNames; }
function getTeamNameZh(teamId) {
  if (!_teamNames) return null;
  return _teamNames[String(teamId)] || null;
}
function getSchedule() { return _schedule || { matches: [] }; }
function getH2HIndex() { return _h2hIndex || new Map(); }
function getH2HMatches(homeTeam, awayTeam) {
  if (!_h2hIndex) return [];
  const normalize = (name) => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const key = `${normalize(homeTeam)}|${normalize(awayTeam)}`;
  return _h2hIndex.get(key) || [];
}

module.exports = {
  init,
  getRatings, getCoaches, getCoach,
  getVenues, getVenue,
  getTeamNames, getTeamNameZh,
  getSchedule,
  getH2HIndex, getH2HMatches,
  SLUG_MAP,
};
