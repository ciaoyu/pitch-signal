'use strict';

/**
 * Experience section builder (KO-14)
 *
 * Surfaces knockout-stage tournament experience for each team:
 *   - Number of knockout matches completed in this tournament
 *   - Total knockout goals / assists / cards (from player_match_events)
 *   - Whether the team has gone to extra time or penalties
 *
 * Display + bot only (usedInModel: false). Does not touch the prediction
 * engine. Data is computed dynamically from the schedule + player_match_events
 * tables — no static JSON required.
 */

const { db: defaultDb } = require('../db');
const { detectKnockout } = require('../knockoutStage');
const teamResolver = require('../team_resolver');
const { getHistoricalTeamStats } = require('./historical-knockout-stats');

function buildExperienceSection(ctx = {}) {
  try {
    const { matchId, homeTeamId, awayTeamId, homeName, awayName } = ctx;
    if (!homeTeamId && !awayTeamId) return null;

    const db = ctx.db || defaultDb;

    const home = computeTeamExperience(db, homeTeamId, matchId);
    const away = computeTeamExperience(db, awayTeamId, matchId);

    if (home.matchesPlayed === 0 && away.matchesPlayed === 0) return null;

    return {
      confidence: 'medium',
      source: 'world-cup-history+schedule+player-events',
      usedInModel: false,
      home: { name: homeName || null, ...home },
      away: { name: awayName || null, ...away },
      note: {
        zh: '淘汰赛出场与事件统计，仅作展示参考。',
        en: 'Knockout-stage appearances and event stats, display only.',
      },
    };
  } catch (_) {
    return null;
  }
}

function computeTeamExperience(db, teamId, excludeMatchId) {
  if (!teamId) return { matchesPlayed: 0, goals: 0, assists: 0, yellows: 0, reds: 0, wentToEt: false, decidedByPens: false, allTime: null };

  // Count knockout matches from schedule where this team played
  const sched = require('../../data/match_snapshot_schedule.json');
  const koMatches = (sched.matches || []).filter(m => {
    if (m.stage !== 'knockout') return false;
    if (!m.status?.completed) return false;
    const h = String(m.teams?.home?.id || '');
    const a = String(m.teams?.away?.id || '');
    return h === String(teamId) || a === String(teamId);
  });

  const matchesPlayed = koMatches.length;
  const koMatchIds = koMatches.map(m => String(m.matchId));

  // Count events in knockout matches for this team
  let goals = 0, assists = 0, yellows = 0, reds = 0;
  try {
    if (koMatchIds.length) {
    const rows = db.prepare(
      `SELECT event_type, COUNT(*) as c FROM player_match_events
       WHERE team_id = ? AND match_id IN (${koMatchIds.map(() => '?').join(',')})
       GROUP BY event_type`
    ).all(String(teamId), ...koMatchIds);
    for (const r of rows) {
      if (r.event_type === 'goal') goals = r.c;
      else if (r.event_type === 'assist') assists = r.c;
      else if (r.event_type === 'yellow') yellows = r.c;
      else if (r.event_type === 'red' || r.event_type === 'secondyellow') reds += r.c;
    }
    }
  } catch (_) {}

  // Check ET/Pens from matches table
  let wentToEt = false, decidedByPens = false;
  try {
    const ratingsId = teamResolver.getRatingsIdByEspnId(teamId);
    const matchRows = db.prepare(
      `SELECT went_to_et, decided_by_pens FROM matches
       WHERE (home_team_id = ? OR away_team_id = ?) AND played = 1
         AND (went_to_et = 1 OR decided_by_pens = 1)`
    ).all(ratingsId, ratingsId);
    for (const r of matchRows) {
      if (r.went_to_et) wentToEt = true;
      if (r.decided_by_pens) decidedByPens = true;
    }
  } catch (_) {}

  const historical = getHistoricalTeamStats(teamId);
  return {
    matchesPlayed, goals, assists, yellows, reds, wentToEt, decidedByPens,
    allTime: {
      matchesPlayed: historical.matchesPlayed + matchesPlayed,
      goals: historical.goals + goals,
      assists,
      assistsNote: '仅限本届赛事，历史助攻数据不可得',
      wentToEt: historical.wentToEtLowerBound || wentToEt,
      wentToEtConfidence: 'lower_bound',
      decidedByPens: historical.decidedByPens || decidedByPens,
      historicalThroughYear: 2022,
    },
  };
}

module.exports = { buildExperienceSection, computeTeamExperience };
