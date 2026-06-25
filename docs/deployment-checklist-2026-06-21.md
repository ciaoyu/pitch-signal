# 部署闭环 — 最终方案 (2026-06-21)

## 你的任务
确保单实例、持久化、健康检查、回滚和环境变量稳定，明天公测前收口。

## 交付物清单

| 文件 | 状态 |
|------|------|
| `Dockerfile` | ✅ 多阶段构建，Node 22 Alpine，HEALTHCHECK 检查 200，start-period 20s，`CMD ["node", "server.js"]` |
| `.dockerignore` | ✅ 排除 node_modules/.env/*.db/.git/reports/*.log/test scripts |
| `railway.toml` | ✅ numReplicas=1, startCommand 直启, restartPolicy ON_FAILURE, healthcheckPath /health |
| `.env.example` | ✅ 全部环境变量 + 注释，含 DATA_PATH + 功能闸门 + ADMIN_TOKEN |
| `docs/deployment-guide-railway.md` | ✅ 6 步部署流程 + 验证 + 回滚 |
| `lib/routes/health.js` | ✅ DB 检查 → 异常抛 503 → server.js catch 返回正确 HTTP 状态 |

## 部署流程

### 用户侧需要做的：
1. Railway 账号 + $5/月 Hobby Plan
2. GitHub 独立仓库（或 Railway CLI 直推）
3. Railway Dashboard 配置环境变量
4. Railway Dashboard 挂载持久卷 → `/usr/src/app/data`

### 自动完成的：
- Railway 检测 Dockerfile → 构建 → 部署
- HEALTHCHECK 每 30s 验证 DB 存活
- ON_FAILURE 自动重启（最多 3 次）
- 单实例保证（numReplicas=1）

## 验证清单

```bash
# 1. 健康检查
curl https://<app>.up.railway.app/health
# → {"status":"healthy","timestamp":"...","uptime":...,"memory":{...}}

# 2. 预测接口
curl https://<app>.up.railway.app/api/predict/<match_id>

# 3. 持久化测试（部署 + 插数据 + 重新部署 → 数据还在）
```

## 回滚

Dashboard → Deployments → ⋯ → Redeploy previous version

## 已知限制

- SQLite 单写者 → 不能多实例（已设置 numReplicas=1）
- 首次部署后必须手动挂载持久卷（Railway 限制）
- 没有 Docker 本地环境 → 无法本地构建验证（依赖 Railway 构建日志）
