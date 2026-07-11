#!/usr/bin/env node
'use strict';

/**
 * Repair a completed match's persisted live-probability curve from ESPN's
 * immutable key-event timeline. This is deliberately an explicit operator
 * command, never a read-path side effect.
 *
 * Usage: node scripts/repair-live-probability-curve.js 760511
 */
const { db } = require('../lib/db');
const { fetchJSON } = require('../services/espn');
const { detectFromEspn, persistMoments } = require('../lib/services/moment-detector');
const { injectMomentProbabilities } = require('../lib/jobs/moment-sync');

function getPreMatchPrediction(matchId) {
  return db.prepare(`
    SELECT home_expected_goals, away_expected_goals, home_win_prob, draw_prob, away_win_prob
    FROM prediction_snapshots WHERE match_id = ? ORDER BY created_at ASC LIMIT 1
  `).get(String(matchId));
}

async function repair(matchId) {
  const id = String(matchId || '');
  if (!id) throw new Error('Usage: node scripts/repair-live-probability-curve.js <ESPN matchId>');
  const preMatch = getPreMatchPrediction(id);
  if (!preMatch) throw new Error(`No immutable pre-match snapshot for ${id}; refusing retrospective curve repair`);

  const summary = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${encodeURIComponent(id)}`);
  const events = summary?.keyEvents || [];
  const competition = summary?.header?.competitions?.[0];
  const home = competition?.competitors?.find(c => c.homeAway === 'home');
  const away = competition?.competitors?.find(c => c.homeAway === 'away');
  const isKnockout = !/group/i.test(summary?.header?.season?.slug || '');
  const goals = detectFromEspn(id, events, {
    homeScore: Number(home?.score || 0), awayScore: Number(away?.score || 0),
  }).filter(moment => moment.type === 'goal');
  if (!goals.length) throw new Error(`No ESPN goal events found for ${id}; refusing to alter curve`);

  injectMomentProbabilities(goals, preMatch, { isKnockout });
  const update = db.prepare(`
    UPDATE match_moments SET score_state_json = ?, raw_json = ?,
      prob_home_win = ?, prob_draw = ?, prob_away_win = ?,
      delta_home_win = ?, delta_draw = ?, delta_away_win = ?, detected_at = ?
    WHERE match_id = ? AND type = 'goal' AND minute = ? AND minute_added = ?
  `);
  let updated = 0;
  const missing = [];
  const repairedAt = new Date().toISOString();
  const transaction = db.transaction(() => {
    for (const goal of goals) {
      goal.detectedAt = repairedAt;
      goal.raw = { ...goal.raw, curveRepair: { source: 'espn_key_events', repairedAt, reason: 'post_goal_score_snapshot' } };
      const result = update.run(
        JSON.stringify(goal.scoreState), JSON.stringify(goal.raw),
        goal.probHomeWin, goal.probDraw, goal.probAwayWin,
        goal.deltaHomeWin, goal.deltaDraw, goal.deltaAwayWin, repairedAt,
        id, goal.minute, goal.minuteAdded || 0,
      );
      if (result.changes) updated += result.changes;
      else missing.push(goal);
    }
    if (missing.length) persistMoments(missing);
  });
  transaction();
  return { matchId: id, detectedGoals: goals.length, updated, inserted: missing.length, repairedAt, goals: goals.map(g => ({ minute: g.minute, score: g.scoreState, homeWin: g.probHomeWin, draw: g.probDraw, awayWin: g.probAwayWin })) };
}

if (require.main === module) {
  repair(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { repair };
