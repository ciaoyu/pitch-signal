
在教练分析 Tab 底部，自动拉取相关新闻：

**搜索策略**：
1. 比赛双方教练名 → 教练新闻
2. 比赛双方球队名 → 球队动态
3. 关键球员名 → 球员新闻（伤病/状态/转会传闻）

**新闻卡片格式**：

```
┌─────────────────────────────────────┐
│  📰 赛前新闻                         │
│                                     │
│  🔴 Pulisic 训练中脚踝不适，出场存疑  │
│     The Athletic · 3小时前           │
│     "Pulisic 在周三训练中扭伤脚踝，   │
│      队医正在评估其出场可能性..."      │
│                                     │
│  🟡 巴拉圭主教练暗示变阵 3-5-2        │
│     ESPN Deportes · 6小时前          │
│                                     │
│  🟢 美国队全员合练，阵容齐整          │
│     US Soccer · 1天前               │
└─────────────────────────────────────┘
---

### 2.4 📰 新闻嵌入策略

新闻不独立成栏目，而是嵌入在现有内容中：

**1. 赛程 Tab — 比赛卡片下方**
- 已结束比赛：赛后总结/比分分析/最佳球员新闻（1-2 条摘要）
- 进行中比赛：实时事件提醒（进球/红牌/伤病）
- 未开始比赛：赛前动态/阵容消息/教练发言
- 点击新闻条目可展开详情

**2. 比赛详情 Modal — 📰 新闻 Tab**（见 2.2 Tab 6）

**3. 分析 Tab — 教练新闻聚合**

**搜索策略**（Tavily API）：
- 比赛双方球队名（如 "USA vs Paraguay"）
- 双方教练名
- 关键球员名
- 加上比赛状态限定词（"preview" / "live" / "result"）

**重要性标记**：
- 🔴 重大（伤病/停赛/首发变动）
- 🟡 中等（战术变化/教练发言）
- 🟢 一般（训练/氛围/历史回顾）

---

### 2.6 🏆 球队详情页

球队详情页是球队 Tab 的第二层，点击球队卡片后进入。包含球队的完整画像。

指标体系参考 SofaScore / WhoScored / FBref / Opta 行业标准。

#### 页面结构

```
┌─────────────────────────────────────┐
│  ← 返回                🇺🇸 USA       │
│                                    │
│  ┌─────────────────────────────────┐
│  │  📊 球队概况                     │
│  │                                 │
│  │  世界排名: #12    FIFA 积分: 1684│
│  │  市值: €2.1亿    平均年龄: 25.8  │
│  │  小组: A组  战绩: 2胜1平0负      │
│  │  积分: 7  进球:5  失球:1  净胜:+4│
│  └─────────────────────────────────┘
│                                    │
│  ┌─────────────────────────────────┐
│  │  📈 近 10 场表现                 │
│  │                                 │
│  │  战绩: 6胜3平1负 (胜率 60%)      │
│  │                                 │
│  │  ── 进攻 ──                      │
│  │  场均进球: 1.8                   │
│  │  场均 xG: 1.65 · 实际-xG: +0.15 │
│  │  场均射门: 14.2 · 射正率: 42%    │
│  │  场均角球: 5.3                   │
│  │  定位球进球占比: 28%             │
│  │                                 │
│  │  ── 控球 ──                      │
│  │  场均控球率: 54%                 │
│  │  传球成功率: 86%                 │
│  │  场均关键传球: 9.2               │
│  │  传中成功率: 28%                 │
│  │  长传成功率: 52%                 │
│  │                                 │
│  │  ── 防守 ──                      │
│  │  场均失球: 0.7                   │
│  │  场均 xGA: 0.85 · 实际-xGA: -0.15│
│  │  场均抢断: 18.5 · 成功率: 67%    │
│  │  场均拦截: 12.3                  │
│  │  场均解围: 15.8                  │
│  │  零封场次: 5/10                  │
│  │                                 │
│  │  ── 纪律 ──                      │
│  │  场均犯规: 11.2                  │
│  │  场均黄牌: 1.8                   │
│  │  场均红牌: 0.1                   │
│  │                                 │
│  │  ── 对抗 ──                      │
│  │  对抗成功率: 52%                 │
│  │  空中对抗成功率: 58%             │
│  │  盘带成功率: 61%                 │
│  │                                 │
│  │  趋势: ↗ 近 5 场 xG 上升，防守稳定│
│  └─────────────────────────────────┘
│                                    │
│  ┌─────────────────────────────────┐
│  │  🔄 球队动态                     │
│  │                                 │
│  │  🏥 伤病/停赛:                   │
│  │  · Adams (CM, 膝伤) 预计缺席     │
│  │  · McKennie (CM, 黄牌累积) 停赛  │
│  │                                 │
│  │  ✅ 恢复:                        │
│  │  · Reyna (LCM) 已恢复合练        │
│  │                                 │
│  │  📋 变动:                        │
│  │  · 新教练 Berhalter 上任 3 个月  │
│  │  · 阵型从 4-4-2 改为 4-3-3       │
│  │  · 新增归化球员 Balogun          │
│  │                                 │
│  │  ⚠️ 值得关注:                    │
│  │  · 近 3 场控球率下降 5%          │
│  │  · 定位球防守弱点（3/5 丢球）    │
│  │  · 右路防守薄弱（对手 45%进攻走右）│
│  └─────────────────────────────────┘
│                                    │
│  ┌─────────────────────────────────┐
│  │  🏆 大赛表现                     │
│  │                                 │
│  │  本届世界杯:                     │
│  │  · 小组赛第 1 轮: USA 2-0 BOL   │
│  │  · 小组赛第 2 轮: USA 1-1 PAN   │
│  │  · 小组赛第 3 轮: USA 2-0 URU   │
│  │                                 │
│  │  热身赛 (世界杯前 3 个月):        │
│  │  · USA 3-1 JAM (主场)           │
│  │  · USA 0-0 COL (客场)           │
│  │  · USA 2-1 GER (中立场)         │
│  │                                 │
│  │  世界杯历史:                     │
│  │  · 参赛次数: 12                 │
│  │  · 最佳成绩: 八强 (2002)         │
│  │  · 上届成绩: 十六强              │
│  │  · 累计战绩: 33场 8胜6平19负     │
│  └─────────────────────────────────┘
│                                    │
│  ┌─────────────────────────────────┐
│  │  🧠 教练                         │
│  │  ...（现有教练卡片）              │
│  └─────────────────────────────────┘
│                                    │
│  ┌─────────────────────────────────┐
│  │  👥 大名单                       │
│  │  ...（现有按位置分组列表）        │
│  └─────────────────────────────────┘
└─────────────────────────────────────┘
```

#### 数据指标定义（行业标准）

参考来源：SofaScore、WhoScored、FBref、Opta

##### 进攻数据

| 指标 | 定义 | 来源 |
|------|------|------|
| Goals Scored | 进球数 | ESPN ✅ |
| xG (Expected Goals) | 预期进球 | FBref ⏳ |
| Goals - xG | 实际进球 vs 预期（正=高效，负=运气差）| 计算 ⏳ |
| Shots per Game | 场均射门 | ESPN ⏳ |
| Shot on Target % | 射正率 | ESPN ⏳ |
| Corners per Game | 场均角球 | ESPN ⏳ |
| Set Piece Goals % | 定位球进球占比 | ESPN ⏳ |
| Big Chances Created | 大机会创造（单刀/近距离射门）| StatsBomb ⏳ |

##### 控球数据

| 指标 | 定义 | 来源 |
|------|------|------|
| Possession % | 控球率 | ESPN ✅ |
| Pass Accuracy | 传球成功率 | ESPN ✅ |
| Key Passes per Game | 场均关键传球 | ESPN ⏳ |
| Cross Accuracy | 传中成功率 | ESPN ⏳ |
| Long Ball Accuracy | 长传成功率 | ESPN ⏳ |
| Final Third Entries | 进入进攻三区次数 | StatsBomb ⏳ |
| Progressive Passes | 向前推进传球 | FBref ⏳ |

##### 防守数据

| 指标 | 定义 | 来源 |
|------|------|------|
| Goals Conceded | 失球数 | ESPN ✅ |
| xGA (Expected Goals Against) | 预期失球 | FBref ⏳ |
| Clean Sheets | 零封场次 | ESPN ⏳ |
| Tackles per Game / Win % | 场均抢断 / 成功率 | ESPN ✅ |
| Interceptions per Game | 场均拦截 | ESPN ⏳ |
| Clearances per Game | 场均解围 | ESPN ⏳ |
| Blocks per Game | 场均封堵 | ESPN ⏳ |
| Pressures / Pressure Success | 逼抢次数 / 成功率 | FBref ⏳ |

##### 对抗数据

| 指标 | 定义 | 来源 |
|------|------|------|
| Duels Won % | 对抗成功率 | ESPN ⏳ |
| Aerial Duels Won % | 空中对抗成功率 | ESPN ⏳ |
| Dribble Success % | 盘带成功率 | ESPN ⏳ |

##### 纪律数据

| 指标 | 定义 | 来源 |
|------|------|------|
| Fouls per Game | 场均犯规 | ESPN ✅ |
| Yellow Cards | 黄牌 | ESPN ✅ |
| Red Cards | 红牌 | ESPN ✅ |
| Offsides | 越位 | ESPN ⏳ |

#### 数据需求

| 数据块 | 内容 | 数据来源 | 优先级 |
|--------|------|----------|--------|
| 球队概况 | 排名/FIFA积分/市值/平均年龄/分组/战绩 | ESPN standings + Transfermarkt | P1 |
| 近 10 场战绩 | 胜平负统计 + 胜率 | ESPN team results | P1 |
| 进攻数据 | 进球/xG/射门/射正率/角球/定位球进球占比 | ESPN team stats + FBref | P1 |
| 控球数据 | 控球率/传球成功率/关键传球/传中成功率/长传 | ESPN team stats | P1 |
| 防守数据 | 失球/xGA/零封/抢断/拦截/解围/封堵 | ESPN team stats + FBref | P1 |
| 对抗数据 | 对抗成功率/空中对抗/盘带成功率 | ESPN team stats | P1 |
| 纪律数据 | 犯规/黄牌/红牌/越位 | ESPN team stats | P1 |
| 趋势分析 | 近 5 场 vs 赛季均值对比 | 计算得出 | P2 |
| 伤病/停赛 | 当前伤病和停赛球员 | ESPN injury report | P1 |
| 球队变动 | 教练更换/阵型变化/归化球员 | 静态数据 + 新闻 | P1 |
| 本届表现 | 小组赛逐场结果 | ESPN schedule + scores | ✅ 已有 |
| 热身赛表现 | 世界杯前热身赛结果 | ESPN schedule | P1 |
| 历史战绩 | 世界杯参赛次数/最佳成绩/累计战绩 | 静态数据 | P2 |
| 教练信息 | 风格/阵型/胜率 | `/api/coach/:teamId` | ⚠️ ID 问题 |
| 大名单 | 按位置分组的球员列表 | `/api/team/:id` | ⚠️ roster 空 |

#### 数据结构

```json
{
  "teamId": "660",
  "overview": {
    "worldRanking": 12,
    "fifaPoints": 1684,
    "marketValue": "€2.1亿",
    "avgAge": 25.8,
    "group": "A",
    "groupRecord": { "w": 2, "d": 1, "l": 0, "gf": 5, "ga": 1, "gd": 4, "pts": 7 }
  },
  "recentForm": {
    "last10": { "w": 6, "d": 3, "l": 1 },
    "winRate": 0.60,
    "attack": {
      "avgGoals": 1.8,
      "avgXG": 1.65,
      "goalsMinusXG": 0.15,
      "avgShots": 14.2,
      "shotOnTargetPct": 0.42,
      "avgCorners": 5.3,
      "setPieceGoalPct": 0.28
    },
    "possession": {
      "avgPossession": 54.2,
      "passAccuracy": 0.86,
      "avgKeyPasses": 9.2,
      "crossAccuracy": 0.28,
      "longBallAccuracy": 0.52
    },
    "defense": {
      "avgConceded": 0.7,
      "avgXGA": 0.85,
      "goalsMinusXGA": -0.15,
      "cleanSheets": 5,
      "avgTackles": 18.5,
      "tackleSuccess": 0.67,
      "avgInterceptions": 12.3,
      "avgClearances": 15.8
    },
    "physical": {
      "duelSuccessRate": 0.52,
      "aerialDuelSuccess": 0.58,
      "dribbleSuccessRate": 0.61
    },
    "discipline": {
      "avgFouls": 11.2,
      "avgYellowCards": 1.8,
      "avgRedCards": 0.1
    },
    "trend": "xG上升，防守稳定"
  },
  "squadChanges": {
    "injuries": [
      { "player": "Adams", "pos": "CM", "issue": "膝伤", "returnDate": "未知" }
    ],
    "suspended": [
      { "player": "McKennie", "pos": "CM", "reason": "黄牌累积" }
    ],
    "returned": [
      { "player": "Reyna", "pos": "LCM", "note": "已恢复合练" }
    ],
    "coachingChange": null,
    "formationChange": "从 4-4-2 改为 4-3-3",
    "newPlayers": ["Balogun (归化前锋)"],
    "watchPoints": [
      "近 3 场控球率下降 5%",
      "定位球防守弱点：3/5 丢球来自定位球",
      "右路防守薄弱：对手 45% 进攻走右路"
    ]
  },
  "tournamentHistory": {
    "worldCupApps": 12,
    "bestResult": "八强 (2002)",
    "lastEdition": "十六强",
    "allTimeRecord": { "played": 33, "w": 8, "d": 6, "l": 19 }
  },
  "warmupMatches": [
    { "date": "2026-03-22", "opponent": "Jamaica", "result": "W 3-1", "venue": "home" },
    { "date": "2026-03-26", "opponent": "Colombia", "result": "D 0-0", "venue": "away" },
    { "date": "2026-06-05", "opponent": "Germany", "result": "W 2-1", "venue": "neutral" }
  ]
}
```

---

## 三、模块清单 & 实现状态

### 3.1 📅 赛程表 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 按日期浏览 | ✅ | `/api/schedule` |
| 指定日期比分 | ✅ | `/api/scores/:date` |
| 比赛详情（进球+统计） | ✅ | `/api/match/:id` |
| 比赛卡片（状态/比分/排名） | ✅ | 前端 `card()` |
| 场馆信息 | ✅ | `/api/venue/:id`（16座场馆静态数据） |
| 天气预报 | ⏳ | 需接入 OpenWeatherMap |
| 草皮/海拔 | ✅ | 16座场馆已录入 |
| **场地影响分析** | ⏳ | 新增：静态规则映射 |

### 3.2 📊 积分榜 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 12组 × 4队积分榜 | ✅ | `/api/standings` |
| 球队名可点击→球队详情 | ✅ | 前端 `openTeamDetail()` |
| 出线形势分析 | ⏳ | 需数学概率计算 |

### 3.3 🏆 球队详情 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 球队 Tab（所有球队卡片） | ✅ | 前端 `loadTeams()` |
| 教练信息 | ✅ | `/api/coach/:teamId` |
| 大名单（按位置分组） | ✅ | `/api/team/:id`（roster 端点） |
| **替补席分析** | ⏳ | 新增：替代关系 + 特色 + 出场概率 |
| **近期表现汇总** | ⏳ | 新增需求（见 2.6）：近 10 场胜负 + 关键数据 |
| **球队动态** | ⏳ | 新增需求（见 2.6）：伤病/停赛/恢复/教练变动 |
| **大赛表现** | ⏳ | 新增需求（见 2.6）：本届 + 历史战绩 |

### 3.4 👤 球员系统 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 球员基本信息 | ✅ | `/api/player/:id` |
| 球员悬浮卡片（状态/评分） | ✅ | 前端 `showTip()` |
| 球员点击→详情页 | ✅ | 前端 `openPlayerDetail()` |
| **球员特色描述** | ⏳ | 新增：ratings.json `traits` 字段 |
| **近 10 场比赛表现** | ⏳ | 新增需求（见 2.5） |
| **俱乐部整体 + 近况** | ⏳ | 新增需求（见 2.5） |
| **国家队整体 + 近况** | ⏳ | 新增需求（见 2.5） |
| 伤病信息 | ⏳ | ESPN Injury Report |

### 3.5 ⚔️ 对位评分系统 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 对位匹配算法 | ✅ | `matchup-api.js` |
| 阵型坐标计算（5种阵型） | ✅ | `FORM_COORDS` |
| 评分数据（48队 748人） | ✅ | `data/ratings.json` |
| 对位 API | ✅ | `/api/matchup/:id/formation` |
| 颜色编码（🟢🔴🟡⚪） | ✅ | `pairLines()` |
| 前端对阵图渲染 | 🔄 | 后端已有，前端 SVG 连线待做 |
| 雷达图对比 | ⏳ | 待实现 |

### 3.6 🧠 教练分析 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 教练详情（风格/阵型/胜率/大赛经验） | ✅ | `/api/coach/:teamId` |
| 临场调整能力（半场逆转率） | ✅ | 静态数据 |
| 教练对比 API | ✅ | `/api/coach-compare/:a/:b` |
| 风格克制分析 | ✅ | 内置克制矩阵 |
| 综合评分 | ✅ | 加权公式 |
| **教练相关新闻** | ⏳ | 新增：Tavily 搜索 |
| **球队赛前新闻** | ⏳ | 新增：Tavily 搜索 |

### 3.7 💰 盘口数据 ✅

| 子功能 | 状态 | API |
|---|---|---|
| The Odds API 集成 | ✅ | 41家博彩公司 |
| 欧赔（胜/平/负） | ✅ | 隐含概率 + 抽水率 |
| 大小球 | ✅ | O/U 线 + 水位 |
| 让球盘 | ✅ | 亚盘数据 |
| 盘口变化历史 | ✅ | 5分钟快照存储 |
| 盘口异动检测 | ✅ | `/api/odds-alerts` |
| 市场分歧（Pinnacle vs Bet365） | ✅ | 差异追踪 |
| 趋势箭头（↑↓→） | ✅ | 前端 `renderOddsTrend()` |
| 赛中缓存兜底 | ✅ | 开球后冻结赛前数据 |
| AI 异动解读 | ⏳ | 需接 LLM |
| 盘口变化原因推测 | ⏳ | 需新闻关联 |

**⚠️ 当前问题**：The Odds API 返回 `no_match_found`，所有盘口数据为空。需排查赛事 ID 映射。

### 3.8 📐 角球预测 ✅

| 子功能 | 状态 | API |
|---|---|---|
| 历史场均角球 | ✅ | 默认值 9.5 |
| 风格系数 | ✅ | 5种打法系数 |
| 预测公式 | ✅ | 设计文档完整实现 |
| Over/Under 判定 | ✅ | 5级趋势 + 3级置信度 |
| 赛中实时调整 | ✅ | 动态权重（0-15min → 60min+） |
| 进度条数据 | ✅ | 实际 vs 预期 |
| 角球追踪 API | ✅ | `/api/corner-analysis/:id` |
| **前端追踪条组件** | ⏳ | 待实现 |

### 3.9 📰 新闻聚合 ⏳

| 子功能 | 状态 | 备注 |
|---|---|---|
| 新闻搜索 | ⏳ | Tavily API 已有 key |
| AI 摘要 | ⏳ | 需接 LLM |
| 按球队/球员筛选 | ⏳ | |
| **按教练搜索** | ⏳ | 新增需求 |
| **重要性分级** | ⏳ | 新增：🔴🟡🟢 |

### 3.10 📱 PWA ✅

| 子功能 | 状态 | 说明 |
|---|---|---|
| manifest.json | ✅ | 配置完成 |
| Service Worker | ✅ | 离线缓存策略 |
| 响应式设计 | ✅ | 手机优先 |
| 深色主题 | ✅ | 全局暗色 |
| 添加到主屏幕 | ✅ | PWA 支持 |

---

## 四、API 端点清单（18个）

| 端点 | 说明 | 数据源 | 状态 |
|---|---|---|---|
| `/api/scores` | 实时比分 | ESPN | ✅ |
| `/api/scores/:date` | 指定日期比分 | ESPN | ✅ |
| `/api/standings` | 积分榜 | ESPN | ✅ |
| `/api/schedule` | 赛程表（前后10天） | ESPN | ✅ |
| `/api/match/:id` | 比赛详情（进球+统计） | ESPN | ✅ |
| `/api/player/:id` | 球员信息 | ESPN | ✅ |
| `/api/team/:id` | 球队信息+阵容 | ESPN roster | ⚠️ roster 空 |
| `/api/team/:id/lineup` | 球队评分阵容 | ratings.json | ✅ |
| `/api/coach/:teamId` | 教练详情 | 静态数据 | ❌ ID 映射问题 |
| `/api/coach-compare/:a/:b` | 教练对比 | 静态数据 | ❌ |
| `/api/matchup/:id/formation` | 对位阵型分析 | matchup-api.js | ✅ |
| `/api/odds/:matchId` | 盘口数据 | The Odds API | ❌ no_match_found |
| `/api/odds-history/:matchId` | 盘口变化历史 | 本地快照 | ⚠️ |
| `/api/odds-alerts` | 盘口异动检测 | The Odds API | ❌ |
| `/api/corner-analysis/:id` | 角球预测 | ESPN + 教练数据 | ✅ |
| `/api/venue/:id` | 场馆信息 | 静态数据 | ✅ |
| `/api/match/:id/news` | **🆕 比赛相关新闻** | Tavily | ⏳ 待实现 |
| `/api/match/:id/context` | **🆕 比赛环境分析** | venue + weather | ⏳ 待实现 |
| `/api/player/:id/stats` | **🆕 球员近 10 场表现** | ESPN match log | ⏳ 待实现 |
| `/api/player/:id/club` | **🆕 球员俱乐部表现** | ESPN player stats | ⏳ 待实现 |
| `/api/player/:id/national` | **🆕 球员国家队表现** | ESPN player stats | ⏳ 待实现 |

---

## 五、技术架构

```
┌─────────────────────────────────────────┐
│         PWA 前端 (index.html)            │
│   Tailwind CSS + Vanilla JS              │
│   4 Tab 导航（比分/赛程/对位/球员）       │
│   比赛详情 Modal（核心分析页）             │
│   SVG 对位阵型图 / 盘口趋势 / 角球追踪    │
│   Service Worker (离线缓存)               │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│      Node.js 后端 (server.js)            │
│   纯 HTTP 模块，零依赖                    │
│   18 个 API 端点                          │
│   内存缓存 + 本地 JSON 存储               │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│            数据层                         │
│   ESPN API (比分/赛程/球员/统计)          │
│   The Odds API (盘口，41家博彩公司)       │
│   ratings.json (48队 748人评分+特色)      │
│   matchup-api.js (对位引擎)               │
│   教练数据 (静态，8队详细)                │
│   场馆数据 (静态，16座)                   │
│   Tavily API (新闻搜索) 🆕               │
│   OpenWeatherMap (天气) 🆕               │
└─────────────────────────────────────────┘
```

**部署**
- NAS Docker 容器
- 端口：5099
- 局域网：`http://192.168.2.231:5099`
- 外网：Tailscale

