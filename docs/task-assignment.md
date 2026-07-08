# 总任务分配表

> 3 人分工，可并行，互不阻塞。每人完成后交 Claude 验收。

---

## Person A — 基础设施 + 配置

职责：Git 清理、CI/CD、安全、配置、文档

### A1: Git 仓库清理（git-hygiene 全部）
- [ ] `.gitignore` 追加条目（scratch/、docs/archive/、data/sources/seed/、.codebuddy/、.workbuddy/、*.bak、data/sources/world-cup-history/ 等）
- [ ] `git rm --cached` 移除已追踪的 world cup data CSV（3 文件，2.1MB）
- [ ] 将 25 个未提交文件拆分为 3-4 个语义化 commit（refactor/chore/feat）
- [ ] 图标文件 icon-192.png/icon-512.png 被删除，确认 icon-v3 替代后提交
- **涉及文件**：`.gitignore`、所有 git staging
- **完成标志**：`git status` 无 modified，npm test 全绿

### A2: CI 阻断部署（testing 问题 4）
- [ ] `.github/workflows/deploy-railway.yml` 取消注释 `needs: [build-and-test]`
- [ ] `.github/workflows/deploy-render.yml` 添加 `needs: [build-and-test]`
- **涉及文件**：`.github/workflows/deploy-railway.yml`（第 12-13 行）、`.github/workflows/deploy-render.yml`
- **完成标志**：CI 失败时 deploy workflow 显示 skipped

### A3: LICENSE + version.json
- [ ] 创建 `LICENSE` 文件（ISC 全文，copyright holder 确认）
- [ ] 修正 `version.json` 日期（version 字段与 updated 字段逻辑一致）
- **涉及文件**：`LICENSE`（新建）、`version.json`

### A4: 安全 — unhandledRejection 处理器（审计 HIGH）
- [ ] `server.js` 顶部加 `process.on('unhandledRejection', ...)` 和 `process.on('uncaughtException', ...)`
- **涉及文件**：`server.js`（~第 30 行附近）
- **完成标志**：故意触发 unhandled rejection 时进程不静默退出

### A5: 安全 — auth token 查询字符串泄露（审计 MEDIUM）
- [ ] `middleware/auth-write.js` 中 `?token=` 方式改为仅从 Authorization header 读取，或对含 token 的请求路径做日志脱敏
- **涉及文件**：`middleware/auth-write.js`（第 29-32 行）

### A6: 配置 — .env.example 补全（审计 MEDIUM）
- [ ] 将代码中使用但 .env.example 未列出的环境变量补充完整（约 15 个：DB_PATH、CORS_ORIGINS、RATE_LIMIT_MAX/MAX_MS、HEALTHCHECK_BASE_URL、调度相关变量等）
- **涉及文件**：`.env.example`

### A7: 配置 — docker-entrypoint 路径不匹配（审计 LOW）
- [ ] `docker-entrypoint.sh` 中默认路径从 `/data/predictions.db` 改为 `${DATA_PATH:-/usr/src/app/data}/predictions.db`
- **涉及文件**：`docker-entrypoint.sh`（第 10 行）

### A8: 配置 — .dockerignore 验证（审计 LOW）
- [ ] 确认 `.dockerignore` 排除 scratch/、test*、data/sources/world-cup-history/、docs/archive/、docs/、node_modules/
- **涉及文件**：`.dockerignore`

### A9: PWA 图标替换（审计 HIGH）
- [ ] `static/icon-192-v3.png` 和 `static/icon-512-v3.png` 当前各 69 字节，是占位文件，浏览器无法显示
- [ ] 替换为真实 PNG 图标（192x192 和 512x512）
- [ ] `static/manifest.json` 添加 `id` 和 `scope` 字段
- **涉及文件**：`static/icon-192-v3.png`、`static/icon-512-v3.png`、`static/manifest.json`

### A10: 文档 — CLAUDE.md + README 同步（审计 LOW）
- [ ] 创建 `CLAUDE.md`（项目上下文、构建命令、测试命令、约定）
- [ ] README 环境变量表与 .env.example 同步（缺 POSTMORTEM_*、BALLDONTLIE_API_KEY、TAVILY_API_KEY、AI_POSTMORTEM_ENABLED、DB_PATH、CORS_ORIGINS）
- **涉及文件**：`CLAUDE.md`（新建）、`README.md`

---

## Person B — 测试质量 + 代码清理

职责：集成测试修复、杂散文件整理、死代码清理、空 catch 修复

