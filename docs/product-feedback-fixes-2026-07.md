# 产品反馈修复批次（PF）：本届战绩显示、比分矩阵、角球取样、复盘翻译、AI归因证据链、Polymarket 真实接入、UI排序

> 版本 2026-07-10 · Wave 1 推送上线后用户实测反馈汇总
> 配套文档：[prediction-improvement-roadmap.md](prediction-improvement-roadmap.md)（预测模型改进路线图，与本批次无重叠——本批次是产品/数据完整性问题，不涉及预测准确率）
> 全部问题经代码读取 + 对已合并 main 跑起来的真实服务器发 curl 验证；Polymarket 接入方式额外核实了官方文档与公开资料，不是猜测。

---

## 已核实的问题（file:line 证据）

### PF-1【含 PF-6，合并为一个任务】团队详情"小组赛战绩"应改为"本届世界杯战绩"，球队列表需按在役/淘汰排序

**根因相同**：小组赛积分表数据在淘汰赛开始后就冻结，不随淘汰赛战绩更新，两处展示都受影响，合并成一个任务处理，避免两条分支同改一个文件互相冲突。

- 证据（战绩显示）：`static/js/team-detail.js:229` 硬编码标签 `tx('小组赛战绩', 'Group Record')`，数据来自 `groupRecordFromStanding()`（第 36-44 行），直接读 `/api/standings` 的小组赛积分表。进 8 强/16 强的队伍实际已踢 5 场，进 4 强的踢了 6 场，但这里只显示小组赛 3 场的胜负。
  - 同文件里已有正确参照：`renderTeamWCMatches()`（约第 83-88 行）已经正确统计了跨小组赛+淘汰赛全阶段的 W/D/L（`data.matches` 覆盖全部已踢比赛，`stage` 字段区分 group/knockout 但统计时不做过滤）。
  - 修复方向：把"小组赛战绩"区块换成复用 `renderTeamWCMatches` 已有的全阶段统计逻辑，标签同步改为"本届世界杯战绩 / World Cup Record"。**不是接新数据源，是把已经算对的逻辑接到这个展示位上。**
- 证据（球队列表排序）：目标页面是"球队 Teams" tab（`templates/index.html:294`），渲染逻辑在 `static/js/team-detail.js:46-64` `loadTeams()`，数据源 `refreshTeamsFromStandings()` 直接读 `/api/standings` 按小组顺序铺平，没有淘汰状态排序；`lib/routes/standings.js` 的 `status` 字段只在小组赛阶段有效，淘汰赛开始后就过期。
  - 修复方向：从淘汰赛桥接数据（`bracket.js`/`bracket-updater.js` 的比赛胜负结果）计算真实的"是否还在比赛中"状态，附加到 team 对象，前端按此排序（在役在前，已淘汰在后）。

### PF-2 角球等"近期数据"场均取样窗口偏小
- 证据：`lib/routes/recent.js:100` `Math.min(Math.max(parseInt(params.n||'3',10)||3,2),5)` —— 默认 3 场，最多封顶 5 场。
- 实测：`curl localhost:5099/api/team/478/recent-matches` 确认法国最近赛程已含 2 场淘汰赛（07-04 vs Paraguay、06-30 vs Sweden），取样确实会正确纳入淘汰赛比赛——问题纯粹是窗口上限只有 5 场。
- 修复方向：把 `recent.js:100` 的上限从 5 提高（比如 8-10），默认值同步调整；注意 ESPN 调用次数随窗口增大而增加，确认 30 分钟缓存（`getCached(cacheKey, 1800000)`）够不够用。

### PF-3 复盘"关键事件"没有真中文 + 冗长无聊【翻译是硬要求，不许只标英文】
- 证据（两个独立 bug，同一函数 `lib/routes/prediction.js:19-31` `extractKeyEvents()`）：
  - 第 21 行 `commentary.slice(0, 12)`：直接取 ESPN 原始评论前 12 条（按时间顺序，不按重要性）。
  - 第 28 行 `textI18n: item?.textI18n || { zh: text, en: text }`：ESPN 数据没有中文翻译时，把英文原文塞进 zh 字段冒充中文——**不允许仅英文占位，必须是真中文**。
- 修复方向：
  1. ESPN 结构化评论通常带 `type` 字段（进球/黄牌/红牌/换人/VAR 等有限枚举），参照 `lib/services/moment-detector.js` 的 `ESPN_TYPE_MAP` 做法，建一套中英双语模板（跟 `lib/matchReview.js` 的 `generateDefaultEvents` 已经在用的模板套路一致），大多数结构化事件直接模板生成真中文，不需要逐条调 LLM；
  2. 用重要性打分（参照 `moment-detector.js` 的 `scoreImportance`）筛选，替代"前 12 条流水账"；
  3. 少数无法归类模板的自由文本评论走真翻译，不允许再出现"英文塞进 zh 字段"这种假翻译。

