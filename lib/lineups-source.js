'use strict';

/**
 * lineups-source.js
 * 比赛阵型/首发/换人数据源
 *
 * 职责：
 * - 给定 ESPN match ID，通过比赛 ID 桥查询 lineups.json
 * - 按阵型规则输出 { homeFormation, awayFormation, homeXI, awayXI, substitutions }
 * - 阵型规则：该队最近 2 场真实 tactics 相同→用之，不同→用最近一场，无历史→既定阵型
 *
 * 不碰 matchup-spatial.js（由 orchestrator 集成）
 */

const fs = require('fs');
const path = require('path');
const playerNameZh = require('./player-name-zh');
const { resolveDataPath } = require('./data-resolver');

const ROOT_DATA = path.join(__dirname, '..', 'data');

// === 懒加载单例 ===
let _bridge = null;
let _lineups = null;
let _matches = null;
let _schedule = null;
let _ratings = null;

function loadBridge() {
  if (!_bridge) {
    try {
      _bridge = JSON.parse(fs.readFileSync(resolveDataPath('match_id_bridge.json'), 'utf8'));
    } catch { console.debug('lineups-source: id_bridge lookup failed for fifa code'); console.debug('lineups-source: failed to parse player-ratings.json'); console.debug('lineups-source: failed to parse match_snapshot_schedule.json'); console.debug('lineups-source: failed to parse matches.json'); console.debug('lineups-source: failed to parse lineups.json'); console.debug('lineups-source: failed to parse match_id_bridge.json');
      _bridge = { bridge: {}, reverseBridge: {} };
    }
  }
  return _bridge;
}

function loadLineups() {
  if (!_lineups) {
    try {
      _lineups = JSON.parse(fs.readFileSync(resolveDataPath('lineups.json'), 'utf8'));
    } catch {
      _lineups = {};
    }
  }
  return _lineups;
}

function loadMatches() {
  if (!_matches) {
    try {
      _matches = JSON.parse(fs.readFileSync(resolveDataPath('matches.json'), 'utf8'));
    } catch {
      _matches = { matches: [] };
    }
  }
  return _matches;
}

function loadSchedule() {
  if (!_schedule) {
    try {
      const dataDir = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
      _schedule = JSON.parse(fs.readFileSync(path.join(dataDir, 'match_snapshot_schedule.json'), 'utf8'));
    } catch {
      _schedule = { matches: [] };
    }
  }
  return _schedule;
}

function loadRatings() {
  if (!_ratings) {
    try {
      _ratings = JSON.parse(fs.readFileSync(resolveDataPath('player-ratings.json'), 'utf8'));
    } catch {
      _ratings = { data: {} };
    }
  }
  return _ratings;
}

/**
 * 通过 ESPN match ID 查找 FIFA match ID
 */
function espnToFifa(espnMatchId) {
  const bridge = loadBridge();
  const entry = bridge.bridge?.[String(espnMatchId)];
  return entry ? entry.fifa_match_id : null;
}

/**
 * 通过 FIFA match ID 查找 ESPN match ID
 */
function fifaToEspn(fifaMatchId) {
  const bridge = loadBridge();
  return bridge.reverseBridge?.[String(fifaMatchId)] || null;
}

/**
 * 获取球队代码对应的 ESPN team ID
 */
function getEspnTeamId(fifaCode) {
  try {
    const idBridge = JSON.parse(fs.readFileSync(resolveDataPath('id_bridge.json'), 'utf8'));
    return idBridge[fifaCode]?.espn_id || null;
  } catch {
    return null;
  }
}

/**
 * 获取球队的既定阵型（来自 player-ratings.json）
 */
function getTeamDefaultFormation(fifaCode) {
  const espnId = getEspnTeamId(fifaCode);
  if (!espnId) return null;

  const ratings = loadRatings();
  const teamData = ratings.data?.[String(espnId)];
  return teamData?.formation || null;
}

/**
 * 获取一支球队在所有 lineups 中的历史阵型（按比赛时间排序）
 * 返回 [{ fifaMatchId, tactics, date, opponentCode, isHome }]
 */
