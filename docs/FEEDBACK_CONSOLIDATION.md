# 三方评审意见合并 · 决策留痕

> 生成日期：2026-07-01
> 输入：DeepSeek / OpenAI / Gemini 对 `docs/REMAINING_FEATURES_PLAN.md` 的评审（`~/Downloads/feedback.md`）
> 原则：取其精华、去其糟粕——**逐条对照真实代码核实**后再判断采纳与否，不照单全收。
> 配套文档：修订后的 [REMAINING_FEATURES_PLAN.md](REMAINING_FEATURES_PLAN.md)（v2）、[EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)（执行指南）。

---

## 总览

| 类别 | 处理 | 数量 |
|------|------|------|
| A. 评审正确——已实现项，改为「验证/增强」 | 采纳（纠偏，避免重复派工） | 7 |
| B. 评审误解——与项目约定冲突 | 驳回 / 改写 | 6 |
| C. 评审正确——真实遗漏 | 采纳，补入计划 | 7 主项 + 若干细节 |

核实方法：对每条「已实现/未实现」断言用 `grep` / `Read` 定位到具体 `file:line`。下表所有证据链接均可点击核对。

---

## A. 已实现项 → 改为「验证 / 增强」（采纳，纠偏）

这些是评审（主要 OpenAI、Gemini）最有价值的贡献：原计划把**已经实现**的功能当成从零开发，会造成重复派工。核实属实，全部采纳。

| 项 | 原计划表述 | 核实证据 | 修订后动作 |
|----|-----------|---------|-----------|
| 出线概率前端 | 「前端没有任何展示」 | [elo-prediction.js:196](../static/js/elo-prediction.js:196) 已请求 `/api/qualification-probabilities` 并渲染「出线形势」 | 改为：补**最佳第三名**拆分 + 浏览器验证 |
| 出线后端拆分 | 「当前可能只返回 1/2 名」 | [qualification.js:188-190](../lib/qualification.js:188) 已返回 `championProb`/`runnerUpProb`/`qualifyProb`/`eliminatedProb`，并记录完整位次分布 `positions[]` | 后端拆分**已有**；但见下方 ⚠️ 赛制 bug |
| venueFactor | 「没有进入 Poisson 预测」「从零接入」 | [prediction.js:203-204](../lib/prediction.js:203) 已 `venueFactors.computeForMatch()` 并乘进 `homeLambdaAdj/awayLambdaAdj` | 改为：定位 `applied=false` 的 match/team 映射**根因**，非从零接入 |
| bracket 点击 | 「现有 bracket 是静态展示」 | [bracket.js:266](../static/js/bracket.js:266) 已设 `data-action="open-match-from-bracket" data-match-id` | 改为：matchId 覆盖**校验** + 真机点击验证 |
| 阵容 CI | 「读取 `has_confirmed_lineup` 字段……CI 收窄系数从 1.4 降至 1.0」 | [prediction.js:427](../lib/prediction.js:427) `calcConfidenceInterval()` 已吃 `lineupUncertainty` 参数；[prediction.js:409](../lib/prediction.js:409) 传 `params.lineupUncertainty ?? 0` | 改为：补 `has_confirmed_lineup` **数据源**并把它换算成 `lineupUncertainty` 传入，非新增 CI 因子 |
| 角球模型 | 计划完全未提及 | [matchup.js:805](../lib/routes/matchup.js:805) `/api/corner-analysis/:id` 已上线（预测角球 + 实时追踪 + over/under） | 补进「已完成」清单；第三优先级加**角球准确率回测**（MAE<2.0，累计 20-48 场后评估） |
| 球员评分数据 | 技术债：「`data/matchup-rating/ratings.json` 球员级别数据几乎为空」 | `matchup-rating/ratings.json` 与 `db/ratings.json` 实含 **48 队 / 720 人** FIFA25 风格评分（`"teams":48,"players":720`）；且**路径写错**（真实路径无 `data/` 前缀） | 技术债纠正为：「目前为静态 FIFA25 评分，后续可接入实时/动态球员评分源」；修正路径 |

