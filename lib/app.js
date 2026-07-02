/**
 * 应用配置模块 - PitchSignal
 * 
 * 负责：
 * - 加载环境变量
 * - 初始化基础设施模块
 * - 配置中间件
 * - 注册路由
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const { createParseEvent } = require('./parse-event');
const { resolveDataPath } = require('./data-resolver');

const logger = createLogger('app');

/**
 * 加载 .env 文件
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
 * 初始化全局错误处理
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
 * 初始化基础设施模块
 * @returns {Object} 基础设施模块集合
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
 * 加载数据文件
 * @param {Object} teamResolver - 球队解析器
 * @returns {Object} 数据文件集合
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
 * 初始化团队数据
 * @param {Object} deps - 依赖项
 * @returns {Object} 团队数据模块
 */
function initTeamData(deps) {
  const { loader, teamResolver, idBridge, PLAYER_RATINGS } = deps;
  
  const teamData = require('./team-data');
  teamData.init({ loader, teamResolver, idBridge, PLAYER_RATINGS });
  
  return teamData;
}

/**
 * 初始化匹配模块
 * @param {Object} deps - 依赖项
 * @returns {Object} 匹配模块集合
 */
function initMatchupModules(deps) {
  const { teamResolver, PLAYER_RATINGS, TEAM_FLAGS, getTeamNameZh, idBridge } = deps;
  
  let matchupAPI = null;
  try {
    matchupAPI = require('../matchup-rating/matchup-api.js');
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
 * 初始化服务
 * @param {Object} deps - 依赖项
 * @returns {Object} 服务集合
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
 * 注册路由
 * @param {Object} deps - 依赖项
 */
function registerRoutes(deps) {
  const routes = {};
  
  try {
    // 尝试加载数据库模块（可能因better-sqlite3编译问题而失败）
    let db = null;
    try {
      db = require('./db').db;
    } catch (dbError) {
      logger.warn('Database module not available', { error: dbError.message });
    }
    
    // 将数据库模块添加到依赖项中
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
 * 创建应用配置
 * @returns {Object} 应用配置
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
  
  // 初始化基础设施
  const infra = initInfrastructure();
  
  // 加载数据文件
  const { PLAYER_RATINGS, idBridge } = loadDataFiles(infra.teamResolver);
  
  // 初始化团队数据
  const teamData = initTeamData({
    loader: infra.loader,
    teamResolver: infra.teamResolver,
    idBridge,
    PLAYER_RATINGS,
  });
  
  // 初始化匹配模块
  const matchupModules = initMatchupModules({
    teamResolver: infra.teamResolver,
    PLAYER_RATINGS,
    TEAM_FLAGS: teamData.TEAM_FLAGS,
    getTeamNameZh: teamData.getTeamNameZh,
    idBridge,
  });
  
  // 初始化服务
  const services = initServices({
    getCached: infra.getCached,
    setCache: infra.setCache,
    espn: infra.espn,
    RATINGS: infra.loader.getRatings(),
    getTeamNameZh: teamData.getTeamNameZh,
    getTeamNameI18n: teamData.getTeamNameI18n,
    routes: {},
    TEAM_FLAGS: teamData.TEAM_FLAGS,
  });
  
  // 创建带依赖的parseEvent函数
  const parseEvent = createParseEvent({
    TEAM_NAMES_ZH: teamData.TEAM_NAMES_ZH,
    getTeamNameI18n: teamData.getTeamNameI18n,
    RATINGS: infra.loader.getRatings(),
    ELO_RANK_MAP: teamData.ELO_RANK_MAP,
    TEAM_FLAGS: teamData.TEAM_FLAGS,
    TEAM_LOGOS: teamData.TEAM_LOGOS,
  });
  
  // 注册路由
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
    routes: {},
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
    // P2-5: 上下文感知新闻搜索依赖
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
        // 退回到 Elo 差值猜测（淘汰赛阈值 >200）
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