function getTeamFormationHistory(fifaCode) {
  const lineups = loadLineups();
  const matches = loadMatches();

  // 构建 FIFA match ID → match info 的快速索引
  const matchIndex = new Map();
  for (const m of (matches.matches || [])) {
    matchIndex.set(String(m.id), m);
  }

  const history = [];

  for (const [fifaMatchId, entry] of Object.entries(lineups)) {
    const matchInfo = matchIndex.get(fifaMatchId);
    if (!matchInfo) continue;

    const homeCode = (matchInfo.home?.code || '').trim().toUpperCase();
    const awayCode = (matchInfo.away?.code || '').trim().toUpperCase();
    const targetCode = fifaCode.trim().toUpperCase();

    let tactics = null;
    let isHome = false;
    let opponentCode = '';

    if (homeCode === targetCode && entry.home?.tactics) {
      tactics = entry.home.tactics;
      isHome = true;
      opponentCode = awayCode;
    } else if (awayCode === targetCode && entry.away?.tactics) {
      tactics = entry.away.tactics;
      isHome = false;
      opponentCode = homeCode;
    }

    if (tactics) {
      history.push({
        fifaMatchId,
        tactics,
        date: matchInfo.date || null,
        opponentCode,
        isHome,
      });
    }
  }

  // 按日期排序（升序，最近的在后）
  history.sort((a, b) => {
    const da = Date.parse(a.date) || 0;
    const db = Date.parse(b.date) || 0;
    return da - db;
  });

  return history;
}

/**
 * 阵型规则：
 * - 该队最近 2 场真实 tactics 相同 → 用之
 * - 不同 → 用最近一场
 * - 无历史 → 该队既定阵型（来自 player-ratings.json，非 4-3-3 更好但 fallback 也接受）
 *
 * 如果当前比赛已有 lineups（阵型已公布），优先使用当前比赛的真实阵型
 */
function resolveFormation(fifaCode, currentFifaMatchId) {
  // 如果当前比赛已有真实阵型，直接返回
  if (currentFifaMatchId) {
    const lineups = loadLineups();
    const entry = lineups[currentFifaMatchId];
    if (entry) {
      const matches = loadMatches();
      const matchIndex = new Map();
      for (const m of (matches.matches || [])) {
        matchIndex.set(String(m.id), m);
      }
      const matchInfo = matchIndex.get(currentFifaMatchId);
      if (matchInfo) {
        const homeCode = (matchInfo.home?.code || '').trim().toUpperCase();
        const awayCode = (matchInfo.away?.code || '').trim().toUpperCase();
        if (homeCode === fifaCode.trim().toUpperCase() && entry.home?.tactics) {
          return { formation: entry.home.tactics, source: 'current_lineups' };
        } else if (awayCode === fifaCode.trim().toUpperCase() && entry.away?.tactics) {
          return { formation: entry.away.tactics, source: 'current_lineups' };
        }
      }
    }
  }

  // 历史阵型规则
  const history = getTeamFormationHistory(fifaCode);

  if (history.length >= 2) {
    const last = history[history.length - 1].tactics;
    const secondLast = history[history.length - 2].tactics;

    if (last === secondLast) {
      return { formation: last, source: 'last_2_same', historyCount: history.length };
    } else {
      return { formation: last, source: 'latest', historyCount: history.length };
    }
  } else if (history.length === 1) {
    return { formation: history[0].tactics, source: 'only_1_historical', historyCount: 1 };
  }

  // 无历史 → 既定阵型
  const defaultFormation = getTeamDefaultFormation(fifaCode);
  return {
    formation: defaultFormation || '4-3-3',
    source: defaultFormation ? 'player_ratings' : 'fallback_433',
    historyCount: 0,
  };
}

/**
 * 获取比赛的阵型、首发和换人数据
 *
 * @param {string|number} espnMatchId - ESPN 比赛 ID（如 760415）
 * @returns {{
 *   espnMatchId: string,
 *   fifaMatchId: string|null,
 *   homeFormation: string|null,
 *   awayFormation: string|null,
 *   homeFormationSource: string|null,
 *   awayFormationSource: string|null,
 *   homeXI: object[]|null,
 *   awayXI: object[]|null,
 *   substitutions: object[],
 *   hasRealLineups: boolean,
 * }} 
 */
