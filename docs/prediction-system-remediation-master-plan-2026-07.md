# PitchSignal 预测系统整改与投稿准备总控计划

> 版本：2026-07-10  
> 角色：总控/派工文档，不直接修改业务代码  
> 实施基线：以 `/Users/zbbb/Documents/Projects/pitch-signal-main` 的最新经确认 `main` SHA 为准；本文编写时可见 HEAD 为 `d93cf8e`，但主仓仍有未提交前端改动，因此正式创建新 worktree 前必须重新钉死 `BASE_SHA`。

## 1. 目标与不可妥协的原则

本计划同时解决四类问题：

1. 立即隔离会制造假精度的生产规则；
2. 补齐预测账本、历史回填、实时接线和可复现评估；
3. 用可估计、可审计的统一模型替代手工概率加减；
4. 为未来论文建立“数据来源—公式—实验—结论”完整证据链。

共同红线：

- 没有数据的信号直接缺席，不生成 `0.33/0.34/0.33` 伪信号；
- 没有经过时间外 OOS 验证的系数，不得改变公开概率；
- 可以展示有趣但未验证的事实或假设，但必须显示来源、覆盖率、证据等级和 `usedInModel:false`；
- 不以“把准确率调到 60%”为目标；所有实验预先登记目标和验收指标；
- 每条公开预测必须绑定不可变模型版本、配置哈希、代码 SHA、输入数据版本和生成时间；
- 90 分钟赛果概率和最终晋级概率永远分开；
- 不覆盖、不伪造开赛前缺失的预测；回放结果必须进入独立的 retrospective 数据集；
- 未经用户逐次确认，不 push、不合并到主仓、不部署 Railway。

## 2. 当前事实与P0风险

### 2.1 两套评估数据必须分开

- **2026 线上运行证据**：当前生产校准接口有 43 场有效赛前快照，方向命中 27/43 = 62.79%，三分类求和 Brier = 0.5059，top-label ECE = 0.1563。它们都是本届世界杯的线上预测结果，但快照没有强制不可变模型版本，因此只能称为“线上服务截至当前的运行表现”，不能称为“今天这版固定公式的表现”。
- **1930–2022 历史回放**：964 场、方向准确率 57.88%、Brier 0.5708、LogLoss 0.9644。它是回放实验，不是 2026 真实公开预测，也不能证明所有生产信号有效。

### 2.2 已经进入主仓、必须先隔离的规则

1. 名义 `home` 队同时可能获得 Elo `+100`、Poisson `×1.2`、容量场地加成；世界杯中立场语义错误。
2. Coach 由任期常数和中文风格关键词生成，缺数据仍有 `confidence=0.30`，生产中可占 22.5%。
3. Venue 概率头把场馆容量转成主队优势，与真实环境适应概念无关。
4. KO-3 已把轮次传入 `PoissonModel`，激活 R16/QF/SF/F 的手工 λ 收缩 `0.90/0.87/0.83/0.80`。
5. KO-5 已合并进主仓，以手工 `weight=0.04`、分量权重和 `maxTilt=0.025` 改变淘汰赛概率。
6. `calcConfidenceInterval` 与 `outputMeta.confidence` 是两套手工启发式，却使用相近名称。
7. 前端实时概率请求没有完整传递红牌和 `isKnockout`；旧 `buildLiveAnalysis` 仍可调用并使用另一套手工概率平移。
8. xG、lineup、odds 的采集或展示存在，但未形成一致、可验证的主概率接线。

### 2.3 KO 工作的重新裁决

- KO-1/2/4/6/7/8a/9/10/11/12/13/14/15 可保留为数据、情报卡、Bot 或赛后分析，但逐项核验 `usedInModel:false` 与数据来源。
- KO-3 保留“轮次识别和API语义”，暂停未经估计的 λ 收缩进入公开概率。
- KO-5 保留休息日、旅行、加时分钟等原始事实和展示，暂停手工 fatigue score/weight/tilt 进入概率。
- KO-7/8 点球数据可展示；在点球模型未以历史逐轮数据估计前，不能用手工边界改变晋级概率。
- “964 场已经证明 DC 和淘汰赛参数可以结案”作废。DC、淘汰赛收缩、Elo/Poisson混合、主场参数均重新进入参数审计。

## 3. 执行波次与依赖