### PF-4 AI 复盘归因证据链缺"阵容变化"【谨慎：Railway 上已有真实复盘数据，不能乱动】
- 证据：`lib/postMatchReview.js:566` 模板句"赛前预测未命中赛果方向，需要结合临场事件、阵容变化和舆论信息解释偏差"，但实际证据对象 `lib/services/ReviewService.js:184-190` 只有 `{events, commentary, news, timeline}`——没有阵容/换人数据。
- **要求**：Railway 生产环境上已经有真实生成的复盘内容，实现者不许乱动（不能批量重新生成、不能推翻现有 prompt 框架）；这次只是在已验证的实盘复盘 prompt/证据框架基础上，新增阵容证据这一路输入。
- 修复方向：把已有的换人评分逻辑（`lib/routes/matchup.js` 里 `enrichSubstitutions`）接入 `ReviewService` 的 evidence 构建，追加进现有 `{events, commentary, news, timeline}` 对象（新增字段，不改动/不重跑已有复盘）。

### PF-5 积分页 Tab 顺序（低风险，纯前端）
- 证据：`templates/index.html:356-360`，三个 tab 按钮硬编码 DOM 顺序：小组赛→淘汰赛→射手榜。
- 修复方向：调整为 淘汰赛→射手榜→小组赛，默认激活 tab 改成淘汰赛（实现前跟总控制确认默认项）。

### PF-7【方案已调整：降级为独立"冠军赔率"卡片，不做单场融合】Polymarket 从假数据变真实
- 原方案 B（真实接入 + 单场比赛融合）已放弃：实测确认 Polymarket 这届世界杯**没有任何单场比赛胜平负盘口**——查了 `world-cup`、`fifa-world-cup` 两个 tag 下全部 97 个市场（`tag_slug=world-cup` 47 个 + `tag_slug=fifa-world-cup` 50 个），清一色是冠军赔率、出线概率、金靴/金球等奖项、"是否会有点球大战"这类花式盘、"决赛具体对阵"预测——**没有一个是"法国 vs 摩洛哥谁赢"这种单场盘口**。`lib/prediction.js` 里现成的 Shin 去水 + Sigmoid 融合逻辑吃的是单场胜平负概率，Polymarket 现在的数据形状根本对不上，接了也是空转（返回 null，不改变任何展示概率）。
- **新方案：Polymarket 真实数据接入 + 独立"冠军赔率"卡片，不进融合**：
  - 证据：`https://gamma-api.polymarket.com/events?slug=world-cup-winner` 是真实存在、活跃的市场，每支队伍一个"Will X win the 2026 FIFA World Cup?"二元市场，返回真实隐含概率——实测法国 31.95%、阿根廷 19.55%、西班牙 19.35%、英格兰 16.05%，已淘汰的队伍（巴西/德国/葡萄牙/荷兰等）已经是 0%。
  - Gamma API 完全公开、不需要注册/API Key/钱包认证——这个是只读市场数据端点，不涉及 `docs.polymarket.com` 交易文档里说的 CLOB 下单认证（那一套 L1/L2 钱包签名是用来下单交易的，我们不下单，用不上，不要被这部分文档带偏）。
  - `lib/polymarketClient.js:1-27` 里注释掉的真实 API 调用代码目前指向的是单场匹配（`query: ${homeTeam} vs ${awayTeam}`），需要改成指向 `world-cup-winner` 这个 slug，解析 `markets[].question`/`outcomePrices` 提取每队夺冠概率。
- 修复方向：
  1. 把 `lib/polymarketClient.js` 改成拉取 `world-cup-winner` 事件（及视需要补充 `world-cup-nation-to-reach-semifinals` 等出线相关市场），替换 `_mockFetchMarket`，处理好队伍名匹配（Polymarket 用英文全名，需要跟 `lib/team-data.js` 的球队名做映射）和请求失败兜底；
  2. **不需要动 `server.js` 的 `assertFeatureGates()` 强制闸门**——这个闸门管的是"是否融合进预测概率"，这次不融合，闸门维持现状即可，不用碰这个安全开关；
  3. 新增一个独立的"冠军赔率"展示卡片（前端位置待实现者提议，比如放在赛程/积分页顶部或球队详情里），展示各队夺冠概率、可选出线概率，数据来源标注"Polymarket 预测市场"，跟单场比赛预测页面完全不共用组件、不影响任何已有的胜率数字；
  4. `CLAUDE.md` 不需要改——`POLYMARKET_ENABLED` 闸门语义没变（依然是"是否融合"），只是这次我们压根不用这个闸门管的那条路径。
