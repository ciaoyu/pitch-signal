# 公测放行总闸 — 2026-06-21

> 角色：发布闸门总协调（WorkBuddy）。不动代码，不写部署细节，不兼任 reviewer。
>
> 公测定位：产品体验公测。对外承诺赛程/实时比分/球队资料/基础概率预测/实验性赛后复盘。不展示旧准确率、击败市场、自我进化、实时 Polymarket。

---

## 一、角色边界

| 角色 | 负责 | 禁止 |
|------|------|------|
| **antigravity** | 代码修复交接包，进入待 reviewer 状态 | 不改归档文案，不写部署文档，不碰模型指标 |
| **claude** | 文档口径统一（Brier 数字、文案红线、归档标注） | 不碰代码，不碰部署配置，不碰模型参数 |
| **qclaw** | 部署闭环文档（Railway 部署指南、验收命令、回滚方案） | 不碰归档指标，不碰模型回测，不改业务代码 |
| **WorkBuddy**（本角色） | 维护总清单、协调交付、组织验收、追踪外部权限 | 不改任何代码/文档/部署配置，不兼任 reviewer |
| **独立 Reviewer**（待老板指定） | 最终验收签字 | 不能由 antigravity/claude/qclaw/WorkBuddy 兼任 |

---

## 二、各角色交付物清单

### 2.1 antigravity — 代码修复交接包

| ID | 交付物 | 状态 | 备注 |
|----|--------|:----:|------|
| AG-1 | Shot on goal 事件分类修复（35/35 通过） | 待交付 | 未提交，代码在 `lib/eventFilter.js` L74 |
| AG-2 | Scheduler 切到 Service 层 | 待交付 | 未提交，代码在 `lib/match-snapshot-scheduler.js` |
| AG-3 | 预测页免责声明注入 | 待交付 | 文案见安全手册 2.1 节 |
| AG-4 | Polymarket 融合详情前端 gating | 待交付 | `app.js` L2313-2325 加 POLYMARKET_ENABLED 判断 |
| AG-5 | Bot fallback 文案替换 | 待交付 | `bot.js` L44 + `static/js/bot.js` L18, L131 |
| AG-6 | 前端底部 bar / header 文案替换 | 待交付 | `templates/index.html` L137, L236 |
| AG-7 | 赛后复盘 accuracy 标签上下文说明 | 待交付 | `app.js` 复盘 panel 底部 |
| AG-8 | 确认 test 隔离 + health readiness 正常 | 已就绪 | `lib/db.js:13-20` TEST_DB_PATH, `lib/routes/health.js:11` 503 |
| AG-9 | 确认写接口鉴权链正确 | 已就绪 | `bot.js:13` BOT_API_TOKEN\|\|ADMIN_TOKEN, `prediction.js:141` WRITE_API_TOKEN\|\|ADMIN_TOKEN |
| AG-10 | 确认四闸门默认关闭 | 已就绪 | `.env.example` POLYMARKET/PUNDIT/AUTO_CALIBRATION=false |

### 2.2 claude — 文档口径统一

| ID | 交付物 | 状态 | 备注 |
|----|--------|:----:|------|
| CL-1 | Brier 指标统一（已复跑确认） | ✅ 已交付 | 正式基线: 2018=0.6642/42.19%, 2022 OOS=0.6439/43.75%, Combined=0.6540/42.97%。旧 0.5516/59.38% 废弃 |
| CL-2 | 归档 README 更新数字 + 废弃声明 | ✅ 已交付 | `docs/archive/engineering-reviews-2026-06/README.md` 已更新 |
| CL-3 | 4 份归档文档旧基线标注 | ✅ 已交付 | project-review / track-e-backtest / ai-brain-worktracks / final-evaluation 顶部已加废弃声明 |
| CL-4 | prediction_model_explanation.md 对齐 | ✅ 已交付 | section 3.1 已用正式基线数字，Bot 说明已与公测边界对齐 |
| CL-5 | "自我进化"叙事残留（归档文档）加注 | ✅ 已交付 | 仅加注，不改正文：review.md / ai-brain-worktracks / prediction-systems-research |
| CL-6 | 命令口径统一 | ✅ 已交付 | 回测正式入口：`node run_backtest.js`；同日隔离验证：`node scripts/test-backtest-sort.js` |

