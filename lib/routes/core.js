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
const path = require('path');
const fs = require('fs');

// Load match ID bridge + weather data (lazy, one-time)
const { resolveDataPath } = require('../data-resolver');

let _matchBridge = null;
let _weatherData = null;
function getMatchBridge() {
  if (_matchBridge) return _matchBridge;
  try { _matchBridge = JSON.parse(fs.readFileSync(resolveDataPath('match_id_bridge.json'), 'utf8')); } catch {}
  return _matchBridge;
}
function getWeatherData() {
  if (_weatherData) return _weatherData;
  try { _weatherData = JSON.parse(fs.readFileSync(resolveDataPath('weather.json'), 'utf8')); } catch {}
  return _weatherData;
}
function lookupWeather(espnId) {
  const bridge = getMatchBridge();
  const weather = getWeatherData();
  if (!bridge?.bridge || !weather) return null;
  const entry = bridge.bridge[String(espnId)];
  if (!entry?.fifa_match_id) return null;
  const w = weather[String(entry.fifa_match_id)];
  if (!w) return null;
  return { tC: w.tC, feelsC: w.feelsC, pp: w.pp, code: w.code, windKmh: w.windKmh, rh: w.rh };
}

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
      const now = Date.now();
      const daysSinceStart = Math.max(0, Math.floor((now - new Date('2026-06-11T00:00:00+08:00').getTime()) / 86400000));
      const startOffset = -daysSinceStart;
      
      // 构建所有日期的请求参数
      const dates = [];
      for (let i = startOffset; i <= 7; i++) {
        const date = new Date(now + i * 86400000);
        const dateKey = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(/-/g, '');
        dates.push(dateKey);
      }
      
      // 并行请求，单个失败不影响其他
      const results = await Promise.allSettled(
        dates.map(dateKey =>
          espn(`/scoreboard?dates=${dateKey}`, `s_${dateKey}`, 600000)
            .then(data => (data.events || []).map(parseEvent))
        )
      );
      
      const all = [];
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...r.value);
        else console.warn('core route: ESPN scoreboard fetch failed:', r.reason?.message);
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
      const homeStats = teams.find(t => t.homeAway === 'home') || teams.find(t => t.team?.id === home.team?.id) || teams[0];
      const awayStats = teams.find(t => t.homeAway === 'away') || teams.find(t => t.team?.id === away.team?.id) || teams[1];
      const statMap = (team) => new Map((team?.statistics || []).map(stat => [
        stat.name || stat.abbreviation,
        stat.displayValue ?? stat.value ?? null,
      ]));
      const homeStatMap = statMap(homeStats);
      const awayStatMap = statMap(awayStats);
      for (const name of new Set([...homeStatMap.keys(), ...awayStatMap.keys()])) {
        teamStats.push({ name, home: homeStatMap.get(name), away: awayStatMap.get(name) });
      }
      return {
        id: params.id,
        goals,
        teamStats,
        date: competition.date || '',
        state: status.state || '',
        venue: competition.venue?.fullName || '',
        venueId: competition.venue?.id || '',
        weather: competition.weather || d.header?.weather || null,
        home: { id: home.team?.id || '', name: home.team?.displayName || '', score: home.score || '' },
        away: { id: away.team?.id || '', name: away.team?.displayName || '', score: away.score || '' },
        weather: lookupWeather(params.id),
      };
    },

    'GET /api/matches/batch': async (params) => {
      const ids = (params.ids || '').split(',').filter(Boolean).slice(0, 20); // 上限 20 场
      if (!ids.length) return { matches: [], _source: 'ESPN', _count: 0 };
      
      const results = await Promise.allSettled(
        ids.map(id =>
          espn(`/summary?event=${id}`, `m_${id}`, 120000)
            .then(d => {
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
                id,
                goals,
                teamStats,
                date: competition.date || '',
                state: status.state || '',
                venue: competition.venue?.fullName || '',
                venueId: competition.venue?.id || '',
                home: { id: home.team?.id || '', name: home.team?.displayName || '', score: home.score || '' },
                away: { id: away.team?.id || '', name: away.team?.displayName || '', score: away.score || '' },
                weather: lookupWeather(id),
              };
            })
            .catch(() => null)
        )
      );
      
      const matches = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
      
      return { matches, _source: 'ESPN', _count: matches.length };
    },
  };
};
