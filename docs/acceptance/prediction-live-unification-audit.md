# C 负责人：实时概率路径与接线 — 现状审计报告

> 审计日期：2026-07-10 20:41
> BASE_SHA: 4900f49
> 分支：codex/prediction-live-unification
> Worktree：/Users/zbbb/Documents/Projects/pitch-signal-worktrees/prediction-live-unification
> **状态：只读审计，未修改代码**

---

## 0. 执行摘要

系统有 **3 条实时概率路径**，其中只有 1 条是公开路径且使用正确公式，其余 2 条各用一套独立且不可互导的手工概率公式。此外，`buildLiveAnalysis` 在 3 个位置同时存在 2 个独立实现，且共享同一函数名。前端调用 `GET /api/match/:id/live-probability` 时 **未传入红牌和 isKnockout**，导致 Track A 的两个核心输入在公开路径断裂。淘汰赛界面不展示 regulation/advance 分离。`renderLiveProbPanel` 不理解 `homeWinAfterET` 等字段。

---

## 1. 三条实时概率路径详细审计

### 路径 A（Track A，当前唯一公开路径）✅ 公式正确 | ❌ 前端欠入参

```
前端 match-detail.js → GET /api/match/:id/live-probability
  → 路由 routes/prediction.js
    → 从 prediction_snapshots 取赛前 λ
    → 调用 live-reprice.reprice()
    → 返回 { preMatch, current(liveProb), curve, liveState, score }
  → 前端 renderLiveProbPanel() 渲染到 HUD
```

**公式**：`lib/live-reprice.js` — 纯数学：剩余时间 × Poisson 矩阵 + 红牌衰减 `0.72^n` + KO 加时 + 点球分解

**✅ 做对的**：
- `reprice()` 不接受 shots/possession/cards/odds 等软信号（已验证 convergence 测试）
- `source: 'live_reprice'` 明确标记
- 红牌指数衰减 `RED_CARD_LAMBDA_FACTOR = 0.72`
- 淘汰赛 90→120→点球三层分解：`homeWin/draw/awayWin`（90min）+ `homeWinAfterET/awayWinAfterET` + `penaltyHomeWin/penaltyAwayWin`
- `repriceExtraTime()` 独立计算加时 λ
- W1-B fix：`timeRatio` 已 cap 到 1.0 防止长补时 λ 膨胀
- `moment-sync.js` 在 persist 时也调用同一 `reprice()`

**❌ 断裂点**：
1. 前端 `match-detail.js` L284-298 **不传 `homeRed/awayRed/isKnockout`** — 仅传 `homeScore/awayScore/minute/state/statusName/displayClock/hasPenalties`
2. 因此即使 `moment-sync` 里有 `homeRedCards/awayRedCards/isKnockout`（L199-201），它们在 API GET 路径截断
3. `renderLiveProbPanel` 只渲染 `preMatch.homeWin/draw/awayWin` + `current.homeWin/draw/awayWin`，**不渲染 `homeWinAfterET/penaltyHomeWin` 等 KO 分裂字段**
4. 淘汰赛界面无 regulation vs advance 视觉分离
5. 缺赛前快照时 fallback 到实时计算 `predictMatch()` 的结果，但没有标记为 `retrospective`

---

### 路径 B（buildLiveAnalysis，旧路径，仍在运行）❌ 公式冲突 | 公开调用已 admin-gate

```
前端不再调用 → POST /api/predict-live/:matchId → predictionService.predictLive()
  → buildLiveAnalysis(basePrediction, matchMeta, liveStats, externalOdds)
```

**端点状态**：
- `POST /api/predict-live/:matchId` 已被 `checkAdminAuth` 保护 ✅
- 公开 beta 无 `WRITE_API_TOKEN` → 外部调用者收到 403 ✅
- admin 带 Bearer token → 200 ✅
- 前端代码中无对该端点的调用 ✅

**公式（lib/services/PredictionService.js L505-632）**：
```
homeEdge = scoreDiff * (0.16 + 0.20 * timeFactor)
         + clamp(shotDiff, -8, 8) * 0.008
         + clamp(sotDiff, -5, 5) * 0.03
         + clamp(possessionDiff, -0.7, 0.7) * 0.10
         + clamp(awayYellows - homeYellows, -3, 3) * 0.01
         + clamp(awayReds - homeReds, -1, 1) * 0.18
         + (marketHome - marketAway) * 0.12   // if externalOdds present
adjustedHome = baseHome + homeEdge
adjustedAway = baseAway - homeEdge * 0.82
adjustedDraw = baseDraw - abs(homeEdge) * 0.45
// + 手动 scoreDiff/min 对 draw 的硬编码修正
// normalizeThreeWay
```

