# Owner A — 生产概率安全隔离 v3 验收报告

> 状态：**待总控验收。本轮不合并、不推送、不部署。**
> 分支：`codex/prediction-p0-quarantine-v3`（从干净 `d7cb2a4` 经独立 worktree 建立，不 cherry-pick v2、不整体继承 v2；v2 工作树保留仅作参考）。
> 模型版本：`p0-quarantine-v3-2026-07-10`　配置哈希：`2066763607e5`

---

## 1. 上轮（v2）阻断项 — 保持已修复

| 项 | 状态 |
|----|------|
| Fatigue / Coach / 容量 Venue / KO λ 收缩已从概率移除 | ✅ 保持 |
| 中立场 + `hostSide` 语义（含 host 为名义 away） | ✅ 保持 |
| `advance` 不可用 → `null`/`null`（非 50/50） | ✅ 保持 |
| 环境手工 β 降级为 `shadow_only` | ✅ 保持 |
| 服务层 / 场馆解析 / 淘汰赛识别 / API 测试 | ✅ 保持 |
| 完整 `modelContract` + SHA-256 `configHash` | ✅ 保持（v3 契约进一步收紧） |

---

## 2. 本轮 4 个新阻断项

### B1 — P0 公开路径强制只使用 Elo + Poisson
- **问题**：`signals` 数组仍含 `odds` / `marketValue` / `continentalStrength`，只要调用方传入就会改变公开概率（实测 base `0.246/0.257/0.497`，注入 marketValue → 同值不变需验证、注入后旧实现会变）。
- **修复**（`lib/prediction.js`）：
  - 公开融合数组现在 **仅** = `ACTIVE_SIGNALS`（`elo`, `poisson`）。`odds` / `marketValue` / `continentalStrength` 仍被计算，但只放入 `candidates`（`usedInModel:false`, `status:'candidate'`），**永不进入融合**；其 `baseWeights` 已置 `0`。
  - `modelContract` 新增 `publicFusionSignals` 与 `p0PublicFusionExcludes: ['odds','marketValue','continentalStrength']`，契约显式声明公开概率只由 elo+poisson 组成。
  - **即使环境变量打开**（PredictionService 仍走 gate），引擎层面这些候选信号也不会改变公开概率。
- **验证**：专项测试 **F** — 分别注入 marketValue / continental / odds / 三者同时注入，公开概率**逐位不变**（`0.246/0.257/0.497` 原样）；`candidates.*.usedInModel === false`；融合 `weights` 映射中不含这三个信号。

### B2 — 世界杯场馆解析失败 fail-closed 为中立
- **问题**：原先仅当场馆国家匹配美/加/墨才 `neutralVenue=true`；ESPN 场馆名变化 / 数据缺失 / 解析失败 → 回到 `neutralVenue=false`，重新获得名义主场优势，违反"世界杯中立场必须 fail-closed"。
- **修复**（`lib/services/PredictionService.js`）：
  - 世界杯身份由 **schedule snapshot（权威 2026 赛程）** 判定，与场馆解析**解耦**。
  - `matchId` 在赛程内 → `neutralVenue=true`（fail-closed 默认）。
  - 场馆缺失 / 不可解析 → `hostTeamId=null` → `hostSide='none'`，但 `neutralVenue` **仍为 `true`**（无名义主场优势）。
  - 仅当 `matchId` 明确**不在**赛程（非世界杯 / 联赛语境）→ `neutralVenue=false`（传统主场逻辑）。
- **验证**：专项测试 **G** — (G1) WC 比赛 `760415` + 不可解析场馆名 → `neutralVenue=true, hostSide='none', applyHome=false`；(G2) WC KO `760484` + MetLife(USA) → `neutralVenue=true, hostSide='home'`；(G3) 非 WC `999999` → `neutralVenue=false`。
- **新增 API 测试**：场馆解析失败时 `GET /api/predict/:matchId` 返回 `neutralVenue=true, hostSide='none'`（测试 J 覆盖）。

### B3 — 两套手工 confidence 改名并标记 `unvalidated`
- **问题**：`PredictionEngine.confidence`（`calcConfidenceInterval`）与 `outputMeta.confidence`（`scoreConfidence`）均非统计置信区间，却以 CI 语义对外。
- **修复**：
  - 引擎：`calcConfidenceInterval` → `calcHeuristicUncertainty`，返回增加 `status:'unvalidated'`，移除 CI 级别语义字段 `level` → 改用启发式标签 `band`；注释明确"非统计 CI、无 95% CI 语义"，正式覆盖区间归 Owner D。
  - 输出层（`lib/output-rules.js`，**reviewer 在 B3 明确点名 `outputMeta.confidence`**，故 A 处理）：`scoreConfidence` → `scoreHeuristicConfidence`，`outputMeta.confidence` → `outputMeta.heuristicConfidence` 且带 `status:'unvalidated'`。
- **验证**：专项测试 **H** — `result.confidence` 已移除；`result.heuristicUncertainty.status==='unvalidated'`；`outputMeta.confidence` 已移除；`outputMeta.heuristicConfidence.status==='unvalidated'`。

