# 对位阵型图技术方案

## 最终效果示意

```
┌─────────────────────────────────────────────┐
│           🇺🇸 USA 4-3-3          │          │
│                                   │          │
│      Pulisic(8.2)  Pepi(7.5)  Weah(7.1)    │
│           ⚡────────⚡────────⚡              │
│                                   │          │
│   McKennie(7.8)  Adams(7.3)  Reyna(7.0)    │
│        ⚡──────────⚡──────────⚡             │
│                                   │          │
│  Robinson(7.2) Ream(7.0) Richards(7.4) Dest(7.6)│
│      ⚡───────⚡────────⚡────────⚡           │
│                                   │          │
│          Turner(7.0)              │          │
│                                   │          │
│═══════════════ 对位连线 ═══════════════════ │
│                                   │          │
│  ──8.2 vs 6.5──  ──7.5 vs 7.0──  ──7.1 vs 6.3── │
│                                   │          │
│      Almiron(7.8)  xxx(7.0)  xxx(6.5)       │
│           ⚡────────⚡────────⚡              │
│                                   │          │
│    xxx(7.5)  xxx(7.2)  xxx(6.8)            │
│        ⚡──────────⚡──────────⚡             │
│                                   │          │
│   xxx(7.2) xxx(6.8) xxx(7.0) xxx(6.5)     │
│      ⚡───────⚡────────⚡────────⚡           │
│                                   │          │
│          Fernandez(6.8)           │          │
│                                   │          │
│           🇵🇾 Paraguay 4-4-2      │          │
└─────────────────────────────────────────────┘
```

---

## 一、对位匹配算法（核心）

### 1.1 位置等价表

两队可能用不同阵型，需要按**场上占据的区域**做等价映射：

```
主场进攻方向 →→→→→→→→→→→→→→→→→→

美国 4-3-3                         巴拉圭 4-4-2
─────────                         ─────────
ST (9)      ←→ 对位 →  CB (4,5)        前锋对中卫
LW (11)     ←→ 对位 →  RB (2)          左边锋对右后卫
RW (7)      ←→ 对位 →  LB (3)          右边锋对左后卫
LCM (8)     ←→ 对位 →  RCM (8)         中场同区域
CM (6)      ←→ 对位 →  CDM (6)         中场中路
RCM (8)     ←→ 对位 →  LCM (8)         中场同区域
LB (3)      ←→ 对位 →  RW/RM (7)       左后卫对右边锋/右中场
LCB (4)     ←→ 对位 →  ST (9)          左中卫对前锋
RCB (5)     ←→ 对位 →  ST (9)          右中卫对前锋
RB (2)      ←→ 对位 →  LW/LM (11)      右后卫对左边锋/左中场
GK (1)      ←→ 对位 →  GK (1)          门将对门将
```

### 1.2 通用对位规则

无论阵型如何，按以下优先级匹配：

```javascript
function pairPlayers(homeFormation, awayFormation, homeRoster, awayRoster) {
  const pairs = [];
  
  // 规则1: 前锋线 → 对方后卫线
  // 攻方从左到右排列前锋，守方从右到左排列后卫（因为在对方半场相遇）
  const homeForwards = getPlayersByLine(homeFormation, 'forward');  // ST, LW, RW, CF
  const awayDefenders = getPlayersByLine(awayFormation, 'defender'); // CB, RB, LB
  // 镜像匹配: 攻方最左的前锋(LW) vs 守方最右的后卫(RB)
  for (let i = 0; i < Math.max(homeForwards.length, awayDefenders.length); i++) {
    pairs.push({
      home: homeForwards[i],
      away: awayDefenders[awayDefenders.length - 1 - i],
      zone: '进攻三区'
    });
  }
  
  // 规则2: 中场线 → 对方中场线（同位置直接对位）
  const homeMidfielders = getPlayersByLine(homeFormation, 'midfield');
  const awayMidfielders = getPlayersByLine(awayFormation, 'midfield');
  for (let i = 0; i < Math.max(homeMidfielders.length, awayMidfielders.length); i++) {
    pairs.push({
      home: homeMidfielders[i],
      away: awayMidfielders[i],
      zone: '中场'
    });
  }
  
  // 规则3: 后卫线 → 对方前锋线（镜像规则1）
  const homeDefenders = getPlayersByLine(homeFormation, 'defender');
  const awayForwards = getPlayersByLine(awayFormation, 'forward');
  for (let i = 0; i < Math.max(homeDefenders.length, awayForwards.length); i++) {
    pairs.push({
      home: homeDefenders[i],
      away: awayForwards[awayForwards.length - 1 - i],
      zone: '防守三区'
    });
  }
  
  // 规则4: 门将对门将
  pairs.push({
    home: getPlayerByPos(homeRoster, 'G'),
    away: getPlayerByPos(awayRoster, 'G'),
    zone: '门将'
  });
  
  return pairs;
}
```

