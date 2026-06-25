'use strict';

/**
 * 小组赛末轮战略情境分析 — Final-Round Tactical Context
 *
 * 在纯统计预测(Elo/Poisson)之上,叠加一层"确定性"的战略情境说明,
 * 不修改任何概率,只回答末轮特有的三个问题:
 *
 *   A. 出线场景   —— 本场每支球队需要什么结果(已锁定 / 平局即可 / 必须赢 / 看净胜球)
 *   B. 同时进行的另一场 —— 同组平行比赛(末轮 4 队分 2 场,平行场 = 组内不在本场的另两队)
 *   C. 下一轮对阵 —— 用 bracket_2026.json 算"以第 1 / 第 2 名出线"分别在 R32 碰到谁,
 *                    比较对手强度,客观指出是否存在求某名次的战术动机(中立陈述,不下定性结论)
 *
 * 全部基于真实积分榜 + 真实对阵表 + 真实 Elo。无数据 / 非末轮 → 返回 { applicable:false }。
 */
const fs = require('fs');
const path = require('path');
const teamResolver = require('./team_resolver');

// ===== 静态数据(惰性加载,失败不致命) =====
let _bracket = null;
let _ratings = null;

function loadBracket() {
  if (_bracket) return _bracket;
  try {
    _bracket = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'bracket_2026.json'), 'utf8'));
  } catch {
    _bracket = { matches: {} };
  }
  return _bracket;
}

function loadRatings() {
  if (_ratings) return _ratings;
  try {
    _ratings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ratings.json'), 'utf8')).teams || {};
  } catch {
    _ratings = {};
  }
  return _ratings;
}

// ===== 工具:取球队 Elo =====
function teamEloFromStandingRow(row, ratings) {
  if (!row) return null;
  const ratingsId = teamResolver.resolve(row.id)?.ratings_id || teamResolver.resolve(row.name)?.ratings_id || row.name;
  const r = ratings[ratingsId] || ratings[row.name];
  return r?.rating || null;
}

// ===== bracket:某位置标记(A1/B2/...) 在 R32 的对手位置标记 =====
function findR32Opponent(positionToken, bracketMatches) {
  for (const [key, m] of Object.entries(bracketMatches)) {
    if (!key.startsWith('R32-')) continue;
    if (m.teamA === positionToken) return { r32: key, opponentToken: m.teamB };
    if (m.teamB === positionToken) return { r32: key, opponentToken: m.teamA };
  }
  return null;
}

/**
 * 把对手位置标记解析成"预计对手 + 强度估计"。
 * - "A1"/"B2"  → 该组当前积分榜对应名次的球队(其它组今晚也在踢,故为"最可能"估计)
 * - "3rd X/Y/Z" → 候选各组当前第 3 名的平均强度
 * @param {string} token
 * @param {Object<string, Array>} groupsByName  已排序的各组积分榜 { A:[row,row,row,row], ... }
 * @param {object} ratings
 */
function resolveOpponent(token, groupsByName, ratings) {
  if (!token) return null;

  const direct = /^([A-L])([12])$/.exec(token);
  if (direct) {
    const grp = groupsByName[direct[1]];
    const idx = Number(direct[2]) - 1;
    const row = grp && grp[idx];
    if (!row) return { token, label: { zh: `${direct[1]} 组第 ${direct[2]} 名(待定)`, en: `Group ${direct[1]} #${direct[2]} (TBD)` }, elo: null, provisional: true };
    return {
      token,
      label: { zh: row.nameI18n?.zh || row.name, en: row.nameI18n?.en || row.name },
      elo: teamEloFromStandingRow(row, ratings),
      provisional: true, // 名次今晚才定,当前榜首/次席为最可能估计
    };
  }

  const third = /^3rd\s+(.+)$/i.exec(token);
  if (third) {
    const letters = third[1].split('/').map((s) => s.trim()).filter(Boolean);
    const candidates = letters
      .map((L) => (groupsByName[L] ? groupsByName[L][2] : null))
      .filter(Boolean);
    const elos = candidates.map((r) => teamEloFromStandingRow(r, ratings)).filter((x) => typeof x === 'number');
    const avgElo = elos.length ? Math.round(elos.reduce((a, b) => a + b, 0) / elos.length) : null;
    return {
      token,
      label: { zh: `第三名球队(${letters.join('/')} 之一)`, en: `Third-placed team (one of ${letters.join('/')})` },
      elo: avgElo,
      provisional: true,
      candidates: candidates.map((r) => ({ zh: r.nameI18n?.zh || r.name, en: r.nameI18n?.en || r.name })),
    };
  }

  return { token, label: { zh: token, en: token }, elo: null, provisional: true };
}

