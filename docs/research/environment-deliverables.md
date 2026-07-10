# Owner E — 交付清单（reviewer 统一要求：每人必须交付）

> 分支：`codex/environment-research`（基线 `78da1b5`）。本清单逐项映射 reviewe 要求的 6 项交付物，并标注状态。
> 文件边界：仅 `docs/research/environment-*`、`data/research/environment-*`、`scripts/research-environment-*`。**不修改 `lib/prediction.js` 或公开 API**。

| # | 要求交付物 | 状态 | 对应文件 |
|---|-----------|------|----------|
| 1 | 数据来源与许可 | ✅ 完成 | `environment-data-dictionary.md`、`data/research/environment/manifest.json` |
| 2 | 覆盖率 | ✅ **真实产出（数据采集阶段）** | `research-environment-pool-adapter.js` → `pool-coverage.json`；`research-environment-coverage.js` → `coverage-report.json`。真实 49k 池：非 WC 48,441 场，休息 99.7%/99.6%、neutral 100%、跨洲 97.3%、2026 海拔 100%；历史海拔 0%、天气 0%（诚实缺失）。 |
| 3 | as-of 防泄漏证明 | ✅ 完成（设计层） | `environment-leakage-guard.md` |
| 4 | 失败和缺失说明 | ✅ 完成 | `environment-data-dictionary.md` §4/§2b、`coverage-report.json.conclusion`、`pool-coverage.json.missingReasons` |
| 5 | OOS 结果 | ✅ **真实产出（OOS 系数估计阶段）** | `research-environment-oos.js` → `oos-report.json` + `oos-joined-contract.json`。真实 CC0 池 48,441 场非 WC 估计、WC held-out 964 场（1930–2022）评估；Ridge/层级收缩 Poisson + VIF + 系数 bootstrap + walk-forward + cluster bootstrap Δ；**结论：无稳定 OOS 增益，env 系数保持 shadow（未入模）**。 |
| 6 | 是否允许进入模型的结论 | ✅ 给出边界结论 | 见下 + `coverage-report.json.conclusion` / `oos-report.json.conclusion` |

## 第 6 项：是否允许进入模型的结论（当前）

**结论：当前阶段环境模块不得进入生产概率（OOS 未通过稳定增益）。**

依据（OOS 真实估计，2026-07-10 实跑，CC0 池 SHA-256 `5ddddc5a…`）：
- 估计变量（训练期真实覆盖）：`rest_diff`（休息 99.7/99.6%）、`cross` / `cross_unknown`（跨洲旅行代理 97.3%）。
  - `rest_diff` 系数 ≈ **-3e-5**（CI[-6e-5, 0]），双方在国际比赛窗口休息相近，对手休息差几乎无信号。
  - `cross` 系数 ≈ **-0.050**（CI[-0.065, -0.032]，符号稳定）：跨洲比赛双方进球强度约低 5%（对称旅行/气候压力），方向合理。
  - `cross_unknown` ≈ +0.39：是**联盟解析缺失的产物**（从未参加洲际特定赛事的球队的可用性代理），**非真实环境暴露**，不计入生产候选（缺失即特征归 Owner A）。
- OOS 增益判定：WC held-out（1930–2022，964 场）`ΔLogLoss(env−base) = -0.00089`；**cluster bootstrap 95% CI = [-0.00197, +0.00012]（seed 固定、按届次有放回重采样，可复现）含 0**；walk-forward 6 折 ΔLogLoss 在 0 附近振荡（-0.0007 ~ +0.0028）。
- 治理口径（总控）：**符号稳定 ≠ 真实增益**；OOS 无稳定增益前不得进入生产概率 → `enterModel=false`，env 系数保持 shadow / `usedInModel:false`。
- VIF = 1.00（eloDiff 1.002、restDiff 1.002、cross 1.005、crossUnknown 1.005，辅助回归含截距 → VIF≥1 恒成立）；无共线性问题；模型本身健康，只是增量信息不足以超越 Elo+Poisson 基准。
- **口径澄清**：`base` 是研究用 Elo+Poisson 代理，**非生产 Owner A v4**，本 OOS 仅对比研究基准。

> 边界重申：E 的 `altitude_2026` 历史训练覆盖为 0%（仅 2026 held-out 有），`wbgt/weather` 历史覆盖 0%，`neutral` 100% 无有效变异 → **均不拟合、均 `usedInModel:false`**。绝不因 2026 海拔 100% join 就拟合海拔系数（会泄漏 held-out）。

