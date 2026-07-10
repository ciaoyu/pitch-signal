# Owner E — 交付清单（reviewer 统一要求：每人必须交付）

> 分支：`codex/environment-research`（基线 `78da1b5`）。本清单逐项映射 reviewe 要求的 6 项交付物，并标注状态。
> 文件边界：仅 `docs/research/environment-*`、`data/research/environment-*`、`scripts/research-environment-*`。**不修改 `lib/prediction.js` 或公开 API**。

| # | 要求交付物 | 状态 | 对应文件 |
|---|-----------|------|----------|
| 1 | 数据来源与许可 | ✅ 完成 | `environment-data-dictionary.md`、`data/research/environment/manifest.json` |
| 2 | 覆盖率 | ✅ **真实产出（数据采集阶段）** | `research-environment-pool-adapter.js` → `pool-coverage.json`；`research-environment-coverage.js` → `coverage-report.json`。真实 49k 池：非 WC 48,441 场，休息 99.7%/99.6%、neutral 100%、跨洲 97.3%、2026 海拔 100%；历史海拔 0%、天气 0%（诚实缺失）。 |
| 3 | as-of 防泄漏证明 | ✅ 完成（设计层） | `environment-leakage-guard.md` |
| 4 | 失败和缺失说明 | ✅ 完成 | `environment-data-dictionary.md` §4/§2b、`coverage-report.json.conclusion`、`pool-coverage.json.missingReasons` |
| 5 | OOS 结果 | ⏳ **待估算（数据已就绪）** | `scripts/research-environment-oos.js` → `oos-report.json`。WC held-out 1,064 场已生成（`wc-heldout-manifest.json`）；下一步跑 Ridge/层级贝叶斯 + VIF + 后验 + walk-forward 增益；未通过不伪造、不入模。 |
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

## 数据采集阶段（本轮）交付说明

按总控"数据采集与真实证据积累阶段"要求，E 本轮完成：
- **修正历史数据解析**：`data/history/worldcup_*.json` 确为 `{matches:[...]}` 对象（已正确读取，22 届 / 964 场）。
- **接入 49k 国际赛结果只读适配器**：`research-environment-pool-lib.js` + `research-environment-pool-adapter.js`，真实采集 CC0 池（SHA-256 `5ddddc5a…`），解析 + 环境字段 join（休息 / 旅行跨洲 / 2026 海拔），WC 1,064 场 held-out。
- **场馆 / 天气 / 旅行 / 休息字段覆盖审计**：真实产出见 `pool-coverage.json` / `coverage-report.json`（上表第 2 项）。
- 仍**不改生产**（`lib/` 相对 `78da1b5` 零 diff）。

边界遵守：E 未停在"只拿到 49k 赛果"——已做环境字段 join；历史海拔与天气为结构缺失（诚实 0%，不伪造）；单元测试用合成数据且明确"仅测逻辑、不进 artifact"。

## 后续步骤（解锁 OOS 第 5 项）

1. ~~取得外部 49k 国际比赛池本地副本~~ → **已完成**（只读，`ENV_RESEARCH_POOL_DIR`）。
2. 在池上做赛前 env 特征工程（球队近期比赛级暴露代理 → 球员分钟级）。
3. 跑 `research-environment-oos.js`：WC held-out、Ridge/层级贝叶斯、bootstrap 系数分布、共线性 VIF、walk-forward 增益。
4. 据 OOS 分布更新第 6 项结论（入模 / 仅展示 / 排除）；未通过 OOS 不进入生产概率。
