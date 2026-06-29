# 公测运营安全手册

> 版本：2026-06-21 | 适用阶段：受控公开 Beta（产品体验公测，非预测能力公测）
> 
> 本手册覆盖降级文案、风险提示、边界说明、手工回退路径。代码闸门实施由工程团队负责，本手册只定义运营安全要求。

---

## 零、公测安全摘要（给值班人员 30 秒读完）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 预测是否接入 Polymarket 实时赔率 | ❌ 硬关 | `lib/prediction.js` 强制回退基线，环境变量无法开启 |
| 预测是否由 AI 修改概率 | ❌ 硬关 | `PredictionService` 将 AI 入口固定为 `false` |
| 后台 AI 是否自动生成赛后复盘 | ❌ 默认关闭 | `AI_POSTMORTEM_ENABLED=false`，不自动调用模型或写复盘 |
| 自动校准是否运行 | ❌ 已关闭 | `AUTO_CALIBRATION=false`，不自动调整模型参数 |
| 匿名写接口是否开放 | ❌ 已鉴权 | Bot/复盘 POST 必须提供配置的管理员 Token |
| 旧 Brier 0.5516 / 59.38% 是否展示 | ❌ 不展示 | 该指标已失效，前端不渲染 |
| "击败市场"等叙事是否出现 | ❌ 禁止 | 所有页面不得声称击败市场、自我进化、实时 Polymarket |
| 健康检查是否返回 503 | ✅ 已实现 | `GET /health` DB 异常时返回 503（`lib/routes/health.js:11`） |
| 测试是否隔离生产数据库 | ✅ 已实现 | `npm test` 设置 `TEST_MODE=1`，强制内存库 |

---

## 一、降级文案

降级文案定义了各功能不可用时前端应展示的内容。文案提供中英双语版本，通过 `tx()` 函数切换。

### 1.1 预测服务不可用

**触发条件**：`GET /api/predict/:matchId` 返回 error 或无数据。

**zh-CN**：
> 预测服务暂时不可用
> 
> 我们的实验性概率模型当前无法生成预测，可能原因包括数据源更新延迟或后台服务维护中。请稍后刷新页面重试。
> 
> 你可以继续浏览赛程、实时比分和球队资料。

**en**：
> Prediction Service Unavailable
> 
> Our experimental probability model cannot generate predictions at this time. This may be due to data source delays or backend maintenance. Please refresh the page to try again.
> 
> You can still browse the schedule, live scores, and team profiles.

**实现位置**：`static/js/app.js` `loadPrediction()` 函数，当 `pred.error` 或 `!pred` 时替换 `pred-card` 内容。

---

### 1.2 数据库异常（全局）

**触发条件**：`GET /health` 返回 503。

**前端无特定展示** —— 健康检查用于部署平台自动重启/报警，不展示给用户。但以下页面可能在数据库异常时返回空数据，需展示通用降级文案：

**zh-CN**：
> 数据加载失败
> 
> 赛事数据暂时无法获取，请稍后刷新。

**en**：
> Data Loading Failed
> 
> Match data is temporarily unavailable. Please refresh later.

**实现位置**：各 tab 的数据加载 catch 块。当前 app.js 各 `api()` 调用已用 `.catch(() => null)` 做了静默降级，需确认各 tab 都有空状态展示（当前预测 Tab 已有 `暂无预测数据`，其他 Tab 需检查）。

---

### 1.3 ESPN API 数据源不可用

**触发条件**：ESPN API 超时或返回错误，导致赛程/比分/球队数据为空。

**zh-CN**：
> 数据源连接异常
> 
> 实时赛事数据源（ESPN）暂时不可达，显示的数据可能不是最新的。系统会自动重试连接。

**en**：
> Data Source Unreachable
> 
> The live data source (ESPN) is temporarily unreachable. Displayed data may not be current. The system will retry automatically.

**实现位置**：暂不需要前端特殊展示 —— ESPN 数据不可用时，`api('/api/schedule')` 等调用返回空或缓存数据，当前页面已有空状态处理。建议在底部 bar 加一个连接状态指示，而不是给用户看技术报错。

