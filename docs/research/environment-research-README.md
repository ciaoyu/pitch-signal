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
  manifest.json                        # 数据源 manifest（许可/覆盖率）
  coverage-report.json                 # 覆盖审计产出（脚本生成）
  oos-report.json                      # OOS 产出（脚本生成；当前 BLOCKED）
scripts/research-environment-*.js      # 审计 / OOS 脚本（纯 Node，无依赖）
```

## 运行

```bash
# 覆盖审计（无需外部数据，基于仓库现有数据产出真实报告）
node scripts/research-environment-coverage.js

# OOS 系数估计（需外部 49k 池，只读输入）
ENV_RESEARCH_POOL_DIR=/path/to/international-results node scripts/research-environment-oos.js
```

## 当前状态

- DAG、数据字典、来源/许可、泄漏审计、覆盖审计（首版真实产出）、缺失/失败说明：**已完成**。
- OOS 系数分布：**待外部 49k 池**；脚本已就绪但**不伪造系数**，缺数据时显式 BLOCKED。
- 入模结论：**当前不允许进入生产概率**（见 `environment-deliverables.md` 第 6 项）。

## 不推送 / 不部署

本工作区为 Owner E 研究隔离区，按治理流程由总控在 D 边界基线完成后统一验收与合并；当前**不合并、不推送、不部署**。
