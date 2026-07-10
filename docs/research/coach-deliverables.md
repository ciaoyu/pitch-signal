# Owner H — 交付清单（reviewer 6 项）

> 镜像治理要求：每人交付 — 数据来源与许可、覆盖率、as-of 防泄漏证明、失败和缺失说明、OOS 结果、是否允许进入模型的结论。

| # | 交付物 | 状态 | 产物 |
|---|--------|------|------|
| 1 | 数据来源与许可 | ✅ | `data/research/coach/manifest.json` + `coach-data-dictionary.md`（仓库内 CC0/项目源 + 外部池标只读；`coaches.json` 中文关键词明确禁用） |
| 2 | 覆盖率 | ✅ 真实产出 | `scripts/research-coach-coverage.js` → `coverage-report.json`。**结论：in-repo 研究级任期覆盖率 0%**（display 级 `coaches.json` 无起止日/来源/任期链/场次级链接/xG）；WC 历史 22 届 964 场无教练字段；team_meta 无教练字段 |
| 3 | as-of 防泄漏证明 | ✅ | `coach-leakage-guard.md`（时间滚动 OOS、严格 cutoff、2026 不拟合、逐变量 as-of 契约、选择偏差防护） |
| 4 | 失败/缺失说明 | ✅ | `coach-data-dictionary.md` §4 缺失机制：结构缺失(pre-2000 任期)、早期 xG 代理、战术可观测量待 F/G、弱队稀疏；缺失 ≠ 中性，退化为无效应基准 |
| 5 | OOS 结果 | ⏳ 待外部池 | `scripts/research-coach-oos.js`：walk-forward + 分层收缩 + xG 残差 + 后验候选分布。**缺数据时显式 BLOCKED，不伪造系数** |
| 6 | 是否入模结论 | ✅ 边界结论 | **当前不允许进入生产概率**（稳定系数需外部任期池 + 国际赛果池 + xG，并经 OOS 正增量证明），详见下方 |

## 验收重点逐项回应

- **任职记录覆盖率**：`coverage-report.json` 真实审计。当前 in-repo 0% 研究级；需外部只读任期史。
- **as-of 防泄漏**：`coach-leakage-guard.md` 逐变量契约 + 2026 排除 + 选择偏差防护。
- **球员与教练效应共线性**：`coach-dag.md` §3.1 — 先扣球员质量基准，报告 VIF；Ridge 先验。
- **后验分布**：OOS 设计含 per-coach 后验/采样分布（待数据实跑）。
- **OOS 增益**：LogLoss/Brier/校准/delta vs base（待数据实跑）。
- **失败/缺失说明**：见 §4 与 coverage 报告。

## 入模门槛（governance）

教练效应仅当满足全部条件才允许从 `usedInModel:false` 转候选进入：
1. 滚动 OOS 在 LogLoss/Brier/校准显示**稳定正 delta**；
2. **跨届稳定**（不只单赛事显著）；
3. 短任期后验区间**不退化**（分层收缩保护）；
4. 与球员质量共线性已诊断且系数稳定。

否则保持 `usedInModel:false`，仅作展示 / shadow。

## 文件边界（已遵守）

- 仅新建 `docs/research/coach-*`、`data/research/coach/*`、`scripts/research-coach-*`。
- **未修改** `lib/prediction.js` / 公开 API；生产教练信号保持移除（展示隔离）。
- F/G artifact 仅只读引用；未合入其分支。

## 当前生产教练信号状态

- `lib/prediction.js` 中 coach 引用 = 0（Owner A 隔离生效）。
- `data/coaches.json` 仅作 UI 展示；其 `style/adjustment/flexibility/notes` 中文关键词**禁止**作特征，H 不恢复该模型。