```text
Wave 0  钉死基线 + 冲突审计
   ↓
Wave 1  生产安全隔离 ── 预测账本/回填 ── 实时接线修复
   ↓                   ↓
Wave 2  评估基础设施 + 环境/球员/xG/赔率/教练数据研究
   ↓
Wave 3  动态进球强度模型 + 学习型融合 + 真实不确定性
   ↓
Wave 4  前瞻 shadow、生产验收、论文 artifact 与正文
```

Wave 1 的三个实现分支可以并行，但必须遵守文件所有权；Wave 3 的核心模型只能由一个负责人串行整合，禁止多人同时修改 `lib/prediction.js`、`lib/poisson.js`、`lib/elo.js` 和 `PredictionService.js`。

## 4. Worktree与全局工作规约

正式派工前，由总控在主仓执行只读检查：

```bash
git -C /Users/zbbb/Documents/Projects/pitch-signal-main status --short
git -C /Users/zbbb/Documents/Projects/pitch-signal-main log -1 --oneline
git -C /Users/zbbb/Documents/Projects/pitch-signal-main worktree list
```

确认用户现有未提交改动已由原负责人处理后，记录：

```text
BASE_SHA=<经用户确认的 main SHA>
BASE_TEST=<npm test 的 suite/assert 结果>
BASE_BACKTEST=<默认回测输出及 artifact hash>
```

新 worktree 统一放在：

```text
/Users/zbbb/Documents/Projects/pitch-signal-worktrees/<task>
```

创建模板（把任务名替换为各负责人卡片中的 branch/worktree）：

```bash
git -C /Users/zbbb/Documents/Projects/pitch-signal-main worktree add \
  -b codex/<branch-name> \
  /Users/zbbb/Documents/Projects/pitch-signal-worktrees/<task> \
  <BASE_SHA>
```

统一规则：

- 分支使用 `codex/` 前缀；
- 每个 worktree 只能修改任务卡允许的文件；
- 不借机格式化无关文件；
- 每个分支提交独立验收报告 `docs/acceptance/<task>.md`；
- 实验失败也要提交结果和 artifact，不以“没有提升”为任务失败；
- 所有模型比较使用相同比赛、相同数据截点和 paired/clustered delta；
- 合并顺序由总控控制，不允许实现者自行合并或部署。

## 5. 分工卡

### 总控 T0：基线、冲突、验收与合并裁决

总控不写模型业务代码。负责钉死 `BASE_SHA`，确认主仓两处未提交前端改动归属，维护文件所有权矩阵，审核每个分支是否使用了未来信息，复跑测试和 artifact，最终决定通过、打回或降级为展示项。总控还要维护一份决策台账：每个信号的来源、覆盖、公式版本、OOS结果、是否入模、何时退出。总控工作目录使用当前规划仓，不再创建业务 worktree。

验收：任何分支在没有模型版本、数据截点、逐场输出和对照基线时不得合并；任何 push/Railway 部署必须单独询问用户。

### 负责人 A：生产概率安全隔离与目标语义

第一阶段 worktree：`pitch-signal-worktrees/prediction-p0-quarantine`；分支：`codex/prediction-p0-quarantine`。A 是 Wave 1 唯一允许修改赛前核心概率文件的人。任务是让 Coach、容量 Venue、手工 Fatigue 退出主概率；缺失信号从数组中缺席；世界杯名义 home 不再获得 Elo/Poisson/场地三重加成，只在“球队国家=场馆国家”时建立东道主事实标记；保留 KO 轮次元数据但隔离手工 λ 收缩；将淘汰赛响应拆成 `regulation` 与 `advance`。A 不负责研究新系数、不接 xG/赔率、不设计前端情报卡。

建议文件边界：`lib/elo.js`、`lib/poisson.js`、`lib/prediction.js`、`lib/services/PredictionService.js`、`lib/knockoutStage.js`及专属测试。不得修改回测导出、数据库和 live UI。

验收：

- 世界杯中立场 fixture 对调 home/away 后，不因数据顺序获得主场加成；
- 美国/加拿大/墨西哥仅在本国场馆得到 host 标记；
- API `components` 中没有伪 Coach、容量 Venue、手工 Fatigue 的非零权重；
- KO 90分钟 H/D/A 与最终晋级 H/A 分开且各自归一；
- 小组赛和淘汰赛均有fixture测试；
- `npm test` 全绿；新版本必须改变 `model_version/config_hash`，不得继续冒充旧模型。