### B1: 集成测试修复（testing 问题 1）
- [ ] `scripts/test-post-match-review.js`：server 就绪检测改为轮询 `GET /health`（200ms 间隔，最多 10 秒）
- [ ] `SIGKILL` → `SIGTERM`，等进程退出
- [ ] main 函数包在 `try/finally`，finally 做 cleanup（杀进程 + 删 DB 文件）
- [ ] 文件头注释端口 5099 → 5091
- **涉及文件**：`scripts/test-post-match-review.js`（startTestServer ~第 51-91 行、cleanup ~第 458-466 行）
- **完成标志**：`npm test` 连续 5 次全绿

### B2: 根目录杂散测试文件（testing 问题 2）
- [ ] `test_backtest_sort.js`、`test_knockout.js`：迁移到 `scripts/test-*.js` 并加入 npm test
- [ ] 其余 6 个临时文件移入 `scratch/`
- [ ] 统一命名为 `scripts/test-kebab-case.js`
- **涉及文件**：根目录 8 个 test 文件、`scratch/`
- **完成标志**：根目录无 test-*.js 或 test_*.js

### B3: 死代码清理（审计 3.1-3.4）
- [ ] `lib/routes/matchup.js:6` 删除未使用的 `ODDS_API_KEY`
- [ ] `lib/routes/matchup.js:821` 删除 `.toString()` 调试代码
- [ ] `lib/routes/prediction.js:94-100` 删除重复的 PredictionService/ReviewService 实例化，使用 deps 传入的实例
- [ ] `lib/fifa_scraper.js`：确认 `getMatchLineups` 和 `getTeamRecentMatches` 是 stub（永远返回 null/[]），决定是实现还是移除
- **涉及文件**：`lib/routes/matchup.js`、`lib/routes/prediction.js`、`lib/fifa_scraper.js`、`lib/routes/lineups.js`

### B4: 空 catch 块日志补充（审计 2.1，MEDIUM）
- [ ] 按文件逐个添加 `console.warn` 或 `console.debug`，优先处理生产关键路径：
  - `lib/db.js:333`（JSON parse 失败）
  - `lib/services/PredictionService.js:118,292`
  - `lib/services/ReviewService.js:106`
  - `lib/routes/core.js:83`（ESPN fetch 静默吞错）
  - `lib/claudeClient.js:81,129,136`
- [ ] 次要路径（lineups-source、matchup、entities、venueFactors 等）加 `console.debug`
- **涉及文件**：约 12 个文件，40+ 处 catch 块
- **完成标志**：`grep -rn 'catch {}' lib/` 返回空

---

## Person C — 数据分析 + 模型精度

职责：backtest 置信区间、参数扫描、样本扩充

### C1: Bootstrap 置信区间（backtest 问题 2，最高优先级）
- [ ] `lib/backtest.js` 中 `_walkForward()` 返回值增加 CI 字段
- [ ] 实现 `bootstrapCI(scores, n=10000, alpha=0.05)` 函数，对 Brier、LogLoss、Accuracy 分别计算
- [ ] `compareBaseline()` 中加入 CI 重叠判断：重叠则差异不显著
- [ ] 输出格式：`Brier: 0.421 [95% CI: 0.389, 0.454]`
- **涉及文件**：`lib/backtest.js`（_walkForward ~第 142-152 行、compareBaseline ~第 268-271 行）
- **完成标志**：`node scripts/run-backtest.js` 输出含 CI 区间

### C2: 参数扫描工具（backtest 问题 3）
- [ ] 新建 `scripts/param-sweep.js`，网格搜索 4 个核心参数：
  - Elo K-factor: [30, 40, 50, 60, 70, 80]（lib/elo.js:13）
  - Dixon-Coles rho: [-0.20, -0.15, -0.13, -0.10, -0.05]（lib/poisson.js:104）
  - Elo 权重: [0.20, 0.25, 0.30, 0.35, 0.40]（lib/prediction.js:21）
  - Poisson 权重: [0.15, 0.20, 0.25, 0.30, 0.35]（lib/prediction.js:22）
- [ ] 用 Bootstrap CI 做验收：新配置 CI 下界 > 旧配置 CI 上界才算改进
- [ ] 输出最优参数组合 + Brier/LogLoss/Accuracy 及 CI
- **涉及文件**：`scripts/param-sweep.js`（新建）、`lib/backtest.js`、`lib/elo.js`、`lib/poisson.js`、`lib/prediction.js`
- **完成标志**：`node scripts/param-sweep.js` 输出参数排名表

### C3: 历史数据扩充（backtest 问题 1，中期）
- [ ] 收集 Euro 2020、Copa America 2021、Euro 2024 比赛数据（JSON 格式与 worldcup_*.json 一致）
- [ ] `lib/backtest.js` 的 `loadHistory()` 支持加载新数据文件
- [ ] 标记数据来源字段（source: 'euro2020' / 'copa2021' / 'euro2024'）
- [ ] 2026 世界杯结束后追加 104 场
- **涉及文件**：`data/history/`（新建文件）、`lib/backtest.js`
- **完成标志**：历史数据总量 ≥ 300 场，`npm test` 全绿

