# 🏆 世界杯 Dashboard 开发日志

> 记录从 mock 数据修复到真实预测系统+比赛回顾的完整开发过程
> 最后更新: 2026-06-14 ~18:30 UTC

---

## 📌 问题概述

现有世界杯 Dashboard 两个核心问题：

1. **比分全 2-2** — `data/ratings.json` 是 mock 数据，所有球队评分集中在 68-78/100 分，除以 75 后 `attack_strength` 和 `defense_strength` 都在 0.97-1.0 之间，Poisson 模型 λ 几乎无差异，任何两队对阵都输出 2-2
2. **分组不完整/不对** — 原本硬编码的分组依赖 mock `ratings.json` 的 team ID 映射，且德国被放到错误的组

---

## 📂 改动文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `data/ratings.json` | 🆕 重写 | 从2018+2022真实历史数据用Elo生成58队评分 |
| `lib/elo.js` | 未改 | Elo引擎没改，只是正确使用 |
| `lib/poisson.js` | ✏️ 新增 | 新增 `predictMatchWithLambda()` 方法 |
| `lib/prediction.js` | 🆕 重写 | Elo引导λ机制+动态权重 |
| `lib/db.js` | ✏️ 扩展 | 新增groups/group_standings/matches表+CRUD |
| `lib/qualification.js` | 🆕 重写 | 从DB加载分组+真实Elo驱动出线模拟 |
| `lib/matchReview.js` | 🆕 新增 | 比赛回顾+预测偏差分析引擎 |
| `server.js` | ✏️ 更新 | 出线路由切DB+新增match-review API路由 |
| `templates/index.html` | ✏️ 更新 | 新增"📋 回顾"tab+UI渲染 |
| `scripts/test-prediction.js` | 🆕 重写 | 全面测试脚本 |

---

## 🧠 技术决策

### 1. 评分数据源头：2018+2022历史赛果 → Elo

**决策**：不用ESPN API（限流5req/min慢），直接从已有的 `data/history/worldcup_2018.json` 和 `worldcup_2022.json` 运行Elo算法。

**实现细节**：
- 初始 Elo：基于 FIFA 排名系数赋值（法国 1900 → 库拉索 1350）
- K-factor: 小组赛 40，淘汰赛 50
- 公式：`newRating = oldRating + K × goalDiffMultiplier × (actual - expected)`
- 最终评分范围 1350-1953，映射后攻防强度 0.94-1.21，区分度足够

**为什么对**：
- 用真实比赛结果而非玩家评分，能准确反映球队真实实力
- 保留了强弱队差距（法国1953 vs 库拉索1350 = 603分差）

### 2. 预测引擎：Elo 引导 Poisson λ

**决策**：当攻防评分区分度不够时，用 Elo 差值直接推算 expected goals。

**公式**：
```
baseLambda = 1.5 (世界杯平均 expected goals)
adjustedLambda = baseLambda + (eloDiff / 100) × 0.4
```

每 100 分 Elo 差，预期进球差 0.4 球。

**动态权重**：
- Poisson 无区分度时 → 降权 Poisson，加权给 Elo
- 无盘口数据时 → 权重重新分配给 Elo + Poisson
- 5 维度框架不变（Elo 30%, Poisson 25%, 教练 15%, 场馆 10%, 盘口 20%）

### 3. 数据库：SQLite 分级表

**决策**：直接在 `lib/db.js` 中扩展3张表，不走 ORM。

新表结构：
```sql
groups          (id, group_name, tournament)
group_standings (group_id, team_id, played, wins, draws, losses, gf, ga, gd, pts)
matches         (group_id, match_number, home_team_id, away_team_id, score, played)
```

### 4. 比赛回顾架构

单独 `matchReview.js`，不耦合到 prediction 引擎：
- 输入：比赛 ID + 双方比分
- 输出：比赛总结 + AI vs 真实对比 + 偏差因素分析 + Elo 变化 + 关键事件

偏差因素检测列表：
1. Elo 差距未在结果中体现（爆冷）
2. 比分方差（实际进球偏离 Poisson 预期 > 1.5 球）
3. 防守崩溃（失球 ≥ 场均 2 倍）
4. 进攻爆发（进球 ≥ 场均 2 倍）
5. Poisson 区分度不足
6. 主场优势高估/低估

---

## 🔧 遇到的问题与教训

### ❌ 问题 1: sub-agents 无法跨 workspace 访问项目文件

**症状**：spawn agent 后，read/write 工具找不到 `pitch-signal/` 目录。

**根因**：`agency-agents/` 下的 agent workspace 是独立目录（symlink），和 main session 的 `workspace/` 不是同一个目录。所以 sub-agent 看不到 main workspace 里的文件。

**教训**：绝对路径引用对 sub-agent 不一定有效。如果需要 sub-agent 处理项目文件，要么把项目放在 agent 共享目录，要么给 agent 指定正确的 workspace。

### ❌ 问题 2: EmbeddedAttemptSessionTakeoverError

**症状**：多次 spawn sub-agent 后，出现 session 文件被抢占的错误。

**根因**：多个 sub-agent 同时运行时抢写同一个 session token 文件。

**当前状态**：用了 `agents.defaults.subagents.allowAgents=["*"]` 但仍有这个底层的 session 冲突 bug。sub-agent 系统跑不通。

**教训**：对这类复杂项目修改，**主 agent 直接执行效率远高于 sub-agent 分拆**。每个 sub-agent 启动的上下文加载（skills snapshot, prompt）本身就消耗大量 token，加上 session 冲突风险，得不偿失。

