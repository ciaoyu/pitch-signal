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

  // Core routes
  const coreRoutes = safeLoadRoutes('core', require('./core'), deps);

  // Prediction routes
  const predictionRoutes = safeLoadRoutes('prediction', require('./prediction'), deps);

  // Entity routes
  const entityRoutes = safeLoadRoutes('entity', require('./entities'), deps);

  // News routes（简化依赖）
  const newsRoutes = safeLoadRoutes('news', require('./news'), {
    espn: deps.espn,
    getTeamNameI18n: deps.getTeamNameI18n,
    teamNamesZh: deps.teamNamesZh,
    loader: deps.loader,
  });

  // Bot routes
  const botRoutes = safeLoadRoutes('bot', require('./bot'), deps);

  // Health routes
  const healthRoutes = safeLoadRoutes('health', require('./health'), deps);

  // Matchup routes
  const matchupRoutes = safeLoadRoutes('matchup', require('./matchup'), deps);

  // T03: Odds routes
  const oddsRoutes = safeLoadRoutes('odds', require('./odds'), deps);

  // T03: Standings routes
  const standingsRoutes = safeLoadRoutes('standings', require('./standings'), deps);

  // T03: Venue routes
  const venueRoutes = safeLoadRoutes('venue', require('./venue'), deps);

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
  Object.assign(routes, coreRoutes, predictionRoutes, entityRoutes, newsRoutes, botRoutes, healthRoutes, matchupRoutes, oddsRoutes, standingsRoutes, venueRoutes);

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
