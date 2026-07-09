const { createLogger } = require('./logger');
const logger = createLogger('standings-helper');
/**
 * Shared standings calculation logic
 * Used by core.js and standings.js to avoid duplicate code
 */

const WC_GROUPS = {
  A: ['203', '467', '451', '450'],
  B: ['206', '452', '4398', '475'],
  C: ['205', '2869', '2654', '580'],
  D: ['660', '210', '628', '465'],
  E: ['481', '11678', '4789', '209'],
  F: ['449', '627', '466', '659'],
  G: ['459', '2620', '469', '2666'],
  H: ['164', '2597', '655', '212'],
  I: ['478', '654', '4375', '464'],
  J: ['202', '624', '474', '2917'],
  K: ['482', '2850', '2570', '208'],
  L: ['448', '477', '4469', '2659'],
};

const TEAM_TO_GROUP = Object.fromEntries(
  Object.entries(WC_GROUPS).flatMap(([group, ids]) => ids.map((id) => [id, group])),
);

function emptyStanding(id, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS) {
  return {
    name: getTeamNameZh(id),
    nameI18n: getTeamNameI18n ? getTeamNameI18n(id) : null,
    abbr: '',
    logo: TEAM_LOGOS[id] || '',
    id,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
  };
}

function normalizeStandingRow(row, id, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS) {
  const normalized = { ...emptyStanding(id, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS), ...(row || {}), id, name: getTeamNameZh(id), nameI18n: getTeamNameI18n ? getTeamNameI18n(id) : row?.nameI18n || null };
  for (const key of ['played', 'wins', 'draws', 'losses', 'gf', 'ga', 'gd', 'pts']) {
    normalized[key] = Number.parseInt(normalized[key], 10) || 0;
  }
  return normalized;
}

function applyResult(table, homeId, awayId, homeScore, awayScore) {
  const home = table[homeId];
  const away = table[awayId];
  if (!home || !away) return;

  home.played++;
  away.played++;
  home.gf += homeScore;
  home.ga += awayScore;
  away.gf += awayScore;
  away.ga += homeScore;
  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;

  if (homeScore > awayScore) {
    home.wins++;
    away.losses++;
    home.pts += 3;
  } else if (awayScore > homeScore) {
    away.wins++;
    home.losses++;
    away.pts += 3;
  } else {
    home.draws++;
    away.draws++;
    home.pts++;
    away.pts++;
  }
}

async function getCompletedGroupMatches(espn, parseEvent, daysBack = 30) {
  const matches = [];
  const now = Date.now();
  for (let i = -daysBack; i <= 0; i++) {
    const date = new Date(now + i * 86400000);
    const dateKey = date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(/-/g, '');
    try {
      const data = await espn(`/scoreboard?dates=${dateKey}`, `s_${dateKey}`, 600000);
      for (const event of (data.events || [])) {
        const parsed = parseEvent(event);
        if (parsed.state !== 'post') continue;
        const homeGroup = TEAM_TO_GROUP[parsed.home?.id];
        const awayGroup = TEAM_TO_GROUP[parsed.away?.id];
        if (!homeGroup || homeGroup !== awayGroup) continue;
        matches.push(parsed);
      }
    } catch { logger.debug('standings-helper: JSON parse of fixture payload failed'); }
  }
  return matches;
}

function computeStandingsFromMatches(matches, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS) {
  const computedMap = {};
  for (const ids of Object.values(WC_GROUPS)) {
    for (const id of ids) computedMap[id] = emptyStanding(id, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);
  }

  for (const match of matches) {
    const homeScore = Number.parseInt(match.home?.score, 10);
    const awayScore = Number.parseInt(match.away?.score, 10);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
    applyResult(computedMap, match.home.id, match.away.id, homeScore, awayScore);
  }

  return computedMap;
}

function buildGroupsFromStandings(standingsMap, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, espnMap = null) {
  const groups = [];
  for (const [groupName, teamIds] of Object.entries(WC_GROUPS)) {
    let maxPlayed = 0;
    const standings = teamIds
      .map((id) => {
        const computed = standingsMap[id] || emptyStanding(id, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);
        let finalTeam = computed;
        if (espnMap && espnMap[id]) {
          const espnTeam = normalizeStandingRow(espnMap[id], id, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS);
          finalTeam = computed.played > espnTeam.played ? { ...espnTeam, ...computed } : espnTeam;
        }
        if (finalTeam.played > maxPlayed) maxPlayed = finalTeam.played;
        return finalTeam;
      })
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
    groups.push({ name: `小组 ${groupName}`, group: groupName, matchday: maxPlayed, standings });
  }
  return groups;
}

module.exports = {
  WC_GROUPS,
  TEAM_TO_GROUP,
  emptyStanding,
  normalizeStandingRow,
  applyResult,
  getCompletedGroupMatches,
  computeStandingsFromMatches,
  buildGroupsFromStandings,
};