### 负责人 B：不可变预测账本、校准口径与历史回填

worktree：`pitch-signal-worktrees/prediction-ledger-backfill`；分支：`codex/prediction-ledger-backfill`。B 负责解决“为什么只有43条、为什么moment概率为空、历史如何补”的数据治理问题。扩展赛前快照，保存模型版本、commit SHA、config hash、输入数据版本、生成时间、目标语义；将真正赛前预测、赛后复盘、retrospective replay彻底分表或强字段隔离；扫描 Railway/本地SQLite/旧artifact/页面缓存可恢复记录；无法恢复的标为 `pre_missed`，绝不伪造。对已有比赛补齐事实事件和实时统计，但只有存在真实赛前基线时才生成“真实历史live曲线”；重建曲线必须标为 retrospective。

建议文件边界：`lib/db.js`、`lib/postMatchReview.js`、`lib/match-snapshot-scheduler.js`、`lib/backtest-calibration.js`、`scripts/*snapshot*`、`scripts/*backfill*`及迁移测试。不得修改概率公式和前端展示。

验收：

- 任何预测记录可回答“何时、哪版模型、哪些输入、预测什么目标”；
- 校准接口可以按固定模型版本筛选，不再混合不同模型；
- 回填报告列出 recovered / retrospective / irrecoverable 数量；
- 已错过的赛前预测不会进入 prospective 准确率；
- 重跑回填幂等；数据库迁移兼容现有生产数据；
- 至少抽查三场：有真实快照、有retrospective、完全缺失各一场。

### 负责人 C：统一实时概率路径与接线修复

worktree：`pitch-signal-worktrees/live-probability-unification`；分支：`codex/live-probability-unification`。C 负责解决“代码做了但没有传”和旧路径遗留。第一阶段只做语义统一：主前端完整传入比分、时间、补时、红牌、淘汰赛状态；后台 moment 写入使用同一契约；公开 `POST /api/predict-live` 下线或改为兼容层并内部转到唯一引擎；`buildLiveAnalysis` 和 standalone monitor 的手工概率平移不再作为公共概率来源。C 不在此分支发明新的红牌、时间、xG系数。

建议文件边界：`lib/routes/prediction.js`、`lib/live-reprice.js`的接口层、`lib/jobs/moment-sync.js`、`static/js/match-detail.js`、`static/js/match-renderers.js`、`scripts/live-match-monitor.js`及专属测试。不得修改赛前融合核心。

验收：

- 红牌和 `isKnockout` 从比赛事实到UI请求到API计算端到端可证明；
- 主前端、moment-sync、monitor 对同一fixture得到同一概率；
- 无公开路径再用射门/控球的手工常数平移H/D/A；
- 缺真实赛前快照时明确返回 unavailable 或 retrospective，不静默现算冒充赛前；
- 淘汰赛界面同时显示90分钟赛果和晋级概率；
- focused tests + `npm test` + 浏览器fixture验收。

### 负责人 D：研究artifact、分项校准与统计检验

worktree：`pitch-signal-worktrees/research-artifacts-v2`；分支：`codex/research-artifacts-v2`。D 不改模型，只建设公平比较平台。输出964场逐场预测、2026 prospective ledger、固定seed、classwise calibration、Brier/LogLoss/RPS/Accuracy、模型版本分层、按届cluster bootstrap、消融和paired deltas。D 必须明确：Brier 0.5059、ECE 0.1563属于当前43场2026线上样本；Brier 0.5708属于964场历史回放，二者不可混写。

建议文件边界：`lib/backtest.js`、新建 `lib/research/*`、`scripts/run-backtest.js`、`scripts/research-*`、`outputs/research`生成规范和研究测试。不得修改默认模型参数。

验收：

- 同一seed重复运行产生相同机器可读结果；
- `backtest-predictions.csv` 964行并含 `elo_diff/is_knockout/model_version/data_cutoff`；
- calibration文件含每类、每箱样本数；
- paired结果以赛事为cluster，报告delta及区间，不用“两个CI重叠”代替配对检验；
- 所有artifact附数据许可、命令、hash和失败说明。