---

## 六、数据来源 & 可行性

| 数据 | 来源 | 状态 | 备注 |
|---|---|---|---|
| 赛程/比分/统计 | ESPN API | ✅ | 免费公开，无需 key |
| 球员信息 | ESPN API | ✅ | `/athletes/:id` |
| 球队阵容 | ESPN API | ⚠️ | `/teams/:id/roster` 当前返回空 |
| 球员评分 | ratings.json | ✅ | 48队 748人，FIFA 风格 |
| **球员特色** | ratings.json | ⏳ | 需新增 `traits` 字段 |
| **近 10 场表现** | ESPN match log | ⏳ | 进球/出场/抢断/评分 |
| **俱乐部整体 + 近况** | ESPN player stats | ⏳ | 俱乐部数据 + 近 5 场 |
| **国家队整体 + 近况** | ESPN player stats | ⏳ | 国家队数据 + 近 5 场 |
| 盘口数据 | The Odds API | ❌ | 500 req/月免费，当前返回 no_match |
| 教练数据 | 静态录入 | ❌ | 8队详细，ID 映射有问题 |
| 场馆数据 | 静态录入 | ✅ | 16座场馆 |
| 天气 | OpenWeatherMap | ⏳ | 需 API Key |
| **场地影响分析** | 静态规则 | ⏳ | 草皮×天气→影响描述映射表 |
| 新闻 | Tavily | ⏳ | 已有 API Key，需开发搜索逻辑 |
| 伤病信息 | ESPN Injury Report | ⏳ | 待接入 |