**问题**：
1. **手工概率加法** — 射门×0.008、射正×0.03、控球率×0.10、黄牌×0.01 全是未经验证的魔法数字
2. **与 Track A 不可互导** — 即使给同一输入，`buildLiveAnalysis` 和 `reprice()` 返回完全不同的概率
3. 不接受 `isKnockout` 参数 → 淘汰赛 draw 如何处理？直接吞掉 draw 份额但不揭示 ET/点球分解
4. `externalOdds` 二次加权 → 如果传入赔率，再加 `(marketHome-marketAway) * 0.12`
5. 虽有 `homeRedCards/awayRedCards` 入参，但只按 `(awayReds-homeReds) * 0.18 * 0.82` 线性平移到 away，与 Track A 的 λ 衰减 `0.72^n` 完全不同
6. `likelyScorelines` 手拼推测，不是数学推导

**结论**：已 admin-gate ✅，但函数本身仍作为 `PredictionService.buildLiveAnalysis` + `predictLive()` 存在于生产代码中 → 需要在 Wave 1 清理为兼容层或标记 deprecated。

---

### 路径 C（standalone monitor 的独立 buildLiveAnalysis）❌ 独立副本

```
scripts/live-match-monitor.js
  → 自含 buildLiveAnalysis()（L169-230）
  → 与 PredictionService.buildLiveAnalysis 代码结构相同、系数略微不同
  → 写入 data/live-snapshots/ 和 postMatchReview
```

**问题**：
1. 这是一个**独立复制**的 `buildLiveAnalysis` — 如果主服务修改公式，monitor 不会同步
2. 触发逻辑与 `moment-sync` 独立（每 5min poll ESPN scoreboard），不读 `match_moments` 表
3. 生成 `liveAnalysis` 后写入 `postMatchReview`，但概率数值与 Track A 不同
4. 同时调用 `fetchMatchOdds()` 消耗 The Odds API 额度（每 5min × 每场 live match）
5. 查询参数 `isKnockout` 也未传入

**结论**：需下线或改造为仅消费 Track A `reprice()` 的导出。

---

## 2. buildLiveAnalysis 三处重复

| 位置 | 函数名 | 公式 | 调用者 |
|---|---|---|---|
| `lib/services/PredictionService.js:L505` | `static buildLiveAnalysis()` | 射门/射正/控球/黄牌/红牌/赔率魔法数字 | `POST /api/predict-live` (admin-gated) |
| `scripts/live-match-monitor.js:L169` | `function buildLiveAnalysis()` | 同上但独立副本 | monitor 主循环 |
| `lib/routes/prediction.js:L40` | 注释"已迁移到 PredictionService" | — | 无调用 |

同一函数名、两个独立实现、三种概率。这是"代码做了但没有传"问题的核心。

---

## 3. 各条路径使用的事实输入对比

| 输入 | Track A (`/live-probability`) | Path B (`/predict-live`, admin only) | Path C (monitor) |
|---|---|---|---|
| pre-match λ (home/away expected goals) | ✅ DB snapshots → fallback predictMatch | ✅ predictMatch | ✅ predictMatch (cache) |
| current score | ✅ Query params | ✅ body.liveStats | ✅ ESPN scoreboard |
| minute elapsed | ✅ Query params | ✅ body.liveStats | ✅ ESPN scoreboard |
| added time | ✅ Query params (后端支持，前端不传) | ❌ 不接收 | ❌ 不接收 |
| home red cards | ❌ 前端不传 | ✅ body.liveStats | ❌ 不传 |
| away red cards | ❌ 前端不传 | ✅ body.liveStats | ❌ 不传 |
| isKnockout | ❌ 前端不传 | ❌ 不接收 | ❌ 不传 |
| shots / shots on target | 不接收（设计如此） ✅ | ✅ 魔法数字 | ✅ ESPN stats |
| possession | 不接收（设计如此） ✅ | ✅ 魔法数字 | ✅ ESPN stats |
| yellow cards | 不接收（设计如此） ✅ | ✅ 魔法数字 | ❌ 不传 |
| external odds | 不接收（设计如此） ✅ | ✅ 二次加权 | ✅ 独立 fetchOdds |
| penalty skill | ✅ penaltySkillHome/Away=0.5 (默认) | ❌ 不处理 | ❌ 不处理 |