### 2.3 qclaw — 部署闭环文档

| ID | 交付物 | 状态 | 备注 |
|----|--------|:----:|------|
| QL-1 | 部署指南（Railway）完成 | 已就绪 | `docs/deployment-guide-railway.md` |
| QL-2 | 部署文档纠偏记录 | 已就绪 | `docs/deployment-review-2026-06-21.md` |
| QL-3 | `.env.example` 三令牌已列出 | 已就绪 | BOT_API_TOKEN / WRITE_API_TOKEN / ADMIN_TOKEN |
| QL-4 | `railway.toml` 格式修正 | 已就绪 | 顶层 [build]+[deploy]，待实机确认 |
| QL-5 | polymarketFusion applied===false 验收文档 | 已就绪 | 待实机执行 |
| QL-6 | 持久卷 Shell 校验和验收文档 | 已就绪 | 待实机执行 |
| QL-7 | 三令牌残留检查文档 | 已就绪 | 待实机执行 |

---

## 三、总放行清单

### 分类 A：代码/测试已完成

> 责任人：antigravity。Reviewer 验收时抽查确认。

| # | 项 | 责任人 | 状态 | 证据 |
|---|-----|:------:|:----:|------|
| A1 | Shot on goal 修复 + 35/35 测试通过 | antigravity | 待交付 | `scripts/test-eventFilter.js` |
| A2 | Scheduler 切 Service 层 | antigravity | 待交付 | `lib/match-snapshot-scheduler.js` |
| A3 | 前端免责声明/文案替换（6 处） | antigravity | 待交付 | `templates/index.html` + `app.js` + `bot.js` |
| A4 | Polymarket 融合详情前端 gating | antigravity | 待交付 | `app.js` L2313-2325 |
| A5 | Test 隔离（TEST_DB_PATH=:memory:） | antigravity | ✅ 已就绪 | `lib/db.js:13-20`, `package.json` test script |
| A6 | Health readiness（DB 异常→503） | antigravity | ✅ 已就绪 | `lib/routes/health.js:10-12` |
| A7 | Bot 写接口鉴权链 | antigravity | ✅ 已就绪 | `lib/routes/bot.js:13` BOT_API_TOKEN\|\|ADMIN_TOKEN |
| A8 | 复盘写接口鉴权链 | antigravity | ✅ 已就绪 | `lib/routes/prediction.js:141` WRITE_API_TOKEN\|\|ADMIN_TOKEN |
| A9 | 四闸门默认关闭 | antigravity | ✅ 已就绪 | `.env.example` POLYMARKET/PUNDIT/AUTO_CALIBRATION=false |

### 分类 B：文档/归档已收口

> 责任人：claude。完成后 Reviewer 逐项核对。

| # | 项 | 责任人 | 状态 | 证据/备注 |
|---|-----|:------:|:----:|------|
| B1 | Brier 数字统一（归档 README + prediction_model_explanation） | claude | ✅ 已就绪 | 正式基线: 2018=0.6642/42.19%, 2022 OOS=0.6439/43.75%, Combined=0.6540/42.97% |
| B2 | 4 份归档文档旧 0.5516 基线标注为"已废弃" | claude | ✅ 已就绪 | project-review / track-e / worktracks / final-eval 顶部均已加声明 |
| B3 | "自我进化"叙事 3 处加注 | claude | ✅ 已就绪 | review.md / worktracks / research 顶部加注，正文保留为历史记录 |
| B4 | 命令口径统一（`node run_backtest.js` 为正式入口） | claude | ✅ 已就绪 | 两份核心文档已统一命令引用 |
| B5 | 运营安全手册 | WorkBuddy | ✅ 已就绪 | `docs/operations/public-beta-safety-manual.md` |
| B6 | 部署指南 | qclaw | ✅ 已就绪 | `docs/deployment-guide-railway.md` |
| B7 | 部署纠偏记录 | qclaw | ✅ 已就绪 | `docs/deployment-review-2026-06-21.md` |
| B8 | `.env.example` 完整（闸门 + 令牌） | qclaw | ✅ 已就绪 | 4 闸门 + 3 令牌均已列出 |

