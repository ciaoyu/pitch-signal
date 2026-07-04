# PitchSignal 剩余功能实施计划 (v3)

> 生成日期：2026-06-30 ｜ v2 修订：2026-07-01（合并 DeepSeek / OpenAI / Gemini 三方评审）
> **v3 修订：2026-07-02** —— 全盘核实实际完成状态（不采信文档自称，逐项在代码里找证据）+ 整合预测模型方法论专题成果
> 修订依据：[FEEDBACK_CONSOLIDATION.md](FEEDBACK_CONSOLIDATION.md)（v2 决策留痕）、[prediction-methodology-review.md](prediction-methodology-review.md)（v3 新增 P4 依据）
> 派工与分支：[EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)
>
> **v3 主要变化**：① 逐项代码核实，纠正若干"文档说完成、代码是半成品"的条目；② 新增 **P4 预测模型深化**（市场赔率/阵容身价/洲际修正/校准层，均有独立开源项目实证支持）；③ P3-5 标记为「已用更优方案完成」而非原计划路径；④ 标注**世界杯已开赛**（2026-06-11 起），后续排期原则从"赛前齐备"改为"不影响直播 + 补关键缺口"。

---

## 上下文：世界杯已进行中

当前日期 2026-07-02，2026 世界杯已进行约 3 周（揭幕战 2026-06-11）。这意味着：
- 任何改动优先级判断要先问"会不会影响正在直播的比赛体验"，其次才是"值不值得做"。
- P2-2（进球推送）这类"实时增强"类功能，越晚上线单场收益越低，但只要赛程未结束（决赛 7-19）仍有价值，不必因"已经晚了"而放弃。
- 预测模型类改动（P4）不在直播关键路径上，可以和直播稳定性工作并行推进，互不阻塞。

---

## 已完成（截至 2026-07-04，逐项代码核实）

| 功能 | 文件 | 核实证据 |
|------|------|------|
| Track A 后端（盘中重定价） | `lib/live-reprice.js` | — |
| Pressure Index 后端 + 前端 | `lib/services/pressure-index.js`, `static/js/match-renderers.js` | — |
| Match Moments 引擎 | `lib/services/moment-detector.js`, `lib/jobs/moment-sync.js` | — |
| FIFA API 桥接 | `lib/services/fifa-api.js`, `scripts/build-fifa-match-bridge.js` | — |
| xG 框架（等 key） | `lib/services/xg-service.js`, `lib/jobs/xg-collector.js` | 仍空转，等待 API key |
| 置信区间输出 | `lib/prediction.js` → `calcConfidenceInterval()` | — |
| 概率走势线 / 三色胜率弧形 / 出线概率 / bracket 点击 / 角球模型 / 赔率采集 | 同 v2 | — |
| **回测样本扩容至 964 场（1930-2022 全部世界杯）+ Elo 全历史热启动** ⓝ³ | `data/history/worldcup_*.json`, `data/elo-seed.json`, `lib/backtest.js`, `scripts/{fetch-worldcup-history,build-elo-seed}.js` | commit `fbb5713`+`8ec3172`+`761c2d2`+`4e6ca76`；方向准确率 42.19%→57.88% [95% CI 54.8-61.1%]，与业界 Elo 基线重叠；三方独立审计（数据对账/泄漏检查+独立复算/引用数字核查）通过 |
| **回测 Bootstrap 置信区间** ⓝ³ | `lib/backtest.js` → `bootstrapCI()` | 对应 backtest-backlog.md 问题2，已完成 |
| **P0-1~P0-5 全部完成** ⓝ³ | 见下 P0 表 | git merge 记录 + 代码证据双重核实 |
| **P1-1（最佳第三名）、P1-3（温度单位）完成** ⓝ³ | `lib/qualification.js:123-147/174/281`, `static/js/match-detail.js:526-550` | — |
| **P2-3（市场赔率分歧）、P2-4（用户预测vs模型）、P2-5（新闻/伤停注入）完成** ⓝ³ | `lib/routes/odds-divergence.js`, `lib/routes/user-predictions.js`, `lib/teamContext.js:169-`（真实 Tavily fetch，`TAVILY_API_KEY` 门控，无 key 优雅降级） | P2-5 此前一次审计误判为"半成品"——实际 fetch 循环存在，只是没滚动到那一段代码 |
| **P4-1~P4-5 预测模型深化全部完成** | `lib/prediction.js`, `lib/services/{market-value-signal,continental-strength-signal}.js`, `lib/backtest-calibration.js`, `lib/routes/calibration.js`, `static/js/elo-prediction.js` | commits `cb2897b`/`fd9c30c`/`99a79f0`/`4925cd1`/`0409fea`/`7b3ea63`；专项测试 `test-shin-devig.js`、`test-prediction-market-ui.js`、`test-market-value-signal.js`、`test-continental-strength-signal.js`、`test-calibration-report.js`、`test-elo-guided-base-lambda.js` 均已注册进全量测试 |

