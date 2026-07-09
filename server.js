/**
 * 2026 World Cup Dashboard - Pure Node.js (no dependencies)
 *
 * Uses the app config module for dependency injection and modularity
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createAppConfig } = require('./lib/app');
const { createLogger } = require('./lib/logger');

// Create the app config
const appConfig = createAppConfig();
const { PORT, DATA_DIR, ESPN_BASE, TEMPLATES, STATIC, infra, teamData, matchupModules, services, routes } = appConfig;

// Create the main logger
const logger = createLogger('server');

// Pull constants from teamData
const { 
  TEAM_NAMES, 
  TEAM_FLAGS, 
  TEAM_LOGOS, 
  TEAM_NAMES_ZH, 
  ELO_RANK_MAP, 
  getTeamNameZh, 
  getTeamNameI18n, 
  resolveTeam, 
  getPlayerRatingData 
} = teamData;

// Pull middleware from infra
const { wrapCORS, parseBody, rateLimit } = infra;

// Route matching function
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

// MIME type map
const MIME = {
  '.html': 'text/html', 
  '.css': 'text/css', 
  '.js': 'application/javascript',
  '.json': 'application/json', 
  '.png': 'image/png', 
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', 
  '.ico': 'image/x-icon', 
  '.webmanifest': 'application/manifest+json',
};

// Static file serving
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const base = path.basename(filePath);
  const cacheControl = ext === '.html' || ext === '.js' || ext === '.css' || base === 'sw.js'
    ? 'no-cache, must-revalidate'
    : 'public, max-age=3600';
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) { 
      res.writeHead(404); 
      res.end('Not found'); 
      return; 
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheControl });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Safe static file path
function safeStaticPath(root, requestPath) {
  const safeRoot = path.resolve(root);
  const fullPath = path.resolve(safeRoot, requestPath);
  if (fullPath !== safeRoot && !fullPath.startsWith(safeRoot + path.sep)) return null;
  return fullPath;
}

// Feature gate assertions
function assertFeatureGates() {
  const GATES = [
    { key: 'POLYMARKET_ENABLED', label: 'GATE-1 external market signal (Polymarket) fusion' },
    { key: 'PUNDIT_ENABLED', label: 'GATE-2 pundit opinion aggregation' },
    { key: 'AUTO_CALIBRATION', label: 'GATE-3 automatic model calibration' },
  ];

  for (const { key, label } of GATES) {
    if (process.env[key] === 'true') {
      logger.warn(`⛔ [${label}] ${key}=true detected — force-overriding to false (disabled during public Beta)`);
      process.env[key] = 'false';
    } else {
      process.env[key] = 'false';
      logger.info(`✅ [${label}] ${key}=false confirmed`);
    }
  }

  logger.info('✅ [GATE-4] AI only generates post-match written reviews, never modifies prediction probabilities');
}

// Run feature gate assertions
assertFeatureGates();

// HTTP server
let shuttingDown = false;
const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;
  
  // Log once the request finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${pathname} ${res.statusCode} ${duration}ms`, {
      clientIp,
      method: req.method,
      pathname,
      statusCode: res.statusCode,
      duration,
    });
  });
  
  // CORS handling
  if (wrapCORS(req, res)) return;

  // Rate limiting
  if (pathname.startsWith('/api/') && rateLimit(req, res)) return;

  // Parse request body
  let body;
  try { 
    body = await parseBody(req); 
  }
  catch (e) {
    logger.warn('Body parse failed', { error: e.message || e });
    res.writeHead(e.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request body' }));
    return;
  }
  
  // Route matching
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
      logger.error('Route handler internal error', { error: e.message || e });
      const statusCode = e.statusCode || 500;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(e.payload || { error: 'Internal server error' }));
    }
    return;
  }
  
  // Static file handling
  if (pathname.startsWith('/static/')) {
    let requestedFile;
    try { 
      requestedFile = decodeURIComponent(pathname.slice(8)); 
    }
    catch { 
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
  
  // PWA manifest
  if (pathname.startsWith('/manifest.json')) {
    return serveStatic(res, path.join(STATIC, 'manifest.json'));
  }

  // Serve the worker from the origin root so it can control the app at `/`.
  if (pathname === '/sw.js') {
    return serveStatic(res, path.join(STATIC, 'sw.js'));
  }
  
  // Default page
  serveStatic(res, path.join(TEMPLATES, 'index.html'));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`⚽ PitchSignal: http://0.0.0.0:${PORT}`);

  // Ensure schedule table is seeded: P0-3 final score writeback / P4-4 calibration report / P3-1 Track-B all depend on
  // matches table having actual match schedule. Previously seedRealGroups was defined but never called, leaving the table empty
  // and silently breaking related features. Idempotently seed on boot (skipped if data already exists).
  try {
    const { groups } = require('./lib/db');
    const seeded = groups.seedRealGroups();
    if (seeded > 0) logger.info(`[boot] Seeded ${seeded} group matches into matches table`);
  } catch (e) {
    logger.warn('[boot] Match schedule seeding failed', { error: e.message });
  }

  // Start background jobs
  try {
    const { startJobs } = require('./lib/jobs');
    startJobs({ 
      db: require('./lib/db').db, 
      predictionService: services.predictionService, 
      reviewService: services.reviewService, 
      dataDir: DATA_DIR 
    });
  } catch (e) {
    logger.warn('Background jobs unavailable', { error: e.message });
  }
});

// Graceful shutdown
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}; shutting down gracefully...`);

  // Stop background jobs
  try {
    const { stopJobs } = require('./lib/jobs');
    stopJobs();
  } catch (e) {
    logger.warn('Failed to stop background jobs', { error: e.message });
  }
  
  // Force-exit timeout
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  
  // Close the server
  server.close((error) => {
    try {
      require('./lib/db').db.close();
    } catch (dbError) {
      logger.warn(`Database close skipped: ${dbError.message}`);
    }
    
    clearTimeout(forceExit);
    process.exit(error ? 1 : 0);
  });
}

// Register signal handlers
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
