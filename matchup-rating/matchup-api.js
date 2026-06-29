// matchup-api.js — 对位阵型 API 端点
// 集成方式: 在 server.js 中 require('./matchup-api') 或直接复制到 server.js

const fs = require('fs');

// ═══════════════════════════════════════════
// 核心：位置等价表 + 对位匹配算法
// ═══════════════════════════════════════════

// 阵型解析: "4-3-3" → { def: 4, mid: 3, fwd: 3 }
function parseFormation(f) {
  const parts = f.split('-').map(Number);
  if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
  if (parts.length === 4) return {
    def: parts[0],
    midDM: parts[1],
    midAM: parts[2],
    mid: parts[1] + parts[2],
    fwd: parts[3]
  };
  return { def: 4, mid: 3, fwd: 3 }; // fallback
}

// 从 roster 中按位置分组，取评分最高的 N 人
function pickLineup(roster, ratings, formation, count, posKey, usedIds = new Set()) {
  // roster: [{id, name, pos, jersey}] from ESPN
  // ratings: {playerId: {name, pos, rating}} from ratings.json
  // formation: "4-3-3"
  // count: 需要几个人
  // posKey: 'G' | 'D' | 'M' | 'F'
  
  let candidates = roster
    .filter(p => {
      if (usedIds.has(p.id)) return false;
      const r = ratings[p.id];
      if (!r) return false;
      // 位置匹配
      if (posKey === 'G') return p.pos === 'G' || r.pos === 'GK';
      if (posKey === 'D') return p.pos === 'D' || ['RB','RCB','LCB','LB','CB','RWB','LWB','D'].includes(r.pos);
      if (posKey === 'M') return p.pos === 'M' || ['CDM','RCM','LCM','CAM','CM','RM','LM','M'].includes(r.pos);
      if (posKey === 'F') return p.pos === 'F' || ['ST','LW','RW','CF','F'].includes(r.pos);
      return false;
    })
    .map(p => ({
      id: p.id,
      name: ratings[p.id]?.name || p.name,
      pos: ratings[p.id]?.pos || p.pos,
      jersey: p.jersey,
      rating: ratings[p.id]?.rating || 65
    }))
    .sort((a, b) => b.rating - a.rating);

  candidates = candidates.slice(0, count);

  if (candidates.length < count && posKey !== 'G') {
    const selectedIds = new Set(candidates.map(p => p.id));
    const fallback = roster
      .filter(p => !usedIds.has(p.id) && !selectedIds.has(p.id))
      .filter(p => ratings[p.id] && ratings[p.id].pos !== 'GK')
      .slice(0, count - candidates.length)
      .map(p => ({
        id: p.id,
        name: ratings[p.id]?.name || p.name,
        pos: posKey === 'D' ? 'CB' : posKey === 'M' ? 'CM' : 'ST',
        jersey: p.jersey,
        rating: ratings[p.id]?.rating || 65
      }));
    candidates = [...candidates, ...fallback];
  }

  candidates.forEach(p => usedIds.add(p.id));
  return candidates;
}

// 横向均匀分布坐标
function spreadH(count, yPct) {
  const step = 80 / (count + 1);
  return Array.from({ length: count }, (_, i) => ({
    x: 10 + step * (i + 1),
    y: yPct
  }));
}

// 计算阵型图坐标
function calcFormationCoords(formation, isHome, lineup) {
  const f = parseFormation(formation);
  const gk = lineup.filter(p => p.pos === 'GK' || p.pos === 'G');
  const def = lineup.filter(p => ['RB','RCB','LCB','LB','CB','RWB','LWB','D'].includes(p.pos));
  const mid = lineup.filter(p => ['CDM','RCM','LCM','CAM','CM','RM','LM','M'].includes(p.pos));
  const fwd = lineup.filter(p => ['ST','LW','RW','CF','F'].includes(p.pos));

  if (isHome) {
    return {
      gk: assignCoords(gk, 50, 90),
      def: assignCoords(def, spreadH(def.length, 72)),
      mid: assignCoords(mid, spreadH(mid.length, 50)),
      fwd: assignCoords(fwd, spreadH(fwd.length, 28)),
    };
  } else {
    return {
      gk: assignCoords(gk, 50, 10),
      def: assignCoords(def, spreadH(def.length, 28)),
      mid: assignCoords(mid, spreadH(mid.length, 50)),
      fwd: assignCoords(fwd, spreadH(fwd.length, 72)),
    };
  }
}