**关键发现：红牌 + isKnockout 在"输入→API→公式"链中全部截断，尽管公式层已支持。**

---

## 4. 前端路径诊断

### 4.1 `match-detail.js` — 主前端

```
L284: let liveProbUrl = '/api/match/' + id + '/live-probability';
L291: params = { homeScore, awayScore, minute, state, statusName, displayClock, hasPenalties }
L298: api(liveProbUrl).then(lpRes => renderLiveProbPanel(lpd, homeName, awayName))
```

**缺失入参**：
- `homeRed` — 后端 `reprice()` L111 读取 `params.homeRed`，前端不传 → 恒为 0
- `awayRed` — 同上
- `isKnockout` — 后端 L112 读取 `params.isKnockout === 'true'`，前端不传 → 恒为 false
- `addedTime` — 后端 L110 读取 `params.addedTime`，前端不传 → 恒为 0

** `isKnockout` 来源**：`matchData.knockoutIntel?.meta?.isKnockout` 或 `pred.isKnockout` 在前端已有但未传入 URL → L655 只用它渲染战术场景，不给 HUD

### 4.2 `match-renderers.js` — `renderLiveProbPanel()`

```
L1590: function renderLiveProbPanel(data, homeName, awayName)
```

**缺失渲染**：
- 只读 `data.current.homeWin/draw/awayWin` → 不读 `homeWinAfterET/awayWinAfterET/penaltyHomeWin/penaltyAwayWin`
- 淘汰赛时 90min 概率 ≠ 晋级概率，UI 不区分
- `liveState` 状态机支持 et/pen 状态（`resolveMatchState` 已实现），但 `renderLiveProbPanel` 对 et/pen 状态无差异化渲染

### 4.3 `bundle.js` 

与 `match-detail.js` 内容一致（同一源码打包），没有额外变量。

---

## 5. moment-sync 与 Track A 的对齐状况

`lib/jobs/moment-sync.js` L195-210：

```js
const liveProb = reprice({
  preLambdaHome:  prePred.home_expected_goals ?? 1.2,
  preLambdaAway:  prePred.away_expected_goals ?? 1.0,
  homeScore:      matchState.homeScore,
  awayScore:      matchState.awayScore,
  minuteElapsed:  minute,
  homeRedCards:   m.homeRedCards ?? 0,      // ✅ 有
  awayRedCards:   m.awayRedCards ?? 0,      // ✅ 有
  isKnockout:     m.isKnockout ?? false,    // ✅ 有
});
```

**问题**：`m.homeRedCards`、`m.awayRedCards`、`m.isKnockout` 在 `getLiveMatches()` 的 `.map()` 返回对象中**未定义**（L461-476）。ESPN scoreboard 不返回红牌计数和是否淘汰赛 → 这三个字段在 moment-sync 中恒为 0/false。

这意味着 `match_moments` 表中的概率快照从未包含红牌/淘汰赛影响，与公开 API 路径问题一致。

---

## 6. match-detail.js 和 moment-sync 中的缺失字段来源

| 字段 | 前端有？ | moment-sync 有？ | ESPN scoreboard 提供？ | 需从何处补？ |
|---|---|---|---|---|
| `homeRedCards` | ❌ | `m.homeRedCards` (未填充) | ❌ | ESPN summary `keyEvents` → 数红牌/两黄变一红 |
| `awayRedCards` | ❌ | `m.homeRedCards` (未填充) | ❌ | 同上 |
| `isKnockout` | ✅ `pred.isKnockout` (未传入URL) | `m.isKnockout` (未填充) | `e.season.slug` 含 'round'/'quarter' | `deriveStageFromEspnSlug` 已返回 stage 但未 `isKnockout` 派生 |
| `addedTime` | ❌ | ❌ | ❌ | ESPN status.detail 可能含 '+X' |

---

## 7. 淘汰赛语义：regulation vs advance

