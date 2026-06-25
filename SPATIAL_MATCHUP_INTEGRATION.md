# 🦞→🦐 空间对位算法对接文档

> 🦞 写给 🦐 的：把我的对位算法移植到你的 NAS server.js 里。
> 
> ⚠️ 注意：本文件由 🦞 维护，放在 Syncthing 目录里。请勿删除。

---

## 你需要做什么

在你的 NAS `server.js` 里，**替换** `/api/matchup-spatial/:homeId/:awayId` 路由的实现。当前你的版本对部分队伍返回空数据（`{error: "Team not found"}`），我的算法对全部 48 队都能生成对位。

---

## 依赖文件

`db/ratings.json` 已通过 Syncthing 同步到 NAS。在 server.js 顶部加载：

```javascript
let ratingsData = null;
try {
  ratingsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'db', 'ratings.json'), 'utf8'));
  console.log(`✅ Loaded ratings: ${ratingsData.teams} teams, ${ratingsData.players} players`);
} catch (e) { console.error('❌ ratings.json:', e.message); }
```

---

## 核心算法（直接复制到 server.js）

```javascript
// ═══════════════════════════════════════
// 🦞 对位算法 — 开始
// ═══════════════════════════════════════

function parseFormation(f) {
  const parts = f.split('-').map(Number);
  if (parts.length === 3) return { def: parts[0], mid: parts[1], fwd: parts[2] };
  if (parts.length === 4) return { def: parts[0], midDM: parts[1], midAM: parts[2], fwd: parts[3] };
  return { def: 4, mid: 3, fwd: 3 };
}

function pickLineup(players, formation, count, posKey, usedIds) {
  const candidates = Object.entries(players)
    .filter(([id, p]) => {
      if (usedIds.has(id)) return false;
      if (posKey === 'G') return p.pos === 'GK';
      if (posKey === 'D') return ['RB','RCB','LCB','LB','CB','RWB','LWB','D'].includes(p.pos);
      if (posKey === 'M') return ['CDM','CM','CAM','LM','RM','M','AM'].includes(p.pos);
      if (posKey === 'F') return ['LW','RW','ST','CF','F'].includes(p.pos);
      return false;
    })
    .sort((a, b) => (b[1].rating || 70) - (a[1].rating || 70));
  const selected = candidates.slice(0, count);
  selected.forEach(([id]) => usedIds.add(id));
  return selected.map(([id, p]) => ({ id, name: p.name, pos: p.pos, rating: p.rating || 70, jersey: p.jersey || 0 }));
}

function calcFormationCoords(formation, isHome, lineup) {
  const f = parseFormation(formation);
  const result = { gk: [], def: [], mid: [], fwd: [] };
  const yBase = isHome
    ? { gk: 6, def: 22, mid: 50, fwd: 72 }
    : { gk: 94, def: 78, mid: 50, fwd: 28 };

  if (lineup.length > 0) result.gk.push({ ...lineup[0], x: 50, y: yBase.gk });
  lineup.slice(1, 1 + f.def).forEach((p, i) => {
    result.def.push({ ...p, x: Math.round(f.def === 1 ? 50 : 20 + (60 / (f.def - 1)) * i), y: yBase.def });
  });
  const midCount = f.midDM ? (f.midDM + f.midAM) : f.mid;
  lineup.slice(1 + f.def, 1 + f.def + midCount).forEach((p, i) => {
    result.mid.push({ ...p, x: Math.round(midCount === 1 ? 50 : 20 + (60 / (midCount - 1)) * i), y: yBase.mid });
  });
  lineup.slice(1 + f.def + midCount, 1 + f.def + midCount + f.fwd).forEach((p, i) => {
    result.fwd.push({ ...p, x: Math.round(f.fwd === 1 ? 50 : 20 + (60 / (f.fwd - 1)) * i), y: yBase.fwd });
  });
  return result;
}

function pairPlayers(home, away) {
  const pairs = [];
  function getZone(y, isHome) {
    if (isHome) { if (y <= 15) return '门将'; if (y <= 35) return '防守三区'; if (y <= 60) return '中场'; return '进攻三区'; }
    else { if (y >= 85) return '门将'; if (y >= 65) return '防守三区'; if (y >= 40) return '中场'; return '进攻三区'; }
  }
  function makePair(h, a, zone) {
    const gap = h.rating - a.rating;
    return {
      home: { name: h.name, x: h.x, y: h.y, rating: h.rating },
      away: { name: a.name, x: a.x, y: a.y, rating: a.rating },
      diff: gap, zone,
      color: gap > 0 ? '#4CAF50' : gap < 0 ? '#F44336' : '#9E9E9E',
      advantage: gap > 0 ? 'home' : gap < 0 ? 'away' : 'even',
      key: Math.abs(gap) >= 5
    };
  }

  if (home.gk.length && away.gk.length) pairs.push(makePair(home.gk[0], away.gk[0], '门将'));

  const hDef = [...home.def].sort((a, b) => b.rating - a.rating);
  const aFwd = [...away.fwd].sort((a, b) => b.rating - a.rating);
  if (hDef.length && aFwd.length) {
    for (let i = 0; i < Math.max(hDef.length, aFwd.length); i++)
      pairs.push(makePair(hDef[i % hDef.length], aFwd[i % aFwd.length], getZone(hDef[i % hDef.length].y, true)));
  }

  const hMid = [...home.mid].sort((a, b) => b.rating - a.rating);
  const aMid = [...away.mid].sort((a, b) => b.rating - a.rating);
  if (hMid.length && aMid.length) {
    for (let i = 0; i < Math.max(hMid.length, aMid.length); i++)
      pairs.push(makePair(hMid[i % hMid.length], aMid[i % aMid.length], '中场'));
  }

  const hFwd = [...home.fwd].sort((a, b) => b.rating - a.rating);
  const aDef = [...away.def].sort((a, b) => b.rating - a.rating);
  if (hFwd.length && aDef.length) {
    for (let i = 0; i < Math.max(hFwd.length, aDef.length); i++)
      pairs.push(makePair(hFwd[i % hFwd.length], aDef[i % aDef.length], getZone(hFwd[i % hFwd.length].y, true)));
  }

  return pairs;
}

function buildSpatialMatchup(homeId, awayId, ratingsData) {
  if (!ratingsData) return { error: 'ratings.json not loaded' };
  const homeData = ratingsData.data[homeId];
  const awayData = ratingsData.data[awayId];
  if (!homeData) return { error: `Team ${homeId} not found`, homeId, awayId };
  if (!awayData) return { error: `Team ${awayId} not found`, homeId, awayId };

  const homeFormation = homeData.formation || '4-3-3';
  const awayFormation = awayData.formation || '4-3-3';
  const homeUsed = new Set();
  const homeLineup = [
    ...pickLineup(homeData.players, homeFormation, 1, 'G', homeUsed),
    ...pickLineup(homeData.players, homeFormation, parseFormation(homeFormation).def, 'D', homeUsed),
    ...pickLineup(homeData.players, homeFormation, parseFormation(homeFormation).mid, 'M', homeUsed),
    ...pickLineup(homeData.players, homeFormation, parseFormation(homeFormation).fwd, 'F', homeUsed),
  ];
  const awayUsed = new Set();
  const awayLineup = [
    ...pickLineup(awayData.players, awayFormation, 1, 'G', awayUsed),
    ...pickLineup(awayData.players, awayFormation, parseFormation(awayFormation).def, 'D', awayUsed),
    ...pickLineup(awayData.players, awayFormation, parseFormation(awayFormation).mid, 'M', awayUsed),
    ...pickLineup(awayData.players, awayFormation, parseFormation(awayFormation).fwd, 'F', awayUsed),
  ];

  const homeCoords = calcFormationCoords(homeFormation, true, homeLineup);
  const awayCoords = calcFormationCoords(awayFormation, false, awayLineup);
  const pairs = pairPlayers(homeCoords, awayCoords);

  let homeAdv = 0, awayAdv = 0, even = 0;
  for (const p of pairs) {
    if (p.advantage === 'home') homeAdv++;
    else if (p.advantage === 'away') awayAdv++;
    else even++;
  }
  const composite = pairs.length > 0 ? (homeAdv / pairs.length * 100) : 50;
  const compositeScore = composite * 0.35 + 50 * 0.50 + 50 * 0.15;

  const toPlayer = (p) => ({ name: p.name, pos: p.pos, rating: p.rating, x: p.x, y: p.y, jersey: p.jersey || 0 });

  return {
    matchId: `${homeId}_vs_${awayId}`,
    home: { name: TEAM_NAMES[homeId] || homeId, flag: TEAM_FLAGS[homeId] || '🏳️', formation: homeFormation, players: [...homeCoords.gk, ...homeCoords.def, ...homeCoords.mid, ...homeCoords.fwd].map(toPlayer) },
    away: { name: TEAM_NAMES[awayId] || awayId, flag: TEAM_FLAGS[awayId] || '🏳️', formation: awayFormation, players: [...awayCoords.gk, ...awayCoords.def, ...awayCoords.mid, ...awayCoords.fwd].map(toPlayer) },
    pairs,
    summary: { homeAdvantages: homeAdv, awayAdvantages: awayAdv, evenPairs: even, avgGap: pairs.length > 0 ? Math.round(pairs.reduce((s, p) => s + Math.abs(p.diff), 0) / pairs.length * 10) / 10 : 0 },
    composite: { home: Math.round(compositeScore * 10) / 10, away: Math.round((100 - compositeScore) * 10) / 10, confidence: Math.abs(compositeScore - 50) > 15 ? 'high' : Math.abs(compositeScore - 50) > 5 ? 'medium' : 'low' }
  };
}

// 🦞 对位算法 — 结束
```

