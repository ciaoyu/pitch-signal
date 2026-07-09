# PitchSignal 预测系统改进路线图（v2）

> 版本 2026-07-09 v2 · 合并四方外部审查（学术界、工程界、量化金融界 + 第四轮细化评审）与本代码库实证证据
> 本文档**取代** `prediction-methodology-polymarket` worktree 中的 v1 草稿（该副本由其 session 决定是否丢弃）。
> 配套文档：[prediction-methodology-review.md](prediction-methodology-review.md)（证据编号 E1–E7、决策记录 D1–D8 见彼处）。
> 所有涉及代码或模型机制的修改均须遵循本文档约定的评估纪律与验收闸门。

---

## §0 评审来源、口径澄清与总纪律

### 0.1 四方交叉审查共识与分歧矩阵

| 评审视角 | 核心评价与肯定项 | 诊断出的关键短板 | 本路线图裁决 |
|---|---|---|---|
| **学术界视角** | 赞许 walk-forward、同日信息隔离与「未验证不碰展示胜率」的工程纪律 | Elo 平局线性相减与硬下限存在理论缺陷；线性加权池化导致均值钝化 | 采纳数学重构：平局模型改造为 Davidson / (ordered) logit 结构，后续探索对数几率池化 |
| **工程界视角** | 代码结构清晰，Track A / Track B 解耦思想在工业界难得 | 代码实现与论文陈述存在不一致（开放 API 旁路、xG 参数未传、衰减未激活等） | **优先级最高（P0）**：整顿代码与接口语义一致性，消除未经验证的旁路篡改 |
| **量化金融视角** | 赞赏 Shin 去水与自适应 Sigmoid 融合的设计 | 概率校准缺失；赛中定价缺乏非均匀进球强度；市场信号缺少 shadow 缓冲带 | **最高 ROI（P1）**：后验概率校准层 + 钉死评估口径；市场信号三档制 |
| **第四轮细化评审** | 认可路线图方向 | isotonic 小样本过拟合风险、闸门"通过"缺操作定义、压力指数灰度标注不敌锚定效应、区间改名不治本、K 因子分档可能前视泄漏 | 全部采纳：候选池化、写死操作定义、赛中默认不展示、经验分位数区间、泄漏审计（见各节） |

### 0.2 Brier Score 口径澄清（必读，否则一切 Brier 讨论失真）

外部评审曾引用文献 0.20–0.28 的 Brier 与我们的 **0.5708** 直接对比，属口径错配：

- 文献常见的 0.20–0.28 多为**每结果均值 / RPS / 二分类（胜负）**口径，且常基于去水市场赔率。
- 本系统回测口径（[lib/backtest.js:204](../lib/backtest.js)）为**三分量求和**：`(P_h−Y_h)² + (P_d−Y_d)² + (P_a−Y_a)²`。该口径下：
  - 均匀基准（1/3, 1/3, 1/3）≈ **0.667**；
  - 历史频率基线（长期主/平/客频率）≈ **0.60–0.62**；
  - 市场级模型（去水后）典型落在 **0.55–0.58**。
- 结论：0.5708 **显著优于均匀与历史频率基线、处于市场级区间下沿**，"现状灾难性差"的判断不成立；但校准仍是最高 ROI 改进方向。

> **约定**：本文档及后续所有讨论，Brier 一律指三分量求和口径；任何跨系统比较必须先声明口径并附 §2.1 的统一基准对照线。

### 0.3 总纪律（继承论文闸门哲学，对内也执行）

1. **任何改动必须过 walk-forward 消融**：跑 `compareBaseline`，方向准确率不显著下降且 Brier / LogLoss 改善，才准合并进主引擎。
2. **负结果照实记录**：延续 Dixon-Coles 先例（methodology review §2.3 / D1）——不过闸门就降级为展示项或保留现状并披露，不偷偷改回。
3. **未经验证的信号不得移动用户概率**：论文 Track B 纪律对赛前 coach/venue 同样适用（§4）。
4. **论文标榜特性必须被实际评估过**（中立场 HFA、Elo 衰减），否则不得作为已验证能力对外陈述（§3、§4）。

### 0.4 闸门操作定义（写死默认标准，避免"通过/不通过"边界模糊）

