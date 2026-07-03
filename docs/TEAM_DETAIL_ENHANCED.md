# 球队详情增强系统

## 一、系统概述

球队详情增强系统为世界杯球队提供全面的数据分析，包括近期表现、球队动态、大赛历史等，帮助用户深入了解球队实力和状态。

### 核心功能

1. **球队概况** - 排名/FIFA积分/市值/平均年龄
2. **近10场表现** - 胜平负统计 + 关键数据
3. **球队动态** - 伤病/停赛/恢复/教练变动
4. **大赛表现** - 本届 + 历史战绩
5. **教练信息** - 风格/阵型/胜率

---

## 二、数据结构

### 2.1 球队增强数据

```json
{
  "teamId": "660",
  "name": "美国",
  "shortName": "USA",
  "code": "USA",
  "flag": "🇺🇸",
  "logo": "https://...",
  
  // 球队概况
  "overview": {
    "worldRanking": 12,
    "fifaPoints": 1684,
    "marketValue": "€2.1亿",
    "avgAge": 25.8,
    "group": "A",
    "groupRecord": {
      "w": 2, "d": 1, "l": 0,
      "gf": 5, "ga": 1, "gd": 4, "pts": 7
    }
  },
  
  // 近10场表现
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
  
  // 球队动态
  "squadChanges": {
    "injuries": [
      {
        "player": "Adams",
        "pos": "CM",
        "issue": "膝伤",
        "returnDate": "未知"
      }
    ],
    "suspended": [
      {
        "player": "McKennie",
        "pos": "CM",
        "reason": "黄牌累积"
      }
    ],
    "returned": [
      {
        "player": "Reyna",
        "pos": "LCM",
        "note": "已恢复合练"
      }
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
  
  // 大赛历史
  "tournamentHistory": {
    "worldCupApps": 12,
    "bestResult": "八强 (2002)",
    "lastEdition": "十六强",
    "allTimeRecord": { "played": 33, "w": 8, "d": 6, "l": 19 }
  },
  
  // 热身赛
  "warmupMatches": [
    {
      "date": "2026-03-22",
      "opponent": "Jamaica",
      "result": "W 3-1",
      "venue": "home"
    },
    {
      "date": "2026-03-26",
      "opponent": "Colombia",
      "result": "D 0-0",
      "venue": "away"
    },
    {
      "date": "2026-06-05",
      "opponent": "Germany",
      "result": "W 2-1",
      "venue": "neutral"
    }
  ],
  
  // 教练信息
  "coach": {
    "name": "Gregg Berhalter",
    "nationality": "美国",
    "age": 52,
    "style": "高位逼抢+快速传导",
    "formation": ["4-3-3", "4-2-3-1"],
    "winRate": 0.65,
    "tournamentExp": "2022 世界杯",
    "tacticalNotes": "强调控球和高位逼抢，善于调整阵型"
  }
}
```

---

## 三、近10场表现分析

### 3.1 进攻数据

| 指标 | 定义 | 权重 |
|------|------|------|
| 场均进球 | 进球数 / 比赛场次 | 30% |
| xG | 预期进球 | 20% |
| 射门次数 | 场均射门 | 15% |
| 射正率 | 射正 / 射门 | 15% |
| 角球 | 场均角球 | 10% |
| 定位球进球% | 定位球进球 / 总进球 | 10% |

### 3.2 控球数据

| 指标 | 定义 | 权重 |
|------|------|------|
| 控球率 | 平均控球率 | 25% |
| 传球成功率 | 成功传球 / 总传球 | 25% |
| 关键传球 | 场均关键传球 | 20% |
| 传中成功率 | 成功传中 / 总传中 | 15% |
| 长传成功率 | 成功长传 / 总长传 | 15% |

### 3.3 防守数据

| 指标 | 定义 | 权重 |
|------|------|------|
| 场均失球 | 失球数 / 比赛场次 | 30% |
| xGA | 预期失球 | 20% |
| 零封场次 | 零封场次 / 总场次 | 20% |
| 抢断成功率 | 成功抢断 / 总抢断 | 15% |
| 拦截 | 场均拦截 | 15% |

### 3.4 综合评分

