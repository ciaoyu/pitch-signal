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
        if (process.env[name] === undefined) process.env[name] = vals.join('=').trim();
      }
    });
  }
} catch (e) {
  console.warn('.env parse failed:', e.message);
}

// Global error handlers — prevent silent crashes on unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason instanceof Error ? reason.stack || reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.stack || err.message || err);
  process.exit(1);
});

const PORT = Number(process.env.PORT || 5099);
const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Infrastructure modules
const loader = require('./data/loader');
loader.init();
let COACHES = loader.getCoaches();
let ratingsData = loader.getRatings();
const { getCached, setCache } = require('./middleware/cache');
const { fetchJSON, espn } = require('./services/espn');
const { wrapCORS } = require('./middleware/cors');
const { parseBody } = require('./middleware/body-parser');
const { rateLimit } = require('./middleware/rate-limit');
const teamResolver = require('./lib/team_resolver');
const rosterCache = require('./lib/roster_cache');
const botKB = require('./lib/botKnowledgeBase');
botKB.init();

// Data files
let PLAYER_RATINGS = { data: {} };
let idBridge = {};
try {
  PLAYER_RATINGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'wc2026', 'player-ratings.json'), 'utf8'));
  console.log(`✅ Loaded player ratings: ${Object.keys(PLAYER_RATINGS.data || {}).length} teams`);
} catch (e) { console.log('⚠️ data/wc2026/player-ratings.json not loaded:', e.message); }
try {
  idBridge = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'wc2026', 'id_bridge.json'), 'utf8'));
  teamResolver.extendWithBridge(idBridge);
  console.log(`🔗 Loaded id_bridge: ${Object.keys(idBridge).length} teams`);
} catch (e) { console.log('⚠️ data/wc2026/id_bridge.json not loaded:', e.message); }

// Time helpers
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

