# 替补席分析系统

## 一、系统概述

替补席分析系统为世界杯比赛提供替补球员的深度分析，包括替代关系、球员特色、出场概率等，帮助用户理解球队的板凳深度和战术灵活性。

### 核心功能

1. **替补球员列表** - 每场比赛的替补席球员
2. **替代关系分析** - 每个替补球员可以替换哪些首发球员
3. **球员特色描述** - 替补球员的独特技能和特点
4. **出场概率预测** - 基于历史数据的出场可能性
5. **板凳深度评分** - 球队整体替补实力评估

---

## 二、数据结构

### 2.1 替补席数据

```json
{
  "matchId": "401581705",
  "homeTeam": {
    "teamId": "660",
    "teamName": "美国",
    "bench": [
      {
        "playerId": "p1",
        "name": "Giovanni Reyna",
        "pos": "LCM",
        "jersey": 7,
        "age": 23,
        "rating": 78,
        "traits": ["技术出色", "任意球专家", "视野开阔"],
        "substituteFor": ["McKennie", "Musah"],
        "appearanceProb": 0.75,
        "impactType": "creative",  // creative/defensive/physical/super-sub
        "recentForm": "good",
        "injuryStatus": null,
        "notes": "已恢复合练，状态良好"
      },
      {
        "playerId": "p2",
        "name": "Brenden Aaronson",
        "pos": "RW",
        "jersey": 11,
        "age": 25,
        "rating": 75,
        "traits": ["高压逼抢", "跑动积极", "速度快"],
        "substituteFor": ["Weah", "Pulisic"],
        "appearanceProb": 0.60,
        "impactType": "physical",
        "recentForm": "average",
        "injuryStatus": null,
        "notes": "体能充沛，适合后半场上"
      }
    ],
    "benchStrength": 72,  // 板凳深度评分 (0-100)
    "superSubCount": 2,   // 超级替补数量
    "defensiveOptions": 3, // 防守替补选项
    "attackingOptions": 4  // 进攻替补选项
  },
  "awayTeam": {
    // 同样结构
  }
}
```

### 2.2 替代关系图

```json
{
  "substitutionMatrix": {
    "home": {
      "McKennie": {
        "primary": "Reyna",
        "secondary": "Aaronson",
        "tactical": "Adams (位置调整)"
      },
      "Weah": {
        "primary": "Aaronson",
        "secondary": "Reyna",
        "tactical": "Pulisic (位置互换)"
      }
    },
    "away": {
      // 同样结构
    }
  }
}
```

---

## 三、球员特色系统

### 3.1 特色分类

#### 技术型 (Technical)
- 技术出色
- 任意球专家
- 视野开阔
- 盘带高手
- 传球精准

#### 体能型 (Physical)
- 速度快
- 体能充沛
- 跑动积极
- 对抗强硬
- 空中优势

#### 战术型 (Tactical)
- 高压逼抢
- 位置感好
- 防守稳健
- 战术纪律
- 组织能力

#### 特殊型 (Special)
- 超级替补
- 关键先生
- 点球专家
- 大赛经验
- 领导力

### 3.2 特色评分

每个特色有对应的评分 (0-100)：

```json
{
  "traits": {
    "技术出色": { "score": 85, "weight": 0.15 },
    "任意球专家": { "score": 90, "weight": 0.10 },
    "速度快": { "score": 88, "weight": 0.12 },
    "高压逼抢": { "score": 82, "weight": 0.10 }
  }
}
```

---

## 四、出场概率算法

### 4.1 影响因素

| 因素 | 权重 | 说明 |
|------|------|------|
| 历史出场率 | 30% | 近10场比赛出场情况 |
| 球员状态 | 25% | 近期表现和训练情况 |
| 伤病情况 | 20% | 当前伤病状态 |
| 战术需求 | 15% | 比赛局势需要 |
| 教练偏好 | 10% | 教练用人习惯 |