---

## 执行顺序建议

```
Week 1:
  Person A: A1 (git 清理) → A2 (CI) → A3 (LICENSE) → A4 (unhandledRejection)
  Person B: B1 (集成测试) → B2 (杂散文件) → B3 (死代码)
  Person C: C1 (Bootstrap CI) → C2 (param-sweep)

Week 2:
  Person A: A5-A10 (安全/配置/文档/PWA)
  Person B: B4 (空 catch 清理)
  Person C: C3 (数据扩充)
```

---

## Task D — 赛后复盘接入实时 Moment 数据

背景：`lib/jobs/moment-sync.js` 每 60s 轮询进行中的比赛，把 kickoff/hydration_break/halftime/goal 等触发点连同当时的实时概率（Track A repricing）写进 `match_moments` 表（`lib/services/moment-detector.js`），已在生产验证正常运行（2026-07-07 阿根廷 vs 埃及一场就抓到 28' 补水、45' 中场等真实数据）。但 AI 赛后复盘（`lib/services/ReviewService.js` → `lib/postMatchReview.js`）目前完全没有消费这份数据——`ReviewService.js` 传给 `buildPostMatchReview()` 的 `evidence` 只有 `{events, commentary, news}`（解析自 ESPN 原始文字解说），而 AI prompt 里明确要求识别"hydration-break → substitution → goal"这类模式（`lib/postMatchReview.js:75`），却拿不到任何真实的补水/中场时间戳和概率漂移数据去支撑这个判断。

- [ ] 在 `lib/services/ReviewService.js` 的 `reviewMatch()` 里（约第 90-120 行，`buildPostMatchReview` 调用前）新增一段查询，从 `match_moments` 表按 `match_id` 取出该场比赛全部记录（可参考 `lib/routes/prediction.js` 里 `/api/match/:id/live-probability` 路由已有的查询：`SELECT minute, minute_added, type, prob_home_win, prob_draw, prob_away_win, detected_at FROM match_moments WHERE match_id = ? AND prob_home_win IS NOT NULL ORDER BY minute ASC, minute_added ASC`）
- [ ] 把每条记录映射成 `lib/postMatchReview.js` 里 `summarizeSnapshotNode()`（第 165 行）期望的 node 形状：`{ trigger, minute, home: {name, score}, away: {name, score}, odds: {homeWin, draw, awayWin}, summary }`（trigger 直接用 match_moments.type 的值；odds 用 prob_home_win/prob_draw/prob_away_win）
- [ ] 把映射后的数组作为 `evidence.timeline`（或 `evidence.liveSnapshots`，两者 `buildLiveTimelineI18n` 都认，见 `lib/postMatchReview.js:192-195`）加进 `buildPostMatchReview()` 调用的 `evidence` 对象里
- [ ] 扩充 `lib/postMatchReview.js` 的 `nodeLabelI18n()`（第 150-163 行）的 `map`：现在只认识 `first_sight/goal/halftime/first_half_hydration/second_half_hydration/extra_time_first_half/extra_time_second_half/fulltime/periodic` 这套旧命名，缺 `moment-detector.js` 实际产出的类型——补齐 `kickoff、hydration_break、goal_disallowed、woodwork、red_card、yellow_card、substitution_key、second_half_start、ht_added_time、ft_added_time、et_start、et_halftime、et_ht_added、et_fulltime、penalty_shootout、sustained_pressure_alert`（完整清单见 `lib/services/moment-detector.js:9-27` 的注释），否则这些类型会落到 fallback 分支，直接把英文 snake_case 原样当中文标签显示
- [ ] 确认 `match_moments` 里同一 minute 同 type 出现重复记录时（已观察到 substitution_key 偶发重复，见本次会话记录）不会让 timeline 里出现同一节点两次——去重可以按 `${minute}-${type}` 做，或者交给上面查询加 `GROUP BY`/`DISTINCT`，自行判断哪种更合适
- **涉及文件**：`lib/services/ReviewService.js`（约第 90-120 行）、`lib/postMatchReview.js`（`summarizeSnapshotNode` 第 165 行、`nodeLabelI18n` 第 150 行、`buildLiveTimelineI18n` 第 190 行）
- **完成标志**：对一场已经跑过 moment-sync 的比赛（例如 match_id 760509）调用 `POST /api/match/:id/review?persist=false` 或直接跑 `ReviewService.reviewMatch()`，生成的复盘 JSON 里 `evidence`/timeline 字段包含真实的补水/中场分钟数和概率漂移，且 AI 输出的 processNotes 或 whyRight/whyWrong 里能看到具体引用这些时间点（而不是泛泛而谈）

