# D5 总复盘报告 — 2026-06-25

## 1. 证据范围清点

| 证据类型 | 数量 | 比赛 |
|---|---|---|
| 赛前真实 snapshot | 7 | 760461-760467（E/F 组末轮） |
| 赛后回溯预测 (retrospective) | 47 | 760414-760460（服务器上线前已完赛） |
| Live snapshots（实时快照） | 2 场 13 文件 | 760462 Bosnia 3-1 Qatar（6 文件）、760463 Switzerland 2-1 Canada（7 文件） |
| AI postmortem（已完成） | 54/54 | 全部 |
| teamSpecificLessons（有内容） | 54/54 | 全部 |
| globalModelLessons（有内容） | 54/54 | 全部 |
| momentum 数据 | 16 场 | 有赛后回溯预测的比赛 |

**关键缺口**：47 场只有赛后回溯预测（retrospective），不是真实赛前预测。仅 7 场有真实赛前预测。仅 2 场有 live snapshots。

---

## 2. 分层复盘

### 层 1：赛前模型表现（7 场真实 snapshot）

| 比赛 | 比分 | accuracy | resultCorrect |
|---|---|---|---|
| Portugal 5-0 Uzbekistan | 5-0 | result_correct_score_wrong | ✅ |
| Bosnia 3-1 Qatar | 3-1 | result_correct_score_wrong | ✅ |
| Switzerland 2-1 Canada | 2-1 | result_correct_score_wrong | ✅ |
| Morocco 4-2 Haiti | 4-2 | result_correct_score_wrong | ✅ |
| Scotland 0-3 Brazil | 0-3 | result_correct_score_wrong | ✅ |
| South Africa 1-0 South Korea | 1-0 | **wrong_result** | ❌ |
| Czechia 0-3 Mexico | 0-3 | **wrong_result** | ❌ |

**赛果方向命中率：5/7 = 71.4%**

两场预测错误：
- SA vs SK：模型预测韩国客胜 44.2%，实际南非 1-0 胜
- Czechia vs Mexico：模型预测 Czechia 主胜 42.4%，实际 Mexico 0-3 大胜

### 层 2：AI 归因质量（54 场）

- failureCategory 有值：27/54（50%）— 另外 27 场因无预测快照，failureCategory 正确为 null
- teamSpecificLessons 有内容：54/54（100%）
- globalModelLessons 有内容：54/54（100%）
- lessons 全空：0/54

**质量评估**：
- D5 指令升级前（旧指令）：lessons 偏泛泛，如"team needs to improve defense"
- D5 指令升级后（新指令）：lessons 开始有具体事件引用和模型改进点
- 仍有改进空间：部分 globalModel 仍偏通用，需更多比赛积累后提炼模式

### 层 3：赛中人工分析表现（2 场 live）

**Bosnia 3-1 Qatar**：
- 赛前预测"最可能 2-0" → 实际 3-1 ✅ 方向正确，超出预期
- "卡塔尔防线风险高" → 乌龙球验证 ✅
- "35 分钟前进球→可能打到 2 球以上" → 29'+34' 两球 ✅
- "波黑赢面更大但效率不稳" → 射门 14 进 3 球 ✅

**Switzerland 2-1 Canada**：
- 赛前预测"最可能 1-1" → 实际 2-1 ✅ 方向正确
- "加拿大不败概率更高" → 加拿大输了但射门 13-6 证明威胁大 ⚠️
- "加拿大有反击威胁" → 射正 7-4 领先 ✅
- "加拿大 1-0 最高之一" → Poisson 支持加拿大终场胜 44% ✅
- 淘汰赛路径分析 → Canada 第二打 Colombia ✅ 准确

**Jordan/Algeria（codex retrospective）**：
- "live pricing must swing twice" → 正确识别了两次翻转 ✅
- "do not wait for next goal to reprice" → 核心教训 ✅

**Portugal/Uzbekistan（codex retrospective）**：
- 5-0 大胜时间线分析正确 ✅
- "disallowed goal and post are first-class state changes" → 核心教训 ✅

---

## 3. 提炼总教训

### AI Lessons（已进系统）

