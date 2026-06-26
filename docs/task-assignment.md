# 总任务分配表

> 3 人分工，可并行，互不阻塞。每人完成后交 Claude 验收。

---

## Person A — 基础设施 + 配置

职责：Git 清理、CI/CD、安全、配置、文档

### A1: Git 仓库清理（git-hygiene 全部）
- [ ] `.gitignore` 追加条目（scratch/、deliverables/、data/wc2026/、.codebuddy/、.workbuddy/、*.bak、world cup data/ 等）
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
- [ ] 确认 `.dockerignore` 排除 scratch/、test*、world cup data/、deliverables/、docs/、node_modules/
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

## 现有清单归档状态

| 清单 | 状态 |
|---|---|
| `docs/server-refactor-checklist.md` | ✅ 全部完成（9/9） |
| `docs/testing-checklist.md` | 分配给 Person B（问题 1-2）、Person A（问题 4）、监控项（问题 5） |
| `docs/git-hygiene-checklist.md` | 全部分配给 Person A |
| `docs/backtest-backlog.md` | 全部分配给 Person C |
| 全面审计新发现 | HIGH→Person A（A4, A9）、MEDIUM→Person A+B（A5-A6, B3-B4）、LOW→Person A（A7-A10） |

## 前端测试（testing 问题 3）
> 由用户自行处理（app.js 拆分中），不分配。

## SQLite 架构风险（testing 问题 5）
> 监控项，无需立即行动，不分配。
