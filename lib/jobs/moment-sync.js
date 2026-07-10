'use strict';

/**
 * Match Moment Sync Job
 *
 * Polls ongoing matches to detect and persist match moments.
 * Polling frequency: every 60s when matches are live, otherwise every 5 minutes.
 *
 * Data source priority:
 *   1. FIFA live API (formation coordinates + detailed subs)
 *   2. ESPN keyEvents (fallback, includes subs/goals/red cards)
 */

const { fetchJSON } = require('../../services/espn');
const fifaApi = require('../services/fifa-api');
const { extractPlayerEvents, upsertPlayerEvents, roundFromSummary } = require('../services/player-events');
const {
  detectFromEspn,
  detectFromFifa,
  detectStructural,
  persistMoments,
} = require('../services/moment-detector');
const { reprice, probDelta } = require('../live-reprice');
const liveHelpers = require('../live-helpers');
const {
  computePressureIndex,
  parseEspnStats,
  detectSurge,
  saveStatSnapshot,
  getPrevSnapshot,
} = require('../services/pressure-index');
const { db } = require('../db');
const { recordStart, recordSuccess, recordError, recordStop } = require('./registry');
const { writebackMatchScore, resolveTeamToRatingsId } = require('../services/score-writeback');
const pushService = require('../services/push-service');
const { updateSubstitutionImpacts } = require('../services/substitution-impact');
const { safeExec, safeExecSync, loggers } = require('../logger');

// matchId -> Set<type> structural moment deduplication map (in-memory, clearing on restart is safe)
const _structuralEmitted = new Map();

// ESPN season.slug -> stage label (consistent with mapping in lib/parse-event.js).
// Used to annotate stage for knockout rows during score writeback; falls back to 'Knockout' if missing.
function deriveStageFromEspnSlug(slug) {
  if (!slug) return '';
  if (slug.includes('group')) return 'Group Stage';
  if (slug.includes('32')) return 'R32';
  if (slug.includes('16')) return 'R16';
  if (slug.includes('quarter')) return 'QF';
  if (slug.includes('semi')) return 'SF';
  if (slug.includes('third')) return '3rd Place';
  if (slug.includes('final')) return 'Final';
  return '';
}