---

## Task E — moment-sync 无赛前快照时的概率兜底（Task D 验收时发现的上游缺口）

背景：Task D 验收时发现，生产库里真实的 `match_moments`（760496/760497/760498，共 25 条）`prob_home_win/prob_draw/prob_away_win` **全部为 NULL**。原因是 `lib/jobs/moment-sync.js` 的 Track A 重定价注入只在 `getPreMatchPrediction(matchId)` 返回非空时才执行（`if (prePred && moments.length) { ... reprice(...) }`），而这三场比赛直播时没有对应的 `prediction_snapshots` 行，所以 `prePred` 是 null，reprice 整段被跳过，moment 落库时概率列全空。Task D 已经让 AI 复盘拿到真实的补水/中场/换人分钟数，但拿不到概率漂移这块数据——因为上游压根没算。

- [ ] 在 `lib/jobs/moment-sync.js` 里（`getPreMatchPrediction(matchId)` 调用处，约第 158-160 行）为 `prePred` 增加一个兜底：无赛前快照时，实时调用 `predictionService.predictMatch(matchId)` 现算一个基线（可参考 `lib/routes/prediction.js` 的 `/api/match/:id/live-probability` 路由里已有的兜底写法：`pred.goals?.homeExpected ?? pred.components?.poisson?.homeLambda ?? 1.2` 这种 fallback 链）
- [ ] 注意 `moment-sync.js` 是常驻轮询 job（比赛进行中每 60s 一次），实时调用 predictionService 比读一行 snapshot 更慢——评估是否需要加一层内存缓存（同一 matchId 在同一场比赛内只算一次基线，别每个 tick 都重算），别把 60s 轮询拖慢
- [ ] 决定拿不到任何基线（连实时计算都失败，比如队伍 ID 解析不了）时的最终兜底：是完全跳过概率注入（现状），还是用一个通用默认值——建议维持现状（跳过），不要编造假数据
- **涉及文件**：`lib/jobs/moment-sync.js`（Track A 重定价注入段，约第 158-175 行）
- **完成标志**：找一场当前没有 `prediction_snapshots` 记录的进行中比赛（或本地造数据模拟），跑一轮 moment-sync tick，确认 `match_moments` 新插入的行 `prob_home_win` 不再是 NULL；`npm test` 全绿；确认 60s 轮询在有多场同时进行的比赛时不会因为新增的实时预测调用而明显变慢（可加日志观察单次 tick 耗时）

---

## 现有清单归档状态

| 清单 | 状态 |
|---|---|
| `docs/server-refactor-checklist.md` | ✅ 全部完成（9/9） |
| `docs/testing-checklist.md` | 分配给 Person B（问题 1-2）、Person A（问题 4）、监控项（问题 5） |
| `docs/git-hygiene-checklist.md` | 全部分配给 Person A |
| `docs/backtest-backlog.md` | 全部分配给 Person C |
| 全面审计新发现 | HIGH→Person A（A4, A9）、MEDIUM→Person A+B（A5-A6, B3-B4）、LOW→Person A（A7-A10） |
| Task D（moment-sync 数据接入赛后复盘） | ✅ 已完成（2026-07-08）：`lib/services/ReviewService.js` 新增 `getMatchMomentsTimeline()` 从 `match_moments` 拉取带实时概率快照的节点并映射成 `summarizeSnapshotNode()` 认识的 node 形状，注入 `evidence.timeline`；`lib/postMatchReview.js` 的 `nodeLabelI18n()` 映射表补全 `moment-detector.js` 全部类型（kickoff/goal_disallowed/woodwork/red_card/yellow_card/substitution_key/hydration_break/ht_added_time/second_half_start/ft_added_time/et_*/penalty_shootout/sustained_pressure_alert 等），去重按 `${minute}-${type}-${teamId}`；回归测试见 `scripts/test-moment-review-integration.js`（4 项测试 / 26 项断言，已接入 test-runner）。注：真实 `match_moments`（760496/97/98）的 `prob_*` 列为 NULL，因这些比赛直播时无赛前预测快照、Track A 重定价未注入——属上游 moment-sync 范畴，Task D 已做优雅降级（odds 缺失时不展示）。 |
| Task E（moment-sync 无赛前快照时的概率兜底） | 待分配，独立任务，不阻塞 Task D 已上线的部分（2026-07-08 新增，Task D 验收时发现的上游缺口） |

## 前端测试（testing 问题 3）
> 由用户自行处理（app.js 拆分中），不分配。

## SQLite 架构风险（testing 问题 5）
> 监控项，无需立即行动，不分配。
