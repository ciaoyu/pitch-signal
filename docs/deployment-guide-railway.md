# PitchSignal — 部署指南 (Railway)

> 目标：受控公开 Beta 上线。单实例 + 持久化 + 健康检查 + 回滚。
>
> ⚠️ **本文档包含可执行的验收步骤。所有断言基于当前代码行为，不依赖猜测。**
>
> ⚠️ **所有需接触外部资源（GitHub 仓库创建、Railway 项目、Volume 挂载）的步骤，未经明确授权不做。**

---

## 1. 部署配置

### 1.1 文件清单

| 文件 | 内容 | 状态 |
|------|------|:---:|
| `Dockerfile` | 多阶段构建 Node 22 Alpine，HEALTHCHECK 检查 /health 200 | ✅ |
| `.dockerignore` | 排除 node_modules/.env/*.db/.git/reports/*.log/test scripts | ✅ |
| `railway.toml` | 单实例、健康检查路径、持久卷注释 | ⚠️ 格式待平台验证 |
| `.env.example` | 全部环境变量含令牌三级 + 功能闸门 + DATA_PATH | ✅ |
| `docs/deployment-guide-railway.md` | 本文档 | ✅ |

### 1.2 railway.toml — 格式待平台验证

```
⚠️ 当前采用顶层 [build] / [deploy] 格式。
   尚未经过真实 Railway 项目部署验证该格式是否被正确识别
   （numReplicas、healthcheckPath 等字段是否生效）。
   首次部署后必须进入 Railway Dashboard → Service → Settings
   确认 numReplicas=1、healthcheck 等字段已生效。
```

### 1.3 环境变量（Railway Dashboard → Variables）

| 变量 | 值 | 说明 |
|------|---|------|
| `DATA_PATH` | `/usr/src/app/data` | 持久卷挂载点 |
| `NODE_ENV` | `production` | 生产模式 |
| `POLYMARKET_ENABLED` | `false` | 关闭 Polymarket |
| `PUNDIT_ENABLED` | `false` | 关闭 Pundit |
| `AUTO_CALIBRATION` | `false` | 关闭自动校准 |
| `AI_POSTMORTEM_ENABLED` | `false` | 关闭后台 AI 复盘 worker；公测默认不自动调用模型 |
| `ADMIN_TOKEN` | _(不设)_ | Beta 期间必须不设 |
| `BOT_API_TOKEN` | _(不设)_ | Beta 期间必须不设 |
| `WRITE_API_TOKEN` | _(不设)_ | Beta 期间必须不设 |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` | 可选 |
| `ANTHROPIC_API_KEY` | _(可选)_ | 可选 |
| `CLAUDE_POSTMORTEM_MODEL` | `deepseek-v4-pro` | 可选 |
| `CLAUDE_CHAT_MODEL` | `deepseek-v4-flash` | 可选 |
| `ODDS_API_KEY` | _(可选)_ | 可选 |
| `OWM_API_KEY` | _(可选)_ | 可选 |

> ⚠️ **令牌三级全不设**：bot.js 用 `BOT_API_TOKEN || ADMIN_TOKEN`，prediction.js 用 `WRITE_API_TOKEN || ADMIN_TOKEN`。
> 任一被设值 → 写接口意外开放。部署后必须在 Railway Variables 页面逐行确认三者均不存在或为空。

### 1.4 持久卷（Railway Dashboard 唯一入口）

Railway Volume 只能在平台控制台创建，无法通过 CLI 或 railway.toml 声明。

1. 首次部署 → Service → Settings → Volumes
2. New Volume → Mount Path: `/usr/src/app/data`
3. 确认 Active → **Redeploy**

---

## 2. 部署步骤（全部需授权）

| # | 步骤 | 执行方式 |
|---|------|---------|
| 1 | 创建独立 GitHub 仓库 | `gh repo create pitch-signal --private --source=. --push` |
| 2 | Railway 项目创建 + 连接 GitHub | Dashboard 或 `railway create` |
| 3 | 配置全部环境变量 | Dashboard → Variables，按 1.3 表设置 |
| 4 | 首次部署 | Railway 自动触发或手动 Deploy |
| 5 | 创建 Railway Volume | Dashboard → Settings → Volumes → Mount: `/usr/src/app/data` |
| 6 | Volume 后重新部署 | Dashboard → Deploy → Redeploy |

---

## 3. 部署后验收命令

> 执行人可直接复制粘贴。`<your-app>` 替换为 Railway 分配的域名。

```bash
BASE=https://<your-app>.up.railway.app
```

### 验收 3.1：健康检查 200

```bash
# 状态码
curl -s -o /dev/null -w "%{http_code}" $BASE/health
# 预期：200

# 响应体
curl -s $BASE/health | jq .
# 预期：{"status":"healthy","timestamp":"...","uptime":<number>,"memory":{...}}
```

### 验收 3.2：预测接口正常

```bash
curl -s $BASE/api/predict/760432 | jq '.homeWin, .draw, .awayWin'
# 预期：三个浮点数，和为 1
```

### 验收 3.3：持久卷 — Railway Shell 校验和比对

```bash
# ⚠️ /health 和页面在空库时也正常，不能用作持久化证据。

# 3.3a. Railway Shell → 记录重启前指纹
railway shell

  ls -la /usr/src/app/data/
  md5sum /usr/src/app/data/predictions.db
  md5sum /usr/src/app/data/match_snapshot_runs.json 2>/dev/null
  md5sum /usr/src/app/data/ratings.json 2>/dev/null
  echo "pre-reboot-$(date +%s)" > /usr/src/app/data/.sentinel
  exit

# 3.3b. 触发 Redeploy
#       Railway Dashboard → Service → Deploy → Redeploy

# 3.3c. 重新进入 Shell → 比对
railway shell

  ls -la /usr/src/app/data/
  cat /usr/src/app/data/.sentinel              # 哨兵仍在
  md5sum /usr/src/app/data/predictions.db       # 与 3.3a 一致
  md5sum /usr/src/app/data/match_snapshot_runs.json
  exit

# 预期：所有文件存在、校验和一致、.sentinel 未丢失
```

### 验收 3.4：匿名写接口 = 403

```bash
# Bot 写接口（BOT_API_TOKEN、ADMIN_TOKEN 均不设）
curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/bot/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
# 预期：403

# 赛后复盘写接口（WRITE_API_TOKEN、ADMIN_TOKEN 均不设）
curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/post-match-review/760432
# 预期：403

# 确认三令牌全不设
# Railway Dashboard → Service → Variables
# 逐行检查：ADMIN_TOKEN、BOT_API_TOKEN、WRITE_API_TOKEN 全部不存在或为空字符串
```

### 验收 3.5：功能闸门 = false

```bash
curl -s $BASE/api/predict/760432 | jq '.polymarketFusion'
# 预期：{"applied": false}
# ⚠️ 当前代码返回 { applied: false }，不是 null 也不是字段缺失。
```

### 验收 3.6：单实例

```
Railway Dashboard → Service → Settings → numReplicas
预期：1
```

### 验收 3.7：回滚演练

```bash
railway status                    # 记录当前部署 ID
railway rollback                  # 回滚
curl -s $BASE/health | jq .status # "healthy"
```

---

## 4. railway.toml 平台验证记录

> ⚠️ **以下字段尚未经 Railway 实际部署验证。首次部署后必须逐项确认。**

| 字段 | 预期行为 | 验证方法 | 结果 |
|------|---------|---------|:---:|
| `[build]` → `builder = "DOCKERFILE"` | Railway 使用 Dockerfile 构建 | 查看构建日志 | ⬜ |
| `numReplicas = 1` | 仅一个容器实例 | Dashboard → Settings → numReplicas | ⬜ |
| `healthcheckPath = "/health"` | Railway 调用 /health 判断存活 | 查看部署日志中 healthcheck | ⬜ |
| `restartPolicyType = "ON_FAILURE"` | 仅故障时重启，非 always | 部署日志 | ⬜ |

---

## 5. 发布检查清单

### ✅ 代码与文档层面（已完成，无需平台权限）

| # | 检查项 | 证据 |
|---|--------|------|
| C1 | Dockerfile 多阶段构建，HEALTHCHECK 检查 200 | 文件存在 |
| C2 | .dockerignore 排除 node_modules/.env/.db/test/密钥 | 文件存在 |
| C3 | .env.example 含全部变量 + 令牌三级 + 功能闸门 | 文件存在 |
| C4 | 部署指南有可执行的验收命令 | 本文档第 3 节 |
| C5 | 验收断言与当前代码行为一致 | polymarketFusion → `{applied:false}` 等 |
| C6 | server.js 通过 DATA_PATH / PORT 读取平台 env | L29-30 |
| C7 | db.js 启用 SQLite WAL + foreign_keys | L28-29 |
| C8 | health.js throw statusCode:503 → server.js 返回 503 | 代码链已审查 |
| C9 | railway.toml 标注格式待平台验证 | 本文档 1.2 + 第 4 节 |

### 🔒 待 GitHub / Railway 授权（需创建外部资源）

| # | 步骤 |
|---|------|
| A1 | 创建独立 GitHub 仓库（gh repo create） |
| A2 | Railway 项目创建 + 连接 GitHub |
| A3 | 配置全部环境变量（按 1.3 表，含令牌三级留空） |
| A4 | 首次部署成功（容器启动、HEALTHCHECK 通过） |
| A5 | railway.toml 字段逐项平台验证（按第 4 节表） |
| A6 | Railway Volume 创建 + 挂载 `/usr/src/app/data` |
| A7 | Volume 后重新部署 |

### 🚀 待真实部署验收（部署完成后逐项打勾）

| # | 验收项 | 命令参考 | 结果 |
|---|--------|---------|:---:|
| V1 | Health 200 + status "healthy" | §3.1 | ⬜ |
| V2 | 预测接口正常 | §3.2 | ⬜ |
| V3 | 持久卷 — Shell checksum 比对 | §3.3 | ⬜ |
| V4 | 匿名写接口 403 + 三令牌全不设 | §3.4 | ⬜ |
| V5 | polymarketFusion.applied === false | §3.5 | ⬜ |
| V6 | numReplicas = 1 | §3.6 | ⬜ |
| V7 | 回滚演练 | §3.7 | ⬜ |

> **全部 ⬜ 变为 ✅ 后，受控公开 Beta 放行。**
