'use strict';

/**
 * Schedule Updater Background Job
 * Wraps startScheduleUpdater from lib/schedule_updater.js so it runs inside startJobs lifecycle.
 * Syncs match status and real team IDs from ESPN to match_snapshot_schedule.json and memory cache.
 */

const { startScheduleUpdater } = require('../schedule_updater');
const { espn } = require('../../services/espn');
const loader = require('../../data/loader');

function createScheduleUpdaterJob(deps) {
  const { dataDir } = deps;
  let updater = null;

  return {
    start() {
      try {
        updater = startScheduleUpdater(dataDir, espn, loader);
        return true;
      } catch (e) {
        console.log('Schedule updater job unavailable:', e.message);
        return false;
      }
    },
    stop() {
      if (updater && typeof updater.stop === 'function') {
        updater.stop();
        updater = null;
      }
    },
  };
}

module.exports = { createScheduleUpdaterJob };