### 1.3 按阵型解析位置线

```javascript
function getPlayersByLine(formation, line) {
  // 将阵型字符串解析为位置数组
  // "4-3-3" → 
  //   forward:  [LW, ST, RW]     (最后一段数字)
  //   midfield: [LCM, CM, RCM]   (中间段数字)
  //   defender: [LB, LCB, RCB, RB] (第一段数字)
  
  const parts = formation.split('-').map(Number);
  
  switch(line) {
    case 'forward':
      return getPlayersForCount(parts[parts.length - 1], 'F');
    case 'midfield':
      return getPlayersForCount(parts[1], 'M');
    case 'defender':
      return getPlayersForCount(parts[0], 'D');
  }
}

// 阵型解析示例:
// "4-3-3"  → D:4, M:3, F:3
// "4-4-2"  → D:4, M:4, F:2
// "3-5-2"  → D:3, M:5, F:2
// "4-2-3-1" → D:4, M(DM):2, M(AM):3, F:1
```

---

## 二、阵型图布局坐标计算

### 2.1 坐标系统

将整个画布分为三个区域：

```
┌──────────────────────────────────────────────┐
│   上半区（主队进攻方向 →→→）x: 0-50%           │
│   ├── 门将线:    y=85%                       │
│   ├── 后卫线:    y=70%                       │
│   ├── 中场线:    y=45%                       │
│   ├── 前锋线:    y=20%                       │
│   │                                          │
│ ═══════════ 中线（对位连线区）y=50% ═══════════ │
│   │                                          │
│   ├── 前锋线:    y=80% (从对方球门方向看)      │
│   ├── 中场线:    y=55%                       │
│   ├── 后卫线:    y=30%                       │
│   ├── 门将线:    y=15%                       │
│   下半区（客队进攻方向 ←←←）x: 50-100%         │
└──────────────────────────────────────────────┘
```

### 2.2 位置坐标计算函数

```javascript
function calcPositionCoords(formation, isHome, canvasWidth, canvasHeight) {
  const parts = formation.split('-').map(Number);
  const defCount = parts[0];
  const midCount = parts[1];
  const fwdCount = parts[2]; // 简化，不支持 4-2-3-1
  
  if (isHome) {
    return {
      gk:    [{ x: 50, y: 88 }],
      def:   spreadHorizontal(defCount, 72, canvasWidth),
      mid:   spreadHorizontal(midCount, 48, canvasWidth),
      fwd:   spreadHorizontal(fwdCount, 24, canvasWidth),
    };
  } else {
    return {
      gk:    [{ x: 50, y: 12 }],
      def:   spreadHorizontal(defCount, 28, canvasWidth),
      mid:   spreadHorizontal(midCount, 52, canvasWidth),
      fwd:   spreadHorizontal(fwdCount, 76, canvasWidth),
    };
  }
}

function spreadHorizontal(count, yPct, width) {
  // 将 count 个球员均匀分布在同一高度
  const step = 80 / (count + 1); // 左右留 10% 边距
  return Array.from({length: count}, (_, i) => ({
    x: 10 + step * (i + 1),
    y: yPct
  }));
}
```

---

## 三、对位连线渲染

### 3.1 连线规则

```javascript
function renderMatchupLine(pair, i) {
  // 每对对位的两个球员之间画线
  // 连线位于两人 y 坐标的中点
  // 显示评分对比标签

  const homePlayer = pair.home;
  const awayPlayer = pair.away;
  
  return {
    line: {
      from: { x: homePlayer.x, y: homePlayer.y },
      to:   { x: awayPlayer.x, y: awayPlayer.y },
    },
    label: {
      position: midpoint(homePlayer, awayPlayer),
      text: `${homePlayer.rating} vs ${awayPlayer.rating}`,
    },
    advantage: compareRatings(homePlayer.rating, awayPlayer.rating),
    // advantage → 'home' | 'away' | 'even'
    // 渲染为：绿色连线 = 主队优势，红色连线 = 客队优势，灰色 = 均势
  };
}
```

### 3.2 连线样式

| 状态 | 颜色 | 线宽 | 效果 |
|------|------|------|------|
| 主队优势 (差值 ≥ 1.0) | 🟢 绿色 | 3px | 实线 + 发光 |
| 客队优势 (差值 ≥ 1.0) | 🔴 红色 | 3px | 实线 + 发光 |
| 接近均势 (差值 0.5-1.0) | 🟡 黄色 | 2px | 虚线 |
| 完全均势 (差值 < 0.5) | ⚪ 灰色 | 1px | 虚线 |
| 主队评分缺失 | 🔵 蓝色 | 1px | 点线（待定） |
| 客队评分缺失 | 🟠 橙色 | 1px | 点线（待定） |

