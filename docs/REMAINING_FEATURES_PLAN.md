# PitchSignal 剩余功能实施计划 (v2)

> 生成日期：2026-06-30 ｜ 修订：2026-07-01（合并 DeepSeek / OpenAI / Gemini 三方评审）
> 修订依据：[FEEDBACK_CONSOLIDATION.md](FEEDBACK_CONSOLIDATION.md)（决策留痕）
> 派工与分支：[EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)
>
> **v2 主要变化**：① 6 个已实现模块从「开发」改为「验证/增强」，避免重复派工；② 新增 P0 稳定性骨架；③ 补入角球模型（已完成）、最佳第三名、回测样本扩充等遗漏项；④ 纠正 ratings.json 技术债。

---

## 已完成（截至 2026-07-01）

| 功能 | 文件 |
|------|------|
| Track A 后端（盘中重定价） | `lib/live-reprice.js` |
| Pressure Index 后端 + 前端 | `lib/services/pressure-index.js`, `static/js/match-renderers.js` |
| Match Moments 引擎 | `lib/services/moment-detector.js`, `lib/jobs/moment-sync.js` |
| FIFA API 桥接 | `lib/services/fifa-api.js`, `scripts/build-fifa-match-bridge.js` |
| xG 框架（等 key） | `lib/services/xg-service.js`, `lib/jobs/xg-collector.js` |
| 置信区间输出 | `lib/prediction.js` → `calcConfidenceInterval()` |
| 概率走势线（Track A 前端） | `static/js/match-renderers.js` → `renderLiveProbPanel()` |
| 三色胜率弧形 | `static/js/match-renderers.js` → `renderHudWinProbPanel()` |
| **出线概率（前端展示 + 后端 1/2 名拆分）** ⓝ | `static/js/elo-prediction.js`, `lib/qualification.js`（championProb/runnerUpProb/qualifyProb/eliminatedProb） |
| **venueFactor 已乘进 λ** ⓝ | `lib/prediction.js:203`（`computeForMatch()`） |
| **bracket 点击打开 HUD** ⓝ | `static/js/bracket.js:266`（`data-action="open-match-from-bracket"`） |
| **角球预测模型** ⓝ | `lib/routes/matchup.js:805`（`/api/corner-analysis/:id`，预测 + 实时追踪 + over/under） |
| **赔率采集 + 隐含概率** ⓝ | `lib/jobs/odds-collector.js`, `lib/services/the-odds-api.js`, `lib/routes/odds.js` |

> ⓝ = v2 新认定为「已完成」，原 v1 误列为待开发。详见 [FEEDBACK_CONSOLIDATION.md](FEEDBACK_CONSOLIDATION.md) A 表。

---

## P0 — 上线前稳定性骨架（采纳但收敛；剔除 pino/Postgres）

> 世界杯期间稳定运行的前提，须先于新功能。已剔除与项目约定冲突的项（见 CONSOLIDATION B 表）。

### P0-1 FIFA-API 容错 + schema 校验
**目的**：[fifa-api.js](../lib/services/fifa-api.js) 是唯一数据桥接源，限流或结构变动会让全站停摆。
**做什么**：返回数据做字段 schema 校验（缺字段不崩溃，降级返回）；缓存上次成功响应，限流/失败时回退到缓存 + 标记 stale。
**工作量**：1 天。

### P0-2 `/health` 增强
**目的**：[health.js](../lib/routes/health.js) 现仅 DB+uptime+memory，不足以判断业务健康。
**做什么**：在既有端点上增加 FIFA API 连通状态 + 各定时任务最后成功同步时间戳。**不新建端点**。
**工作量**：0.5 天。

### P0-3 终场比分回写 job（校准闭环前置）
**目的**：`matches` 表（[db.js:307](../lib/db.js:307)）有 `home_score/away_score/played` 但缺终场回写，导致 P3 校准/Brier 无实际结果可比。
**做什么**：新 job 或在 `moment-sync.js` 监听终场 moment，回写 `home_score/away_score/played=1`（或 status='finished'）。
**工作量**：1 天。

### P0-4 实时比分条 + 比赛状态机
**目的**：[match_live_stats](../lib/db.js:273) 无比分/status 字段，用户只见概率不见比分，体验割裂。
**做什么**：采集并展示当前比分条（与概率走势同面板）；状态机管理 `pre/match/ht/et/pen/end`，据此切换展示。
**工作量**：1.5 天（全栈）。

### P0-5 关键路径 try/catch + 日志
**目的**：重定价、moment-sync、推送等关键路径异常缺上下文记录。
**做什么**：在关键路径加 try/catch，接入既有 [logger.js](../lib/logger.js)（结构化 JSON）；Railway 配日志持久化。**不引入 pino**。
**工作量**：0.5 天。

---

## P1 — 低风险高确定性纠偏（先验证再增强）