function assignCoords(players, ...args) {
  // 多参数形式: assignCoords(players, x, y) 或 assignCoords(players, coordsArray)
  if (args.length === 2 && typeof args[0] === 'number') {
    return players.map(p => ({ ...p, x: args[0], y: args[1] }));
  }
  const coords = args[0] || [];
  return players.map((p, i) => ({
    ...p,
    x: coords[i]?.x ?? 50,
    y: coords[i]?.y ?? 50
  }));
}

// ═══════════════════════════════════════════
// 对位匹配算法
// ═══════════════════════════════════════════

function pairPlayers(homeCoords, awayCoords) {
  const pairs = [];
  
  // 门将对门将
  if (homeCoords.gk.length > 0 && awayCoords.gk.length > 0) {
    pairs.push(makePair(homeCoords.gk[0], awayCoords.gk[0], '门将'));
  }

  // 主队前锋 ↔ 客队后卫（镜像匹配）
  pairLines(homeCoords.fwd, awayCoords.def, pairs, '进攻三区');
  
  // 中场对中场
  pairLines(homeCoords.mid, awayCoords.mid, pairs, '中场');
  
  // 主队后卫 ↔ 客队前锋（镜像匹配）
  pairLines(homeCoords.def, awayCoords.fwd, pairs, '防守三区');

  return pairs;
}

function pairLines(homePlayers, awayPlayers, pairs, zone) {
  if (!homePlayers.length || !awayPlayers.length) return;

  // The full-pitch renderer keeps both teams in the same x coordinate frame.
  // Pair by the nearest horizontal lane; reversing array order creates
  // misleading cross-pitch diagonals after the old x-mirroring was removed.
  const homeByLane = [...homePlayers].sort((a, b) => (a.x ?? 50) - (b.x ?? 50));
  const awayByLane = [...awayPlayers].sort((a, b) => (a.x ?? 50) - (b.x ?? 50));
  const proportionalIndex = (index, sourceLength, targetLength) => {
    if (targetLength <= 1 || sourceLength <= 1) return 0;
    return Math.round(index * (targetLength - 1) / (sourceLength - 1));
  };

  if (homeByLane.length >= awayByLane.length) {
    for (let i = 0; i < homeByLane.length; i++) {
      const hp = homeByLane[i];
      const ap = awayByLane[proportionalIndex(i, homeByLane.length, awayByLane.length)];
      pairs.push(makePair(hp, ap, zone));
    }
  } else {
    for (let i = 0; i < awayByLane.length; i++) {
      const ap = awayByLane[i];
      const hp = homeByLane[proportionalIndex(i, awayByLane.length, homeByLane.length)];
      pairs.push(makePair(hp, ap, zone));
    }
  }
}

function makePair(home, away, zone) {
  const gap = (home.rating || 65) - (away.rating || 65);
  let advantage = 'even';
  if (gap >= 1.0) advantage = 'home';
  else if (gap <= -1.0) advantage = 'away';
  
  return {
    home: { name: home.name, jersey: home.jersey, x: home.x, y: home.y, rating: home.rating || 65 },
    away: { name: away.name, jersey: away.jersey, x: away.x, y: away.y, rating: away.rating || 65 },
    zone,
    advantage,
    gap: Math.round(gap * 10) / 10,
    label: `${home.rating || 65} vs ${away.rating || 65}`
  };
}

// ═══════════════════════════════════════════
// 教练对比（从已有 coach-compare 复用）
// ═══════════════════════════════════════════

function getCoachComparison(homeTeamId, awayTeamId) {
  // 调用已有的 coach-compare 逻辑
  // 这里返回简化版，完整版由 coach-compare API 提供
  return {
    note: "调用 /api/coach-compare/{home}/{away} 获取完整对比"
  };
}

// ═══════════════════════════════════════════
// 综合评分计算（简化版）
// ═══════════════════════════════════════════

function calcCompositeScore(pairs, coachDiff, oddsData) {
  // 球员对位分（35%）
  let homeAdv = 0, awayAdv = 0, total = 0;
  for (const p of pairs) {
    if (p.advantage === 'home') homeAdv++;
    if (p.advantage === 'away') awayAdv++;
    total++;
  }
  const playerScore = total > 0 ? (homeAdv / total * 100) : 50;
  
  // 盘口分（50%）
  let marketScore = 50;
  if (oddsData?.impliedProb) {
    const hp = parseFloat(oddsData.impliedProb.home) || 50;
    marketScore = hp;
  }
  
  // 教练分（15%）- 简化
  const coachScore = 50; // 需要 coach-compare API 的实际数据
  
  const composite = playerScore * 0.35 + marketScore * 0.50 + coachScore * 0.15;
  
  return {
    home: Math.round(composite * 10) / 10,
    away: Math.round((100 - composite) * 10) / 10,
    confidence: Math.abs(composite - 50) > 15 ? 'high' : Math.abs(composite - 50) > 5 ? 'medium' : 'low',
    breakdown: {
      playerScore: Math.round(playerScore * 10) / 10,
      marketScore: Math.round(marketScore * 10) / 10,
      coachScore: Math.round(coachScore * 10) / 10
    }
  };
}

