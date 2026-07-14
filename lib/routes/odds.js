const { createLogger } = require('../logger');
const { getCornerReferenceLine } = require('../corner-model');
const logger = createLogger('odds');
module.exports = function createOddsRoutes(deps) {
  const { espn, fetchJSON, parseEvent, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, COACHES, TEAM_NAMES_ZH, getCached, setCache, routes, rosterCache, teamResolver, RATINGS, PLAYER_RATINGS, TEAM_NAMES } = deps;
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, '..', '..', 'data');
  const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY || '';

  return {
  'GET /api/odds/:matchId': async (params) => {
    const oddsKey = `odds_${params.matchId}`;
    const cornerReference = getCornerReferenceLine(params.matchId);
    const corners = cornerReference
      ? { ...cornerReference, over: null, under: null }
      : { line: null, over: null, under: null, kind: 'unavailable', source: null };
    const withCornerReference = payload => ({ ...payload, corners: { ...corners } });
    const cached = getCached(oddsKey, 300000); // 5 min cache
    if (cached) return withCornerReference(cached);

    // Helper: Generate mock odds from ratings when API key not configured
    function generateMockOdds(homeTeam, awayTeam) {
      try {
        // Use RATINGS.teams (already loaded) for player-level ratings
        const getTeamRating = (name) => {
          const lowerName = (name || '').toLowerCase();
          // Search by team name in RATINGS.teams
          for (const [id, team] of Object.entries(RATINGS.teams || {})) {
            if (team.name && team.name.toLowerCase().includes(lowerName)) {
              // Calculate average player rating
              const players = team.players || [];
              if (players.length > 0) {
                const avg = players.reduce((s, p) => s + (p.rating || 70), 0) / players.length;
                return Math.round(avg);
              }
              return 75;
            }
          }
          // Also check TEAM_NAMES for ID lookup
          for (const [id, tname] of Object.entries(TEAM_NAMES)) {
            if (tname.toLowerCase().includes(lowerName) || lowerName.includes(tname.toLowerCase())) {
              const team = RATINGS.teams?.[id];
              if (team?.players?.length) {
                return Math.round(team.players.reduce((s, p) => s + (p.rating || 70), 0) / team.players.length);
              }
            }
          }
          return 75;
        };
        
        const homeRating = getTeamRating(homeTeam);
        const awayRating = getTeamRating(awayTeam);
        const diff = homeRating - awayRating;
        
        const homeProb = Math.min(0.65, Math.max(0.25, 0.45 + (diff * 0.008)));
        const drawProb = Math.min(0.40, Math.max(0.20, 0.30 - (Math.abs(diff) * 0.004)));
        const awayProb = Math.max(0.15, 1 - homeProb - drawProb);
        const total = homeProb + drawProb + awayProb;
        
        return {
          homeWin: (total / homeProb).toFixed(2),
          draw: (total / drawProb).toFixed(2),
          awayWin: (total / awayProb).toFixed(2),
          overUnder: { line: 2.5, over: 1.90, under: 1.90 },
          corners: { ...corners },
          asianHandicap: { line: diff > 2 ? -0.5 : (diff < -2 ? 0.5 : 0), home: 1.90, away: 1.90 },
          impliedProb: {
            home: ((homeProb/total)*100).toFixed(1) + '%',
            draw: ((drawProb/total)*100).toFixed(1) + '%',
            away: ((awayProb/total)*100).toFixed(1) + '%',
          },
          source: 'estimated',
          _dataQuality: 'estimated',
          _note: '盘口数据基于球队 Elo 评分估算，仅供参考',
          lastUpdated: new Date().toISOString(),
        };
      } catch (e) {
        return null;
      }
    }

    // Try The Odds API if key is configured
    if (ODDS_API_KEY) {
      try {
        // Fetch FIFA World Cup odds
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${encodeURIComponent(ODDS_API_KEY)}&regions=eu&markets=h2h&oddsFormat=decimal`;
        const oddsData = await fetchJSON(oddsUrl);
        
        if (Array.isArray(oddsData)) {
          // Cache the full list for match lookup
          setCache('odds_all', oddsData);
          
          // Build ID lookup
          const oddsById = {};
          for (const game of oddsData) {
            oddsById[game.id] = game;
          }
          setCache('odds_by_id', oddsById);
          
          // Find matching game
          for (const game of oddsData) {
            // Store by composite key
            const gameKey = `${game.home_team}_vs_${game.away_team}`.toLowerCase().replace(/\s+/g, '_');
            setCache(`odds_game_${gameKey}`, game);
          }
        }
      } catch (e) {
        logger.error('Odds API error:', { error: e.message });
      }
    }

    // Try BALLDONTLIE API first (free, real odds)
    const BALLDONTLIE_KEY = process.env.BALLDONTLIE_API_KEY || '';
    if (BALLDONTLIE_KEY) {
      try {
        const BallDontLieAPI = require('../balldontlie');
        const bdl = new BallDontLieAPI(BALLDONTLIE_KEY);
        const matchOdds = await bdl.getMatchOdds(params.matchId);
        if (matchOdds && matchOdds.length) {
          const converted = bdl.convertOdds(matchOdds);
          if (converted) {
            setCache(oddsKey, converted);
            return withCornerReference(converted);
          }
        }
      } catch (e) { /* fall through to mock */ }
    }

    // Fallback: mock generation
    if (!ODDS_API_KEY) {
      try {
        const matchData = await espn(`/summary?event=${params.matchId}`, `m_${params.matchId}`, 120000);
        if (matchData && matchData.header) {
          const comp = matchData.header.competitions?.[0];
          if (comp && comp.competitors) {
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const away = comp.competitors.find(c => c.homeAway === 'away');
            if (home && away) {
              const mockResult = generateMockOdds(
                home.team?.displayName || home.team?.abbreviation,
                away.team?.displayName || away.team?.abbreviation
              );
              if (mockResult) {
                setCache(oddsKey, mockResult);
                return mockResult;
              }
            }
          }
        }
      } catch (e) { /* fall through */ }
    }

    // Return structured odds for this match
    const allOdds = getCached('odds_all', 600000) || [];
    
    // Build lookup by Odds API game ID + team name
    let matched = null;
    const oddsById = getCached('odds_by_id', 600000) || {};
    
    // Try by ID first
    if (oddsById[params.matchId]) {
      matched = oddsById[params.matchId];
    } else {
      // Smart match using TeamResolver
      const search = (params.matchId || '').toLowerCase();
      for (const game of allOdds) {
        const home = (game.home_team || '').toLowerCase();
        const away = (game.away_team || '').toLowerCase();
        
        // 1. Exact match
        if (search === home || search === away) {
          matched = game;
          break;
        }
        
        // 2. Resolver-based match
        const resolvedHome = teamResolver.resolve(game.home_team);
        const resolvedAway = teamResolver.resolve(game.away_team);
        const homeRatingsId = resolvedHome?.ratings_id?.toLowerCase();
        const awayRatingsId = resolvedAway?.ratings_id?.toLowerCase();
        
        if (homeRatingsId && search.includes(homeRatingsId)) {
          matched = game;
          break;
        }
        if (awayRatingsId && search.includes(awayRatingsId)) {
          matched = game;
          break;
        }
        
        // 3. Fallback: last word match
        if (search.includes(home.split(' ').pop()) || search.includes(away.split(' ').pop())) {
          matched = game;
          break;
        }
      }
    }
    
    // Fallback: return first upcoming game
    if (!matched && allOdds.length > 0) {
      matched = allOdds[0];
    }

    if (matched) {
      // If game has started (commence_time in the past), try cached pre-match odds
      const gameTime = new Date(matched.commence_time).getTime();
      if (gameTime < Date.now()) {
        // Game started - return last cached snapshot
        const lastCache = getCached(`odds_pre_${matched.id}`, 86400000); // 24h cache
        if (lastCache) {
          lastCache._note = '⚡ 比赛进行中，以下为赛前最后数据';
          lastCache._frozen = true;
          return lastCache;
        }
      }
      
      // Parse bookmaker odds
      const bookmakers = matched.bookmakers || [];
      const result = {
        homeWin: null, draw: null, awayWin: null,
        overUnder: { line: 2.5, over: null, under: null },
        corners: { ...corners },
        asianHandicap: { line: 0, home: null, away: null },
        history: [],
        source: 'the-odds-api',
        bookmakers: [],
        lastUpdated: new Date().toISOString(),
      };

      // Aggregate from multiple bookmakers
      for (const bm of bookmakers) {
        const bmName = bm.title || bm.key || '?';
        result.bookmakers.push(bmName);
      
      // Track Pinnacle vs Bet365 divergence
      if (bm.key === 'pinnacle' || bm.title?.toLowerCase().includes('pinnacle')) {
        result._pinnacle = {};
        for (const m of (bm.markets||[])) {
          if (m.key === 'h2h') for (const o of (m.outcomes||[])) {
            if (o.name === matched.home_team) result._pinnacle.home = o.price;
            else if (o.name === 'Draw') result._pinnacle.draw = o.price;
            else result._pinnacle.away = o.price;
          }
        }
      }
      if (bm.key === 'bet365' || bm.title?.toLowerCase().includes('bet365')) {
        result._bet365 = {};
        for (const m of (bm.markets||[])) {
          if (m.key === 'h2h') for (const o of (m.outcomes||[])) {
            if (o.name === matched.home_team) result._bet365.home = o.price;
            else if (o.name === 'Draw') result._bet365.draw = o.price;
            else result._bet365.away = o.price;
          }
        }
      }

        for (const market of (bm.markets || [])) {
          if (market.key === 'h2h') {
            // Home/Draw/Away
            const outcomes = market.outcomes || [];
            for (const o of outcomes) {
              if (o.name === matched.home_team) result.homeWin = o.price;
              else if (o.name === 'Draw') result.draw = o.price;
              else result.awayWin = o.price;
            }
          }
          if (market.key === 'totals') {
            // Over/Under
            const outcomes = market.outcomes || [];
            for (const o of outcomes) {
              if (o.name === 'Over') result.overUnder.over = o.price;
              if (o.name === 'Under') result.overUnder.under = o.price;
              if (o.point) result.overUnder.line = o.point;
            }
          }
          if (market.key === 'spreads') {
            // Asian Handicap
            const outcomes = market.outcomes || [];
            for (const o of outcomes) {
              if (o.name === matched.home_team) {
                result.asianHandicap.home = o.price;
                result.asianHandicap.line = o.point;
              } else {
                result.asianHandicap.away = o.price;
              }
            }
          }
        }
      }

      // Calculate implied probabilities
      if (result.homeWin && result.draw && result.awayWin) {
        const total = 1/result.homeWin + 1/result.draw + 1/result.awayWin;
        result.impliedProb = {
          home: ((1/result.homeWin/total)*100).toFixed(1) + '%',
          draw: ((1/result.draw/total)*100).toFixed(1) + '%',
          away: ((1/result.awayWin/total)*100).toFixed(1) + '%',
          vig: ((total - 1)*100).toFixed(1) + '%', // overround
        };
      }
      
      // Market divergence alert
      if (result._pinnacle && result._bet365) {
        const diff = Math.abs(result._pinnacle.home - result._bet365.home) / result._pinnacle.home * 100;
        result.marketDivergence = {
          homeDiff: diff.toFixed(1) + '%',
          alert: diff > 5,
          direction: result._bet365.home < result._pinnacle.home ? 'Bet365偏主胜' : 'Bet365偏客胜',
        };
      }
      
      setCache(oddsKey, result);
      
      // Also cache as pre-match snapshot (for post-kickoff fallback)
      setCache(`odds_pre_${matched.id}`, result);
      
      return result;
    }

    // Fallback: Try to generate mock odds from ratings
    // First try to get match info for team names
    try {
      const matchData = await espn(`/summary?event=${params.matchId}`, `m_${params.matchId}`, 120000);
      if (matchData && matchData.header) {
        const comp = matchData.header.competitions?.[0];
        if (comp && comp.competitors) {
          const home = comp.competitors.find(c => c.homeAway === 'home');
          const away = comp.competitors.find(c => c.homeAway === 'away');
          if (home && away) {
            const mockResult = generateMockOdds(
              home.team?.displayName || home.team?.abbreviation,
              away.team?.displayName || away.team?.abbreviation
            );
            if (mockResult) {
              setCache(oddsKey, mockResult);
              return mockResult;
            }
          }
        }
      }
    } catch (e) {
      // Fall through to empty fallback
    }

    // Final fallback: empty structure
    const fallback = {
      homeWin: null, draw: null, awayWin: null,
      overUnder: { line: 2.5, over: null, under: null },
      corners: { ...corners },
      asianHandicap: { line: 0, home: null, away: null },
      history: [],
      source: ODDS_API_KEY ? 'no_match_found' : 'api_key_not_configured',
    };
    setCache(oddsKey, fallback);
    return fallback;
  },

  // === Odds History (change detection) ===
  'GET /api/odds-history/:matchId': async (params) => {
    // Return stored odds snapshots for trend analysis
    const histFile = path.join(DATA_DIR, `odds_${params.matchId}.json`);
    try {
      const data = JSON.parse(fs.readFileSync(histFile, 'utf8'));
      return data;
    } catch {
      return { matchId: params.matchId, snapshots: [], note: 'No history yet' };
    }
  },

  // === Odds Alert Engine ===
  'GET /api/odds-alerts': async (req) => {
    // Detect significant odds movements (>5% change)
    const alerts = [];
    const allOdds = getCached('odds_all', 600000) || [];
    
    for (const game of allOdds) {
      const h2h = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h');
      if (!h2h) continue;
      
      const outcomes = h2h.outcomes || [];
      const home = outcomes.find(o => o.name === game.home_team);
      const draw = outcomes.find(o => o.name === 'Draw');
      const away = outcomes.find(o => o.name !== game.home_team && o.name !== 'Draw');
      
      // Check if odds are "sharp" (Pinnacle) vs "soft" (Bet365)
      // Significant divergence = potential value
      const pinnacle = game.bookmakers?.find(b => b.key === 'pinnacle');
      const bet365 = game.bookmakers?.find(b => b.key === 'bet365');
      
      if (pinnacle && bet365) {
        const pHome = pinnacle.markets?.find(m => m.key === 'h2h')?.outcomes?.find(o => o.name === game.home_team)?.price;
        const bHome = bet365.markets?.find(m => m.key === 'h2h')?.outcomes?.find(o => o.name === game.home_team)?.price;
        
        if (pHome && bHome) {
          const diff = Math.abs(pHome - bHome) / pHome * 100;
          if (diff > 5) {
            alerts.push({
              match: `${game.home_team} vs ${game.away_team}`,
              type: 'odds_divergence',
              message: `Pinnacle ${pHome} vs Bet365 ${bHome} (${diff.toFixed(1)}% 差异)`,
              direction: bHome < pHome ? 'Bet365偏主胜' : 'Bet365偏客胜',
            });
          }
        }
      }
    }
    return { alerts, checkedAt: new Date().toISOString() };
  },

  // === Computed Standings (pure Python-style, from ESPN scoreboard) ===
  'GET /api/odds-alerts-enhanced': async () => {
    const allOdds = getCached('odds_all', 600000) || [];
    const alerts = [];

    for (const game of allOdds) {
      const bookmakers = game.bookmakers || [];
      if (bookmakers.length < 2) continue;

      // Find Pinnacle and Bet365
      const pinnacle = bookmakers.find(b => b.key === 'pinnacle' || b.title?.toLowerCase().includes('pinnacle'));
      const bet365 = bookmakers.find(b => b.key === 'bet365' || b.title?.toLowerCase().includes('bet365'));

      // Get H2H odds
      const getH2H = (bm) => {
        const h2h = bm?.markets?.find(m => m.key === 'h2h');
        const outcomes = h2h?.outcomes || [];
        return {
          home: outcomes.find(o => o.name === game.home_team)?.price,
          draw: outcomes.find(o => o.name === 'Draw')?.price,
          away: outcomes.find(o => o.name !== game.home_team && o.name !== 'Draw')?.price,
        };
      };

      const pOdds = getH2H(pinnacle);
      const bOdds = getH2H(bet365);

      // Market divergence
      if (pOdds.home && bOdds.home) {
        const homeDiff = Math.abs(pOdds.home - bOdds.home) / pOdds.home * 100;
        const awayDiff = Math.abs(pOdds.away - bOdds.away) / (pOdds.away || 1) * 100;

        if (homeDiff > 5) {
          alerts.push({
            match: `${game.home_team} vs ${game.away_team}`,
            type: 'market_divergence',
            severity: homeDiff > 10 ? 'high' : 'medium',
            message: `Pinnacle ${pOdds.home} vs Bet365 ${bOdds.home} (${homeDiff.toFixed(1)}% 差异)`,
            direction: bOdds.home < pOdds.home ? 'Bet365偏主胜' : 'Bet365偏客胜',
            detail: { pHome: pOdds.home, bHome: bOdds.home, diff: homeDiff.toFixed(1) + '%' },
          });
        }
        if (awayDiff > 5) {
          alerts.push({
            match: `${game.home_team} vs ${game.away_team}`,
            type: 'market_divergence',
            severity: awayDiff > 10 ? 'high' : 'medium',
            message: `客胜赔率分歧: Pinnacle ${pOdds.away} vs Bet365 ${bOdds.away}`,
            direction: bOdds.away < pOdds.away ? 'Bet365偏客胜' : 'Bet365偏主胜',
          });
        }
      }

      // Implied probability analysis
      const h2h = bookmakers[0]?.markets?.find(m => m.key === 'h2h');
      if (h2h) {
        const outcomes = h2h.outcomes || [];
        const home = outcomes.find(o => o.name === game.home_team);
        const draw = outcomes.find(o => o.name === 'Draw');
        const away = outcomes.find(o => o.name !== game.home_team && o.name !== 'Draw');

        if (home && draw && away) {
          const total = 1/home.price + 1/draw.price + 1/away.price;
          const homeProb = (1/home.price/total * 100);
          const awayProb = (1/away.price/total * 100);

          // Heavy favorite alert
          if (homeProb > 70) {
            alerts.push({
              match: `${game.home_team} vs ${game.away_team}`,
              type: 'heavy_favorite',
              severity: 'low',
              message: `${game.home_team} 大热 (${homeProb.toFixed(0)}% 隐含概率)`,
              direction: '主队大热',
            });
          } else if (awayProb > 70) {
            alerts.push({
              match: `${game.home_team} vs ${game.away_team}`,
              type: 'heavy_favorite',
              severity: 'low',
              message: `${game.away_team} 大热 (${awayProb.toFixed(0)}% 隐含概率)`,
              direction: '客队大热',
            });
          }

          // Close match (potential upset)
          if (Math.abs(homeProb - awayProb) < 10 && homeProb > 40) {
            alerts.push({
              match: `${game.home_team} vs ${game.away_team}`,
              type: 'close_match',
              severity: 'medium',
              message: `势均力敌: 主${homeProb.toFixed(0)}% vs 客${awayProb.toFixed(0)}%`,
              direction: '胜负难料',
            });
          }
        }
      }
    }

    return {
      alerts,
      total: alerts.length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      checkedAt: new Date().toISOString(),
    };
  },

  // === Spatial Matchup (22 players on same field) ===
  };
};