### 现状

- `live-reprice.reprice()` **已正确处理**三层分解：
  - `homeWin/draw/awayWin` = 90 分钟赛果
  - `homeWinAfterET/awayWinAfterET` = 加时胜
  - `penaltyHomeWin/penaltyAwayWin` = 点球胜
  - 汇总：`homeWin = homeWin + homeWinAfterET + penaltyHomeWin` (晋级概率)

- 但 **前端没用** — `renderLiveProbPanel` 只取 `homeWin/draw/awayWin`
- 淘汰赛 `isKnockout=true` → `draw=0`，分母归一 → 后端正确返回晋级概率
- 但没有监管（regulation）概率的独立字段 → 前端无法并行展示"90分钟胜率 X% / 晋级率 Y%"

### 需要补充

`reprice()` 返回中需增加 `regulation: { homeWin, draw, awayWin }` 和 `advance: { homeWin, awayWin }` 结构 → 前端 UI 分开渲染。

---

## 8. 统一后的唯一实时概率入口设计（建议）

```
前端 UI
  ├── /api/match/:id/live-probability (GET, public)
  │     └── live-reprice.reprice()
  │           └── 输入：score + time + redCards + isKnockout + addedTime
  │           └── 输出：regulation { H/D/A } + advance { H/A } + curve
  │
  └── moment-sync (background)
        └── 同一 reprice() → persist to match_moments
  
POST /api/predict-live/:matchId → 改造成兼容层
  → 内部调用 reprice()（丢弃 shots/possession/cards 软信号）
  → 返回格式不变但概率值 = Track A
  → 或直接下线（admin-only，无使用方）

scripts/live-match-monitor.js
  → 删除自有 buildLiveAnalysis
  → 改用 reprice()
  → odds fetch 交给 odds-collector
```

---

## 9. 验收测试方案（预计实现时）

### Focused Tests

1. **红牌端到端**：修改前端传 `homeRed/awayRed` → 模拟带红牌的 live API 调用 → 确认概率与无红牌不同，差值符合 `0.72^n` 期望
2. **isKnockout 端到端**：模拟 KO fixture → 确认 `draw=0` 且 `homeWinAfterET/penalty` 非零
3. **三路径一致性**：同一 fixture 三个入口 → 同一概率
4. **regulation/advance 分离**：KO 赛返回两个独立结构
5. **软信号隔离**：传入 shots/possession → `reprice()` 忽略（已有测试覆盖）
6. **缺失快照处理**：无 `prediction_snapshots` 记录 → 返回 `unavailable` 而非静默 fallback
7. **addedTime**：传入 `addedTime=8` → `timeRatio` 基于 98 分钟计算，λ 不膨胀（已有 W1-B fix）

### Browser Fixture

- 组赛 live → HUD 显示概率曲线 + 当前值 + 赛前基线
- 淘汰赛 live → HUD 显示 `90' 概率 (H/D/A)` + `晋级概率 (H/A)` 双行
- KO 加时赛 → 状态机切换 et 标签，draw=0
- KO 点球 → 状态机切换 pen 标签

---

## 10. 结论

| 项目 | 判定 |
|---|---|
| 当前公开实时路径 | ✅ `GET /api/match/:id/live-probability` — 公式正确 |
| 旧路径仍在运行 | ⚠️ `POST /api/predict-live` (admin-gated) + `live-match-monitor` (独立 buildLiveAnalysis) |
| 公式重复/冲突 | ❌ `reprice()` vs `buildLiveAnalysis()` 完全不可互导 |
| 红牌端到端 | ❌ 前端不传 → API 恒 0；moment-sync map 未填充 → 恒 0 |
| isKnockout 端到端 | ❌ 前端不传 → API 恒 false；moment-sync map 未填充 → 恒 false |
| regulation/advance 混用 | ❌ 前端只渲染一种概率；reprice 返回结构已分离但 UI 不展示 |
| addedTime | 后端支持但前端不传 |
| 缺失快照处理 | ⚠️ fallback 到实时 predictMatch 但未标 retrospective |
| 三条路径一致性 | ❌ 各有公式 |

**下一步**：审计通过后，开始 C 的实现——修复前端入参 + 统一三路径到 `reprice()` + regulation/advance 分离渲染 + 淘汰赛 HUD 升级。