---

### 1.4 AI 赛后复盘不可用

**触发条件**：AI postmortem 生成失败（API key 未配置或模型不可达）。

**zh-CN**：
> 赛后数据复盘
> 
> 本场比赛的完整复盘暂未生成。当前展示的是赛前预测与真实比分的自动对比。AI 深度分析将在赛后数据完整后自动补充。

**en**：
> Post-Match Review
> 
> A full review for this match has not yet been generated. What you see is an automatic comparison between the pre-match prediction and the actual result. AI-powered analysis will be added once post-match data is complete.

**实现位置**：`static/js/app.js` 赛后复盘 panel。注意：这是"实验性赛后复盘"承诺范围内的功能，降级时不应报错，而是优雅降级为纯数据对比。

---

### 1.5 AI 问答 Bot 不可用

**触发条件**：Bot 鉴权未配置（`ADMIN_TOKEN` 为空）或 LLM API 调用失败。

**zh-CN**：
> AI 助理暂不可用
> 
> 智能问答功能目前在公测期间暂未开放。如需反馈数据问题，请通过页面反馈渠道联系我们。

**en**：
> AI Assistant Unavailable
> 
> The Q&A assistant is not available during the public beta. To report data issues, please use the feedback channel on this page.

**实现位置**：公测页面不渲染 Bot 入口；`static/js/bot.js` 保留上述降级文案，仅供未来经鉴权的内部入口复用。

---

### 1.6 比赛详情模态框加载失败

**触发条件**：`GET /api/match/:id` 等详情接口不可用。

**zh-CN**：
> 详情加载失败 — 请关闭后重试

**en**：
> Failed to load details — Please close and try again

---

## 二、风险提示

### 2.1 预测页全局免责声明（必须注入）

**位置**：预测 Tab（`id="tab-prediction"`）内容区最顶部，在 Elo 排名卡片上方。

**zh-CN**：
> ⚠️ 免责声明：本页面提供的概率预测基于 Elo 评分模型与 Poisson 进球预期模型的数学计算，属于实验性功能。预测结果不构成任何形式的投注建议、投资建议或赛事结果保证。我们不鼓励任何基于本页面概率进行的博彩行为。模型未接入实时博彩市场赔率。

**en**：
> ⚠️ Disclaimer: The probability predictions on this page are based on mathematical calculations using an Elo rating model and Poisson goal expectation model. They are experimental and do not constitute betting advice, investment advice, or any guarantee of match outcomes. We do not encourage gambling based on the probabilities displayed here. This model is not connected to live betting market odds.

---

### 2.2 赛后复盘准确率标签的上下文说明

**现状**：复盘 modal 中展示 `bias.accuracy` 标签（"精准命中" / "比分偏差" / "结果错误"），这些是对单场比赛预测 vs 实际结果的定性描述，并非统计意义上的模型准确率。

**zh-CN 上下文提示**（在复盘 panel 底部加）：
> * 以上"精准命中/比分偏差/结果错误"为单场比赛的预测-结果对比，不代表模型的整体预测准确率。模型整体表现需在足够样本量下通过 Brier 评分等统计指标评估。

**en**：
> * "Accurate / Score off / Wrong result" refers to a single match's prediction vs. actual comparison and does not represent the model's overall predictive accuracy. Overall performance must be evaluated using statistical metrics like Brier score over a sufficient sample size.

---

### 2.3 底部状态栏文案

**位置**：`templates/index.html` 底部 bar（第 236 行）。

**当前**：`ESPN 数据 · 自动刷新`

**改为 zh-CN**：
> 实验性概率模型 · 非投注建议 · ESPN 数据

**改为 en**：
> Experimental Model · Not Betting Advice · Data via ESPN

---

### 2.4 Header 副标题

**位置**：`templates/index.html` header（第 137 行）。

**当前**：`美加墨 · 赛事分析`

**改为 zh-CN**：
> 美加墨 · 赛事数据与实验性分析

