# SRE 审查报告 — 世界杯 Dashboard 部署配置

**审查人**: Rex (SRE)  
**审查日期**: 2026-06-21  
**审查范围**: Dockerfile, .dockerignore, railway.toml, .env.example, deployment-guide, health.js  

---

## 1. Dockerfile 审查

### ✅ 通过项

- **多阶段构建**：builder 阶段安装编译依赖（python3/make/g++），生产阶段不带编译工具，镜像体积合理
- **COPY 时序正确**：先 `COPY package*.json` → `npm ci` → 再 `COPY . .`，充分利用 Docker 层缓存
- **非 root 用户**：`USER node`，最小权限原则
- **NODE_ENV=production**：确保 npm ci --omit=dev 正确工作
- **HEALTHCHECK 指令**：使用 wget 检查 200 状态码，逻辑正确

### ⚠️ 建议改进（非阻塞）

1. **`npm start` vs 直接 `node server.js`**
   - Dockerfile CMD 用 `npm start`，railway.toml 用 `node server.js`
   - 建议统一为 `node server.js`，避免 npm 的进程包装（信号转发、额外 PID 1 问题）
   - **风险等级**：低。npm 能正确转发 SIGTERM，但多一层进程增加复杂度

2. **HEALTHCHECK start-period=10s 可能偏短**
   - better-sqlite3 原生模块首次加载时有 cold start 开销
   - 如果数据库文件较大或 WAL checkpoint 触发，10s 可能不够
   - **建议**：改为 `--start-period=30s`，给予更多启动缓冲时间
   - **风险等级**：中。可能在冷启动时触发 false-positive 健康检查失败

3. **缺少 `HEALTHCHECK --interval` 与 Railway healthcheckTimeout 的协调**
   - Dockerfile: interval=30s, timeout=5s
   - railway.toml: healthcheckTimeout=5
   - Railway 自己的健康检查路径 `/health` 与 Docker HEALTHCHECK 是两套系统，需确认 Railway 是否尊重 Docker HEALTHCHECK（Railway 默认用自己的 HTTP 健康检查）
   - **建议**：在文档中明确说明 Railway 使用 `healthcheckPath` 而非 Docker HEALTHCHECK

4. **缺少 `.dockerignore` 中排除 `sre-review-*.md` 等审查文件**
   - 当前 .dockerignore 没有排除 `*.md`（顶层）或审查报告文件
   - **建议**：添加 `sre-review-*.md` 或 `*.md`（如果不需要文档进入镜像）

---

## 2. better-sqlite3 + Alpine 编译

### ✅ 通过项

- **编译依赖齐全**：`python3 make g++` 已安装，better-sqlite3 需要这些来编译原生 C++ 模块
- **node:22-alpine** 基础镜像自带 `node-gyp`（npm 内置）

### ⚠️ 建议改进（非阻塞）

1. **Alpine 的 musl libc 兼容性**
   - better-sqlite3 在 Alpine（musl）上编译有已知问题：某些版本的 node-gyp 会因 musl 头文件路径不同而失败
   - **当前版本 better-sqlite3@^12.10.0 应该已修复此问题**，但建议在 CI 中验证 Alpine 构建
   - 如果遇到编译失败，备选方案：使用 `node:22-slim`（Debian-based）替代 Alpine

2. **prebuild binaries 是否可用**
   - better-sqlite3 支持 prebuild-install，但在 Alpine 上通常需要从源码编译
   - 这会增加 CI/CD 构建时间（约 1-3 分钟）

---

## 3. railway.toml 审查

### ✅ 通过项

- **numReplicas = 1**：正确，SQLite 是单写者数据库，不能水平扩展
- **restartPolicyType = ON_FAILURE**：合理的重启策略
- **healthcheckPath = /health**：正确指向健康检查端点
- **builder = DOCKERFILE**：明确使用自定义 Dockerfile

### ⚠️ 建议改进（非阻塞）

