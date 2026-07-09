# PitchSignal 预测体系设计报告

本文件是 PitchSignal 预测系统的完整说明，供 Bot 知识库检索使用。

---

## 预测体系设计理念

PitchSignal 的预测体系建立在一个核心原则上：**未经验证的软信号不能进入概率，AI 负责解释，数学负责计算。**

我们将整个系统拆分成四个互相隔离但可追溯的层：数学层、盘中层、AI 解释层、学习回路。四层之间的数据流是单向的——只有经过回测验证的信号才能从解释层升级进入数学层。

这套设计是为了避免几类常见错误：用手写权重伪装成模型、用无数据支持的叙事偷偷改变概率、只输出点估计不输出不确定性、让 AI 在没有证据的情况下生成数字。

The PitchSignal prediction system is built on one core principle: unvalidated soft signals cannot enter probability calculations. AI is responsible for explanation; math is responsible for the numbers.

The system is split into four isolated but traceable layers: mathematical model, live repricing, AI explanation, and learning loop. Data flows one way — only signals that pass backtesting can be promoted from the explanation layer into the math layer.

---

## 赛前预测：贝叶斯框架

赛前预测不是简单的权重加权，而是一个层级贝叶斯结构：

**慢先验**：Elo 评分，反映球队长期历史实力。世界杯赛级 K 值设为 60，赛会制下快速响应状态变化。主场优势自动增加 50 Elo 分。

**快速证据**：本届赛事的 xG（预期进球）、xGA（预期失球）、射门质量。xG 衡量的是机会质量而非原始射门数——相同射门数下，禁区内直射比远射 xG 高得多。这个数据会随本届比赛进行而更新，越到后期越准确。

**后验输出**：两队各自的进球期望 λ，经过 Dixon-Coles 修正低比分概率后，输出胜平负概率分布、比分分布、最可能比分。

**置信区间**：不只显示"阿根廷 68%"，而是显示"阿根廷 58-75%，中等置信"。区间宽窄来自四个维度：Elo 与 Poisson 信号的分歧程度、xG 样本量（小组赛每队仅 3 场，样本极小）、阵容不确定性、淘汰赛额外的平局/加时可能性。

Before the match, our model does not simply average weighted signals. It uses a hierarchical Bayesian structure. Elo is the slow prior reflecting long-term team quality. xG from the current tournament is fast evidence that updates as the competition progresses. The output is a posterior distribution, not a point estimate, displayed with a confidence interval showing the range of plausible outcomes.

---

## 盘中重定价：Track A 与 Track B 严格分离

盘中预测是整套体系里变化最大的部分，也是我们最谨慎的地方。

**Track A（直接进概率）**：只接受硬事实。当前比分、已过时间、红牌、是否淘汰赛。公式是：剩余时间内双方进球仍服从 Poisson 分布，λ 按剩余时间比例缩放，红牌按历史系数 0.72 惩罚（10 人队进球率历史上约降至 72%）。60 分钟 1-0 领先时，主队胜率约 82%；淘汰赛 90 分钟 1-1 时，双方各约 51%。

**Track B（只展示，不进概率）**：射正、角球、控球率、传中次数 → 压力指数 0-100。这些是展示层信号，不会直接改变胜率。原因：如果把"角球多"直接换算成"+3%胜率"，我们只是把手写权重从赛前搬到了盘中。Track B 需要先通过回测——验证某组信号出现后，未来 5/10/15 分钟进球概率是否显著高于基准率——才允许升级为 calibrated probability mover。

这个设计来自三场比赛的观察：Jordan vs Algeria（落后队进球前 15 分钟已在持续积累射正+角球），Argentina vs Austria，Portugal vs Uzbekistan。模型应该在进球发生之前就开始移动，但必须用可验证的证据来支撑。

Track A handles only hard facts: current score, elapsed time, red cards, knockout status. This produces updated probabilities directly. Track B converts shot-on-target counts, corners, possession, and crosses into a Pressure Index from 0 to 100. This is a display layer only — it does not change probabilities until backtesting confirms it carries predictive power above base rate.

---

## Pressure Index（压力指数）

压力指数衡量的是"这支球队在最近 15 分钟里积累了多少威胁"，不等于胜率。

计算方式：取两个时间点之间的累积统计差值（delta），映射到 per-15-min 的速率，然后加权求和：
- 射正：35%（最强单项信号）
- 射门数：20%
- 角球：20%
- 控球率：15%
- 传中：10%

参考上限：15 分钟内 4 次射正视为极高压力（满分），5 个角球视为极高，控球 70% 以上视为极高。

**Surge 检测**：当一支落后的球队连续 3 个快照（约 3 分钟）压力指数 ≥ 65，且期间未进球，系统触发"持续压力告警"。这是 Jordan vs Algeria 比赛 69 分钟进球前的典型模式——动量已经积累，只是比分还没反映。

压力指数和盘中概率分开展示，让用户能同时理解：日本现在压力很大（Track B），但巴西仍然领先，所以巴西胜率仍然高（Track A）。

The Pressure Index measures how much threat a team has accumulated in the last 15 minutes. It is not the same as win probability. When a trailing team sustains a Pressure Index above 65 for three consecutive readings without scoring, the system fires a surge alert — this is the pre-goal signal pattern seen in Jordan vs Algeria, where Algeria's pressure built through corners and shots on target before the 69th-minute equalizer.

---

## 赛后学习回路

赛后复盘是整套系统真正的护城河——它让每场比赛的经验能影响下一场的分析。

