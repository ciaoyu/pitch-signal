/**
 * Core scoreboard, standings, schedule, and match summary routes.
 */
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
const playerNameZh = require('../player-name-zh');

module.exports = function createCoreRoutes(deps) {
  const { espn, parseEvent, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, getCached, setCache } = deps;

  return {
    'GET /api/scores': async () => {
      const d = await espn('/scoreboard', 'scores', 60000);
      return { matches: (d.events || []).map(parseEvent), fetched: new Date().toISOString(), _dataQuality: 'live', _source: 'ESPN' };
    },

    'GET /api/scores/:date': async (params) => {
      const d = await espn(`/scoreboard?dates=${params.date}`, `s_${params.date}`, 300000);
      return { matches: (d.events || []).map(parseEvent), date: params.date, _dataQuality: 'live', _source: 'ESPN' };
    },

    'GET /api/standings': async () => {
      const cached = getCached?.('standings_computed', 300000);
      if (cached) return cached;

      const d = await espn('/standings', 'standings', 300000);

      const espnMap = {};
      for (const group of (d.children || [])) {
        for (const entry of (group.standings?.entries || [])) {
          const stats = {};
          for (const stat of (entry.stats || [])) stats[stat.name] = stat.displayValue || String(stat.value || '0');
          espnMap[entry.team?.id] = {
            name: entry.team?.displayName || '?',
            abbr: entry.team?.abbreviation || '',
            logo: entry.team?.logos?.[0]?.href || '',
            id: entry.team?.id || '',
            nameI18n: getTeamNameI18n ? getTeamNameI18n(entry.team?.id, entry.team?.displayName || '?') : null,
            played: stats.matchesPlayed || '0',
            wins: stats.wins || '0',
            draws: stats.ties || '0',
            losses: stats.losses || '0',
            gf: stats.pointsFor || '0',
            ga: stats.pointsAgainst || '0',
            gd: stats.pointDifferential || '0',
            pts: stats.points || '0',
          };
        }
      }

      const completedMatches = await getCompletedGroupMatches(espn, parseEvent);
      const computedMap = computeStandingsFromMatches(completedMatches, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);
      const groups = buildGroupsFromStandings(computedMap, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, espnMap);

      const result = {
        groups,
        completedMatches: completedMatches.length,
        _dataQuality: completedMatches.length ? 'computed-live' : 'live',
        _source: completedMatches.length ? 'ESPN scoreboard + computed table' : 'ESPN',
      };
      setCache?.('standings_computed', result);
      return result;
    },

    'GET /api/schedule': async () => {
      const all = [];
      const now = Date.now();
      const daysSinceStart = Math.max(0, Math.floor((now - new Date('2026-06-11T00:00:00+08:00').getTime()) / 86400000));
      const startOffset = -daysSinceStart;
      for (let i = startOffset; i <= 7; i++) {
        const date = new Date(now + i * 86400000);
        const dateKey = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(/-/g, '');
        try {
          const data = await espn(`/scoreboard?dates=${dateKey}`, `s_${dateKey}`, 600000);
          for (const event of (data.events || [])) all.push(parseEvent(event));
        } catch { console.warn('core route: ESPN scoreboard fetch failed for', dateKey); }
      }
      return { matches: all, _dataQuality: 'live', _source: 'ESPN' };
    },

    'GET /api/match/:id': async (params) => {
      const d = await espn(`/summary?event=${params.id}`, `m_${params.id}`, 120000);
      const competition = d.header?.competitions?.[0] || {};
      const status = competition.status?.type || {};
      const competitors = competition.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home') || {};
      const away = competitors.find(c => c.homeAway === 'away') || {};
      const goals = (d.scoringPlays || []).map((goal) => ({
        minute: goal.clock?.displayValue || '',
        team: goal.team?.displayName || '',
        player: goal.athletes?.[0]?.displayName || '',
        type: goal.type?.text || 'Goal',
      }));
      const teamStats = [];
      const teams = d.boxscore?.teams || [];
      if (teams.length === 2) {
        const categories = teams[0].statistics || [];
        for (let i = 0; i < categories.length; i++) {
          teamStats.push({
            name: categories[i].name || categories[i].abbreviation || '',
            home: categories[i].displayValue || '0',
            away: teams[1].statistics?.[i]?.displayValue || '0',
          });
        }
      }
      return {
        id: params.id,
        goals,
        teamStats,
        date: competition.date || '',
        state: status.state || '',
        venue: competition.venue?.fullName || '',
        venueId: competition.venue?.id || '',
        home: { id: home.team?.id || '', name: home.team?.displayName || '', score: home.score || '' },
        away: { id: away.team?.id || '', name: away.team?.displayName || '', score: away.score || '' },
      };
    },

    // === Tournament Stats: Aggregated stats for banner ===
    'GET /api/tournament-stats': async () => {
      const cached = getCached?.('tournament_stats_banner', 300000);
      if (cached) return cached;

      let matchesPlayed = 0;
      let totalGoals = 0;
      let yellowCards = 0;
      let redCards = 0;
      let biggestWinDiff = 0;
      let biggestWinText = '';
      let fastestGoalMin = Infinity;
      let fastestGoalText = '';
      const now = Date.now();

      // Scan past 14 days for completed matches
      for (let i = -14; i <= 0; i++) {
        const date = new Date(now + i * 86400000);
        const dateKey = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(/-/g, '');
        try {
          const data = await espn(`/scoreboard?dates=${dateKey}`, `s_${dateKey}`, 600000);
          for (const event of (data.events || [])) {
            const comp = event.competitions?.[0];
            const state = comp?.status?.type?.state;
            if (state !== 'post') continue;

            matchesPlayed++;
            const competitors = comp?.competitors || [];
            const home = competitors.find(c => c.homeAway === 'home') || {};
            const away = competitors.find(c => c.homeAway === 'away') || {};
            const hs = parseInt(home.score) || 0;
            const as = parseInt(away.score) || 0;
            totalGoals += hs + as;

            // Track biggest win
            const diff = Math.abs(hs - as);
            if (diff > biggestWinDiff) {
              biggestWinDiff = diff;
              const homeName = home.team?.shortDisplayName || home.team?.displayName || '';
              const awayName = away.team?.shortDisplayName || away.team?.displayName || '';
              biggestWinText = `${homeName} ${hs}-${as} ${awayName}`;
            }

            // Fetch summary for cards and fastest goal
            try {
              const summary = await espn(`/summary?event=${event.id}`, `m_${event.id}`, 300000);
              const plays = summary?.scoringPlays || [];
              for (const play of plays) {
                const minute = play.clock?.displayValue || '';
                const minMatch = minute.match(/(\d+)/);
                if (minMatch) {
                  const m = parseInt(minMatch[1]);
                  if (m < fastestGoalMin) {
                    fastestGoalMin = m;
                    const scorer = play.athletes?.[0]?.displayName || '';
                    fastestGoalText = `${m}' ${scorer}`;
                  }
                }
              }
              // Count cards from boxscore
              const boxTeams = summary?.boxscore?.teams || [];
              for (const bt of boxTeams) {
                for (const stat of (bt.statistics || [])) {
                  const n = (stat.name || '').toLowerCase();
                  if (n.includes('yellow') && n.includes('card')) {
                    yellowCards += parseInt(stat.displayValue) || 0;
                  }
                  if (n.includes('red') && n.includes('card')) {
                    redCards += parseInt(stat.displayValue) || 0;
                  }
                }
              }
            } catch { /* skip failed summary */ }
          }
        } catch { /* skip failed scoreboard */ }
      }

      const avgGoals = matchesPlayed > 0 ? (totalGoals / matchesPlayed).toFixed(1) : '0.0';
      const result = {
        matchesPlayed,
        totalGoals,
        avgGoals,
        yellowCards,
        redCards,
        biggestWin: biggestWinText || null,
        fastestGoal: fastestGoalText || null,
        _source: 'ESPN',
        _generatedAt: new Date().toISOString(),
      };
      setCache?.('tournament_stats_banner', result);
      return result;
    },
  };
};
