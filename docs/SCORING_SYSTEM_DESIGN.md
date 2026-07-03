# 对位评分系统设计文档

## 一、系统总览

```
综合胜率预测 = 球员对位分(35%) + 教练差异分(15%) + 盘口市场信号(30%) + 场馆因素(10%) + 近期状态(10%)
```

每个维度 0-100 分，加权求和后映射到胜率预估。

---

## 二、评分维度详解

### 2.1 球员对位评分（权重 35%）

按三条线分别对位，再汇总：

```
对位总分 = 锋线对位(40%) + 中场对位(35%) + 防线对位(25%)
```

#### 每条线的计算方式：

```
线对位分 = Σ(本方球员评分 × 位置系数) / Σ对方对应位置球员评分
```

| 位置 | 位置系数 |
|------|---------|
| 前锋 (FW) | 1.2 |
| 边锋/攻击中场 (W/FW) | 1.1 |
| 中场 (MF) | 1.0 |
| 防守中场 (DMF) | 0.9 |
| 后卫 (DF) | 0.95 |
| 边后卫 (FB/WB) | 0.85 |
| 门将 (GK) | 1.0 |

#### 球员评分来源优先级：
1. 实时盘口隐含评分（最高权重，反映市场最新判断）
2. FIFA 游戏评分（基准值）
3. 赛季俱乐部表现分（Whoscored/SofaScore 均值）
4. 国家队近期表现（近 5 场国家队比赛评分）

#### 缺失球员处理：
- 主力缺阵 → 替补评分打 0.7 折
- 主力伤疑 → 替补评分打 0.85 折
- 确认首发 → 使用实际球员评分

### 2.2 教练差异分（权重 15%）

```
教练差异分 = 风格克制分(40%) + 经验差(25%) + 临场能力差(20%) + 阵型灵活性差(15%)
```

#### 风格克制矩阵（关键创新点）：

| 进攻方 \ 防守方 | 高位逼抢 | 控球传控 | 防守反击 | 身体对抗 | 全攻全守 |
|---------------|---------|---------|---------|---------|---------|
| **高位逼抢** | 均势(0) | 克制(+15) | 被克(-10) | 均势(0) | 均势(+5) |
| **控球传控** | 被克(-10) | 均势(0) | 克制(+10) | 克制(+5) | 均势(0) |
| **防守反击** | 克制(+15) | 被克(-10) | 均势(0) | 均势(+5) | 被克(-5) |
| **身体对抗** | 均势(0) | 被克(-5) | 被克(-5) | 均势(0) | 克制(+10) |
| **全攻全守** | 被克(-5) | 均势(0) | 克制(+5) | 被克(-10) | 均势(0) |

> 正值 = 进攻方风格克制防守方

#### 经验差计算：
- 世界杯执教场次差值归一化
- 洲际杯/联赛冠军数量加权
- 带国家队时长差值

#### 临场能力差：
- 半场落后逆转率差
- 换人后进球效率差
- 70 分钟后进球占比差

### 2.3 盘口市场信号（权重 30%）

```
盘口分 = 赔率隐含概率(60%) + 盘口变化趋势(25%) + 市场一致性(15%)
```

#### 赔率隐含概率：
```
隐含概率 = 1/赔率 / (1/主胜赔率 + 1/平局赔率 + 1/客胜赔率)
```
扣除抽水（vig）后归一化。

#### 盘口变化趋势分：
```
趋势分 = 100 × (初始赔率 - 当前赔率) / 初始赔率 × 方向系数
```
- 正向：赔率下降 = 市场看好 = 加分
- 负向：赔率上升 = 市场看衰 = 减分
- 阈值：±15% 为满分/零分

#### 市场一致性：
```
一致性分 = 100 × (1 - 博彩公司赔率标准差 / 平均赔率)
```
- Pinnacle vs Bet365 差异 >0.15 → 标记「市场分歧」
- 一致性高 → 信号可靠度高

### 2.4 场馆因素（权重 10%）

```
场馆分 = 主场优势(30%) + 草皮适配(25%) + 海拔影响(25%) + 天气影响(20%)
```

| 因素 | 评分逻辑 |
|------|---------|
| 主场优势 | 东道主 +15 分，中立场地 0 分 |
| 草皮适配 | 天然草 vs 人工草 vs 混合草，匹配球队偏好 |
| 海拔影响 | >2000m +20 分给主队/常驻高原队 |
| 天气影响 | 温度 >30°C 或 <5°C 影响欧洲球队；降雨影响技术型球队 |

### 2.5 近期状态（权重 10%）

```
状态分 = 近5场胜率(40%) + 进球效率(30%) + 防守质量(20%) + 对手质量(10%)
```

---

## 三、API 设计

### 3.1 对位评分 API

```
GET /api/matchup/:matchId
```

**Response Schema:**

