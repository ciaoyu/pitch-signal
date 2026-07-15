/**
 * Application config module - PitchSignal
 * 
 * Responsibilities:
 * - Load environment variables
 * - Initialize infrastructure modules
 * - Configure middleware
 * - Register routes
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const { createParseEvent } = require('./parse-event');
const { resolveDataPath } = require('./data-resolver');

const logger = createLogger('app');

/**
 * Load .env file
 */
function loadEnv() {
  try {
    const envFile = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envFile)) {
      fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 1) return;
        const name = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (name && val && process.env[name] === undefined) process.env[name] = val;
      });
      logger.info('Environment variables loaded from .env');
    }
  } catch (e) {
    logger.warn('Failed to load .env file', { error: e.message });
  }
}

/**
 * Initialize global error handlers
 */
function initErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { 
      reason: reason instanceof Error ? reason.stack || reason.message : reason 
    });
  });
  
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { 
      error: err.stack || err.message || err 
    });
    process.exit(1);
  });
}

/**
 * Initialize infrastructure modules
 * @returns {Object} infrastructure module collection
 */
function initInfrastructure() {
  const loader = require('../data/loader');
  loader.init();
  
  const { getCached, setCache } = require('../middleware/cache');
  const { fetchJSON, espn } = require('../services/espn');
  const { wrapCORS } = require('../middleware/cors');
  const { parseBody } = require('../middleware/body-parser');
  const { rateLimit } = require('../middleware/rate-limit');
  const teamResolver = require('./team_resolver');
  const rosterCache = require('./roster_cache');
  const botKB = require('./botKnowledgeBase');
  botKB.init();
  
  return {
    loader,
    getCached,
    setCache,
    fetchJSON,
    espn,
    wrapCORS,
    parseBody,
    rateLimit,
    teamResolver,
    rosterCache,
    botKB,
  };
}

/**
 * Load data files
 * @param {Object} teamResolver - team resolver
 * @returns {Object} data file collection
 */
function loadDataFiles(teamResolver) {
  let PLAYER_RATINGS = { data: {} };
  let idBridge = {};
  
  try {
    const ratingsPath = resolveDataPath('player-ratings.json');
    PLAYER_RATINGS = JSON.parse(fs.readFileSync(ratingsPath, 'utf8'));
    logger.info('Loaded player ratings', { 
      teams: Object.keys(PLAYER_RATINGS.data || {}).length 
    });
  } catch (e) {
    logger.warn('Failed to load player ratings', { error: e.message });
  }
  
  try {
    const bridgePath = resolveDataPath('id_bridge.json');
    idBridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
    teamResolver.extendWithBridge(idBridge);
    logger.info('Loaded id_bridge', { teams: Object.keys(idBridge).length });
  } catch (e) {
    logger.warn('Failed to load id_bridge', { error: e.message });
  }
  
  return { PLAYER_RATINGS, idBridge };
}

/**
 * Initialize team data
 * @param {Object} deps - dependencies
 * @returns {Object} team data module
 */
function initTeamData(deps) {
  const { loader, teamResolver, idBridge, PLAYER_RATINGS } = deps;
  
  const teamData = require('./team-data');
  teamData.init({ loader, teamResolver, idBridge, PLAYER_RATINGS });
  
  return teamData;
}

/**
 * Initialize matchup modules
 * @param {Object} deps - dependencies
 * @returns {Object} matchup module collection
 */
function initMatchupModules(deps) {
  const { teamResolver, PLAYER_RATINGS, TEAM_FLAGS, getTeamNameZh, idBridge } = deps;
  
  let matchupAPI = null;
  try {
    matchupAPI = require('../services/matchup-api.js');
    logger.info('Matchup API module loaded');
  } catch (e) {
    logger.warn('Failed to load matchup-api.js', { error: e.message });
  }
  
  let matchupSpatial = null;
  try {
    matchupSpatial = require('./matchup-spatial')({ 
      teamResolver, PLAYER_RATINGS, TEAM_FLAGS, getTeamNameZh, idBridge 
    });
    logger.info('Spatial Matchup library loaded');
  } catch (e) {
    logger.warn('Failed to load matchup-spatial.js', { error: e.message });
  }
  
  const { assignLineupCoords } = require('./lineup-coords');
  
  return { matchupAPI, matchupSpatial, assignLineupCoords };
}

/**
 * Initialize services
 * @param {Object} deps - dependencies
 * @returns {Object} service collection
 */
function initServices(deps) {
  const { getCached, setCache, espn, RATINGS, getTeamNameZh, getTeamNameI18n, routes, TEAM_FLAGS } = deps;
  
  let predictionService = null;
  let reviewService = null;
  
  try {
    const PredictionService = require('./services/PredictionService');
    const ReviewService = require('./services/ReviewService');
    const serviceDeps = { getCached, setCache, espn, RATINGS, getTeamNameZh, getTeamNameI18n, routes, TEAM_FLAGS };
    predictionService = new PredictionService(serviceDeps);
    reviewService = new ReviewService(serviceDeps);
  } catch (e) {
    logger.warn('Service initialization delayed', { error: e.message });
  }
  
  return { predictionService, reviewService };
}

/**
 * Register routes
 * @param {Object} deps - dependencies
 */
function registerRoutes(deps) {
  const routes = {};
  
  try {
    // Try loading the database module (may fail due to better-sqlite3 build issues)
    let db = null;
    try {
      db = require('./db').db;
    } catch (dbError) {
      logger.warn('Database module not available', { error: dbError.message });
    }
    
    // Add the database module to the dependencies
    const depsWithDb = { ...deps, db };
    
    const registerRoutes = require('./routes');
    registerRoutes(routes, depsWithDb);
    logger.info('Modular routes registered', { 
      routeCount: Object.keys(routes).length 
    });
  } catch (e) {
    logger.error('Failed to register modular routes', { error: e.message });
  }
  
  return routes;
}

