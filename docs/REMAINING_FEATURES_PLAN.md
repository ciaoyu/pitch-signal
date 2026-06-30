# PitchSignal 剩余功能实施计划

> 生成日期：2026-06-30  
> 当前状态：概率走势线（Track A 前端）已于本次 session 完成。

---

## 已完成（本 session 之前 + 今天）

| 功能 | 文件 |
|------|------|
| Track A 后端（盘中重定价） | `lib/live-reprice.js` |
| Pressure Index 后端 + 前端 | `lib/services/pressure-index.js`, `static/js/match-renderers.js` |
| Match Moments 引擎 | `lib/services/moment-detector.js`, `lib/jobs/moment-sync.js` |
| FIFA API 桥接 | `lib/services/fifa-api.js`, `scripts/build-fifa-match-bridge.js` |
| xG 框架（等 key） | `lib/services/xg-service.js`, `lib/jobs/xg-collector.js` |
| 置信区间输出 | `lib/prediction.js` → `calcConfidenceInterval()` |
| **概率走势线（Track A 前端）** | `static/js/match-renderers.js` → `renderLiveProbPanel()` |
| **三色胜率弧形** | `static/js/match-renderers.js` → `renderHudWinProbPanel()` 重设计 |

---

## 第一优先级：立即可做，价值最高

### 1. 小组出线晋级概率模拟（Group Qualification Simulator 前端）

**背景**  
后端 `QualificationSimulator`（`lib/qualification.js`）+ 路由 `GET /api/qualification-probabilities` 均已存在，10,000 次蒙特卡洛模拟每组出线概率。前端没有任何展示。

**需要做什么**

1. **新页面/新 Tab**：在 `积分 Table` 页或新增 `出线 Qualify` Tab，调用 `/api/qualification-probabilities`。
2. **前端渲染**：每个组显示一个"晋级概率"子表格，列出本组所有队伍的：
   - 第一名概率（蓝）
   - 第二名概率（绿）
   - 最佳第三名概率（黄，有概率进 16 强）
   - 出局概率（红）
3. **进度条样式**：横向堆叠色条，直观显示各队位置竞争。
4. **缓存**：API 已有 30 分钟缓存，无需额外处理。

**文件范围**
- 新增：`static/js/qualification.js`（渲染函数）
- 修改：`static/js/app.js`（注册新 Tab）或在 `templates/index.html` 加 HTML 容器
- 可选：`lib/qualification.js` 微调——返回各队"最佳第三名"概率（当前可能只返回 1/2 名）

**工作量**：约 1 天（纯前端，后端就绪）

---

### 2. venueFactor 修复（Bug）

**背景**  
`data/wc2026/venues.json` 里 venueFactor 字段存在，但 match ID bridge 里 `applied` 字段为 false，导致主场优势/场地因子没有进入 Poisson 预测。

**需要做什么**

1. 找到 `lib/prediction.js` 或 `lib/services/PredictionService.js` 里读取 venue 的逻辑。
2. 确认 `applied=false` 的原因——是没有找到匹配的场地，还是代码逻辑 gate 挡住了。
3. 打通 match_id → venue name → venueFactor 的查询链，让系数真正乘进 `λ_home`。
4. 写一个测试 `scripts/test-venue-factor.js` 验证某场比赛前后 λ 变化。

**工作量**：半天调试

---

### 3. 温度单位 Bug（°C/°F 显示问题）

**背景**  
天气面板硬编码 `°C` 但实际数据可能是 °F，导致显示错误。

**需要做什么**

在 `static/js/match-detail.js` → `renderMatchWeatherBlock()` 和 `renderHudVenuePanel()` 里统一处理：
- 如果数据是华氏度，转换为摄氏度；或
- 根据用户 `uiLang` 选择单位（EN 用 °F，ZH 用 °C）

**工作量**：1-2 小时

---

## 第二优先级：世界杯期间高价值

### 4. 换人影响追踪（Substitution Impact Tracker）

**背景**  
换人事件已捕获进 `match_moments`（type=`substitution_key`），但没有追踪换人后 xG slope 的变化。

