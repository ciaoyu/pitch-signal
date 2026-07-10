'use strict';

/**
 * KO-13: Leading/Trailing Game State Portrait Section
 *
 * Analyzes each team's resilience when falling behind ("先丢球后追回率") and
 * solidity when taking the lead ("领先后守成率") across completed tournament matches.
 *
 * Source: player_match_events goal timeline.
 * Display & bot metadata only (usedInModel: false).
 */

function round2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Computes leading/trailing game state resilience stats for a team.
 * @param {string|number} teamId
 * @param {object} db
 * @returns {object}
 */
function computeTeamGameStateStats(teamId, db) {
  const tid = String(teamId);
  if (!tid || !db) {
    return {
      matchesAnalyzed: 0,
      tookLeadMatches: 0,
      heldLeadMatches: 0,
      holdRate: null,
      fellBehindMatches: 0,
      recoveredMatches: 0,
      recoveryRate: null,
    };
  }

  try {
    // Find all matches where teamId scored or conceded goals in player_match_events
    const matchRows = db.prepare(`
      SELECT DISTINCT match_id FROM player_match_events
      WHERE event_type = 'goal' AND match_id IN (
        SELECT DISTINCT match_id FROM player_match_events WHERE team_id = ?
      )
    `).all(tid);

    const matchIds = matchRows.map((r) => r.match_id);
    if (!matchIds.length) {
      return {
        matchesAnalyzed: 0,
        tookLeadMatches: 0,
        heldLeadMatches: 0,
        holdRate: null,
        fellBehindMatches: 0,
        recoveredMatches: 0,
        recoveryRate: null,
      };
    }

    let tookLeadMatches = 0;
    let heldLeadMatches = 0;
    let fellBehindMatches = 0;
    let recoveredMatches = 0;
    let matchesAnalyzed = 0;

    for (const matchId of matchIds) {
      const goals = db.prepare(`
        SELECT team_id, minute, minute_added
        FROM player_match_events
        WHERE match_id = ? AND event_type = 'goal'
        ORDER BY minute ASC, minute_added ASC, id ASC
      `).all(matchId);

      if (!goals.length) continue;
      matchesAnalyzed += 1;

      let teamGoals = 0;
      let oppGoals = 0;
      let everTookLead = false;
      let everFellBehind = false;

      for (const g of goals) {
        if (String(g.team_id) === tid) {
          teamGoals += 1;
        } else {
          oppGoals += 1;
        }

        if (teamGoals > oppGoals) {
          everTookLead = true;
        } else if (oppGoals > teamGoals) {
          everFellBehind = true;
        }
      }

      if (everTookLead) {
        tookLeadMatches += 1;
        if (teamGoals > oppGoals) {
          heldLeadMatches += 1;
        }
      }

      if (everFellBehind) {
        fellBehindMatches += 1;
        if (teamGoals >= oppGoals) {
          recoveredMatches += 1;
        }
      }
    }

    return {
      matchesAnalyzed,
      tookLeadMatches,
      heldLeadMatches,
      holdRate: tookLeadMatches > 0 ? round2(heldLeadMatches / tookLeadMatches) : null,
      fellBehindMatches,
      recoveredMatches,
      recoveryRate: fellBehindMatches > 0 ? round2(recoveredMatches / fellBehindMatches) : null,
    };
  } catch (_) {
    return {
      matchesAnalyzed: 0,
      tookLeadMatches: 0,
      heldLeadMatches: 0,
      holdRate: null,
      fellBehindMatches: 0,
      recoveredMatches: 0,
      recoveryRate: null,
    };
  }
}

/**
 * Builds the gameState knockoutIntel section for a fixture.
 * @param {object} ctx - { matchId, homeTeamId, awayTeamId, homeName, awayName, db }
 * @returns {object|null}
 */
function buildGameStateSection(ctx = {}) {
  const { homeId, awayId, homeTeamId, awayTeamId, homeName, awayName, db } = ctx;
  const hId = homeTeamId || homeId;
  const aId = awayTeamId || awayId;
  if (!hId || !aId || !db) return null;

  const home = computeTeamGameStateStats(hId, db);
  const away = computeTeamGameStateStats(aId, db);

  if (home.matchesAnalyzed === 0 && away.matchesAnalyzed === 0) {
    return null;
  }

  const confidence =
    home.matchesAnalyzed >= 2 && away.matchesAnalyzed >= 2 ? 'high' : 'medium';

  return {
    confidence,
    source: 'player_match_events',
    usedInModel: false,
    home: {
      name: homeName || null,
      ...home,
    },
    away: {
      name: awayName || null,
      ...away,
    },
  };
}

module.exports = {
  computeTeamGameStateStats,
  buildGameStateSection,
};