/**
 * Create application config
 * @returns {Object} application config
 */
function createAppConfig() {
  loadEnv();
  initErrorHandlers();
  
  const PORT = Number(process.env.PORT || 5099);
  const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  
  const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
  const TEMPLATES = path.join(__dirname, '..', 'templates');
  const STATIC = path.join(__dirname, '..', 'static');
  
  // Initialize infrastructure
  const infra = initInfrastructure();
  
  // Load data files
  const { PLAYER_RATINGS, idBridge } = loadDataFiles(infra.teamResolver);
  
  // Initialize team data
  const teamData = initTeamData({
    loader: infra.loader,
    teamResolver: infra.teamResolver,
    idBridge,
    PLAYER_RATINGS,
  });
  
  // Initialize matchup modules
  const matchupModules = initMatchupModules({
    teamResolver: infra.teamResolver,
    PLAYER_RATINGS,
    TEAM_FLAGS: teamData.TEAM_FLAGS,
    getTeamNameZh: teamData.getTeamNameZh,
    idBridge,
  });
  
  // Shared route registry: services (PredictionService, ReviewService) need live
  // access to registered route handlers — ReviewService calls the news-aggregation
  // route to gather post-match evidence, PredictionService calls the standings route.
  // Services are constructed BEFORE routes are registered, so they must hold a
  // reference to the SAME object that registerRoutes back-populates (see
  // lib/routes/index.js: `Object.assign(deps.routes, routes)`). Passing two separate
  // `{}` objects leaves the services' copy permanently empty, silently dropping
  // news/standings evidence.
  const routeRegistry = {};

  // Initialize services
  const services = initServices({
    getCached: infra.getCached,
    setCache: infra.setCache,
    espn: infra.espn,
    RATINGS: infra.loader.getRatings(),
    getTeamNameZh: teamData.getTeamNameZh,
    getTeamNameI18n: teamData.getTeamNameI18n,
    routes: routeRegistry,
    TEAM_FLAGS: teamData.TEAM_FLAGS,
  });
  
  // Create parseEvent function with dependencies
  const parseEvent = createParseEvent({
    TEAM_NAMES_ZH: teamData.TEAM_NAMES_ZH,
    getTeamNameI18n: teamData.getTeamNameI18n,
    RATINGS: infra.loader.getRatings(),
    ELO_RANK_MAP: teamData.ELO_RANK_MAP,
    TEAM_FLAGS: teamData.TEAM_FLAGS,
    TEAM_LOGOS: teamData.TEAM_LOGOS,
  });
  
  // Register routes
  const routes = registerRoutes({
    getCached: infra.getCached,
    setCache: infra.setCache,
    espn: infra.espn,
    fetchJSON: infra.fetchJSON,
    RATINGS: infra.loader.getRatings(),
    ELO_RANK_MAP: teamData.ELO_RANK_MAP,
    TEAM_NAMES: teamData.TEAM_NAMES,
    TEAM_FLAGS: teamData.TEAM_FLAGS,
    TEAM_NAMES_ZH: teamData.TEAM_NAMES_ZH,
    TEAM_LOGOS: teamData.TEAM_LOGOS,
    COACHES: infra.loader.getCoaches(),
    rosterCache: infra.rosterCache,
    parseEvent,
    getTeamNameZh: teamData.getTeamNameZh,
    getTeamNameI18n: teamData.getTeamNameI18n,
    teamNamesZh: teamData.TEAM_NAMES_ZH,
    routes: routeRegistry,
    PLAYER_RATINGS,
    getPlayerRatingData: teamData.getPlayerRatingData,
    assignLineupCoords: matchupModules.assignLineupCoords,
    matchupAPI: matchupModules.matchupAPI,
    matchupSpatial: matchupModules.matchupSpatial,
    ratingsData: infra.loader.getRatings(),
    loader: infra.loader,
    calculateVenueImpact: require('./venue-impact').calculateVenueImpact,
    analyzeStyleFit: require('./venue-impact').analyzeStyleFit,
    teamResolver: infra.teamResolver,
    idBridge,
    predictionService: services.predictionService,
    reviewService: services.reviewService,
    // P2-5: context-aware news search dependency
    getElo: (teamId) => {
      try { return services.predictionService?.getElo?.(teamId) ?? teamData.ELO_RANK_MAP?.[teamId] ?? null; } catch { return null; }
    },
    getTeamStyle: (teamId) => {
      try {
        const features = infra.loader?.getTeamFeatures?.()?.[teamId];
        return features?.play_style || features?.style || null;
      } catch { return null; }
    },
    getQualificationForMatch: (homeId, awayId) => {
      try {
        const tier = services.predictionService?.getQualificationTier?.(homeId, awayId);
        if (tier?.stage) return tier;
        // Fall back to Elo difference guess (knockout threshold >200)
        const h = teamData.ELO_RANK_MAP?.[homeId];
        const a = teamData.ELO_RANK_MAP?.[awayId];
        if (h && a && Math.abs(h - a) > 200) return { stage: 'knockout' };
        return { stage: 'group' };
      } catch { return { stage: 'group' }; }
    },
  });
  
  return {
    PORT,
    DATA_DIR,
    ESPN_BASE,
    TEMPLATES,
    STATIC,
    infra,
    teamData,
    matchupModules,
    services,
    routes,
    PLAYER_RATINGS,
    idBridge,
  };
}

module.exports = {
  createAppConfig,
  loadEnv,
  initErrorHandlers,
  initInfrastructure,
  loadDataFiles,
  initTeamData,
  initMatchupModules,
  initServices,
  registerRoutes,
};
