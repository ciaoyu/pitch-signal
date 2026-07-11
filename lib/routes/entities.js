/**
 * Player / Team / Coach related routes
 */
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const teamResolver = require('../team_resolver');
const playerNameZh = require('../player-name-zh');
const playerResolver = require('../player-id-resolver');
const { buildClubStats, buildRecentForm: buildPlayerRecentForm } = require('../services/player-stat-integrity');
const { getWorldCupPlayerStats, getOfficialTournamentScorers } = require('../services/worldcup-player-stats');
const NATIONAL_STATS_BY_NAME = (() => { try { return require('../../data/national_stats_by_name.json'); } catch { return {}; } })();

// Module-level cache: team_meta.json (with TTL)
let _teamMetaCache = null;
let _teamMetaTimestamp = 0;
const TEAM_META_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getTeamMetaAsync() {
  const now = Date.now();
  if (_teamMetaCache && (now - _teamMetaTimestamp) < TEAM_META_TTL_MS) {
    return _teamMetaCache;
  }
  try {
    const filePath = path.join(process.cwd(), 'data', 'team_meta.json');
    const data = await fsPromises.readFile(filePath, 'utf8');
    _teamMetaCache = JSON.parse(data);
    _teamMetaTimestamp = now;
    return _teamMetaCache;
  } catch (e) {
    _teamMetaCache = _teamMetaCache || {};
    return _teamMetaCache;
  }
}

function getTeamMetaSync() {
  const now = Date.now();
  if (_teamMetaCache && (now - _teamMetaTimestamp) < TEAM_META_TTL_MS) {
    return _teamMetaCache;
  }
  try {
    _teamMetaCache = require(require('path').join(process.cwd(), 'data', 'team_meta.json'));
    _teamMetaTimestamp = now;
    return _teamMetaCache;
  } catch (e) {
    _teamMetaCache = {};
    return _teamMetaCache;
  }
}
function lookupNationalStats(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return NATIONAL_STATS_BY_NAME[key] || null;
}

function findPlayerRating(ratings, playerId) {
  let playerRating = null;
  let teamId = null;
  for (const [tid, team] of Object.entries(ratings.teams || {})) {
    const player = (team.players || []).find((p) => p.id === playerId);
    if (player) {
      playerRating = player;
      teamId = tid;
      break;
    }
  }
  return { playerRating, teamId };
}

function buildTraits(playerRating) {
  const traits = [];
  if (!playerRating) return traits;

  const dims = playerRating.dims || {};
  if (dims.attack > 80) traits.push({ name: '进攻能力强', score: dims.attack, description: '进攻威胁大，得分能力强' });
  if (dims.defense > 80) traits.push({ name: '防守稳健', score: dims.defense, description: '防守意识好，位置感强' });
  if (dims.physical > 80) traits.push({ name: '身体素质好', score: dims.physical, description: '速度快，对抗强，体能充沛' });
  if (dims.form > 80) traits.push({ name: '状态出色', score: dims.form, description: '近期表现出色，竞技状态好' });
  if (dims.experience > 80) traits.push({ name: '经验丰富', score: dims.experience, description: '大赛经验丰富，心理素质好' });
  if (playerRating.rating >= 85) traits.push({ name: '核心球员', score: playerRating.rating, description: '球队核心，战术地位重要' });
  if (playerRating.rating >= 75 && playerRating.rating < 85) traits.push({ name: '主力级别', score: playerRating.rating, description: '主力球员，稳定出场' });
  return traits;
}

