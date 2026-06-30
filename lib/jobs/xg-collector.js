'use strict';

/**
 * xG Collector Job
 * 每天凌晨跑一次（或手动触发），消耗 API-Football 免费配额（100次/天）。
 * 拉取已结束比赛的 xG 统计，写入 team_xg_stats。
 */

const { syncXgFromApiFootball } = require('../services/xg-service');

// 每 24 小时跑一次
const INTERVAL_MS = 24 * 60 * 60 * 1000;

function createXgCollectorJob(deps) {
  const { logger = console } = deps;
  let timer = null;

  async function collect() {
    try {
      const n = await syncXgFromApiFootball();
      if (n > 0) logger.log(`[xg-collector] wrote xG for ${n} fixtures`);
    } catch (e) {
      logger.warn('[xg-collector] sync error:', e.message);
    }
  }

  return {
    start() {
      if (!process.env.API_FOOTBALL_KEY) {
        logger.log('[xg-collector] API_FOOTBALL_KEY not set — xG sync disabled');
        return false;
      }
      // 启动时跑一次，然后每 24h
      collect();
      timer = setInterval(collect, INTERVAL_MS);
      if (timer.unref) timer.unref();
      return true;
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
  };
}

module.exports = { createXgCollectorJob };
