# Backtest 待解决清单

## 问题 1：样本量偏小 ✅ 已解决（2026-07-02）

**结果：** 回测历史已扩到 24 届 964 场 + 每届 Elo 热启动快照。方向准确率从 42.19%（128场冷启动）提升到 57.88% [95% CI: 54.8%, 61.1%]（964场热启动），与业界 Elo 基线 60% 的 CI 重叠。详见 [prediction-methodology-review.md](prediction-methodology-review.md) §2.2。

**最终分工（与下面原方案略有不同）：**
- 主数据源改用 [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)（CC0，只含世界杯正赛，无需按赛事类型过滤）→ `scripts/fetch-worldcup-history.js` 转换为 `data/history/worldcup_<year>.json`（与手工校对的 2018/2022 逐场零差异交叉验证）
- martj42 49k 数据只用于 **Elo 热启动**：`scripts/build-elo-seed.js` 全量按时回放，在每届开赛日前落快照 → `data/elo-seed.json`（K 复用 `kFactorByType`，中立场不加主场分，队名别名映射覆盖率 100%）
- 评估口径保持纯世界杯正赛，未混入友谊赛——原方案的分层原则得到执行

**原始记录（存档）：** 只有 2018 + 2022 两届世界杯数据，共 128 场比赛。统计显著性不足。

**可用数据源**：[martj42/international_results](https://github.com/martj42/international_results)（CC0，公共领域），49,496 场国家队比赛，1872 年至今。已实测下载确认字段为 `date, home_team, away_team, home_score, away_score, tournament, city, country, neutral`。其中真正与世界杯正赛同量级的赛事（FIFA World Cup + Euro + Copa América + AFCON 正赛）约 3000+ 场，其余多为友谊赛（37%）和各类预选赛，强度不可直接混用。

**方案：**
- [ ] 分层使用，不要整份倒入：
  - Elo 部分：全量 49k 场按时间顺序走 walk-forward（Elo 机制本身会让旧比赛权重随时间自然衰减，全量喂法是标准做法）
  - Poisson `attack_strength`/`defense_strength` 训练：只用近 2-4 年数据，避免用百年前友谊赛数据代表球队当前实力
  - Brier/方向准确率评估口径：只用 FIFA World Cup + 同级洲际正赛（Euro/Copa/AFCON），不要把友谊赛混进准确率统计，否则和现有 128 场纯世界杯口径不可比
- [ ] 复用现有 `kFactorByType`（`lib/elo.js:13`）区分赛事类型权重，而不是新增权重机制
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
