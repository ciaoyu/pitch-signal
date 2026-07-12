const { createLogger } = require('../logger');
const logger = createLogger('recent');
// Recent matches & stats routes — extracted from server.js (2026-06-26)
module.exports = function createRecentRoutes(deps) {
  const { getCached, setCache, espn, loader, parseEvent, getTeamNameI18n } = deps;

  // Shared helpers — used by both routes
  const nowMs = () => Date.now();
  const isPast = m => new Date(m.kickoffUtc).getTime() + 2 * 3600 * 1000 < nowMs();
  const toESPNDateKey = utcStr =>
    new Date(utcStr).toLocaleDateString('sv-SE', { timeZone: 'America/New_York' }).replace(/-/g, '');

  return {
    'GET /api/team/:id/recent-matches': async (params) => {
      const teamId = String(params.id);
      const cacheKey = `team_recent_${teamId}`;
      const cached = getCached(cacheKey, 1800000);
      if (cached) return cached;

      try {
        // The immutable snapshot is useful for pre-match jobs, but it does not
        // gain newly-resolved knockout fixtures. Use ESPN's tournament-range
        // scoreboard here so World Cup records do not silently stop at R32.
        const schedule = loader.getSchedule();
        const staticById = new Map((schedule.matches || []).map(m => [String(m.matchId), m]));
        const espnByMatchId = {};
        try {
          const data = await espn('/scoreboard?dates=20260611-20260719&limit=500', 'wc2026_full_schedule', 600000);
          for (const ev of (data.events || [])) {
            const parsed = parseEvent(ev);
            espnByMatchId[String(parsed.id)] = parsed;
            staticById.set(String(parsed.id), {
              ...(staticById.get(String(parsed.id)) || {}),
              matchId: parsed.id,
              kickoffUtc: parsed.date,
              kickoffBjt: parsed.dateBJT,
              teams: {
                home: { id: parsed.home?.id, name: parsed.home?.name, abbreviation: parsed.home?.abbr },
                away: { id: parsed.away?.id, name: parsed.away?.name, abbreviation: parsed.away?.abbr },
              },
              status: { state: parsed.state, completed: parsed.state === 'post' },
              stage: parsed.stage === 'Group Stage' ? 'group' : (parsed.stage || 'knockout'),
              venue: parsed.venue || '',
            });
          }
        } catch (e) {
          logger.warn('Live tournament schedule fetch failed; using snapshot index:', { error: e.message });
        }

        const teamSchedule = [...staticById.values()]
          .filter(m => String(m.teams?.home?.id) === teamId || String(m.teams?.away?.id) === teamId)
          .sort((a, b) => new Date(b.kickoffUtc) - new Date(a.kickoffUtc));

        const matches = teamSchedule.map(m => {
          const isHome = String(m.teams?.home?.id) === teamId;
          const past = isPast(m);
          const state = m.status?.state === 'in' ? 'in' : past ? 'post' : 'pre';
          const espnMatch = espnByMatchId[String(m.matchId)];

          const homeScore = espnMatch?.home?.score ?? '-';
          const awayScore = espnMatch?.away?.score ?? '-';
          const myScore  = parseInt(isHome ? homeScore : awayScore, 10);
          const oppScore = parseInt(isHome ? awayScore : homeScore, 10);
          const result = (state === 'post' && !isNaN(myScore) && !isNaN(oppScore))
            ? (myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D')
            : null;

          const opponent = isHome ? m.teams?.away : m.teams?.home;
          const opponentId = opponent?.id ? String(opponent.id) : '';
          const opponentNameI18n = opponentId && getTeamNameI18n ? getTeamNameI18n(opponentId, opponent.name || '') : null;

          return {
            matchId: m.matchId,
            date: m.kickoffUtc,
            dateBJT: m.kickoffBjt,
            homeTeam: m.teams?.home,
            awayTeam: m.teams?.away,
            isHome,
            opponent,
            opponentNameI18n,
            state,
            score: { home: homeScore, away: awayScore },
            result,
            stage: m.stage,
            venue: m.venue || '',
          };
        });

        const result = {
          teamId,
          matches,
          total: matches.length,
          completed: matches.filter(m => m.state === 'post').length,
          source: 'match_snapshot_schedule + ESPN',
          label: '本届世界杯赛程',
          lastUpdated: new Date().toISOString(),
        };
        setCache(cacheKey, result);
        return result;
      } catch (e) {
        logger.warn(`⚠️ Recent matches fetch failed for team ${teamId}:`, { error: e.message || e });
        return { teamId, matches: [], error: 'Fetch failed' };
      }
    },

    // Recent-match aggregated stats for pre-match display
    'GET /api/team/:id/recent-stats': async (params) => {
      const teamId = String(params.id);
      const hasExplicitWindow = params.n !== undefined && params.n !== null && String(params.n).trim() !== '';
      // With no explicit ?n= window, show this tournament's complete record.
      // A World Cup finalist plays at most eight matches, so ten is a safe cap.
      const sampleSize = hasExplicitWindow
        ? Math.min(Math.max(parseInt(params.n, 10) || 5, 2), 10)
        : 10;

      try {
        const schedule = loader.getSchedule();
        // Knockout pairings are resolved after the immutable schedule snapshot
        // is built. Merge ESPN's live tournament schedule so advancing teams do
        // not remain stuck on their pre-knockout sample forever.
        const scheduleById = new Map((schedule.matches || []).map(m => [String(m.matchId), m]));
        try {
          const data = await espn('/scoreboard?dates=20260611-20260719&limit=500', 'wc2026_full_schedule', 600000);
          for (const ev of (data.events || [])) {
            const parsed = parseEvent(ev);
            scheduleById.set(String(parsed.id), {
              ...(scheduleById.get(String(parsed.id)) || {}),
              matchId: parsed.id,
              kickoffUtc: parsed.date,
              kickoffBjt: parsed.dateBJT,
              teams: {
                home: { id: parsed.home?.id, name: parsed.home?.name, abbreviation: parsed.home?.abbr },
                away: { id: parsed.away?.id, name: parsed.away?.name, abbreviation: parsed.away?.abbr },
              },
              status: { state: parsed.state, completed: parsed.state === 'post' },
              stage: parsed.stage === 'Group Stage' ? 'group' : (parsed.stage || 'knockout'),
              venue: parsed.venue || '',
            });
          }
        } catch (e) {
          logger.warn('Recent-stats live tournament schedule fetch failed; using snapshot index:', { error: e.message });
        }

        const teamSchedule = [...scheduleById.values()]
          .filter(m => String(m.teams?.home?.id) === teamId || String(m.teams?.away?.id) === teamId)
          .sort((a, b) => new Date(b.kickoffUtc) - new Date(a.kickoffUtc));

        const isCompleted = m => m.status?.completed === true
          || m.status?.state === 'post'
          || (!['pre', 'in'].includes(m.status?.state) && isPast(m));
        const pastMatches = teamSchedule.filter(isCompleted).slice(0, sampleSize);

        // Cache by the completed-match set. When a team advances and finishes a
        // new fixture, the key changes automatically instead of serving the old
        // five-match result for another 30 minutes.
        const completedSignature = pastMatches.map(m => String(m.matchId)).sort().join('_') || 'none';
        const cacheKey = `team_recent_stats_${teamId}_${hasExplicitWindow ? sampleSize : 'tournament'}_${completedSignature}`;
        const cached = getCached(cacheKey, 1800000);
        if (cached) return cached;

        if (pastMatches.length === 0) {
          return { teamId, sampleSize, window: hasExplicitWindow ? 'recent' : 'tournament', matches: 0, matchIds: [], stats: null, source: 'no-completed-matches', note: '无已完赛记录' };
        }

        const espnDates = [...new Set(pastMatches.map(m => toESPNDateKey(m.kickoffUtc)))];

        // Collect boxscore stats for each match
        const espnByMatchId = {};
        for (const dateKey of espnDates) {
          try {
            const data = await espn(`/scoreboard?dates=${dateKey}`, `s_${dateKey}`, 600000);
            for (const ev of (data.events || [])) {
              let teamStats = null;
              try {
                const summary = await espn(`/summary?event=${ev.id}`, `sum_${ev.id}`, 120000);
                const teams = (summary?.boxscore?.teams || []);
                if (teams.length === 2) {
                  const categories = teams[0].statistics || [];
                  teamStats = [];
                  for (let i = 0; i < categories.length; i++) {
                    teamStats.push({
                      name: categories[i].name || categories[i].abbreviation || '',
                      home: categories[i].displayValue || '0',
                      away: teams[1].statistics?.[i]?.displayValue || '0',
                    });
                  }
                }
              } catch { /* boxscore unavailable */ }
              espnByMatchId[String(ev.id)] = { teamStats };
            }
          } catch (e) { logger.warn('Recent-stats scoreboard fetch failed:', { error: e.message }); }
        }

        const matchStatsList = [];
        for (const m of pastMatches) {
          const entry = espnByMatchId[String(m.matchId)];
          if (!entry || !entry.teamStats) continue;
          const isHome = String(m.teams?.home?.id) === teamId;
          const side = isHome ? 'home' : 'away';
          const statRow = {};
          for (const s of entry.teamStats) {
            const raw = s[side] || '0';
            const numMatch = String(raw).match(/(\d+(?:\.\d+)?)/);
            statRow[s.name] = numMatch ? Number(numMatch[1]) : 0;
          }
          statRow._matchId = m.matchId;
          statRow._date = m.kickoffUtc;
          matchStatsList.push(statRow);
        }

        if (matchStatsList.length === 0) {
          return { teamId, sampleSize, window: hasExplicitWindow ? 'recent' : 'tournament', matches: pastMatches.length, matchIds: pastMatches.map(m => String(m.matchId)), stats: null, source: 'no-boxscore-available', note: '已赛无boxscore数据' };
        }

        const aggregated = {};
        const allKeys = new Set();
        for (const row of matchStatsList) {
          for (const key of Object.keys(row)) { if (!key.startsWith('_')) allKeys.add(key); }
        }
        for (const key of allKeys) {
          const values = matchStatsList.map(r => r[key] ?? null).filter(v => v !== null && !isNaN(v));
          if (values.length > 0) {
            aggregated[key] = {
              avg: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
              count: values.length,
            };
          }
        }

        const result = {
          teamId,
          sampleSize,
          window: hasExplicitWindow ? 'recent' : 'tournament',
          matches: matchStatsList.length,
          matchIds: matchStatsList.map(row => String(row._matchId)),
          stats: aggregated,
          source: hasExplicitWindow ? 'ESPN boxscore recent avg' : 'ESPN boxscore tournament avg',
          lastUpdated: new Date().toISOString(),
        };
        setCache(cacheKey, result);
        return result;
      } catch (e) {
        logger.warn(`⚠️ Recent stats fetch failed for team ${teamId}:`, { error: e.message || e });
        return { teamId, sampleSize, matches: 0, stats: null, error: 'Fetch failed' };
      }
    },
  };
};