### 分类 C：待平台授权与真实部署验证

> 以下全部依赖外部权限（GitHub owner / Railway 账号 / Dashboard 权限）。未获授权前状态=「待执行」。

| # | 项 | 责任人 | 状态 | 依赖 |
|---|-----|:------:|:----:|------|
| C1 | 创建独立 GitHub 仓库 | 平台 owner | 🔒 待授权 | GitHub 权限 |
| C2 | 推送代码到独立仓库 | 平台 owner | 🔒 待授权 | C1 |
| C3 | 创建 Railway 项目 + 连接 GitHub | 平台 owner | 🔒 待授权 | Railway 账号 |
| C4 | 配置环境变量（含三令牌全空） | 平台 owner | 🔒 待授权 | C3 |
| C5 | 首次部署成功 | 平台 owner | 🔒 待授权 | C1-C4 |
| C6 | Railway Volume 创建 + 挂载 `/usr/src/app/data` | 平台 owner | 🔒 待授权 | C5, Dashboard 唯一入口 |
| C7 | 持久卷验收 — Shell md5sum + 哨兵文件 + 重启比对 | qclaw | 🔒 待授权 | C6 |
| C8 | polymarketFusion.applied===false 验收 | qclaw | 🔒 待授权 | C5 |
| C9 | 三令牌残留检查 — Variables 截图 + curl 403 ×2 | qclaw | 🔒 待授权 | C4 |
| C10 | 单实例确认 numReplicas=1 | qclaw | 🔒 待授权 | C3 |
| C11 | railway.toml 实机格式确认 | qclaw | 🔒 待授权 | C5 |
| C12 | 回滚演练 | qclaw | 🔒 待授权 | C5 |
| C13 | 打回滚标签 + SQLite 备份 | 平台 owner | 🔒 待授权 | C7 完成后 |

---

## 四、独立验收入口

> **触发条件**：antigravity（AG-1~7 全部交付）+ qclaw（C7-C12 实机验证完成）
>
> **当前进度**：claude（CL-1~6）✅ 已交付，分类 B 已收口。分类 A 和 C 仍在推进。
>
> **谁来做**：老板指定的独立 Reviewer。**不能是 antigravity、claude、qclaw、WorkBuddy 中任何一人。**

### 验收清单

| # | 验收项 | 方法 | 通过标准 |
|---|--------|------|----------|
| R1 | 同日批处理无泄漏 | 取同组同日两场比赛，手工验算 Elo+Poisson 概率，与 API 返回比对 | 预测概率仅基于单场数据，无跨场次信息污染 |
| R2 | 2022 OOS 可复现 | 干净环境 `node run_backtest.js`（正式入口，输出 2018 / 2022 OOS / Combined 三行） | 输出与文档基线一致；同日批量隔离已通过 `scripts/test-backtest-sort.js`（17 项断言） |
| R3 | API 不泄露旧准确率/过期指标 | `curl /api/predict/:id \| jq` 全量检查 | 不含 polymarketFusion.applied=true、不含 Brier、不含 accuracy |
| R4 | 前端不泄露禁止关键词 | 见下方 R4 详细规则 | 见下方通过标准 |
| R5 | Bot 文案不泄露 Polymarket | `grep -rn "Polymarket\|polymarket" lib/routes/bot.js static/js/bot.js` | 全部为空（归档注释除外） |
| R6 | 部署文档与代码行为一致 | 逐项对照：令牌降级链、闸门变量名、health 返回格式 | 文档描述与代码实际行为匹配 |
| R7 | 降级文案前端实际渲染正确 | 浏览器实测预测不可用 / 复盘不可用 / Bot 不可用三种场景 | 降级文案与安全手册一致，无技术报错外泄 |

#### R4 详细规则：前端关键词泄漏检查

> 以下 grep 命令为 Reviewer 验收时必须执行的标准检查。通过标准：**所有命令输出为空**。

**检查 1：用户可见页面（HTML + JS）不得包含禁止关键词**