### P1-1 出线概率：补最佳第三名 ⚠️
**目的**：[qualification.js:177-180](../lib/qualification.js:177) 把小组第 3、4 名一律记 eliminated。**2026 赛制**：12 组每组前 2 + 8 个最佳第三名 = 32 队进淘汰赛。当前最佳第三名晋级概率缺失，信息量砍半。
**做什么**：后端加**跨组**最佳第三名排名逻辑，返回 `thirdPlaceQualifyProb`；前端在出线展示加第三名概率（黄）色条；浏览器验证。
**边界**：这是后端跨组逻辑修正，非纯前端。
**工作量**：1.5 天（后端 1 + 前端 0.5）。

### P1-2 venueFactor `applied=false` 根因
**目的**：venueFactor 已乘进 λ（[prediction.js:203](../lib/prediction.js:203)），但部分场次 `applied=false`，因子未生效。
**做什么**：诊断脚本遍历赛程输出每场 applied 与失败原因（缺 espn_id / 场地名未匹配 / 数据缺失）；场地名加别名模糊匹配；未匹配记 warning。
**边界**：不改 venueFactor 数值模型、不动 Poisson 公式。
**工作量**：0.5 天。

### P1-3 温度单位统一/校验
**目的**：天气面板硬编码 `°C`（[match-detail.js:519](../static/js/match-detail.js:519)、[match-renderers.js:1666](../static/js/match-renderers.js:1666)）；源数据未必带单位。
**做什么**：统一字段（weather.json 存 `tC/feelsC` 为摄氏，[venueFactors.js:193](../lib/venueFactors.js:193) 有 °F 换算）；按数值范围自动判别或调用天气 API 时强制单位；前端单位偏好持久化。
**工作量**：1-2 小时。

### P1-4 bracket matchId 校验 + 真机点击
**目的**：bracket 点击已接（[bracket.js:266](../static/js/bracket.js:266)），但 matchId 须与 ESPN/FIFA 赛程对应，错位则打不开。
**做什么**：写校验脚本遍历 bracket JSON 所有 matchId 在赛程中查找，输出缺失/失配并修复；真机点击确认能打开 HUD。
**工作量**：0.5 天。

### P1-5 体验验收（对照设计稿）
**目的**：原计划偏功能、漏体验验收。
**做什么**：HUD / Standings / Prediction 对照 [UI-AUDIT-REPORT.md](../design_handoff_pitchsignal/UI-AUDIT-REPORT.md)（动态 max-width、Live/Schedule 细节等）；真实浏览器冒烟（Playwright 或 preview 工具）；移动端 ≥44px / 320px（记忆 `feedback-hud-mobile-layout`）。
**工作量**：1 天。

---

## P2 — 世界杯期间高价值新功能

### P2-1 换人影响追踪
**目的**：换人已入 `match_moments`（type=`substitution_key`），但未追踪换人后压力/xG 斜率变化。
**做什么**：后端取换人前后 N 分钟 `match_live_stats` 快照算 Pressure Index 斜率差，存 `match_moments.raw_json.substitution_impact`；前端在 `renderBenchAnalysis()` 换人条目旁显示 ↑/↓。
**边界**：窗口取样要求**最少快照数 ≥3**，不足标「数据不足」，不生成误导箭头。
**工作量**：1.5 天。

### P2-2 PWA 推送（进球推送）
**目的**：有 manifest，但 SW 只做静态缓存，无推送。
**做什么**：后端 `lib/services/push-service.js`（`web-push`）+ `POST /api/push/subscribe` + `push_subscriptions` 表（按既有 `CREATE TABLE IF NOT EXISTS` 模式）；`moment-sync.js` 检测 `goal` 推送。前端 `sw.js` 注册 push handler + `notificationclick` 解析 `matchId` 打开对应比赛；关键页离线 fallback 缓存 + 「离线数据，上次更新 XX:XX」。
**依赖**：VAPID key（DevOps 先配 Railway env）。
**工作量**：2 天。

### P2-3 市场赔率分歧展示
**目的**：赔率采集已存在（见已完成清单），缺「模型 vs 市场分歧」展示。
**做什么**：复用既有采集 + 隐含概率（去 vig），新增 `model_vs_market_delta`，`|model-market|>0.08` 标 divergence；前端 hud-winprob 下加黄色提示行。
**边界**：仅作 benchmark，不把赔率作为权重喂进模型；POLYMARKET 闸门保持关闭。
**前置**：核实 `match_odds_benchmark` 表是否已建（未见则新建）。
**工作量**：1 天（已有采集，省去原 2 天）。

### P2-4 用户预测 vs 模型
**目的**：赛前用户下注，赛后比准确率，有社交属性。
**做什么**：`user_predictions` 表（匿名 session UUID）；`POST /api/user-predict`、`GET /api/user-predict/:matchId`（社区众筹概率）；前端赛前卡片加 主/平/客 按钮 + 「社区：52% 主胜」。
**边界**：**防刷**——同 session 同场只投一次（可改）+ 总频率限制（如 5s/次）；展示剔除异常刷票时段。
**工作量**：1.5 天。

