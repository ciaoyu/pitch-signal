# Owner H — as-of 防泄漏证明（leakage guard）

> 验收重点之一。所有教练增值估计必须证明「训练时无法看见未来」。

## 1. 时间滚动 OOS（walk-forward）设计

```
for each test window W_t (e.g. 1 year or 1 tournament):
    train on matches with date < min(W_t)   # strict as-of cutoff
    fit coach_effect (hierarchical shrinkage) on train only
    evaluate on W_t: LogLoss / Brier / calibration / delta vs base (no coach)
    never use W_t's coach tenures' future end-states to inform train
```

- **cutoff 严格早于测试窗**：教练任期的 `end_date`、球员质量、xG 在训练时只能取到 cutoff 之前。
- **2026 世界杯不进入任何训练或测试**：`date >= 2026-06-11` 的比赛全部排除；2026 仅作**前瞻账本**（shadow）展示，不作拟合证据。

## 2. 逐变量 as-of 契约

| 变量 | as-of 规则 |
|------|-----------|
| `coach.start_date / end_date` | 仅用 cutoff 前已开始的任期；cutoff 后才上任的教练对该窗不可见 |
| `playerQuality` | 用 cutoff 前的滚动窗口（如近 12 月）估计，禁止用整段生涯 |
| `Elo` | 仓库 Elo 在 cutoff 的时点值（非最终值） |
| `xg_diff` | 仅用 cutoff 前已结束比赛的 xG |
| `venue / rest` | 比赛已知属性，无泄漏 |
| `tactics_obs` | 仅用 cutoff 前该任期的可观测行为 |

## 3. 世界杯 held-out

- 世界杯（尤其 2026）作为**分布外（OOS）**评测，不参与系数估计。
- 历史世界杯（1930–2022）可作**时间滚动**中的测试窗（其数据在 cutoff 前已发生），但**不能**用 2026 做拟合。
- 若用历史 WC 做测试，需在报告标注「该窗教练任期在当时已知」，避免用赛后披露信息。

## 4. 选择偏差泄漏防护

- 换帅触发常源于低谷；若把「低谷后反弹」算作教练能力，即**前视泄漏**（用未来状态解释过去残差）。
- 处理：任期起始状态协变量（上任前 N 场 xg_diff 滑动均值）必须**也用 as-of cutoff 计算**，且教练效应估计在「剥离起始状态」后进行。

## 5. 缺失 ≠ 中性

- 档案缺失的任期（pre-2000 小国）标记为 `missing_reason`，**退化为无效应基准**，不假装「无教练 = 平均教练」。
- 缺失机制只有在 OOS 证明有信息时才可作特征（治理原则）。

## 6. 验证清单（提交前自检）

- [ ] 每个训练窗的 cutoff 严格早于测试窗
- [ ] 2026 比赛无任何窗的训练/测试出现
- [ ] 教练任期 end_date 不影响 cutoff 前拟合
- [ ] playerQuality / Elo / xG 均为 as-of 时点值
- [ ] 报告含「训练/测试窗时间轴」图或表
