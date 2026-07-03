<!-- 提示：更新本文件时请同步更新 README.md -->
# ⚽ PitchSignal

**PitchSignal** 是一个面向 2026 年 FIFA 世界杯的综合数据分析看板，提供实时积分榜、基于 Poisson 与 Elo 模型的比赛预测、空间对位分析，以及交互式淘汰赛对阵图。

👉 [立即体验公开测试版](https://pitch-signal-production.up.railway.app)（部分功能在 Beta 阶段处于关闭状态）

README in [English](README.md)

## 🌟 核心功能
- **实时赛事集成**：从 ESPN API 获取实时赛程、比分和积分榜。
- **高级预测分析**：使用定制的 Dixon-Coles 修正 Poisson 模型 + Elo 评分，计算即将进行的比赛的胜/平/负概率。
- **交互式淘汰赛对阵图**：基于官方 2026 赛制规则可视化 32 强淘汰赛阶段。
- **空间对位分析**：模拟球队阵型及攻防位置的正面交锋。
- **实时球队数据**：提取球队名单数据，实时展示平均年龄、教练信息与状态。

## 🚀 快速开始

### 前置条件
- Node.js（推荐 v22）
- npm

### 安装
```bash
npm install
```
*（如果在跨设备同步后遇到 `better-sqlite3` 原生绑定错误，运行 `npm rebuild better-sqlite3`）*

### 启动服务器
```bash
npm start
```
应用将运行在 `http://127.0.0.1:5099`

### 测试
```bash
npm test
```
运行预测模型、Elo 评分与 Poisson 分布逻辑的测试套件。

## 📂 项目结构
- `/lib` - 核心业务逻辑：`db.js`、`elo.js`、`poisson.js`、`prediction.js`
- `/lib/routes` - 按实体、预测、新闻和核心数据模块化的 API 处理器
- `/static` - 前端 JS、CSS 与 SVG 资源
- `/templates` - 单页应用 HTML
- `/data` - 静态 JSON 文件（对阵图、基础评分、离线抓取数据）
- `/data/sources/world-cup-history` - 用于历史交锋数据补充的本地历史 CSV 输入
- `/scripts` - 数据抓取工具（如 Transfermarkt 身价数据）
- `/middleware`、`/services` - HTTP 中间件与领域服务

## 🚢 部署

### Railway（推荐）

1. 创建 Railway 项目并连接 GitHub 仓库。
2. 在挂载路径 `/usr/src/app/data` 添加一个**卷**（SQLite + 快照 + 运行时 JSON）。
3. 设置环境变量（见下文）。
4. Railway 会自动检测 `Dockerfile`。

### Docker（自托管）

```bash
docker build -t pitch-signal .
docker run -p 5099:5099 -v $(pwd)/data:/usr/src/app/data pitch-signal
```

> ⚠️ SQLite 不支持多实例并发写入。请将 `numInstances: 1`（Railway）或 `replicas: 1`（compose）设置为单实例。

## 🔐 环境变量

| 变量 | 是否必需 | 默认值 | 说明 |
|----------|----------|---------|-------|
| `PORT` | 否 | `5099` | 服务器端口 |
| `NODE_ENV` | 否 | `development` | `production` 会启用更严格的安全策略 |
| `DATA_PATH` | 否 | `./data` | SQLite、快照及运行时 WC2026 数据的可变目录，部署时必须挂载为持久卷 |
| `SEED_DATA_PATH` | 否 | `./resources/seed/wc2026` | 只读 WC2026 种子数据覆盖路径，通常无需设置 |
| `DB_PATH` | 否 | `${DATA_PATH}/predictions.db` | 覆盖 SQLite 数据库路径 |
| `CORS_ORIGINS` | 否 | `localhost:5099` | 允许的浏览器来源，逗号分隔 |
| `RATE_LIMIT_MAX` | 否 | `100` | 每个限流窗口内的最大请求数 |
| `RATE_LIMIT_WINDOW_MS` | 否 | `60000` | 限流窗口时长（毫秒） |
| `THE_ODDS_API_KEY` | 否 | — | the-odds-api.com 密钥，用于市场赔率/分歧分析 |
| `ODDS_API_KEY` | 否 | — | `THE_ODDS_API_KEY` 的旧版别名 |
| `OWM_API_KEY` | 否 | — | OpenWeatherMap 密钥（场馆天气） |
| `BALLDONTLIE_API_KEY` | 否 | — | balldontlie.io 名单/数据补充 |
| `TAVILY_API_KEY` | 否 | — | Tavily 搜索（AI 赛后研究） |
| `ANTHROPIC_API_KEY` | 否 | — | AI 赛后复盘（实验性，Beta 阶段禁用） |
| `VAPID_PUBLIC_KEY` | 否 | — | Web Push 公钥（进球通知） |
| `VAPID_PRIVATE_KEY` | 否 | — | Web Push 私钥（进球通知） |
| `VAPID_SUBJECT` | 否 | `mailto:ops@pitchsignal.app` | Web Push 协议要求的联系方式 URI |
| `ADMIN_TOKEN` | **Beta 阶段必须不设置** | — | 受保护端点的兜底令牌 |
| `BOT_API_TOKEN` | **Beta 阶段必须不设置** | — | Bot 聊天端点令牌 |
| `WRITE_API_TOKEN` | **Beta 阶段必须不设置** | — | 写入端点令牌 |
| `POLYMARKET_ENABLED` | **Beta 阶段必须为 `false`** | `false` | 外部市场赔率融合 |
| `PUNDIT_ENABLED` | **Beta 阶段必须为 `false`** | `false` | 专家观点聚合 |
| `AUTO_CALIBRATION` | **Beta 阶段必须为 `false`** | `false` | 模型自动校准 |
| `AI_POSTMORTEM_ENABLED` | **Beta 阶段必须为 `false`** | `false` | 后台 AI 赛后复盘任务 |
| `PRE_SNAPSHOT_MINUTES` | 否 | `30` | 开球前多少分钟拍摄预测快照 |
| `GROUP_POST_MINUTES` | 否 | `120` | 小组赛结束后多少分钟发布复盘 |
| `KNOCKOUT_POST_MINUTES` | 否 | `180` | 淘汰赛结束后多少分钟发布复盘 |
| `ANALYSIS_DELAY_MINUTES` | 否 | `10` | 赛后分析运行前的延迟时间 |

> **公开 Beta**：三个安全令牌必须均不设置 → 匿名写入将返回 401。
> 三个功能闸门在启动时都会被强制覆盖为 `false`。
> 详见 `docs/operations/public-beta-safety-manual.md`。

## 📖 API 参考

完整端点文档：**[docs/API.md](docs/API.md)**

快速概览：

| 模块 | 端点 | 说明 |
|--------|-----------|-------------|
| 核心 | `/api/scores`、`/api/standings`、`/api/schedule`、`/api/match/:id` | 赛程、比分、积分榜 |
| 预测 | `/api/elo/*`、`/api/match-review/*`、`/api/post-match-review/*` | Elo 排名、预测、复盘 |
| 实体 | `/api/player/:id`、`/api/team/:id`、`/api/coach/:teamId` | 球员/球队/教练资料 |
| 对位 | `/api/h2h/*`、`/api/matchup/*`、`/api/analysis/*` | 历史交锋、阵型、空间分析 |
| 新闻 | `/api/match/:id/news`、`/api/news/search` | 比赛新闻、搜索 |
| Bot | `POST /api/bot/chat` | AI 问答（需认证令牌） |
| 赔率 | `/api/odds/*`、`/api/odds-alerts` | 博彩赔率（无 API 密钥时使用模拟数据） |
| 场馆 | `/api/venue/:id`、`/api/venue/:id/weather` | 场馆信息、天气 |
| 健康检查 | `GET /health` | 就绪检查（数据库故障时返回 503） |

## 📚 文档

- **[docs/repository-layout.md](docs/repository-layout.md)** - 新文件应放置的位置，以及哪些文档仅限内部使用
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - 系统架构概览
- **[ENVIRONMENT.md](ENVIRONMENT.md)** - 环境变量与密钥管理规范
- **[CHANGELOG.md](CHANGELOG.md)** - 版本历史
- **[docs/API.md](docs/API.md)** - 完整 API 参考
- **[docs/VERSIONING.md](docs/VERSIONING.md)** - 静态资源/缓存版本策略
- **[docs/prediction_model_explanation.md](docs/prediction_model_explanation.md)** - 预测模型工作原理
- **[docs/prediction-model-methodology.md](docs/prediction-model-methodology.md)**（[中文](docs/prediction-model-methodology.zh.md)）- 完整方法论论文：架构、评估协议、964 场回测结果及诚实的局限性说明
- **[docs/deployment-guide-railway.md](docs/deployment-guide-railway.md)** - Railway 部署指南
- **[docs/operations/public-beta-safety-manual.md](docs/operations/public-beta-safety-manual.md)** - 公开 Beta 安全策略与闸门

## 📄 许可证

代码：[ISC](LICENSE)。第三方数据署名（FIFA、Open-Meteo、26worldcup.github.io 等）：见 [COPYRIGHT.md](COPYRIGHT.md)。

## ⚠️ 免责声明

- **实验性概率模型。** 预测结果来自定制的 Dixon-Coles 修正 Poisson + Elo 模型，输出仅为统计估计，仅供分析与娱乐使用 —— **不构成**任何结果的保证。
- **非博彩建议。** PitchSignal 中的任何内容均不构成博彩或投资建议，请勿据此下注。
- **依赖第三方数据。** 实时赛程、比分、积分榜与球队名单均来自 **ESPN API**（以及可选的 OpenWeatherMap / 赔率供应商）。PitchSignal 不拥有这些数据，其可用性、准确性与覆盖范围完全取决于上游数据源，可能随时中断或延迟，恕不另行通知。
- **单实例部署。** 持久化使用 **SQLite**（单写入者模式）。请仅运行**一个**实例 —— 不要水平扩展 —— 并将数据目录挂载在持久卷上。
