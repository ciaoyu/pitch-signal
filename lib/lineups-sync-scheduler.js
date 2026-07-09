'use strict';

/**
 * lineups-sync-scheduler.js
 * Periodically sync lineups.json / matches.json / squads.json before matches
 *
 * Window strategy (reusing idea from match-snapshot-scheduler):
 * - Immediately sync once on service startup to prevent stale seed data in deployed images
 * - Within 2 hours before kickoff: fetch lineups + matches every ~15 minutes
 * - Outside match window: check every 5 minutes whether new matches enter window
 * - Clear lineups-source cache after syncing to ensure subsequent reads use latest data
 */

const fs = require('fs');
const path = require('path');
const { recordStart, recordSuccess, recordError, recordStop } = require('./jobs/registry');

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes (in match window)
const IDLE_CHECK_MS = 5 * 60 * 1000;     // 5 minutes (idle)
const PRE_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hour pre-match window

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
  let initialSyncPending = true;

  /**
   * Get list of matches currently inside pre-match window
   */
  function getUpcomingMatches() {
    const schedule = readJson(scheduleFile, null);
    if (!schedule?.matches?.length) return [];

    const now = Date.now();
    const upcoming = [];

    for (const match of schedule.matches) {
      const kickoff = Date.parse(match.kickoffUtc);
      if (isNaN(kickoff)) continue;

      // Matches between 2 hours before kickoff and 2 hours after kickoff
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
   * Execute lineups sync
   */
  async function executeSync() {
    if (running || shutdownRequested) return { synced: false, reason: 'busy_shutdown' };

    running = true;
    recordStart('lineups-sync');
    const runs = readJson(runsFile, { runs: [] });
    const results = { files: [], errors: [], matchedCount: 0 };

    try {
      // squads.json contains tournament appearances, goals and cards used by
      // /api/tournament-stats. Keep it in the same live-data sync cycle.
      const syncResult = await syncFifa(['lineups.json', 'matches.json', 'squads.json']);
      results.files = syncResult.results.map(r => r.name);
      results.errors = syncResult.errors.map(e => `${e.name}: ${e.error}`);

      // Clear lineups-source cache
      if (lineupsSource?.clearCache) {
        lineupsSource.clearCache();
      }

      // Record run
      runs.runs.push({
        timestamp: new Date().toISOString(),
        files: results.files,
        errors: results.errors,
      });

      // Retain last 100 records
      if (runs.runs.length > 100) {
        runs.runs = runs.runs.slice(-100);
      }
      runs.lastRun = new Date().toISOString();
      fs.writeFileSync(runsFile, JSON.stringify(runs, null, 2), 'utf8');

      results.synced = true;
      recordSuccess('lineups-sync');
    } catch (error) {
      results.synced = false;
      results.error = error.message;
      logger.error(`Lineups sync error: ${error.message}`);
      recordError('lineups-sync', error);
    } finally {
      running = false;
    }

    return results;
  }

  /**
   * Calculate next wakeup delay
   */
  function nextWakeDelay() {
    const upcoming = getUpcomingMatches();
    if (upcoming.length > 0) {
      // Match in window -> sync after 15 minutes
      return SYNC_INTERVAL_MS;
    }

    // Check when the next match enters the window
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

    // Time when next match enters window
    if (Number.isFinite(nearestEnterWindow)) {
      const delay = nearestEnterWindow - now;
      return Math.max(60000, Math.min(delay, IDLE_CHECK_MS)); // Minimum 1 minute, maximum 5 minutes
    }

    return IDLE_CHECK_MS; // No upcoming matches
  }

  async function tick() {
    if (shutdownRequested) return;

    try {
      const upcoming = getUpcomingMatches();
      if (initialSyncPending || upcoming.length > 0) {
        const reason = initialSyncPending
          ? 'startup'
          : `${upcoming.length} match(es) in window`;
        initialSyncPending = false;
        logger.log(`Live FIFA data sync: ${reason} — syncing...`);
        const result = await executeSync();
        if (result.synced) {
          logger.log(`Live FIFA data sync: done — ${result.files.join(', ')}`);
        }
      } else {
        recordSuccess('lineups-sync');
      }
    } catch (error) {
      logger.error(`Lineups sync tick error: ${error.message}`);
      recordError('lineups-sync', error);
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
      recordStop('lineups-sync');
    },
    executeSync,
    getUpcomingMatches,
  };
}

module.exports = { createLineupsSyncScheduler };
