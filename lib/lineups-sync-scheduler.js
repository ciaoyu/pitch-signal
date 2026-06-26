'use strict';

/**
 * lineups-sync-scheduler.js
 * 赛前定期同步 lineups.json / matches.json
 *
 * 窗口策略（复用 match-snapshot-scheduler 的思路）：
 * - 开赛前 2 小时内：每 ~15 分钟拉一次 lineups + matches
 * - 无比赛窗口：每 5 分钟检查一次是否有新比赛进入窗口
 * - 同步后清除 lineups-source 缓存以确保后续读取使用最新数据
 */

const fs = require('fs');
const path = require('path');

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 分钟（比赛窗口内）
const IDLE_CHECK_MS = 5 * 60 * 1000;     // 5 分钟（空闲时）
const PRE_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000; // 开赛前 2 小时窗口

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function createLineupsSyncScheduler({ dataDir, syncFifa, lineupsSource, logger = console }) {
  const scheduleFile = path.join(dataDir, 'match_snapshot_schedule.json');
  const runsFile = path.join(dataDir, 'lineups_sync_runs.json');

  let timer = null;
  let running = false;
  let shutdownRequested = false;

  /**
   * 获取当前在赛前窗口内的比赛列表
   */
  function getUpcomingMatches() {
    const schedule = readJson(scheduleFile, null);
    if (!schedule?.matches?.length) return [];

    const now = Date.now();
    const upcoming = [];

    for (const match of schedule.matches) {
      const kickoff = Date.parse(match.kickoffUtc);
      if (isNaN(kickoff)) continue;

      // 开赛前 2 小时到开赛后 2 小时之间的比赛
      if (now >= kickoff - PRE_MATCH_WINDOW_MS && now <= kickoff + 2 * 60 * 60 * 1000) {
        upcoming.push({
          matchId: String(match.matchId),
          name: match.name || match.shortName || '',
          kickoffUtc: match.kickoffUtc,
          stage: match.stage || '',
        });
      }
    }

    return upcoming;
  }

  /**
   * 执行 lineups 同步
   */
  async function executeSync() {
    if (running || shutdownRequested) return { synced: false, reason: 'busy_shutdown' };

    running = true;
    const runs = readJson(runsFile, { runs: [] });
    const results = { files: [], errors: [], matchedCount: 0 };

    try {
      // 同步 lineups.json 和 matches.json
      const syncResult = await syncFifa(['lineups.json', 'matches.json']);
      results.files = syncResult.results.map(r => r.name);
      results.errors = syncResult.errors.map(e => `${e.name}: ${e.error}`);

      // 清除 lineups-source 缓存
      if (lineupsSource?.clearCache) {
        lineupsSource.clearCache();
      }

      // 记录运行
      runs.runs.push({
        timestamp: new Date().toISOString(),
        files: results.files,
        errors: results.errors,
      });

      // 保留最近 100 条记录
      if (runs.runs.length > 100) {
        runs.runs = runs.runs.slice(-100);
      }
      runs.lastRun = new Date().toISOString();
      fs.writeFileSync(runsFile, JSON.stringify(runs, null, 2), 'utf8');

      results.synced = true;
    } catch (error) {
      results.synced = false;
      results.error = error.message;
      logger.error(`Lineups sync error: ${error.message}`);
    } finally {
      running = false;
    }

    return results;
  }

  /**
   * 计算下次唤醒延迟
   */
  function nextWakeDelay() {
    const upcoming = getUpcomingMatches();
    if (upcoming.length > 0) {
      // 有比赛在窗口内 → 15 分钟后同步
      return SYNC_INTERVAL_MS;
    }

    // 检查最近一场比赛何时进入窗口
    const schedule = readJson(scheduleFile, null);
    if (!schedule?.matches?.length) return IDLE_CHECK_MS;

    const now = Date.now();
    let nearestEnterWindow = Infinity;

    for (const match of schedule.matches) {
      const kickoff = Date.parse(match.kickoffUtc);
      if (isNaN(kickoff)) continue;

      const enterWindowAt = kickoff - PRE_MATCH_WINDOW_MS;
      if (enterWindowAt > now && enterWindowAt < nearestEnterWindow) {
        nearestEnterWindow = enterWindowAt;
      }
    }

    // 下次进入窗口的时间
    if (Number.isFinite(nearestEnterWindow)) {
      const delay = nearestEnterWindow - now;
      return Math.max(60000, Math.min(delay, IDLE_CHECK_MS)); // 最少 1 分钟，最多 5 分钟
    }

    return IDLE_CHECK_MS; // 没比赛了
  }

  async function tick() {
    if (shutdownRequested) return;

    try {
      const upcoming = getUpcomingMatches();
      if (upcoming.length > 0) {
        logger.log(`Lineups sync: ${upcoming.length} match(es) in window — syncing...`);
        const result = await executeSync();
        if (result.synced) {
          logger.log(`Lineups sync: done — ${result.files.join(', ')}`);
        }
      }
    } catch (error) {
      logger.error(`Lineups sync tick error: ${error.message}`);
    } finally {
      if (!shutdownRequested) {
        const delay = nextWakeDelay();
        timer = setTimeout(tick, delay);
      }
    }
  }

  const handleShutdown = () => {
    logger.log('Lineups sync scheduler shutting down...');
    shutdownRequested = true;
    if (timer) clearTimeout(timer);
  };

  return {
    start() {
      if (timer || shutdownRequested) return false;
      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);
      void tick();
      return true;
    },
    stop() {
      handleShutdown();
      process.off('SIGINT', handleShutdown);
      process.off('SIGTERM', handleShutdown);
    },
    executeSync,
    getUpcomingMatches,
  };
}

module.exports = { createLineupsSyncScheduler };