> ⚠️ **赛制 bug（C 类，但与 A 关联）**：[qualification.js:177-180](../lib/qualification.js:177) 把 `idx >= 2`（小组第 3、4 名）一律计入 `eliminatedCount`。2026 世界杯 48 队 12 组，**每组前 2 + 8 个最佳第三名共 32 队**进淘汰赛——当前模拟把所有第三名判定为出局，**最佳第三名晋级概率缺失**。因此「补最佳第三名」是**后端跨组逻辑修正 + 前端展示**，不止是前端 1 天工作量。DeepSeek「最佳第三名必做」一条**采纳并升级为必做**。

---

## B. 与项目约定冲突 → 驳回 / 改写（去其糟粕）

这些建议本身有合理动机，但基于对现状的误解，或与项目既定约定（CLAUDE.md：零外部框架 / 单实例 SQLite / 内联 `tx()` 双语）冲突。**驳回原方案，保留合理内核改写**。

| 评审建议（来源） | 核实事实 | 处理 |
|-----------------|---------|------|
| 引入 pino 日志库（DeepSeek） | [lib/logger.js](../lib/logger.js) 已是结构化 JSON 日志（含 level/timestamp/meta）；引入 pino 违反 CLAUDE.md「零外部框架」 | **改写**：增强既有 logger + 关键路径加 try/catch + Railway 日志持久化。**不引入 pino** |
| 新增 `GET /health`（DeepSeek） | [health.js](../lib/routes/health.js) 已存在（DB 连通 + uptime + memory） | **改写**：在既有端点上**增强**——加 FIFA API 连通状态 + 最后成功同步时间戳 |
| 提供 `db/migrations/` 脚本、评估迁移 PostgreSQL（DeepSeek） | [db.js:325](../lib/db.js:325) 已有内联 `migrations` 数组（幂等 ALTER）；WAL 已开（[db.js:32](../lib/db.js:32)）；CLAUDE.md 明确「单实例、SQLite 不支持并发写」是设计选择 | **驳回 Postgres 迁移**（与单实例架构冲突，世界杯期写入量可控）；新表沿用既有 `CREATE TABLE IF NOT EXISTS` + migrations 数组模式，**不引入迁移框架** |
| 抽象统一 CacheManager / Redis（DeepSeek） | `middleware/cache.js` 已提供 `getCached(key,ttl)` / `setCache(key,data)`，CLAUDE.md 已列为约定 | **改写**：新模块统一沿用既有 `middleware/cache.js`，**不新造 CacheManager、不引 Redis** |
| 「测试体系完全缺失，只有 1 个测试脚本」补 jest/mocha（DeepSeek） | CLAUDE.md：已有 **19 个测试文件 / ~400 断言**，`npm test` 串行执行，standalone `assert`（无框架） | **改写**：判断有误。仅为**新模块**补同构的 `scripts/test-*.js`，**不引入 jest/mocha** |
| 引入 `locales/zh.json` i18n 框架（DeepSeek） | 项目用内联 `tx(zh,en)` + `getTeamNameI18n()` / `getTeamNameZh()`（[team-data.js]）双语，前端到处是 `tx('体感','Feels')` | **驳回/降级**：大规模重构风险高、收益低；新功能继续走 `tx()`。列为远期可选技术债 |

---

## C. 真实遗漏 → 采纳，补入计划（取其精华）

核实后确认为真实缺口或前置条件，补入 v2 计划。