// ===== 出线场景枚举 =====
// 只用积分定名次;积分相等时用当前净胜球作 tie-break,并标记"取决于净胜球"。
function rankAfter(table) {
  // table: [{id, pts, gd, gf}]  → 返回 id→rank(1..4) 与是否存在积分并列(净胜球依赖)
  const sorted = [...table].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
  const rankById = {};
  let gdDependent = false;
  sorted.forEach((t, i) => { rankById[t.id] = i + 1; });
  // 检测出线线(第 2/3 名之间)是否积分并列 → 净胜球决定
  if (sorted[1] && sorted[2] && sorted[1].pts === sorted[2].pts) gdDependent = true;
  return { rankById, gdDependent };
}

const OUTCOMES = ['homeWin', 'draw', 'awayWin'];

// 把一场比赛的某种结果加到积分表副本上(名义比分:胜 1:0、平 0:0)
function applyOutcome(table, hId, aId, outcome) {
  const h = table.find((t) => t.id === hId);
  const a = table.find((t) => t.id === aId);
  if (!h || !a) return;
  if (outcome === 'homeWin') { h.pts += 3; h.gd += 1; h.gf += 1; a.gd -= 1; }
  else if (outcome === 'awayWin') { a.pts += 3; a.gd += 1; a.gf += 1; h.gd -= 1; }
  else { h.pts += 1; a.pts += 1; }
}

function cloneTable(rows) {
  return rows.map((r) => ({ id: r.id, pts: r.pts, gd: r.gd, gf: r.gf }));
}

/**
 * 对本场某支球队,枚举"本场 win/draw/lose × 平行场 3 种结果",归纳出线状态。
 * @returns { ifWin, ifDraw, ifLose, locked }
 */
function analyzeTeamScenarios(focusId, baseRows, match, parallel) {
  // match: {homeId, awayId}  parallel: {homeId, awayId}
  const focusIsHome = focusId === match.homeId;
  // 本场结果从 focus 视角映射到 outcome
  const focusOutcomeMap = focusIsHome
    ? { win: 'homeWin', draw: 'draw', lose: 'awayWin' }
    : { win: 'awayWin', draw: 'draw', lose: 'homeWin' };

  const result = {};
  const allRanksAcrossEverything = new Set();

  for (const key of ['win', 'draw', 'lose']) {
    const ranks = new Set();
    let anyGdDependent = false;
    for (const pOut of OUTCOMES) {
      const table = cloneTable(baseRows);
      applyOutcome(table, match.homeId, match.awayId, focusOutcomeMap[key]);
      applyOutcome(table, parallel.homeId, parallel.awayId, pOut);
      const { rankById, gdDependent } = rankAfter(table);
      ranks.add(rankById[focusId]);
      allRanksAcrossEverything.add(rankById[focusId]);
      if (gdDependent) anyGdDependent = true;
    }
    result[key] = summarizeRanks(ranks, anyGdDependent);
  }

  // locked:无视本场结果,所有情形名次集合
  result.locked = lockState(allRanksAcrossEverything);
  return result;
}

function summarizeRanks(rankSet, gdDependent) {
  const ranks = [...rankSet].sort((a, b) => a - b);
  const qualifies = ranks.every((r) => r <= 2);
  const eliminated = ranks.every((r) => r >= 3);
  let status;
  if (qualifies && ranks.length === 1 && ranks[0] === 1) {
    status = { zh: '锁定小组第一', en: 'Secures top spot' };
  } else if (qualifies) {
    status = gdDependent
      ? { zh: '出线(名次/净胜球待定)', en: 'Advances (seed/GD pending)' }
      : { zh: '确定出线', en: 'Advances' };
  } else if (eliminated) {
    status = { zh: '出局', en: 'Eliminated' };
  } else {
    status = gdDependent
      ? { zh: '出线与否取决于另一场及净胜球', en: 'Survival depends on the other match & GD' }
      : { zh: '出线与否取决于另一场', en: 'Survival depends on the other match' };
  }
  return { ranks, gdDependent, status };
}

