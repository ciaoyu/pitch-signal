const { createLogger } = require('./logger');
const logger = createLogger('venueFactors');
/**
 * 环境因子模块 — Poisson λ 的海拔/高温衰减
 *
 * 公式（按 Agent C 任务书）：
 *   β_alt  = 1 - 0.03 · max(0, (Δh - 1000) / 1000)      Δh 单位：米
 *   β_temp = 1 - 0.01 · max(0, T - 32)                   T 单位：华氏度
 *   λ'     = λ · β_alt · β_temp
 *
 * Δh 语义决策（重要，供 review）：
 *   任务书原文 "Δh 用 baseCamp 海拔 vs 球场海拔"。若 Δh 取带符号差值
 *   (baseCamp - venue)，则只有"球队从高原大本营下到低海拔球场"才被惩罚，
 *   而"低海拔球队上高原"完全不衰减——这与运动生理学常识相反（上高原缺氧
 *   才是进球能力下降的主因）。故本实现取 Δh = |baseCamp_alt - venue_alt|
 *   绝对差值，双向惩罚海拔剧变。max(0, (Δh-1000)) 仍只在差值 > 1000m 生效。
 *   若需改为带符号语义，仅需调整 altitudeFactor 内一行。
 *
 * T 单位决策：
 *   公式里 32 是华氏冰点，故 T 为华氏度。数据源 weather.json/climate.json
 *   均为摄氏度，内部统一 cToF 转换后套公式。
 *
 * 数据缺失回退（任务书要求"数据缺失时回退现有逻辑"）：
 *   - baseCamp.altitude 缺失 → β_alt = 1（applied:false，source 标 fallback）
 *   - venue.altitude 缺失    → β_alt = 1（同上）
 *   - weather.tC + climate.highC 均缺失 → β_temp = 1（同上）
 *   任一 β = 1 即等于不改动 λ，predict 落回原基线。
 *
 * 数据源（优先 $DATA_PATH/wc2026，回退 resources/seed/wc2026）：
 *   climate.json  — venues[venueId].{jun,jul}.{highC,lowC}
 *   venues.json   — venues[venueId].{lat,lon,matches[],altitude?(待落盘)}
 *   weather.json  — [matchId].{tC,feelsC,fetchedAt}
 *   teams.json    — teams[code].baseCamp.{city,lat,lon,altitude?(待落盘)}
 *
 * baseCamp.altitude 与 venue.altitude 当前尚未落盘（Agent A 待补），
 * 本模块在字段缺失时自动回退 β_alt=1，等数据到位后无需改代码即可生效。
 */
const fs = require('fs');
const path = require('path');

const { resolveDataPath } = require('./data-resolver');

// altitude 字段的多种可能命名（兼容 Agent A 落盘时的命名习惯）
const ALT_KEYS = ['altitude', 'altM', 'elevationM', 'elevation', 'elevM'];

// TTL 缓存机制（5 分钟过期）
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;
let _cacheTimestamp = 0;

/**
 * 懒加载并缓存所有数据源 + 反查索引。
 * 失败的文件返回 null，不抛错（保证 predict 不因数据缺失崩溃）。
 * 缓存 TTL: 5 分钟（CACHE_TTL_MS）
 */