> ⓝ³ = v3 新核实为「已完成」或「重大进展」。ⓝ（v2 认定）见历史 diff。

---

## P0 — 上线前稳定性骨架 ✅ 全部完成

| 项 | 状态 | 证据 |
|---|---|---|
| P0-1 FIFA-API 容错 + schema 校验 | ✅ | `lib/services/fifa-api.js:51-119`（schema 校验 + 缓存降级 + stale 标记） |
| P0-2 `/health` 增强 | ✅ | `lib/routes/health.js:8-38`（FIFA 连通状态 + job 时间戳） |
| P0-3 终场比分回写 job | ✅ | `lib/services/score-writeback.js:57-100` + `moment-sync.js:199-223` |
| P0-4 实时比分条 + 状态机 | ✅ | `lib/db.js:308-327`（match_live_stats schema）+ `live-state-machine.js` |
| P0-5 关键路径 try/catch + 日志 | ✅ | `lib/logger.js` + 各 job 的 `safeExec` 用法 |

无遗留项。

---

## P1 — 低风险高确定性纠偏

| 项 | 状态 | 剩余工作 |
|---|---|---|
| P1-1 出线概率补最佳第三名 | ✅ 完成 | 无 |
| P1-2 venueFactor `applied=false` 根因 | ✅ 完成 | `scripts/diagnose-venue-factor.js` 遍历 104 场并区分 applied/no-effect/unverifiable/mismatch；当前 0 mismatch，21 场 applied，输出 λ 前后证据。 |
| P1-3 温度单位统一 | ✅ 完成 | 无 |
| P1-4 bracket matchId 校验 | ✅ 完成 | `scripts/validate-bracket-ids.js` 常驻校验完整 bracket、季军赛、重复 ID、轮次、阶段和开球时间；当前 32/32 匹配，0 failures。 |
| P1-5 体验验收 | ✅ 完成 | 桌面 1280px 与移动端 320px 的 Live/Schedule/Prediction/Standings/HUD 已完成真实浏览器验收；记录见 `docs/P1-5_UX_ACCEPTANCE.md`。生产环境待 GitHub source redeploy 后复验。 |

---

## P2 — 世界杯期间高价值新功能