- 风险大幅降低：不碰安全闸门、不改任何展示概率，纯新增一张独立信息卡片，验收只需核对真实数据显示正确、队伍名匹配没错、无匹配/请求失败时优雅隐藏卡片（不崩、不显示空数据）。

### PF-8 比分预测展示多个选项，不止一个
- 证据：`lib/poisson.js:87-96` `goalProbabilityMatrix(homeLambda, awayLambda, maxGoals=5)` 已经算出完整 6×6 比分联合概率矩阵；内部只取概率最高的一格作为 `likelyScore`/`likelyScoreProb`，第二、第三名算完就丢了；`lib/prediction.js:393-403` 只往外暴露这一个 mode 比分；前端 `static/js/match-renderers.js`、`static/js/elo-prediction.js` 也只渲染这一个。
- 修复方向：矩阵本来就有，不用重新建模——把矩阵按概率从高到低排序，取前 3-5 名，加一个 `topScores: [{score, prob}, ...]` 字段挂在 `lib/prediction.js` 现有返回对象上，前端在比分预测区域改成列表展示（从高到低）。单人端到端完成（后端字段 + 前端渲染），不拆两人交接。

---

## 派工切分（沿用路线图 §8.0 worktree 规约）

| 任务 | 分支 | worktree | 负责人 |
|---|---|---|---|
| PF-1（含 PF-6）本届战绩显示 + 球队淘汰排序 | `feat/pf1-team-status` | `pf1-team-status` | A |
| PF-2 recent-stats 窗口 | `feat/pf2-recent-stats-window` | `pf2-recent-stats-window` | A（低风险，从 B 挪出用于平衡工作量） |
| PF-3 关键事件 i18n + 筛选 | `feat/pf3-key-events-i18n` | `pf3-key-events-i18n` | A |
| PF-4 AI 归因阵容证据（新增证据，不动老数据） | `feat/pf4-postmortem-lineup-evidence` | `pf4-postmortem-lineup-evidence` | A |
| PF-5 积分 Tab 顺序 | `feat/pf5-standings-tab-order` | `pf5-standings-tab-order` | A |
| PF-7 Polymarket 冠军赔率卡片（独立展示，不融合） | `feat/pf7-polymarket-winner-odds` | `pf7-polymarket-winner-odds` | B |
| PF-8 比分矩阵多选项展示 | `feat/pf8-top-scores-display` | `pf8-top-scores-display` | A |

**规约**：
- 全部从当前已 push 的 main（`3c72ea1` 之后）新建 worktree，遵循 §8.0 的一任务一 worktree、测试互斥（不同时跑 `npm test`）、不自行合并进 main 的纪律。
- 每个任务验收要求：`npm test` 全绿 + 对应端点的真实 curl/UI 验证，附验证输出。
- PF-1/PF-6 合并为一个任务，避免同文件双分支冲突。
- PF-4 实现者动手前必须先看一遍 Railway 生产环境现有的复盘内容长什么样，确认新增证据字段不会破坏已验证的 prompt 结构，且不重新生成/覆盖任何已有复盘。
- PF-7 已降级为独立展示卡片，不再触碰 `lib/prediction.js`/融合逻辑/安全闸门，与 PF-8 无文件冲突，可独立合并，风险等级降到跟 PF-5 一档（纯新增展示，不影响任何已有数字）。

**不包含**：方法论文档更新——这是用户与总控制之间单独的任务，不在本批次派工范围内。

---

## 验证（总控制验收流程）

- 每个 PF 任务：拉分支 → `npm test` → 起本地服务器 → 用真实比赛 ID/球队 ID 走一遍对应接口/页面，确认修复生效且不影响 Wave 1 已验证的红线（回测主数字、赛中纪律端点等）。
- PF-3/PF-4 需要人工核查内容是否真的是中文、是否引用了阵容变化，不能只看接口返回 200。
- PF-7 额外验证：真实 Polymarket API 数据（各队夺冠概率）展示正确、队伍名匹配无误、API 不可用/无匹配数据时卡片优雅隐藏（不崩、不显示空白/假数据）；确认没有任何单场比赛的展示概率被这张卡片影响。
- PF-8 验证：抽几场比赛确认 `topScores` 按概率从高到低排列且总和不超过 1，前端列表展示正常。
- 全部通过后，合并进本地 main，push 前再检查一次；push 目标固定是 `backup`（`ciaoyu/pitch-signal`），不是 `origin`。