**改为 en**：
> USA/MEX/CAN · Match Data & Experimental Analysis

---

### 2.5 赛后复盘的 AI 分析说明

**位置**：复盘页面 AI 分析区块顶部。

**zh-CN**：
> 🤖 AI 赛后分析（实验性）
> 
> 以下内容由 AI 模型自动生成，可能存在不准确之处，仅供参考。

**en**：
> 🤖 AI Post-Match Analysis (Experimental)
> 
> The following content is auto-generated by an AI model and may contain inaccuracies. For reference only.

---

### 2.6 概率进度条旁说明

**位置**：预测卡片中概率进度条旁的 tooltip 或小字说明。

**zh-CN**（在进度条底部的权重行加括号说明）：
> （实验性概率模型，非投注建议）

**en**：
> (Experimental model, not betting advice)

---

## 三、边界说明

### 3.1 公测功能承诺清单

以下为面向用户承诺可用的功能。超出此清单的功能不应在页面文案中出现或暗示可用。

| 功能 | 承诺描述 | 公测状态 |
|------|----------|----------|
| 赛程浏览 | 按日期查看完整世界杯赛程 | ✅ 可用 |
| 实时比分 | 进行中比赛的实时比分更新 | ✅ 可用（依赖 ESPN 数据源） |
| 球队资料 | 球队信息、阵容、教练等基础数据 | ✅ 可用 |
| 基础概率预测 | 基于 Elo + Poisson 的主/平/客胜概率 | ✅ 可用（实验性） |
| 实验性赛后复盘 | 赛前预测 vs 实际结果的对比分析 | ✅ 可用（含 AI 分析，实验性） |
| 小组积分榜 | 分组积分排名 | ✅ 可用 |

### 3.2 公测禁用功能清单

以下功能在公测期间 **不向用户承诺，不展示，不暗示**。代码可能已实现但在公测配置下不生效。

| 功能 | 公测状态 | 说明 |
|------|----------|------|
| 接入 Polymarket 实时赔率 | ❌ 硬关 | `POLYMARKET_ENABLED=false`。不展示任何市场赔率、不声称"击败市场" |
| 多模型融合概率 | ❌ 硬关 | Pundit 聚合器未接入预测管线 |
| AI 自动修改概率 | ❌ 硬关 | `PredictionService` 不调用 AI 入口；环境变量不能开启 |
| 自动校准 | ❌ 硬关 | `AUTO_CALIBRATION=false`。不自动调整 Elo K-factor 或模型权重 |
| 模型准确率指标 | ❌ 不展示 | 不在任何用户可见页面展示 Brier score、整体准确率、历史回测结果 |
| "自我进化"叙事 | ❌ 禁止 | 不在文案中出现"模型自我学习""模型持续进化"等声称 |
| AI 问答 Bot | ❌ 未开放 | 需要 `ADMIN_TOKEN` 鉴权，公测期间不配置则自动 403 |

### 3.3 用户可见与不可见的明确分界

**用户可以感知到**：
- 每一场比赛的主胜/平局/客胜概率（百分数）
- 概率进度条的颜色分区（绿/黄/红）
- 置信度标签（高/中/低）+ 百分比
- 预测比分（如 "2 - 1"）
- Elo 排名 Top 10
- 各组件拆解概率（Elo / Poisson / 教练 / 场馆）

**用户不能感知到**：
- Brier score 或任何聚合准确率指标
- 模型与市场赔率的对比（"我们的模型比市场准 X%"）
- 模型的历史回测数据
- 任何版本的"模型版本号"或"准确率提升日志"
- 实时 Polymarket 价格的任何引用

### 3.4 边界情况的处理原则

- **如果用户询问"这个预测准不准"** → 回答应强调"实验性质，不保证准确"，不要引用任何准确率数据
- **如果用户询问博彩建议** → 明确拒绝，指向免责声明
- **如果用户截图预测概率并传播为"AI 预测结果"** → 免责声明已在页面内，但客服口径应备好
- **如果 ESPN 数据源挂掉超过 1 小时** → 启动手工回退（见第四章），在页面上展示降级文案

