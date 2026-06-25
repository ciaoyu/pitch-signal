# API Reference

> 2026 PitchSignal — 11 模块, ~42 端点
> 公测版本 (2026-06)

---

## 约定

- **Base URL**: `http://127.0.0.1:5099`
- **响应格式**: JSON (`Content-Type: application/json`)
- **缓存**: 内存缓存 (Map)，各级 TTL 见各端点说明
- **鉴权**: 仅 `POST /api/bot/chat` 和 `POST /api/post-match-review*` / `POST /api/match-review` 需要 `Authorization: Bearer <token>`

---

## 目录

1. [Core — 赛程/比分/积分榜](#1-core)
2. [Standings — 扩展积分榜](#2-standings)
3. [Prediction — 预测与复盘](#3-prediction)
4. [Entities — 球员/球队/教练](#4-entities)
5. [Matchup — 对阵分析](#5-matchup)
6. [News — 新闻与交锋](#6-news)
7. [Bot — AI 问答](#7-bot)
8. [Odds — 赔率](#8-odds)
9. [Venue — 场馆](#9-venue)
10. [Health — 健康检查](#10-health)

---

## 1. Core

### `GET /api/scores`
获取今日全部比赛实时比分。

| 参数 | 类型 | 说明 |
|------|------|------|
| — | — | 无参数 |

**返回**: `{ matches: [...], fetched: "ISO", _dataQuality: "live", _source: "ESPN" }`

**缓存**: 60s

---

### `GET /api/scores/:date`
获取指定日期的比赛。

| 参数 | 类型 | 说明 |
|------|------|------|
| `date` | path | 格式 `YYYYMMDD`(如 `20260621`) |

**返回**: `{ matches: [...], date: "20260621", _dataQuality: "live", _source: "ESPN" }`

**缓存**: 300s

---

### `GET /api/standings`
获取 12 组积分榜(ESPN 官方 + 本地计算融合)。

**返回**:
```json
{
  "groups": [
    {
      "name": "小组 A",
      "standings": [
        { "name": "Brazil", "played": 2, "wins": 2, "draws": 0, "losses": 0, "gf": 5, "ga": 1, "gd": 4, "pts": 6, "logo": "..." }
      ]
    }
  ],
  "completedMatches": 24,
  "_dataQuality": "computed-live",
  "_source": "ESPN scoreboard + computed table"
}
```

**缓存**: 300s

---

### `GET /api/schedule`
获取近 7 天赛程(含今天及之前已赛日)。

**返回**: `{ matches: [...], _dataQuality: "live", _source: "ESPN" }`

**缓存**: 600s

---

### `GET /api/match/:id`
获取单场比赛详情(含阵容、进球、事件)。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | path | ESPN match ID |

**返回**: 包含 `home`, `away`, `goals`, `stats`, `status` 等完整比赛对象。

**缓存**: 120s

---

## 2. Standings

### `GET /api/standings-computed`
纯本地计算积分榜(从 ESPN scoreboard 逐场累计，不依赖 ESPN 官方 standings)。

**返回**: `{ groups: [...], completedMatches: N, _note: "纯积分榜｜从已赛结果计算", _source: "ESPN scoreboard" }`

---

### `GET /api/standings-qualified`
积分榜 + 出线状态推定(qualified / contending / eliminated / pending)。

**返回**: `{ groups: [...standings with .status...] }`

---

## 3. Prediction

### `GET /api/predict/:matchId`
综合预测(赛前快照管理 + PredictionService)。

| 参数 | 类型 | 说明 |
|------|------|------|
| `matchId` | path | ESPN match ID |

**返回**:
```json
{
  "match": { "homeId": "205", "awayId": "2869", "homeName": "Brazil", "awayName": "Senegal" },
  "homeWin": 0.52, "draw": 0.22, "awayWin": 0.26,
  "likelyScore": "2-1",
  "snapshot": { "saved": true, "id": 42 },
  "source": "honest-baseline",
  "_note": "实验性概率模型，非投注建议"
}
```

> **公测**: `source` 恒为 `"honest-baseline"`(Polymarket/Pundit/AI 硬关)。

---

### `GET /api/elo/rankings`
Elo 排名列表(优先 DB → 内存计算 fallback → 回写 DB)。

**别名**: `GET /api/elo-rankings`

**返回**: `[ { teamId, name, nameI18n, rating, rank }, ... ]`

**缓存**: 600s

---

### `GET /api/elo/:team`
单队 Elo 详情。

| 参数 | 类型 | 说明 |
|------|------|------|
| `team` | path | ESPN team ID 或队名 |

**返回**: `{ teamId, rating, peakRating, source: "database"|"computed", fifaEquiv, ... }`

---

### `GET /api/qualification-probabilities`
出线概率模拟(10000 次 Monte Carlo)。

**返回**: `{ "小组 A": { "Brazil": { qualifyProb: 0.95, ... }, ... }, ... }`

**缓存**: 1800s

---

### `GET /api/match-review/:matchId`
比赛回顾 + 预测偏差分析(只读，不写 DB)。

| 参数 | 类型 | 说明 |
|------|------|------|
| `matchId` | path | ESPN match ID |

**别名**: `GET /api/match/:id/review`

**返回**: 含 `match`, `prediction`, `biasAnalysis`, `actual` 等字段的 review 对象。

---

### `GET /api/post-match-review/:matchId`
赛后预测闭环(快照 vs 实际，含赛后证据)。

| 参数 | 类型 | 说明 |
|------|------|------|
| `matchId` | path | ESPN match ID |

**别名**: `GET /api/match/:id/post-match-review`

**返回**: ReviewService 输出(含 `matchId`, `prediction`, `actual`, `evidence`, `review`)。

---

### `POST /api/post-match-review`
手动注入赛后复盘 (🔒 需鉴权)。

**Headers**: `Authorization: Bearer <WRITE_API_TOKEN|ADMIN_TOKEN>`

**Body**:
```json
{
  "matchId": "...",
  "homeScore": 2, "awayScore": 0,
  "evidence": { "news": "...", "analysis": "..." }
}
```

---

### `POST /api/post-match-review/:matchId`
同上，matchId 来自路径。

---

### `POST /api/match-review`
手动触发比赛回顾(通过 JSON body 提供比分)。🔒 需鉴权。

**Body**: `{ homeId, awayId, homeScore, awayScore, group?, matchDate?, venue? }`

---

## 4. Entities

### `GET /api/player/:id`
球员基本信息(ESPN)。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | path | ESPN athlete ID |

**返回**: `{ id, name, age, height, weight, nationality, position, jersey, headshot, team }`

**缓存**: 600s

---

### `GET /api/player/:id/enhanced`
球员详情(含赛季数据、近期状态、能力特质)。

**返回**: `{ playerId, name, position, club, traits[], clubStats, recentForm, nationalStats, marketValue, ... }`

---

### `GET /api/player/:id/traits`
球员能力特质摘要。

**返回**: `{ playerId, name, traits[], impactType: "creative"|"defensive"|"balanced", superSubRating }`

---

### `GET /api/team/:id`
球队信息(含阵容)。

**返回**: `{ id, name, nameI18n, logo, record, roster: [...], _rosterSource, _dataQuality }`

**缓存**: 600s

---

### `GET /api/team/:id/enhanced`
球队增强信息(阵容统计、排名、雷达图、赛程)。

**返回**: 含 `roster`, `overview`, `recentForm`, `radar`, `squadChanges`, `schedule` 等。

---

### `GET /api/coach/:teamId`
教练信息。

| 参数 | 类型 | 说明 |
|------|------|------|
| `teamId` | path | ESPN team ID |

**返回**: `{ teamId, name, nationality, age, preferredFormation, ... }`

---

### `GET /api/coach-legacy/:teamId`
教练信息(旧版，已废弃)。

**返回**: `{ ..., _deprecated: true, _use: "/api/coach/:teamId" }`

---

## 5. Matchup

### `GET /api/h2h/:matchId`
历史交锋数据(ESPN + 本地 fallback)。

**返回**: `{ homeTeam, awayTeam, history: [...], stats: { home, away, overall }, recent: { home, away } }`

---

### `GET /api/team/:id/lineup`
球队阵容(评分数据库)。

**返回**: `{ teamId, name, formation, players: [{ id, name, pos, rating, x, y }] }`

---

### `GET /api/match/:id/bench`
替补深度分析(首发 vs 替补对比)。

**返回**: `{ matchId, homeTeam: { bench[], benchStrength, superSubCount, ... }, awayTeam: {...}, comparison }`

---

### `GET /api/matchup/:id/formation`
对阵阵型分析(SVG 对位)。

**返回**: 含两队 formation、battle zones、positional matchups 等。

---

### `GET /api/corner-analysis/:id`
角球预测分析。

**返回**: `{ matchId, homeTeam: { predicted, actual }, awayTeam: { predicted, actual }, analysis }`

---

### `GET /api/matchup-spatial/:home/:away`
空间对位模拟。

| 参数 | 类型 | 说明 |
|------|------|------|
| `home` | path | 主队 ESPN ID |
| `away` | path | 客队 ESPN ID |

**返回**: 空间对位矩阵 + 优势区域。

---

### `GET /api/analysis/:matchId`
综合比赛分析(场馆+风格+赔率)。

**返回**: `{ venueImpact, styleFit, odds, prediction }`

---

### `GET /api/coach-compare/:teamA/:teamB`
教练对比。

| 参数 | 类型 | 说明 |
|------|------|------|
| `teamA` | path | 主队 ESPN ID |
| `teamB` | path | 客队 ESPN ID |

**返回**: 两教练的 formation、style、record 对比。

---

## 6. News

### `GET /api/match/:id/news`
比赛相关新闻(Tavily 搜索 → fallback 生成 → 翻译)。

**返回**: `{ matchId, homeTeam, awayTeam, news: [...], total, lastUpdated, source: "tavily"|"mock" }`

**缓存**: 无(每次拉取最新)

---

### `GET /api/news/search`
新闻搜索。

| 参数 | 类型 | 说明 |
|------|------|------|
| `query` | query | 搜索关键词(必填) |

**返回**: `{ query, results: [...], total, source }`

---

### `GET /api/match/:id/head-to-head`
交锋历史(ESPN → deterministic fallback)。

**返回**: `{ matchId, homeTeam, awayTeam, history: [...], overall: { totalMatches, homeWins, awayWins, draws }, ... }`

---

## 7. Bot

### `POST /api/bot/chat`
AI 问答 (🔒 需鉴权)。

**Headers**: `Authorization: Bearer <BOT_API_TOKEN|ADMIN_TOKEN>`

**Body**:
```json
{
  "messages": [ { "role": "user", "content": "Brazil 下一场对手是谁？" } ],
  "context": "{ matchId: '...' }"
}
```

**返回**: `{ response: "...", source: "ai|fallback", ... }`

> **公测**: 生产环境无 token 返回 401；dev 环境无 token 进入 demo 模式。

---

## 8. Odds

### `GET /api/odds/:matchId`
赔率数据(The Odds API → mock fallback)。

**返回**: `{ homeWin, draw, awayWin, homeTeam, awayTeam, source: "live"|"mock" }`

**缓存**: 300s

---

### `GET /api/odds-history/:matchId`
赔率历史变化。

**返回**: `{ matchId, history: [{ timestamp, homeWin, draw, awayWin }] }`

---

### `GET /api/odds-alerts`
赔率异动告警。

**返回**: `{ alerts: [{ matchId, change, direction, ... }] }`

---

### `GET /api/odds-alerts-enhanced`
增强版赔率告警(含趋势分析)。

**返回**: `{ alerts: [...], trends: [...] }`

---

## 9. Venue

### `GET /api/venue/:id`
场馆信息。

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | path | 场馆 ID 或名称 |

**返回**: `{ id, name, city, country, capacity, altitude, grass, timezone, weather? }`

---

### `GET /api/venue/:id/weather`
场馆天气(OpenWeatherMap)。

**返回**: `{ id, weather: { temp, feelsLike, humidity, windSpeed, condition, description } }`

---

## 10. Health

### `GET /health`
就绪检查。

**返回 (200)**:
```json
{ "status": "healthy", "timestamp": "ISO", "uptime": 12345, "memory": { ... } }
```

**返回 (503)**: DB 不可达时:
```json
{ "error": "Database is unreachable", "status": 503 }
```

---

## 鉴权模型

| 端点 | 方法 | 鉴权 |
|------|------|------|
| `/api/bot/chat` | POST | `BOT_API_TOKEN` 或 `ADMIN_TOKEN` |
| `/api/post-match-review` | POST | `WRITE_API_TOKEN` 或 `ADMIN_TOKEN` |
| `/api/post-match-review/:matchId` | POST | `WRITE_API_TOKEN` 或 `ADMIN_TOKEN` |
| `/api/match-review` | POST | `WRITE_API_TOKEN` 或 `ADMIN_TOKEN` |
| 其他全部 | GET | 无 |

**公测规则**: 三个 token 全部不设 → 写接口返回 401。

---

*最后更新: 2026-06-23 · Workstream F*