## 验收口径提示（master plan §E）

- 数据不足**也算完成**，但必须给出可展示事实与"不能入模"的边界 —— 本清单已满足。
- 提交物须含：DAG、数据字典、来源/许可、泄漏审计、球队级代理 vs 球员级目标方案、强正则化/贝叶斯层级候选 + 共线性诊断、候选系数 OOS 分布（非生产常数）。
- 全部 artifact 附数据许可、命令、hash、失败说明（本工作区脚本均为纯 Node、可复算）。

## 数据采集阶段（本轮）交付说明

按总控"数据采集与真实证据积累阶段"要求，E 本轮完成：
- **修正历史数据解析**：`data/history/worldcup_*.json` 确为 `{matches:[...]}` 对象（已正确读取，22 届 / 964 场）。
- **接入 49k 国际赛结果只读适配器**：`research-environment-pool-lib.js` + `research-environment-pool-adapter.js`，真实采集 CC0 池（SHA-256 `5ddddc5a…`），解析 + 环境字段 join（休息 / 旅行跨洲 / 2026 海拔），WC 1,064 场 held-out。
- **场馆 / 天气 / 旅行 / 休息字段覆盖审计**：真实产出见 `pool-coverage.json` / `coverage-report.json`（上表第 2 项）。
- 仍**不改生产**（`lib/` 相对 `78da1b5` 零 diff）。

边界遵守：E 未停在"只拿到 49k 赛果"——已做环境字段 join；历史海拔与天气为结构缺失（诚实 0%，不伪造）；单元测试用合成数据且明确"仅测逻辑、不进 artifact"。

## OOS 系数估计阶段（本轮）交付说明

按总控"立即进入 OOS 系数估计阶段"要求，E 完成真实 OOS：
- **真实 joined dataset 输入契约**：`research-environment-oos.js` 实时从只读池重建 joined 行（含 as-of rest / confed / cross），并写出 `oos-joined-contract.json`（schema 文档）。
- **先评估训练期真实覆盖的变量**：`rest_diff`（休息）、`cross`/`cross_unknown`（跨洲旅行代理）——均按对称 (A−B) 方式进入 Poisson 进球强度。
- **不估计**：`altitude_2026`（历史训练覆盖 0%）、`wbgt/weather`（0%）、`neutral`（100% 无变异）——均 `usedInModel:false`，不泄漏 held-out。
- **方法**：Elo 作为 as-of 控制（仅非 WC 比赛更新 → 无 WC 泄漏）；Poisson + Ridge（IRLS + 步长折半保证收敛）；与 Elo+Poisson 基准比 LogLoss/Brier/ECE；WC held-out（1930–2022 已发生评估，2026 已发生作前瞻、未完赛排除）单独打分；系数 bootstrap + VIF + walk-forward + cluster bootstrap Δ。
- **结论**：无稳定 OOS 增益（ΔLogLoss CI 含 0）→ env 系数保持 shadow，**不进入生产概率**。
- **E v2 统计实现修正（2026-07-11）**：cluster bootstrap 改为按世界杯届次有放回重采样并固定 seed（`seed=20260711`，可复现）；系数 bootstrap 同 seed；VIF 辅助回归加截距修复（v1 出现 VIF<1 违反标准）；`cross` 与 `cross_unknown` 分离重跑；明确 `base` 是研究代理非生产 A v4。方向性结论与生产裁决不变（仍 `enterModel=false`）。
- `lib/` 相对 `78da1b5` 仍零 diff；49k 池仍在仓库外，未提交。

## 后续步骤

1. 当前 OOS 未给出稳定增益 → env 模块维持 `usedInModel:false`（展示 + shadow）。
2. 若未来取得历史海拔 / WBGT 表（训练覆盖 >0），可重新估计 `altitude`/`wbgt` 系数并重复本 OOS 流程；**只有在那时通过稳定增益才允许入模**。
3. `cross` 方向性效应（跨洲约 −5% 进球）值得持续监测，但增量增益不足，暂不入模。
4. 不参与合并/推送/部署；所有产出仅作论文引用的研究 artifact（D 的 `research-input-audit` 可直接消费 `manifest.json`）。