### 4.2 计算公式

```javascript
function calculateAppearanceProb(player, matchContext) {
  const factors = {
    historical: player.recentAppearances / 10,  // 0-1
    form: player.formRating / 100,              // 0-1
    fitness: player.injuryStatus ? 0.3 : 1.0,   // 0-1
    tactical: calculateTacticalNeed(player, matchContext),  // 0-1
    coachPreference: player.coachPreference     // 0-1
  };
  
  const weights = [0.30, 0.25, 0.20, 0.15, 0.10];
  const prob = Object.values(factors).reduce((sum, val, i) => 
    sum + val * weights[i], 0
  );
  
  return Math.min(1, Math.max(0, prob));
}
```

### 4.3 出场概率等级

| 概率 | 等级 | 说明 |
|------|------|------|
| >80% | 🟢 极可能 | 几乎确定出场 |
| 60-80% | 🟡 可能 | 大概率出场 |
| 40-60% | 🟠 不确定 | 取决于比赛局势 |
| 20-40% | 🔴 可能性低 | 特殊情况才会出场 |
| <20% | ⚪ 极低 | 基本不会出场 |

---

## 五、板凳深度评分

### 5.1 评分维度

```javascript
function calculateBenchStrength(benchPlayers) {
  const dimensions = {
    // 1. 平均评分 (40%)
    avgRating: average(benchPlayers.map(p => p.rating)),
    
    // 2. 超级替补数量 (20%)
    superSubCount: benchPlayers.filter(p => 
      p.impactType === 'super-sub'
    ).length,
    
    // 3. 位置覆盖度 (20%)
    positionCoverage: calculatePositionCoverage(benchPlayers),
    
    // 4. 特色多样性 (10%)
    traitDiversity: calculateTraitDiversity(benchPlayers),
    
    // 5. 经验值 (10%)
    experience: average(benchPlayers.map(p => p.experience))
  };
  
  // 加权计算
  const score = 
    dimensions.avgRating * 0.40 +
    dimensions.superSubCount * 15 * 0.20 +
    dimensions.positionCoverage * 100 * 0.20 +
    dimensions.traitDiversity * 100 * 0.10 +
    dimensions.experience * 100 * 0.10;
  
  return Math.min(100, Math.max(0, score));
}
```

### 5.2 板凳深度等级

| 评分 | 等级 | 说明 |
|------|------|------|
| >85 | 🟢 优秀 | 板凳深度强，战术灵活 |
| 70-85 | 🟡 良好 | 有足够的替补选择 |
| 55-70 | 🟠 一般 | 替补选择有限 |
| 40-55 | 🔴 较弱 | 板凳深度不足 |
| <40 | ⚪ 很弱 | 替补选择严重不足 |

---

## 六、前端展示设计

### 6.1 替补席卡片