function createMomentSyncJob(deps) {
  const log = deps.logger || loggers.momentSync || console;
  const push = deps.pushService || pushService;
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    recordStart('moment-sync');

    let liveMatches = [];
    try {
      liveMatches = await safeExec(() => getLiveMatches(log), {
        jobName: 'moment-sync',
        source: 'espn',
        stage: 'fetch_live_matches',
        reason: 'espn_scoreboard_fetch_error',
        fallback: []
      }, log) || [];

      if (!liveMatches.length) {
        recordSuccess('moment-sync');
        return;
      }

      for (const m of liveMatches) {
        await safeExec(() => processMatch(m, log), {
          jobName: 'moment-sync',
          matchId: m.espnId,
          source: 'moment_sync_engine',
          stage: 'process_match',
          reason: 'match_processing_exception'
        }, log);
      }
      recordSuccess('moment-sync');
    } catch (e) {
      if (log && log.error) {
        log.error(`[moment-sync] tick error: ${e.message}`, {
          jobName: 'moment-sync',
          source: 'moment_sync_engine',
          stage: 'tick_loop',
          reason: 'unhandled_tick_exception',
          message: e.message,
          stack: e.stack
        });
      }
      recordError('moment-sync', e);
    } finally {
      running = false;
      scheduleNext(liveMatches && liveMatches.length > 0);
    }
  }

  function scheduleNext(hasLive) {
    if (timer) clearTimeout(timer);
    const delay = hasLive ? 60_000 : 5 * 60_000;
    timer = setTimeout(tick, delay);
    if (timer.unref) timer.unref();
  }

  async function processMatch(m, loggerInstance = null) {
    const log = loggerInstance || loggers.momentSync;
    const matchId  = m.espnId;
  const matchState = {
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    espnStatus: m.statusName,
    homeTeamId: m.homeEspnId || null,
    awayTeamId: m.awayEspnId || null,
  };

    // Structural deduplication Set (per match)
    if (!_structuralEmitted.has(matchId)) _structuralEmitted.set(matchId, new Set());
    const emitted = _structuralEmitted.get(matchId);

    let moments = [];
    const minute = m.minute ?? 0;

    // Derive isKnockout from stage (server-authoritative, not client-trusted)
    const stage = m.stage || '';
    const isKnockout = stage !== '' && !/group/i.test(stage);

    // ── 1. FIFA live (priority) ────────────────────────────────────────────────
    const fifaMatch = await safeExec(() => tryFifaLive(m, log), {
      jobName: 'moment-sync',
      matchId,
      source: 'fifa',
      stage: 'fetch_fifa_live',
      reason: 'fifa_api_error',
      fallback: null
    }, log);
    if (fifaMatch) {
      moments.push(...detectFromFifa(matchId, fifaMatch.events, matchState));
    }

    // ── 2. ESPN keyEvents (supplementary or fallback) ─────────────────────────
    const espnData = await safeExec(() => tryEspnKeyEvents(matchId, log), {
      jobName: 'moment-sync',
      matchId,
      source: 'espn',
      stage: 'fetch_espn_key_events',
      reason: 'espn_api_error',
      fallback: null
    }, log) || {};
    const espnEvents = espnData?.keyEvents ?? [];
    if (espnEvents.length) {
      moments.push(...detectFromEspn(matchId, espnEvents, matchState));
    }

    // Both sources can emit the same goal. ESPN key events include the
    // post-goal score, so prefer them over the FIFA row for repricing.
    moments = preferEspnGoals(moments);

    // ── 2b. KO-4: player-level card/goal/assist ledger (idempotent) ────────────
    // Captured live so the suspension section can surface bans in real time.
    // Uses the SAME round derivation as the backfill (roundFromSummary) so the
    // two paths stay idempotent under INSERT OR IGNORE.
    const round = roundFromSummary(espnData);
    const playerMeta = {
      homeTeamId: m.homeEspnId || null,
      awayTeamId: m.awayEspnId || null,
      stage: m.stage || null,
      round,
    };
    const playerEvents = extractPlayerEvents(matchId, espnEvents, playerMeta);
    if (playerEvents.length) {
      safeExecSync(() => {
        const n = upsertPlayerEvents(playerEvents);
        if (n > 0 && log.log) log.log(`[moment-sync] ${matchId} player-events +${n} (round=${round || '?'})`);
      }, {
        jobName: 'moment-sync',
        matchId,
        source: 'sqlite',
        stage: 'persist_player_events',
        reason: 'player_event_write_error'
      }, log);
    }

    // ── 3. Structural moments (cooling break/HT/stoppage/ET) ───────────────────
    moments.push(...detectStructural(matchId, minute, m.statusName, matchState, emitted));

    // ── 4. Track A live repricing: inject probability snapshots for all new moments ─
    // Added time parsed from clock string (e.g. "90'+4" → 4, "45'+2" → 2)
    const addedTime = parseAddedTime(m.displayClock || '');

    // Count red cards from ESPN key events (after fetch above, not from scoreboard map)
    const homeRedCards = countRedCards(espnEvents, m.homeEspnId);
    const awayRedCards = countRedCards(espnEvents, m.awayEspnId);

    const prePred = getPreMatchPrediction(matchId);
    if (prePred && moments.length) {
      safeExecSync(() => injectMomentProbabilities(moments, prePred, {
        currentMinute: minute,
        currentAddedTime: addedTime,
        homeRedCards,
        awayRedCards,
        isKnockout,
      }), {
        jobName: 'moment-sync',
        matchId,
        source: 'live_reprice',
        stage: 'inject_reprice_probs',
        reason: 'reprice_injection_error'
      }, log);
    }

    const pushableGoals = selectPushableGoals(moments, matchId, minute, db);
    const saved = safeExecSync(() => persistMoments(moments), {
      jobName: 'moment-sync',
      matchId,
      source: 'sqlite',
      stage: 'persist_moments',
      reason: 'db_write_error',
      fallback: 0
    }, log) || 0;
    if (saved > 0 && log.log) {
      log.log(`[moment-sync] ${matchId} +${saved} moments (min=${minute})`);
    } else if (saved > 0) {
      console.log(`[moment-sync] ${matchId} +${saved} moments (min=${minute})`);
    }

    // ── 5. New goal push notifications (only for newly persisted goals close to current minute) ─
    if (saved > 0 && pushableGoals.length) {
      for (const goal of pushableGoals) {
        await safeExec(() => push.sendPushNotification(
          matchId,
          buildGoalPayload(m, goal),
          { source: 'moment_sync' },
        ), {
          jobName: 'push',
          matchId,
          source: 'moment_sync',
          stage: 'goal_notification',
          reason: 'goal_push_failed',
        }, log);
      }
    }

    // ── 6. Pressure Index snapshot ────────────────────────────────────────────
    await safeExec(() => updatePressure(matchId, minute, matchState, moments, log), {
      jobName: 'moment-sync',
      matchId,
      source: 'espn_stats',
      stage: 'update_pressure',
      reason: 'pressure_calculation_error'
    }, log);

    // ── 7. Final score writeback and cleanup ───────────────────────────────────
    const fifaFinal = fifaMatch && fifaMatch.status === 0;
    const isFinal = m.statusName === 'STATUS_FINAL' || m.statusName === 'STATUS_FULL_TIME' || m.statusState === 'post' || fifaFinal;
    if (isFinal) {
      safeExecSync(() => writebackMatchScore({
        espnId: matchId,
        homeTeam: fifaMatch?.homeTeam?.id || m.homeEspnId || m.homeTeamFifaCode,
        awayTeam: fifaMatch?.awayTeam?.id || m.awayEspnId || m.awayTeamFifaCode,
        homeScore: fifaMatch ? fifaMatch.homeScore : m.homeScore,
        awayScore: fifaMatch ? fifaMatch.awayScore : m.awayScore,
        statusName: fifaFinal ? 'STATUS_FINAL' : m.statusName,
        matchDate: m.matchDate,
        stage: m.stage || 'Knockout',
        source: fifaMatch ? 'fifa' : 'espn',
        logger: log,
      }), {
        jobName: 'moment-sync',
        matchId,
        source: fifaMatch ? 'fifa' : 'espn',
        stage: 'writeback_score',
        reason: 'score_writeback_exception'
      }, log);
      _structuralEmitted.delete(matchId);
    } else if (m.statusName === 'STATUS_FINAL' || m.statusName === 'STATUS_FULL_TIME') {
      _structuralEmitted.delete(matchId);
    }
  }

  return {
    start() {
      tick();
      return true;
    },
    stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      recordStop('moment-sync');
    },
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function selectPushableGoals(moments, matchId, currentMinute, database = db) {
  const seen = new Set();
  return (moments || []).filter(moment => {
    if (moment?.type !== 'goal') return false;
    const minute = Number(moment.minute || 0);
    const minuteAdded = Number(moment.minuteAdded || 0);
    const now = Number(currentMinute || 0);
    if (now > 0 && (minute > now + 1 || now - minute > 5)) return false;

    // FIFA and ESPN can describe the same goal with different team identifiers.
    const key = `${minute}:${minuteAdded}`;
    if (seen.has(key)) return false;
    seen.add(key);

    const existing = database.prepare(`
      SELECT 1 FROM match_moments
      WHERE match_id = ? AND type = 'goal' AND minute = ? AND minute_added = ?
      LIMIT 1
    `).get(String(matchId), minute, minuteAdded);
    return !existing;
  });
}