```json
{
  "matchId": "760417",
  "home": "United States",
  "away": "Paraguay",
  "generatedAt": "2026-06-13T01:00:00Z",
  
  "scores": {
    "playerMatchup": {
      "score": 62.5,
      "weight": 0.35,
      "breakdown": {
        "attack": { "home": 68, "away": 45, "edge": "home" },
        "midfield": { "home": 55, "away": 52, "edge": "home" },
        "defense": { "home": 60, "away": 58, "edge": "home" }
      },
      "keyMatchups": [
        {
          "home": "Pulisic",
          "away": "Almiron",
          "position": "LW/RW",
          "homeRating": 8.2,
          "awayRating": 7.8,
          "note": "同位置对决，普利西奇稍占优"
        }
      ],
      "injuries": {
        "home": [],
        "away": [{ "name": "xxx", "impact": "high" }]
      }
    },
    
    "coachDiff": {
      "score": 65.0,
      "weight": 0.15,
      "breakdown": {
        "styleMatchup": { "edge": "home", "value": "+15" },
        "experienceGap": { "edge": "home", "value": "+8" },
        "adjustmentEdge": { "edge": "home", "value": "+10" },
        "formationFlex": { "edge": "even", "value": "0" }
      },
      "summary": "贝哈尔特高位逼抢对阿尔法罗防守反击，风格占优"
    },
    
    "marketSignal": {
      "score": 58.3,
      "weight": 0.30,
      "breakdown": {
        "impliedProb": { "home": "50.2%", "draw": "28.3%", "away": "21.5%" },
        "trend": { "direction": "up", "change": "+8%", "meaning": "市场持续看好主队" },
        "consistency": { "score": 85, "status": "high", "note": "31家机构一致" }
      }
    },
    
    "venueFactor": {
      "score": 72.0,
      "weight": 0.10,
      "breakdown": {
        "homeAdvantage": { "score": 15, "note": "美国主场" },
        "grassFit": { "score": 5, "note": "天然草，双方适应" },
        "altitude": { "score": 0, "note": "海平面" },
        "weather": { "score": -3, "note": "高温30°C，巴拉圭更适应" }
      }
    },
    
    "recentForm": {
      "score": 70.0,
      "weight": 0.10,
      "breakdown": {
        "home": { "last5": "W-W-D-W-L", "goalsFor": 12, "goalsAgainst": 4 },
        "away": { "last5": "W-D-L-W-D", "goalsFor": 6, "goalsAgainst": 5 }
      }
    }
  },
  
  "compositeScore": {
    "home": 62.8,
    "away": 37.2,
    "confidence": "medium",
    "winProb": {
      "homeWin": "55-60%",
      "draw": "25-28%",
      "awayWin": "15-18%"
    },
    "recommendedWatch": "美国实力占优，但需警惕巴拉圭防守反击"
  }
}
```

### 3.2 球员对位详细 API

```
GET /api/matchup/:matchId/players
```

返回每个位置的对位详情，包含双方球员卡片对比。

### 3.3 盘口异常告警 API（增强版）

```
GET /api/odds-alerts/enhanced
```

在现有告警基础上增加：
- 触发原因猜测（"检测到胜赔骤降 18% → 可能首发名单公布"）
- 历史类似案例回溯
- 对评分系统的影响预估

---

## 四、评分计算引擎伪代码

```javascript
function calculateCompositeScore(match) {
  const playerScore = calcPlayerMatchup(match.home.roster, match.away.roster, match.formation);
  const coachScore = calcCoachDiff(match.home.coach, match.away.coach);
  const marketScore = calcMarketSignal(match.odds, match.oddsHistory);
  const venueScore = calcVenueFactor(match.venue, match.home, match.away);
  const formScore = calcRecentForm(match.home.recent, match.away.recent);

  const weights = { player: 0.35, coach: 0.15, market: 0.30, venue: 0.10, form: 0.10 };
  
  const composite = 
    playerScore * weights.player +
    coachScore * weights.coach +
    marketScore * weights.market +
    venueScore * weights.venue +
    formScore * weights.form;

  // 归一化到胜率预测
  const homeWinProb = sigmoid(composite - 50) * 100;
  
  return {
    homeScore: composite,
    awayScore: 100 - composite,
    homeWinProb,
    confidence: calcConfidence(weights, match),
    breakdown: { playerScore, coachScore, marketScore, venueScore, formScore }
  };
}

function sigmoid(x, k = 0.08) {
  return 1 / (1 + Math.exp(-k * x));
}
```

---

## 五、权重调优策略

初始权重基于经验设定，后续需要数据校准：

1. **小组赛阶段**：使用初始权重
2. **淘汰赛 8 强**：用小组赛 48 场结果做回归，调优权重
3. **半决赛+决赛**：用前 60 场结果做二次校准

调优方法：最小化 `(预测胜率 - 实际结果)^2`

---

## 六、数据依赖清单

| 数据 | 来源 | 优先级 | 备注 |
|------|------|--------|------|
| 球员评分 | FIFA/ESPN/Whoscored | P0 | 基础数据 |
| 首发阵容 | ESPN lineup API | P0 | 赛前 1 小时可获取 |
| 盘口赔率 | The Odds API | P0 | 已接入 |
| 盘口历史 | 本地快照 | P0 | 积累中 |
| 教练信息 | 手工录入/维基 | P1 | 当前已有 |
| 场馆信息 | 维基/天气 API | P1 | 需填充 |
| 近期战绩 | ESPN team stats | P1 | API 可查 |
| 球员伤病 | ESPN injury report | P1 | API 可查 |
| 历史交锋 | ESPN head2head | P2 | 淘汰赛重要 |

---

## 七、下一步实现顺序

1. **Phase 1**：`/api/matchup/:matchId` — 基础评分框架 + 盘口 + 教练（当前已有数据的维度）
2. **Phase 2**：球员对位精细计算 — 需要 roster + 首发阵容
3. **Phase 3**：场馆 + 天气 + 状态完整接入
4. **Phase 4**：权重自动调优 + 准确率追踪面板