### 负责人 E：环境、旅行和休息数据研究

worktree：`pitch-signal-worktrees/environment-research`；分支：`codex/environment-research`。E 只做数据和研究，不触碰生产概率。先画DAG，明确海拔、WBGT、草坪、旅行、时区、休息、加时之间的因果与共线关系；审计49k国际比赛中可用覆盖年份；第一版使用球队近期比赛级暴露代理，数据足够后再升级为球员分钟级暴露；在更大的国际比赛池估计环境效应，世界杯保持held-out。特征必须对双方对称进入进攻/防守或λ差，不能只惩罚一边。

建议文件边界：新建 `docs/research/environment-*`、`data/research/environment-*`、`scripts/research-environment-*`、数据manifest。不得修改 `lib/prediction.js` 或任何公开API。

验收：

- 明确变量可用起始年份、覆盖率和缺失机制；
- 提交DAG、数据字典、来源/许可、泄漏审计；
- 报告球队级代理与球员级目标方案；
- 使用强正则化/贝叶斯层级候选并报告共线性诊断；
- 输出候选系数的OOS分布，而不是给生产常数；
- 数据不足也算完成，但必须给出可展示事实与不能入模的边界。

### 负责人 F：球员、首发、可用性和xG研究

worktree：`pitch-signal-worktrees/player-lineup-xg-research`；分支：`codex/player-lineup-xg-research`。F 的优先级高于教练研究。先打通球队/球员/比赛/阵容ID桥，定义开赛前可用的伤停、预计首发、正式首发、出场分钟、近期状态和shot-xG；首发公布前采用阵容情景混合，公布后使用真实XI。免费xG先审计StatsBomb开放赛事和现有API-Football数据；无法得到射门坐标时只能称为射正/禁区射门代理，不能伪称xG。第一阶段全部shadow，不进入公开概率。

验收：

- 每个球员特征有as-of时间，杜绝赛后信息进入赛前预测；
- 明确“首发未知”不是 uncertainty=0；
- 输出数据覆盖、ID匹配率、缺阵/回归抽查和历史可回放年份；
- 自建xG必须有训练/验证划分和校准结果；
- 候选信号对Elo/基础λ的增量用OOS评估，不以相关性代替预测增益。

### 负责人 G：赔率采集、归档和shadow benchmark

worktree：`pitch-signal-worktrees/market-shadow-ledger`；分支：`codex/market-shadow-ledger`。G 负责停止当前每5分钟、双区域、三市场的无差别额度消耗；保存开盘、24小时、首发后、临场等有限关键快照；永久保存原始响应、庄家、市场、时间和去水方法；历史赔率只作独立benchmark，进入生产融合必须等待学习型融合和OOS证据。G 不修改核心概率权重。

验收：

- API额度预算和调用频率可配置、可观测；
- 不再只保留最后200条并丢弃长期历史；
- 同一快照可复算比例去水/Shin去水结果；
- shadow报告逐场比较模型与市场，但公开主概率不变；
- quota耗尽时降级透明、任务健康状态准确。

### 负责人 H：教练历史与教练增值研究

worktree：`pitch-signal-worktrees/coach-effect-research`；分支：`codex/coach-effect-research`。H 不恢复当前中文关键词模型。建立带任职起止时间的国家队教练历史，纳入预选赛、洲际杯和友谊赛；控制球队实力、球员质量、对手、赛事和场地后，估计相对预期进球/xG残差；使用分层收缩，短任期向总体均值收缩。战术风格只能来自阵型、压迫、推进、换人等可观察行为。该任务排在F之后，数据不足时只保留事实展示。

验收：

- 任职记录有来源和有效时间区间；
- 不解析中文形容词生成概率；
- 教练效应报告后验/采样分布和OOS增量；
- 与球员更替、换帅选择偏差的共线性有明确处理；
- 未通过OOS时维持 `usedInModel:false`。

### 负责人 I：投稿方法论、声明和图表

worktree：`pitch-signal-worktrees/research-manuscript-v2`；分支：`codex/research-manuscript-v2`。I 只写研究材料，不改代码和结果。论文采用一篇、两层贡献：第一层是可复现的概率核心及其历史/前瞻评估；第二层是允许事实与有趣假设展示、但严格隔离未验证信号的治理架构。I 必须纠正“57.88%证明模型无缺陷”“DC已经结案”“所有信号属于同一实证模型”等旧表述。