function loadData() {
  const now = Date.now();
  if (_cache && (now - _cacheTimestamp) < CACHE_TTL_MS) return _cache;
  
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(resolveDataPath(file), 'utf8'));
    } catch { logger.debug('venueFactors: metadata fetch failed');
      return null;
    }
  };

  const climate = readJson('climate.json');
  const venues = readJson('venues.json');
  const weather = readJson('weather.json');
  const teams = readJson('teams.json');
  // id_bridge 是规范桥接（47 队，CPV 不在其中）；CPV 经 teams.json 兜底
  const idBridge = readJson('id_bridge.json');
  // match_id_bridge: ESPN matchId ↔ FIFA matchId 双向桥
  const matchIdBridge = readJson('match_id_bridge.json');

  // matchId → venueId 反查索引（FIFA match ID）
  const matchToVenue = {};
  if (venues?.venues) {
    for (const [vid, v] of Object.entries(venues.venues)) {
      for (const mid of (v.matches || [])) matchToVenue[mid] = vid;
    }
  }

  // ESPN matchId → FIFA matchId → venueId 三级索引
  // 前端 / API 传入 ESPN ID，venues.json 用 FIFA ID
  const espnToFifaMatchId = {};
  const fifaToEspnMatchId = {};
  if (matchIdBridge?.bridge) {
    for (const [, entry] of Object.entries(matchIdBridge.bridge)) {
      if (entry.espn_match_id && entry.fifa_match_id) {
        espnToFifaMatchId[entry.espn_match_id] = entry.fifa_match_id;
        fifaToEspnMatchId[entry.fifa_match_id] = entry.espn_match_id;
      }
    }
  }
  // 也把 ESPN ID 直接映射到 venueId
  for (const [espnId, fifaId] of Object.entries(espnToFifaMatchId)) {
    if (matchToVenue[fifaId]) matchToVenue[espnId] = matchToVenue[fifaId];
  }

  // team 多路索引（teams.json，48 队含 CPV）
  const teamByCode = {};
  const teamByNameEn = {};
  const teamByNameZh = {};
  const teamByIso2 = {};
  if (teams?.teams) {
    for (const [code, t] of Object.entries(teams.teams)) {
      teamByCode[code] = t;
      if (t.name?.en) teamByNameEn[t.name.en.toLowerCase()] = code;
      if (t.name?.zh) teamByNameZh[t.name.zh] = code;
      if (t.iso2) teamByIso2[t.iso2] = code;
    }
  }

  // id_bridge 反索引（47 队，规范名→code）
  // ratings.json 键是国家名，经 id_bridge[code].name_official 桥接
  const bridgeByCode = {};
  const bridgeByNameOfficial = {};
  const bridgeByNameEn = {};
  const bridgeByNameZh = {};
  const bridgeByEspnId = {};
  const bridgeByFifaId = {};
  if (idBridge) {
    for (const [code, e] of Object.entries(idBridge)) {
      bridgeByCode[code] = e;
      if (e.name_official) bridgeByNameOfficial[e.name_official.toLowerCase()] = code;
      if (e.name_en) bridgeByNameEn[e.name_en.toLowerCase()] = code;
      if (e.name_zh) bridgeByNameZh[e.name_zh] = code;
      if (e.espn_id != null) bridgeByEspnId[String(e.espn_id)] = code;
      if (e.fifa_id != null) bridgeByFifaId[String(e.fifa_id)] = code;
    }
  }

  _cache = {
    climate, venues, weather, teams, idBridge, matchIdBridge,
    matchToVenue, teamByCode, teamByNameEn, teamByNameZh, teamByIso2,
    bridgeByCode, bridgeByNameOfficial, bridgeByNameEn, bridgeByNameZh,
    bridgeByEspnId, bridgeByFifaId,
    espnToFifaMatchId, fifaToEspnMatchId,
  };
  _cacheTimestamp = now;
  return _cache;
}

/** 仅供单测重置缓存 */
function _resetCache() { _cache = null; _cacheTimestamp = 0; }

/** 摄氏度 → 华氏度 */
function cToF(c) {
  if (c == null || !Number.isFinite(c)) return null;
  return c * 9 / 5 + 32;
}

/** 从对象里挑出海拔字段（兼容多种命名） */
function _pickAltitude(obj) {
  if (!obj) return null;
  for (const k of ALT_KEYS) {
    const v = obj[k];
    if (v != null && Number.isFinite(v)) return Number(v);
  }
  return null;
}

const _round4 = (x) => Math.round(x * 10000) / 10000;

/**
 * 海拔衰减因子 β_alt
 * @param {number|null} baseCampAltM 大本营海拔(米)
 * @param {number|null} venueAltM    球场海拔(米)
 * @returns {{beta, applied, deltaH, source}}
 */