**AI 复盘流程**：比赛结束后，系统把赛前预测快照、实际比分、关键事件、新闻证据交给 AI，要求输出 7 类归因分类（战术失算、关键球员伤停、裁判效应、战术欺骗、黑天鹅、统计方差等），并生成两类教训：

- **teamSpecificLessons**：这支球队下一场适用的具体观察，必须引用具体时间段、统计数据或事件，不能是"防守需要改善"这种空话
- **globalModelLessons**：预测引擎本身应该如何改进，例如"模型在落后队积累 3+ 次射正后不重定价——它应该这样做"

**教训验证机制**：每条教训需要预先注册一个可验证的指标（如"换人后禁区进入率是否上升"），在下一场比赛后自动检验，不高于基准率则权重衰减，3 场未验证则过期失效。没有验证机制的教训是单向写入，不形成闭环。

**回测基线**：所有模型参数改动需通过 walk-forward 回测（2018+2022 历史数据）的守门人检验。如果 Brier Score 退步，改动自动拒绝。当前基线：Combined 128 场，Brier 0.654，准确率 43%。

The post-match learning loop is what separates a static prediction model from an improving system. AI reviews produce structured lessons with pre-registered metrics — each lesson is essentially a hypothesis that gets tested in the next match. Lessons that do not outperform the base rate decay in weight and expire after three matches.

---

## Match Moment 触发点体系

比赛不是连续信号流，而是由一系列结构性节点构成的。PitchSignal 在以下时刻进行快照和重定价：

**上半场**：开场 → 补水约30分钟 → 每次进球 → 重要换人 → 45分钟 → 上半场补时

**下半场**：开场 → 补水约75分钟 → 每次进球 → 重要换人 → 90分钟 → 下半场补时

**加时赛（淘汰赛平局）**：加时上半场15分钟 → 补时 → 加时下半场15分钟 → 补时 → 点球大战

每个触发点执行三件事：
1. 记录当前比分状态和统计数据
2. Track A 重定价（纯数学）
3. 更新 Pressure Index（Track B 展示）

补水时间和半场这类结构性节点没有明确的事件数据，系统通过比赛时间窗口推断。进球之所以需要立即重定价，是因为比分是比时间更强的状态变量——同样的时间点，1-0 和 0-1 对应的胜率相差可以超过 60 个百分点。

The match is structured around key moments rather than continuous polling. At each trigger point, the system snapshots match state, runs Track A repricing, and updates the Pressure Index. Structural moments like hydration breaks and halftime are inferred from match time since there is no explicit event type for them in the data feed.

---

## 数据源与可靠性

**主要数据源**：ESPN API（比分、阵容、事件、盒子分统计），无需 key，有缓存。

**FIFA 官方 API**（`api.fifa.com/api/v3/`）：无需 key，无请求限制。提供真实阵型坐标（PositionX/Y）、换人事件、MatchStatus 状态码。FIFA 的 IdMatch 数字 ID 与第三方 26worldcup 数据完全一致，可直接关联。

**API-Football**：需要 key，免费 tier 100 次/天。用于获取历史 xG 数据，由定时任务每 24 小时拉取一次，存入本地 SQLite，不暴露给前端。

**数据优先级**：FIFA live API 优先（坐标精确），ESPN keyEvents 作为 fallback（事件覆盖广），worldcupjson.net 作为 ESPN 不稳定时的一级备用。

**透明度原则**：如果 xG 数据不足，置信区间会变宽，并在前端标注"数据有限"。阵容未公布时，首发不确定性会显式展示在预测旁边，而不是假装确定。

Data sources: ESPN API for live scores and events, FIFA official API for real formation coordinates and substitutions, API-Football for historical xG data loaded nightly, worldcupjson.net as an ESPN fallback. When data is insufficient, the confidence interval widens and the UI shows it explicitly rather than hiding the uncertainty.

---

## 预测系统常见问题

**为什么概率是一个区间而不是单一数字？**
因为足球预测存在根本性的不确定性：阵容可能到踢球前才公布，本届赛事样本量极小（每队只有 3 场小组赛），Elo 和 xG 两个信号有时会给出不同结论。区间宽度如实反映了这些不确定性——中等置信区间约 ±10%，低置信可达 ±15%。

**为什么盘中压力很大但胜率没有大幅变化？**
这是 Track A 和 Track B 分离设计的体现。Track A 只响应比分、时间、红牌这三个硬事实。压力指数（Track B）告诉你威胁在积累，但在这些威胁转化为进球之前，概率不会大幅移动。这是有意为之的——我们不想在未经验证的信号上过早移动概率。

**AI 会直接改变预测概率吗？**
不会。AI 处于"影子模式"：它可以读取比赛数据、生成教训、解释模型为什么这样判断，但不能直接输出概率数字或修改现有概率。只有通过回测验证的信号才能进入数学模型。

**Why does the win probability show a range instead of a single number?**
Football predictions have fundamental uncertainty: lineups may not be confirmed until kickoff, the sample size within a tournament is tiny, and the Elo and xG signals sometimes point in different directions. The interval honestly reflects this uncertainty — medium-confidence intervals are around plus or minus 10 percent.

**Why does high pressure not always move the win probability?**
Track A (probabilities) only responds to hard facts: score, time, and red cards. The Pressure Index (Track B) shows that threat is accumulating, but until that threat converts to a goal, the math does not move. This is intentional — we do not want to move probabilities on unvalidated signals.

**Does AI directly change prediction probabilities?**
No. The AI layer operates in shadow mode: it reads match data, generates lessons, and explains model reasoning, but cannot output probability numbers or modify existing probabilities. Only backtested signals can enter the mathematical model.
