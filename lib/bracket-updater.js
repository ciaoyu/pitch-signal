'use strict';

/**
 * bracket-updater.js
 *
 * 将 bracket_2026.json 的抽象 slot 标记（A1、B2、3rd C/E/F/H/I、W R32-1）
 * 解析为真实队名，构建完整的可渲染 bracket。
 *
 * 三层逻辑：
 *   Layer 1: group-position 解析（A1 → Spain）
 *   Layer 2: 最佳第三名分配（12 组取前 8，二部图匹配 8 个槽位）
 *   Layer 3: 淘汰赛结果传播（骨架，待 6/28 后实现）
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ===== 惰性加载 =====
let _bracket = null;
let _slotMap = null;
let _schedule = null;
let _matchIdBridge = null;

function loadBracket() {
  if (!_bracket) _bracket = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bracket_2026.json'), 'utf8'));
  return _bracket;
}

function loadSlotMap() {
  if (!_slotMap) _slotMap = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bracket_slot_map.json'), 'utf8'));
  return _slotMap;
}

function loadSchedule() {
  if (!_schedule) _schedule = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'match_snapshot_schedule.json'), 'utf8'));
  return _schedule;
}

function loadMatchIdBridge() {
  if (!_matchIdBridge) {
    try {
      _matchIdBridge = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wc2026', 'match_id_bridge.json'), 'utf8'));
    } catch (e) {
      _matchIdBridge = { bridge: {}, reverseBridge: {} };
    }
  }
  return _matchIdBridge;
}

// ===== R32 shortName 匹配 =====

/**
 * 把 bracket slot 标记转为 ESPN schedule 的 shortName 格式。
 * 例: teamA="A2", teamB="B2" → "2B @ 2A"
 *     teamA="E1", teamB="3rd A/B/C/D/F" → "3RD @ 1E"
 */
function slotToScheduleShortName(teamA, teamB) {
  function token(slot) {
    if (!slot) return null;
    if (slot.startsWith('3rd ')) return '3RD';
    const m = slot.match(/^([A-L])(\d+)$/);
    if (m) return `${m[2]}${m[1]}`;
    return null;
  }
  const a = token(teamA);
  const b = token(teamB);
  if (!a || !b) return null;
  return `${b} @ ${a}`;
}

/**
 * 构建 R32 的 bracket-slot → ESPN schedule-match 映射。
 * @returns {Object} { "R32-1": { matchId, kickoff, ... }, ... }
 */
function buildR32MatchMap(bracket, scheduleMatches) {
  const knockoutMatches = scheduleMatches.filter(m => m.stage === 'knockout');
  const map = {};
  const bridgeData = loadMatchIdBridge();
  const reverseBridge = bridgeData.reverseBridge || {};

  let fifaMatches = [];
  try {
    fifaMatches = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wc2026', 'matches.json'), 'utf8')).matches || [];
  } catch (e) {}

  for (const [slotId, m] of Object.entries(bracket.matches)) {
    if (!slotId.startsWith('R32-')) continue;
    const shortName = slotToScheduleShortName(m.teamA, m.teamB);
    if (!shortName) continue;

    let schedMatch = knockoutMatches.find(s => s.shortName === shortName);
    
    // 如果因队伍名称被解析而导致 shortName 匹配不上，尝试从 matches.json 找对应的 FIFA 淘汰赛再桥接回 ESPN matchId
    if (!schedMatch) {
      const token = (slot) => {
        if (!slot) return null;
        if (slot.startsWith('3rd ')) return '3RD';
        const match = slot.match(/^([A-L])(\d+)$/);
        return match ? `${match[2]}${match[1]}` : null;
      };
      const sa = token(m.teamA);
      const sb = token(m.teamB);

      const matchesPlaceholder = (f, e) => {
        if (f === e) return true;
        if (e === '3RD' && f.startsWith('3')) return true;
        if (f === '3RD' && e.startsWith('3')) return true;
        return false;
      };

      const fifaMatch = fifaMatches.find(fm => {
        return fm.stage === 'r32' && (
          (matchesPlaceholder(fm.phA, sa) && matchesPlaceholder(fm.phB, sb)) ||
          (matchesPlaceholder(fm.phA, sb) && matchesPlaceholder(fm.phB, sa))
        );
      });

      if (fifaMatch) {
        const espnMatchId = reverseBridge[fifaMatch.id];
        if (espnMatchId) {
          schedMatch = knockoutMatches.find(s => String(s.matchId) === String(espnMatchId));
        }
      }
    }

    if (schedMatch) {
      map[slotId] = {
        matchId: schedMatch.matchId,
        kickoff: schedMatch.kickoffUtc,
        venue: schedMatch.venue,
        teams: schedMatch.teams,
        status: schedMatch.status,
      };
    }
  }
  return map;
}

