# Owner E — 交付清单（reviewer 统一要求：每人必须交付）

> 分支：`codex/environment-research`（基线 `78da1b5`）。本清单逐项映射 reviewe 要求的 6 项交付物，并标注状态。
> 文件边界：仅 `docs/research/environment-*`、`data/research/environment-*`、`scripts/research-environment-*`。**不修改 `lib/prediction.js` 或公开 API**。

| # | 要求交付物 | 状态 | 对应文件 |
|---|-----------|------|----------|
| 1 | 数据来源与许可 | ✅ 完成 | `environment-data-dictionary.md`、`data/research/environment/manifest.json` |
| 2 | 覆盖率 | ✅ 完成（首版，基于仓库现有数据） | `scripts/research-environment-coverage.js` → `coverage-report.json` |
| 3 | as-of 防泄漏证明 | ✅ 完成（设计层） | `environment-leakage-guard.md` |
| 4 | 失败和缺失说明 | ✅ 完成 | `environment-data-dictionary.md` §4、`coverage-report.json.conclusion` |
| 5 | OOS 结果 | ⏳ 待外部 49k 池（只读输入） | `scripts/research-environment-oos.js` → `oos-report.json`（当前 BLOCKED，未伪造系数） |
| 6 | 是否允许进入模型的结论 | ✅ 给出边界结论 | 见下 + `coverage-report.json.conclusion` / `oos-report.json.conclusion` |

## 第 6 项：是否允许进入模型的结论（当前）

**结论：当前阶段环境模块不得进入生产概率。**

依据：
- 仓库内仅有 2026 场馆级环境（海拔/草坪/时区），历史届赛果**完全没有**环境暴露字段 → 无法稳定估计系数（方法学笔记 §3.3：964 场世界杯不足以稳定估计海拔/热湿/草坪/旅行/休息及交互）。
- 稳定环境系数需更大的国际比赛池（49k，只读），世界杯保持 held-out；该池当前不在仓库内，OOS 尚未实跑。
- 即使第一阶段可用球队级代理，也**只经 OOS 证明增益后才允许入模**；否则维持 `usedInModel:false`（展示 + shadow）。

## 验收口径提示（master plan §E）

- 数据不足**也算完成**，但必须给出可展示事实与"不能入模"的边界 —— 本清单已满足。
- 提交物须含：DAG、数据字典、来源/许可、泄漏审计、球队级代理 vs 球员级目标方案、强正则化/贝叶斯层级候选 + 共线性诊断、候选系数 OOS 分布（非生产常数）。
- 全部 artifact 附数据许可、命令、hash、失败说明（本工作区脚本均为纯 Node、可复算）。

## 后续步骤（解锁 OOS 第 5 项）

1. 取得外部 49k 国际比赛池本地副本，设置 `ENV_RESEARCH_POOL_DIR`（只读）。
2. 在池上做赛前 env 特征工程（球队近期比赛级暴露代理 → 球员分钟级）。
3. 跑 `research-environment-oos.js`：held-out 世界杯、Ridge/层级贝叶斯、bootstrap 系数分布、共线性 VIF。
4. 据 OOS 分布更新第 6 项结论（入模 / 仅展示 / 排除）。
