const { db } = require('../db');

module.exports = function createHealthRoutes(deps) {
  return {
    'GET /health': async () => {
      try {
        const row = db.prepare('SELECT 1 as val').get();
        if (!row || row.val !== 1) throw new Error('DB test failed');
      } catch (e) {
        const err = new Error('Database is unreachable: ' + e.message);
        err.statusCode = 503;
        throw err;
      }
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      };
    }
  };
};