function buildEstimatedTeamOverview(teamRating, standings, teamId, teamData = {}, eloRankMap = {}) {
  const eloRating = teamRating?.rating || 1500;
  const eloNorm = Math.min(100, Math.max(0, (eloRating - 1200) / 10));

  // Load team_meta.json using TTL cache
  let teamMeta = getTeamMetaSync();

  let marketValue = `€${(eloNorm * 0.015).toFixed(1)}亿`;
  // Use elo rank map for worldRanking when available (keyed by country name)
  const eloRankKey = teamData.ratingsKey || teamData.name;
  const eloRank = eloRankKey ? eloRankMap[eloRankKey] : null;
  let worldRanking = eloRank || Math.round(100 - eloNorm);
  let fifaPoints = eloRating;
  const abbr = teamData.abbr ? teamData.abbr.toLowerCase() : '';
  let metaEntry = null;
  if (abbr && teamMeta[abbr]) {
    metaEntry = teamMeta[abbr];
  } else if (teamData.name) {
    const key = Object.keys(teamMeta).find(k => teamData.name.toLowerCase().startsWith(k));
    if (key) metaEntry = teamMeta[key];
  }
  if (metaEntry) {
    if (metaEntry.marketValue) marketValue = metaEntry.marketValue;
    if (metaEntry.worldRanking) worldRanking = metaEntry.worldRanking;
    if (metaEntry.fifaPoints) fifaPoints = metaEntry.fifaPoints;
  }

  const roster = teamData.roster || [];
  let sumAge = 0, validAge = 0;
  for (const player of roster) {
    if (player.age) { sumAge += player.age; validAge++; }
  }
  const avgAge = validAge > 0 ? (sumAge / validAge).toFixed(1) : '25.0';

  const overview = {
    worldRanking: worldRanking,
    fifaPoints: fifaPoints,
    marketValue: marketValue,
    avgAge: avgAge,
    group: '未知',
    groupRecord: { w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 },
  };

  for (const group of (standings?.children || [])) {
    for (const entry of (group.standings?.entries || [])) {
      if (entry.team?.id === teamId) {
        overview.group = group.name || '未知';
        const record = entry.records?.find((r) => r.type === 'total');
        if (record) {
          const stats = record.stats || [];
          const findStat = (type) => stats.find((s) => s.type === type)?.value || 0;
          overview.groupRecord = {
            w: findStat('wins'),
            d: findStat('ties'),
            l: findStat('losses'),
            gf: findStat('pointsFor'),
            ga: findStat('pointsAgainst'),
            gd: findStat('pointDifferential'),
            pts: findStat('points'),
          };
        }
        return { overview, eloNorm };
      }
    }
  }

  return { overview, eloNorm };
}

function buildRecentForm(eloNorm) {
  return {
    last10: { w: Math.round(eloNorm / 12), d: Math.round(3 - eloNorm / 40), l: Math.round(10 - eloNorm / 12) },
    winRate: (eloNorm / 100).toFixed(2),
    attack: { avgGoals: (eloNorm / 22).toFixed(1), dataQuality: 'estimated', _note: '基于 Elo 评分估算' },
    defense: { avgConceded: (2 - eloNorm / 50).toFixed(1), dataQuality: 'estimated', _note: '基于 Elo 评分估算' },
    dataQuality: 'estimated',
    _note: '基于 Elo 评分估算，非真实比赛数据',
  };
}

function buildTournamentHistory(eloNorm) {
  return {
    dataQuality: 'estimated',
    _note: '基于 Elo 评分估算，非真实历史数据',
    worldCupApps: Math.round(5 + eloNorm / 15),
    bestResult: eloNorm >= 80 ? '八强' : eloNorm >= 70 ? '十六强' : '小组赛',
  };
}

function buildPlayerEnhancedFallback(teamRating, playerRating) {
  const rating = playerRating?.rating || teamRating?.rating || 70;
  const formScore = playerRating?.dims?.form || rating;
  return {
    playerId: playerRating?.id || '',
    recentForm: { dataQuality: 'unavailable', _note: '球员近期表现数据暂不可用' },
    clubStats: { dataQuality: 'unavailable', _note: '俱乐部数据暂不可用' },
    nationalStats: { dataQuality: 'unavailable', _note: '国家队数据暂不可用' },
    injuryHistory: [],
    marketValue: {
      current: Math.round(rating * 500000),
      currency: 'EUR',
      trend: formScore >= 70 ? 'rising' : 'stable',
    },
  };
}

