const {
  WC_GROUPS,
  TEAM_TO_GROUP,
  emptyStanding,
  normalizeStandingRow,
  applyResult,
  getCompletedGroupMatches,
  computeStandingsFromMatches,
  buildGroupsFromStandings,
} = require('../standings-helper');

module.exports = function createStandingsRoutes(deps) {
  const { espn, fetchJSON, parseEvent, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, COACHES, TEAM_NAMES_ZH, getCached, setCache, routes, rosterCache, PLAYER_RATINGS, RATINGS, TEAM_NAMES, getPlayerRatingData, assignLineupCoords, matchupAPI, matchupSpatial, TEAM_FLAGS } = deps;
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, '..', '..', 'data');
  const ODDS_API_KEY = process.env.ODDS_API_KEY || '';

  return {
  'GET /api/standings-computed': async () => {
    const completedMatches = await getCompletedGroupMatches(espn, parseEvent);
    const computedMap = computeStandingsFromMatches(completedMatches, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);
    const groups = buildGroupsFromStandings(computedMap, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);

    return { groups, completedMatches: completedMatches.length, _note: '纯积分榜｜从已赛结果计算', _source: 'ESPN scoreboard' };
  },
  
  // === Head-to-Head (from ESPN match summary) ===
  'GET /api/standings-qualified': async () => {
    // Try ESPN standings first
    const d = await espn('/standings', 'standings', 300000);
    
    // If ESPN returns valid groups, use it
    if (d && d.children && d.children.length > 0) {
      const groups = d.children.map(g => {
        const standings = (g.standings?.entries || []).map(e => {
          const s = {};
          for (const st of (e.stats || [])) s[st.name] = st.displayValue || String(st.value || '0');
          return {
            name: e.team?.displayName || '?', abbr: e.team?.abbreviation || '',
            logo: e.team?.logos?.[0]?.href || '', id: e.team?.id || '',
            played: s.matchesPlayed || '0', wins: s.wins || '0', draws: s.ties || '0',
            losses: s.losses || '0', gf: s.pointsFor || '0', ga: s.pointsAgainst || '0',
            gd: s.pointDifferential || '0', pts: s.points || '0',
          };
        });

        // Determine qualification status
        standings.forEach((t, i) => {
          const pts = parseInt(t.pts) || 0;
          const played = parseInt(t.played) || 0;
          if (played === 0) t.status = 'pending';
          else if (i === 0 && pts >= 6) t.status = 'qualified';
          else if (i === 1 && pts >= 4) t.status = 'qualified';
          else if (i <= 1 && played >= 2) t.status = 'contending';
          else t.status = 'eliminated';
        });

        return { name: g.name, standings };
      });
      return { groups };
    }

    // Fallback: Calculate standings from match results using shared helper
    try {
      const completedMatches = await getCompletedGroupMatches(espn, parseEvent);
      const computedMap = computeStandingsFromMatches(completedMatches, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);
      const groups = buildGroupsFromStandings(computedMap, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);

      // Assign qualification status
      for (const group of groups) {
        group.standings.forEach((t, i) => {
          if (t.played === 0) t.status = 'pending';
          else if (i === 0) t.status = 'qualified';
          else if (i === 1) t.status = 'qualified';
          else if (i === 2 && t.pts >= 4) t.status = 'contending';
          else t.status = 'eliminated';
        });
      }

      return { groups };
    } catch (e) {
      return { error: 'Failed to calculate standings', groups: [] };
    }
  },

  // === Venue + Weather ===
  };
};