// ===== Layer 1: slot 解析 =====

/**
 * 解析单个 bracket slot 为团队信息。
 * @param {string} slot - e.g. "A1", "B2", "3rd C/E/F/H/I", "W R32-1"
 * @param {Object} posMap - group-position → team name, e.g. { A1: "Spain", ... }
 * @param {Object} thirdPlaceMap - "3rd X/Y/Z" → team name (由 resolveThirdPlaceTeams 生成)
 * @param {Object} [posMapI18n] - group-position → { zh, en } (可选)
 */
function resolveSlot(slot, posMap, thirdPlaceMap, posMapI18n) {
  if (!slot) return { name: 'TBD', seed: null };

  if (slot.startsWith('W ')) {
    // "W R32-1" → 取决于上游比赛结果（现阶段 TBD）
    return { name: 'TBD', seed: slot };
  }

  if (slot.startsWith('3rd ')) {
    const team = thirdPlaceMap ? thirdPlaceMap[slot] : null;
    if (team) return { name: team.name, nameI18n: team.nameI18n, seed: slot, id: team.id };
    return { name: '待定', seed: slot };
  }

  // 直接 group-position: "A1", "B2" 等
  const name = posMap[slot];
  const i18n = posMapI18n ? posMapI18n[slot] : null;
  if (name) return { name, nameI18n: i18n, seed: slot };
  return { name: 'TBD', seed: slot };
}

// ===== Layer 2: 最佳第三名 =====

/**
 * 从 12 组第三名中排序取前 8，分配到 bracket 的 "3rd ..." 槽位。
 * 使用二部图最大匹配（augmenting path）确保全局最优分配。
 *
 * @param {Object} thirdPlaceData - { A: { name, id, pts, gd, gf }, B: { ... }, ... }
 * @param {Object} bracketMatches - bracket_2026.json 的 matches 部分
 * @returns {Object} thirdPlaceMap - { "3rd A/B/C/D/F": { name, id, nameI18n }, ... }
 */