function preferEspnGoals(moments) {
  const espnGoalKeys = new Set((moments || [])
    .filter(m => m?.source === 'espn' && m.type === 'goal')
    .map(m => `${m.minute}:${m.minuteAdded || 0}`));
  return (moments || []).filter(m => {
    if (m?.source !== 'fifa' || m.type !== 'goal') return true;
    return !espnGoalKeys.has(`${m.minute}:${m.minuteAdded || 0}`);
  });
}

function injectMomentProbabilities(moments, prePred, context = {}) {
  for (const moment of moments || []) {
    const score = moment.scoreState || {};
    const liveProb = reprice({
      preLambdaHome: prePred.home_expected_goals ?? 1.2,
      preLambdaAway: prePred.away_expected_goals ?? 1.0,
      homeScore: Number(score.home ?? 0),
      awayScore: Number(score.away ?? 0),
      minuteElapsed: Number(moment.minute ?? context.currentMinute ?? 0),
      addedTime: Number(moment.minute === context.currentMinute
        ? context.currentAddedTime ?? 0
        : moment.minuteAdded ?? 0),
      homeRedCards: Number(context.homeRedCards ?? 0),
      awayRedCards: Number(context.awayRedCards ?? 0),
      isKnockout: Boolean(context.isKnockout),
    });
    const delta = probDelta(prePred, liveProb);
    moment.probHomeWin = liveProb.homeWin;
    moment.probDraw = liveProb.draw;
    moment.probAwayWin = liveProb.awayWin;
    moment.deltaHomeWin = delta.deltaHomeWin;
    moment.deltaDraw = delta.deltaDraw;
    moment.deltaAwayWin = delta.deltaAwayWin;
  }
  return moments;
}