1. **缺少 `startCommand` 与 Dockerfile CMD 的冗余**
   - railway.toml 定义了 `startCommand = "node server.js"`
   - Dockerfile 定义了 `CMD ["npm", "start"]`
   - Railway 的 `startCommand` 会覆盖 Dockerfile CMD，所以实际运行的是 `node server.js`
   - **建议**：统一为一个来源，避免混淆。建议 Dockerfile CMD 也改为 `["node", "server.js"]`

2. **缺少 `healthcheckTimeout` 的 Railway 默认行为说明**
   - Railway 的 `healthcheckTimeout=5` 是秒为单位，与 Docker HEALTHCHECK 的 `--timeout=5s` 一致
   - 但 Railway 的健康检查是 HTTP 请求，不是 Docker HEALTHCHECK，行为可能不同

3. **缺少 `restartPolicyMaxRetries` 的时间窗口**
   - `restartPolicyMaxRetries=3` 没有定义时间窗口
   - 如果服务在 1 分钟内连续失败 3 次，Railway 会停止重启吗？
   - **建议**：查阅 Railway 文档确认重试策略的时间窗口

### 🔴 必须修复（阻塞）

**无阻塞问题**。railway.toml 配置基本合理。

---

## 4. 健康检查端点审查

### ✅ 通过项

- **DB 连通性检查**：`SELECT 1` 验证数据库可用
- **正确的错误码**：DB 不可达时返回 503
- **返回有用信息**：uptime、memory、timestamp 有助于调试

### ⚠️ 建议改进（非阻塞）

1. **健康检查应检查更多依赖**
   - 当前只检查数据库连通性
   - **建议**：如果应用依赖外部 API（ESPN、Odds API），考虑在健康检查中增加可选的外部依赖检查（但不要让它成为单点故障）
   - 可以添加一个 "degraded" 状态（200 但带警告），而不是直接 503

2. **`process.memoryUsage()` 可能暴露敏感信息**
   - 健康检查端点通常公开可访问，返回完整的内存使用详情可能不适合生产环境
   - **建议**：只返回 `rss` 和 `heapUsed` 的摘要，或限制为内部网络访问

3. **缺少 `db.prepare('SELECT 1').get()` 的超时保护**
   - 如果数据库被锁（WAL checkpoint 期间），这个查询可能会阻塞
   - **建议**：设置 `busy_timeout` pragma 或在健康检查中使用超时

---

## 5. 环境变量审查

### ✅ 通过项

- **.env.example 完整**：覆盖了所有必要变量
- **敏感信息处理**：`ADMIN_TOKEN`、`ANTHROPIC_API_KEY` 等都有说明
- **DATA_PATH 说明清晰**：指明了持久卷挂载路径

### ⚠️ 建议改进（非阻塞）

1. **缺少 `BOT_API_TOKEN` 在 .env.example 中**
   - 部署指南 Step 3 提到了 `BOT_API_TOKEN`，但 .env.example 中没有
   - **建议**：添加 `BOT_API_TOKEN=` 到 .env.example

2. **缺少 `DB_PATH` 的说明**
   - lib/db.js 中有 `DB_PATH` 的优先级逻辑（TEST_DB_PATH > DB_PATH > DATA_PATH/predictions.db）
   - .env.example 中没有 `DB_PATH` 变量
   - **建议**：添加 `DB_PATH=` 并说明优先级

3. **Railway 环境变量注入 vs .env 文件**
   - server.js 中有手动加载 .env 文件的逻辑
   - Railway 通过环境变量注入，不会使用 .env 文件
   - **建议**：在部署指南中明确说明 Railway 环境变量优先级

---

## 6. 回滚方案审查

### ✅ 通过项

- **Railway 原生支持**：Dashboard 一键回滚或 `railway rollback` CLI
- **单实例简化回滚**：没有多实例一致性问题

### ⚠️ 建议改进（非阻塞）