- **Reliability diagram 标准**：默认 **10 个等频分箱**，报告每箱实际场次；输出 JSON 结构统一为 `{bin_low, bin_high, n, pred_mean, actual_freq}` × outcome（home/draw/away），**尾部箱单独输出**。后续闸门 PR 可附分箱灵敏度检查，但不改基线图。
- **尾部分箱校准"通过"**：最极端两箱（最高/最低预测概率）的实际频率落在该箱预测概率均值的**二项分布 95% CI** 内，且无系统偏差（不出现连续三箱同方向偏离）。此为默认标准；不适配可再调，但调之前按此执行。
- **Brier 改善阈值**：当前阶段以数值改善为准（不设绝对阈值）；但改善 **< 0.001** 且可靠性图几乎重合的候选，须在 methodology review 注明"**无实际意义**"，作为未来淘汰依据。
- **权重学习触发条件**：连续两次闸门实验 Brier 改善 **< 0.002** 且 reliability diagram 无系统偏差 → 自动触发 logistic stacking 可行性评估（防止"远期"永远停在纸面）。

### 0.5 预期管理

- **60% 方向准确率是该模型族的公认天花板，不是起点**（methodology review §2.2、E7）。Wave 2 各闸门实验大概率产出负结果——**被正式记录的负结果本身就是任务价值**，不算任务失败。
- 校准层（§2.3）改善的是**概率质量**（Brier / 可靠性），不是方向准确率；不要期待它把准确率推过 60%。
- 赛中三方对比（§4.3）标注为**潜在高影响实验**：若朴素状态匹配查表赢了 Poisson，是比"修模型"更有传播力的发现。

---

## §1 P0 — 架构一致性与确定性 Bug（低风险，先派工）

本阶段解决客观存在的行为背离、逻辑疏漏与变量未生效问题，**不改变预测方向**；回测主数字（964 场 57.88% / Brier 0.5708）必须逐位不变。

### 1.1 统一赛中重定价语义，封堵 Track B 泄漏

- **证据**：公开端点 `POST /api/predict-live/:matchId`（[lib/routes/prediction.js:139](../lib/routes/prediction.js)）调用 `buildLiveAnalysis`（[lib/services/PredictionService.js:405](../lib/services/PredictionService.js)），用射门差、控球率、红黄牌及外部赔率在线性空间直接平移胜率；且 `predictLive` 经 `predictMatch(includeExternalOdds:true)` 已把赔率并进 baseline，`buildLiveAnalysis` 又加 `marketEdge`（PredictionService.js:454），赔率被 double-count。前端目前走的是干净的 `live-reprice` 路径，纪律只靠前端约定而非架构强制。
- **整改**：
  1. 对外所有实时预测强制收敛至 [lib/live-reprice.js](../lib/live-reprice.js) 的纯数学 `reprice()`；
  2. 下线 `POST /api/predict-live/:matchId` 或加严格 admin 闸门，前端一律禁止调用；
  3. 射门、控球、危险进攻等实时统计只进 Track B 压力指数与文字解说层。

### 1.2 修复 xG 混合确定性 Bug（仅修 bug，真接入见 §6）

- **证据**：[lib/poisson.js:47](../lib/poisson.js) `teamXg = isHome ? xgProfile.avgXgFor : xgProfile.avgXgFor` 三元两边相同；且 `PredictionService.predictMatch`（PredictionService.js:147）根本不传 `xgProfile`，xG 从未真正进入主 λ。
- **整改**：明确 home/away 各传各的 profile 后修正取值逻辑，补边界单测（单队完赛 < 2 场）。**本项只修 bug**；把 xG 真接入主 λ 属 §6 中期项，须单独过闸门。

### 1.3 规范 `timeRatio` 时间语义

- **证据**：[lib/live-reprice.js:98-101](../lib/live-reprice.js) 中 `totalMinutes = 90 + addedTime` 但 `timeRatio = minutesRemaining / 90`，开球带较长预计补时时 `timeRatio > 1`，瞬时剩余 λ 超过赛前全场估值。
- **整改**：先规约赛前基线 λ 的时间基数（认定 λ_pre 为常规 90 分钟预期），再选择上限封顶 `Math.min(1, ...)` 或按每分钟均率计算——**决策依据写进代码注释**。

