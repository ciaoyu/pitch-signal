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
  oos-report.json                      # OOS 产出（脚本生成；待估算）
scripts/research-environment-*.js      # 审计 / OOS 脚本（纯 Node，无依赖）
scripts/research-environment-pool-lib.js        # 49k 只读适配器核心（解析+join+as-of）
scripts/research-environment-pool-adapter.js    # 适配器 CLI：生成 pool-coverage + wc-heldout
scripts/test-research-environment-pool-lib.js   # 单元测试（合成数据，仅验证逻辑）
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

# 5) OOS 系数估计（下一步；WC held-out + Ridge/层级贝叶斯 + VIF + 后验）
# ENV_RESEARCH_POOL_DIR=/path/to/international-results node scripts/research-environment-oos.js
```

## 当前状态（数据采集阶段）

- DAG、数据字典、来源/许可、泄漏审计、缺失/失败说明：**已完成**。
- **真实 49k 池已采集并 join**：48,441 场非 WC 估计池 + 1,064 场 WC held-out（1930–2026）；
  休息 99.7%/99.6%、neutral 100%、跨洲 97.3%、2026 海拔 join 100%；历史海拔 0%、天气/WBGT 0%（诚实缺失）。
  SHA-256 `5ddddc5a…`，见 `pool-coverage.json` / `coverage-report.json`。
- 单元测试通过；`lib/` 相对 `78da1b5` 零 diff（生产概率未动）。
- OOS 系数估计（真实 Ridge/层级贝叶斯 + VIF + 后验 + walk-forward 增益）：**下一步**，数据已就绪；未通过 OOS 不进入生产概率。
- 入模结论：**当前不允许进入生产概率**（见 `environment-deliverables.md` 第 6 项）。

## 不推送 / 不部署

本工作区为 Owner E 研究隔离区，按治理流程由总控在 D 边界基线完成后统一验收与合并；当前**不合并、不推送、不部署**。