### ❌ 问题 3: mock ratings.json 的 2-2 问题根源

**根因链**：
1. `data/ratings.json` 用了球员评级（68-78），除以 75 归一化
2. 所有球队 `attack_strength` 差异缩到 0.05 以内（0.97-1.0）
3. Poisson 的 `attack_strength / defense_strength` 公式算出来的 λ 都在 1.4-1.6
4. λ 接近导致概率矩阵几乎一样，双方进球分布相同

**教训**：**数据质量 > 算法复杂度**。再怎么优化 prediction.js 的融合权重，只要 ratings.json 没区分度，Poisson 就不可能输出合理比分。

### ❌ 问题 4: Elo 引导 λ 在 Elo 接近时也无效

**情况**：Australia vs Türkiye 的 Elo 仅仅相差 1 分（1579 vs 1580），Elo 引导 λ 也无法区分。

**分析**：这是正确的行为——如果两队历史实力真的几乎相同，模型不应该自动输出 2-0。模型反映的是**历史能力**而非**已发生赛果**。要处理这种情况，需要在 Elo 系统中把已赛结果反馈进去（即赛后更新 Elo）。

---

## 📊 验证数据

### Germany vs Curaçao (Group E)
```
AI 预测: 2-0 (主胜 66.3%)
实际结果: 3-0
精度: highly_accurate ✅
偏差因素:
  [HIGH] 防守崩溃: Curaçao 失3球远超场均1.0
  [HIGH] 进攻爆发: Germany 进3球远超场均1.33
Elo变化: Germany +3, Curaçao -3
```

### Australia vs Türkiye (Group D, 已赛)
```
AI 预测: 1-1 (主胜 39.1%)
实际结果: 2-0
精度: result_correct_score_wrong 🟡
偏差因素: Poisson 区分度不足（Elo仅差1分）
Elo变化: Australia +16, Türkiye -16
```

### 出线概率 (Group D, 已赛1场)
| 球队 | 出线概率 | 均位 |
|------|---------|------|
| Australia | 84.4% | 1.7 |
| Paraguay | 58.6% | 2.3 |
| United States | 27.7% | 3.1 |
| Türkiye | 29.3% | 3.0 |

### 评分 Top 5
| 球队 | Elo | 攻 | 防 |
|------|-----|----|-----|
| France | 1953 | 1.21 | 0.87 |
| Belgium | 1865 | 1.17 | 0.90 |
| Argentina | 1857 | 1.16 | 0.90 |
| Netherlands | 1827 | 1.15 | 0.91 |
| Brazil | 1824 | 1.15 | 0.92 |

---

## 🚀 后续可以做的

1. **赛程 UI 展示正确分组对阵** — 当前 schedule tab 用 ESPN API 的赛程数据，但分组出线 tab 已用正确数据
2. **赛后 Elo 自动更新到 ratings.json** — 每当收到已赛结果，自动运行 Elo update 写入新 ratings.json
3. **多场比赛偏差汇总统计** — 累计所有比赛的偏差，量化模型精度
4. **实时比赛直播积分榜更新** — 用 ESPN API 的实时积分数据
5. **使用正确 ratings 的 prediction tab** — 当前 prediction tab 还依赖旧的 mock RATINGS 来显示 Elo 排名

---

## 📝 关于 sub-agent 系统

当前 `sessions_spawn(agentId=...)` 可以让主 agent 调用配置中的任何 agent，但有一个底层 bug：`EmbeddedAttemptSessionTakeoverError` 导致多个 sub-agent 在高频调用时 session 文件冲突。

配置已就绪：
- `agents.defaults.subagents.allowAgents=["*"]` ✅
- `agents.list[main].subagents.allowAgents=["*"]` ✅
- `agents_list()` 返回 `allowAny: true` ✅

但这个 session 冲突是 OpenClaw 内核的问题，不是配置能解决的。复杂任务直接在主 session 执行更稳定。

## 2026-06-14 修复记录

### 问题
1. **Elo rankings 返回空数组** — 新 ratings.json 没有 `players` 数组，Elo rankings API 用 `team.players.length > 0` 过滤全跳过
2. **Quali 数据显示不出来** — 新 API 返回 `{"Group A": {...}, "Group B": {...}}`，但前端 JS 期望 `qualiData.groups` 数组
3. **比赛回顾为空** — 前端 `openMatch()` 用 `matchData.homeId` 但 `/api/match/:id` 不返回该字段；ESPN ID（如 "4398"=Qatar）不在 ratings 的 key 中

### 修复
1. **Elo rankings** (`server.js` line 1752): 优先用 `team.rating`（新格式），回退到 `players[]` 平均（旧格式）
2. **Quali 前端** (`templates/index.html`): `loadPrediction()` 用 `Object.values(qualiData)` + `g.results` 代替 `qualiData.groups`
3. **Match review** (`server.js` POST route): 添加 `resolveTeamId()` 从 ESPN ID 逆向查找球队英文名；前端用 `scheduleCache` + `matchData` 多重 fallback 取 home/away ID

### 验证
- Elo rankings: 58 队，法国 1953 第一
- Quali: 12 组 × 4 队全部显示
- Qatar 1-1 Switzerland (ESPN ID 4398 vs 475): 正确匹配 ratings，模型预测 Swiss 赢（合理），偏差分析准确
- 所有已赛比赛 modal 中 "📋 回顾" tab 正常加载