function getLineups(espnMatchId) {
  const espnId = String(espnMatchId);
  const fifaMatchId = espnToFifa(espnId);

  const result = {
    espnMatchId: espnId,
    fifaMatchId,
    homeFormation: null,
    awayFormation: null,
    homeFormationSource: null,
    awayFormationSource: null,
    homeXI: null,
    awayXI: null,
    substitutions: [],
    hasRealLineups: false,
  };

  if (!fifaMatchId) {
    // 无桥接，尝试从 schedule 推断阵型
    return resolveFromScheduleOnly(result);
  }

  const lineups = loadLineups();
  const matches = loadMatches();

  // 查找比赛信息
  const matchIndex = new Map();
  for (const m of (matches.matches || [])) {
    matchIndex.set(String(m.id), m);
  }
  const matchInfo = matchIndex.get(fifaMatchId);
  if (!matchInfo) {
    return resolveFromScheduleOnly(result);
  }

  const homeCode = (matchInfo.home?.code || '').trim().toUpperCase();
  const awayCode = (matchInfo.away?.code || '').trim().toUpperCase();

  // 检查是否有真实 lineups
  const lineupEntry = lineups[fifaMatchId];

  if (lineupEntry) {
    // 有真实 lineups
    result.hasRealLineups = true;

    // 阵型（真实公布）
    result.homeFormation = lineupEntry.home?.tactics || null;
    result.awayFormation = lineupEntry.away?.tactics || null;
    result.homeFormationSource = 'published_lineups';
    result.awayFormationSource = 'published_lineups';

    // 首发 XI
    result.homeXI = formatXI(lineupEntry.home?.xi || []);
    result.awayXI = formatXI(lineupEntry.away?.xi || []);

    // 换人事件
    const homeSubs = (lineupEntry.home?.substitutions || []).map(s => ({
      ...s,
      side: 'home',
      fifaCode: homeCode,
    }));
    const awaySubs = (lineupEntry.away?.substitutions || []).map(s => ({
      ...s,
      side: 'away',
      fifaCode: awayCode,
    }));
    result.substitutions = [...homeSubs, ...awaySubs].sort((a, b) => {
      // 按 minute 排序（解析数字）
      const ma = parseInt(a.minute) || 0;
      const mb = parseInt(b.minute) || 0;
      return ma - mb;
    });
  } else {
    // 无真实 lineups — 阵型走规则，XI=null
    if (homeCode) {
      const homeResolved = resolveFormation(homeCode, null);
      result.homeFormation = homeResolved.formation;
      result.homeFormationSource = homeResolved.source;
    }
    if (awayCode) {
      const awayResolved = resolveFormation(awayCode, null);
      result.awayFormation = awayResolved.formation;
      result.awayFormationSource = awayResolved.source;
    }
    // XI = null（引擎自行推 projected）
  }

  return result;
}

/**
 * 当桥接失败时，从 schedule 尝试获取球队信息并解析阵型
 */
function resolveFromScheduleOnly(result) {
  const schedule = loadSchedule();
  const espnId = result.espnMatchId;

  const espnMatch = (schedule.matches || []).find(
    m => String(m.matchId) === espnId
  );

  if (!espnMatch) return result;

  const homeAbbr = (espnMatch.teams?.home?.abbreviation || '').trim().toUpperCase();
  const awayAbbr = (espnMatch.teams?.away?.abbreviation || '').trim().toUpperCase();

  if (homeAbbr) {
    const resolved = resolveFormation(homeAbbr, null);
    result.homeFormation = resolved.formation;
    result.homeFormationSource = resolved.source;
  }
  if (awayAbbr) {
    const resolved = resolveFormation(awayAbbr, null);
    result.awayFormation = resolved.formation;
    result.awayFormationSource = resolved.source;
  }

  return result;
}

/**
 * 格式化 XI 数据：提取关键字段
 */
