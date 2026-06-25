/**
 * 2026 世界杯 Dashboard - Pure Node.js (no dependencies)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const TEMPLATES = path.join(__dirname, 'templates');
const STATIC = path.join(__dirname, 'static');

// Load .env if exists
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const [key, ...vals] = line.split('=');
      const name = key?.trim();
      if (name && vals.length) {
        // T08: 平台环境变量总是优先，.env 只作为本地开发的默认值
        if (process.env[name] === undefined) {
          process.env[name] = vals.join('=').trim();
        }
      }
    });
  }
} catch {}

// Environment supplied by the platform always wins over a local .env file.
// DATA_PATH is the mount point for a persistent volume in hosted environments.
const PORT = Number(process.env.PORT || 5099);
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, 'data');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ========== Infrastructure modules (Step 1) ==========
const loader = require('./data/loader');
loader.init();

// Backward-compatible aliases (Step 2: data layer unification)
let COACHES = loader.getCoaches();
let ratingsData = loader.getRatings();

const { getCached, setCache } = require('./middleware/cache');
const { fetchJSON, espn } = require('./services/espn');
const { wrapCORS } = require('./middleware/cors');
const { parseBody } = require('./middleware/body-parser');
const { rateLimit } = require('./middleware/rate-limit');
const teamResolver = require('./lib/team_resolver');
const rosterCache = require('./lib/roster_cache');
const { getMatchLineups, getTeamRecentMatches } = require('./lib/fifa_scraper');

let PLAYER_RATINGS = { data: {} };
try {
  PLAYER_RATINGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'matchup-rating', 'ratings.json'), 'utf8'));
  console.log(`✅ Loaded player ratings: ${Object.keys(PLAYER_RATINGS.data || {}).length} teams`);
} catch (e) {
  console.log('⚠️ matchup-rating/ratings.json not loaded:', e.message);
}

function resolveTeam(input) {
  const raw = String(input || '');
  const resolved = teamResolver.resolve(raw);
  return {
    requestedId: raw,
    ratingsId: resolved?.official_name || raw,
    espnId: resolved?.espn_id || raw,
    resolved,
  };
}

function getPlayerRatingData(input) {
  const info = resolveTeam(input);
  return {
    ...info,
    team: PLAYER_RATINGS?.data?.[info.ratingsId] || PLAYER_RATINGS?.data?.[info.requestedId] || PLAYER_RATINGS?.data?.[info.espnId] || null,
  };
}

// Spatial matchup algorithms extracted to lib/matchup-spatial.js

// ========== Time ==========
function bjt(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }); }
  catch { return iso; }
}
function bjtShort(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('zh-CN', { timeZone:'Asia/Shanghai', hour:'2-digit', minute:'2-digit', hour12:false }); }
  catch { return iso; }
}

// ========== Parse ==========
function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  let home = {}, away = {};
  for (const c of cs) {
    const teamId = c.team?.id || '';
    const zhName = TEAM_NAMES_ZH[teamId];
    const nameI18n = getTeamNameI18n(teamId, c.team?.displayName || c.team?.shortDisplayName || '?');
    const displayName = zhName ? `${zhName.zh} ${c.team?.shortDisplayName || c.team?.displayName || '?'}` : (c.team?.shortDisplayName || c.team?.displayName || '?');
    const t = {
      name: displayName,
      fullName: zhName ? `${zhName.zh} ${zhName.en}` : (c.team?.displayName || '?'),
      nameI18n,
      abbr: c.team?.abbreviation || '',
      logo: c.team?.logos?.[0]?.href || TEAM_LOGOS[teamId] || '',
      score: c.score || '0',
      rank: c.curatedRank?.current || ELO_RANK_MAP[c.team?.displayName] || 99,
      id: teamId,
      flag: TEAM_FLAGS[teamId] || '🏳️',
    };
    if (c.homeAway === 'home') home = t; else away = t;
  }
  const st = comp.status?.type || {};
  const state = st.state || 'pre';
  let status, sClass;
  if (state === 'in') { status = comp.status?.displayClock || '进行中'; sClass = 'live'; }
  else if (state === 'post') { status = st.shortDetail || '已结束'; sClass = 'finished'; }
  else { status = bjtShort(ev.date); sClass = 'upcoming'; }

  let group = '';
  for (const n of (comp.notes || [])) {
    if (n.type === 'event') { group = n.headline || n.text || ''; break; }
  }
  return {
    id: ev.id||'', name: ev.name||'', date: ev.date||'',
    dateBJT: bjt(ev.date), timeBJT: bjtShort(ev.date),
    status, sClass, state, home, away, group,
    venue: comp.venue?.fullName||'', venueId: comp.venue?.id||'',
  };
}

// ========== Venue Impact Analysis ==========
function calculateVenueImpact(venue, weather) {
  let impact = {
    overall: 0,        // -100 到 +100
    attack: 0,         // 进攻影响
    defense: 0,        // 防守影响
    possession: 0,     // 控球影响
    physical: 0,       // 体能影响
    details: []
  };
  
  // 1. 草皮类型影响 (35%)
  const grassImpact = analyzeGrassImpact(venue.grass);
  impact.attack += grassImpact.attack * 0.35;
  impact.defense += grassImpact.defense * 0.35;
  impact.possession += grassImpact.possession * 0.35;
  
  // 2. 海拔影响 (20%)
  const altitudeImpact = analyzeAltitudeImpact(venue.altitude);
  impact.physical += altitudeImpact.physical * 0.20;
  impact.attack += altitudeImpact.attack * 0.20;
  
  // 3. 天气影响 (如果可用)
  if (weather) {
    // 温度影响 (20%)
    const tempImpact = analyzeTemperatureImpact(weather.temp);
    impact.physical += tempImpact.physical * 0.20;
    
    // 湿度影响 (15%)
    const humidityImpact = analyzeHumidityImpact(weather.humidity);
    impact.physical += humidityImpact.physical * 0.15;
    
    // 风速影响 (10%)
    const windImpact = analyzeWindImpact(weather.windSpeed);
    impact.attack += windImpact.attack * 0.10;
  }
  
  // 计算综合分
  impact.overall = Math.round((impact.attack + impact.defense + impact.possession + impact.physical) / 4);
  
  // 生成详情
  if (venue.grass.includes('人工')) {
    impact.details.push('人工草皮球速快，适合快速反击');
  } else if (venue.grass.includes('混合')) {
    impact.details.push('混合草皮兼顾球速和舒适度');
  } else {
    impact.details.push('天然草皮技术发挥好');
  }
  
  if (venue.altitude > 1000) {
    impact.details.push(`海拔${venue.altitude}m，球速加快，体能消耗增加`);
  }
  
  if (weather) {
    if (weather.temp > 30) {
      impact.details.push('高温环境，体能消耗大');
    } else if (weather.temp < 10) {
      impact.details.push('低温环境，肌肉僵硬风险增加');
    }
    if (weather.humidity > 70) {
      impact.details.push('高湿度，闷热难耐');
    }
    if (weather.windSpeed > 20) {
      impact.details.push('风速较大，影响长传和射门');
    }
  }
  
  return impact;
}

function analyzeGrassImpact(grass) {
  if (grass.includes('人工')) {
    return { attack: 15, defense: -5, possession: -10, physical: 5 };
  } else if (grass.includes('混合')) {
    return { attack: 5, defense: 0, possession: 5, physical: 0 };
  } else {
    return { attack: 0, defense: 5, possession: 10, physical: -5 };
  }
}

function analyzeAltitudeImpact(altitude) {
  if (altitude > 2000) {
    return { attack: 20, physical: -25 };
  } else if (altitude > 1000) {
    return { attack: 10, physical: -15 };
  } else if (altitude > 500) {
    return { attack: 5, physical: -5 };
  }
  return { attack: 0, physical: 0 };
}

function analyzeTemperatureImpact(temp) {
  if (temp > 35) return { physical: -30 };
  if (temp > 30) return { physical: -20 };
  if (temp > 25) return { physical: -5 };
  if (temp < 5) return { physical: -15 };
  if (temp < 10) return { physical: -5 };
  return { physical: 0 };
}

function analyzeHumidityImpact(humidity) {
  if (humidity > 80) return { physical: -20 };
  if (humidity > 70) return { physical: -10 };
  if (humidity < 30) return { physical: -5 };
  return { physical: 0 };
}

function analyzeWindImpact(windSpeed) {
  if (windSpeed > 30) return { attack: -20 };
  if (windSpeed > 20) return { attack: -10 };
  if (windSpeed > 10) return { attack: -5 };
  return { attack: 0 };
}

function analyzeStyleFit(venue, weather, style) {
  const fits = {
    '控球型': {
      grass: '天然草 > 混合草 > 人工草',
      altitude: '低海拔优先',
      temp: '10-25°C 最佳',
      humidity: '<70% 最佳',
      fit: venue.grass.includes('天然') ? 'good' : venue.grass.includes('混合') ? 'medium' : 'poor'
    },
    '快速反击': {
      grass: '人工草 > 混合草 > 天然草',
      altitude: '高海拔有利',
      temp: '任何温度',
      humidity: '影响小',
      fit: venue.grass.includes('人工') ? 'good' : venue.grass.includes('混合') ? 'medium' : 'poor'
    },
    '高压逼抢': {
      grass: '任何草皮',
      altitude: '低海拔优先',
      temp: '<25°C 优先',
      humidity: '<60% 最佳',
      fit: venue.altitude < 500 ? 'good' : venue.altitude < 1000 ? 'medium' : 'poor'
    }
  };
  
  return fits[style] || fits['控球型'];
}

// ========== Routes ==========
// Load player ratings (from unified loader)
let RATINGS = loader.getRatings();

// Team names and flags lookup
const TEAM_NAMES = {};
const TEAM_FLAGS = {};

let ID_MAP = {};
try { ID_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/id_map_center.json'), 'utf8')); } catch (e) { console.warn('⚠️ id_map_center.json not loaded:', e.message); }

for (const [id, team] of Object.entries(RATINGS.teams || {})) {
  TEAM_NAMES[id] = team.name || id;
  TEAM_FLAGS[id] = team.flag || '🏳️';
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

// Populate from ratingsData.data for teams not in RATINGS.teams
if (ratingsData && ratingsData.data) {
  for (const [id, team] of Object.entries(ratingsData.data)) {
    if (!TEAM_NAMES[id]) {
      TEAM_NAMES[id] = team.name || id;
      TEAM_FLAGS[id] = team.flag || '🏳️';
    }
  }
}
console.log(`✅ Populated TEAM_NAMES: ${Object.keys(TEAM_NAMES).length} teams`);

// Chinese team names (from unified loader)
let TEAM_NAMES_ZH = loader.getTeamNames();

// Load team logos
let TEAM_LOGOS = {};
try {
  TEAM_LOGOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'team_logos.json'), 'utf8'));
  console.log(`🖼️ Loaded team logos: ${Object.keys(TEAM_LOGOS).length} teams`);
} catch (e) {
  console.log('⚠️ team_logos.json not found');
}

// Build Elo rank map (team name → rank)
const ELO_RANK_MAP = {};
try {
  const teams = Object.values(ratingsData.teams);
  teams.sort((a, b) => b.rating - a.rating);
  teams.forEach((t, i) => { ELO_RANK_MAP[t.name] = i + 1; });
  console.log(`📊 Built Elo rank map: ${Object.keys(ELO_RANK_MAP).length} teams`);
} catch (e) {
  console.log('⚠️ Could not build Elo rank map:', e.message);
}

// Helper: get bilingual team name
function getTeamNameZh(id) {
  const zh = TEAM_NAMES_ZH[id];
  const en = TEAM_NAMES[id] || id;
  return zh ? `${zh.zh} ${zh.en}` : en;
}

function getTeamNameI18n(id, fallback = '') {
  const zh = TEAM_NAMES_ZH[id];
  const en = TEAM_NAMES[id] || zh?.en || fallback || id;
  return {
    zh: zh?.zh || en,
    en: zh?.en || en,
  };
}

// Load matchup API module
let matchupAPI = null;
try {
  matchupAPI = require('./matchup-rating/matchup-api.js');
  console.log('✅ Matchup API module loaded');
} catch (e) { console.log('⚠️ matchup-api.js not found'); }

let matchupSpatial = null;
try {
  matchupSpatial = require('./lib/matchup-spatial')({
    teamResolver,
    PLAYER_RATINGS,
    TEAM_FLAGS,
    getTeamNameZh,
  });
  console.log('✅ Spatial Matchup library loaded');
} catch (e) {
  console.log('⚠️ lib/matchup-spatial.js not loaded:', e.message);
}

// Position matchup mapping (who marks whom)
const POS_MATCHUP = {
  'GK':'GK','CB':'ST','LB':'RW','RB':'LW',
  'CM':'CM','CDM':'CAM','CAM':'CDM',
  'LW':'RB','RW':'LB','ST':'CB',
  'LWB':'RWB','RWB':'LWB','LM':'RM','RM':'LM',
};

// Formation coordinates
const FORM_COORDS = {
  '4-3-3': [{pos:'GK',x:50,y:8},{pos:'LB',x:18,y:22},{pos:'CB',x:38,y:20},{pos:'CB',x:62,y:20},{pos:'RB',x:82,y:22},{pos:'CM',x:25,y:38},{pos:'CM',x:50,y:35},{pos:'CM',x:75,y:38},{pos:'LW',x:20,y:48},{pos:'ST',x:50,y:46},{pos:'RW',x:80,y:48}],
  '4-4-2': [{pos:'GK',x:50,y:8},{pos:'LB',x:18,y:22},{pos:'CB',x:38,y:20},{pos:'CB',x:62,y:20},{pos:'RB',x:82,y:22},{pos:'LM',x:18,y:38},{pos:'CM',x:38,y:36},{pos:'CM',x:62,y:36},{pos:'RM',x:82,y:38},{pos:'ST',x:35,y:47},{pos:'ST',x:65,y:47}],
  '3-5-2': [{pos:'GK',x:50,y:8},{pos:'CB',x:25,y:20},{pos:'CB',x:50,y:18},{pos:'CB',x:75,y:20},{pos:'LWB',x:10,y:35},{pos:'CM',x:35,y:33},{pos:'CM',x:50,y:30},{pos:'CM',x:65,y:33},{pos:'RWB',x:90,y:35},{pos:'ST',x:35,y:47},{pos:'ST',x:65,y:47}],
  '3-4-2-1': [{pos:'GK',x:50,y:8},{pos:'CB',x:25,y:20},{pos:'CB',x:50,y:18},{pos:'CB',x:75,y:20},{pos:'LWB',x:12,y:35},{pos:'CM',x:38,y:33},{pos:'CM',x:62,y:33},{pos:'RWB',x:88,y:35},{pos:'CAM',x:35,y:44},{pos:'CAM',x:65,y:44},{pos:'ST',x:50,y:48}],
  '4-1-2-3': [{pos:'GK',x:50,y:8},{pos:'LB',x:18,y:22},{pos:'CB',x:38,y:20},{pos:'CB',x:62,y:20},{pos:'RB',x:82,y:22},{pos:'CDM',x:50,y:32},{pos:'CM',x:32,y:40},{pos:'CM',x:68,y:40},{pos:'RW',x:20,y:48},{pos:'ST',x:50,y:46},{pos:'LW',x:80,y:48}],
};

const POS_COORD_ALIASES = {
  GK: ['GK'],
  RB: ['RB', 'RWB', 'CB'],
  RCB: ['CB', 'RB'],
  CB: ['CB'],
  LCB: ['CB', 'LB'],
  LB: ['LB', 'LWB', 'CB'],
  RWB: ['RWB', 'RB', 'RM'],
  LWB: ['LWB', 'LB', 'LM'],
  CDM: ['CDM', 'CM'],
  RCM: ['CM', 'RM', 'CDM'],
  LCM: ['CM', 'LM', 'CDM'],
  CM: ['CM', 'CDM', 'CAM'],
  CAM: ['CAM', 'CM'],
  RM: ['RM', 'RW', 'CM'],
  LM: ['LM', 'LW', 'CM'],
  RW: ['RW', 'RM', 'ST'],
  LW: ['LW', 'LM', 'ST'],
  ST: ['ST', 'CF', 'F'],
  CF: ['ST', 'CF', 'F'],
  F: ['ST', 'RW', 'LW'],
  M: ['CM', 'CDM', 'CAM', 'LM', 'RM'],
  D: ['CB', 'LB', 'RB'],
};

function assignLineupCoords(players, formation) {
  const template = (FORM_COORDS[formation] || FORM_COORDS['4-3-3']).map((coord, index) => ({ ...coord, index }));
  const usedPlayers = new Set();
  const assigned = [];

  for (const coord of template) {
    let index = players.findIndex((player, playerIndex) => !usedPlayers.has(playerIndex) && player.pos === coord.pos);
    if (index < 0) {
      index = players.findIndex((player, playerIndex) => {
        if (usedPlayers.has(playerIndex)) return false;
        const aliases = POS_COORD_ALIASES[player.pos] || [player.pos];
        return aliases.includes(coord.pos);
      });
    }
    if (index < 0) continue;
    usedPlayers.add(index);
    assigned.push({ ...players[index], coords: { pos: coord.pos, x: coord.x, y: coord.y } });
  }

  for (let i = 0; i < players.length; i++) {
    if (!usedPlayers.has(i)) assigned.push({ ...players[i], bench: true, coords: { x: 50, y: 50 } });
  }
  return assigned;
}

const routes = {
  // === Health check endpoint ===
  // Primary route lives in lib/routes/health.js. This inline route is a safety
  // net: if modular route registration fails (e.g. better-sqlite3 load error),
  // Docker/Railway/K8s probes still get a 200 JSON response instead of falling
  // back to the SPA index.html. Modular route overwrites this one when it
  // loads successfully.
  'GET /health': async () => {
    try {
      const { db } = require('./lib/db');
      db.prepare('SELECT 1 AS ok').get();
      return { status: 'ok', db: 'ok', time: new Date().toISOString() };
    } catch (e) {
      console.error('Health DB check failed:', e.message || e);
      return { status: 'degraded', db: 'down', error: 'Database check failed', time: new Date().toISOString() };
    }
  },

  // === Coach Comparison ===
  'GET /api/coach-compare/:teamA/:teamB': async (params) => {
    const coaches = (routes['GET /api/coach/:teamId'].toString()); // reuse
    const cA = await routes['GET /api/coach/:teamId']({teamId: params.teamA});
    const cB = await routes['GET /api/coach/:teamId']({teamId: params.teamB});
    
    if (cA.error || cB.error) return { error: 'Coach data incomplete' };
    
    // Style matchup analysis
    const styleMatchup = {
      '高位逼抢+快攻': { strong_vs: '防守反击', weak_vs: '控球传控' },
      '控球+中场组织': { strong_vs: '高位逼抢', weak_vs: '防守反击' },
      '防守反击+纪律性强': { strong_vs: '控球传控', weak_vs: '高位逼抢' },
      '高压逼抢+战术多变': { strong_vs: '防守反击', weak_vs: '控球传控' },
    };
    const aAdvantage = styleMatchup[cA.style]?.strong_vs === cB.style;
    const bAdvantage = styleMatchup[cB.style]?.strong_vs === cA.style;
    
    // Rating comparison
    const tenureA = parseInt(cA.tenure) || 0;
    const tenureB = parseInt(cB.tenure) || 0;
    const winA = parseInt(cA.winRate) || 50;
    const winB = parseInt(cB.winRate) || 50;
    const adjustA = parseInt(cA.adjustment?.match(/\d+/)?.[0]) || 20;
    const adjustB = parseInt(cB.adjustment?.match(/\d+/)?.[0]) || 20;
    const styleMatchupText = aAdvantage ? `${cA.name} 风格克制 ${cB.name}` :
                      bAdvantage ? `${cB.name} 风格克制 ${cA.name}` : '风格互克，无明显优势';
    const experienceGapText = tenureA > tenureB + 2 ? `${cA.name} 经验优势明显` :
                       tenureB > tenureA + 2 ? `${cB.name} 经验优势明显` : '经验相近';
    const adjustmentEdgeText = adjustA > adjustB + 10 ? `${cA.name} 临场调整更强` :
                        adjustB > adjustA + 10 ? `${cB.name} 临场调整更强` : '临场能力相近';
    
    return {
      coachA: cA,
      coachB: cB,
      comparison: {
        styleMatchup: styleMatchupText,
        styleMatchupI18n: {
          zh: styleMatchupText,
          en: aAdvantage ? `${cA.name}'s style counters ${cB.name}` :
              bAdvantage ? `${cB.name}'s style counters ${cA.name}` : 'Styles offset each other with no clear edge',
        },
        experienceGap: experienceGapText,
        experienceGapI18n: {
          zh: experienceGapText,
          en: tenureA > tenureB + 2 ? `${cA.name} has a clear experience edge` :
              tenureB > tenureA + 2 ? `${cB.name} has a clear experience edge` : 'Similar experience level',
        },
        adjustmentEdge: adjustmentEdgeText,
        adjustmentEdgeI18n: {
          zh: adjustmentEdgeText,
          en: adjustA > adjustB + 10 ? `${cA.name} has the stronger in-game adjustment profile` :
              adjustB > adjustA + 10 ? `${cB.name} has the stronger in-game adjustment profile` : 'Similar in-game adjustment level',
        },
        overallScore: {
          [cA.name]: ((winA * 0.3) + (tenureA * 2 * 0.3) + (adjustA * 0.4)).toFixed(1),
          [cB.name]: ((winB * 0.3) + (tenureB * 2 * 0.3) + (adjustB * 0.4)).toFixed(1),
        },
      },
    };
  },
  
  // === AI Ask (POST) ===
  'POST /api/ask': async (params, body) => {
    const { question, matchId, homeId, awayId, context } = body || {};
    if (!question) return { error: 'Missing question' };
    
    // Get team data
    const homeLookup = getPlayerRatingData(homeId);
    const awayLookup = getPlayerRatingData(awayId);
    const homeData = homeLookup.team;
    const awayData = awayLookup.team;
    
    if (!homeData || !awayData) {
      return { answer: '抱歉，找不到这场比赛的球队数据。' };
    }
    
    // Simple rule-based AI (fallback when MiMo is unavailable)
    const homePlayers = Object.values(homeData.players || {});
    const awayPlayers = Object.values(awayData.players || {});
    const homeAvg = homePlayers.reduce((s, p) => s + (p.rating || 70), 0) / (homePlayers.length || 1);
    const awayAvg = awayPlayers.reduce((s, p) => s + (p.rating || 70), 0) / (awayPlayers.length || 1);
    const homeName = getTeamNameZh(homeLookup.espnId);
    const awayName = getTeamNameZh(awayLookup.espnId);
    const diff = homeAvg - awayAvg;
    
    let answer = '';
    const q = question.toLowerCase();
    
    if (q.includes('谁会赢') || q.includes('谁能赢') || q.includes('预测')) {
      if (diff > 3) {
        answer = `根据球员评分分析，${homeName}（平均 ${(homeAvg/10).toFixed(1)}）明显优于 ${awayName}（平均 ${(awayAvg/10).toFixed(1)}），预计 ${homeName} 获胜概率较大。`;
      } else if (diff < -3) {
        answer = `根据球员评分分析，${awayName}（平均 ${(awayAvg/10).toFixed(1)}）明显优于 ${homeName}（平均 ${(homeAvg/10).toFixed(1)}），预计 ${awayName} 获胜概率较大。`;
      } else {
        answer = `两队实力接近（${homeName} ${(homeAvg/10).toFixed(1)} vs ${awayName} ${(awayAvg/10).toFixed(1)}），比赛结果难以预测，可能是一场激烈的对决。`;
      }
    } else if (q.includes('关键对位') || q.includes('对位分析')) {
      // Find key matchups
      const spatialData = await (async () => {
        try {
          const handler = routes['GET /api/matchup-spatial/:home/:away'];
          return handler ? await handler({ home: String(homeId), away: String(awayId) }) : null;
        } catch { return null; }
      })();
      
      if (spatialData?.pairs) {
        const keyPairs = spatialData.pairs.filter(p => Math.abs(p.diff) >= 5).slice(0, 3);
        if (keyPairs.length) {
          answer = `关键对位分析：\n`;
          keyPairs.forEach(p => {
            const adv = p.diff > 0 ? homeName : awayName;
            answer += `• ${p.home.name}(${(p.home.rating/10).toFixed(1)}) vs ${p.away.name}(${(p.away.rating/10).toFixed(1)})，${adv} 优势 +${Math.abs(p.diff/10).toFixed(1)}\n`;
          });
        } else {
          answer = '两队各位置实力接近，没有明显的单点优势。';
        }
      } else {
        answer = '暂时无法获取详细对位数据。';
      }
    } else if (q.includes('战术') || q.includes('风格')) {
      answer = `${homeName} 采用 ${homeData.formation || '未知'} 阵型，${awayName} 采用 ${awayData.formation || '未知'} 阵型。两队阵型${homeData.formation === awayData.formation ? '相同' : '不同'}，这将影响中场争夺和进攻空间。`;
    } else {
      // Generic answer
      answer = `这是 ${homeName} 对阵 ${awayName} 的比赛。两队平均评分分别为 ${(homeAvg/10).toFixed(1)} 和 ${(awayAvg/10).toFixed(1)}。您可以询问具体问题，如"谁会赢"、"关键对位"或"战术分析"。`;
    }
    
    return { answer, matchId, homeId, awayId };
  },

  // === FIFA Data Scraper Routes ===
  'GET /api/match/:id/lineups': async (params) => {
    const matchId = params.id;
    try {
      const lineups = await getMatchLineups(matchId);
      return lineups || { error: 'Unable to fetch lineups' };
    } catch (e) {
      console.error('Prediction internal error:', e.message || e);
      return { error: 'Prediction internal error', matchId };
    }
  },

  'GET /api/team/:id/recent-matches': async (params) => {
    const teamId = String(params.id);
    const cacheKey = `team_recent_${teamId}`;
    const cached = getCached(cacheKey, 1800000);
    if (cached) return cached;

    try {
      // Use match_snapshot_schedule.json as index — only fetch ESPN for dates we know this team played.
      // This avoids scanning all WC days and is O(team_matches) ESPN calls instead of O(wc_days).
      const schedule = loader.getSchedule();
      const nowMs = Date.now();
      const teamSchedule = (schedule.matches || [])
        .filter(m => String(m.teams?.home?.id) === teamId || String(m.teams?.away?.id) === teamId)
        .sort((a, b) => new Date(b.kickoffUtc) - new Date(a.kickoffUtc));

      // Use time-based "past" check — schedule.json status can be stale.
      // A match is "past" if kickoff was more than 2h ago.
      const isPast = m => new Date(m.kickoffUtc).getTime() + 2 * 3600 * 1000 < nowMs;

      // ESPN scoreboard groups by Eastern Time (EDT, UTC-4) — NOT BJT.
      const toESPNDateKey = utcStr =>
        new Date(utcStr).toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }).replace(/-/g, '');

      // Collect unique Eastern-time date strings for past/live matches only
      const espnDates = [...new Set(
        teamSchedule
          .filter(m => isPast(m) || m.status?.state === 'in')
          .map(m => toESPNDateKey(m.kickoffUtc))
          .filter(Boolean)
      )];

      // Fetch ESPN scoreboards only for those specific dates (all already cached from schedule load)
      const espnByMatchId = {};
      for (const dateKey of espnDates) {
        try {
          const data = await espn(`/scoreboard?dates=${dateKey}`, `s_${dateKey}`, 600000);
          for (const ev of (data.events || [])) {
            espnByMatchId[String(ev.id)] = parseEvent(ev);
          }
        } catch (e) { console.warn('Auto-populate match parse failed:', e.message); }
      }

      const matches = teamSchedule.map(m => {
        const isHome = String(m.teams?.home?.id) === teamId;
        const past = isPast(m);
        const state = m.status?.state === 'in' ? 'in' : past ? 'post' : 'pre';
        const espnMatch = espnByMatchId[String(m.matchId)];

        const homeScore = espnMatch?.home?.score ?? '-';
        const awayScore = espnMatch?.away?.score ?? '-';
        const myScore  = parseInt(isHome ? homeScore : awayScore, 10);
        const oppScore = parseInt(isHome ? awayScore : homeScore, 10);
        const result = (state === 'post' && !isNaN(myScore) && !isNaN(oppScore))
          ? (myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D')
          : null;

        return {
          matchId: m.matchId,
          date: m.kickoffUtc,
          dateBJT: m.kickoffBjt,
          homeTeam: m.teams?.home,
          awayTeam: m.teams?.away,
          isHome,
          opponent: isHome ? m.teams?.away : m.teams?.home,
          state,
          score: { home: homeScore, away: awayScore },
          result,
          stage: m.stage,
          venue: m.venue || '',
        };
      });

      const result = {
        teamId,
        matches,
        total: matches.length,
        completed: matches.filter(m => m.state === 'post').length,
        source: 'match_snapshot_schedule + ESPN',
        label: '本届世界杯赛程',
        lastUpdated: new Date().toISOString(),
      };
      setCache(cacheKey, result);
      return result;
    } catch (e) {
      console.warn(`⚠️ Recent matches fetch failed for team ${teamId}:`, e.message || e);
      return { teamId, matches: [], error: 'Fetch failed' };
    }
  },
};

// Register modular route extensions after the base route table is defined.
try {
  const registerRoutes = require('./lib/routes');
  registerRoutes(routes, {
    getCached,
    setCache,
    espn,
    fetchJSON,
    RATINGS,
    ELO_RANK_MAP,
    TEAM_NAMES,
    TEAM_FLAGS,
    TEAM_NAMES_ZH,
    TEAM_LOGOS,
    COACHES,
    rosterCache,
    parseEvent,
    getTeamNameZh,
    getTeamNameI18n,
    teamNamesZh: TEAM_NAMES_ZH,
    routes,
    // T01: Matchup/Venue/Odds dependency injection
    PLAYER_RATINGS,
    getPlayerRatingData,
    assignLineupCoords,
    matchupAPI,
    matchupSpatial,
    ratingsData,
    loader,
    calculateVenueImpact,
    analyzeStyleFit,
    teamResolver,
  });
} catch (e) {
  console.log('⚠️ Modular routes registration skipped:', e.message);
}

// ========== Background Jobs (T14) ==========
const { startJobs, stopJobs } = require('./lib/jobs');

// ========== Router ==========
function matchRoute(method, pathname) {
  for (const [key, handler] of Object.entries(routes)) {
    const [rMethod, rPath] = key.split(' ');
    if (rMethod !== method) continue;
    const rParts = rPath.split('/');
    const pParts = pathname.split('/');
    if (rParts.length !== pParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) params[rParts[i].slice(1)] = decodeURIComponent(pParts[i]);
      else if (rParts[i] !== pParts[i]) { ok = false; break; }
    }
    if (ok) return { handler, params };
  }
  return null;
}

// ========== Static Files ==========
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const base = path.basename(filePath);
  const cacheControl = ext === '.html' || base === 'sw.js'
    ? 'no-store'
    : 'public, max-age=3600';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheControl });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}

function safeStaticPath(root, requestPath) {
  const safeRoot = path.resolve(root);
  const fullPath = path.resolve(safeRoot, requestPath);
  if (fullPath !== safeRoot && !fullPath.startsWith(safeRoot + path.sep)) return null;
  return fullPath;
}

// ========== Server ==========
let shuttingDown = false;

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;

  // Access log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${pathname} ${res.statusCode} ${duration}ms ${clientIp}`);
  });

  // CORS middleware
  if (wrapCORS(req, res)) return;

  if (pathname.startsWith('/api/') && rateLimit(req, res)) return;

  // Parse POST body
  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    console.warn('Body parse failed:', e.message || e);
    res.writeHead(e.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request body' }));
    return;
  }

  // API routes
  const route = matchRoute(req.method, pathname);
  if (route) {
    try {
      const mergedParams = { ...Object.fromEntries(parsed.searchParams.entries()), ...route.params };
      const data = await route.handler(mergedParams, body, req);
      if (data && data.error && (data.statusCode || data.code)) {
        res.writeHead(data.statusCode || data.code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: data.error }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      console.error('Route handler internal error:', e.message || e);
      const statusCode = e.statusCode || 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(e.payload || { error: 'Internal server error' }));
    }
    return;
  }

  // Static files
  if (pathname.startsWith('/static/')) {
    let requestedFile;
    try {
      requestedFile = decodeURIComponent(pathname.slice(8));
    } catch {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }
    const filePath = safeStaticPath(STATIC, requestedFile);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    return serveStatic(res, filePath);
  }
  if (pathname.startsWith('/manifest.json')) {
    return serveStatic(res, path.join(STATIC, 'manifest.json'));
  }

  // SPA
  serveStatic(res, path.join(TEMPLATES, 'index.html'));
});

// ========== 功能闸门启动断言（Beta 阶段全部硬关闭）==========
// 不论 .env 怎么写，生产启动时必须明确确认以下实验性功能均为关闭。
// 若有人意外设置为 'true'，打印明显警告并强制覆盖为 'false'。
// 这些断言让“闸门默认关闭”从文档承诺变成代码强制保证（与 .env.example / 部署文档一致）。
(function assertFeatureGates() {
  const GATES = [
    { key: 'POLYMARKET_ENABLED', label: 'GATE-1 外部市场信号（Polymarket）融合' },
    { key: 'PUNDIT_ENABLED',     label: 'GATE-2 专家观点聚合（Pundit）' },
    { key: 'AUTO_CALIBRATION',   label: 'GATE-3 模型自动校准' },
  ];
  for (const { key, label } of GATES) {
    if (process.env[key] === 'true') {
      console.warn(`⛔ [${label}] ${key}=true 被检测到 — 强制覆盖为 false（公测 Beta 阶段禁止启用）`);
      process.env[key] = 'false';
    } else {
      // 归一化未设置/任意值为 'false'，确保下游一律读到关闭态。
      process.env[key] = 'false';
      console.log(`✅ [${label}] ${key}=false 已确认`);
    }
  }
  console.log('✅ [GATE-4] AI 仅生成赛后文字复盘，不修改任何预测概率');
})();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚽ PitchSignal: http://0.0.0.0:${PORT}`);

  // T14: Start background jobs via extracted jobs module
  try {
    const { db } = require('./lib/db');
    const PredictionService = require('./lib/services/PredictionService');
    const ReviewService = require('./lib/services/ReviewService');

    const serviceDeps = { getCached, setCache, espn, RATINGS, getTeamNameZh, getTeamNameI18n, routes, TEAM_FLAGS };
    const predictionService = new PredictionService(serviceDeps);
    const reviewService = new ReviewService(serviceDeps);

    startJobs({ db, predictionService, reviewService, dataDir: DATA_DIR });
  } catch (e) {
    console.log('Background jobs unavailable:', e.message);
  }
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully...`);

  // T14: Stop all background jobs via extracted jobs module
  stopJobs();

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    try {
      require('./lib/db').db.close();
    } catch (dbError) {
      console.warn(`Database close skipped: ${dbError.message}`);
    }
    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
