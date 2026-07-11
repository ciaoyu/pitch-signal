# PitchSignal 预测系统：讨论结论、方法论与投稿准备报告

**日期**：2026-07-11  
**用途**：汇总此前关于 57.88%、主客场、Coach、Venue、赔率、实时预测、校准、研究证据和投稿边界的讨论，作为 manuscript v2 的事实底稿。

## 1. 我们已经纠正的核心认识

### 1.1 57.88% 不是“当前完整系统真实准确率”

早期 57.88% 来自历史 walk-forward replay，且旧路径中包含需要纠正或重新隔离的机制。它不是 2026 年当时真实公开发布的逐场预测，也不是业界最佳证明。

当前 D 的干净历史回放口径是 1930–2022、964 场：

- Accuracy 57.57%；
- Brier 0.5702；
- LogLoss 0.9662。

它的正确用途是：

- 证伪公式；
- 比较基准和消融；
- 检查年代、阶段和实力区间失效；
- 评估概率质量，而不是只宣传命中率。

### 1.2 2026 线上指标不能自动代表当前固定模型

曾经看到的 2026 线上 Brier 0.5059、ECE 0.1563 属于历史线上服务记录，但早期快照没有强制绑定不可变模型版本，因此不能自动写成当前 A v4 的 OOS 成绩。

现在的规则是：只有同时具备以下条件，才可称为 verified prospective evidence：

- `verificationStatus = verified`；
- `modelVersion` 与 A v4 一致；
- `configHash` 与 A v4 一致；
- `predictedAt < kickoffTime`；
- 来源是公开 Track A / canonical service；
- 赛后结果来自事实数据；
- 概率有限、位于 `[0,1]` 且三项和为 1。

在此之前，2026 线上指标统一为 `unverified/null`。

## 2. 当前公开预测模型的真实定义

### 2.1 赛前主概率

当前公开赛前主概率唯一由：

```text
Elo + Poisson
```

组成，并由不可变 `modelVersion + configHash` 绑定。

以下信号不能改变公开概率：

- Coach；
- 容量 Venue；
- 手工 KO λ 收缩；
- Market odds；
- Polymarket；
- Market Value；
- Continental strength；
- 未通过 OOS 的 Environment、Player、Lineup、xG。

### 2.2 世界杯主客场语义

世界杯正赛的 `home/away` 多数只是比赛顺序字段，不能自动当作真实主场。

当前规则：

- 中立场不使用普通主场优势；
- 东道主身份作为事实元数据展示；
- 东道主效应大小等待 E 或专门 OOS 研究；
- 美国在美国场馆、加拿大在加拿大场馆、墨西哥在墨西哥场馆，不自动等于普通俱乐部主场加成。

环境效应与主场优势必须分离，不能用场馆容量代替主场优势。

### 2.3 淘汰赛和实时预测

淘汰赛输出分成：

- `regulation`：90 分钟胜/平/负概率；
- `advance`：加时和点球后的晋级展示。

`advance` 在没有经 OOS 估计的加时/点球模型前，只是 display-only，不能混入常规 90 分钟主概率。

实时层已经统一到 canonical `live-reprice`：

- 比分；
- 时间和补时；
- 红牌；
- 淘汰赛状态；
- 动态剩余进球强度。

旧的 `buildLiveAnalysis` 和 monitor 独立魔法公式不应继续形成第二种公开概率。

## 3. 信号证据等级

| 信号/模块 | 当前证据等级 | 当前用途 | 能否改变主概率 |
|---|---|---|---|
| Elo | 核心基准 | 赛前实力先验 | 可以 |
| Poisson | 核心基准 | 进球强度和比分分布 | 可以 |
| Coach 中文关键词 | 伪研究特征 | 仅旧数据展示，须禁用 | 不可以 |
| Coach 任期效应 | 未完成研究 | 等外部任期史与 OOS | 不可以 |
| 容量 Venue | 已隔离 | 不再作为主场代理 | 不可以 |
| Environment | E OOS 无稳定增益 | shadow / 展示 | 不可以 |
| Player ID / Lineup | 真实数据已到位 | shadow-only | 不可以 |
| Suspensions | 真实事件和规则引擎可用 | display / shadow | 不可以 |
| xG | 当前 0 行 | blocked | 不可以 |
| Odds / Polymarket | 3 场真实 OPENING_LINE | shadow benchmark | 不可以 |
| Continental | 候选研究信号 | 等 OOS | 不可以 |
| Market Value | 候选研究信号 | 独立研究/展示 | 不可以 |
| Pressure Index | 过程展示假设 | 等历史事件 OOS | 不可以 |
| AI post-match | 赛后解释和学习材料 | display-only | 不可以 |

核心原则是：**有趣不等于有效，有数据不等于有 OOS 增益，符号合理不等于可以入模。**

## 4. E 环境研究的真实结论

E 已取得外部 CC0 国际赛池并完成 joined dataset，随后完成真实 OOS 估计。

当前可报告的结果：

- `rest_diff` 约 `-3e-5`，量级可忽略；
- `cross` 约 `-0.05`，方向上符合跨洲旅行/气候压力代理；
- `cross_unknown` 约 `+0.39`，是联盟解析缺失机制产物，不是物理环境暴露；
- 历史海拔覆盖为 0%，不能从 2026 held-out 单独拟合海拔系数；
- WBGT/weather 覆盖为 0%；
- neutral 100% 无有效变异；
- 964 场世界杯 held-out 的环境模型相对研究 Elo+Poisson 基准只有极小改善；
- 固定 seed、按世界杯届次 cluster bootstrap 后 CI 仍包含 0。