---

## 七、项目文件结构

```
pitch-signal/
├── server.js                          # 后端 (纯 Node.js，零依赖)
├── templates/index.html               # 前端 (单页应用)
├── data/
│   ├── ratings.json                   # 48队 748人评分
│   └── odds_*.json                    # 盘口快照
├── matchup-rating/                    # 对位系统
│   ├── matchup-api.js                 # 对位引擎
│   ├── generate-ratings.js            # 评分生成器
│   ├── ratings.json                   # 原始评分数据
│   ├── SCORING_SYSTEM_DESIGN.md       # 评分系统设计
│   ├── ODDS_ANALYSIS_ENGINE.md        # 盘口分析设计
│   ├── CORNER_PREDICTION_MODEL.md     # 角球预测设计
│   ├── FORMATION_MATCHUP_TECH.md      # 对位阵型图方案
│   └── REVIEW_BOARD.md                # 协作板
├── static/
│   ├── manifest.json                  # PWA 配置
│   ├── sw.js                          # Service Worker
│   ├── icon-192.png                   # 图标
│   └── icon-512.png
├── REQUIREMENTS.md                    # 本文档
└── package.json
```

---

## 八、前端页面结构（新设计）

```
📱 App
│
├── 🔴 比分 Tab
│   └── 比赛卡片列表（实时/已结束/未开始）
│       └── 点击 → 比赛详情 Modal
│           ├── ⚔️ 对位阵型图（默认展开）
│           │   ├── 双方阵型 + 球员点位 + 评分
│           │   ├── 对位连线（颜色编码）
│           │   ├── 球员点击 → 特色卡片
│           │   └── 视角切换（主/客/双方）
│           │
│           ├── 🏟️ 场地 & 天气
│           │   ├── 场馆名 + 草皮 + 海拔
│           │   ├── 天气（温度/湿度/风速）
│           │   └── 场地影响分析
│           │
│           └── 📊 数据 Tab 区
│               ├── [阵容] 替补席分析（替代关系 + 特色 + 出场概率）
│               ├── [统计] 进球 + 技术统计（已结束比赛）
│               ├── [盘口] 欧赔/大小球/让球盘/变化趋势/异动告警
│               ├── [角球] 预测 + 实时追踪条
│               └── [教练] 教练对决 + 赛前新闻
│
├── 📅 赛程 Tab
│   ├── 日期选择器
│   └── 比赛卡片 → 同上比赛详情 Modal
│
├── 📊 分析 Tab
│   ├── 盘口异动检测
│   ├── 角球数据汇总
│   ├── 教练新闻聚合
│   └── 比赛卡片 → 同上比赛详情 Modal
│
├── 📊 积分 Tab
│   └── 12组积分榜（球队名可点击→球队详情页）
│
└── 🏆 球队 Tab
    ├── 球队卡片网格（按组排列）
    └── 点击 → 球队详情页
        ├── 教练信息
        ├── 大名单（按位置分组）
        └── 球员点击 → 球员详情 Modal
```