### P2-5 新闻/伤停注入 TeamContext
**目的**：[teamContext.js:80](../lib/teamContext.js:80) TODO——实时新闻/伤停未喂给预测 AI 上下文。
**做什么**：把 Tavily 抓取的 match/team 新闻清洗后注入 `TeamContextManager`，Phase 2 AI 微调胜率时基于真实伤停校准。
**边界**：无数据返回空数组，**绝不编造**（沿用现有约定）。
**工作量**：1.5 天。

### P2-6 Bot 知识库注入出线概率 + 赛事情境
**目的**：[botKnowledgeBase.js](../lib/botKnowledgeBase.js) 可读出线概率/standings/match context，让 Chat 也能展示。
**做什么**：把 qualification、standings、match context 注入 Bot 回答。
**工作量**：0.5 天。

---

## P3 — 需数据样本/分析验证后才上

### P3-1 Track B → 压力指数校准
**原则**：压力指数当前只展示不影响概率，须回测验证后才升级。
**做什么**：从 `match_live_stats` 拉 `sustained_pressure_alert`，统计 alert 后 5/10/15 分钟进球概率 vs base rate；显著才允许给 `lib/live-reprice.js` 的 lambdaRemaining 加 calibrated 系数（≤+15%）。
**统计严谨性**：防多重比较/选择偏差，用**置换检验**或控制整体错误率，而非裸 p<0.05、样本 ≥30。
**工作量**：分析 0.5 + 实现 0.5（等数据）。

### P3-2 Calibration 校准报告面板
**目的**：差异化卖点——展示模型是否过度自信。
**做什么**：`lib/backtest-calibration.js` 读 `prediction_snapshots` 对比实际结果算 Brier Score + 10 桶校准曲线；`GET /api/calibration-report`；前端「预测」页加「模型表现」子 Tab（Brier / 校准曲线 SVG / 方向正确率）。
**依赖**：P0-3 终场比分回写。
**工作量**：后端 1.5 + 前端 1。

### P3-3 点球专项模型
**做什么**：整理历史点球命中率 → `data/penalty-shootout-stats.json`；改 `lib/live-reprice.js` 的 `penaltyHomeWin` 用队伍历史命中率代替 0.5。
**工作量**：数据 1 + 实现 0.5。

### P3-4 阵容 CI 动态收窄
**目的**：`calcConfidenceInterval()` 已吃 `lineupUncertainty`（[prediction.js:427](../lib/prediction.js:427)），但缺数据源驱动。
**做什么**：**先核实**首发确认值存于何表/字段（`lineups-sync.js` 已在赛前 50 分钟同步，但 `pre_match_snapshots.has_confirmed_lineup` 未见于 schema）；建立后换算成 `lineupUncertainty` 传入预测链路。
**工作量**：0.5 天。

### P3-5 回测样本扩充 + param-sweep 上线
**目的**：[backtest-backlog.md:5](backtest-backlog.md:5) 仅 128 场，统计显著性不足；`param-sweep.js` 已写好但无上线工作流。
**做什么**：导入 Euro 2020/2024、Copa America 2021 至 300+ 场（标记来源）；建立定期跑 `param-sweep.js` 寻优 + 一键更新生产预测参数的工作流。
**工作量**：数据 1.5 + 工作流 0.5。

### P3-6 角球准确率回测
**做什么**：角球模型已上线（[matchup.js:805](../lib/routes/matchup.js:805)），累计 20-48 场后评估方向正确率与 MAE（目标 <2.0 个角球），据此调风格系数。
**工作量**：0.5 天（等数据）。

---

## 贯穿项（随时可并）
- **a11y / 色盲**：色条叠图案（斜线/点状）+ 百分比常显 + 关键状态用文字标签而非纯色块。
- **新模块补测试**：为 P0–P3 新模块写同构 `scripts/test-*.js`（沿用 `assert`，不引框架）。
- **README 数据流图**：Mermaid 画 FIFA API → Bridge → DB → Prediction → Frontend + 定时任务触发关系。
- **env/闸门治理**：VAPID / 赔率 / AI 复盘的 env 登记 Railway Variables，禁入 Git，失败降级文案。
- **AI 复盘历史回填**：DeepSeek 复盘的旧 fallback 不自动重生——补回填策略/重新生成按钮/状态标签。

---

## 技术债（已纠正）
- ~~`data/matchup-rating/ratings.json` 球员级别数据几乎为空~~ → **纠正**：`matchup-rating/ratings.json` 与 `db/ratings.json` 已含 48 队 / 720 人 FIFA25 评分（路径无 `data/` 前缀）。技术债改为：**目前为静态 FIFA25 评分，后续可接入实时/动态球员评分源**。
- `lib/botKnowledgeBase.js` 注入出线概率/赛事情境 → 已升级为 P2-6。
- i18n：当前内联 `tx()`，远期可选迁移 JSON 字典（低优先，重构风险）。

---

## 分工与分支
见 [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)：角色分工矩阵、分支体系、工作顺序、每任务 IN/OUT 边界与核查标准。
