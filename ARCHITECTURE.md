# Architecture Overview

2026 PitchSignal — 服务端渲染 SPA + ESPN API + SQLite。

## Directory Structure

```
pitch-signal/
├── server.js          # 主进程(Express-like HTTP, ~2390 行) — 路由注册/ESPN fetch/缓存/渲染
├── lib/
│   ├── elo.js         # Elo 评分引擎(K 值动态调整,主场优势)
│   ├── poisson.js     # Poisson/Dixon-Coles 进球模型(λ 参数训练)
│   ├── prediction.js  # 预测融合引擎(Poisson × Elo × HomeAdv × Odds fallback)
│   ├── backtest.js    # Walk-forward 回测(按 kickoff 排序)
│   ├── db.js          # SQLite(better-sqlite3,同步 API)
│   ├── team_resolver.js  # 球队名称多源匹配(ESPN/Odds/中文别名/模糊)
│   ├── matchup-spatial.js  # 空间对位模拟(阵型→坐标→球员配对)
│   ├── roster_cache.js  # 阵容三级缓存(ESPN→本地→降级)
│   ├── output-rules.js  # 概率融合+置信度+外部信号闸门(公测版全关)
│   ├── security.js       # constantTimeEqual(token 防时序)
│   ├── services/PredictionService.js  # 预测服务编排
│   └── routes/        # 10 模块 42+ API 端点(entities/prediction/news/matchup/odds/...)
├── static/js/app.js   # 前端 SPA(4297 行)
├── templates/index.html
├── scripts/           # 9 测试脚本(~230 断言)+ 运维/工具脚本
├── data/              # SQLite + ratings.json + 静态 JSON + source inputs
├── docs/              # 共享文档/治理规则/运营安全手册
└── middleware/         # CORS/CSP/缓存/限流
```

## Prediction Pipeline

```
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
