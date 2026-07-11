# PitchSignal 预测系统当前进度报告

**日期**：2026-07-11  
**审阅角色**：T0  统筹验收  
**范围**：各负责人独立 worktree 的实际提交、测试、artifact 与未提交状态。所有负责人分支目前均未合并、未推送、未部署。

## 一、当前总判断

系统已经完成 P0 生产概率安全隔离和研究审计基础设施建设，但还没有进入 learned core 或正式投稿稿件冻结阶段。

当前最重要的事实是：

- 公开赛前主概率已被限定为签名的 Elo + Poisson v4；
- 外部赔率、Polymarket、环境、教练、球员和首发信号不得改变公开概率；
- 研究数据已经开始产生真实 shadow 证据，但多数信号尚无稳定 OOS 增益；
- 2026 真实线上指标仍不能与固定模型版本绑定时，不得对外宣称为当前模型 OOS；
- E v2 已正式提交并通过验收：`7564923`；固定 seed、届次 cluster bootstrap、VIF 和 cross sensitivity 已冻结。

## 二、负责人状态矩阵

| 负责人 | 当前 HEAD / 基线 | 阶段状态 | T0 结论 | 仍需做什么 |
|---|---|---|---|---|
| A | `78da1b5` / 基于 A v4 | P0 概率隔离 | 通过 | 等研究证据后再启动 learned core；继续保持单人串行修改核心模型 |
| B | `4900f49` / `78da1b5` | 不可变账本与 legacy 隔离 | 通过 | 维护 verified/legacy 账本，导出真实前瞻快照 |
| C | `33e278d` | 实时路径统一 | 通过 | 继续运行 canonical `live-reprice`，监控真实事件接线 |
| D | `23924d2` / `78da1b5` | 964 场 artifact、校准、paired delta | 通过当前阶段 | 等 verified 2026 ledger；后续统一 E/F/G/H research-input audit |
| E | `7564923` / `78da1b5` | 49k 数据采集 + 真实 OOS | 通过 | 保持 shadow；若取得历史海拔/WBGT，再用同一流程重估 |
| F | `abd0618` / `78da1b5` | 球员、首发、事件、停赛真实数据审计 | 通过 | shadow 运行；xG 仍 blocked，不进入公开概率 |
| G | `1cd823c`，含 3 场真实 OPENING_LINE | 赔率 shadow ledger 与生产采集 | 代码与首轮真实采集通过 | 继续采集 T-24、首发后、临场；比赛结束后才计算真实 OOS |
| H | `1c9586b` / `78da1b5` | 教练覆盖审计与研究框架 | 通过框架阶段 | 外部任期史、国际赛果和 xG 接入后再实现真实教练 OOS |
| I | 尚未启动 | 投稿稿件与声明 | 未开始 | 等核心证据边界稳定后写 manuscript v2；事实章节可以先准备 |

## 三、已完成且可依赖的证据

### 1. 公开概率安全边界

A v4 已完成以下隔离：

- `activeSignals = ['elo', 'poisson']`；
- Coach、容量 Venue、手工 KO λ 收缩退出主概率；
- 世界杯名义主客队不自动产生主场优势；
- 淘汰赛拆分 `regulation` 与 `advance`，晋级先验不混入主概率；
- odds、market value、continental、Polymarket 均进入 candidate/shadow，`usedInModel:false`；
- Polymarket 注入前后公开概率逐位不变。

### 2. 研究 Artifact

D 已生成：

- 964 场逐场历史回放 CSV；
- classwise calibration；
- Uniform 与 Historical Frequency 配对比较；
- 固定 seed、赛事 cluster、双侧 CI/p 值；
- 研究域与线上前瞻域分离；
- 无 verified 2026 ledger 时输出 `unverified/null`。

当前可引用的历史回放结果为 **1930–2022、964 场**：

- Accuracy：57.57%；
- Brier：0.5702；
- LogLoss：0.9662。

这不是 2026 年当时真实公开预测，也不能证明完整生产系统无缺陷。

### 3. F 的真实 shadow 数据

F v2 当前已验证：

- 75 场首发记录，74 场完整 11v11；
- 1,179 / 1,245 球员 ID 匹配，94.7%；
- 457 条球员事件，83 场 officials；
- `espnToFifa` 104/104，null rate 0%；
- SHA-256 与 data cutoff 已记录；
- `team_xg_stats = 0`，xG 仍 blocked/shadow-only。

这些数据可以展示和 shadow 运行，但尚未通过 OOS，不得进入公开概率。

### 4. G 的真实赔率数据

G 已归档 3 场真实 `OPENING_LINE` 快照：

- Argentina vs Switzerland；
- Norway vs England；
- Spain vs Belgium。

审计结果：

- `coveredRaw = 3`；
- `asOfEligible = 3`；
- `excludedLeakage = 0`；
- `rawResponseHashAudit.verifiedSnapshots = 3`；
- `outOfSampleBenchmark = null`。

当前只有赔率快照，没有完整的赛后结果关联，因此不能宣称市场或 Shin 的 OOS 优势。

## 四、当前真实阻塞

1. **G 真实样本仍少**：已有 3 场开盘快照，仍需采集其他里程碑并等待比赛结束。
2. **2026 verified prospective ledger 尚未形成完整固定版本证据**：早期的 Brier 0.5059 / ECE 0.1563 不得当作当前固定模型 OOS。
3. **F 的 xG 不可用**：API-Football 免费层未提供可用 xG 字段，当前保持 blocked。
4. **H 没有研究级教练任期史**：仓库内教练数据仍是展示级中文关键词，研究覆盖率为 0%。
5. **I 尚未开始**：投稿稿件、图表、数据声明和 AI disclosure 尚未形成最终稿。

## 五、下一步执行顺序

### P0：冻结并消费 E v2 结果

- 以 `7564923` 的 `oos-report.json` 作为环境研究基线；
- 保持 `enterModel:false` / `usedInModel:false`；
- 将 E 的无稳定增益结论纳入 D/I 的研究输入清单；
- 只有取得历史海拔/WBGT 覆盖后，才允许按同一 OOS 流程重估。

### P1：继续 G 真实采集

- 运行 T-24、LINEUP_ANNOUNCED、PRE_KICKOFF；
- 每场保存 milestone、as-of、rawResponseSha256；
- 赛后将赔率快照连接到 verified A v4 赛前预测和实际结果；
- 样本不足前继续 `outOfSampleBenchmark:null`。

### P2：继续 F/H 数据积累

- F：首发、事件、停赛继续 shadow；xG 只记录 blocked 状态或接入合规替代源；
- H：取得任期起止日期、来源和国家队比赛映射；不恢复中文关键词概率模型。

### P3：启动 A learned core

只有在 E v2 提交、D/B/C 契约稳定后，才由单一负责人在独立 worktree 串行设计：

```text
赛前实力先验
  -> 动态进球强度
  -> 通过 OOS 的上下文协变量
  -> 概率校准
  -> 受约束的学习型融合
```

尚未通过 OOS 的信号不进入 learned core 的生产权重。

## 六、最终当前状态

当前系统可以诚实地描述为：

> 一个公开概率已完成 P0 隔离、拥有不可变研究账本、支持实时 canonical repricing、正在积累真实 shadow 数据，并对环境/球员/赔率/教练信号实施证据闸门的预测系统。

还不能描述为：

> 所有信息源都已经融入并被历史验证的完整学习型预测系统。
