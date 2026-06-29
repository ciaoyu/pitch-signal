# Architecture Overview

2026 PitchSignal — 服务端渲染 SPA + ESPN API + SQLite。

## Directory Structure

```
pitch-signal/
├── server.js          # 主进程 (Express-like HTTP) — 路由/中间件集成
├── lib/
│   ├── logger.js      # 结构化日志模块
│   ├── data-resolver.js  # WC2026 运行数据优先、只读 seed 回退
│   ├── app.js         # HTTP Server 与中间件装配
│   ├── elo.js         # Elo 评分引擎 (K 值动态调整, 主场优势)
│   ├── poisson.js     # Poisson/Dixon-Coles 进球模型 (λ 参数训练)
│   ├── prediction.js  # 预测融合引擎 (Poisson × Elo × HomeAdv × Odds fallback)
│   ├── backtest.js    # Walk-forward 回测
│   ├── db.js          # SQLite (better-sqlite3)
│   ├── team_resolver.js  # 球队名称多源匹配 (ESPN/Odds/中文别名/模糊)
│   ├── matchup-spatial.js  # 空间对位模拟 (阵型→坐标→球员配对)
│   ├── roster_cache.js  # 阵容三级缓存 (ESPN→本地→降级)
│   ├── output-rules.js  # 概率融合+置信度+外部信号闸门
│   ├── security.js      # 安全相关功能
│   ├── services/      # 服务编排层 (PredictionService, ReviewService)
│   └── routes/        # API 端点模块 (entities, prediction, news, matchup, odds 等)
├── static/js/         # 前端 SPA 模块 (多文件结构, app.js 为主入口)
├── templates/         # HTML 模板
├── scripts/           # 测试脚本与运维/工具脚本
├── data/              # 可变运行数据 (SQLite, snapshots, wc2026 overlay)
├── resources/seed/    # 版本控制内的只读 WC2026 基线数据
├── docs/              # 项目文档与治理规则
└── middleware/        # 请求与安全中间件 (CORS, Rate Limit)
```

## Prediction Pipeline

```

## WC2026 Data Resolution

读取统一通过 `lib/data-resolver.js`：先查 `$DATA_PATH/wc2026/<file>`，不存在时
回退到 `resources/seed/wc2026/<file>`。同步和桥接构建脚本只允许原子写入运行
目录。Seed 位于持久卷挂载点之外，避免容器挂载 `/usr/src/app/data` 时遮蔽基线。
ESPN scoreboard → Elo Calculator → Poisson λ Estimator → Probability Fusion
                                                            ↓
                              (Polymarket/Pundit/AI — 公测版硬关,全 null)
                                                            ↓
                              output-rules.js → { fusion, confidence, gates, disclaimer }
```

## Key Documents

- API Reference: [docs/API.md](docs/API.md) (42+ endpoints)
- Beta Safety: [docs/operations/public-beta-safety-manual.md](docs/operations/public-beta-safety-manual.md)
- Deployment: [docs/deployment-guide-railway.md](docs/deployment-guide-railway.md)
- Prediction Model: [docs/prediction_model_explanation.md](docs/prediction_model_explanation.md)
- Repository Layout: [docs/repository-layout.md](docs/repository-layout.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Tech Stack

- **Runtime**: Node.js ≥ 22
- **Database**: SQLite (better-sqlite3, WAL mode)
- **Frontend**: Vanilla JS (no framework, Tailwind CSS CDN)
- **Data Source**: ESPN API (scores/rosters/standings/news)
- **Testing**: `node --test` + manual assertion runners
- **Deploy**: Docker + Railway (volume at `/usr/src/app/data`)