### 1.4 压力指数赛中默认不展示（取代 v1 的"灰度标注"方案）

- **理由**：灰度标注不足以对抗锚定效应（Tversky & Kahneman, 1974）——只要一个 0–100 的动态指数在实时界面在场，即便声明不可靠，仍会影响用户对胜率的解读。这与"未经验证的信号不得影响用户决策"的 Track B 哲学冲突。
- **整改**：
  1. 压力指数在通过回测验证前，**赛中（live）UI 默认不渲染**；
  2. 移入赛后回顾分析展示；
  3. 如需实时展示，只能做**默认关闭的"实验数据层"开关**，开启时弹出知情提示（"该指标未被证明能有效预测进球"）。

---

## §2 P1 — 概率质量与后验校准（最高 ROI）

### 2.1 基准对照体系（钉死口径 + 预注册假设）

- **整改**：在 [lib/backtest.js](../lib/backtest.js) 回测报告中显式并列输出四条线：
  1. `Uniform Baseline`（1/3 均分）；
  2. `Historical Frequency Baseline`（按历史主/平/客宏观频率）；
  3. `Model Baseline`（本引擎）；
  4. `De-vigged Market Odds Baseline`（合规历史赔率经 Shin 去水，可得时）。
- 同时输出 reliability diagram 原始分箱数据，**按 §0.4 标准**（10 等频箱、统一 JSON 结构、尾部箱单列）。
- **预注册假设**：Poisson/Elo 融合**尚未在本数据集上被验证优于朴素历史频率**。若历史频率基线准确率 ≈ 模型 57.88%，属高优先发现，**必须明文报告**——它直接决定 Wave 2 全部实验的期望值管理。

### 2.2 Elo 平局模型重构

- **证据**：[lib/elo.js:124-136,153-156](../lib/elo.js) 用 `expectedHome − 0.5·drawProb` 线性减法 + `drawProb ≥ 0.15` 硬下限 + 负概率截断归零，强弱悬殊时把客胜物理压成 0.0%、平局虚高。
- **整改**：候选池三选一（闸门自选，不预判）：
  1. **Davidson (1970)** 偏序模型：`P(draw) = ν√(π_H π_A) / (π_H + π_A + ν√(π_H π_A))`；
  2. **多项 logit**（对数实力差为自变量的三分类）；
  3. **Ordered logit/probit**（Goddard & Asimakopoulos 2004——切割点天然保证概率和为 1，逻辑上更贴近赛果生成过程）。
- **闸门**：`compareBaseline` 上 Brier/LogLoss 改善 + accuracy 不降 + **尾部分箱校准按 §0.4 定义通过**（Davidson 给出的"很小但非零"的弱队胜率究竟校不校准，只有分箱对照实际频率才能确认）。不过则保留现状并记负结果。

### 2.3 后验概率校准层

- **整改**：四候选同场竞技，闸门自选：**temperature scaling / Platt / beta calibration（Kull et al. 2017）/ isotonic regression**。
  - 预警（不预判）：isotonic 是自由阶梯函数，在可用校准集只有几百场的情形下易过拟合、在尾部产生极端跳跃（Niculescu-Mizil & Caruana 2005 的小样本结论）；beta/Platt 参数少更稳健——让闸门数据说话。
- **拟合协议（必须遵守）**：校准器在**滚动训练窗上拟合、在紧邻的下一折块上评估**（proper walk-forward calibration）；reliability diagram 必须覆盖**全部 964 个 out-of-sample 预测**。禁止全局 fit 后报全样本自我美化。
- **成功标准**：概率质量（Brier / 可靠性），不是方向准确率。

### 2.4 不确定性区间两步走

- **证据**：[lib/prediction.js:456](../lib/prediction.js) `calcConfidenceInterval` 是信号分歧 + 样本惩罚 + 阵容不确定性的手写启发式，与模型真实预测不确定性无关。
- **整改**：
  1. **第一步（立即）**：API/UI 措辞改为"**启发式不确定性区间**"，严禁自称统计置信区间；
  2. **第二步（依赖 §2.3 落地）**：用 walk-forward 评估中保留的逐场预测误差经验分布，在新预测上构造**经验分位数区间**，替换手写逻辑——不需要贝叶斯推理，且区间具备可检验的覆盖频率。