治理结论：

```text
enterModel = false
usedInModel = false
```

E v2 已于 `7564923` 正式提交并通过验收：固定 seed 的世界杯届次 cluster bootstrap、含截距的 VIF、系数 bootstrap 可复现，以及 `cross` / `cross_unknown` 分离敏感性分析均已冻结。其结论仍是无稳定 OOS 增益，环境信号保持 shadow。

## 5. F 球员/首发/停赛/xG 研究的真实结论

F v2 已完成真实数据审计：

- 75 场首发，74 场完整 11v11；
- 1,179 / 1,245 球员 ID 匹配，94.7%；
- 457 条 ESPN 球员事件；
- 83 场 officials；
- 104/104 `espnToFifa` 映射，0% null；
- 停赛引擎可读取真实红黄牌并输出展示结果；
- `team_xg_stats = 0`。

首发是当前最有潜力的非赔率信号，但“数据存在”还不等于“可入模”。必须继续积累 as-of 赛前首发、球员可用性和比赛结果，再做 OOS 增量评估。

xG 目前不能用免费 API 数据伪造。若取得合规替代源或付费源，也必须先做数据截止、训练/验证划分和校准，不能直接套入 Poisson。

## 6. G 赔率研究的真实结论

G 已完成：

- 比例去水和 Shin 去水；
- 逐快照原始响应 hash；
- milestone 归档；
- As-of fail-closed；
- 不截断历史；
- quota 白名单；
- Polymarket/赔率主概率隔离。

现在已经有 3 场真实 `OPENING_LINE` 快照：

- `coveredRaw = 3`；
- `asOfEligible = 3`；
- `excludedLeakage = 0`；
- `rawResponseHashAudit.verifiedSnapshots = 3`；
- `outOfSampleBenchmark = null`。

Shin 当前只能描述为：

> Shin 提供热门/冷门的非线性去水修正；哪种去水方法在真实样本上更准确，等待 ledger 累积后比较。

不能写成“Shin 已经更准确”。

## 7. H 教练研究的真实结论

H 已修正历史覆盖解析，真实确认：

- 1930–2022 历史世界杯：964 场；
- 教练字段：0 场；
- 仓库内 `coaches.json`：展示级中文关键词，不是研究级任期史；
- 外部任期史、国际赛果和 xG 连接尚未完成；
- OOS 估计骨架在缺数据时正确阻断。

因此教练当前只能：

- 展示事实；
- 作为未来研究候选；
- 保持 `usedInModel:false`。

## 8. 校准、置信度与不确定性

之前混淆了两类不同概念，必须分开：

### 8.1 统计置信区间

用于研究结果，例如：

- Brier/LogLoss 差值 CI；
- 系数 bootstrap CI；
- cluster bootstrap CI。

这些必须来自固定数据、固定 seed 和可复算 artifact。

### 8.2 线上启发式不确定性

当前前端可以展示的 heuristic uncertainty 由：

- Elo 与 Poisson 分歧；
- 数据完整度；
- xG 样本数；
- 首发不确定性；
- 淘汰赛状态。

它不是统计学 95% CI，必须标注为 `unvalidated` 或 heuristic，不能与研究 CI 使用同一个名字。

## 9. 投稿可以主张什么

### 可以主张

- 系统提供可复现的 Elo + Poisson 概率核心；
- 有不可变模型契约、版本 hash 和 legacy 隔离；
- 有赛前/赛后、历史/前瞻、shadow/production 的域隔离；
- 未验证信号可以展示，但不能污染公开概率；
- 有真实的首发、球员事件、停赛和赔率 shadow 数据链；
- 对环境、教练、xG 和市场信号有明确的证据门槛；
- 负结果和不确定性会被公开保留。

### 不能主张

- 57.88% 证明模型无缺陷；
- 57.57% 是业界最佳；
- 所有 Coach/Venue/Market/Environment 信号已经历史验证；
- Shin 已被证明比比例去水准确；
- 2026 Brier 0.5059/ECE 15.6% 是当前固定模型 OOS；
- 当前系统已经是完整学习型融合模型；
- 任何未通过 OOS 的特征可以改变公开概率。

## 10. 论文的两层贡献结构

投稿不应只围绕一个准确率数字，而应分成两层：

### 第一层：可复现概率核心

- Elo + Poisson；
- 预赛前 as-of；
- 964 场 walk-forward replay；
- LogLoss、Brier、RPS、校准和 paired delta；
- 失败区间和负结果。

### 第二层：多信号治理架构

- candidates 与 active signals 分离；
- 不可变账本；
- 证据等级和入模闸门；
- real-time repricing 与赛前概率分离；
- 外部赔率、首发、环境、教练、AI loop 可展示但不能未经验证污染概率。

这才是 PitchSignal 最稳妥的研究贡献：**一个允许丰富足球情报存在、但对概率污染采取 fail-closed 治理的可审计系统。**

## 11. 投稿前硬门槛

- [x] E v2 正式提交，固定 seed 与最终 OOS artifact 冻结；
- [ ] D/B 的真实 prospective ledger 有 verified 模型版本和 hash；
- [ ] G 继续累积多个 milestone 和完赛结果；
- [ ] F 的数据 artifact、cutoff、来源和 shadow 说明进入论文附录；
- [ ] H 的 0% 覆盖率和未完成 OOS 作为负结果明确写入；
- [ ] 论文数字全部能回溯到 artifact、commit、数据 hash；
- [ ] data/code/license/ethics/AI disclosure 完成；
- [ ] learned core 只有在单一负责人串行完成并通过 OOS 后才写入方法正文。