---

## 九、设计文档索引

| 文档 | 位置 | 内容 |
|---|---|---|
| 对位评分系统 | `matchup-rating/SCORING_SYSTEM_DESIGN.md` | 6维评分 + 位置对位 + 教练修正 |
| 盘口分析引擎 | `matchup-rating/ODDS_ANALYSIS_ENGINE.md` | 快照对比 + 阈值告警 + 原因推测 |
| 角球预测模型 | `matchup-rating/CORNER_PREDICTION_MODEL.md` | 风格系数 + 实时调整 + over/under |
| 对位阵型图方案 | `matchup-rating/FORMATION_MATCHUP_TECH.md` | 匹配算法 + 坐标 + 连线编码 |
| 协作板 | `REVIEW_BOARD.md` | 两虾协作中枢 |
| **🆕 场地天气分析** | `matchup-rating/VENUE_WEATHER_ANALYSIS.md` | 场馆数据 + 天气集成 + 影响分析 |
| **🆕 替补席分析** | `matchup-rating/BENCH_ANALYSIS.md` | 替代关系 + 球员特色 + 出场概率 |
| **🆕 新闻聚合系统** | `matchup-rating/NEWS_AGGREGATION.md` | Tavily搜索 + AI摘要 + 重要性分级 |
| **🆕 球员增强数据** | `matchup-rating/PLAYER_ENHANCED_DATA.md` | 近10场表现 + 俱乐部 + 国家队数据 |
| **🆕 球队详情增强** | `matchup-rating/TEAM_DETAIL_ENHANCED.md` | 近期表现 + 球队动态 + 大赛历史 |

