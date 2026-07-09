'use strict';

/**
 * xG Collector Job
 * Runs once daily at midnight (or manually triggered), consuming API-Football free quota (100 requests/day).
 * Fetches xG stats for finished matches and writes them to team_xg_stats.
 */

const { syncXgFromApiFootball } = require('../services/xg-service');
const { recordStart, recordSuccess, recordError, recordStop } = require('./registry');

// Run once every 24 hours
const INTERVAL_MS = 24 * 60 * 60 * 1000;

function createXgCollectorJob(deps) {
  const { logger = console } = deps;
  let timer = null;

  async function collect() {
    recordStart('xg-collector');
    try {
      const n = await syncXgFromApiFootball();
      if (n > 0) logger.log(`[xg-collector] wrote xG for ${n} fixtures`);
      recordSuccess('xg-collector');
    } catch (e) {
      logger.warn('[xg-collector] sync error:', e.message);
      recordError('xg-collector', e);
    }
  }

  return {
    start() {
      if (!process.env.API_FOOTBALL_KEY) {
        logger.log('[xg-collector] API_FOOTBALL_KEY not set — xG sync disabled');
        return false;
      }
      // Run once at startup, then every 24h
      collect();
      timer = setInterval(collect, INTERVAL_MS);
      if (timer.unref) timer.unref();
      return true;
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      recordStop('xg-collector');
    },
  };
}

module.exports = { createXgCollectorJob };
