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

function teamIdsMatch(a, b) {
  const aa = a == null || a === '' ? null : String(a);
  const bb = b == null || b === '' ? null : String(b);
  if (bb === null) return true;
  if (aa === null) return false;
  return aa === bb;
}

function createMatchSnapshotScheduler({ predictionService, reviewService, db, dataDir, logger = console }) {
  const scheduleFile = path.join(dataDir, 'match_snapshot_schedule.json');
  const runsFile = path.join(dataDir, 'match_snapshot_runs.json');
  let timer = null;
  let running = false;
  let shutdownRequested = false;

  function isPlaceholderTeam(teamId, teamName, abbreviation, knownPlaceholderIds = null) {
    if (!teamId || teamId === 'TBD' || teamId === '待定') return true;
    const strId = String(teamId).trim();
    if (knownPlaceholderIds && knownPlaceholderIds.has(strId)) return true;
    const abbr = abbreviation ? String(abbreviation).trim() : '';
    if (/^(TBD|待定|QFW\d*|QW\d*|SFW\d*|SF\d*|W\d+|L\d+|RD\d+\s*[WL]\d*|Group\s+[A-Z]\s+(Winner|Runner-up))$/i.test(strId) || (abbr && /^(TBD|待定|QFW\d*|QW\d*|SFW\d*|SF\d*|W\d+|L\d+|RD\d+\s*[WL]\d*)$/i.test(abbr))) return true;
    if (teamName && /^(TBD|待定|QFW|QW\d|SFW|SF\d|RD\d+|Round of|Quarterfinal|Semifinal|Winner|Loser|胜者|负者|小组第一|小组第二)/i.test(String(teamName).trim())) return true;
    return false;
  }

  function getPreSnapshot(matchId, kickoffUtc, homeTeamId, awayTeamId, homeTeamName, awayTeamName, homeTeamAbbreviation, awayTeamAbbreviation, knownPlaceholderIds = new Set()) {
    const rows = db.prepare(`
      SELECT id, created_at, home_team_id, away_team_id, home_team_name, away_team_name FROM prediction_snapshots
      WHERE match_id = ? ORDER BY created_at DESC
    `).all(String(matchId));
    const kickoffTime = Date.parse(kickoffUtc);
    const homeIsPlaceholder = isPlaceholderTeam(homeTeamId, homeTeamName, homeTeamAbbreviation, knownPlaceholderIds);
    const awayIsPlaceholder = isPlaceholderTeam(awayTeamId, awayTeamName, awayTeamAbbreviation, knownPlaceholderIds);
    const scheduleHasRealTeams = !homeIsPlaceholder && !awayIsPlaceholder;
    if (homeIsPlaceholder && homeTeamId != null) knownPlaceholderIds.add(String(homeTeamId).trim());
    if (awayIsPlaceholder && awayTeamId != null) knownPlaceholderIds.add(String(awayTeamId).trim());

    for (const row of rows) {
      const rowTime = parseDbTime(row.created_at);
      if (Number.isFinite(kickoffTime) && Number.isFinite(rowTime) && rowTime >= kickoffTime) continue;

      const rowHasRealTeams = !isPlaceholderTeam(row.home_team_id, row.home_team_name, null, knownPlaceholderIds) && !isPlaceholderTeam(row.away_team_id, row.away_team_name, null, knownPlaceholderIds);
      if (scheduleHasRealTeams) {
        if (!teamIdsMatch(row.home_team_id, homeTeamId) || !teamIdsMatch(row.away_team_id, awayTeamId)) continue;
      } else {
        if (!rowHasRealTeams) continue;
      }
      return row;
    }
    return null;
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

  async function executeDueJobs(opts = {}) {
    if (running || shutdownRequested) return [];
    const schedule = opts.schedule || readJson(scheduleFile, null);
    if (!schedule?.matches?.length) {
      logger.warn('Match snapshot scheduler: schedule file missing or empty');
      return [];
    }

    running = true;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const runs = readJson(runsFile, {
      createdAt: new Date().toISOString(),
      scheduleGeneratedAt: schedule.generatedAt,
      matches: {},
    });
    const actions = [];

    const knownPlaceholderIds = new Set();
    for (const m of (schedule.matches || [])) {
      const hId = m.teams?.home?.id || m.homeId;
      const aId = m.teams?.away?.id || m.awayId;
      const hName = m.teams?.home?.name || m.homeName;
      const aName = m.teams?.away?.name || m.awayName;
      const hAbbr = m.teams?.home?.abbreviation || m.homeAbbreviation;
      const aAbbr = m.teams?.away?.abbreviation || m.awayAbbreviation;
      if (isPlaceholderTeam(hId, hName, hAbbr)) { if (hId != null) knownPlaceholderIds.add(String(hId).trim()); }
      if (isPlaceholderTeam(aId, aName, aAbbr)) { if (aId != null) knownPlaceholderIds.add(String(aId).trim()); }
    }

    try {
      for (const match of schedule.matches) {
        if (shutdownRequested) break;
        const state = getState(runs, match.matchId);
        try {
          const homeTeamId = match.teams?.home?.id || match.homeId || null;
          const awayTeamId = match.teams?.away?.id || match.awayId || null;
          const homeTeamName = match.teams?.home?.name || match.homeName || null;
          const awayTeamName = match.teams?.away?.name || match.awayName || null;
          const homeTeamAbbrev = match.teams?.home?.abbreviation || match.homeAbbreviation || null;
          const awayTeamAbbrev = match.teams?.away?.abbreviation || match.awayAbbreviation || null;
          const homeIsPlaceholder = isPlaceholderTeam(homeTeamId, homeTeamName, homeTeamAbbrev, knownPlaceholderIds);
          const awayIsPlaceholder = isPlaceholderTeam(awayTeamId, awayTeamName, awayTeamAbbrev, knownPlaceholderIds);
          const scheduleHasRealTeams = !homeIsPlaceholder && !awayIsPlaceholder;
          const preSnapshot = getPreSnapshot(match.matchId, match.kickoffUtc, homeTeamId, awayTeamId, homeTeamName, awayTeamName, homeTeamAbbrev, awayTeamAbbrev, knownPlaceholderIds);

          if (preSnapshot) {
            state.preSnapshotAt ||= preSnapshot.created_at;
            state.preSnapshotId ||= preSnapshot.id;
            delete state.preMissedAt;
            delete state.preMissReason;
          } else if (now < Date.parse(match.kickoffUtc)) {
            delete state.preSnapshotAt;
            delete state.preSnapshotId;
          }

          if (!preSnapshot && !state.preMissedAt && now >= Date.parse(match.kickoffUtc)) {
            state.preMissedAt = new Date().toISOString();
            state.preMissReason = 'kickoff_passed';
            actions.push(`pre_missed:${match.matchId}`);
          } else if (!state.preSnapshotAt && !state.preMissedAt && now >= Date.parse(match.preSnapshotAtUtc)) {
            if (scheduleHasRealTeams) {
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
            } else {
              logger.info?.(`Skipping pre_snapshot prediction for match ${match.matchId}: schedule teams are still placeholders.`);
            }
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
      if (!state.preSnapshotAt && !state.preMissedAt) {
        const preTime = Date.parse(match.preSnapshotAtUtc);
        const kickoffTime = Date.parse(match.kickoffUtc);
        if (Number.isFinite(preTime) && preTime > now) {
          candidates.push(preTime);
        } else if (Number.isFinite(preTime) && Number.isFinite(kickoffTime) && now >= preTime && now < kickoffTime) {
          candidates.push(now + 10 * 60 * 1000);
        }
      }
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