---

## 十、待实现功能（按优先级）

| 优先级 | 功能 | 负责 | 说明 |
|---|---|---|---|
| **P0** | 前端对位阵型图渲染（SVG 连线） | 🦐 | 后端 API 已有，前端 SVG 待做 |
| **P0** | 前端角球追踪条组件 | 🦐 | API 已有，组件待做 |
| **P0** | Tab 重构：对位/球员 Tab 砍掉，改为 5 Tab 导航 | 🦐 | 按新设计重构 |
| **P1** | 场地 & 天气信息区块 | 🦐 | venue API 已有，天气待接，影响分析待做 |
| **P1** | 替补席分析（替代关系 + 特色） | 🦞 | 需新增静态数据 |
| **P1** | 教练 & 球队新闻（Tavily） | 🦞 | API key 已有，搜索逻辑待做 |
| **P1** | 球员特色描述（ratings.json 增强） | 🦞 | 新增 `traits` 字段 |
| **P1** | 球员近 10 场表现 + 俱乐部 + 国家队数据 | 🦞 | 新增 3 个 API + 前端卡片 |
| **P2** | 盘口 API 修复 | 🦐 | 排查 The Odds API no_match_found |
| **P2** | 盘口 UI 完整实现 | 🦐 | API 修好后做 |
| **P2** | 新闻重要性分级（🔴🟡🟢） | 🦞 | 规则映射 |
| **P3** | 出线形势数学分析 | 🦞 | 概率计算 |
| **P3** | 淘汰赛阶段升级盘口 API | 评估中 | |