---

## 四、手工回退路径

### 4.1 紧急关闭 Bot 问答接口

**场景**：Bot 被滥用、产生不当回复、或外部 LLM API 产生意外成本。

**操作**（重启或重新部署后生效）：

```bash
# 方法 1：清空 BOT_API_TOKEN 和 ADMIN_TOKEN 后重启
# 编辑 .env，将两个变量设为空或注释掉
# 然后重启服务器

# 方法 2：在 Railway 面板中删除 ADMIN_TOKEN 环境变量然后重新部署
```

**验证**：
```bash
curl -X POST http://localhost:5099/api/bot/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
# 期望: HTTP 403 {"error":"Bot chat is disabled in public beta"}
```

**当前代码保障**：`lib/routes/bot.js` — 未配置 `BOT_API_TOKEN` 或 `ADMIN_TOKEN` 时自动返回 403；公测前端不渲染入口。

---

### 4.2 紧急关闭手动赛后复盘写接口

**场景**：外部提交异常数据、触发 AI postmortem 产生意外模型成本。

**操作**（重启或重新部署后生效）：

```bash
# 清空 WRITE_API_TOKEN 和 ADMIN_TOKEN 后重启
# 编辑 .env，将两个变量设为空
# 重启服务器
```

**验证**：
```bash
curl -X POST http://localhost:5099/api/post-match-review \
  -H "Content-Type: application/json" \
  -d '{"matchId":"test"}'
# 期望: HTTP 403 {"error":"Write operations are disabled in public beta"}
```

**当前代码保障**：`lib/routes/prediction.js:140-146` — `checkAdminAuth` 在无 token 时返回 403。

---

### 4.3 Polymarket 误配置处置

**场景**：`POLYMARKET_ENABLED` 被误设为 `true`。

**操作**：
```bash
# 确认当前值
grep POLYMARKET_ENABLED .env

# 修正配置以保持下一阶段的部署安全
# 编辑 .env：POLYMARKET_ENABLED=false
```

**验证**：
```bash
curl http://localhost:5099/api/predict/760429 | jq '.marketSignalFusion.applied'
# 期望: false
```

**当前代码保障**：`lib/prediction.js` 已强制关闭融合；即使环境变量误设也不会采纳市场数据。

---

### 4.4 回滚到上一个公测安全版本

**场景**：新部署引入了回归问题，需要快速回退。

**Git 方式**：
```bash
# 查看最近的部署标签
git tag --sort=-creatordate | head -5

# 回滚到上一个安全标签
git checkout public-beta-safe-20260621

# 或者回滚到特定 commit
git revert <bad-commit-hash>
git push origin main
```

**Railway 方式**：
1. 在 Railway Dashboard → Deployments → 选择上一个成功的部署
2. 点击 "Rollback"

---

### 4.5 数据库恢复流程

**场景**：SQLite 数据库损坏、误操作导致数据丢失。

**预防措施**（应在部署时配置）：
- Railway Volume 挂载路径：`/data`
- `DB_PATH=/data/predictions.db`
- 定期自动备份脚本（建议每 4h 一次 cron）：

```bash
#!/bin/bash
# backup-db.sh — 应部署在 Railway cron job 中
BACKUP_DIR=/data/backups
mkdir -p "$BACKUP_DIR"
cp /data/predictions.db "$BACKUP_DIR/predictions-$(date +%Y%m%d-%H%M).db"
# 保留最近 48 个备份（2 天 × 每 4h = 12 个，保守一些保留 48 个）
ls -t "$BACKUP_DIR"/predictions-*.db | tail -n +49 | xargs rm -f
```

**恢复操作**：
```bash
# 1. 停止服务器
# 2. 列出备份
ls -lt /data/backups/
# 3. 恢复指定备份
cp /data/backups/predictions-20260621-1400.db /data/predictions.db
# 4. 重启服务器
```

---

