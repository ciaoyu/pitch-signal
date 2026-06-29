'use strict';

/**
 * T14: Background Jobs Manager
 * 
 * Provides startJobs/stopJobs lifecycle for all background jobs:
 * - Match snapshot scheduler
 * - AI postmortem runner (gated by AI_POSTMORTEM_ENABLED)
 * - Odds snapshot collector (gated by ODDS_API_KEY)
 * 
 * Each job is loaded independently — a failure in one does not prevent
 * others from starting.
 */

const { createMatchSnapshotJob } = require('./match-snapshot');
const { createAiPostmortemJob } = require('./ai-postmortem');
const { createOddsCollectorJob } = require('./odds-collector');
const { createLineupsSyncJob } = require('./lineups-sync');

const jobs = [];
let started = false;

/**
 * Start all background jobs
 * @param {Object} deps - Shared dependencies
 * @param {Object} deps.db - Database instance
 * @param {Object} deps.predictionService - PredictionService instance
 * @param {Object} deps.reviewService - ReviewService instance
 * @param {string} deps.dataDir - Data directory path
 */
function startJobs(deps) {
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') {
    console.log('⚠️ Background jobs disabled via DISABLE_BACKGROUND_JOBS');
    return;
  }

  if (started) {
    console.warn('⚠️ Jobs already started');
    return;
  }

  // Match snapshot scheduler
  try {
    const snapshotJob = createMatchSnapshotJob(deps);
    if (snapshotJob.start()) {
      jobs.push(snapshotJob);
    }
  } catch (e) {
    console.log('Match snapshot job skipped:', e.message);
  }

  // AI postmortem runner
  try {
    const postmortemJob = createAiPostmortemJob(deps);
    if (postmortemJob.start()) {
      jobs.push(postmortemJob);
    }
  } catch (e) {
    console.log('AI postmortem job skipped:', e.message);
  }

  // Odds snapshot collector
  try {
    const oddsJob = createOddsCollectorJob(deps);
    if (oddsJob.start()) {
      jobs.push(oddsJob);
    }
  } catch (e) {
    console.log('Odds collector job skipped:', e.message);
  }

  // T3: Lineups sync scheduler（赛前每 ~15 分钟同步 lineups.json）
  try {
    const lineupsSyncJob = createLineupsSyncJob(deps);
    if (lineupsSyncJob.start()) {
      jobs.push(lineupsSyncJob);
    }
  } catch (e) {
    console.log('Lineups sync job skipped:', e.message);
  }

  started = true;
  console.log(`🚀 Started ${jobs.length} background job(s)`);
}

/**
 * Stop all background jobs gracefully
 */
function stopJobs() {
  if (!started) return;

  for (const job of jobs) {
    try {
      job.stop();
    } catch (e) {
      console.warn('Job stop error:', e.message);
    }
  }
  jobs.length = 0;
  started = false;
  console.log('🛑 All background jobs stopped');
}

/**
 * Check if jobs are running
 */
function isRunning() {
  return started;
}

module.exports = { startJobs, stopJobs, isRunning };
