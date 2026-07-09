# W1-D 数据管线审计报告 (Data Pipeline Audit Report)

**文档状态**：已验收（Wave 1 - Task W1-D）  
**审计范围**：`lib/backtest.js`、`lib/elo.js`、`scripts/build-elo-seed.js`、`data/elo-seed.json`  

---

## 1. 执行摘要与审计结论

针对路线图 (§4.2、§4.4) 设定的四项核心审计与改造任务，评估与校准线（B 线）完成了全面验证与打通。结论如下：

| 审计项目 | 审计结论 | 数据 / 证据支撑 |
| :--- | :--- | :--- |
| **中立场与东道主标注接入** | **100% 覆盖并接入管线** | 964 场历史比赛中，中立场比赛 **843 场 (87.45%)**，东道主参赛场次 **121 场 (12.55%)**。 |
| **K 因子前视泄漏审计** | **无前视泄漏** | `kFactorByType` 赛事分类仅依赖比赛当日明确可见的赛事元数据类型（如 `FIFA World Cup`、`qualification`）。 |
| **`daysAgo` Plumbing 改造** | **通道已打通，默认零回滚** | 默认执行路径保持未传递 `daysAgo` 入参，确保 Wave 1 主数字 **Bit-Identical (964场 57.88%/0.5708/0.9644)**；同时支持显式注入 `useDaysAgo` 供 Wave 2 衰减实验。 |
| **Elo 种子文件无泄漏审计** | **无泄漏，快照严格先于开赛** | 自动校验程序核实 1930–2022 共 22 届世界杯快照，其 `asOf` 日期均严格等于或早于当届首场比赛日。 |

---

## 2. 详细审计报告与实现说明

### 2.1 中立场 / 东道主标注接入 (§3, §4.4)
- **背景**：在标准的世界杯决赛圈回测中，绝大多数场次在第三方中立场地举办，两支离岸球队均不享受传统意义的主场加成；仅东道主国家参赛时为真正的主场/偏向主场。
- **实现方法**：
  - 在 `BacktestRunner` 内核中建立 1930–2026 全历届世界杯主办国权威元数据映射（`WORLD_CUP_HOSTS`）。
  - 在 `loadHistory()` 数据读取层通过 `annotateMatchVenue(match, year)` 自动对每条比赛记录注入布尔属性：
    - `match.neutral`：若对阵双方均非当届东道主，则为 `true`。
    - `match.isHostHome` / `match.isHostAway`：标识主队或客队是否为东道主。
- **覆盖率统计**：
  - **总场次**：964 场
  - **中立场比赛 (Neutral)**：843 场（占比 **87.45%**）
  - **东道主比赛 (Host)**：121 场（占比 **12.55%**；其中东道主列主队 91 场、列客队 30 场）
- **交付输出**：回测 JSON 输出及 `results.venueAudit` 均可完整查阅此分布。

### 2.2 K 因子赛事分类前视泄漏审计 (§4.4)
- **背景**：`lib/elo.js` 规定了不同赛事级别使用动态 K 因子（`world_cup=60`、`continental=50`、`qualifier=45`、`friendly=30`）。
- **核实重点**：评估历史快照生成及每场比赛更新时，其 `matchType` 判定规则是否引入了事后才知道的信息。
- **结论**：
  - 判定函数 `matchType(tournament)` (`scripts/build-elo-seed.js`) 与调用处传参仅判断赛历记录中的原生 `tournament` 字符串；
  - 无论在赛前预训练 Elo 还是赛后增量迭代，均未引用赛后排名或未来赛事权重，无前视泄漏。

### 2.3 `daysAgo` Plumbing 与主数字 Bit-Identical 约束 (§4.2)
- **背景**：`lib/elo.js` 内置了支持时间半衰期衰减的参数 `options.daysAgo`；为避免静默改动现有基线指标，必须满足：
  1. 默认执行流程中不过早强制开启衰减，确保 Wave 1 红线数字不变；
  2. 开放透传接口供 Wave 2 消融与衰减实验使用。
- **实现方法**：
  - 在 `compareBaseline` 闸门方法的白名单中增加了 `useDaysAgo`、`decayHalfLifeDays`、`decayLambda`、`referenceDate`；
  - 打通 `compareBaseline` 与 `run` 两个公开调用入口，将其配置经由 `paramOverrides` / `opts` 完整透传至 `_walkForward` 与 `eloEngine.updateRatings`；
  - 默认未开启时，入参严格为 `{ matchType: 'world_cup' }`。
- **基线与衰减检验**：
  - **默认情况（零回滚）**：运行命令 `node scripts/run-backtest.js` 产生的 964 场指标与规范基准**绝对逐位一致**（准确率：`57.88%`，Brier 得分：`0.5708`，LogLoss 得分：`0.9644`）；
  - **开启衰减情况（有效响应）**：通过 `compareBaseline({ useDaysAgo: true, decayHalfLifeDays: 180 })` 或 `run({ useDaysAgo: true, decayHalfLifeDays: 180 })` 调用时，能成功触发半衰期时间差衰减，产出有别于基线的有效 Brier 得分（约 `0.5721424`），不再发生静默未生效或被闸门报错拒绝。

### 2.4 Elo 种子无泄漏确认 (§4.4)
- **背景**：回测通过读取 `data/elo-seed.json` 解决冷启动问题。若某届世界杯快照包含了该届比赛发生后的 Elo 评分，将构成严重的数据泄漏。
- **自动审计设计**：
  - 编写了自动校验脚本，针对 `data/elo-seed.json` 中的 1930–2022 年快照进行遍历。
  - 对比对应年份 `data/history/worldcup_YYYY.json` 中所有赛程中最先开赛的时间戳 `min(date)`。
  - 验证条件：`snapshot.asOf <= min(match.date)` 必须恒为真。
- **审计结果**：全部 22 届赛事的种子状态截断日期完全符合规范，零未来数据泄漏。

---

## 3. 自动化测试套件与持续交付

为了将审计规则固化为长期防腐守卫，新增了集成回归测试 `scripts/test-w1d-pipeline-audit.js`：
- 已集成至统一测试入口 `npm test`（由 `scripts/test-runner.js` 统一调度）；
- 严密断言覆盖共 **24 项**（包括 22 届历史快照日期无泄漏断言、87.45% 中立场比例精准校验、默认路径逐位恒定一致校验、以及 `compareBaseline` 和 `run` 两个公开入口分别传入 `useDaysAgo` 后的数值变化精确校验）；
- 当前全部 **50 个测试套件，620 个断言全部通过 (50 passed, 0 failed)**。