```javascript
function calculateTeamForm(recentForm) {
  const weights = {
    attack: 0.35,
    possession: 0.25,
    defense: 0.30,
    discipline: 0.10
  };
  
  const attackScore = calculateAttackScore(recentForm.attack);
  const possessionScore = calculatePossessionScore(recentForm.possession);
  const defenseScore = calculateDefenseScore(recentForm.defense);
  const disciplineScore = calculateDisciplineScore(recentForm.discipline);
  
  const totalScore = 
    attackScore * weights.attack +
    possessionScore * weights.possession +
    defenseScore * weights.defense +
    disciplineScore * weights.discipline;
  
  return {
    total: totalScore,
    attack: attackScore,
    possession: possessionScore,
    defense: defenseScore,
    discipline: disciplineScore
  };
}
```

---

## 四、球队动态系统

### 4.1 伤病/停赛追踪

#### 伤病状态
- **轻微伤病**: 预计缺席1-2周
- **中度伤病**: 预计缺席2-4周
- **严重伤病**: 预计缺席1个月以上
- **赛季报销**: 无法参加世界杯

#### 停赛状态
- **黄牌累积**: 累积黄牌停赛
- **红牌停赛**: 直接红牌停赛
- **纪律处分**: 其他纪律原因

### 4.2 阵容变动

```json
{
  "formationChanges": [
    {
      "date": "2026-06-01",
      "from": "4-4-2",
      "to": "4-3-3",
      "reason": "加强中场控制"
    }
  ],
  "newPlayers": [
    {
      "name": "Balogun",
      "pos": "ST",
      "type": "归化",
      "date": "2026-05-15",
      "note": "从阿森纳归化，首次入选"
    }
  ],
  "coachingChanges": null
}
```

### 4.3 关注点分析

```javascript
function analyzeWatchPoints(teamData) {
  const watchPoints = [];
  
  // 控球率下降
  if (teamData.recentForm.possession.avgPossession < 50) {
    watchPoints.push({
      type: 'warning',
      message: '近 3 场控球率下降 5%',
      impact: '可能影响进攻节奏'
    });
  }
  
  // 定位球防守弱点
  if (teamData.recentForm.defense.setPieceGoalPct > 0.5) {
    watchPoints.push({
      type: 'critical',
      message: '定位球防守弱点：3/5 丢球来自定位球',
      impact: '需要加强定位球防守'
    });
  }
  
  // 路防守薄弱
  if (teamData.recentForm.defense.rightSideWeakness > 0.4) {
    watchPoints.push({
      type: 'warning',
      message: '右路防守薄弱：对手 45% 进攻走右路',
      impact: '可能被对手针对'
    });
  }
  
  return watchPoints;
}
```

---

## 五、大赛历史

### 5.1 世界杯历史

```json
{
  "worldCupHistory": {
    "participations": 12,
    "bestResult": "八强 (2002)",
    "lastEdition": "十六强 (2022)",
    "allTimeRecord": {
      "played": 33,
      "wins": 8,
      "draws": 6,
      "losses": 19,
      "goalsFor": 37,
      "goalsAgainst": 62
    },
    "groupStageExits": 6,
    "roundOf16": 4,
    "quarterFinals": 2
  }
}
```

### 5.2 其他大赛历史

```json
{
  "otherTournaments": {
    "copaAmerica": {
      "apps": 4,
      "bestResult": "四强 (2016)",
      "recent": "2024 小组出局"
    },
    "goldCup": {
      "apps": 16,
      "bestResult": "冠军 (7次)",
      "recent": "2023 冠军"
    },
    "nationsLeague": {
      "apps": 3,
      "bestResult": "冠军 (2021)",
      "recent": "2024 四强"
    }
  }
}
```

---

## 六、教练分析

### 6.1 教练档案

```json
{
  "coach": {
    "name": "Gregg Berhalter",
    "nationality": "美国",
    "age": 52,
    "birthDate": "1973-08-01",
    "playingCareer": ["LA Galaxy", "Crystal Palace", "Energie Cottbus"],
    "coachingCareer": ["Hammarby", "Columbus Crew", "USMNT"],
    "appointed": "2018-12-02",
    "contractUntil": "2026-12-31"
  }
}
```

### 6.2 战术风格

```json
{
  "tacticalStyle": {
    "primaryStyle": "高位逼抢+快速传导",
    "secondaryStyle": "控球+中场组织",
    "formation": ["4-3-3", "4-2-3-1"],
    "pressingIntensity": "high",
    "possessionPreference": "medium",
    "counterAttack": "medium",
    "setPieceFocus": "high"
  }
}
```

### 6.3 教练战绩

