/**
 * Route registrar - merges module routes into the main routes object
 * Usage: const registerRoutes = require('./lib/routes'); registerRoutes(routes, deps);
 * 
 * T02: Each route group loads independently; failure does not affect other modules.
 * T03: Register odds, standings, venue modules.
 * Failed modules are reported in logs; /health endpoint remains unaffected.
 */

const failedModules = [];

/**
 * Safely load and instantiate route module
 * @param {string} name - Module name (for logging)
 * @param {Function} factory - Route creation factory function
 * @param {Object} deps - Dependencies object
 * @returns {Object} Routes object, or empty object on failure
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
  failedModules.length = 0; // Clear failure list

  // Safely load module
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

  // News routes (simplified dependencies)
  const newsModule = safeRequire('news');
  const newsRoutes = newsModule ? safeLoadRoutes('news', newsModule, {
    espn: deps.espn,
    getTeamNameI18n: deps.getTeamNameI18n,
    teamNamesZh: deps.teamNamesZh,
    loader: deps.loader,
    getElo: deps.getElo || null,              // P2-5: Elo context
    getTeamStyle: deps.getTeamStyle || null,  // P2-5: Tactical style context
    getQualificationForMatch: deps.getQualificationForMatch || null, // P2-5: Qualification context
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

  // P2-4: User predictions routes
  const userPredictionsModule = safeRequire('user-predictions');
  const userPredictionsRoutes = userPredictionsModule ? safeLoadRoutes('user-predictions', userPredictionsModule, deps) : {};

  // P2-2: PWA push subscription routes
  const pushModule = safeRequire('push');
  const pushRoutes = pushModule ? safeLoadRoutes('push', pushModule, deps) : {};

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

  // P4-4: calibration report routes
  const calibrationModule = safeRequire('calibration');
  const calibrationRoutes = calibrationModule ? safeLoadRoutes('calibration', calibrationModule, deps) : {};

  // Prediction routes aliases (backward compatibility)
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

  // Merge all successfully loaded routes
  Object.assign(routes, coreRoutes, predictionRoutes, entityRoutes, newsRoutes, botRoutes, healthRoutes, matchupRoutes, oddsRoutes, oddsDivergenceRoutes, userPredictionsRoutes, pushRoutes, standingsRoutes, venueRoutes, coachRoutes, lineupsRoutes, askRoutes, recentRoutes, calibrationRoutes);
  if (deps && deps.routes) Object.assign(deps.routes, routes);

  // Report failed modules
  if (failedModules.length > 0) {
    console.warn(`⚠️ ${failedModules.length} route module(s) failed to load:`);
    for (const { name, error } of failedModules) {
      console.warn(`   - ${name}: ${error}`);
    }
  }
};

// Export failed module list for health check use
module.exports.getFailedModules = () => [...failedModules];
