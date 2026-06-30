'use strict';

/**
 * FIFA 官方 API 客户端
 *
 * 端点：https://api.fifa.com/api/v3/
 * 无需 key，无请求限制。返回官方赛程、实时阵型坐标、换人事件。
 *
 * Competition ID: 17 (FIFA World Cup)
 * Season ID: 285023 (2026)
 */

const https = require('https');

const BASE = 'https://api.fifa.com/api/v3';
const COMP = 17;
const SEASON = 285023;

// 内存缓存，TTL 秒
const _cache = new Map();

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}
function _cacheSet(key, data, ttlMs) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function fetchJson(url, ttlMs = 30000) {
  const cached = _cacheGet(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return resolve(null);
          const data = JSON.parse(raw);
          _cacheSet(url, data, ttlMs);
          resolve(data);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => { req.destroy(); resolve(null); });
  });
}

/**
 * 拉取赛程列表
 * 返回所有 WC2026 比赛，包含 IdMatch, MatchStatus, 开赛时间, 两队 IdCountry
 * MatchStatus: 0=已结束, 1=未开赛, 3=进行中, 12=首发已公布
 */
async function fetchCalendar() {
  const url = `${BASE}/calendar/matches?idCompetition=${COMP}&idSeason=${SEASON}&count=500&language=en`;
  const data = await fetchJson(url, 5 * 60 * 1000); // 5min cache
  return data?.Results ?? [];
}

/**
 * 拉取单场比赛实时数据
 * 返回真实阵型字符串、球员位置坐标、换人事件
 *
 * @param {string} idStage - FIFA Stage ID（从 calendar 结果取）
 * @param {string} idMatch - FIFA Match UUID
 */
async function fetchLiveMatch(idStage, idMatch) {
  const url = `${BASE}/live/football/${COMP}/${SEASON}/${idStage}/${idMatch}?language=en`;
  const data = await fetchJson(url, 20000); // 20s cache for live data
  if (!data) return null;

  return parseLiveMatch(data);
}

/**
 * 解析 live match 响应，提取我们需要的字段
 */
function parseLiveMatch(raw) {
  const home = raw.HomeTeam ?? {};
  const away = raw.AwayTeam ?? {};

  return {
    matchId: raw.IdMatch,
    stageId: raw.IdStage,
    status: raw.MatchStatus, // 0=结束, 1=未开, 3=进行中
    minute: raw.MatchTime ?? null,
    homeScore: raw.HomeTeam?.Score ?? 0,
    awayScore: raw.AwayTeam?.Score ?? 0,

    // 真实阵型字符串
    homeTactics: home.Tactics ?? null,
    awayTactics: away.Tactics ?? null,

    // 球员位置（FIFA 归一化坐标 0-100）
    homePlayers: parsePlayers(home.Players ?? []),
    awayPlayers: parsePlayers(away.Players ?? []),

    // 事件流（进球、换人、红黄牌）
    events: parseEvents(raw.MatchEvents ?? []),
  };
}

function parsePlayers(players) {
  return players.map(p => ({
    id: p.IdPlayer,
    name: p.PlayerName?.[0]?.Description ?? '',
    shirtNumber: p.ShirtNumber,
    position: p.Position, // GK=0, DF=2, MF=3, FW=4
    positionX: p.PositionX ?? p.LineupX ?? null,
    positionY: p.PositionY ?? p.LineupY ?? null,
    status: p.Status, // 1=首发, 2=替补上场, 3=已被换下
    minuteIn: p.SubstitutedIn ?? null,
    minuteOut: p.SubstitutedOut ?? null,
  }));
}

function parseEvents(events) {
  return events.map(e => ({
    id: e.IdEvent,
    type: e.Type,       // 0=进球, 2=黄牌, 3=红牌, 5=换人, 6=VAR, 65=自摆乌龙
    minute: e.MatchMinute,
    minuteAdded: e.MatchMinuteExtra ?? 0,
    team: e.IdTeam,
    player: e.IdPlayer,
    playerOff: e.IdPlayerOff ?? null, // 换人时被换下的球员
    description: e.TypeLocalized?.[0]?.Description ?? '',
  }));
}

/**
 * 按球队 FIFA 国家码查找 IdMatch
 * 用于把 ESPN match_id 查到的两队 FIFA 代码映射到 FIFA 比赛
 *
 * @param {string} homeCode - e.g. "ARG"
 * @param {string} awayCode - e.g. "AUT"
 * @param {string} [datePrefix] - e.g. "2026-06-30"（可选，加速搜索）
 */
async function findMatchByTeams(homeCode, awayCode, datePrefix) {
  const matches = await fetchCalendar();
  return matches.find(m => {
    const h = m.HomeTeam?.IdCountry;
    const a = m.AwayTeam?.IdCountry;
    const matchDate = (m.Date ?? '').slice(0, 10);
    const dateOk = !datePrefix || matchDate === datePrefix;
    return dateOk && (
      (h === homeCode && a === awayCode) ||
      (h === awayCode && a === homeCode)
    );
  }) ?? null;
}

/**
 * FIFA MatchStatus 数字 → 语义字符串
 */
function statusLabel(code) {
  const map = { 0: 'finished', 1: 'scheduled', 3: 'live', 12: 'lineup_confirmed' };
  return map[code] ?? 'unknown';
}

module.exports = {
  fetchCalendar,
  fetchLiveMatch,
  findMatchByTeams,
  statusLabel,
  // 暴露给测试
  _parseLiveMatch: parseLiveMatch,
};
