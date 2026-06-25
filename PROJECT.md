# ⚽ 世界杯 Dashboard + 预测系统 · 完整项目文档

> **项目名称**: 世界杯 Dashboard + 预测系统  
> **创建日期**: 2026年6月13日  
> **版本**: v2.0  
> **状态**: 开发中

---

## 一、项目概述

### 1.1 项目定位

**核心功能**：
- 实时比分、赛程、球队、球员数据展示
- 对位分析、盘口分析、教练分析
- **新增**: 比赛结果预测系统

**目标用户**：球迷、数据分析师、赛事爱好者

### 1.2 技术架构

```
┌─────────────────────────────────────────┐
│         PWA 前端 (index.html)            │
│   Tailwind CSS + Vanilla JS              │
│   5 Tab 导航（比分/赛程/对位/球员/预测）  │
│   比赛详情 Modal（核心分析页）             │
│   SVG 对位阵型图 / 盘口趋势 / 角球追踪    │
│   Service Worker (离线缓存)               │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│      Node.js 后端 (server.js)            │
│   纯 HTTP 模块，零依赖                    │
│   30+ API 端点                           │
│   内存缓存 + 本地 JSON 存储               │
└─────────────┬───────────────────────────┘
              │
┌─────────────┴───────────────────────────┐
│            数据层                         │
│   ESPN API (比分/赛程/球员/统计)          │
│   The Odds API (盘口，41家博彩公司)       │
│   ratings.json (48队 748人评分+特色)      │
│   matchup-api.js (对位引擎)               │
│   教练数据 (静态，16+队详细)              │
│   场馆数据 (静态，16座)                   │
│   Tavily API (新闻搜索)                   │
│   OpenWeatherMap (天气)                   │
└─────────────────────────────────────────┘
```

---

## 二、已完成功能模块

### 2.1 核心数据展示

| 模块 | 状态 | API 端点 | 说明 |
|------|------|----------|------|
| 赛程表 | ✅ | `/api/schedule` | 按日期浏览 |
| 实时比分 | ✅ | `/api/scores` | 实时更新 |
| 积分榜 | ✅ | `/api/standings` | 12组积分榜 |
| 比赛详情 | ✅ | `/api/match/:id` | 进球+统计 |
| 球队信息 | ✅ | `/api/team/:id` | 基础信息+阵容 |
| 球员信息 | ✅ | `/api/player/:id` | 基础信息 |

### 2.2 分析功能

| 模块 | 状态 | API 端点 | 说明 |
|------|------|----------|------|
| 对位评分 | ✅ | `/api/matchup/:id/formation` | 阵型对位分析 |
| 盘口分析 | ✅ | `/api/odds/:matchId` | 模拟盘口生成 |
| 角球预测 | ✅ | `/api/corner-analysis/:id` | 风格系数分析 |
| 教练对比 | ✅ | `/api/coach-compare/:a/:b` | 风格克制分析 |
| 历史交锋 | ✅ | `/api/match/:id/head-to-head` | 交锋统计 |

### 2.3 增强功能

| 模块 | 状态 | API 端点 | 说明 |
|------|------|----------|------|
| 场地天气 | ✅ | `/api/venue/:id/weather` | 16座场馆+天气影响 |
| 替补席分析 | ✅ | `/api/match/:id/bench` | 替代关系+出场概率 |
| 新闻聚合 | ✅ | `/api/match/:id/news` | Tavily搜索+AI摘要 |
| 球员增强 | ✅ | `/api/player/:id/enhanced` | 特色+近期表现 |
| 球队详情 | ✅ | `/api/team/:id/enhanced` | 近期表现+动态 |
| 数据图表 | ✅ | Chart.js | 雷达图可视化 |

---

## 三、预测系统设计

### 3.1 核心思路

```
原始数据（历届大赛） → 数据清洗入库 → 特征工程 → 算法模型 → 推演预测
```

**一句话**：建立一个包含历届世界杯、欧洲杯、美洲杯、非洲杯等大赛的历史数据库，通过算法在数据库中参考相似比赛的各种要素，推演未进行比赛的结果。

### 3.2 技术方案

| 方法 | 原理 | 用途 |
|------|------|------|
| **Elo 评分系统** | 每场比赛后两队评分动态调整 | 基础实力对比 |
| **Poisson 回归** | 根据历史进球数据建模 | 预测比分分布 |
| **相似度匹配** | 找历史上最相似的比赛参考 | 强强对话、爆冷场景 |
| **特征工程 + ML** | 多维特征输入（伤病、状态、主客场等） | 综合预测 |

### 3.3 数据维度

**基础数据**:
- 球队阵型、控球率、射门数、角球数
- 球员伤病、停赛、状态
- 天气、场地、裁判
- 赛程密度、旅途距离

