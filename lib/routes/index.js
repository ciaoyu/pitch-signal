/**
 * 路由注册器 - 将各模块路由合并到主 routes 对象
 * 用法: const registerRoutes = require('./lib/routes'); registerRoutes(routes, deps);
 * 
 * T02: 每个路由组独立加载，失败不会影响其他模块。
 * T03: 注册 odds、standings、venue 模块。
 * 失败的模块会在日志中报告，/health 端点不受影响。
 */

const failedModules = [];

/**
 * 安全地加载并创建路由模块
 * @param {string} name - 模块名称（用于日志）
 * @param {Function} factory - 创建路由的工厂函数
 * @param {Object} deps - 依赖对象
 * @returns {Object} 路由对象，失败时返回空对象
 */
function safeLoadRoutes(name, factory, deps) {
  try {
    const routes = factory(deps);
    const count = Object.keys(routes).length;
    console.log(`✅ Registered ${count} ${name} routes`);
    return routes;
  } catch (e) {
    console.error(`❌ Failed to load ${name} routes: ${e.message}`);
    failedModules.push({ name, error: e.message });
    return {};
  }
}

module.exports = function registerRoutes(routes, deps) {
  failedModules.length = 0; // 清空失败列表

  // 安全地加载模块
  function safeRequire(name) {
    try {
      return require(`./${name}`);
    } catch (e) {
      console.error(`❌ Failed to require ${name} module: ${e.message}`);
      failedModules.push({ name, error: e.message });
      return null;
    }
  }

  // Core routes
  const coreModule = safeRequire('core');
  const coreRoutes = coreModule ? safeLoadRoutes('core', coreModule, deps) : {};

  // Prediction routes
  const predictionModule = safeRequire('prediction');
  const predictionRoutes = predictionModule ? safeLoadRoutes('prediction', predictionModule, deps) : {};

  // Entity routes
  const entityModule = safeRequire('entities');
  const entityRoutes = entityModule ? safeLoadRoutes('entity', entityModule, deps) : {};

  // News routes（简化依赖）
  const newsModule = safeRequire('news');
  const newsRoutes = newsModule ? safeLoadRoutes('news', newsModule, {
    espn: deps.espn,
    getTeamNameI18n: deps.getTeamNameI18n,
    teamNamesZh: deps.teamNamesZh,
    loader: deps.loader,
  }) : {};

  // Bot routes
  const botModule = safeRequire('bot');
  const botRoutes = botModule ? safeLoadRoutes('bot', botModule, deps) : {};

  // Health routes
  const healthModule = safeRequire('health');
  const healthRoutes = healthModule ? safeLoadRoutes('health', healthModule, deps) : {};

  // Matchup routes
  const matchupModule = safeRequire('matchup');
  const matchupRoutes = matchupModule ? safeLoadRoutes('matchup', matchupModule, deps) : {};

  // T03: Odds routes
  const oddsModule = safeRequire('odds');
  const oddsRoutes = oddsModule ? safeLoadRoutes('odds', oddsModule, deps) : {};

  // P2-3: Odds divergence routes (model vs market)
  const oddsDivergenceModule = safeRequire('odds-divergence');
  const oddsDivergenceRoutes = oddsDivergenceModule ? safeLoadRoutes('odds-divergence', oddsDivergenceModule, deps) : {};

  // T03: Standings routes
  const standingsModule = safeRequire('standings');
  const standingsRoutes = standingsModule ? safeLoadRoutes('standings', standingsModule, deps) : {};

  // T03: Venue routes
  const venueModule = safeRequire('venue');
  const venueRoutes = venueModule ? safeLoadRoutes('venue', venueModule, deps) : {};

  // Coach routes
  const coachModule = safeRequire('coach');
  const coachRoutes = coachModule ? safeLoadRoutes('coach', coachModule, deps) : {};

  // Lineups routes
  const lineupsModule = safeRequire('lineups');
  const lineupsRoutes = lineupsModule ? safeLoadRoutes('lineups', lineupsModule, deps) : {};

  // Ask routes
  const askModule = safeRequire('ask');
  const askRoutes = askModule ? safeLoadRoutes('ask', askModule, deps) : {};

  // Recent routes (recent-matches + recent-stats)
  const recentModule = safeRequire('recent');
  const recentRoutes = recentModule ? safeLoadRoutes('recent', recentModule, deps) : {};

  // Prediction routes 别名（向后兼容）
  if (predictionRoutes['GET /api/elo/rankings']) {
    predictionRoutes['GET /api/elo-rankings'] = predictionRoutes['GET /api/elo/rankings'];
  }
  if (predictionRoutes['GET /api/match-review/:matchId']) {
    predictionRoutes['GET /api/match/:id/review'] = (params) =>
      predictionRoutes['GET /api/match-review/:matchId']({ matchId: params.id });
  }
  if (predictionRoutes['GET /api/post-match-review/:matchId']) {
    predictionRoutes['GET /api/match/:id/post-match-review'] = (params) =>
      predictionRoutes['GET /api/post-match-review/:matchId']({ matchId: params.id });
  }

  // 合并所有成功加载的路由
  Object.assign(routes, coreRoutes, predictionRoutes, entityRoutes, newsRoutes, botRoutes, healthRoutes, matchupRoutes, oddsRoutes, oddsDivergenceRoutes, standingsRoutes, venueRoutes, coachRoutes, lineupsRoutes, askRoutes, recentRoutes);
  if (deps && deps.routes) Object.assign(deps.routes, routes);

  // 报告失败的模块
  if (failedModules.length > 0) {
    console.warn(`⚠️ ${failedModules.length} route module(s) failed to load:`);
    for (const { name, error } of failedModules) {
      console.warn(`   - ${name}: ${error}`);
    }
  }
};

// 导出失败模块列表，供健康检查使用
module.exports.getFailedModules = () => [...failedModules];