---

## §3 P2 — 中立场主场优势（回测闸门定夺）

按团队共识，中立场 HFA 不直接拍板修改，走前向回测决定取舍。

### 3.1 问题回顾

- [lib/elo.js:9,77,121](../lib/elo.js) 对"主队"恒定 +100 评分优势，不区分中立场；
- [lib/prediction.js:242-243,611-615](../lib/prediction.js) `calcVenueFactor` 按体育场容量给主胜加成（容量不是主场优势的代理变量，中立场更不该有主场优势）；
- 赛会制世界杯正赛绝大部分场次为两支离岸球队在第三方中立城市对弈，"主队"只是数据排前面的队。

### 3.2 候选配置与闸门

1. **候选引擎**：中立场关闭 +100 Elo 增益；仅东道主赋予经回测标定的小加成（幅度由数据定，不拍脑袋）；容量增益在中立场休眠或降级为前端信息卡片。
2. **闸门**：用 martj42 全量数据 + 中立场标记跑 full walk-forward `compareBaseline`；改善才切换；**不改善则保持现状，负结果写入 methodology review**（同 DC 先例）。
3. **前置依赖**：W1-D 完成中立场/东道主标注接入（见 §8）。

---

## §4 P3 — 纪律对内执行：信号消融、衰减验证与数据管线审计

### 4.1 coach / venue 消融（补闸门）

- **证据**：[lib/prediction.js:231-244](../lib/prediction.js) 中 coach（中文关键词解析战术风格，效应 ±0.04）与 venue（容量启发式）合计占 25% 基础权重，却从未做过 DC 式的单信号关停消融。论文对赛中信号设严格闸门，赛前这两个信号却是"对内例外"。
- **整改**：各自独立跑零权重消融；未过"不损及基线 Brier"要求的，baseWeight 归零、数据重定位至 Match Notes / 解说层——与 Track B 同等待遇。

### 4.2 回测衰减机制失活修复（daysAgo，bit-identical 约束）

- **证据**：[lib/elo.js:70-73](../lib/elo.js) 内置 180 天半衰期指数衰减，但 [lib/backtest.js:219](../lib/backtest.js) 调 `updateRatings()` 未传 `daysAgo`——论文标榜的核心特性在评估中静默关闭，**57.88% 是无衰减成绩**。
- **整改**：
  1. **Plumbing（Wave 1）**：打通 `daysAgo` 传递，但**默认路径必须与今日完全相同的 `updateRatings` 入参（默认不传 daysAgo，而非传 0）**，仅显式 flag 注入——保证主数字 bit-identical；
  2. **实验（Wave 2）**：对 90 / 180 / 365 天半衰期跑网格 `compareBaseline`，结论回填 methodology review。

### 4.3 赛中模型三方对比（自 v1 的 P5 提级；潜在高影响实验）

- **动机**：`live-reprice` 的"持续 Poisson + 线性时间缩放"假设进球强度时间均匀、与比分状态无关；文献（Dixon & Robinson 1998 等）表明 70–90 分钟进球密度显著上浮、领先/落后方战术改变进球率。而 Poisson 假设本身**尚未在本数据集上被验证优于朴素历史频率**。
- **三方候选**：
  1. 现状：持续 Poisson（线性 `t/90`）；
  2. Poisson + 非均匀时间密度 `g(s)` 积分换算；
  3. **状态匹配非参数胜率表**：在历史数据上离线索引"时间 × 比分 × 实力差 × 红牌"相仿比赛的最终结果分布，赛中查表。
- **约束**：
  - 实力差度量源**第一阶段统一用 walk-forward Elo 差值（赛前快照）**，与 Poisson 输入同源，保证三方站在同一实力差前提上；
  - **第一步必须做数据可得性审计**：49k 场国际比赛多为静态赛果，未必有分钟级比分路径/红牌时间；数据不足则降级为已追踪比赛样本或外部数据源调研，**不许假装能从静态赛果建状态表**。
- **闸门**：历史赛中状态上的离线校准对比（Brier/LogLoss + reliability），赢者才接入 `live-reprice`。

### 4.4 数据管线泄漏审计（Wave 1 并行项）