**数据来源**:
- API-Football (付费)
- OpenLigaDB (免费)
- Football-data.org (免费)
- ESPN API (已有)

### 3.4 预测模型设计

#### Elo 评分系统

```javascript
// Elo 评分计算
function calculateElo(ratingA, ratingB, result, kFactor = 32) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  
  let scoreA, scoreB;
  if (result === 'win') { scoreA = 1; scoreB = 0; }
  else if (result === 'loss') { scoreA = 0; scoreB = 1; }
  else { scoreA = 0.5; scoreB = 0.5; }
  
  const newRatingA = ratingA + kFactor * (scoreA - expectedA);
  const newRatingB = ratingB + kFactor * (scoreB - expectedB);
  
  return { newRatingA, newRatingB };
}
```

#### Poisson 回归

```javascript
// 预测比分分布
function predictScore(lambdaHome, lambdaAway) {
  const maxGoals = 5;
  const probabilities = [];
  
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
      const prob = poissonPMF(homeGoals, lambdaHome) * 
                   poissonPMF(awayGoals, lambdaAway);
      probabilities.push({
        homeGoals,
        awayGoals,
        probability: prob
      });
    }
  }
  
  return probabilities;
}

// Poisson 概率质量函数
function poissonPMF(k, lambda) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}
```

#### 相似度匹配

```javascript
// 找历史上最相似的比赛
function findSimilarMatches(currentMatch, historicalMatches, limit = 10) {
  const features = [
    'eloDiff', 'formDiff', 'homeAdvantage', 'tournamentStage',
    'weather', 'altitude', 'daysSinceLastMatch'
  ];
  
  const similarMatches = historicalMatches.map(match => {
    let similarity = 0;
    features.forEach(feature => {
      const diff = Math.abs(currentMatch[feature] - match[feature]);
      similarity += 1 / (1 + diff);
    });
    return { match, similarity };
  });
  
  return similarMatches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
```

### 3.5 预测 API 设计

```
GET /api/predict/:matchId
```

**返回结构**:
```json
{
  "matchId": "760420",
  "home": { "team": "Qatar", "elo": 1520, "form": 0.6 },
  "away": { "team": "Switzerland", "elo": 1680, "form": 0.7 },
  "prediction": {
    "homeWin": 0.35,
    "draw": 0.28,
    "awayWin": 0.37,
    "expectedScore": { "home": 1.2, "away": 1.4 },
    "scoreDistribution": [
      { "home": 0, "away": 0, "probability": 0.12 },
      { "home": 1, "away": 0, "probability": 0.15 },
      ...
    ]
  },
  "similarMatches": [...],
  "features": {
    "eloDiff": 160,
    "formDiff": 0.1,
    "homeAdvantage": 0.15,
    "weatherImpact": 0.05
  }
}
```

---

## 四、API 端点清单

### 4.1 已实现 API (30+)

| 端点 | 说明 | 状态 |
|------|------|------|
| `/api/scores` | 实时比分 | ✅ |
| `/api/scores/:date` | 指定日期比分 | ✅ |
| `/api/standings` | 积分榜 | ✅ |
| `/api/schedule` | 赛程表 | ✅ |
| `/api/match/:id` | 比赛详情 | ✅ |
| `/api/player/:id` | 球员信息 | ✅ |
| `/api/player/:id/enhanced` | 球员增强 | ✅ |
| `/api/player/:id/traits` | 球员特色 | ✅ |
| `/api/team/:id` | 球队信息 | ✅ |
| `/api/team/:id/enhanced` | 球队详情增强 | ✅ |
| `/api/coach/:teamId` | 教练详情 | ✅ |
| `/api/coach-compare/:a/:b` | 教练对比 | ✅ |
| `/api/matchup/:id/formation` | 对位阵型分析 | ✅ |
| `/api/odds/:matchId` | 盘口数据 | ✅ |
| `/api/odds-history/:matchId` | 盘口变化历史 | ✅ |
| `/api/odds-alerts` | 盘口异动检测 | ✅ |
| `/api/corner-analysis/:id` | 角球预测 | ✅ |
| `/api/venue/:id` | 场馆信息 | ✅ |
| `/api/venue/:id/weather` | 场馆天气 | ✅ |
| `/api/match/:id/bench` | 替补席分析 | ✅ |
| `/api/match/:id/news` | 比赛新闻 | ✅ |
| `/api/match/:id/head-to-head` | 历史交锋 | ✅ |
| `/api/standings-qualified` | 出线形势 | ✅ |

### 4.2 待实现 API

| 端点 | 说明 | 状态 |
|------|------|------|
| `/api/predict/:matchId` | 比赛预测 | ⏳ |
| `/api/predict/history` | 预测历史 | ⏳ |
| `/api/predict/accuracy` | 预测准确率 | ⏳ |