| 项 | 状态 | 说明 |
|---|---|---|
| P2-1 换人影响追踪 | ✅ 完成 | 取换人前后 10 分钟 Pressure Index，以每侧至少 3 个快照计算线性回归斜率差，写入 `match_moments.raw_json.substitution_impact`；Bench 展示 ↑/↓/→，不足明确标记。 |
| P2-2 PWA 推送（进球推送） | ✅ **完成**（commit `ab2b030`，分支 `p2/pwa-push`，2026-07-02，已核实） | `web-push` 真实发送 + 404/410 失效订阅自动清理；`selectPushableGoals()` 用时间窗口+DB查重双重保险防重启补发历史进球；sw.js push/notificationclick + 前端订阅入口 + hash 深链全链路打通；`test-pwa-push.js`（15断言）+ 全量 35 suites/481 asserts 独立复核通过；本地起服务器实测 `/api/push/public-key`(503)/`/api/push/subscribe`(400/200 且真实写入 SQLite) 全部符合预期，页面按钮正确反映真实 `Notification.permission`。**唯一剩余**：Railway 部署 `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` 后的真机送达验收（本机无法测，`.env.example` 已登记这两个变量） |
| P2-3 市场赔率分歧展示 | ✅ 完成 | 见上「已完成」 |
| P2-4 用户预测 vs 模型 | ✅ 完成 | 见上「已完成」 |
| P2-5 新闻/伤停注入 TeamContext | ✅ 完成 | 见上「已完成」，依赖 `TAVILY_API_KEY` 是否配置 |
| P2-6 Bot 知识库注入出线概率 + 赛事情境 | ✅ **完成**（commit `e0aa816`，2026-07-03，生产已核实） | 根因是线上 `group_standings` 表为空而 UI 走 `/api/standings`；改为复用 `/api/standings` 路由（`lib/routes/matchup.js:252` 同款模式），DB 仅作 legacy fallback。部署后确认生产 bot 引用真实 W/D/L/GF/GA/GD 数字；记录见 `docs/P2-6_BOT_PRODUCTION_ACCEPTANCE.md`。 |

---

## P3 — 需数据样本/分析验证后才上

| 项 | 状态 | 说明 |
|---|---|---|
| P3-1 Track B 压力指数校准 | ❌ 未做 | 待有效样本量后再做，等赛事推进 |
| P3-2 Calibration 校准报告面板 | ✅ **已通过 P4-4 完成** | 已实现 Brier/校准桶报告、`GET /api/calibration-report` 与前端「模型表现」面板；见下 P4-4 |
| P3-3 点球专项模型 | ❌ 未做 | 保持原计划，低优先 |
| P3-4 阵容 CI 动态收窄 | 🟡 部分（`lineupUncertainty` 已接但无数据源驱动） | 保持原计划 |
| P3-5 回测样本扩充 | ✅ **已完成，但路径与原计划不同** | 原计划是"混入 Euro/Copa 到 300+ 场"；实际做法是全量 1930-2022 世界杯正赛 964 场（openfootball，CC0）+ martj42 49k 场用于 Elo 热启动，不混赛事等级做评估——这是三方研究交叉验证过的更优方案（详见 [prediction-methodology-review.md](prediction-methodology-review.md)）。**Euro/Copa 继续导入进正赛评估集仍是可选加强项，非阻塞，价值有限**（964 场 CI 已经和业界基线重叠） |
| P3-6 角球准确率回测 | ❌ 未做，等数据（20-48场） | 保持原计划 |

---

## P4 — 预测模型深化 ✅ 全部完成

> 背景：session6-7 做了两轮外部研究（制度化系统 + 10 个开源同行项目）+ 964 场实证回测，结论见 [prediction-methodology-review.md](prediction-methodology-review.md)。核心判断：**数学模型（Elo+Poisson）已到该模型族天花板（~60%），继续调参收益趋近于零**；真正还有空间的是三个新信号轨道。按预期收益排序：

| 项 | 状态 | 证据 |
|---|---|---|
| P4-1 市场赔率轨道 | ✅ 已完成（commits `cb2897b`, `fd9c30c`） | `calcOddsFactor()` 已采用 Shin's method 去水；市场赔率保留为独立基准/分歧排名，不把未验证市场信号强行写入主预测；`test-shin-devig.js`、`test-prediction-market-ui.js` 覆盖算法与展示。 |
| P4-2 阵容身价信号 | ✅ 已完成（commits `99a79f0`, `4925cd1`） | 已新增 `market-value-signal.js`，按阵容身价生成有界信号并接入预测服务；闸门默认关闭，须通过 baseline 验收才启用；`test-market-value-signal.js` 覆盖信号和基线保护。 |
| P4-3 洲际强度修正 | ✅ 已完成（commit `0409fea`） | 已新增 `continental-strength-signal.js`，按足联映射提供有界洲际强度修正并接入概率头；闸门默认关闭；`test-continental-strength-signal.js` 覆盖映射、修正和基线保护。 |
| P4-4 校准层（合并原 P3-2） | ✅ 已完成（commit `7b3ea63`） | `lib/backtest-calibration.js` 已基于 `prediction_snapshots`/赛果生成 Brier、校准桶与 Platt 参数；已提供 `GET /api/calibration-report` 和前端「模型表现」面板；`test-calibration-report.js` 覆盖报告链路。 |
| P4-5 lambda 过期常数修复 | ✅ 已完成（commit `7b3ea63`） | `eloGuidedBaseLambda` 已改为可配置参数并由回测显式传入，消除孤立硬编码常数；`test-elo-guided-base-lambda.js` 验证默认值、覆盖值及预测影响。 |

