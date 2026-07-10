# Owner E — 环境 / 旅行 / 休息 研究（worktree 说明）

> 分支：`codex/environment-research`（从干净基线 `78da1b5` 建立，独立 worktree）
> 职责：**只做数据、DAG、覆盖率、OOS 系数**；**不修改生产概率**（`lib/prediction.js` / 公开 API 一律不动）。
> 治理：统一从 `78da1b5` 建立；**不整体带入 D 的研究代码或其他负责人分支**；D 的 artifact 仅作只读输入。

## 文件边界（硬性）

| 允许 | 禁止 |
|------|------|
| `docs/research/environment-*` | 修改 `lib/prediction.js` |
| `data/research/environment-*` | 修改任何公开 API / 路由 |
| `scripts/research-environment-*` | 把 D 的研究代码并入本分支 |
| `data/research/environment/manifest.json`（数据 manifest） | 提交外部 49k 池原始数据 |

## 目录

```
docs/research/
  environment-dag.md                   # DAG：海拔/WBGT/草坪/旅行/时区/休息/加时 因果与共线
  environment-data-dictionary.md       # 数据字典 + 来源/许可 + 缺失机制
  environment-leakage-guard.md         # as-of 防泄漏证明（WC held-out / 训练窗内验证）
  environment-deliverables.md          # 6 项交付物清单与状态
data/research/environment/
  manifest.json                        # 数据源 manifest（许可/覆盖率/sha256）
  coverage-report.json                 # 覆盖审计产出（脚本生成，含真实 49k 池）
  pool-coverage.json                   # 49k 池特征覆盖（脚本生成）
  wc-heldout-manifest.json             # 世界杯 held-out 数据集（脚本生成）
  oos-report.json                      # OOS 产出（脚本生成；真实估计）
  oos-joined-contract.json             # 真实 joined dataset 输入契约（schema）
scripts/research-environment-*.js      # 审计 / OOS 脚本（纯 Node，无依赖）
scripts/research-environment-pool-lib.js        # 49k 只读适配器核心（解析+join+as-of）
scripts/research-environment-pool-adapter.js    # 适配器 CLI：生成 pool-coverage + wc-heldout
scripts/research-environment-oos.js             # OOS 系数估计（Ridge Poisson + VIF + bootstrap + walk-forward）
scripts/test-research-environment-pool-lib.js   # 单元测试（合成数据，仅验证逻辑）
scripts/test-research-environment-oos-lib.js    # OOS 助手单元测试（合成数据，仅验证逻辑）
```

## 运行

```bash
# 1) 取得真实 CC0 池（仓库外只读副本，绝不提交）
#    martj42/international_results -> results.csv
#    mkdir -p /path/to/international-results && curl -L <raw> -o /path/to/international-results/results.csv

# 2) 49k 只读适配器：join 环境字段 + 生成 WC held-out
export ENV_RESEARCH_POOL_DIR=/path/to/international-results
node scripts/research-environment-pool-adapter.js

# 3) 覆盖审计（仓库数据 + 真实 49k 池，产出 coverage-report.json）
node scripts/research-environment-coverage.js

# 4) 单元测试（合成数据，验证 join 逻辑；不进入 research artifact）
node scripts/test-research-environment-pool-lib.js

# 5) OOS 系数估计（真实跑；WC held-out + Ridge/层级贝叶斯 + VIF + 后验 + walk-forward）
ENV_RESEARCH_POOL_DIR=/path/to/international-results node scripts/research-environment-oos.js

# 6) OOS 助手单元测试（合成数据，验证 IRLS/概率/对称/VIF；不进入 research artifact）
node scripts/test-research-environment-oos-lib.js
```

## 当前状态（数据采集阶段 ✅ + OOS 系数估计阶段 ✅）

- DAG、数据字典、来源/许可、泄漏审计、缺失/失败说明：**已完成**。
- **真实 49k 池已采集并 join**：48,441 场非 WC 估计池 + 1,064 场 WC held-out（1930–2026）；
  休息 99.7%/99.6%、neutral 100%、跨洲 97.3%、2026 海拔 join 100%；历史海拔 0%、天气/WBGT 0%（诚实缺失）。
  SHA-256 `5ddddc5a…`，见 `pool-coverage.json` / `coverage-report.json`。
- 单元测试通过（`test-research-environment-pool-lib.js` + `test-research-environment-oos-lib.js`，合成数据）；`lib/` 相对 `78da1b5` 零 diff（生产概率未动）。
- **OOS 系数估计已真实运行**（v2，2026-07-11，CC0 池 SHA-256 `5ddddc5a…`）：
  - 估计 `rest_diff` ≈ −3e-5（可忽略）、`cross` ≈ −0.050（跨洲约 −5% 进球，方向合理）、`cross_unknown` ≈ +0.39（联盟解析缺失产物，非环境暴露）。
  - VIF = 1.00（eloDiff 1.002、restDiff 1.002、cross 1.005、crossUnknown 1.005；辅助回归含截距 → VIF≥1 恒成立）；WC held-out 1930–2022 `ΔLogLoss(env−base) = −0.00089`；**cluster bootstrap 95% CI = [−0.00197, +0.00012]（seed 固定、按届次有放回重采样，可复现）含 0** → 无稳定增益。
  - **`cross` 与 `cross_unknown` 分离重跑**：去掉 `cross_unknown` 标志后 `cross` 系数仍 ≈ −0.063，证明跨洲旅行代理并非联盟解析缺失产物。
  - **口径澄清**：`base` 是研究用 Elo+Poisson 代理，**非生产 Owner A v4**。
  - **裁决：env 系数保持 shadow / `usedInModel:false`，不进入生产概率**（治理口径：符号稳定 ≠ 真实增益）。
  - `altitude_2026` / `wbgt` / `neutral` 训练覆盖不足，均不拟合、`usedInModel:false`。
- 入模结论：**当前不允许进入生产概率**（见 `environment-deliverables.md` 第 6 项）。
- **E v2 统计实现修正（2026-07-11，已定稿）**：cluster bootstrap 改为按届次有放回重采样并固定 seed（`seed=20260711`，可复现，已加重跑一致性断言）；系数 bootstrap 同 seed；VIF 加截距修复（v1 出现 VIF<1）；cross/cross_unknown 分离重跑；明确基准非生产 A v4。统计实现已定稿且可复现。方向性结论与生产裁决不变：**环境信号继续 shadow，绝不进入公开概率**。

## 不推送 / 不部署

本工作区为 Owner E 研究隔离区，按治理流程由总控在 D 边界基线完成后统一验收与合并；当前**不合并、不推送、不部署**。