let _tournamentStatsCache = null;

module.exports = function createEntityRoutes(deps) {
  const { espn, RATINGS, ELO_RANK_MAP, COACHES, rosterCache, getTeamNameI18n } = deps;
  const { espnAthlete, espnAthleteGamelog } = require('../../services/espn');

  const resolveCoachId = (teamId) => {
    const raw = String(teamId || '');
    if (COACHES?.[raw]) return raw;

    const resolved = teamResolver.resolve(raw);
    const candidates = [
      resolved?.espn_id,
      resolved?.ratings_id,
      teamResolver.getEspnIdByRatingsId(raw),
      teamResolver.getRatingsIdByEspnId(raw),
    ].filter(Boolean);

    return candidates.find((id) => COACHES?.[id]) || raw;
  };

  const getCoachData = (teamId) => {
    const coachId = resolveCoachId(teamId);
    const coach = COACHES?.[coachId];
    if (!coach) return { error: 'Coach data not available for this team' };
    return { teamId: coachId, requestedId: String(teamId || ''), ...coach };
  };

  return {
    'GET /api/player/:id': async (params) => {
      const d = await espnAthlete(params.id, `pa_${params.id}`, 600000);
      return {
        id: params.id,
        name: d?.displayName || '?',
        fullName: d?.fullName || '',
        age: d?.age || null,
        height: d?.displayHeight || '',
        weight: d?.displayWeight || '',
        nationality: d?.citizenship || '',
        position: d?.position?.displayName || '',
        jersey: d?.jersey || '',
        headshot: d?.headshot?.href || '',
        team: d?.team?.displayName || '',
      };
    },

    'GET /api/player/:id/enhanced': async (params) => {
      const d = await espnAthlete(params.id, `pa_${params.id}`, 600000);
      if (!d || !d.displayName) return { error: 'Player not found' };

      const { playerRating, teamId } = findPlayerRating(RATINGS, params.id);
      const traits = buildTraits(playerRating);

      const clubStats = buildClubStats(d.statsSummary);

      // Gamelog for recent form (last 5 matches)
      let recentForm = { dataQuality: 'unavailable', _note: '球员近期表现数据暂不可用' };
      try {
        const gl = await espnAthleteGamelog(params.id, `gl2_${params.id}`, 300000);
        recentForm = buildPlayerRecentForm(gl);
      } catch { console.debug('entities: ESPN team fetch failed'); }

      const teamRating = teamId ? RATINGS.teams?.[teamId] : null;
      const fallback = buildPlayerEnhancedFallback(teamRating, playerRating);

      return {
        playerId: params.id,
        teamId,
        name: d.displayName,
        fullName: d.fullName,
        age: d.age,
        dob: d.displayDOB,
        position: d.position?.displayName,
        positionAbbr: d.position?.abbreviation,
        club: d.team?.displayName,
        clubShort: d.team?.shortDisplayName,
        nationality: d.citizenship,
        jersey: d.jersey,
        headshot: d.headshot?.href || '',
        height: d.displayHeight,
        weight: d.displayWeight,
        traits,
        clubStats: clubStats || fallback.clubStats,
        recentForm: recentForm || fallback.recentForm,
        nationalStats: (() => {
          const currentTournament = getWorldCupPlayerStats(d.displayName) || getWorldCupPlayerStats(d.fullName);
          if (currentTournament) return currentTournament;
          const ns = lookupNationalStats(d.displayName) || lookupNationalStats(d.fullName);
          if (!ns) return fallback.nationalStats;
          return { ...ns, assists: null, tournamentGoals: ns.wcGoals, tournamentApps: ns.wcApps, dataQuality: 'live' };
        })(),
        marketValue: fallback.marketValue,
      };
    },

    'GET /api/player/:id/traits': async (params) => {
      const { playerRating } = findPlayerRating(RATINGS, params.id);
      if (!playerRating) {
        return { error: 'Player not found in ratings database' };
      }

      const dims = playerRating.dims || {};
      return {
        playerId: params.id,
        name: playerRating.name,
        traits: buildTraits(playerRating),
        impactType: dims.attack > dims.defense ? 'creative' : dims.defense > dims.attack ? 'defensive' : 'balanced',
        superSubRating: playerRating.rating,
      };
    },

    'GET /api/team/:id': async (params) => {
      let d;
      try {
        d = await espn(`/teams/${params.id}`, `t_${params.id}`, 600000);
      } catch (e) {
        return {
          error: 'Team not found',
          statusCode: e.statusCode || 502,
          teamId: params.id,
          source: 'ESPN',
          message: e.payload?.message || e.message,
        };
      }
      const t = d?.team || {};
      if (!t.displayName) {
        return { error: 'Team not found', teamId: params.id, source: 'ESPN' };
      }
      const rosterResult = await rosterCache.getRoster(params.id, espn);

      return {
        id: params.id,
        name: t.displayName || '',
        nameI18n: getTeamNameI18n ? getTeamNameI18n(params.id, t.displayName || '') : null,
        shortName: t.shortDisplayName || '',
        logo: t.logos?.[0]?.href || '',
        record: t.record?.items?.[0]?.summary || '',
        roster: playerNameZh.enrichAll(rosterResult.roster),
        _rosterSource: rosterResult.source,
        _rosterCached: rosterResult.cached,
        _dataQuality: rosterResult.dataQuality || 'live',
      };
    },

    'GET /api/coach/:teamId': async (params) => getCoachData(params.teamId),

    'GET /api/coach-legacy/:teamId': async (params) => {
      const c = getCoachData(params.teamId);
      if (c.error) {
        return { error: 'Coach data not available for this team', hint: 'Use /api/coach/:teamId instead' };
      }
      return { ...c, _deprecated: true, _use: `/api/coach/${params.teamId}` };
    },

    'GET /api/team/:id/enhanced': async (params) => {
      const d = await espn(`/teams/${params.id}`, `t_${params.id}`, 600000);
      const t = d?.team || {};
      if (!t.displayName) return { error: 'Team not found' };

      let roster = [];
      try {
        const r = await espn(`/teams/${params.id}/roster`, `roster_${params.id}`, 600000);
        roster = (r?.athletes || []).map((p) => {
          const stats = p.statistics?.splits?.categories?.flatMap(c => c.stats || []) || [];
          const getStat = name => stats.find(s => s.name === name)?.value || 0;
          return {
            id: p.id || '',
            name: p.displayName || '',
            pos: p.position?.abbreviation || '',
            jersey: p.jersey || '',
            age: p.age || null,
            height: p.displayHeight || '',
            nationality: p.citizenship || '',
            appearances: getStat('appearances'),
            subIns: getStat('subIns'),
          };
        }).map(p => playerNameZh.enrich(p));
      } catch { console.debug('entities: ESPN athlete fetch failed'); }

      const ratingsKey = teamResolver.getRatingsIdByEspnId(params.id) || params.id;
      const teamRating = RATINGS.teams?.[ratingsKey] || RATINGS.teams?.[params.id];
      const abbr = t.abbreviation ? t.abbreviation.toLowerCase() : '';
      // Load team_meta.json using TTL cache
      const teamMetaAll = await getTeamMetaAsync();
      const metaFull = teamMetaAll[abbr] || teamMetaAll['default'] || {};
      const { overview, eloNorm } = buildEstimatedTeamOverview(teamRating, await espn('/standings', 'standings', 300000).catch(() => null), params.id, { abbr: t.abbreviation, name: t.displayName, roster: roster, ratingsKey }, ELO_RANK_MAP || {});
      const recentForm = buildRecentForm(eloNorm);
      const radar = metaFull.radar || null;
      const squadChanges = {
        dataQuality: 'unavailable',
        _note: '阵容变动数据暂不可用',
        injuries: [],
        suspended: [],
      };
      const tournamentHistory = metaFull.tournamentHistory || buildTournamentHistory(eloNorm);
      const warmupMatches = { dataQuality: 'unavailable', _note: '热身赛数据暂不可用' };
      const coachData = getCoachData(params.id);
      const coach = coachData.error ? null : coachData;

      return {
        teamId: params.id,
        name: t.displayName,
        nameI18n: getTeamNameI18n ? getTeamNameI18n(params.id, t.displayName) : null,
        shortName: t.shortDisplayName,
        code: t.abbreviation,
        logo: t.logos?.[0]?.href,
        overview,
        recentForm,
        radar,
        squadChanges,
        tournamentHistory,
        warmupMatches,
        coach,
        roster,
      };
    },

    'GET /api/tournament-stats': async () => {
      // 5-min TTL cache
      const CACHE_TTL = 300000;
      const now = Date.now();
      const { resolveDataPath } = require('../data-resolver');
      let matchesPath, squadsPath, officialStatsPath, sourceVersion;
      try {
        matchesPath = resolveDataPath('matches.json');
        squadsPath = resolveDataPath('squads.json');
        officialStatsPath = resolveDataPath('fifa_player_statistics.json');
        const [matchesStat, squadsStat, officialStatsStat] = await Promise.all([
          fsPromises.stat(matchesPath),
          fsPromises.stat(squadsPath),
          fsPromises.stat(officialStatsPath),
        ]);
        sourceVersion = [
          matchesPath, matchesStat.mtimeMs, matchesStat.size,
          squadsPath, squadsStat.mtimeMs, squadsStat.size,
          officialStatsPath, officialStatsStat.mtimeMs, officialStatsStat.size,
        ].join('|');
      } catch {
        // Tournament summaries still work in isolated test fixtures without
        // the captured FIFA player-statistics snapshot.
        try {
          const [matchesStat, squadsStat] = await Promise.all([fsPromises.stat(matchesPath), fsPromises.stat(squadsPath)]);
          sourceVersion = [matchesPath, matchesStat.mtimeMs, matchesStat.size, squadsPath, squadsStat.mtimeMs, squadsStat.size, 'no-official-player-snapshot'].join('|');
        } catch {
        return { error: 'tournament source data not found' };
        }
      }
      if (
        _tournamentStatsCache
        && _tournamentStatsCache.sourceVersion === sourceVersion
        && (now - _tournamentStatsCache.ts) < CACHE_TTL
      ) {
        return _tournamentStatsCache.data;
      }

      // FIFA 3-letter code → flag emoji (regional indicator symbols)
      const CODE_TO_FLAG = {
        ALG:'🇩🇿',ARG:'🇦🇷',AUS:'🇦🇺',AUT:'🇦🇹',BEL:'🇧🇪',BIH:'🇧🇦',BRA:'🇧🇷',
        CAN:'🇨🇦',CIV:'🇨🇮',COD:'🇨🇩',COL:'🇨🇴',CPV:'🇨🇻',CRO:'🇭🇷',CUW:'🇨🇼',
        CZE:'🇨🇿',ECU:'🇪🇨',EGY:'🇪🇬',ENG:'🇬🇧',ESP:'🇪🇸',FRA:'🇫🇷',
        GER:'🇩🇪',GHA:'🇬🇭',HAI:'🇭🇹',IRN:'🇮🇷',IRQ:'🇮🇶',JOR:'🇯🇴',JPN:'🇯🇵',
        KOR:'🇰🇷',KSA:'🇸🇦',MAR:'🇲🇦',MEX:'🇲🇽',NED:'🇳🇱',NOR:'🇳🇴',NZL:'🇳🇿',
        PAN:'🇵🇦',PAR:'🇵🇾',POR:'🇵🇹',QAT:'🇶🇦',RSA:'🇿🇦',SCO:'🇬🇧',
        SEN:'🇸🇳',SUI:'🇨🇭',SWE:'🇸🇪',TUN:'🇹🇳',TUR:'🇹🇷',URU:'🇺🇾',USA:'🇺🇸',UZB:'🇺🇿',
      };

      let matchesData, squadsData;
      try {
        const matchesContent = await fsPromises.readFile(matchesPath, 'utf8');
        matchesData = JSON.parse(matchesContent);
      } catch { return { error: 'matches.json not found' }; }
      try {
        const squadsContent = await fsPromises.readFile(squadsPath, 'utf8');
        squadsData = JSON.parse(squadsContent);
      } catch { squadsData = {}; }

      const finished = (matchesData.matches || []).filter(m => m.status === 'finished');

      // Total goals & biggest win from match scores
      let totalGoals = 0;
      let biggestWin = null;
      for (const m of finished) {
        const hs = Number(m.home?.score) || 0;
        const as = Number(m.away?.score) || 0;
        totalGoals += hs + as;
        const diff = Math.abs(hs - as);
        if (!biggestWin || diff > biggestWin.diff) {
          biggestWin = { diff, score: `${hs}-${as}`, teams: `${m.home?.code || '?'} vs ${m.away?.code || '?'}`, matchId: m.id };
        }
      }

      // Scorers & cards from squads
      const scorerMap = {};
      const squadPlayerIndex = new Map();
      let yellowCards = 0, redCards = 0;
      for (const [code, team] of Object.entries(squadsData)) {
        for (const p of (team.players || [])) {
          const normalizedName = String(p.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          squadPlayerIndex.set(`${code}|${normalizedName}`, p);
          const g = p.wcGoals || 0;
          if (g > 0) {
            const key = p.name + '|' + code + '|' + (p.id || '');
            scorerMap[key] = (scorerMap[key] || 0) + g;
          }
          yellowCards += p.wcYellow || 0;
          redCards += p.wcRed || 0;
        }
      }

      const fallbackTopScorers = Object.entries(scorerMap)
        .map(([key, goals]) => {
          const [name, team, slug] = key.split('|');
          const resolved = slug ? playerResolver.resolveBySlug(slug) : null;
          const tr = teamResolver.resolve(team);
          return { name, goals, team, flag: CODE_TO_FLAG[team] || '🏳️', athleteId: resolved?.espnId || '', teamEspnId: tr ? tr.espn_id : '' };
        })
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 20);
      const officialScorers = getOfficialTournamentScorers();
      const topScorers = officialScorers?.players?.length
        ? officialScorers.players.map(player => {
          const normalizedName = String(player.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          const squadPlayer = squadPlayerIndex.get(`${player.team}|${normalizedName}`);
          const resolved = squadPlayer?.id ? playerResolver.resolveBySlug(squadPlayer.id) : null;
          const tr = teamResolver.resolve(player.team);
          return {
            name: player.name,
            goals: player.goals,
            assists: player.assists,
            minutes: player.minutes,
            rank: player.rank,
            position: player.position,
            team: player.team,
            flag: CODE_TO_FLAG[player.team] || '🏳️',
            athleteId: resolved?.espnId || '',
            teamEspnId: tr?.espn_id || '',
            source: 'fifa_official_player_statistics',
          };
        })
        : fallbackTopScorers;

      const result = {
        played: finished.length,
        totalGoals,
        avgGoals: finished.length ? +(totalGoals / finished.length).toFixed(2) : 0,
        yellowCards,
        redCards,
        biggestWin: biggestWin ? { score: biggestWin.score, teams: biggestWin.teams } : null,
        fastestGoal: null, // not available in current data sources
        topScorers,
        topScorersSource: officialScorers ? { source: officialScorers.source, retrievedAt: officialScorers.retrievedAt, scope: officialScorers.scope } : { source: 'wc2026 squads fallback' },
      };

      _tournamentStatsCache = { ts: now, sourceVersion, data: result };
      return result;
    },
  };
};