### 明确不做（有三重独立证据支撑）
- 不引入 ML/梯度提升层——同特征下无增益，小样本更差
- 不做双变量 Poisson（Karlis-Ntzoufras）——无证据优于 Dixon-Coles
- 不自爬博彩网站——ToS 风险，P4-1 走正规 API

---

## 贯穿项（随时可并）

| 项 | 状态 |
|---|---|
| a11y / 色盲 | ✅ 完成近期快修 | 核心按钮/Tab ≥44px；Standings 与 HUD Tab 有选中状态；概率条有 ARIA 标签、百分比常显及非纯颜色图案区分；320px 无页面级横向溢出。 |
| 新模块补测试 | ✅ `test-bot-kb.js` 已注册进 `test-runner.js`（2026-07-03 核实，文档之前过期）；P0/P1 系列多数靠既有测试间接覆盖，无专项 |
| README 数据流图 | ✅ 完成（2026-07-04，手动补做）：`README.md` 新增 Mermaid 图，覆盖 FIFA API → Bridge → DB → Prediction → Frontend 主链路 + 全部 6 个后台任务（`lib/jobs/*.js`），经核实图中文件名与代码库一致 |
| env/闸门治理 | ✅ `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` 已补录 README（2026-07-03） |
| AI 复盘历史回填 | ✅ 完成（2026-07-04）：卡住根因是 `AI_POSTMORTEM_ENABLED` Beta 默认 false（非代码强制），已决定开启。本地/生产均设 `AI_POSTMORTEM_ENABLED=true` + 配好 `ANTHROPIC_API_KEY`/`DEEPSEEK_API_KEY`；跑 `scripts/backfill-ai-postmortems.js` 清空积压；核实本地 `predictions.db` 85/85 `completed`（含真实 AI 生成文案，非占位符），生产 86/86 `completed`；生产后台 worker 已确认自动接管新比赛复盘（deployment `c1bfc4d3`，启动日志显示已处理 1 条新复盘）；`npm test` 44/44 suites、569/569 asserts 全绿 |

---

## 技术债

- ~~ratings.json 数据源~~ → 已纠正（v2）
- ~~botKnowledgeBase 注入~~ → 已升级为 P2-6（进行中）
- i18n 迁移 → 仍是低优先，不变
- ~~`lib/prediction.js:59 baseLambda=1.5` 过期常数~~ → ✅ 已通过 P4-5 修复（commit `7b3ea63`）

---

## 建议排期（世界杯进行中，非赛前）

1. ~~P2-6 收尾~~ ✅ 完成（`fe7d167`，2026-07-02）
2. ~~P2-2 PWA 推送~~ ✅ 完成（`ab2b030`，分支 `p2/pwa-push`，2026-07-02；待部署 VAPID key 后真机验收）
3. ~~P4-1~P4-5 预测模型深化~~ ✅ 全部完成（`cb2897b`/`fd9c30c`/`99a79f0`/`4925cd1`/`0409fea`/`7b3ea63`）
4. ~~README 数据流图~~ ✅ 完成（2026-07-04）
5. ~~AI 复盘历史回填~~ ✅ 完成（2026-07-04）
6. **P3 系列剩余项**（P3-1/P3-3/P3-4/P3-6）——等待足够比赛样本后再推进

## 分工与分支
见 [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)：角色分工矩阵、分支体系、工作顺序、每任务 IN/OUT 边界与核查标准。（v3 未改动分支体系；P4 系列实施时沿用了 `p4/*` 分支命名。）
