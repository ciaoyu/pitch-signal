'use strict';

/**
 * lineups-sync.js
 * Lineups sync background job wrapper
 */

const { createLineupsSyncScheduler } = require('../lineups-sync-scheduler');
const { syncSelected } = require('../../scripts/sync-fifa-data');
const lineupsSource = require('../lineups-source');

function createLineupsSyncJob(deps) {
  const { dataDir, logger } = deps;

  const scheduler = createLineupsSyncScheduler({
    dataDir,
    syncFifa: syncSelected, // Selective sync function from scripts/sync-fifa-data.js
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
