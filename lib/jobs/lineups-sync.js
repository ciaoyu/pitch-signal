'use strict';

/**
 * lineups-sync.js
 * Lineups 同步 background job 包装器
 */

const { createLineupsSyncScheduler } = require('../lineups-sync-scheduler');
const { syncSelected } = require('../../scripts/sync-fifa-data');
const lineupsSource = require('../lineups-source');

function createLineupsSyncJob(deps) {
  const { dataDir, logger } = deps;

  const scheduler = createLineupsSyncScheduler({
    dataDir,
    syncFifa: syncSelected, // scripts/sync-fifa-data.js 的选择性同步函数
    lineupsSource,
    logger: logger || console,
  });

  return {
    start() {
      return scheduler.start();
    },
    stop() {
      scheduler.stop();
    },
  };
}

module.exports = { createLineupsSyncJob };
