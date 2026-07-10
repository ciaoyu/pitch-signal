# 验收报告：负责人 A — P0 生产概率安全隔离与目标语义（v2 返工）

> 状态：**待总控验收。本轮不合并、不推送、不部署。**
> 分支：`codex/prediction-p0-quarantine-v2`
> 基线：`d7cb2a4`（当前干净主仓，**非**旧基线 `835847c`）

---

## 1. 上轮打回的阻断项 — 修复对照

| # | 上轮阻断项 | v2 修复 |
|---|-----------|---------|
| 1 | 提交基于旧基线 `835847c`，无法覆盖当前主仓已合并的 Fatigue(KO-5)、容量 Venue、KO λ 收缩 | 从干净主仓 `d7cb2a4` 新建分支；**未整体 cherry-pick** 旧提交，仅把可复用逻辑重新套用到当前代码 |
| 2 | 当前主仓 Fatigue 已真实进入概率（weight=0.04, maxTilt=0.025），旧测试因缺该代码而误过 | `lib/prediction.js` 构造器 `fatigue:0`、`QUARANTINED_SIGNALS` 含 `fatigue`；`lib/services/PredictionService.js` 不再构建/传入 `fatigueSignal`；`components` 中无 fatigue |
| 3 | 东道主若为名义 away 队，旧实现只关 home 加成、不处理东道主 | P0 阶段**全部世界杯比赛关闭名义主场加成**：`neutralVenue=true` 对所有 WC 比赛生效；仅保留 `hostSide` 事实标记（home/away/none），`hostEffectEstimatedBy:'pending'`，等待数据估计 |
| 4 | `advance.available=false` 却返回 50/50 数值，自相矛盾 | 淘汰赛 `advance:{home:null, away:null, available:false, displayOnly:true, usedInModel:false, method:'unavailable_null'}`；小组赛 `advance:null`。不再返回任何概率数字 |
| 5 | 海拔/高温手工 β（0.03/0.01/32°C）称作"数据驱动、已研究" | 降级为 `shadow_only`：`envFactors.appliedInModel:false`，λ 不变（shadow 仅展示）；明确标注等待 Owner E 估计 |
| 6 | `configHash` 声称只 Elo+Poisson，融合数组仍允许 Odds/MarketValue/Continental，且未覆盖权重/置信度/rho/环境/门控 | `configHash` 现为 `modelContract` 的 SHA-256（12-hex），完整覆盖 `activeSignals`、`quarantinedSignals`、`baseWeights`、`elo`、`poisson{homeAdvantage,globalAvgGoals,rho}`、`envFactors`、`knockoutShrinkage`、`gates`、`neutralVenueRule` |
| 7 | 测试只覆盖 PredictionEngine 直调，缺真实 PredictionService / 场馆解析 / schedule 淘汰赛识别 / API 响应 | 新增 `scripts/test-prediction-p0-quarantine-v2.js`，含 F（真实 PredictionService：schedule KO `760484` + 场馆 `MetLife Stadium`→USA；小组赛 `999999`）与 G（API 路由 `GET /api/predict/:matchId`） |
| 8 | 验收报告把"版本号+configHash"错误勾选为"逐场 artifact + paired delta" | 本报告中二者严格区分（见 §4）：版本号+configHash 属**模型契约（A 完成）**；逐场 artifact + paired delta 属 **Owner D**，明确标"等待D" |

---

## 2. 对照 master plan「负责人 A 验收」逐条核对

- [x] **世界杯中立场 fixture 对调 home/away 后，不因数据顺序获得主场加成**
  证明：`neutralVenue=true` 时 `applyHome=false` → `eloHomeAdvantage=0`、`applyHomeAdvantage:false`；测试对比「同 fixture 开启主场加成」vs「中立场」：开启时 `homeWin` 更高、`awayWin` 更低，中性后无加成、且 team-swap 不变。
- [x] **美国/加拿大/墨西哥仅在本国场馆得到 host 标记**
  证明：`PredictionService` 用 `HOST_COUNTRY_TEAM_ID` 由 `venue.country` 判定；`hostSide` 仅当 `homeId/awayId===hostTeamId` 时取 home/away，否则 `'none'`。服务/API 测试断言 `hostSide='home'`（USA 主场）、`applyHome=false`。
- [x] **`components` 中没有伪 Coach、容量 Venue、手工 Fatigue 的非零权重**
  证明：构造器权重 `coach:0, venue:0, fatigue:0`；`signals` 数组移除三者；测试以「带/不带 coach/venue/fatigue 输入」跑同 fixture，结果逐位一致，证明无残留影响。
- [x] **KO 90分钟 H/D/A 与最终晋级 H/A 分开且各自归一**
  证明：新增 `regulation:{homeWin,draw,awayWin}` 单独归一；`advance` 仅淘汰赛非 null 且为 `null/null`（不可用），不混入 `regulation`。
- [x] **小组赛和淘汰赛均有 fixture 测试**
  证明：专项测试覆盖 KO 赛 `760484`（regulation 与小组一致、λ 收缩被隔离）与小组赛 `999999`（`isKnockout=false`、`advance=null`）。
- [x] **`npm test` 全绿**
  证明：见 §3。