```json
{
  "coachingRecord": {
    "matches": 75,
    "wins": 48,
    "draws": 15,
    "losses": 12,
    "winRate": 0.64,
    "goalsFor": 150,
    "goalsAgainst": 60,
    "tournamentMatches": 15,
    "tournamentWins": 8,
    "tournamentDraws": 4,
    "tournamentLosses": 3
  }
}
```

---

## 七、前端展示设计

### 7.1 球队详情页

```
┌─────────────────────────────────────────┐
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
│  │                                 │
│  │  Gregg Berhalter                │
│  │  美国 · 52岁                     │
│  │                                 │
│  │  风格: 高位逼抢+快速传导         │
│  │  阵型: 4-3-3 / 4-2-3-1          │
│  │  胜率: 64% (75场)               │
│  │  大赛经验: 2022 世界杯           │
│  │                                 │
│  │  战术特点:                       │
│  │  · 强调控球和高位逼抢            │
│  │  · 善于调整阵型                  │
│  │  · 注重定位球进攻                │
│  └─────────────────────────────────┘
│                                    │
│  ┌─────────────────────────────────┐
│  │  👥 大名单                       │
│  │  ...（现有按位置分组列表）        │
│  └─────────────────────────────────┘
└─────────────────────────────────────┘
```

---

## 八、API端点设计

### 8.1 获取球队增强数据

```
GET /api/team/:id/enhanced
```

**响应:**
```json
{
  "teamId": "660",
  "name": "美国",
  "overview": {...},
  "recentForm": {...},
  "squadChanges": {...},
  "tournamentHistory": {...},
  "warmupMatches": [...],
  "coach": {...}
}
```

### 8.2 获取球队近10场表现

```
GET /api/team/:id/recent-form
```

**响应:**
```json
{
  "teamId": "660",
  "matches": [...],
  "summary": {
    "wins": 6,
    "draws": 3,
    "losses": 1,
    "winRate": 0.60,
    "attack": {...},
    "possession": {...},
    "defense": {...}
  }
}
```

### 8.3 获取球队动态

```
GET /api/team/:id/squad-changes
```

**响应:**
```json
{
  "teamId": "660",
  "injuries": [...],
  "suspended": [...],
  "returned": [...],
  "formationChanges": [...],
  "newPlayers": [...],
  "watchPoints": [...]
}
```

---

## 九、实现计划

### Phase 1: 数据收集 (1天)
- [ ] 收集球队基础数据
- [ ] 获取近10场比赛记录
- [ ] 整理伤病/停赛信息

### Phase 2: 算法实现 (1天)
- [ ] 实现近10场表现分析
- [ ] 实现球队动态追踪
- [ ] 实现大赛历史统计

### Phase 3: 前端展示 (1天)
- [ ] 设计球队详情页
- [ ] 实现数据可视化
- [ ] 集成到球队Tab

### Phase 4: 优化完善 (0.5天)
- [ ] 添加历史数据
- [ ] 优化算法参数
- [ ] 测试和调试

---

## 十、技术要点

### 10.1 数据更新

- **球队基础数据**: 每日更新
- **近10场表现**: 每场比赛后更新
- **伤病/停赛**: 每日更新
- **大赛历史**: 每场比赛后更新

### 10.2 缓存策略

- **球队基础数据**: 中期缓存 (1天)
- **近10场表现**: 短期缓存 (1小时)
- **伤病/停赛**: 短期缓存 (1小时)

### 10.3 错误处理

- 数据缺失: 使用默认值
- API失败: 返回缓存数据
- 计算异常: 返回中性评分

---

## 十一、数据来源

| 数据 | 来源 | 更新频率 |
|------|------|----------|
| 球队信息 | ESPN API | 每日 |
| 比赛统计 | ESPN API | 每场比赛后 |
| 伤病/停赛 | ESPN API | 每日 |
| 教练信息 | 静态数据 | 每月 |
| 大赛历史 | 静态数据 | 每场比赛后 |

---

## 十二、已知限制

1. **数据完整性**: 部分球队数据可能缺失
2. **实时性**: 数据更新可能有延迟
3. **伤病信息**: 可能不够详细
4. **战术分析**: 基于历史数据推断

---

## 十三、参考资料

- [ESPN 球队数据](https://www.espn.com/soccer/teams)
- [FIFA 官方排名](https://www.fifa.com/fifa-world-ranking/)
- [Transfermarkt 球队市值](https://www.transfermarkt.com/)
- [FBref 球队统计](https://fbref.com/)

---

_文档版本：v1.0 | 2026-06-13 | by AI Coding Engineer_