function altitudeFactor(baseCampAltM, venueAltM) {
  if (baseCampAltM == null || venueAltM == null) {
    return { beta: 1, applied: false, deltaH: null, source: 'fallback:missing_altitude' };
  }
  // 绝对差值：双向惩罚海拔剧变（见文件头决策说明）
  const deltaH = Math.abs(baseCampAltM - venueAltM);
  const beta = 1 - 0.03 * Math.max(0, (deltaH - 1000) / 1000);
  const b = _round4(Math.max(0, beta));
  return {
    beta: b,
    applied: b < 1,
    deltaH: Math.round(deltaH * 10) / 10,
    source: deltaH > 1000 ? 'altitude_delta' : 'no_altitude_effect',
  };
}

/**
 * 高温衰减因子 β_temp（输入华氏度）
 * @param {number|null} tempF 华氏度
 */
function temperatureFactorF(tempF) {
  if (tempF == null || !Number.isFinite(tempF)) {
    return { beta: 1, applied: false, tempF: null, source: 'fallback:missing_temp' };
  }
  const beta = 1 - 0.01 * Math.max(0, tempF - 32);
  const b = _round4(Math.max(0, beta));
  return {
    beta: b,
    applied: b < 1,
    tempF: Math.round(tempF * 100) / 100,
    source: tempF > 32 ? 'heat_decay' : 'no_heat_effect',
  };
}

/** 高温衰减因子（输入摄氏度，内部转华氏度） */
function temperatureFactor(tempC) {
  return temperatureFactorF(cToF(tempC));
}

/**
 * 取某场比赛的实时温度(摄氏度)。
 * 优先级：weather.json[matchId].tC → climate[venueId].{jun|jul}.highC → null
 * @param {string} matchId
 * @param {'jun'|'jul'} [monthHint]  climate 回退时用的月份；缺省从 weather.fetchedAt 推，再缺省 'jun'
 * @returns {{tempC, source}}
 */
function getMatchTempC(matchId, monthHint) {
  const d = loadData();
  // 尝试直接匹配，再尝试 FIFA ID 转换
  const fifaId = d.espnToFifaMatchId[matchId] || matchId;
  const espnId = d.fifaToEspnMatchId[matchId] || matchId;
  const w = d.weather?.[matchId] || d.weather?.[fifaId] || d.weather?.[espnId];
  if (w && w.tC != null && Number.isFinite(w.tC)) {
    return { tempC: w.tC, source: 'weather.live' };
  }
  // 回退 climate
  const venueId = d.matchToVenue[matchId];
  if (venueId) {
    const clim = d.climate?.venues?.[venueId] || d.venues?.venues?.[venueId]?.climate;
    if (clim) {
      let m = monthHint;
      if (!m) {
        // 从 weather.fetchedAt 推月份（即便 tC 缺失，fetchedAt 可能仍在）
        const fa = w?.fetchedAt;
        if (fa) {
          const mm = new Date(fa).getMonth() + 1; // 1-12
          if (mm === 7) m = 'jul'; else if (mm === 6) m = 'jun';
        }
        if (!m) m = 'jun'; // 赛事 6.11 开打，默认 6 月
      }
      const monthClim = clim[m] || clim.jun;
      if (monthClim && monthClim.highC != null) {
        return { tempC: monthClim.highC, source: `climate.${m}_high` };
      }
    }
  }
  return { tempC: null, source: 'fallback:no_temp' };
}

/**
 * 任意球队标识 → FIFA 三字母 code
 * 解析优先级（任一命中即返回）：
 *   1. teamByCode 直命中（含 CPV，48 队）
 *   2. id_bridge 反索引：name_official / name_en / name_zh / espn_id / fifa_id（47 队）
 *   3. teams.json 反索引：name_en / name_zh / iso2（兜底含 CPV）
 *
 * CPV 不在 id_bridge（无 espn_id），但经 teams.json 仍可解析为 'CPV'，
 * 后续 ratings 查询查不到时由 prediction 的 1500 基线兜底（Est.）。
 *
 * @param {string} identifier fifa code / ratingsId(国家名) / espnId / 英文名 / 中文名 / iso2
 * @returns {string|null}
 */