```bash
# 范围：templates/ 和 static/js/、static/css/（不含 scripts/、不含 node_modules/）
# 禁止列表：Polymarket（含大小写变体）、击败市场、自我进化、实时赔率
grep -rn -i "polymarket\|击败市场\|自我进化\|实时赔率\|实时盘口" \
  templates/ static/js/ static/css/ \
  --include="*.html" --include="*.js" --include="*.css"
# 预期：空（0 行）
```

**检查 2：免责声明正确出现，且上下文不含禁止叙事**

```bash
# 确认免责声明存在（必须出现，不是禁止）
grep -rn "实验性\|非投注建议\|not betting advice\|experimental" \
  templates/ static/js/app.js \
  --include="*.html" --include="*.js"
# 预期：至少匹配到免责声明块（预测页顶部 + 底部 bar）
```

**检查 3：不含旧准确率数字**

```bash
# 检查静态资源中是否残留旧 Brier 或准确率数字
grep -rn "0\.5516\|59\.38%\|0\.6642\|0\.6540\|0\.6530\|0\.6621\|Brier\|accuracy.*%" \
  templates/ static/js/ \
  --include="*.html" --include="*.js"
# 预期：空（0 行）。注意：代码注释中如有这些数字也视为泄漏
```

**检查 4：Polymarket 仅限指定白名单中出现**

> 白名单 = 仅检查以下用户可见与协调文档，其他文档（含 archive/）不纳入检查范围。

```bash
# 白名单文件：用户可见前端 + 对外/协调文档
#   templates/index.html
#   static/js/app.js
#   static/js/bot.js
#   docs/operations/public-beta-safety-manual.md
#   docs/BETA-RELEASE-GATE-2026-06-21.md
#   docs/prediction_model_explanation.md
#   docs/deployment-guide-railway.md
#   docs/deployment-review-2026-06-21.md

grep -rn -i "polymarket" \
  templates/index.html \
  static/js/app.js static/js/bot.js \
  docs/operations/public-beta-safety-manual.md \
  docs/BETA-RELEASE-GATE-2026-06-21.md \
  docs/prediction_model_explanation.md \
  docs/deployment-guide-railway.md \
  docs/deployment-review-2026-06-21.md
# 预期：仅在 docs/operations/public-beta-safety-manual.md 的「禁止清单」中出现（合法）
#       + 可能出现在 docs/BETA-RELEASE-GATE-2026-06-21.md 的 R4/R5 规则自身中（合法）
```

**白名单外不检查**：`docs/archive/`、`docs/SPRINT_PLAN.md`、`docs/SENIOR_PM_REVIEW.md` 等历史文档中的 Polymarket 提及属于归档历史记录，不纳入公测合规检查。

**R4 通过标准**：检查 1 空 + 检查 2 匹配到免责声明 + 检查 3 空 + 检查 4 仅安全手册/本闸门文档中出现

### 签字规则

- 全部 7 项通过 → Reviewer 签字 → 老板最终放行
- 任一项未通过 → 退回对应角色修复 → 重新验收全部 7 项（不做单项补验）
- 签字记录写在本文档末尾："验收人：___  日期：___  结论：___"

---

## 五、当前阻塞项汇总

| 阻塞 | 影响范围 | 解除条件 |
|------|----------|----------|
| antigravity AG-1~7 未交付 | 分类 A 不完整（2/9），前端合规文案未实现 | antigravity 提交代码修复 + 前端文案改动 |
| 外部平台权限未获得 | 分类 C 全部 🔒（0/13） | GitHub owner + Railway 账号授权 |
| 独立 Reviewer 未指定 | R1-R7 无法启动 | 老板指定 Reviewer 人选 |

---

## 六、发布节奏

```
当前状态：分类 A（2/9 就绪）→ 分类 B（8/8 ✅ 已收口）→ 分类 C（0/13）→ 验收（0/7）

下一步：
  1. antigravity 交付 AG-1~7 → 分类 A 收口
  2. 老板授权平台 → 分类 C 开始执行
  3. C7-C12 全部实机验证通过 + A 收口 → 触发验收
  4. Reviewer 执行 R1-R7 → 全部通过 → 老板放行 → 公测 URL 公开
```

---

*总协调：WorkBuddy（绵绵冰） | 最后更新：2026-06-21 16:00 — R2 改为 17 项断言，R4 检查 4 改为白名单模式*