function lockState(rankSet) {
  const ranks = [...rankSet];
  if (ranks.every((r) => r === 1)) return { state: 'first', zh: '已锁定小组第一', en: 'Top spot already secured' };
  if (ranks.every((r) => r <= 2)) return { state: 'qualified', zh: '已确定出线', en: 'Already qualified' };
  if (ranks.every((r) => r >= 3)) return { state: 'eliminated', zh: '已被淘汰', en: 'Already eliminated' };
  return null;
}

// ===== 主入口 =====
/**
 * @param {object} args
 * @param {string} args.homeId  ESPN team id
 * @param {string} args.awayId  ESPN team id
 * @param {Array}  args.standingsGroups  GET /api/standings 的 groups: [{ name, standings:[row...] }]
 * @returns {object} tacticalScenario,或 { applicable:false, reason }
 */
function buildFinalRoundContext({ homeId, awayId, standingsGroups }) {
  if (!homeId || !awayId) return { applicable: false, reason: 'missing-teams' };
  if (!Array.isArray(standingsGroups) || standingsGroups.length === 0) {
    return { applicable: false, reason: 'no-standings' };
  }

  // groupsByName: { A:[row,row,row,row(已排序)], ... }  组名取 standings 里的字母
  const groupsByName = {};
  for (const g of standingsGroups) {
    const letter = String(g.name || '').replace(/[^A-L]/gi, '').toUpperCase().slice(-1) || g.name;
    groupsByName[letter] = g.standings || [];
  }

  // 找本场两队所在组
  let groupLetter = null;
  let groupRows = null;
  for (const [letter, rows] of Object.entries(groupsByName)) {
    const ids = rows.map((r) => String(r.id));
    if (ids.includes(String(homeId)) && ids.includes(String(awayId))) {
      groupLetter = letter;
      groupRows = rows;
      break;
    }
  }
  if (!groupLetter || !groupRows || groupRows.length !== 4) {
    return { applicable: false, reason: 'not-in-same-group-of-4' };
  }

  // 是否末轮:组内 4 队全部 played === 2(前两轮已踢完,本场+平行场是第三轮)
  const allPlayedTwo = groupRows.every((r) => Number(r.played) === 2);
  if (!allPlayedTwo) {
    return { applicable: false, reason: 'not-final-round', groupLetter };
  }

  // 平行比赛 = 组内不在本场的另两队
  const others = groupRows.filter((r) => String(r.id) !== String(homeId) && String(r.id) !== String(awayId));
  if (others.length !== 2) return { applicable: false, reason: 'cannot-derive-parallel' };
  const parallel = { homeId: String(others[0].id), awayId: String(others[1].id) };

  const ratings = loadRatings();
  const bracket = loadBracket();

  const baseRows = groupRows.map((r) => ({
    id: String(r.id),
    pts: Number(r.pts) || 0,
    gd: Number(r.gd) || 0,
    gf: Number(r.gf) || 0,
  }));

  const nameOf = (id) => {
    const row = groupRows.find((r) => String(r.id) === String(id));
    return { zh: row?.nameI18n?.zh || row?.name || String(id), en: row?.nameI18n?.en || row?.name || String(id) };
  };
  const rankOf = (id) => {
    const sorted = [...groupRows]; // groupRows 已按榜排序
    return sorted.findIndex((r) => String(r.id) === String(id)) + 1;
  };

  // 每队:出线场景 + bracket 路径
  const teams = {};
  for (const focusId of [String(homeId), String(awayId)]) {
    const scen = analyzeTeamScenarios(focusId, baseRows, { homeId: String(homeId), awayId: String(awayId) }, parallel);

    // bracket:以第 1 / 第 2 名出线分别碰谁
    const asFirstSlot = `${groupLetter}1`;
    const asSecondSlot = `${groupLetter}2`;
    const r32First = findR32Opponent(asFirstSlot, bracket.matches);
    const r32Second = findR32Opponent(asSecondSlot, bracket.matches);
    const oppFirst = r32First ? resolveOpponent(r32First.opponentToken, groupsByName, ratings) : null;
    const oppSecond = r32Second ? resolveOpponent(r32Second.opponentToken, groupsByName, ratings) : null;

    let incentive = null;
    if (oppFirst?.elo != null && oppSecond?.elo != null) {
      const delta = oppFirst.elo - oppSecond.elo; // >0:第一名路径对手更强 → 求第二更轻松
      const TH = 40;
      if (delta > TH) {
        incentive = {
          prefer: 'second', deltaElo: Math.round(delta),
          note: {
            zh: `以小组第二出线的 R32 对手预计更弱(Elo 约低 ${Math.round(delta)}),客观上存在不争第一的潜在动机。`,
            en: `The projected R32 opponent is weaker when finishing 2nd (≈${Math.round(delta)} Elo lower), an objective incentive not to chase top spot.`,
          },
        };
      } else if (delta < -TH) {
        incentive = {
          prefer: 'first', deltaElo: Math.round(-delta),
          note: {
            zh: `以小组第一出线的 R32 对手预计更弱(Elo 约低 ${Math.round(-delta)}),争第一同时符合竞技与赛程利益。`,
            en: `The projected R32 opponent is weaker when finishing 1st (≈${Math.round(-delta)} Elo lower); chasing top spot aligns with the easier path.`,
          },
        };
      }
    }

    teams[focusId] = {
      name: nameOf(focusId),
      currentRank: rankOf(focusId),
      currentPts: baseRows.find((r) => r.id === focusId)?.pts ?? 0,
      currentGd: baseRows.find((r) => r.id === focusId)?.gd ?? 0,
      ifWin: scen.win,
      ifDraw: scen.draw,
      ifLose: scen.lose,
      locked: scen.locked,
      bracket: {
        asFirst: r32First ? { slot: asFirstSlot, r32: r32First.r32, opponent: oppFirst } : null,
        asSecond: r32Second ? { slot: asSecondSlot, r32: r32Second.r32, opponent: oppSecond } : null,
        incentive,
      },
    };
  }

  // 中立情境提示(双方都有避强动机 → 提示"双方都倾向某名次"的求和情境,但不下"打默契球"定性)
  const notes = [];
  const hInc = teams[String(homeId)].bracket.incentive;
  const aInc = teams[String(awayId)].bracket.incentive;
  if (hInc?.prefer === 'second' && aInc?.prefer === 'second') {
    notes.push({
      zh: '双方若都更倾向以小组第二出线,本场存在求稳/求和的情境,实战强度可能低于实力对比的预期。',
      en: 'If both sides prefer to finish 2nd, the match carries a mutual low-stakes incentive; on-pitch intensity may fall below what the talent gap implies.',
    });
  }
  const hLock = teams[String(homeId)].locked;
  const aLock = teams[String(awayId)].locked;
  if (hLock && aLock) {
    notes.push({
      zh: '双方名次均已基本锁定,本场对出线影响有限,可能出现轮换或保守战术。',
      en: 'Both sides have effectively locked their fate; the match has limited bearing on qualification — expect rotation or conservative tactics.',
    });
  }

  return {
    applicable: true,
    finalRound: true,
    groupLetter,
    standings: groupRows.map((r, i) => ({
      id: String(r.id),
      name: { zh: r.nameI18n?.zh || r.name, en: r.nameI18n?.en || r.name },
      rank: i + 1,
      played: Number(r.played) || 0,
      pts: Number(r.pts) || 0,
      gd: Number(r.gd) || 0,
      gf: Number(r.gf) || 0,
    })),
    parallelMatch: {
      homeId: parallel.homeId,
      awayId: parallel.awayId,
      homeName: nameOf(parallel.homeId),
      awayName: nameOf(parallel.awayId),
    },
    teams,
    notes,
    disclaimer: {
      zh: '以上为基于积分与对阵表的客观情境推演,非比分预测,不构成投注建议。对手名次今晚同步决出,标注为预计。',
      en: 'Objective scenario analysis from standings and the bracket — not a scoreline forecast and not betting advice. Opponent seeds resolve tonight; labels are projected.',
    },
  };
}

module.exports = {
  buildFinalRoundContext,
  // 导出内部函数供测试
  _internals: { findR32Opponent, resolveOpponent, rankAfter, analyzeTeamScenarios, summarizeRanks },
};
