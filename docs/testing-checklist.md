# 测试基础设施待解决清单

## 问题 1：集成测试间歇性失败（test-post-match-review.js）

**现状：**
- 单独跑 28/28 通过，`npm test` 中间歇性 fetch failed
- **根因不是端口冲突**（只有这一个测试启动 HTTP server，无竞争）
- 真正原因有 4 个（见下）

**根因分析：**

| # | 问题 | 影响 |
|---|---|---|
| A | 用 `SIGKILL` 杀 server 进程，不走 graceful shutdown | DB 可能没刷盘，WAL 残留导致下次启动异常 |
| B | 没有 `try/finally` 保护 cleanup | 测试中途崩溃 → server 子进程成为孤儿、DB 文件残留 |
| C | server 就绪检测用 2.5 秒超时兜底 | CI 机器慢时 server 还没启动就发请求 → fetch failed |
| D | `npm test` 设 `TEST_DB_PATH=:memory:` 但测试覆盖为文件路径 | DB 策略不一致，非直接失败原因但需统一 |

**方案：**

### 步骤 1：修复 server 就绪检测
- [x] 改为轮询 `GET /health`（每 200ms 一次，最多 10 秒），不靠超时
- [x] 涉及文件：`scripts/test-post-match-review.js`（`startTestServer` 函数，~第 72-96 行）

### 步骤 2：修复 shutdown 机制
- [x] `SIGKILL` → `SIGTERM`，等待进程退出（`serverProcess.on('exit')`），5 秒超时后才 fallback SIGKILL
- [x] 整个 main 包在 `try/finally` 里，finally 做 cleanup（杀进程 + 删 DB 文件）
- [x] 涉及文件：`scripts/test-post-match-review.js`（~第 416-436 行 cleanup，第 443-470 行 main）

### 步骤 3：修复文档
- [x] 文件头注释写的 `localhost:5099`，实际端口是 5091，更正
- [x] PORT 常量和 BASE URL 均使用 5091

**完成标志：**
- [x] 测试用 `SIGTERM` 而非 `SIGKILL` 关闭 server（5s 超时后才 SIGKILL）
- [x] 有 `try/finally` 保证 cleanup 执行
- [x] `npm test` 连续 5 次全绿，无 fetch failed（已修复 DB fd 共享问题）

---

## 问题 2：根目录杂散测试文件

**现状：**
8 个文件在项目根目录，不被 `npm test`（只扫 `scripts/test-*.js`）覆盖：

| 文件 | 用途 | 风格 |
|---|---|---|
| `test-espn.js` | 手写 https.get 测 ESPN API | 裸脚本，无 assert |
| `test-stats.js` | 手写 https.get 测 boxscore | 裸脚本，无 assert |
| `test_backtest_sort.js` | 调 BacktestRunner._walkForward | require 模块 |
| `test_knockout.js` | 调 PredictionEngine.predict | require 模块 |
| `test_live_api.js` | 测线上 API | 裸脚本 |
| `test_polymarket_fusion.js` | 测 Polymarket 融合 | 裸脚本 |
| `test-p1-all-teams.js` | P1 全队诊断 | 一次性脚本 |
| `test-p1-diagnosis.js` | P1 诊断 | 一次性脚本 |

**方案：**

### 步骤 1：分类
- [x] 全部 8 个文件移到 `scratch/`

### 步骤 2：迁移
- [x] 根目录无 `test-*.js` 或 `test_*.js` 文件
- [x] `scratch/` 目录存放所有临时脚本（含其他历史脚本共 20 个文件）

### 步骤 3：统一命名规范
- [x] 所有正式测试文件统一为 `scripts/test-kebab-case.js` 格式
- [x] 根目录无杂散测试文件

**完成标志：**
- [x] 根目录无 `test-*.js` 或 `test_*.js` 文件
- [x] `scratch/` 目录存放临时脚本
- [x] `npm test` 覆盖范围明确（只跑 `scripts/test-*.js`）

---

## 问题 3：前端零测试覆盖

**现状：** `static/js/app.js` 4400 行，零测试。已在拆分中（app.js → modules/）。

**方案：** 拆分完成后再写单元测试。拆分后每个模块可独立 import 和测试。

> 由用户自行处理，不在此清单跟踪。

---

## 问题 4：CI 不阻断部署

**现状：**
- `ci.yml`：push/PR 到 main 时跑 `npm test` ✅
- `deploy-railway.yml`：`needs: [build-and-test]` 被注释掉，测试失败也部署 ❌
- `deploy-render.yml`：直接 curl deploy hook，完全不等 CI ❌

**方案：**

### 步骤 1：Railway 部署依赖 CI
- [x] 改为 `workflow_run` 触发器，监听 CI workflow 完成
- [x] 加 `if: github.event.workflow_run.conclusion == 'success'` 条件
- [x] 使用 `workflow_run` 而非 `needs`（跨 workflow 文件不能用 needs）

### 步骤 2：Render 部署依赖 CI
- [x] 同样改为 `workflow_run` 触发器 + `if: success()` 条件

### 步骤 3：验证
- [x] 配置验证：`workflow_run` + `if: conclusion == 'success'` 逻辑正确
- [ ] 端到端：提交一个故意失败的测试，确认 deploy workflow 不触发（待推送到 GitHub 后验证）

**涉及文件：**
- `.github/workflows/deploy-railway.yml`（改为 workflow_run 触发）
- `.github/workflows/deploy-render.yml`（改为 workflow_run 触发）

**完成标志：**
- [x] `deploy-railway.yml` 监听 CI workflow 成功后才触发
- [x] `deploy-render.yml` 监听 CI workflow 成功后才触发
- [ ] 端到端验证：提交失败测试 → 部署不触发 → 恢复 → 部署触发

---

## 问题 5：SQLite 单实例同步阻塞（架构风险，当前非瓶颈）

**现状：**
- `lib/db.js` 单例 `better-sqlite3` 连接，WAL 已开启，DB 3.4MB
- 所有 `db.prepare().run()/get()/all()` 同步阻塞 Node.js 事件循环
- `user_feedback` 表无界追加，无 backpressure
- 热读路径有 `getCached/setCache` 内存缓存保护

**当前不是瓶颈的原因：**
- 每比赛日写入量极小（预写 8 条 + 赛后 4 条 + 用户反馈）
- DB 3.4MB，SQLite WAL 可处理每秒数千次小写入
- 部署规模（Railway 单实例）和用户量远未到临界点

**什么时候需要动手：**
- [ ] 并发用户持续 > 500，缓存命中率 < 80%
- [ ] DB 文件 > 50MB（需加索引）
- [ ] 用户反馈写入成为事件循环热点

**到时的方案：**
- [ ] 将 DB 写操作封装到 `worker_threads`，事件循环只做读 + 缓存
- [ ] `user_feedback` 加写入队列 + 批量 flush（`db.transaction`）
- [ ] 或迁移到 PostgreSQL（如果需要多实例部署）

**涉及文件：**
- `lib/db.js`（连接模型）
- `lib/services/PredictionService.js`（写入路径）
- `lib/routes/bot.js`（user_feedback 无界写入）
- `middleware/cache.js`（缓存层，已有的保护）

**完成标志：**
- [x] 此条为监控项，无需立即行动
- [ ] 当触发条件满足时启动迁移