function buildGoalPayload(match, goal) {
  const homeName = match.homeName || match.homeTeamFifaCode || 'Home';
  const awayName = match.awayName || match.awayTeamFifaCode || 'Away';
  const homeScore = Number(match.homeScore || 0);
  const awayScore = Number(match.awayScore || 0);
  const minute = Number(goal.minute || match.minute || 0);
  return {
    title: `⚽ GOAL · ${homeName} ${homeScore}–${awayScore} ${awayName}`,
    body: `${minute}′ · ${homeName} vs ${awayName}`,
    matchId: String(match.espnId),
    minute,
    score: { home: homeScore, away: awayScore },
    url: `/#match/${encodeURIComponent(String(match.espnId))}`,
    tag: `goal-${match.espnId}-${minute}-${homeScore}-${awayScore}`,
  };
}

async function updatePressure(matchId, minute, matchState, newMoments, logger) {
  try {
    // Fetch current ESPN boxscore stats
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${matchId}`;
    const data = await fetchJSON(url).catch(() => null);
    const teams = data?.boxscore?.teams;
    if (!teams) return;

    const rawStats = parseEspnStats(teams);
    if (!rawStats) return;

    const prev = getPrevSnapshot(matchId);
    const windowMin = prev ? Math.max(1, minute - prev.minute) : minute;

    const pressure = computePressureIndex(prev, rawStats, windowMin);

    // Write snapshot
    saveStatSnapshot(matchId, minute, rawStats, pressure);
    updateSubstitutionImpacts(matchId, minute);

    // Surge detection: trailing team under sustained high pressure -> generate alert moment
    for (const side of ['home', 'away']) {
      const pi = pressure[side];
      if (pi < 65) continue;

      // Check if trailing
      const isTrailing = side === 'home'
        ? matchState.homeScore < matchState.awayScore
        : matchState.awayScore < matchState.homeScore;

      if (!isTrailing) continue;

      const surge = detectSurge(matchId, side, minute, { matchState });
      if (!surge.surge) continue;

      // Avoid triggering duplicates for the same surge (using structural emitted set)
      const surgeKey = `surge_${side}_${Math.floor(minute / 5) * 5}`;
      const emitted = _structuralEmitted.get(matchId) ?? new Set();
      if (emitted.has(surgeKey)) continue;
      emitted.add(surgeKey);
      _structuralEmitted.set(matchId, emitted);

      // Generate sustained_pressure_alert moment
      const { persistMoments: persist } = require('../services/moment-detector');
      persist([{
        matchId,
        type: 'sustained_pressure_alert',
        minute,
        minuteAdded: 0,
        teamId: side,
        importance: 78,
        source: 'pressure_index',
        scoreState: { home: matchState.homeScore, away: matchState.awayScore },
        raw: {
          pi,
          consecutiveHighPI: surge.consecutiveHighPI,
          sustainedMinutes: surge.sustainedMinutes,
          components: pressure.components[side],
        },
        detectedAt: new Date().toISOString(),
      }]);

      logger.log(`[moment-sync] surge alert: ${matchId} ${side} PI=${pi} min=${minute}`);
    }
  } catch (e) {
    logger.warn(`[moment-sync] pressure update error: ${e.message}`);
  }
}

/**
 * Count red cards for a team from ESPN key events.
 * Handles: direct red (red) and second yellow (yellow after already having one).
 *
 * @param {Array} events - ESPN keyEvents array
 * @param {string|null} teamEspnId - ESPN team ID
 * @returns {number}
 */
function countRedCards(events, teamEspnId) {
  return liveHelpers.countRedCardsFromKeyEvents(events, teamEspnId);
}

function parseAddedTime(displayClock) {
  return liveHelpers.parseAddedTime(displayClock);
}

function getPreMatchPrediction(espnMatchId) {
  // Get earliest pre-match snapshot (true pre-match lambda baseline)
  return db.prepare(`
    SELECT home_win_prob, draw_prob, away_win_prob, home_expected_goals, away_expected_goals
    FROM prediction_snapshots
    WHERE match_id = ?
    ORDER BY created_at ASC LIMIT 1
  `).get(String(espnMatchId)) ?? null;
}

async function getLiveMatches(loggerInstance = null) {
  const log = loggerInstance || loggers.momentSync;
  return await safeExec(async () => {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
    const data = await fetchJSON(url);
    const events = data?.events ?? [];

    return events
      .filter(e => {
        const s = e.status?.type?.state;
        if (s === 'in' || s === 'live') return true;
        if (s === 'post') {
          try {
            const comp = e.competitions?.[0];
            const home = comp?.competitors?.find(c => c.homeAway === 'home');
            const away = comp?.competitors?.find(c => c.homeAway === 'away');
            const homeId = resolveTeamToRatingsId(home?.team?.id || home?.team?.abbreviation);
            const awayId = resolveTeamToRatingsId(away?.team?.id || away?.team?.abbreviation);
            if (!homeId || !awayId) return true;
            const matchDate = (e.date ?? '').slice(0, 10);
            const row = db.prepare(`
              SELECT played FROM matches
              WHERE ((home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?))
                AND (? = '' OR substr(match_date, 1, 10) = ?)
              LIMIT 1
            `).get(homeId, awayId, awayId, homeId, matchDate, matchDate);
            return !row || row.played === 0;
          } catch {
            return true;
          }
        }
        return false;
      })
      .map(e => {
        const comp = e.competitions?.[0];
        const home = comp?.competitors?.find(c => c.homeAway === 'home');
        const away = comp?.competitors?.find(c => c.homeAway === 'away');
        return {
          espnId: e.id,
          homeScore: parseInt(home?.score ?? '0', 10),
          awayScore: parseInt(away?.score ?? '0', 10),
          statusName: e.status?.type?.name ?? '',
          statusState: e.status?.type?.state ?? '',
          displayClock: e.status?.displayClock ?? '',
          minute: parseInt(e.status?.displayClock ?? '0', 10),
          homeEspnId: home?.team?.id ?? null,
          awayEspnId: away?.team?.id ?? null,
          homeName: home?.team?.displayName ?? home?.team?.shortDisplayName ?? home?.team?.abbreviation ?? 'Home',
          awayName: away?.team?.displayName ?? away?.team?.shortDisplayName ?? away?.team?.abbreviation ?? 'Away',
          homeTeamFifaCode: home?.team?.abbreviation ?? null,
          awayTeamFifaCode: away?.team?.abbreviation ?? null,
          matchDate: (e.date ?? '').slice(0, 10),
          stage: deriveStageFromEspnSlug(e.season?.slug),
        };
      });
  }, {
    jobName: 'moment-sync',
    source: 'espn',
    stage: 'fetch_scoreboard',
    reason: 'espn_scoreboard_fetch_failed',
    fallback: []
  }, log) || [];
}

async function tryFifaLive(m, loggerInstance = null) {
  const log = loggerInstance || loggers.momentSync;
  return await safeExec(async () => {
    // Requires FIFA IdStage + IdMatch; lookup from DB cache (stored in match-id-bridge)
    const bridge = db.prepare(
      `SELECT fifa_stage_id, fifa_match_id FROM fifa_match_bridge WHERE espn_id = ? LIMIT 1`
    ).get(String(m.espnId));
    if (!bridge?.fifa_match_id) return null;

    return await fifaApi.fetchLiveMatch(bridge.fifa_stage_id, bridge.fifa_match_id);
  }, {
    jobName: 'moment-sync',
    matchId: m.espnId,
    source: 'fifa',
    stage: 'fetch_fifa_live_api',
    reason: 'fifa_api_fetch_error',
    fallback: null
  }, log);
}

async function tryEspnKeyEvents(espnMatchId, loggerInstance = null) {
  const log = loggerInstance || loggers.momentSync;
  return await safeExec(async () => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnMatchId}`;
    const data = await fetchJSON(url);
    // Return the full summary so callers can read both keyEvents AND the stage
    // (header.season.name) for the KO-4 player-event round derivation.
    return data ?? {};
  }, {
    jobName: 'moment-sync',
    matchId: espnMatchId,
    source: 'espn',
    stage: 'fetch_espn_summary_api',
    reason: 'espn_summary_fetch_error',
    fallback: {}
  }, log);
}

module.exports = {
  createMomentSyncJob,
  selectPushableGoals,
  buildGoalPayload,
  preferEspnGoals,
  injectMomentProbabilities,
};