### 4.6 前端紧急修正（跳过 CI/CD 直接修复高风险文案）

**场景**：发现某个文案违反了公测约定（如出现"击败市场"、"准确率 XX%"）。

**操作**：
```bash
# 直接编辑 static/js/app.js 或 templates/index.html
# 查找违规关键词
grep -n "Polymarket\|polymarket\|击败\|准确率\|accuracy\|Brier" static/js/app.js

# 修改后直接重启服务器（纯静态文件无需编译）
# 如果部署在 Railway，直接 push 即可触发自动部署
```

---

### 4.7 值班检查清单（每次部署后或每 4 小时）

```bash
# 1. 健康检查
curl -s http://localhost:5099/health | jq .

# 2. 预测接口返回不包含 Polymarket
curl -s http://localhost:5099/api/predict/760429 | jq '.marketSignalFusion.applied'  # 应为 false

# 3. Bot 接口不可公开访问
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5099/api/bot/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'  # 应为 403

# 4. 写接口不可公开访问
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5099/api/post-match-review \
  -H "Content-Type: application/json" \
  -d '{"matchId":"test"}'  # 应为 403

# 5. 前端页面不含禁止关键词
curl -s http://localhost:5099/ | grep -i "polymarket\|击败市场\|实时赔率\|自我进化"  # 应为空
```

---

## 五、前端合规文案变更清单

以下变更已实施；后续文案改动必须保持同等边界。

### 5.1 templates/index.html

| 位置 | 当前内容 | 改为 |
|------|----------|------|
| Header 副标题 | 保持 `美加墨 · 赛事分析` | 不夸大模型能力 |
| 第 236 行 底部 bar | `ESPN 数据 · 自动刷新` | `实验性概率模型 · 非投注建议 · ESPN 数据` |

### 5.2 static/js/app.js

| 位置 | 变更 |
|------|------|
| `loadPrediction()` 开头 | 注入中英双语免责声明（见 2.1 节） |
| 预测详情 | 移除 Polymarket 融合详情、市场赔率权重与盘口异动告警 |
| 赛后复盘 panel | accuracy 标签下方加入单场对比说明；AI 复盘标注实验性 |
| 比赛详情与赛前分析 | 移除赔率与 AI 问答入口 |

### 5.3 static/js/bot.js

| 位置 | 当前内容 | 改为 |
|------|----------|------|
| 公测页面 | 不加载 Bot 脚本或入口 |
| 保留的内部脚本 | 移除赔率措辞，并采用公测未开放的降级文案 |

### 5.4 lib/routes/bot.js

| 位置 | 当前内容 | 改为 |
|------|----------|------|
| 第 44 行 fallback 文案 | `本系统融合了 Elo 模型历史战绩、Poisson 进球预期以及实时 Polymarket 盘口赔率进行加权。` | `预测基于 Elo 评分与 Poisson 进球预期模型，为实验性参考，非投注建议。` |

---

## 六、客服/公关口径（FAQ 预案）

### Q: "你们的预测准吗？"
**A**: 我们的概率预测是实验性的数学模型，供产品体验参考，不保证预测准确性。不建议基于这些概率做任何实际决策。

### Q: "你们的模型和数据从哪里来？"
**A**: 基础概率预测基于 Elo 评分系统（球队历史实力评估）和 Poisson 分布模型（进球预期）。赛事数据来自 ESPN 公开数据源。

### Q: "为什么没有赔率/盘口数据？"
**A**: 我们是一个实验性足球数据产品，不接入实时博彩市场数据，也不提供投注建议。

### Q: "为什么赛后复盘有些比赛有 AI 分析、有些没有？"
**A**: AI 赛后分析是我们的实验性功能，会根据数据完整度自动生成。部分比赛的分析可能在数据齐全后补充。

### Q: "你们和博彩公司有关系吗？"
**A**: 没有。我们是一个独立的实验性足球数据分析项目，与任何博彩公司无关。

---

*文档维护：绵绵冰 (WorkBuddy) | 下次评审：公测上线前*
