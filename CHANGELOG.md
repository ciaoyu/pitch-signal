# Changelog

## Unreleased

### Fixes
- **赛后复盘接入实时 Moment 数据 (Task D)**: 此前 `moment-sync` 每 60s 抓取的补水/中场/换人/进球结构化节点（含实时概率快照）完全没进赛后复盘 AI,`postMatchReview.js` prompt 里"识别补水→换人→进球"的指令形同空转。现 `lib/services/ReviewService.js` 新增 `getMatchMomentsTimeline()`,从 `match_moments` 表按 `match_id` 拉取本场全部节点(不再按 `prob_home_win` 过滤——真实数据里该列常为 NULL,过滤会导致查空),映射成 `summarizeSnapshotNode()` 认识的 node 形状（`trigger/minute/home/away/odds + 概率漂移 summary`,概率缺失时 `odds` 优雅降级为 `null`）,注入 `evidence.timeline`,经 `buildLiveTimelineI18n` 进入 `liveTimelineI18n` 与 AI prompt 上下文。同时补全 `nodeLabelI18n()` 映射表至 `moment-detector.js` 全部类型,避免新类型把英文 snake_case 当中文标签显示。去重按 `${minute}-${type}-${teamId}` 折叠跨 tick 重复换人、保留不同球队合法换人。回归测试 `scripts/test-moment-review-integration.js`(4 项测试 / 26 项断言)。已知限制：真实 `match_moments` 的 `prob_*` 列在直播无赛前预测快照时为 NULL（Track A 重定价未注入),此时 odds 优雅缺省,属 `moment-sync` 上游范畴(见 Task E)。

## v1.0.0-beta (2026-06)

### Public Beta

**Core Features**
- Live fixtures & scores (ESPN API)
- Group standings (12 groups, 48 teams)
- Knockout bracket visualization
- Elo + Poisson/Dixon-Coles probability predictions
- Spatial matchup analysis (formation simulation)
- AI post-match review (experimental, controlled access)
- AI Bot Q&A (controlled access, requires auth)

**Operational Safety**
- Polymarket / Pundit / AI auto-calibration: hard-disabled during beta
- All write endpoints gated behind auth tokens
- Readiness health check (503 on DB failure)
- Frontend prediction disclaimer (experimental model, not betting advice)
- Test database isolation (TEST_DB_PATH=:memory:)

**Known Limitations**
- Probability model is experimental — no accuracy metrics displayed
- Bot access is controlled (not public)
- AI post-match review translations pending

## v0.x (2026-05 ~ 2026-06)

### Development Phase
- Elo rating engine (dynamic K-factor, home advantage)
- Poisson/Dixon-Coles goal model
- ESPN API integration (scores, rosters, standings, news)
- Chinese team name mapping (team_names_zh.json)
- Team logo caching
- Coach database
- SVG formation diagrams
- Dark theme + animations
- Hash-based routing
- Post-match review engine
- Prediction snapshot system
- Walk-forward backtest framework