---

## 十一、已知限制

1. ESPN API 无官方文档 — 逆向工程，接口可能变动
2. 首发阵容赛前 1 小时才公布 — 需定时轮询
3. The Odds API 免费层不支持滚球 — 赛中显示赛前数据
4. 教练数据目前只覆盖 8 队 — 需扩展，且 ID 映射有问题
5. 天气 API 未接入 — 场馆天气暂缺
6. 球员特色数据需手动录入 — 先做 48 队核心球员

---

_文档版本：v3.5 | 2026-06-12 | by 猪比巴布_
_v3.5 更新：新闻嵌入策略——不再独立成栏目，嵌入赛程/比赛详情/分析 Tab；比赛详情新增 📰 新闻 Tab；赛程卡片下方显示相关新闻摘要_  
_v3.4 更新：球员/球队指标体系对标行业标准（SofaScore/WhoScored/FBref/StatsBomb/Opta）；球队新增进攻/控球/防守/对抗/纪律 5 大类指标；球员新增 xG/xA/盘带/逼抢/对抗等维度；热身赛数据加入球队详情_  
_v3.3 更新：新增球队详情页增强需求（近期表现/球队动态/大赛历史）_  
_v3.2 更新：新增球员详情页增强需求（近 10 场表现/俱乐部/国家队数据）_  
_v3.1 更新：对位图不再独立成 Tab，只在比赛详情 Modal 里；球员与球队合并；底部 5 Tab_  
_v3.0 更新：导航重构，比赛详情 Modal 为核心，新增场地分析/替补席/新闻/球员特色需求_