function formatXI(xiArray) {
  return xiArray.map(p => ({
    fifaPlayerId: p.id || null,
    name: p.name || '',
    nameZh: p.nameZh || playerNameZh.lookup(p.name) || null,
    number: p.number || null,
    pos: p.gk ? 'GK' : p.fieldPos === 1 ? 'DF' : p.fieldPos === 2 ? 'MF' : p.fieldPos === 3 ? 'FW' : '??',
    gk: Boolean(p.gk),
    captain: Boolean(p.captain),
    fieldPos: p.fieldPos ?? null,
  }));
}

/**
 * 获取比赛的换人数据（供 substitutions 路由使用）
 *
 * @param {string|number} espnMatchId
 * @returns {{ espnMatchId, fifaMatchId, substitutions: object[], hasData: boolean }}
 */
function getSubstitutions(espnMatchId) {
  const espnId = String(espnMatchId);
  const fifaMatchId = espnToFifa(espnId);

  if (!fifaMatchId) {
    return {
      espnMatchId: espnId,
      fifaMatchId: null,
      substitutions: [],
      hasData: false,
      error: 'no_bridge',
    };
  }

  const lineups = loadLineups();
  const matches = loadMatches();
  const lineupEntry = lineups[fifaMatchId];

  if (!lineupEntry) {
    return {
      espnMatchId: espnId,
      fifaMatchId,
      substitutions: [],
      hasData: false,
      note: 'no_lineups_yet',
    };
  }

  // 查找主客队代码
  const matchIndex = new Map();
  for (const m of (matches.matches || [])) {
    matchIndex.set(String(m.id), m);
  }
  const matchInfo = matchIndex.get(fifaMatchId);
  const homeCode = matchInfo?.home?.code || '?';
  const awayCode = matchInfo?.away?.code || '?';

  // 构建球员名字查找表（从 XI + subs）—— 英文 + 中文
  const playerNames = new Map();
  const playerNamesZh = new Map();
  const buildPlayerMap = (players) => {
    for (const p of players) {
      if (p.id && p.name) {
        playerNames.set(String(p.id), p.name);
        const zh = p.nameZh || playerNameZh.lookup(p.name) || null;
        if (zh) playerNamesZh.set(String(p.id), zh);
      }
    }
  };
  if (lineupEntry.home?.xi) buildPlayerMap(lineupEntry.home.xi);
  if (lineupEntry.home?.subs) buildPlayerMap(lineupEntry.home.subs);
  if (lineupEntry.away?.xi) buildPlayerMap(lineupEntry.away.xi);
  if (lineupEntry.away?.subs) buildPlayerMap(lineupEntry.away.subs);

  const makeSub = (s, side, code) => ({
    off: s.off,
    offName: playerNames.get(String(s.off)) || '?',
    offNameZh: playerNamesZh.get(String(s.off)) || null,
    on: s.on,
    onName: playerNames.get(String(s.on)) || '?',
    onNameZh: playerNamesZh.get(String(s.on)) || null,
    minute: s.minute || '?',
    period: s.period ?? null,
    side,
    teamCode: code,
  });

  const homeSubs = (lineupEntry.home?.substitutions || []).map(s => makeSub(s, 'home', homeCode));
  const awaySubs = (lineupEntry.away?.substitutions || []).map(s => makeSub(s, 'away', awayCode));

  const allSubs = [...homeSubs, ...awaySubs].sort((a, b) => {
    const ma = parseInt(a.minute) || 0;
    const mb = parseInt(b.minute) || 0;
    return ma - mb;
  });

  return {
    espnMatchId: espnId,
    fifaMatchId,
    substitutions: allSubs,
    hasData: true,
    homeSubs: homeSubs.length,
    awaySubs: awaySubs.length,
    total: allSubs.length,
    teams: { home: homeCode, away: awayCode },
  };
}

/**
 * 清除缓存（供 sync 后重载）
 */
function clearCache() {
  _bridge = null;
  _lineups = null;
  _matches = null;
  _schedule = null;
  _ratings = null;
}

module.exports = {
  getLineups,
  getSubstitutions,
  espnToFifa,
  fifaToEspn,
  resolveFormation,
  getTeamFormationHistory,
  clearCache,
};