---

## 五、文件结构

```
pitch-signal/
├── server.js                          # 后端 (纯 Node.js，零依赖)
├── templates/index.html               # 前端 (单页应用，143KB)
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
│   ├── VENUE_WEATHER_ANALYSIS.md      # 场地天气分析
│   ├── BENCH_ANALYSIS.md              # 替补席分析
│   ├── NEWS_AGGREGATION.md            # 新闻聚合
│   ├── PLAYER_ENHANCED_DATA.md        # 球员增强
│   └── TEAM_DETAIL_ENHANCED.md        # 球队详情增强
├── static/
│   ├── manifest.json                  # PWA 配置
│   ├── sw.js                          # Service Worker
│   └── test.html                      # 测试页面
├── REQUIREMENTS.md                    # 需求文档
└── package.json
```

---

## 六、技术栈

### 6.1 前端

- **框架**: Vanilla JS (零依赖)
- **样式**: Tailwind CSS
- **图表**: Chart.js
- **PWA**: Service Worker + manifest.json

### 6.2 后端

- **运行时**: Node.js
- **HTTP**: 纯 http 模块 (零依赖)
- **缓存**: 内存缓存 + 本地 JSON
- **API**: ESPN, The Odds API, Tavily, OpenWeatherMap

### 6.3 数据

- **球队数据**: ESPN API + ratings.json
- **球员数据**: ESPN API + ratings.json
- **盘口数据**: The Odds API + 模拟生成
- **新闻数据**: Tavily API
- **天气数据**: OpenWeatherMap

---

## 七、部署信息

- **端口**: 5099
- **地址**: http://192.168.2.231:5099
- **NAS**: Z4Pro-8ZYG
- **同步**: Syncthing (NAS ↔ MacBook)

---

## 八、待完成任务

### 8.1 高优先级

| 任务 | 状态 | 说明 |
|------|------|------|
| 预测模块实现 | ⏳ | Elo + Poisson + 相似度匹配 |
| 教练数据库扩展 | ⏳ | 当前16+队，目标48队 |
| MacBook AI问答逻辑 | ⏳ | cherry-pick 待合并 |

### 8.2 中优先级

| 任务 | 状态 | 说明 |
|------|------|------|
| 盘口API修复 | ⏳ | The Odds API 返回 no_match_found |
| 出线形势分析 | ⏳ | 需要概率计算引擎 |
| 历史数据库建设 | ⏳ | 历届大赛数据 |

### 8.3 低优先级

| 任务 | 状态 | 说明 |
|------|------|------|
| Tab 重构 | ⏳ | 合并精简为5导航 |
| ML 模型优化 | ⏳ | 提升预测准确率 |
| 多维特征输入 | ⏳ | 增加更多特征维度 |

---

## 九、相关文档

| 文档 | 位置 | 说明 |
|------|------|------|
| 需求文档 | `REQUIREMENTS.md` | 完整需求清单 |
| 评分系统 | `matchup-rating/SCORING_SYSTEM_DESIGN.md` | 评分算法设计 |
| 盘口分析 | `matchup-rating/ODDS_ANALYSIS_ENGINE.md` | 盘口分析引擎 |
| 角球预测 | `matchup-rating/CORNER_PREDICTION_MODEL.md` | 角球预测模型 |
| 对位阵型 | `matchup-rating/FORMATION_MATCHUP_TECH.md` | 对位阵型图方案 |
| 场地天气 | `matchup-rating/VENUE_WEATHER_ANALYSIS.md` | 场地天气分析 |
| 替补席 | `matchup-rating/BENCH_ANALYSIS.md` | 替补席分析 |
| 新闻聚合 | `matchup-rating/NEWS_AGGREGATION.md` | 新闻聚合系统 |
| 球员增强 | `matchup-rating/PLAYER_ENHANCED_DATA.md` | 球员增强数据 |
| 球队详情 | `matchup-rating/TEAM_DETAIL_ENHANCED.md` | 球队详情增强 |
| 可行性分析 | `memory/2026-06-13-worldcup-prediction-app.md` | 预测App可行性 |

---

## 十、项目历史

### 2026-06-13 (今日)

- ✅ 10个功能模块完成
- ✅ 5份设计文档
- ✅ 盘口API修复 (模拟盘口生成)
- ✅ 教练ID映射修复 (16+球队)
- ✅ 出线形势分析 (从比赛结果计算)
- ✅ 球队ID映射修复
- ✅ 国旗emoji修复
- ✅ 部分英文翻译
- ✅ 预测App可行性分析记录

---

*文档版本: v2.0 | 2026-06-13 | by NAS Agent*