1. **K 因子赛事分类前视泄漏**：`kFactorByType` 依赖比赛的赛事类别（world_cup/continental/qualifier/friendly），审计每次评分更新所用类别是否严格取自**该比赛日期之前可得的赛事元数据**（早期美洲杯邀请赛等边界模糊期是重点），结论写入 methodology review。
2. **Elo 种子泄漏确认**：审计 `data/elo-seed.json` 构建（`scripts/build-elo-seed.js`），明文确认每届快照**不含该届赛果**——这是 57.88% 的命根子，理论上干净（论文称快照取在开赛前），但值得书面确认。
3. **中立场 / 东道主标注接入**：核实 martj42 数据集 `neutral` 字段并接入回测管线，报告标注覆盖率（§3 的前置依赖）。

---

## §5 P4 — 市场信号三档制与合规生产流程

### 5.1 三档运行配置

- **证据**：[lib/routes/prediction.js:132-133](../lib/routes/prediction.js) 只要 `THE_ODDS_API_KEY` 存在即自动把外部赔率混入生产胜率，无缓冲带；[lib/prediction.js](../lib/prediction.js) 的 Polymarket 闸门 hardcode 关闭且数据源仍是 mock 哈希伪概率。
- **整改**：为所有市场数据源定义系统级三档：

```
OFF                 -> 彻底关闭，纯数理统计输出（当前公开 beta 默认）
SHADOW_COMPARE      -> 影子档：同步落库去水盘口概率 + 赛后对比台账，用户只见统计模型胜率
PRODUCTION_FUSION   -> 生产档：Shin 去水 + Sigmoid 自适应融合正式参与线上概率合成
```

- 新增数据源必须从 `SHADOW_COMPARE` 起步，积累一届完整小组赛、经 §0.3 闸门确认后方可提权。The Odds API 的 env-key 静默直通必须废除。

### 5.2 Polymarket 真实接入

- 按官方 Gamma API 替换 mock（`lib/polymarketClient.js`），解析真实流动性与深度；因无 2026 前历史，验证走"带/不带市场信号双版本离线比对"，不与常规 walk-forward 混用。
- 牢记先例：mock 赔率曾把 Brier 拉垮至 0.6726——市场数据必须真实且过影子期再介入。

---

## §6 P5 — 中期研发方向（派工前须再行专项评估）

1. **信号池化非线性化（log-odds pooling）**：多信号在对数几率空间合成，防止高置信判断被保守信号过度拉平（对付 §0.2 指出的欠自信）。作为 `compareBaseline` 候选。
2. **权重学习（logistic stacking）**：仅在 §0.4 触发条件满足后（连续两次闸门 Brier 改善 < 0.002 且 reliability 无系统偏差）启动可行性评估——在模型良好校准之前学习融合权重等于用错误概率作特征。
3. **xG 真接入主 λ**：先修 §1.2 bug，再让 `PredictionService` 传 `xgProfile`、API 暴露 `xgApplied/matches/source` 标志；无数据时 `applied:false`，不许前端显示得像真 xG 预测。过闸门。
4. **赛后学习闭环结构化**：LLM 提取的教训转为持久化 DB 对象（`hypothesis_type / condition / metric / next_match_status / confirmed·refuted·expired`），所指球队下一场由**纯代码**扫描事件流验证或反驳（不二次调 LLM），批量回溯时施加 **FDR 多重检验校正**，杜绝小样本伪规律累积。

---

## §7 明确不做清单（已裁定不可行的路线）

| 提议 | 拒绝理由 |
|---|---|
| 多层机器学习 / 神经网络（XGBoost / RF / PyTorch 等） | E1–E3 三重独立证据：同特征无增益，小样本更差；加剧单人运维负担 |
| 全贝叶斯层次模型 | 同上 + 违反零框架约束；增益无证据支持 |
| RankNet / Cox 生存分析等评审提议 | 同属"换更花哨的算法"，增益来源仍是特征质量（E2） |
| 废弃 Dixon-Coles 修正 | 维持论文裁决（D1）：对 1X2 无功无过，但保障比分矩阵展示合理性；§2.3 校准层落地后可复测 |
| 自爬博彩赔率 | ToS 风险（D6）；走正规 API 免费层 |