验收：

- 每个数字能追溯到artifact和模型版本；
- 2026与历史回放指标分表；
- Methods明确哪些信号 validated / shadow / display-only / hypothesis；
- 包含数据、代码、伦理、AI使用、博彩市场和利益冲突声明；
- 图表至少包含系统分层、泄漏防护、校准、消融/paired delta、2026前瞻账本。

## 6. Wave 3：统一动态模型与学习型融合

Wave 1、B、D至少完成后，负责人A开启第二个串行worktree：

```text
worktree: pitch-signal-worktrees/prediction-learned-core
branch:   codex/prediction-learned-core
```

目标不是继续添加第八、第九个独立概率头，而是形成：

```text
赛前实力先验
  -> 动态进球强度/双变量进球模型
  -> 可用且通过验证的上下文协变量
  -> 概率校准
  -> constrained log-opinion pool（仅对真正独立的概率源）
```

实时层以比分、时间、红牌、淘汰赛状态为骨架，使用历史事件数据估计非均匀时间、比分状态、红牌及交互效应；xG、射门质量、换人和阵容作为未来进球强度的协变量。旧手工概率加减不迁移。

融合层约束：

- `w_s >= 0`；
- 权重由rolling OOS学习；
- Elastic Net或贝叶斯收缩；
- 缺失信号缺席；非随机缺失仅在OOS证明后加入missingness特征；
- 偏置正则化或和为零；
- 报告权重稳定区间；
- 市场赔率先shadow；
- 2026已发生比赛不得反复调参后再宣称是锁定测试。

验收：预注册公式和数据截点；与简单Elo、基础Poisson、历史频率、市场基准同场比较；按届cluster bootstrap；LogLoss/Brier为主，Accuracy为次；模型失败区间和负结果完整公开。

## 7. 合并顺序和冲突矩阵

推荐顺序：

1. A P0隔离（最高优先，不等待研究任务；先停止手工信号继续污染公开概率）；
2. B 账本/迁移（随后把隔离后的干净版本纳入不可变版本契约；B 可与A并行开发）；
3. C 实时路径统一；
4. D artifact v2；
5. E/F/G/H 数据研究，可并行；
6. A learned core；
7. I manuscript v2。

文件所有权：

| 文件/区域 | 唯一负责人 | 其他人规则 |
|---|---|---|
| `lib/prediction.js`, `lib/elo.js`, `lib/poisson.js`, `PredictionService.js` | A | 其他分支不得修改 |
| `lib/db.js`, snapshots/postmatch/backfill | B | D只读消费契约 |
| live routes/reprice/moment-sync/match live UI | C | A不碰实时UI |
| backtest/research artifact | D | A只通过稳定接口提供候选 |
| environment research files | E | 不碰生产 |
| player/lineup/xG research files | F | 不碰生产 |
| odds collector/shadow ledger | G | 不碰融合 |
| coach research files | H | 不碰生产 |
| manuscript/submission docs | I | 不改结果数据 |

如果某任务必须跨界修改，由总控先调整边界或排为依赖合并后的后续commit，禁止两个worktree自行解决冲突。

## 8. 总验收清单

每个任务必须交付一段可直接审阅的结论：做了什么、没有做什么、数据覆盖多少、失败在哪里、哪些数字改变、为何允许改变。

最低验收：

```text
[ ] branch从确认的BASE_SHA派生
[ ] diff只包含允许文件
[ ] focused tests通过
[ ] npm test通过
[ ] 模型任务有逐场artifact与paired delta
[ ] 数据任务有manifest/as-of/source/license/coverage
[ ] UI任务有中英与缺失态验证
[ ] 不把retrospective当prospective
[ ] 不把display-only写成usedInModel
[ ] 不把手工区间叫95% CI
[ ] 没有未授权push/merge/deploy
```

## 9. 完成定义

整改完成不是“网站能返回一个概率”，而是任何一场比赛都能回答：

1. 概率预测的目标是什么；
2. 使用了哪些事实和模型；
3. 哪些有趣信息仅展示、没有入模；
4. 参数从什么数据估计；
5. 该版本在什么OOS样本上表现如何；
6. 不确定性和缺失数据如何表达；
7. 结果能否由第三方从artifact复现。