function resolveTeamCode(identifier) {
  if (!identifier) return null;
  const d = loadData();
  const id = String(identifier);

  // 1. code 直命中（含 CPV）
  if (d.teamByCode[id]) return id;
  // 1b. id_bridge code 直命中
  if (d.bridgeByCode[id]) return id;

  // 2. id_bridge 反索引（规范桥接）
  const lid = id.toLowerCase();
  if (d.bridgeByNameOfficial[lid]) return d.bridgeByNameOfficial[lid];
  if (d.bridgeByNameEn[lid]) return d.bridgeByNameEn[lid];
  if (d.bridgeByNameZh[id]) return d.bridgeByNameZh[id];
  if (d.bridgeByEspnId[id]) return d.bridgeByEspnId[id];
  if (d.bridgeByFifaId[id]) return d.bridgeByFifaId[id];

  // 3. teams.json 反索引兜底（含 CPV）
  if (d.teamByNameEn[lid]) return d.teamByNameEn[lid];
  if (d.teamByNameZh[id]) return d.teamByNameZh[id];
  if (d.teamByIso2[id]) return d.teamByIso2[id];
  return null;
}

/** 取球队大本营对象（含未来 altitude） */
function getTeamBaseCamp(teamIdentifier) {
  const code = resolveTeamCode(teamIdentifier);
  if (!code) return null;
  return loadData().teamByCode[code]?.baseCamp || null;
}

/** 取比赛场馆对象 */
function getMatchVenue(matchId) {
  const d = loadData();
  const vid = d.matchToVenue[matchId];
  if (!vid) return null;
  return d.venues?.venues?.[vid] || null;
}

/**
 * 计算某支球队在某场比赛的环境因子（β_alt · β_temp）
 * @param {string} matchId        ESPN matchId（如 "400021440"）
 * @param {string} teamIdentifier ratingsId / espnId / fifa code / 队名
 * @param {'jun'|'jul'} [monthHint]
 * @returns {object} {betaAlt, betaTemp, beta, applied, deltaH, baseCampAltM, venueAltM, tempC, tempSource, source, teamCode, venueId}
 */
function computeForTeam(matchId, teamIdentifier, monthHint) {
  const d = loadData();
  const code = resolveTeamCode(teamIdentifier);
  const baseCamp = code ? (d.teamByCode[code]?.baseCamp || null) : null;
  const venue = getMatchVenue(matchId);
  const tempInfo = getMatchTempC(matchId, monthHint);

  const baseCampAltM = _pickAltitude(baseCamp);
  const venueAltM = _pickAltitude(venue);

  const alt = altitudeFactor(baseCampAltM, venueAltM);
  const temp = temperatureFactor(tempInfo.tempC);

  const beta = _round4(alt.beta * temp.beta);
  const applied = alt.applied || temp.applied;

  // 拼接可读 source
  const parts = [];
  if (alt.applied) parts.push(`alt:${alt.source}(Δh=${alt.deltaH}m)`);
  else if (alt.source.startsWith('fallback')) parts.push(alt.source);
  if (temp.applied) parts.push(`temp:${temp.source}(${tempInfo.tempC}°C)`);
  else if (temp.source.startsWith('fallback')) parts.push(temp.source);
  if (!parts.length) parts.push('no_env_effect');

  return {
    betaAlt: alt.beta,
    betaTemp: temp.beta,
    beta,
    applied,
    deltaH: alt.deltaH,
    baseCampAltM,
    venueAltM,
    tempC: tempInfo.tempC,
    tempSource: tempInfo.source,
    source: parts.join(' | '),
    teamCode: code,
    venueId: venue?.id || null,
  };
}

/**
 * 计算一场比赛主客两队的环境因子
 * @returns {{home: object, away: object}}
 */
function computeForMatch(matchId, homeIdentifier, awayIdentifier, monthHint) {
  return {
    home: computeForTeam(matchId, homeIdentifier, monthHint),
    away: computeForTeam(matchId, awayIdentifier, monthHint),
  };
}

module.exports = {
  cToF,
  altitudeFactor,
  temperatureFactor,
  temperatureFactorF,
  getMatchTempC,
  resolveTeamCode,
  getTeamBaseCamp,
  getMatchVenue,
  computeForTeam,
  computeForMatch,
  loadData,
  _resetCache,
};