| 遗漏项（来源） | 核实证据 / 现状 | 归入优先级 |
|---------------|----------------|-----------|
| 终场比分回写闭环（DeepSeek） | `matches` 表（[db.js:307](../lib/db.js:307)）已有 `home_score/away_score/played`，但未见终场回写 job——这是校准/Brier（任务 18）的**前置条件** | **P0**（score-writeback） |
| 实时比分 + 比赛状态机（DeepSeek） | [match_live_stats](../lib/db.js:273) 只有 shots/corners/poss/pressure，**无比分与 status 字段**；缺 pre/ht/et/pen/end 状态机 | **P0**（live-score-state-machine） |
| FIFA-API 容错 + schema 校验（DeepSeek） | [fifa-api.js](../lib/services/fifa-api.js) 是唯一桥接源，限流/结构变动会停摆 | **P0**（fifa-api-resilience） |
| 新闻/伤停注入预测上下文（Gemini） | [teamContext.js:80](../lib/teamContext.js:80) 明确 TODO：「真实新闻源尚未接入……接入前返回空数组，绝不编造」 | **P2**（teamcontext-news） |
| 回测样本扩充（Gemini） | [backtest-backlog.md:5](backtest-backlog.md:5) 仅 2018+2022 共 128 场，统计显著性不足；已规划扩到 300-400 场 | **P3**（backtest-expansion） |
| param-sweep 上线工作流（Gemini） | `scripts/param-sweep.js` 已写好网格搜索，但「最优参数如何应用到生产」无工作流 | **P3** |
| 市场赔率分歧展示（DeepSeek/原计划任务8） | 赔率采集**已大量存在**：[odds-collector.js:29](../lib/jobs/odds-collector.js:29)、[the-odds-api.js](../lib/services/the-odds-api.js)、[routes/odds.js](../lib/routes/odds.js)、PredictionService 已用 `fetchMatchOdds`。缺的是 `model_vs_market` 分歧计算 + 展示 | **P2**（odds-divergence，从「新建 odds-service」降级为「补分歧层」） |

**细节精华（采纳，分散到各任务的边界/核查中）：**
- 最佳第三名设为**必做**（见 A 类 ⚠️）。
- bracket matchId **校验脚本**：开工前遍历 bracket JSON 的 matchId 在赛程中查找，输出缺失/失配，提前修复。
- 换人影响：窗口取样要求**最少快照数**（如 ≥3），不足则标「数据不足」，避免误导箭头。
- 用户预测**防刷**：同 session 同场只投一次（可改）+ 总频率限制。
- 推送 `notificationclick`：解析 payload `matchId` 打开对应比赛详情，形成闭环。
- a11y / 色盲：色条叠图案 + 百分比常显 + 关键状态用文字标签而非纯色块。
- 移动端 ≥44px 触控 / 320px 窄屏布局（呼应记忆 `feedback-hud-mobile-layout`）。
- Bot 知识库注入出线概率 + 赛事情境（[botKnowledgeBase.js](../lib/botKnowledgeBase.js)）。
- 压力校准统计陷阱：防多重比较/选择偏差，采用置换检验或控制整体错误率，而非裸 p<0.05。
- README 补 Mermaid 数据流图（FIFA API → Bridge → DB → Prediction → Frontend）。
- env/密钥/闸门治理：PWA push（VAPID）、赔率、AI 复盘的 env 统一登记 Railway Variables，禁入 Git，失败降级文案。

---

## 与三方原始结论的差异（虚心但严谨）

- **OpenAI** 的「先改计划准确性，再做低风险高确定性，再体验验收，再新功能，最后做需样本的」排序最贴合现状，v2 基本采纳此骨架。其 5 条「已实现项」核实**全部属实**。
- **DeepSeek** 的架构/运维视角补足了原计划的空白（P0 稳定性），**采纳但收敛**——剔除 pino / Postgres / 重造缓存 / 重建测试体系等与现状冲突项。
- **Gemini** 的「历史文档对照」最有价值的是**角球模型已实现**、**ratings.json 720 人**、**teamContext 新闻 TODO**、**回测样本**四条，核实全部属实，补入。

> 一句话总结：评审的「纠偏」价值 > 「加功能」价值。最大收益是**避免对 6 个已实现模块重复派工**，其次是把**比分状态机/结果回写/FIFA 容错**这三块上线前必备的稳定性骨架补成 P0。