1. **SQLite 数据库回滚的复杂性**
   - Railway 回滚只回滚代码/镜像，**不回滚持久卷中的数据库**
   - 如果新版本做了数据库 schema 变更（migration），回滚后可能出现兼容性问题
   - **建议**：
     - 在部署指南中明确说明"回滚不包含数据"
     - 添加数据库备份策略（部署前快照 `data/` 目录）
     - 考虑添加 `scripts/backup-db.js` 脚本

2. **缺少回滚前的检查清单**
   - **建议**：在部署指南中添加回滚前检查：
     - 确认数据库 schema 是否有变更
     - 确认是否有数据写入（WAL 文件）
     - 考虑是否需要先备份数据库

---

## 7. Railway + SQLite 已知坑

### ✅ 通过项

- **WAL 模式已启用**：`db.pragma('journal_mode = WAL')` — 这是正确的选择
- **numReplicas=1**：避免了多写者问题

### ⚠️ 建议改进（非阻塞）

1. **Railway 持久卷的 I/O 性能**
   - Railway 的持久卷是网络存储，I/O 延迟比本地磁盘高
   - SQLite WAL 模式对 fsync 依赖较重，网络存储可能导致性能下降
   - **建议**：监控数据库查询延迟，如果出现性能问题，考虑使用内存缓存减少 DB 访问

2. **WAL 文件清理**
   - WAL 文件（`.db-wal`）在 Railway 持久卷上可能增长
   - better-sqlite3 的 WAL 模式会自动 checkpoint，但在高写入场景下可能需要手动触发
   - **建议**：添加定期 `PRAGMA wal_checkpoint(TRUNCATE)` 的 cron 任务，或在应用启动时执行

3. **Railway 休眠与 SQLite 连接**
   - Railway Hobby Plan 在无流量时会休眠实例
   - 休眠时 SQLite 连接会断开，但 WAL 文件会保留在持久卷上
   - **建议**：确保应用启动时能正确重新打开数据库连接（当前代码应该已经处理）

4. **文件锁与 Railway 网络存储**
   - SQLite 依赖文件锁（fcntl）来协调并发访问
   - Railway 的网络存储是否支持正确的 POSIX 文件锁？
   - **建议**：验证 Railway 持久卷支持 fcntl 文件锁（大多数现代网络存储都支持，但值得确认）

---

## 总结

### 整体评估：**基本可用，有改进空间**

| 类别 | 状态 |
|------|------|
| Dockerfile | ✅ 通过，有小改进建议 |
| better-sqlite3 + Alpine | ✅ 通过，需验证编译 |
| railway.toml | ✅ 通过 |
| 健康检查 | ✅ 通过，建议增强 |
| 环境变量 | ⚠️ 有遗漏（BOT_API_TOKEN, DB_PATH） |
| 回滚方案 | ⚠️ 需注意数据不回滚 |
| Railway + SQLite | ⚠️ 需注意持久卷 I/O 和文件锁 |

### 🔴 必须修复

**无阻塞问题**。当前配置可以部署。

### ⚠️ 建议改进（按优先级排序）

1. **高优先级**：
   - 补充 .env.example 中的 `BOT_API_TOKEN` 变量
   - 在部署指南中明确说明"回滚不包含数据"
   - 验证 Railway 持久卷支持 SQLite 文件锁

2. **中优先级**：
   - HEALTHCHECK start-period 从 10s 增加到 30s
   - 统一 Dockerfile CMD 和 railway.toml startCommand
   - 添加数据库备份策略

3. **低优先级**：
   - 健康检查增加外部依赖检查
   - 限制 memoryUsage 暴露的信息
   - 添加 WAL 文件定期清理

### 部署前检查清单

- [ ] 确认 Railway 项目已创建
- [ ] 确认环境变量已在 Railway Dashboard 配置
- [ ] 确认持久卷已挂载到 `/usr/src/app/data`
- [ ] 验证 Docker 镜像能成功构建（`docker build .`）
- [ ] 验证健康检查端点返回 200
- [ ] 确认回滚方案：知道如何回滚代码，知道数据不会回滚