- [x] **新版本必须改变 `model_version` / `config_hash`，不得冒充旧模型**
  证明：`MODEL_VERSION='p0-quarantine-v2-2026-07-10'`，`CONFIG_HASH=605c04a6cc47`；专项测试验证当 `baseWeights` 变化时 `configHash` 随之改变（契约完整性）。

---

## 3. 测试汇总（全量验收以当前 77 suites / 910 asserts 为起点）

**全量套件：**
```
Suites:  78 passed, 0 failed, 0 skipped, 78 total
Asserts: 974 passed, 0 failed
```
（较基线 +1 suite / +64 asserts：新增 `test-prediction-p0-quarantine-v2.js`）

**专项测试 `scripts/test-prediction-p0-quarantine-v2.js`：59 assertions 全过**
- A. 中立场 / 东道主规则（含东道主为 away 队）
- B. Coach / 容量 Venue / Fatigue 移除证明（带/不带输入结果一致）
- C. KO λ 收缩隔离 + regulation/advance 拆分
- D. 环境 β shadow-only（λ 不变）
- E. 完整 `modelContract` + `configHash`（权重变更则 hash 变）
- F. 真实 `PredictionService`（schedule KO + 场馆中性识别，含 `760484`、小组赛 `999999`）
- G. API 路由 `GET /api/predict/:matchId`

**回测不变量（合法模型变更，非回归）：**
```
accuracy  = 0.55497925  (55.50%)   ← 旧主仓 0.5788
meanBrier = 0.58623131
meanLogLoss = 0.98875067
```
说明：因 P0 隔离移除了未估计的名义主场加成（全部 WC 中立场）+ coach/容量Venue/Fatigue，数值下降属**诚实的新模型精度**，已更新 `test-eval-baselines.js` 与 `test-w1d-pipeline-audit.js` 的 bit-identical 钉。

---

## 4. A 的产出 vs D 的产出（关键纠正）

> 旧报告错误地把「版本号 + configHash」勾选为「逐场 artifact + paired delta」。二者是不同层级、不同负责人。

**A 在本轮已完成（模型契约层）：**
- [x] `MODEL_VERSION` 与 `CONFIG_HASH`（=`modelContract` 的 SHA-256 12-hex）
- [x] 完整 `modelContract`（活跃/隔离信号、权重、置信度、rho、环境、门控、中立场规则）
- [x] 以上可作为**逐场预测的可复现契约来源**（任何一场预测都附带 version+hash）

**逐场 artifact + paired delta（属 Owner D，本轮 NOT done by A）：**
- [ ] 964 场逐场预测快照（backtest-predictions.csv）
- [ ] 2026 prospective ledger
- [ ] classwise calibration / ECE
- [ ] 模型版本分层的 paired deltas 与 95% CI（以赛事为 cluster 的配对检验）
- [ ] 消融 / bootstrap
- **状态：等待 D**（Owner D 的 `codex/research-artifacts-v2` 分支；A 不负责，也不应勾选完成）

> 边界说明：A 的 `version` + `configHash` 是**逐场快照应携带的元数据字段**，但它本身不是「逐场 artifact」也不是「paired delta」。旧报告的勾选混淆了"契约字段"与"artifact 产物"。

---

## 5. 文件变更清单

修改（仅赛前核心概率，未动回测导出/数据库/live UI）：
- `lib/elo.js` — `expectedScore(ratingA, ratingB, homeAdvantage=0)`，调用方显式传参
- `lib/poisson.js` — 移除手工 KO λ 收缩，标记 `_knockoutShrinkageQuarantined=true`；`applyHomeAdvantage` 受控
- `lib/prediction.js` — 隔离 coach/venue/fatigue、环境降级 shadow、regulation/advance 拆分、`modelContract`/`configHash`、中立场/`hostSide` 语义
- `lib/services/PredictionService.js` — 场馆国家→中立场+host 判定；移除 fatigueSignal 构建/传入
- `lib/backtest.js` — walk-forward 传递 `neutralVenue:true, hostTeamId`（修复隔离前 home 加成残留）
- `version.json` — `version:"20260710"`，描述更新为 P0 quarantine v2
- `scripts/test-knockout-prediction-wiring.js` — 改写为新契约断言
- `scripts/test-eval-baselines.js`、`scripts/test-w1d-pipeline-audit.js` — bit-identical 钉更新为隔离后数值
- `scripts/test-runner.js` — 注册新专项测试

新增：
- `scripts/test-prediction-p0-quarantine-v2.js`（59 assertions）
- 本报告 `docs/acceptance/prediction-p0-quarantine-v2.md`

---

## 6. 未完成项（等待 D，非 A 阻塞）

- 逐场 artifact、paired delta、calibration、消融 → **等待 D**
- 东道主效应大小（host effect size）→ 等待 Owner E 数据估计（`hostEffectEstimatedBy:'pending'`）
- 环境 β（海拔/高温/WBGT/旅行/休息）→ 等待 Owner E 研究（`envFactors.status:'shadow_only'`）

---

## 7. 结论

A 的 P0 隔离与目标语义返工已完成并满足 master plan 全部 A 验收标准；全量 `npm test` 78 suites / 974 asserts 全绿，专项 59 assertions 全绿，覆盖 PredictionEngine / PredictionService / 场馆解析 / schedule 淘汰赛识别 / API 响应。逐场 artifact 与 paired delta 严格归属 Owner D，本报告不勾选完成、明确标"等待D"。**本轮不合并、不推送、不部署，待总控验收。**