**需要做什么**

**后端**（`lib/services/moment-detector.js` 或新建 `lib/services/substitution-impact.js`）
- 对每次换人，取换人前 N 分钟和后 N 分钟的 `match_live_stats` 快照
- 计算 Pressure Index 斜率变化（PI_before vs PI_after）
- 存入 `match_moments.raw_json` 的 `substitution_impact` 字段

**前端**（`static/js/match-renderers.js` → `renderBenchAnalysis()`）
- 已有替补席渲染，在换人条目旁显示 impact 箭头（↑ 改善 / ↓ 下降）

**工作量**：1.5 天（后端 1 天 + 前端 0.5 天）

---

### 5. PWA 推送通知（进球推送）

**背景**  
App 已有 PWA manifest（`static/manifest.json`），但 Service Worker 只做静态缓存，没有推送。

**需要做什么**

**后端**
1. 新增 `lib/services/push-service.js`：封装 Web Push 发送逻辑（用 `web-push` npm 包）
2. 新增路由 `POST /api/push/subscribe`：保存用户订阅对象到 SQLite `push_subscriptions` 表
3. 在 `moment-sync.js` 检测到 `goal` 类型的 moment 时，调用 `push-service.js` 向所有订阅者推送

**前端**
1. `static/sw.js`：注册 push handler，接收通知并显示
2. `static/js/app.js`：页面加载时请求推送权限，订阅并 POST 到后端

**依赖**：需要 VAPID key（用 `web-push generate-vapid-keys` 生成，存 Railway env）

**工作量**：2 天（后端 1.5 天 + 前端 0.5 天）

---

### 6. 淘汰赛对阵图交互增强

**背景**  
现有 bracket 是静态展示。点击某场比赛应该能直接打开该场的预测详情 HUD。

**需要做什么**

在 `static/js/` 里找到 bracket 渲染代码，给每场比赛容器加 `data-action="open-match-from-bracket" data-match-id="${matchId}"`。  
`app.js` 第 271 行已经有对应处理：`if (action === 'open-match-from-bracket') return window.openMatch(target.dataset.matchId);`

**可能缺失**：bracket 里的 matchId 需要和 ESPN 赛程的 id 对应，可能需要核实。

**工作量**：半天

---

## 第三优先级：数据驱动验证后才能上

### 7. Track B → Calibrated Probability（压力指数校准）

**原则**：压力指数目前只展示，不影响概率。只有通过回测验证后才能升级。

**验证流程（需要等世界杯数据积累后做）**

1. 从 `match_live_stats` 拉所有 `sustained_pressure_alert` 事件
2. 统计：alert 触发后 5/10/15 分钟内进球概率 vs 无 alert 时的 base rate
3. 如果 alert → 进球概率显著高于 base rate（建议 p < 0.05，样本量 ≥ 30），才允许 alert 给概率加权

**实现方式（通过验证后）**

修改 `lib/live-reprice.js`：在 `reprice()` 输入中加 `pressureSurge: boolean`，如果为 true 且通过验证，给 lambdaRemaining 加一个 calibrated 系数（不超过 +15%）。

**工作量**：验证分析 0.5 天 + 实现 0.5 天（需等数据）

---

### 8. 市场赔率 Benchmark

**背景**  
设计原则：赔率不是空权重填入，而是作为模型校准对比基准。当模型与市场分歧 > 阈值时，给用户 alert。

**需要做什么**

**后端**
1. 新建 `lib/services/odds-service.js`：从免费 Odds API 或 The Odds API（每月有限免费额度）拉取赔率
2. 转换为隐含概率（去除 vig）
3. 存入 `match_odds_benchmark` 表
4. 计算 `model_vs_market_delta`：当 `|model_prob - market_implied| > 0.08`，标记为 divergence

**前端**
在 `hud-winprob` 面板下方加一行小字："模型 vs 市场：+7% 分歧"，用黄色 alert 标注。

**依赖**：需要选一个赔率 API（The Odds API 有免费 tier）