---

## §8 派工切分与验收（总控制执行手册）

- 每任务一个独立 worktree / 分支；任务卡自包含（file:line + 改动边界 + 验收标准 + 闸门定义原文），不依赖派工对话。
- 每个 PR 必须附 `npm test` 与 `node scripts/run-backtest.js` 完整产出台账；无实证结果禁止进库。

### Wave 1 — 并行 4 任务（纯工程，不改预测方向；主数字 57.88% / 0.5708 必须逐位不变）

| 任务 | 内容 | 验收标准 |
|---|---|---|
| **W1-A 赛中纪律统一** | 下线或 admin 闸门 `POST /api/predict-live/:matchId`；live 概率统一走 `reprice()`；消除赔率 double-count；压力指数赛中 UI 默认不渲染（§1.1、§1.4） | ① 无公开端点能用射门/控球/红黄牌改概率；② 前端搜索 `pressureIndex`/`PressureIndex` 展示点：live 页默认不可见、赛后回顾可见、实验层显式开关+知情提示；③ npm test 绿 + 新增端点测试 |
| **W1-B 确定性 bug** | 修 `blendXg` 无效三元；定 `timeRatio` 语义并修 >1 边界，决策写注释（§1.2、§1.3） | 边界单测（开球带补时）；npm test 绿；回测主数字不变 |
| **W1-C 评估基础设施** | 四条基准线 + reliability 分箱输出（10 等频箱、§0.4 JSON 结构、尾部箱单列）+ 历史频率预注册假设报告（§2.1） | 主数字逐位不变；JSON 输出齐全可复现；"历史频率 vs 模型"对比结论明文写出 |
| **W1-D 数据管线审计** | 中立场/东道主标注接入；K 因子前视泄漏审计；`daysAgo` plumbing（默认不传、bit-identical）；elo-seed 泄漏确认（§4.2、§4.4） | 审计报告 + 标注覆盖率；默认路径入参与今日完全相同、主数字不变；种子无泄漏结论有据 |

### Wave 2 — 闸门实验（依赖 Wave 1 验收；负结果照实记录即算任务完成）

| 任务 | 内容 | 闸门 |
|---|---|---|
| **W2-E 平局模型重构** | Davidson / 多项 logit / ordered logit-probit 候选池（§2.2） | Brier/LogLoss 改善 + accuracy 不降 + 尾部分箱按 §0.4 通过；<0.001 改善记"无实际意义" |
| **W2-F 后验校准层** | 四候选同场竞技，滚动窗拟合/下折评估（§2.3） | 同上 + reliability 覆盖全部 964 场 out-of-sample；成功标准为概率质量 |
| **W2-G 中立场 HFA** | 候选配置 vs 现状（§3；依赖 W1-D） | compareBaseline 改善才切换 |
| **W2-H 双闸门** | (a) coach/venue 各自关停消融；(b) 衰减半衰期网格 90/180/365 天（§4.1、§4.2）。**两条独立验收，各自过/不过，不混成一票** | 不过 → baseWeight 归零 / 衰减结论写 methodology review |
| **W2-I 赛中三方对比**（潜在高影响） | 第一步数据可得性审计；可行则状态匹配表 vs 持续 Poisson vs Poisson+g(s)，实力差统一用 walk-forward Elo 差（§4.3） | 历史赛中状态离线校准对比；赢者才接 live-reprice |

### Wave 3 — 依赖 Wave 2

- **W3-J** 市场三档制（§5）：OFF/SHADOW_COMPARE/PRODUCTION_FUSION；The Odds API 去静默；Polymarket Gamma → shadow。
- **W3-K** 经验分位数区间替换 `calcConfidenceInterval`（§2.4 第二步；依赖 W2-F）。
- **W3-L** 赛后学习闭环结构化（§6.4）。

### 验收流程（每任务，由总控制执行）

1. 拉取该分支 → `npm test` 全绿；
2. `node scripts/run-backtest.js` 复现任务声称数字（Wave 1：主数字逐位不变；Wave 2：闸门定义达标）；
3. 逐条核对上表验收清单；
4. 通过 → 汇报并请求 merge/push 确认（push 纪律：每次单独确认）；打回 → 附具体不合格项。