---

## 四、需要新增/修改的 API

### 4.1 获取球队首发阵容

```
GET /api/team/:teamId/lineup?matchId=760417
```

返回确认首发的 11 人 + 阵型：

```json
{
  "teamId": "660",
  "matchId": "760417",
  "formation": "4-3-3",
  "lineup": [
    { "jersey": 1,  "name": "Turner",       "pos": "GK",  "rating": 7.0 },
    { "jersey": 2,  "name": "Dest",         "pos": "RB",  "rating": 7.6 },
    { "jersey": 3,  "name": "Richards",     "pos": "RCB", "rating": 7.4 },
    { "jersey": 13, "name": "Ream",         "pos": "LCB", "rating": 7.0 },
    { "jersey": 5,  "name": "A. Robinson",  "pos": "LB",  "rating": 7.2 },
    { "jersey": 8,  "name": "McKennie",     "pos": "RCM", "rating": 7.8 },
    { "jersey": 4,  "name": "Adams",        "pos": "CDM", "rating": 7.3 },
    { "jersey": 7,  "name": "Reyna",        "pos": "LCM", "rating": 7.0 },
    { "jersey": 21, "name": "Weah",         "pos": "RW",  "rating": 7.1 },
    { "jersey": 9,  "name": "Pepi",         "pos": "ST",  "rating": 7.5 },
    { "jersey": 10, "name": "Pulisic",      "pos": "LW",  "rating": 8.2 }
  ],
  "substitutes": [
    { "jersey": 20, "name": "Balogun", "pos": "F", "rating": 7.3 },
    { "jersey": 11, "name": "Aaronson", "pos": "M", "rating": 7.1 }
  ],
  "confirmed": true,
  "source": "espn_lineup"
}
```

### 4.2 对位阵型数据 API

```
GET /api/matchup/:matchId/formation
```

返回可直接渲染的对位数据：

```json
{
  "matchId": "760417",
  "home": {
    "team": "USA",
    "formation": "4-3-3",
    "players": [ /* 11 人坐标 + 评分 */ ]
  },
  "away": {
    "team": "Paraguay",
    "formation": "4-4-2",
    "players": [ /* 同上 */ ]
  },
  "pairs": [
    {
      "home": { "name": "Pulisic", "x": 20, "y": 24, "rating": 8.2 },
      "away": { "name": "xxx",     "x": 80, "y": 76, "rating": 6.5 },
      "advantage": "home",
      "gap": 1.7,
      "label": "8.2 vs 6.5"
    }
    // ... 11 组对位
  ],
  "summary": {
    "homeAdvantagePairs": 6,
    "awayAdvantagePairs": 2,
    "evenPairs": 3,
    "avgGap": 0.8
  }
}
```

---

## 五、球员评分来源（需要接入）

### 当前状态：评分字段存在但值缺失

球队 roster 里没有 rating 字段。需要至少一个评分来源。

### 建议接入方案（按难度排序）

**方案 A：FIFA 25 评分（推荐起步）**
- 数据最稳定，不受近期状态影响
- 可以从 EA Sports 公开数据获取
- 美国队示例：Pulisic 83, McKennie 80, Dest 78, Turner 75
- 获取方式：爬取 sofifa.com 或使用社区 API

**方案 B：Whoscored/SofaScore 赛季评分**
- 反映当前赛季真实状态
- 需要 API 或爬取
- 作为动态评分与 FIFA 评分取加权均值

**方案 C：从盘口反推**
- 从赔率差异反推双方实力差，均摊到球员
- 最不准确，仅作 fallback

### 评分数据结构

```javascript
const PLAYER_RATINGS = {
  "252974": { fifa: 70, whoscored: 6.7, position: "GK" },  // Matt Freese
  "225607": { fifa: 83, whoscored: 7.4, position: "LW" },  // Pulisic
  // ... 
};
```

建议先做一个 `ratings.json` 静态文件放 48 队核心球员的评分，后续再考虑动态更新。

---

## 六、实现优先级

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 在 roster 里加入 rating 字段（静态 JSON） | FIFA 数据 |
| 2 | `/api/team/:id/lineup` 返回首发 11 人 | ESPN lineup |
| 3 | 前端渲染两个独立阵型图（当前已有，只需标准化） | - |
| 4 | 对位匹配算法（按位置等价表） | 步骤 2 |
| 5 | 连线渲染 + 颜色编码 | 步骤 3,4 |
| 6 | `/api/matchup/:id/formation` 一体化 API | 步骤 1-5 |