```
┌─────────────────────────────────────────┐
│  🔄 替补席分析                           │
│                                         │
│  🔵 美国 板凳深度: 78/100 (良好)         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  替补球员                        │    │
│  │                                 │    │
│  │  🟢 G. Reyna (#7) LCM 78       │    │
│  │     替代: McKennie, Musah       │    │
│  │     特色: 技术出色, 任意球专家    │    │
│  │     出场概率: 75%               │    │
│  │                                 │    │
│  │  🟡 B. Aaronson (#11) RW 75    │    │
│  │     替代: Weah, Pulisic         │    │
│  │     特色: 高压逼抢, 速度快       │    │
│  │     出场概率: 60%               │    │
│  │                                 │    │
│  │  🟠 Y. Musah (#6) RCM 74       │    │
│  │     替代: McKennie, Adams       │    │
│  │     特色: 跑动积极, 对抗强硬     │    │
│  │     出场概率: 45%               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  替代关系图                      │    │
│  │                                 │    │
│  │  McKennie → Reyna (首选)        │    │
│  │           → Aaronson (备选)     │    │
│  │                                 │    │
│  │  Weah → Aaronson (首选)         │    │
│  │       → Reyna (备选)            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  板凳深度分析                    │    │
│  │                                 │    │
│  │  进攻选项: 4人 ⭐⭐⭐⭐          │    │
│  │  防守选项: 3人 ⭐⭐⭐            │    │
│  │  超级替补: 2人 ⭐⭐              │    │
│  │  位置覆盖: 85% ⭐⭐⭐⭐          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 6.2 比赛详情中的位置

替补席分析应放在比赛详情 Modal 的 **[阵容]** Tab 中，位于首发阵容下方。

---

## 七、API 端点设计

### 7.1 获取替补席分析

```
GET /api/match/:id/bench-analysis
```

**响应:**
```json
{
  "matchId": "401581705",
  "homeTeam": {
    "teamId": "660",
    "teamName": "美国",
    "bench": [...],
    "benchStrength": 78,
    "substitutionMatrix": {...}
  },
  "awayTeam": {
    // 同样结构
  },
  "comparison": {
    "homeStrength": 78,
    "awayStrength": 72,
    "advantage": "home"
  }
}
```

### 7.2 获取球员特色

```
GET /api/player/:id/traits
```

**响应:**
```json
{
  "playerId": "p1",
  "name": "Giovanni Reyna",
  "traits": [
    {
      "name": "技术出色",
      "score": 85,
      "description": "控球能力强，技术细腻"
    },
    {
      "name": "任意球专家",
      "score": 90,
      "description": "任意球破门率高"
    }
  ],
  "impactType": "creative",
  "superSubRating": 78
}
```

---

## 八、实现计划

### Phase 1: 数据准备 (1天)
- [ ] 收集各队替补球员数据
- [ ] 录入球员特色信息
- [ ] 建立替代关系矩阵

### Phase 2: 算法实现 (1天)
- [ ] 实现出场概率计算
- [ ] 实现板凳深度评分
- [ ] 实现替代关系分析

### Phase 3: 前端展示 (1天)
- [ ] 设计替补席卡片
- [ ] 实现替代关系图
- [ ] 集成到比赛详情

### Phase 4: 优化完善 (0.5天)
- [ ] 添加历史数据
- [ ] 优化算法参数
- [ ] 测试和调试

---

## 九、技术要点

### 9.1 数据更新

- **球员特色**: 赛季初录入，中途根据表现调整
- **出场概率**: 每场比赛前根据最新情况计算
- **板凳深度**: 每场比赛前重新评估

### 9.2 缓存策略

- **球员特色**: 长期缓存 (1周)
- **出场概率**: 短期缓存 (1小时)
- **板凳深度**: 临时缓存 (比赛前)

### 9.3 错误处理

- 球员数据缺失: 使用默认特色
- 替代关系未知: 基于位置推断
- 计算异常: 返回中性评分

---

## 十、数据来源

| 数据 | 来源 | 更新频率 |
|------|------|----------|
| 球员信息 | ESPN API | 每日 |
| 球员特色 | 手动录入 | 每月 |
| 出场记录 | ESPN API | 每场比赛后 |
| 伤病状态 | ESPN API | 每日 |
| 教练偏好 | 历史数据 | 每月 |

---

## 十一、已知限制

1. **球员特色**: 需要手动录入，工作量大
2. **出场概率**: 基于历史数据，可能不准确
3. **替代关系**: 需要根据战术分析确定
4. **实时更新**: 无法获取实时训练情况

---

## 十二、参考资料

- [SofaScore 替补席分析](https://www.sofascore.com/)
- [WhoScored 球员特色](https://www.whoscored.com/)
- [FBref 替补数据](https://fbref.com/)
- [Transfermarkt 球员身价](https://www.transfermarkt.com/)

---

_文档版本：v1.0 | 2026-06-13 | by AI Coding Engineer_