**工作量**：2 天

---

### 9. 点球大战专项模型

**背景**  
现在的点球概率是对称假设（50/50 after ET ends in draw）。历史数据可以给每队打"点球能力"分。

**需要做什么**

1. 整理历史世界杯/重大赛事点球大战数据（每队点球命中率）
2. 新建 `data/penalty-shootout-stats.json`
3. 修改 `lib/live-reprice.js` 中的 `penaltyHomeWin` 计算：用队伍历史命中率代替 0.5

**工作量**：数据整理 1 天 + 实现 0.5 天

---

### 10. 阵容不确定性模型（Confidence Interval 动态收窄）

**背景**  
`calcConfidenceInterval()` 已有"阵容不确定性"因子，但目前是固定值（首发未知时 CI 最宽）。应该在首发公布后自动收窄。

**需要做什么**

1. `lib/jobs/lineups-sync.js` 已在开赛前 50 分钟同步首发
2. 修改 `lib/prediction.js`：读取 `pre_match_snapshots.has_confirmed_lineup` 字段
3. 如果 `has_confirmed_lineup=true`，CI 收窄系数从 1.4 降至 1.0

**工作量**：0.5 天

---

## 第四优先级：产品化 / 社交

### 11. Calibration 校准报告面板

**背景**  
这是与同类产品最大的差异化点——让用户看到"我们的预测是否被过度自信了"。

**需要做什么**

**后端**
1. 新建 `lib/backtest-calibration.js`：
   - 读取所有已完成比赛的赛前预测快照（`prediction_snapshots`）
   - 对比实际结果
   - 计算 Brier Score = (1/N) Σ (p_home - outcome_home)² + ...
   - 计算校准曲线：按概率分 10 个桶（0-10%, 10-20%, ...），统计每桶实际进球率
2. 新增路由 `GET /api/calibration-report`

**前端**
在"预测 Predict"页加"模型表现"子 Tab，展示：
- Brier Score（越低越好，随机模型 = 0.25，完美模型 = 0）
- 校准曲线 SVG 折线图（理想是对角线）
- 已预测比赛数 / 已完成比赛数 / 正确方向率

**工作量**：后端 1.5 天 + 前端 1 天

---

### 12. 用户预测 vs 模型对比

**背景**  
开赛前让用户下注自己的预测，赛后对比准确率。有社交传播属性。

**需要做什么**

**后端**
1. 新增 SQLite 表 `user_predictions`（session_id, match_id, home_win_vote, created_at）
2. 无需账号系统——用匿名 session（localStorage UUID）
3. 路由：`POST /api/user-predict`、`GET /api/user-predict/:matchId`（返回社区众筹概率）

**前端**
在比赛卡片（赛前状态）加三个按钮：主胜 / 平 / 客胜，点击后记录并显示"社区：52% 主胜"

**工作量**：1.5 天

---

## 已知 Bug 清单

| Bug | 文件 | 紧急度 |
|-----|------|--------|
| venueFactor applied=false | `lib/prediction.js` | 中 |
| 温度单位 °C/°F 显示 | `static/js/match-detail.js` | 低 |

---

## 分工建议

| 角色 | 适合承接的任务 |
|------|---------------|
| **后端 Node.js** | 7（Track B 校准）、8（赔率 API）、9（点球模型）、10（阵容 CI）、11（校准报告后端）、2（venueFactor 修复） |
| **前端 vanilla JS / SVG** | 1（晋级概率前端）、6（bracket 交互）、11（校准报告前端）、12（用户预测前端） |
| **全栈** | 5（PWA 推送）、4（换人影响追踪）、12（用户预测完整） |
| **数据/分析** | 7（Track B 回测验证）、9（点球历史数据整理） |

---

## 技术债

- `lib/botKnowledgeBase.js` — Bot Q&A 的知识库，可以加入晋级概率 + 赛事情境数据，让 Bot 回答更精准
- `data/matchup-rating/ratings.json` — 球员级别数据几乎为空，如果有数据源可以接入
