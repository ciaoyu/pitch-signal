# Owner E — 环境 / 旅行 / 休息 研究：as-of 防泄漏证明

> 验收要求（每人必须交付）：as-of 防泄漏证明。
> 分支：`codex/environment-research`（基线 `78da1b5`）。

## 1. 三类泄漏风险与防护

| 风险 | 说明 | 防护（本工作区强制） |
|------|------|----------------------|
| **赛后 → 赛前回填** | 用赛后结果/复盘教训回填同场赛前预测 | 所有 env 变量只用赛前可得事实（赛程、场馆、baseCamp）。`ET`（上一场加时）只引用**已完赛的上一场**结果，绝不引用本场赛后。 |
| **世界杯进入训练** | 用世界杯本身估计环境系数，再在世界上报"OOS" | 世界杯保持 **held-out**：环境系数只在更大的国际比赛池（49k，只读）估计，世界杯仅作测试集。 |
| **2026 当作未见测试** | 2026 结果已看了一部分，仍宣称整届为未见测试 | 2026 剩余比赛从本版本上线时起形成真正 prospective 测试；历史模型冻结，不反复调参后宣称锁定。 |

## 2. as-of 时间契约（变量级）

每个 env 特征必须有明确的 `as-of` 时间点 = 本场开赛前（kickoff）。

- `alt / turf / tz`：来自场馆静态属性（kickoff 前已知）→ as-of = kickoff，安全。
- `travel`：来自 baseCamp→场馆距离，kickoff 前已知 → 安全。
- `rest`：来自赛程两场间隔，**只用已确定/已完赛的前序比赛日期**，不含本场赛后。
- `et`：来自**上一场已完赛**的加时分钟；若上一场尚未开赛则 `missing`（标记 `missing_reason`），绝不回填。
- `wbgt`：来自赛前气候/预报，kickoff 前已知 → 安全；赛后实测值禁止回填。

## 3. 训练/测试划分（滚动，参考方法学笔记 §8）

```
train ≤ 2010  -> test 2014
train ≤ 2014  -> test 2018
train ≤ 2018  -> test 2022
历史模型冻结 -> 2026 只作 prospective / 回放区分
```

- 环境超参数（正则强度、交互项选择）在**训练窗内部**验证；测试届不参与选择。
- 世界杯各届在对应滚动划分中**始终位于测试侧**（held-out），不进入系数估计。

## 4. 可复算性 / 审计

- 覆盖审计脚本 `scripts/research-environment-coverage.js` 与 OOS 脚本 `scripts/research-environment-oos.js` 为纯 Node、无外部依赖，同 seed/同输入可复算。
- 所有 artifact 附：数据来源与许可、命令、输入 hash、失败说明（见 `environment-deliverables.md`）。
- 外部 49k 池仅只读输入，其路径由 `ENV_RESEARCH_POOL_DIR` 指定，不写入本分支。

## 5. 结论

在本工作区当前数据状态下，世界杯 held-out 与 as-of 契约在**设计层面**已满足；正式 OOS 泄漏审计需在引入外部 49k 池后由 `research-environment-oos.js` 实跑并附逐场 as-of 校验。数据不足时，环境模块维持 `usedInModel:false`（展示 + shadow），不进入公开概率。