// ═══════════════════════════════════════════
// 导出：API 端点处理函数
// ═══════════════════════════════════════════

function handleMatchupFormation(req, matchId, homeTeam, awayTeam, ratingsData, oddsData, coachCompare) {
  const homeRoster = homeTeam.roster || [];
  const awayRoster = awayTeam.roster || [];
  const homeRatings = ratingsData?.data?.[homeTeam.id] || {};
  const awayRatings = ratingsData?.data?.[awayTeam.id] || {};
  const homeFormation = homeRatings.formation || '4-3-3';
  const awayFormation = awayRatings.formation || '4-3-3';

  // 按阵型选首发
  const homeUsed = new Set();
  const awayUsed = new Set();
  const homeLineup = [
    ...pickLineup(homeRoster, homeRatings.players || {}, homeFormation, 1, 'G', homeUsed),
    ...pickLineup(homeRoster, homeRatings.players || {}, homeFormation, parseFormation(homeFormation).def, 'D', homeUsed),
    ...pickLineup(homeRoster, homeRatings.players || {}, homeFormation, parseFormation(homeFormation).mid, 'M', homeUsed),
    ...pickLineup(homeRoster, homeRatings.players || {}, homeFormation, parseFormation(homeFormation).fwd, 'F', homeUsed),
  ];
  const awayLineup = [
    ...pickLineup(awayRoster, awayRatings.players || {}, awayFormation, 1, 'G', awayUsed),
    ...pickLineup(awayRoster, awayRatings.players || {}, awayFormation, parseFormation(awayFormation).def, 'D', awayUsed),
    ...pickLineup(awayRoster, awayRatings.players || {}, awayFormation, parseFormation(awayFormation).mid, 'M', awayUsed),
    ...pickLineup(awayRoster, awayRatings.players || {}, awayFormation, parseFormation(awayFormation).fwd, 'F', awayUsed),
  ];

  // 计算坐标
  const homeCoords = calcFormationCoords(homeFormation, true, homeLineup);
  const awayCoords = calcFormationCoords(awayFormation, false, awayLineup);

  // 对位配对
  const pairs = pairPlayers(homeCoords, awayCoords);

  // 统计
  let homeAdvCount = 0, awayAdvCount = 0, evenCount = 0;
  for (const p of pairs) {
    if (p.advantage === 'home') homeAdvCount++;
    else if (p.advantage === 'away') awayAdvCount++;
    else evenCount++;
  }

  // 综合评分
  const composite = calcCompositeScore(pairs, coachCompare, oddsData);

  return {
    matchId,
    home: {
      team: homeTeam.name || homeTeam.shortName,
      teamId: homeTeam.id,
      formation: homeFormation,
      lineup: homeLineup.map(p => ({ id: p.id, name: p.name, pos: p.pos, jersey: p.jersey, rating: p.rating, x: p.x, y: p.y })),
      gk: homeCoords.gk,
      def: homeCoords.def,
      mid: homeCoords.mid,
      fwd: homeCoords.fwd,
    },
    away: {
      team: awayTeam.name || awayTeam.shortName,
      teamId: awayTeam.id,
      formation: awayFormation,
      lineup: awayLineup.map(p => ({ id: p.id, name: p.name, pos: p.pos, jersey: p.jersey, rating: p.rating, x: p.x, y: p.y })),
      gk: awayCoords.gk,
      def: awayCoords.def,
      mid: awayCoords.mid,
      fwd: awayCoords.fwd,
    },
    pairs,
    summary: {
      homeAdvantagePairs: homeAdvCount,
      awayAdvantagePairs: awayAdvCount,
      evenPairs: evenCount,
      avgGap: pairs.length > 0 ? Math.round(pairs.reduce((s, p) => s + Math.abs(p.gap), 0) / pairs.length * 10) / 10 : 0
    },
    composite
  };
}

module.exports = {
  handleMatchupFormation,
  pairPlayers,
  calcFormationCoords,
  parseFormation,
  pickLineup,
  spreadH,
  calcCompositeScore
};