function resolveThirdPlaceTeams(thirdPlaceData, bracketMatches) {
  if (!thirdPlaceData || Object.keys(thirdPlaceData).length < 12) return {};

  // 1. 排序所有第三名：积分 → 净胜球 → 进球数
  const sorted = Object.entries(thirdPlaceData)
    .map(([group, data]) => ({ group, ...data }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

  // 2. 取前 8 名
  const qualified = sorted.slice(0, 8);
  const qualifiedGroups = new Set(qualified.map(t => t.group));

  // 3. 收集 bracket 中的 "3rd ..." 槽位
  const thirdSlots = [];
  for (const [slotId, m] of Object.entries(bracketMatches)) {
    if (m.teamA && m.teamA.startsWith('3rd ')) {
      thirdSlots.push({ slotId, token: m.teamA, side: 'teamA' });
    }
    if (m.teamB && m.teamB.startsWith('3rd ')) {
      thirdSlots.push({ slotId, token: m.teamB, side: 'teamB' });
    }
  }

  // 4. 解析每个槽位的候选组
  const slotCandidates = thirdSlots.map(s => {
    const letters = s.token.replace('3rd ', '').split('/').map(x => x.trim());
    const matchingQualified = letters.filter(l => qualifiedGroups.has(l));
    return { ...s, letters, matchingQualified };
  });

  // 5. 二部图最大匹配：qualifiedGroups ↔ slotCandidates
  //    matchGroup[g] = slotIndex | -1
  const groupList = qualified.map(t => t.group);
  const matchGroup = {};
  for (const g of groupList) matchGroup[g] = -1;

  function findMatch(group, visited) {
    for (let si = 0; si < slotCandidates.length; si++) {
      const slot = slotCandidates[si];
      if (!slot.matchingQualified.includes(group)) continue;
      if (visited[si]) continue;
      visited[si] = true;
      // 这个 slot 未被占用，或者可以为当前占用者找到替代 slot
      const occupant = groupList.find(g => matchGroup[g] === si);
      if (occupant === undefined || findMatch(occupant, visited)) {
        matchGroup[group] = si;
        return true;
      }
    }
    return false;
  }

  // 依次为每个已晋级组寻找匹配
  for (const g of groupList) {
    if (matchGroup[g] === -1) {
      findMatch(g, {});
    }
  }

  // 6. 构建 thirdPlaceMap
  const assigned = {};
  for (const g of groupList) {
    const si = matchGroup[g];
    if (si >= 0 && si < slotCandidates.length) {
      const slot = slotCandidates[si];
      const teamData = thirdPlaceData[g];
      assigned[slot.token] = {
        name: teamData.name,
        nameI18n: teamData.nameI18n || null,
        id: teamData.id,
        group: g,
      };
    }
  }

  return assigned;
}

// ===== Layer 3: 淘汰赛结果传播（骨架） =====

/**
 * 传播淘汰赛结果到下游 bracket slots。
 *
 * Phase 1 (现在): 淘汰赛未开始，直接返回 bracket 不做修改。
 * Phase 2 (6/28+):
 *   1. 读取 bracket_slot_map.json 获取 R16+ 的 espnMatchId
 *   2. 遍历淘汰赛日期查询 ESPN scoreboard
 *   3. 通过 team composition 匹配 R32 结果
 *   4. 通过 espnMatchId 匹配 R16+ 结果
 *   5. 提取 winner，写入下游 bracket slot 的 teamA/teamB
 *
 * @param {Object} bracket - 已解析的 bracket（buildResolvedBracket 的输出）
 * @param {Object} [deps] - { espn, parseEvent, getCached, setCache } (Phase 2 使用)
 * @returns {Object} 同一 bracket 对象（原地修改）
 */
function propagateResults(bracket, deps) {
  const bridgeData = loadMatchIdBridge();
  const reverseBridge = bridgeData.reverseBridge || {};

  let fifaMatches = [];
  try {
    fifaMatches = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'wc2026', 'matches.json'), 'utf8')).matches || [];
  } catch (e) {
    return bracket;
  }

  const knockoutFifa = fifaMatches.filter(m => m.stage !== 'group');

  // 1. 同步比赛状态与比分，并使用 id_bridge 完成 FIFA Match ID ↔ ESPN Match ID 映射
  for (const [slotId, m] of Object.entries(bracket.matches)) {
    let espnMatchId = m.matchId;
    if (!espnMatchId) continue;

    // 尝试在 match_id_bridge 中通过 ESPN match ID 查对应的 FIFA match
    const bridgeEntry = bridgeData.bridge[espnMatchId];
    let fifaMatch = null;
    if (bridgeEntry && bridgeEntry.fifa_match_id) {
      fifaMatch = knockoutFifa.find(fm => String(fm.id) === String(bridgeEntry.fifa_match_id));
    }

    // 兜底：如果桥接关系未生成，按照 kickoff 唯一时间匹配
    if (!fifaMatch && m.kickoff) {
      const mTime = new Date(m.kickoff).getTime();
      fifaMatch = knockoutFifa.find(fm => {
        const fmTime = new Date(fm.date).getTime();
        return Math.abs(fmTime - mTime) < 60000;
      });
    }

    if (fifaMatch) {
      // 如果 matchId 碰巧被置为了 FIFA ID，在此映射为 ESPN Match ID 确保前端点击跳转正确
      if (reverseBridge[fifaMatch.id]) {
        m.matchId = reverseBridge[fifaMatch.id];
      }

      if (fifaMatch.status === 'finished') {
        m.status = 'final';
        m.scoreA = fifaMatch.home?.score ?? null;
        m.scoreB = fifaMatch.away?.score ?? null;
        if (fifaMatch.winner) {
          m.winner = (fifaMatch.winner === fifaMatch.home?.code) ? 'A' : 
                     (fifaMatch.winner === fifaMatch.away?.code ? 'B' : null);
        }
      } else if (fifaMatch.status === 'live' || fifaMatch.status === 'in') {
        m.status = 'live';
        m.scoreA = fifaMatch.home?.score ?? null;
        m.scoreB = fifaMatch.away?.score ?? null;
      }
    }
  }

  // 2. 拓扑排序传播晋级结果：R32 -> R16 -> QF -> SF
  const rounds = ['R32', 'R16', 'QF', 'SF'];
  rounds.forEach(round => {
    for (const [slotId, m] of Object.entries(bracket.matches)) {
      if (!slotId.startsWith(round + '-')) continue;

      if (m.status === 'final' && m.winner) {
        const winnerTeam = m.winner === 'A' ? m.teamA : m.teamB;

        for (const [downSlotId, downMatch] of Object.entries(bracket.matches)) {
          if (downMatch.feedA === slotId) {
            downMatch.teamA = { name: winnerTeam.name, nameI18n: winnerTeam.nameI18n || null, seed: `W ${slotId}` };
          }
          if (downMatch.feedB === slotId) {
            downMatch.teamB = { name: winnerTeam.name, nameI18n: winnerTeam.nameI18n || null, seed: `W ${slotId}` };
          }
        }
      }
    }
  });

  return bracket;
}

// ===== 主函数 =====

/**
 * 构建完整的已解析 bracket。
 *
 * @param {Object} args
 * @param {Object} args.posMap - group-position → team name, e.g. { A1: "Spain", ... }
 * @param {Object} [args.posMapI18n] - group-position → { zh, en }
 * @param {Object} [args.thirdPlaceData] - { A: { name, id, pts, gd, gf }, ... }
 * @param {Object} [args.bracket] - bracket_2026.json 内容（默认从文件加载）
 * @param {Object} [args.schedule] - match_snapshot_schedule.json 内容（默认从文件加载）
 * @param {Object} [args.deps] - ESPN deps（传给 propagateResults）
 * @returns {Object} 完整 bracket
 */
