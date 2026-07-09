let db = null;
try {
  db = require('../db').db;
} catch (e) {
  console.warn('Database module not available for health routes:', e.message);
}

const fifaApi = require('../services/fifa-api');
const { getJobStatuses } = require('../jobs/registry');

module.exports = function createHealthRoutes(deps) {
  return {
    'GET /health': async () => {
      // If database is available, test connection
      if (db) {
        try {
          const row = db.prepare('SELECT 1 as val').get();
          if (!row || row.val !== 1) throw new Error('DB test failed');
        } catch (e) {
          const err = new Error('Database is unreachable: ' + e.message);
          err.statusCode = 503;
          throw err;
        }
      }
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: db ? 'connected' : 'unavailable',
        fifaApi: fifaApi.getStatus(),
        fifaLastSyncAt: fifaApi.getLastSyncAt(),
        jobs: getJobStatuses(),
      };
    }
  };
};
