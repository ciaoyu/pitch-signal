'use strict';

/**
 * Star Form Service (KO-11)
 *
 * Computes recent form for key players based on player_match_events table.
 * Evaluates last 3 matches goals+assists (last3GA) vs group stage baseline GA per match.
 * Outputs: trend ('up' | 'normal' | 'down') and structured section for knockout intelligence card.
 * Does NOT modify quantitative win probability (display + bot context only).
 */
const { db } = require('../db');
const playerNameZh = require('../player-name-zh');

function tableExists(tableName) {
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
    return Boolean(row);
  } catch (_) {
    return false;
  }
}

function computeTeamStarForm(teamId) {
  if (!teamId) return [];
  if (!tableExists('player_match_events')) return [];

  try {
    const target = String(teamId);
    const rows = db.prepare(`
      SELECT player_name, event_type, match_id, stage
      FROM player_match_events
      WHERE team_id = ?
      ORDER BY id DESC
    `).all(target);

    if (!rows || rows.length === 0) return [];

    // Find distinct recent match_ids (up to 3 most recent matches)
    const distinctMatches = [];
    for (const r of rows) {
      const mid = String(r.match_id || '');
      if (mid && !distinctMatches.includes(mid)) {
        distinctMatches.push(mid);
      }
    }

    const recentMatchIds = new Set(distinctMatches.slice(0, 3));
    const playerStats = {};

    for (const r of rows) {
      if (!r.player_name) continue;
      const name = r.player_name.trim();
      if (!playerStats[name]) {
        playerStats[name] = {
          player: name,
          recentGA: 0,
          recentMatches: new Set(),
          baselineGA: 0,
          baselineMatches: new Set(),
          totalGA: 0,
          totalMatches: new Set()
        };
      }

      const mid = String(r.match_id || '');
      playerStats[name].totalMatches.add(mid);

      const evt = String(r.event_type || '').toLowerCase();
      const isGA = (evt === 'goal' || evt === 'assist');

      if (recentMatchIds.has(mid)) {
        playerStats[name].recentMatches.add(mid);
        if (isGA) playerStats[name].recentGA += 1;
      } else {
        playerStats[name].baselineMatches.add(mid);
        if (isGA) playerStats[name].baselineGA += 1;
      }

      if (isGA) playerStats[name].totalGA += 1;
    }

    const result = [];
    for (const stat of Object.values(playerStats)) {
      if (stat.totalGA === 0) continue;

      const last3GA = stat.recentGA;
      const baselineMatchCount = stat.baselineMatches.size;
      const baselineGAperMatch = baselineMatchCount > 0
        ? Number((stat.baselineGA / baselineMatchCount).toFixed(2))
        : Number((stat.totalGA / Math.max(1, stat.totalMatches.size)).toFixed(2));

      let trend = 'normal';
      if (last3GA >= 2 || (last3GA > baselineGAperMatch * Math.max(1, stat.recentMatches.size) && last3GA > 0)) {
        trend = 'up';
      } else if (last3GA === 0 && stat.totalMatches.size >= 3) {
        trend = 'down';
      }

      const zh = playerNameZh.lookup(stat.player);

      result.push({
        player: stat.player,
        playerZh: zh || null,
        last3GA,
        baselineGAperMatch,
        trend,
      });
    }

    result.sort((a, b) => b.last3GA - a.last3GA);
    return result.slice(0, 3);
  } catch (_) {
    return [];
  }
}

/**
 * Builds starForm section for knockoutIntel
 */
function buildStarFormSection(ctx = {}) {
  try {
    const homeTeamId = ctx.homeTeamId || ctx.homeId;
    const awayTeamId = ctx.awayTeamId || ctx.awayId;

    const home = computeTeamStarForm(homeTeamId);
    const away = computeTeamStarForm(awayTeamId);

    if (home.length === 0 && away.length === 0) {
      return null;
    }

    return {
      confidence: 'medium',
      source: 'player-match-events',
      usedInModel: false,
      home,
      away,
    };
  } catch (_) {
    return null;
  }
}

module.exports = {
  computeTeamStarForm,
  buildStarFormSection,
};
