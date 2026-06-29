# Backtest 待解决清单

## 问题 1：样本量偏小

**现状：** 只有 2018 + 2022 两届世界杯数据，共 128 场比赛。统计显著性不足。

**方案：**
- [ ] 短期：加 Euro 2020、Copa America 2021、Euro 2024 等洲际赛事数据，扩充到 300-400 场（数据格式兼容，需标记来源）
- [ ] 中期：2026 世界杯结束后追加 104 场（48 队扩军），样本量翻倍
- [ ] 先做好置信区间（问题 2），让小样本的不确定性可见，比堆数据更紧急

**涉及文件：**
- 数据：`data/history/worldcup_2018.json`, `data/history/worldcup_2022.json`
- 加载：`lib/backtest.js` → `loadHistory()` (第 18 行)

---

## 问题 2：Brier Score / Log Loss 没有置信区间

**现状：** `_walkForward()` 只报均值，不报不确定性。128 场下 Brier 的 95% CI 宽度约 ±0.03-0.05，两个模型差 0.02 可能只是噪声，无法判断。

**方案：**
- [ ] 在 `lib/backtest.js` 中实现 Bootstrap 重采样（10000 次 resample，取 2.5% / 97.5% 分位数）
- [ ] 输出格式：`Brier: 0.421 [95% CI: 0.389, 0.454]`，LogLoss 和 Accuracy 同理
- [ ] 在 `compareBaseline()` 中加入 CI 重叠判断：重叠则差异不显著，不能作为改进依据
- [ ] 计算量 < 1 秒，零外部依赖

**涉及文件：**
- 核心：`lib/backtest.js` → `_walkForward()` (第 142-152 行，Brier/LogLoss 计算)
- 比较：`lib/backtest.js` → `compareBaseline()` (第 268-271 行，验收标准)

---

## 问题 3：AUTO_CALIBRATION 关闭后无参数调优路径

**现状：**
- `dailyCalibration.js` 只输出 `shadowRecommendations`，不实际应用
- 20+ 个参数硬编码，改一个就要手动跑 backtest 看效果
- 无自动化工具搜索参数空间

**方案：**
- [ ] 新建 `scripts/param-sweep.js`，用网格搜索扫描最高影响参数
- [ ] 第一优先级参数：

| 参数 | 文件 | 当前值 | 扫描范围 |
|---|---|---|---|
| Elo K-factor (世界杯) | `lib/elo.js:13` | 60 | [30, 40, 50, 60, 70, 80] |
| Dixon-Coles rho | `lib/poisson.js:104` | -0.13 | [-0.20, -0.15, -0.13, -0.10, -0.05] |
| Elo 权重 | `lib/prediction.js:21` | 0.30 | [0.20, 0.25, 0.30, 0.35, 0.40] |
| Poisson 权重 | `lib/prediction.js:22` | 0.25 | [0.15, 0.20, 0.25, 0.30, 0.35] |

- [ ] 用 Bootstrap CI 做验收：新参数配置的 CI 下界必须 > 旧配置的 CI 上界才算改进
- [ ] 输出最优参数组合 + 对应的 Brier/LogLoss/Accuracy 及 CI
- [ ] 每次世界杯比赛日后可重跑，用真实结果校验

**涉及文件：**
- Elo：`lib/elo.js` (第 8-19 行，K-factor 相关)
- Poisson：`lib/poisson.js` (第 104 行，rho)
- Prediction 权重：`lib/prediction.js` (第 21-27 行，信号权重)
- Backtest 入口：`scripts/run-backtest.js`, `run_backtest.js`
- DailyCalibration（保留但不启用）：`lib/dailyCalibration.js`
