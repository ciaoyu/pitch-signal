# Pre-Launch 评估发现 — 2026-06-22 23:01

**修复状态：P0-1/P0-2 已修，P0-3 已重写文档。23:08 验证。**
**深度审计：sub-agent `code-reviewer` 10 分钟超时，主 session 手动完成安全/性能/依赖/AI 审计。23:15 完成。**

## 🚨 P0 — 上线 blocker（3 个，已修复）

### P0-1 `server.js` 没有 `/health` 端点（已修）
- 原证据：`grep -n "health\|Health\|/health" server.js` 0 匹配；Docker `HEALTHCHECK` 调 `/health` 但路由不存在，回退到 SPA `index.html`
- 修复：`server.js` 顶部 `routes` 对象新增 `GET /health` 安全网；当 `lib/routes/health.js` 因模块加载失败未注册时，probe 仍拿到 200 JSON 而非 HTML
- 运行时：模块注册成功，`lib/routes/health.js` 覆盖为更完整实现（DB 探活，失败返回 503）
- 验证：`curl http://127.0.0.1:5100/health` → `{"status":"healthy",...}` HTTP 200

### P0-2 better-sqlite3 NODE_MODULE_VERSION 不匹配（已修）
- 原错误：Node 22.16 ABI 127 vs 已编译二进制 ABI 141（Node 23+）
- 影响：match snapshot scheduler 启动时报 `unavailable`；`npm test` 0 passed 8 failed
- 修复：server 已 kill 后执行 `npm rebuild better-sqlite3`
- 修复后：
  - `npm test` 8 个测试文件全部通过（0 failed）
  - scheduler 启动无 `unavailable` 错误
  - `/health` 返回 DB 探活成功
- 根因范围：仅本机。部署容器 `node:22-alpine` + `npm ci` 会现场编译/拉匹配二进制，不会重现。

### P0-3 PROJECT_STATUS.md 写的"已执行验证"是虚假的（已修）
- 原文档："npm test: 通过"、"本机 /health: 通过"——与事实不符
- 修复：重写 `docs/PROJECT_STATUS.md` 的"已执行验证"章节，附实际命令、时间戳、修复动作
- 这是工程诚信问题，必须修正后才能作为新对话入口

## ⚠️ P1 — 上线前建议处理（新增 8 个）

### P1-4 速率限制是进程内内存，无法跨容器共享
- 实现：`middleware/rate-limit.js` 使用全局 `Map` 存储桶
- 影响：Railway 等多副本部署时，单 IP 攻击者可绕过每个副本的限制；容器重启后状态丢失
- 建议：上线后如流量上升，替换为 Redis 或共享内存方案；当前 240 req/min 单节点够用

### P1-5 `POST /api/match-review` 无认证，可做 CPU DoS
- 路由：`lib/routes/prediction.js:367` 的 `POST /api/match-review` 只校验字段，不校验 token
- 影响：攻击者可用随机球队反复生成赛后回顾，消耗 CPU 和内存（虽然受全局 rate-limit 约束）
- 建议：与 `POST /api/post-match-review` 统一使用 `checkAdminAuth` 或 `requireWriteToken`

### P1-6 Body Parser 解析失败时返回 `null`，可能导致空指针
- 实现：`middleware/body-parser.js` 中 `JSON.parse` 失败时 `resolve(null)`
- 影响：POST 路由如果未判空就访问 `body.xxx`，会 500 或产生异常行为（如 `POST /api/bot/chat` 的 `messages` 未判空时）
- 建议：解析失败返回 400 `Invalid JSON body`；或在每个 POST handler 入口判空

### P1-7 CORS 默认 origin 不含生产域名
- 实现：`middleware/cors.js` 默认仅允许 `localhost:5099`、`127.0.0.1:5099`、`192.168.2.231:5099`
- 影响：部署到 Railway 自定义域名后，浏览器前端请求会被 CORS 拒绝
- 建议：部署时务必设置 `CORS_ORIGINS` 环境变量；文档已提示，但属于常见配置遗漏

