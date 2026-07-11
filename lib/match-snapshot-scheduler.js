'use strict';

const fs = require('fs');
const path = require('path');
const { recordStart, recordSuccess, recordError, recordStop } = require('./jobs/registry');
const { runDueOddsMilestones, nextOddsWakeDelay } = require('./services/odds-milestone');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function parseDbTime(value) {
  if (!value) return null;
  const text = String(value);
  const parsed = Date.parse(text.includes('T') ? text : `${text.replace(' ', 'T')}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function createMatchSnapshotScheduler({ predictionService, reviewService, db, dataDir, logger = console }) {
  const scheduleFile = path.join(dataDir, 'match_snapshot_schedule.json');
  const runsFile = path.join(dataDir, 'match_snapshot_runs.json');
  let timer = null;
  let running = false;
  let shutdownRequested = false;

  function getPreSnapshot(matchId, kickoffUtc) {
    const row = db.prepare(`
      SELECT id, created_at FROM prediction_snapshots
      WHERE match_id = ? ORDER BY created_at ASC LIMIT 1
    `).get(String(matchId));
    if (!row || parseDbTime(row.created_at) >= Date.parse(kickoffUtc)) return null;
    return row;
  }

  function getPostReview(matchId) {
    return db.prepare(`
      SELECT actual_home_score, actual_away_score, status, updated_at
      FROM post_match_reviews WHERE match_id = ?
      ORDER BY updated_at DESC LIMIT 1
    `).get(String(matchId));
  }

  function getState(runs, matchId) {
    runs.matches ||= {};
    runs.matches[matchId] ||= {};
    return runs.matches[matchId];
  }

  async function executeDueJobs() {
    if (running || shutdownRequested) return [];
    const schedule = readJson(scheduleFile, null);
    if (!schedule?.matches?.length) {
      logger.warn('Match snapshot scheduler: schedule file missing or empty');
      return [];
    }

    running = true;
    const now = Date.now();
    const runs = readJson(runsFile, {
      createdAt: new Date().toISOString(),
      scheduleGeneratedAt: schedule.generatedAt,
      matches: {},
    });
    const actions = [];

    try {
      for (const match of schedule.matches) {
        if (shutdownRequested) break;
        const state = getState(runs, match.matchId);
        
        try {
          const preSnapshot = getPreSnapshot(match.matchId, match.kickoffUtc);
          if (preSnapshot) {
            state.preSnapshotAt ||= preSnapshot.created_at;
            state.preSnapshotId ||= preSnapshot.id;
            delete state.preMissedAt;
            delete state.preMissReason;
          } else if (!state.preMissedAt && now >= Date.parse(match.kickoffUtc)) {
            state.preMissedAt = new Date().toISOString();
            state.preMissReason = 'kickoff_passed';
            actions.push(`pre_missed:${match.matchId}`);
          } else if (!state.preSnapshotAt && !state.preMissedAt && now >= Date.parse(match.preSnapshotAtUtc)) {
            const prediction = await predictionService.predictMatch(match.matchId, { persist: true });
            if (prediction?.error) throw new Error(prediction.message || prediction.error);
            state.preSnapshotAt = new Date().toISOString();
            state.preSnapshotSummary = {
              likelyScore: prediction.likelyScore || null,
              homeWin: prediction.homeWin ?? null,
              draw: prediction.draw ?? null,
              awayWin: prediction.awayWin ?? null,
            };
            actions.push(`pre_snapshot:${match.matchId}`);
          }

          const savedReview = getPostReview(match.matchId);
          if (savedReview) {
            state.postReviewAt ||= savedReview.updated_at || new Date().toISOString();
            state.postReviewSummary ||= {
              actualScore: `${savedReview.actual_home_score}-${savedReview.actual_away_score}`,
              status: savedReview.status || null,
            };
          } else if (now >= Date.parse(match.postSnapshotAtUtc)) {
            const review = await reviewService.reviewMatch(match.matchId, { persist: true });
            if (review?.error) throw new Error(review.message || review.error);
            if (review?.match?.completed || review?.match?.status === 'STATUS_FINAL') {
              state.postReviewAt = new Date().toISOString();
              actions.push(`post_review:${match.matchId}`);
            } else {
              state.lastPostAttemptAt = new Date().toISOString();
            }
          }
        } catch (matchError) {
          logger.error(`Error processing match ${match.matchId}: ${matchError.message}`);
        }
      }
    } finally {
      runs.updatedAt = new Date().toISOString();
      runs.scheduler = 'server-runtime';
      writeJson(runsFile, runs);
      running = false;
    }

    try {
      const oddsActions = await runDueOddsMilestones({
        schedule: schedule.matches,
        dataDir,
        db,
        predictionService,
        logger,
      });
      actions.push(...oddsActions);
    } catch (error) {
      logger.error(`Odds milestone collection error: ${error.message}`);
    }

    return actions;
  }

  function nextWakeDelay() {
    const schedule = readJson(scheduleFile, null);
    if (!schedule?.matches?.length) return 60 * 60 * 1000;
    const now = Date.now();
    const runs = readJson(runsFile, { matches: {} });
    const candidates = [];
    for (const match of schedule.matches) {
      const state = runs.matches?.[match.matchId] || {};
      if (!state.preSnapshotAt && !state.preMissedAt) candidates.push(Date.parse(match.preSnapshotAtUtc));
      if (!state.postReviewAt) candidates.push(Date.parse(match.postSnapshotAtUtc));
    }
    const oddsDelay = nextOddsWakeDelay(schedule.matches, dataDir);
    const future = candidates.filter((value) => Number.isFinite(value) && value > now).sort((a, b) => a - b)[0];
    const baseDelay = future ? Math.max(1000, Math.min(future - now, 60 * 60 * 1000)) : 60 * 60 * 1000;
    if (oddsDelay == null) return baseDelay;
    return Math.max(1000, Math.min(baseDelay, oddsDelay));
  }

  async function tick() {
    if (shutdownRequested) return;
    try {
      recordStart('match-snapshot');
      const actions = await executeDueJobs();
      if (actions.length) logger.log(`Match snapshot scheduler: ${actions.join(', ')}`);
      recordSuccess('match-snapshot');
    } catch (error) {
      logger.error(`Match snapshot scheduler error: ${error.message}`);
      recordError('match-snapshot', error);
    } finally {
      if (!shutdownRequested) {
        timer = setTimeout(tick, nextWakeDelay());
      }
    }
  }

  const handleShutdown = () => {
    logger.log('Match snapshot scheduler shutting down...');
    shutdownRequested = true;
    if (timer) clearTimeout(timer);
  };

  return {
    start() {
      if (timer || shutdownRequested) return;
      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);
      void tick();
    },
    stop() {
      handleShutdown();
      process.off('SIGINT', handleShutdown);
      process.off('SIGTERM', handleShutdown);
      recordStop('match-snapshot');
    },
    executeDueJobs,
  };
}

module.exports = { createMatchSnapshotScheduler };
