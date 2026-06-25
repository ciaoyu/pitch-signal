'use strict';

/**
 * T14: Match Snapshot Scheduler Job
 * Extracted from server.js — manages prediction snapshot scheduling
 * and post-match review processing.
 */

const { createMatchSnapshotScheduler } = require('../match-snapshot-scheduler');

/**
 * Create the match snapshot scheduler job
 * @param {Object} deps - Dependencies
 * @param {Object} deps.db - Database instance
 * @param {Object} deps.predictionService - PredictionService instance
 * @param {Object} deps.reviewService - ReviewService instance
 * @param {string} deps.dataDir - Data directory path
 * @returns {Object} Job with start/stop methods
 */
function createMatchSnapshotJob(deps) {
  let scheduler = null;

  return {
    start() {
      try {
        const { db, predictionService, reviewService, dataDir } = deps;
        scheduler = createMatchSnapshotScheduler({
          predictionService,
          reviewService,
          db,
          dataDir,
        });
        scheduler.start();
        return true;
      } catch (e) {
        console.log('Match snapshot scheduler unavailable:', e.message);
        return false;
      }
    },

    stop() {
      if (scheduler) {
        scheduler.stop();
        scheduler = null;
      }
    },
  };
}

module.exports = { createMatchSnapshotJob };
