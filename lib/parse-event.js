/**
 * 事件解析模块 - PitchSignal
 * 
 * 负责：
 * - 解析ESPN事件数据
 * - 计算时间显示
 * - 提供时间辅助函数
 */

const { createLogger } = require('./logger');
const logger = createLogger('parse-event');

/**
 * 时间辅助函数：北京时间显示
 * @param {string} iso - ISO格式时间字符串
 * @returns {string} 格式化后的时间字符串
 */
function bjt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  } catch {
    return iso;
  }
}

/**
 * 时间辅助函数：北京时间短格式
 * @param {string} iso - ISO格式时间字符串
 * @returns {string} 格式化后的短时间字符串
 */
function bjtShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { 
      timeZone: 'Asia/Shanghai', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  } catch {
    return iso;
  }
}

/**
 * 解析事件数据
 * @param {Object} ev - ESPN事件对象
 * @param {Object} deps - 依赖项
 * @param {Object} deps.TEAM_NAMES_ZH - 球队中文名称映射
 * @param {Function} deps.getTeamNameI18n - 获取球队国际化名称的函数
 * @param {Object} deps.RATINGS - 球队评分数据
 * @param {Object} deps.ELO_RANK_MAP - ELO排名映射
 * @param {Object} deps.TEAM_FLAGS - 球队国旗映射
 * @param {Object} deps.TEAM_LOGOS - 球队Logo映射
 * @returns {Object} 解析后的事件对象
 */
function parseEvent(ev, deps) {
  const { 
    TEAM_NAMES_ZH, 
    getTeamNameI18n, 
    RATINGS, 
    ELO_RANK_MAP, 
    TEAM_FLAGS, 
    TEAM_LOGOS 
  } = deps;
  
  const comp = ev.competitions?.[0] || {};
  const cs = comp.competitors || [];
  let home = {}, away = {};
  
  for (const c of cs) {
    const teamId = c.team?.id || '';
    const zhName = TEAM_NAMES_ZH[teamId];
    const teamDisplayName = c.team?.shortDisplayName || c.team?.displayName || c.team?.name || '';
    const nameI18n = getTeamNameI18n(teamId, teamDisplayName);
    const displayName = zhName ? `${zhName.zh} ${teamDisplayName}` : (teamDisplayName || String(teamId));
    const ratingEntry = RATINGS?.teams?.[teamDisplayName] || RATINGS?.teams?.[c.team?.name] || null;
    
    const t = {
      name: displayName,
      fullName: zhName ? `${zhName.zh} ${zhName.en}` : (teamDisplayName || String(teamId)),
      nameI18n,
      abbr: c.team?.abbreviation || '',
      logo: c.team?.logos?.[0]?.href || TEAM_LOGOS[teamId] || '',
      score: c.score || '0',
      rank: c.curatedRank?.current || ELO_RANK_MAP[c.team?.displayName] || 99,
      elo: ratingEntry?.rating || null,
      id: teamId,
      flag: TEAM_FLAGS[teamId] || '🏳️',
    };
    
    if (c.homeAway === 'home') home = t; else away = t;
  }
  
  const st = comp.status?.type || {};
  const state = st.state || 'pre';
  let status, sClass;
  
  if (state === 'in') { 
    status = comp.status?.displayClock || '进行中'; 
    sClass = 'live'; 
  }
  else if (state === 'post') { 
    status = st.shortDetail || '已结束'; 
    sClass = 'finished'; 
  }
  else { 
    status = bjtShort(ev.date); 
    sClass = 'upcoming'; 
  }
  
  let group = '';
  for (const n of (comp.notes || [])) {
    if (n.type === 'event') { 
      group = n.headline || n.text || ''; 
      break; 
    }
  }
  
  // 计算基本的Elo胜平负概率
  let homeWin = 0, draw = 0, awayWin = 0;
  if (home.elo && away.elo) {
    const diff = home.elo - away.elo;
    const expectedHome = 1 / (1 + Math.pow(10, -diff / 400));
    const drawProb = Math.max(0.15, 0.28 - Math.abs(diff) * 0.0003);
    homeWin = Math.round((1 - drawProb) * expectedHome * 100);
    draw = Math.round(drawProb * 100);
    awayWin = Math.max(0, 100 - homeWin - draw);
  }
  
  return {
    id: ev.id || '', 
    name: ev.name || '', 
    date: ev.date || '',
    dateBJT: bjt(ev.date), 
    timeBJT: bjtShort(ev.date),
    status, 
    sClass, 
    state, 
    home, 
    away, 
    group,
    venue: comp.venue?.fullName || '', 
    venueId: comp.venue?.id || '',
    homeWin, 
    draw, 
    awayWin,
  };
}

/**
 * 创建带依赖的parseEvent函数
 * @param {Object} deps - 依赖项
 * @returns {Function} 带依赖的parseEvent函数
 */
function createParseEvent(deps) {
  return (ev) => parseEvent(ev, deps);
}

module.exports = {
  parseEvent,
  createParseEvent,
  bjt,
  bjtShort,
};