// Parse event
function parseEvent(ev) {
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  let home = {}, away = {};
  for (const c of cs) {
    const teamId = c.team?.id || '';
    const zhName = TEAM_NAMES_ZH[teamId];
    const teamDisplayName = c.team?.shortDisplayName || c.team?.displayName || c.team?.name || '';
    const nameI18n = getTeamNameI18n(teamId, teamDisplayName);
    const displayName = zhName ? `${zhName.zh} ${teamDisplayName}` : (teamDisplayName || String(teamId));
    const t = {
      name: displayName,
      fullName: zhName ? `${zhName.zh} ${zhName.en}` : (teamDisplayName || String(teamId)),
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

// Venue impact
const { calculateVenueImpact, analyzeStyleFit } = require('./lib/venue-impact');

// Team data initialization
const teamData = require('./lib/team-data');
teamData.init({ loader, teamResolver, idBridge, PLAYER_RATINGS });
const TEAM_NAMES = teamData.TEAM_NAMES;
const TEAM_FLAGS = teamData.TEAM_FLAGS;
const TEAM_LOGOS = teamData.TEAM_LOGOS;
const TEAM_NAMES_ZH = teamData.TEAM_NAMES_ZH;
const ELO_RANK_MAP = teamData.ELO_RANK_MAP;
const getTeamNameZh = teamData.getTeamNameZh;
const getTeamNameI18n = teamData.getTeamNameI18n;
const resolveTeam = teamData.resolveTeam;
const getPlayerRatingData = teamData.getPlayerRatingData;
let RATINGS = loader.getRatings();

// Matchup modules
let matchupAPI = null;
try {
  matchupAPI = require('./matchup-rating/matchup-api.js');
  console.log('✅ Matchup API module loaded');
} catch (e) { console.log('⚠️ matchup-api.js not found'); }
let matchupSpatial = null;
try {
  matchupSpatial = require('./lib/matchup-spatial')({ teamResolver, PLAYER_RATINGS, TEAM_FLAGS, getTeamNameZh, idBridge });
  console.log('✅ Spatial Matchup library loaded');
} catch (e) { console.log('⚠️ lib/matchup-spatial.js not loaded:', e.message); }
const { assignLineupCoords } = require('./lib/lineup-coords');

// Routes
const routes = {};
// Create PredictionService/ReviewService before route registration so they can be injected
let predictionService = null, reviewService = null;
try {
  const PredictionService = require('./lib/services/PredictionService');
  const ReviewService = require('./lib/services/ReviewService');
  const serviceDeps = { getCached, setCache, espn, RATINGS, getTeamNameZh, getTeamNameI18n, routes, TEAM_FLAGS };
  predictionService = new PredictionService(serviceDeps);
  reviewService = new ReviewService(serviceDeps);
} catch (e) { console.log('Service init delayed:', e.message); }
try {
  const registerRoutes = require('./lib/routes');
  registerRoutes(routes, {
    getCached, setCache, espn, fetchJSON, RATINGS, ELO_RANK_MAP, TEAM_NAMES, TEAM_FLAGS, TEAM_NAMES_ZH, TEAM_LOGOS,
    COACHES, rosterCache, parseEvent, getTeamNameZh, getTeamNameI18n, teamNamesZh: TEAM_NAMES_ZH, routes,
    PLAYER_RATINGS, getPlayerRatingData, assignLineupCoords, matchupAPI, matchupSpatial, ratingsData, loader,
    calculateVenueImpact, analyzeStyleFit, teamResolver, idBridge, predictionService, reviewService,
  });
} catch (e) { console.log('⚠️ Modular routes registration skipped:', e.message); }

// Background jobs
const { startJobs, stopJobs } = require('./lib/jobs');

// Router
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

// Static files
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const base = path.basename(filePath);
  const cacheControl = ext === '.html' || base === 'sw.js' ? 'no-store' : 'public, max-age=3600';
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

// Server
let shuttingDown = false;
const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${pathname} ${res.statusCode} ${duration}ms ${clientIp}`);
  });
  if (wrapCORS(req, res)) return;
  if (pathname.startsWith('/api/') && rateLimit(req, res)) return;
  let body;
  try { body = await parseBody(req); }
  catch (e) {
    console.warn('Body parse failed:', e.message || e);
    res.writeHead(e.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request body' }));
    return;
  }
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
  if (pathname.startsWith('/static/')) {
    let requestedFile;
    try { requestedFile = decodeURIComponent(pathname.slice(8)); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    const filePath = safeStaticPath(STATIC, requestedFile);
    if (!filePath) { res.writeHead(403); res.end('Forbidden'); return; }
    return serveStatic(res, filePath);
  }
  if (pathname.startsWith('/manifest.json')) return serveStatic(res, path.join(STATIC, 'manifest.json'));
  serveStatic(res, path.join(TEMPLATES, 'index.html'));
});

// Feature gates
(function assertFeatureGates() {
  const GATES = [
    { key: 'POLYMARKET_ENABLED', label: 'GATE-1 外部市场信号（Polymarket）融合' },
    { key: 'PUNDIT_ENABLED', label: 'GATE-2 专家观点聚合（Pundit）' },
    { key: 'AUTO_CALIBRATION', label: 'GATE-3 模型自动校准' },
  ];
  for (const { key, label } of GATES) {
    if (process.env[key] === 'true') {
      console.warn(`⛔ [${label}] ${key}=true 被检测到 — 强制覆盖为 false（公测 Beta 阶段禁止启用）`);
      process.env[key] = 'false';
    } else {
      process.env[key] = 'false';
      console.log(`✅ [${label}] ${key}=false 已确认`);
    }
  }
  console.log('✅ [GATE-4] AI 仅生成赛后文字复盘，不修改任何预测概率');
})();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚽ PitchSignal: http://0.0.0.0:${PORT}`);
  try {
    startJobs({ db: require('./lib/db').db, predictionService, reviewService, dataDir: DATA_DIR });
  } catch (e) { console.log('Background jobs unavailable:', e.message); }
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully...`);
  stopJobs();
  const forceExit = setTimeout(() => { console.error('Graceful shutdown timed out; forcing exit.'); process.exit(1); }, 10_000);
  forceExit.unref();
  server.close((error) => {
    try { require('./lib/db').db.close(); } catch (dbError) { console.warn(`Database close skipped: ${dbError.message}`); }
    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));