function buildResolvedBracket({ posMap, posMapI18n, thirdPlaceData, bracket, schedule, deps }) {
  bracket = bracket || loadBracket();
  schedule = schedule || loadSchedule();
  const slotMapData = loadSlotMap();

  // Layer 2: 最佳第三名分配
  const thirdPlaceMap = resolveThirdPlaceTeams(thirdPlaceData || {}, bracket.matches);

  // 构建 R32 的 schedule 映射（获取 kickoff 时间和 matchId）
  const r32MatchMap = buildR32MatchMap(bracket, schedule.matches || []);

  // 构建 R16+ 的 kickoff 映射（从 bracket_slot_map.json 的 espnMatchId 查 schedule）
  const knockoutSchedule = (schedule.matches || []).filter(m => m.stage === 'knockout');
  const espnIdToSchedule = {};
  for (const m of knockoutSchedule) espnIdToSchedule[m.matchId] = m;

  // 解析每个 bracket match
  const resolved = {};
  for (const [id, m] of Object.entries(bracket.matches)) {
    const teamAResolved = resolveSlot(m.teamA, posMap, thirdPlaceMap, posMapI18n);
    const teamBResolved = resolveSlot(m.teamB, posMap, thirdPlaceMap, posMapI18n);

    // 获取 kickoff 时间和 matchId
    let kickoff = null;
    let matchId = null;
    let statusObj = null;

    if (id.startsWith('R32-')) {
      const r32info = r32MatchMap[id];
      if (r32info) {
        kickoff = r32info.kickoff;
        matchId = r32info.matchId;
        statusObj = r32info.status;
      }
    } else {
      // R16+: 从 bracket_slot_map 查 espnMatchId
      const slotInfo = slotMapData.matches && slotMapData.matches[id];
      if (slotInfo && slotInfo.espnMatchId) {
        matchId = slotInfo.espnMatchId;
        const schedInfo = espnIdToSchedule[slotInfo.espnMatchId];
        if (schedInfo) {
          kickoff = schedInfo.kickoffUtc;
          statusObj = schedInfo.status;
        }
      }
    }

    // 判断状态
    let status = 'tbd';
    if (statusObj) {
      if (statusObj.state === 'post') status = 'final';
      else if (statusObj.state === 'in') status = 'live';
      else if (statusObj.state === 'pre') {
        // 只有两队都已确定时才算 scheduled，否则保持 tbd
        const bothKnown = teamAResolved.name !== 'TBD' && teamBResolved.name !== 'TBD'
          && teamAResolved.name !== '待定' && teamBResolved.name !== '待定';
        status = bothKnown ? 'scheduled' : 'tbd';
      }
    } else if (teamAResolved.name !== 'TBD' && teamBResolved.name !== 'TBD') {
      status = 'scheduled'; // 两队都已确定，只是还没有 schedule 信息
    }

    resolved[id] = {
      teamA: teamAResolved,
      teamB: teamBResolved,
      scoreA: null,  // Phase 2: 从 ESPN 获取
      scoreB: null,
      winner: null,  // Phase 2: 从 ESPN 获取
      status,
      kickoff,
      matchId,
    };
  }

  // 3RD-PLACE 特殊处理（不在 bracket.matches 中，但在 bracket_slot_map 中）
  let thirdPlaceMatch = null;
  const tpSlot = slotMapData.matches && slotMapData.matches['3RD-PLACE'];
  if (tpSlot) {
    const schedInfo = espnIdToSchedule[tpSlot.espnMatchId];
    thirdPlaceMatch = {
      matchId: tpSlot.espnMatchId,
      kickoff: schedInfo ? schedInfo.kickoffUtc : null,
      teamA: { name: 'TBD', seed: 'SF-1 Loser' },
      teamB: { name: 'TBD', seed: 'SF-2 Loser' },
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'tbd',
    };
  }

  const result = {
    matches: resolved,
    tree: bracket.tree,
    rounds: ['R32', 'R16', 'QF', 'SF', 'FINAL'],
    thirdPlaceResolved: Object.keys(thirdPlaceMap).length > 0,
    thirdPlaceMatch,
  };

  // Layer 3: 结果传播（Phase 2 实现）
  return propagateResults(result, deps);
}

module.exports = {
  buildResolvedBracket,
  resolveThirdPlaceTeams,
  resolveSlot,
  propagateResults,
  // 导出内部函数供测试
  _internals: { slotToScheduleShortName, buildR32MatchMap },
};