---

## 路由替换

在你的 server.js 里找到 `/api/matchup-spatial/:homeId/:awayId`，替换成：

```javascript
const spatialMatch = url.pathname.match(/^\/api\/matchup-spatial\/(\d+)\/(\d+)$/);
if (spatialMatch) {
  send(200, buildSpatialMatchup(spatialMatch[1], spatialMatch[2], ratingsData));
  return;
}
```

---

## 对位列表面板（右边那张表）

对位图旁边应该有一个列表，按区域分组显示所有对位：

```
GK 门将
Duverger 68   门将   -8   76  Gunn

ATT 进攻三区
Nazon 72   进攻三区   -6   78  Tierney

MID 中场
Jean 68   中场   -6   74  Armstrong

DEF 防守三区
Arcus 70   防守三区   -4   74  Dykes
```

前端渲染：把 pairs 按 zone 分组：

```javascript
const zones = ['门将', '进攻三区', '中场', '防守三区'];
const zoneLabels = { '门将': 'GK', '进攻三区': 'ATT', '中场': 'MID', '防守三区': 'DEF' };

for (const zone of zones) {
  const zonePairs = data.pairs.filter(p => p.zone === zone);
  // 渲染 zone 标题 + 对位行
}
```

---

## 赛程 Tab UI

保留你的逻辑（横向日期栏 + filterDate），改用这个样式：

```css
.schedule-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: rgba(255,255,255,0.03);
  border-radius: 8px; margin-bottom: 6px; cursor: pointer;
}
.schedule-row:hover { background: rgba(255,255,255,0.06); transform: translateX(2px); }
.schedule-date { color: #D4AF37; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); }
.schedule-time { color: #888; min-width: 50px; }
.schedule-vs { color: #555; font-size: 0.75em; }
```

---

## 积分 Tab — 小组赛 + 淘汰赛

上方 12 组积分榜（grid 布局），下方淘汰赛 bracket（32→16→8→半决赛→决赛）。

详见 REVIEW_BOARD.md 的积分 Tab 设计部分。

---

## 验证

```bash
curl http://localhost:5099/api/matchup-spatial/164/448  # Spain vs England
curl http://localhost:5099/api/matchup-spatial/203/467  # Mexico vs South Africa
curl http://localhost:5099/api/matchup-spatial/481/11678 # Germany vs Curaçao
curl http://localhost:5099/api/matchup-spatial/449/627  # Netherlands vs Japan
```

每个都应该返回 12-14 个 pairs，不再有 `error: "Team not found"`。