### P1-8 Admin Token 用 `===` 比较，存在时序攻击风险
- 位置：`lib/routes/prediction.js:checkAdminAuth`、`middleware/auth-write.js`、`lib/routes/bot.js`
- 影响：理论上可逐字节爆破 admin token；实际低频率 + 网络噪声使攻击极难，但不符合安全基线
- 建议：使用 `crypto.timingSafeEqual` 或 HMAC 比较；`ADMIN_TOKEN` 设得足够长且随机

### P1-9 `lib/translate.js` 的 LLM 翻译可能暴露用户提示注入
- 位置：`translateNewsItems` 和 `translateSearchResult` 将外部新闻标题/内容直接拼入 LLM prompt
- 影响： Tavily 返回的内容若被污染，可诱导翻译 API 输出任意内容；但输出仅用于展示，不写入预测数据
- 建议：对翻译输出做 HTML 转义，且标记 `translatedBy: 'llm'`；不要信任其内容进入数据库计算链

### P1-10 `bot.js` 的 `matchContextStr` 直接拼入 system prompt
- 位置：`lib/routes/bot.js:50` 的 system prompt 包含 `matchContextStr || '无'`
- 影响：虽然 `bot` 在真实模式下需要 token，但 demo 模式下该路由无认证，任何用户都可以传入 `context` 进行 prompt 注入
- 建议：demo 模式应关闭 LLM 调用（当前已实现，只返回规则文案）；真实模式下也建议将 `context` 作为独立用户消息块而非 system prompt 变量

### P1-11 没有请求日志 / 访问日志 / 审计日志
- 影响：生产环境无法排查请求、无法追踪写操作来源、无法满足安全审计
- 建议：增加 `morgan`-style 访问日志，并对 `POST /api/*` 记录时间、IP、token 前缀、响应状态

## ✅ 设计良好的方面

- **Secret 管理**：没有硬编码 API key；所有 key 从环境变量读取；`.env` 和 `.env.*` 在 `.gitignore` 和 `.dockerignore` 中排除；`Dockerfile` 使用非 root 用户 `node`
- **SQL 注入**：绝大多数查询使用 `?` 占位符；`lib/db.js` 的动态表名通过 `assertSafeTable` 白名单校验
- **路径穿越**：`safeStaticPath` 校验 `fullPath.startsWith(safeRoot + path.sep)`，防止静态目录逃逸
- **AI 闸门**：`AI_POSTMORTEM_ENABLED` 默认 `false`，`claudeClient.isConfigured()` 为 false 时不运行 AI 复盘；`assertFeatureGates` 强制关闭 Polymarket/Pundit/AutoCalibration
- **健康检查**：`lib/routes/health.js` 会执行 `SELECT 1` 探活，数据库不可达时返回 503，符合 Docker/K8s 语义
- **依赖精简**：仅两个运行时依赖 `@anthropic-ai/sdk` 和 `better-sqlite3`，攻击面小

## ⚠️ P2 — 建议改进

- P2-1：为 `POST /api/ask` 等 CPU 路由增加请求日志
- P2-2：增加 `/metrics` 或 `/readyz` 端点用于 K8s readiness
- P2-3：SQLite 单连接在崩溃时无法自动恢复；可考虑 WAL 模式 + 重试
- P2-4：rate-limit 桶清理间隔应可配置，并设置内存上限
- P2-5：为 POST body 增加 JSON Schema 校验（如 `ajv`），避免无效字段进入数据库

## 修复动作

1. `server.js` 新增 `/health` 安全网（保留 `lib/routes/health.js` 为主要实现）
2. 本机 `npm rebuild better-sqlite3`
3. 重写 `docs/PROJECT_STATUS.md` 验证章节
4. 主 session 完成安全/性能/依赖/AI 审计并写入本文件

## 当前状态

- 服务：`http://0.0.0.0:5100` 运行中
- `/health`：200 JSON
- `npm test`：0 failed
- 深度审计：完成，新增 8 个 P1 建议，无新增 P0
- 结论：从 **NO-GO** 改为 **CONDITIONAL GO** — 仍需处理 P1 中认证/日志/CORS 问题，并提供 GitHub 地址完成推送和部署验证

## 待提交文件

- `pitch-signal/server.js`
- `pitch-signal/docs/PROJECT_STATUS.md`
- `pitch-signal/docs/EVAL_FINDINGS_2026-06-22.md`
- 旁路文件（`.claude/launch.json`、`../MEMORY.md` 等）不纳入提交