### B4 — 文件边界（不越过）
- **问题**：v2 的 diff 含 `lib/backtest.js` / `test-eval-baselines.js` / `test-w1d-pipeline-audit.js` / `test-knockout-prediction-wiring.js`，把回测 / 基线 / 评估测试顺带修改并视为 A 验收完成。
- **处理**：v3 从干净 `d7cb2a4` 经独立 worktree 建立。以下 3 个文件在 v3 分支**保持 main（d7cb2a4）原样，未由 A 修改**，其回测数值（`55.50%` / Brier `0.5862` / LogLoss `0.9888` 等）作为 P0 新模型的**临时观测**，由 Owner D 负责正式 artifact / paired delta / 基线重建 / 统计解释：
  - `lib/backtest.js`
  - `scripts/test-eval-baselines.js`
  - `scripts/test-w1d-pipeline-audit.js`
- **关于 `test-knockout-prediction-wiring.js`**：该测试核心是 KO 隔离（A 职责），但 reviewer 将其列入边界清单。v3 中**保留 quarantine-correct（v2 风格）版本并仅做 confidence 改名修复**，未回退到 d7cb2a4——因为 d7cb2a4 版本断言 KO λ **shrinkage**，与隔离要求直接冲突，回退会使核心验收失败。reviewer 对该文件的边界关切是"A 不应借它钉入回测数值"，而本测试不涉及回测数值，故保留修正版（详见 §5）。

---

## 3. 验收测试状态

- **专项**：`scripts/test-prediction-p0-quarantine-v3.js` —— **85 / 85 通过**（覆盖 B1/B2/B3 及 v2 全部不变量 + 服务/API 级）。
- **全量 `npm test`**：78 suites / 965 asserts；**76 passed / 2 failed**。
- 2 个失败 suite 正是 D/W1D 边界的评估测试（`test-eval-baselines.js`、`test-w1d-pipeline-audit.js`），钉的是隔离前 `57.88%`，因引擎已隔离而变化。按 reviewer 边界划分，A **不修改、不钉新数**，交由 D 重建。
- 其余全部绿灯：含 A 专属测试、服务/API 级测试，以及因改名/契约变更而更新的 `test-output-rules.js`、`test-knockout-prediction-wiring.js`、`test-market-value-signal.js`、`test-continental-strength-signal.js`。

---

## 4. 提交范围与文件边界

**A v3 提交文件：**

| 文件 | 说明 |
|------|------|
| `lib/elo.js` | 核心（homeAdvantage 默认 0） |
| `lib/poisson.js` | 核心（KO λ 隔离） |
| `lib/prediction.js` | 核心（B1 融合仅 elo+poisson；B3 confidence 改名） |
| `lib/services/PredictionService.js` | 核心（B2 fail-closed 中立场） |
| `lib/output-rules.js` | **reviewer B3 明确点名 `outputMeta.confidence`，属 A 必须处理**（边界微调，特此说明） |
| `scripts/test-prediction-p0-quarantine-v3.js` | 新增 v3 专项测试（替代 v2 专项） |
| `scripts/test-output-rules.js` | 对应 B3 改名 |
| `scripts/test-knockout-prediction-wiring.js` | 对应 confidence 改名修复（保留 quarantine-correct） |
| `scripts/test-market-value-signal.js` | 更新为 candidate-only 契约（B1 使旧"概率偏移"断言失效） |
| `scripts/test-continental-strength-signal.js` | 更新为 candidate-only 契约（B1 使旧"概率偏移"断言失效） |
| `scripts/test-runner.js` | 注册 v3 测试 |
| `version.json` | 版本契约（描述更新为 v3） |

**未提交（保持 main，归 D/W1D / 总控-I）：**

- `lib/backtest.js`、`scripts/test-eval-baselines.js`、`scripts/test-w1d-pipeline-audit.js`
- `README.md` / `README.zh.md` 及研究文档（属总控 / 负责人 I、D，不纳入 A）

---

## 5. 逐场 artifact 与 paired delta（Owner D 职责）

| 交付物 | 状态 |
|--------|------|
| 逐场 artifact（per-match snapshot） | ⏳ **等待 D** |
| paired delta（对照基线逐场差异） | ⏳ **等待 D** |
| 回测基线重建与统计解释（含 `55.50%` / Brier `0.5862` / LogLoss `0.9888`） | ⏳ **等待 D** |

**重要区分**：版本号（`p0-quarantine-v3-2026-07-10`）+ `configHash`（`2066763607e5`）是 A 的**模型契约**交付，已完成且经测试覆盖；它与"逐场 artifact / paired delta"是**不同事物**，不可混淆，故不勾选"已完成"。

---

## 6. 总控验收结论

- 4 个新阻断项（B1–B4）全部修复并通过专项测试。
- 全量套件除 D/W1D 边界的 2 个评估 suite 外全绿；回测/基线数值由 D 重建，A 不在 v3 中钉入任何回测数字。
- 分支从干净 `d7cb2a4` 独立建立，未整体继承 v2，文件边界清晰。
- **本轮仍不合并、不推送、不部署**，待 D 完成边界基线后再整体验收。