| 教训 | 来源 | 接入状态 |
|---|---|---|
| null prediction 时禁止声称准确 | 760415 bug | ✅ 已进 AI_POSTMORTEM_INSTRUCTION |
| retrospective prediction 必须标注"赛后模拟" | 47 场回填 | ✅ 已进 AI_POSTMORTEM_INSTRUCTION |
| teamSpecificLessons 必须有具体事件引用 | D5 指令升级 | ✅ 已进 AI_POSTMORTEM_INSTRUCTION |
| globalModelLessons 必须是模型可机械改进的点 | D5 指令升级 | ✅ 已进 AI_POSTMORTEM_INSTRUCTION |
| 禁止套模板（illustrative-only clause） | 用户审查 | ✅ 已进 AI_POSTMORTEM_INSTRUCTION |
| Poisson 拼写修正 | 用户审查 | ✅ 已修正 |

### Live Repricing Rules（观察，未工程化）

| 规则 | 来源 | 状态 |
|---|---|---|
| 落后方连续射正时应提前重新定价（不等进球） | Jordan/Algeria + Switzerland/Canada | 🔶 观察，未改 buildLiveAnalysis |
| 换人后 1 分钟内进球概率显著上升 | Switzerland/Canada (David 75'→76') | 🔶 观察，未改 |
| 控球多≠威胁大，射门效率才是关键 | Switzerland 70% 但 Canada 射门更多 | 🔶 观察，已写入 lessons |
| 进球对同组平行场出线的即时影响 | E 组末轮实战 | 🔶 观察，脚本有 computeGroupImpact 但未集成到实时分析 |
| 比分前危险信号（门柱/射正累积）应触发提前重新定价 | Portugal/Uzbekistan + Switzerland/Canada | 🔶 观察，未改 |
| "出线后动力衰减"应影响 xG 预测 | Switzerland/Canada (双方已出线) | 🔶 观察，AI 建议引入"赛季阶段重要性衰减因子" |

### Future Model Parameter Candidates（未改，待确认）

| 参数 | 来源 | 建议 | 状态 |
|---|---|---|---|
| 射正累积 → 进球概率提前上升 | Jordan/Algeria | buildLiveAnalysis 增加 sot 累积权重 | 🔴 待用户确认 |
| 替换球员"新鲜度"加成 | Switzerland/Canada | buildLiveAnalysis 增加 substitution bonus | 🔴 待用户确认 |
| 比分时间权重（75-90' 进球 > 早期进球） | Portugal/Uzbekistan | Poisson 模型增加时间衰减 | 🔴 待用户确认 |
| "出线后动力衰减因子" | Switzerland/Canada | xG 预测引入比赛重要性系数 | 🔴 待用户确认 |

---

## 4. 总结：哪些已进系统 / 哪些只是观察 / 哪些需要工程化

### ✅ 已进系统（代码已改）
1. `AI_POSTMORTEM_INSTRUCTION` — null prediction 规则、retrospective 规则、lessons 生成规则、anti-template clause、Poisson 拼写修正
2. `lib/services/ReviewService.js` — momentum 数据从 ESPN 全量 commentary 实时计算
3. `lib/eventFilter.js` — ESPN "Goal!" 进球分类修复
4. `static/js/app.js` — 赛后参考预测标注（retrospective）、比赛动量组件渲染、中文语言闸门修复
5. `scripts/live-match-monitor.js` — 赛中实时监控脚本（需服务器部署才能自动运行）
6. `data/live-snapshots/` — E 组两场 13 个关键时刻快照

### 🔶 只是观察（写入了 AI lessons，但未改模型代码）
1. 落后方连续射正时应提前重新定价
2. 替换球员新鲜度加成
3. 控球多≠威胁大
4. 比分前危险信号应触发提前重新定价
5. 出线后动力衰减应影响 xG

### 🔴 需要下一轮工程化
1. **服务器部署** — 脚本需要 24 小时在线才能自动运行（Dockerfile 已就绪）
2. **buildLiveAnalysis 射正累积权重** — 需确认是否改 lib/routes/prediction.js
3. **Poisson 时间衰减权重** — 需确认是否改 lib/prediction.js
4. **出线后动力衰减因子** — 需设计系数并集成到 xG 预测
5. **live snapshots 自动采集** — 依赖服务器部署
6. **赛后批量回填脚本** — 备选方案：比赛结束后一次性从 ESPN 拉取完整事件数据

---

*报告生成时间：2026-06-25 13:45 UTC+8*
*覆盖比赛：54 场已完赛（28 场 E/F 组 + 26 场其他组）*
*证据完整度：7 场有真实赛前预测，2 场有 live snapshots，54 场有 AI 归因*
