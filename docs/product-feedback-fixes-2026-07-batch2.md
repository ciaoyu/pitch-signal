# 生产问题修复批次二（PF-9~11）：夺冠赔率前端断链、淘汰赛对阵表队名错位、角球取真实数据失败

> 版本 2026-07-10 · PF-1~PF-8 合并 push 到 backup（`8f331d0`）后用户生产实测反馈
> 配套文档：[product-feedback-fixes-2026-07.md](product-feedback-fixes-2026-07.md)（第一批 PF-1~PF-8）
> 全部问题经代码读取核实，PF-9 额外直接 curl 生产 Polymarket API 复核数据源本身可用。

---

## 风险提示（写在最前面）

三个问题里，**PF-10（对阵表）根因链条最长、涉及结构性问题**（ID 桥接文件是一次性生成、从未刷新），修复范围明显大于另外两个"一行代码写错"的问题。实现前必须先跟我对一遍具体方案，不要闷头做完才给我看。PF-9、PF-11 可以直接做。

## 已核实的问题（file:line 证据）

### PF-9 夺冠赔率卡片显示"暂无数据"——纯前端响应解包 bug，后端和 Polymarket API 都是好的

- 实测复核：直接 `curl https://gamma-api.polymarket.com/events?slug=world-cup-winner` 仍能拿到 `world-cup-winner` 事件下每支队伍的真实赔率（如 `"Will Spain win the 2026 FIFA World Cup?"` → `outcomePrices: ["0.1965","0.8035"]`），说明 PF-7 接的真实数据源本身没坏。
- `lib/routes/polymarket.js`、`lib/polymarketClient.js` 的 `fetchWorldCupWinner()`/`_parseWorldCupMarkets()` 逻辑也确认正常，且这个路由是独立注册的，不受 `assertFeatureGates()` 强制关闭 `POLYMARKET_ENABLED` 的影响（本来就是按方案设计成脱钩的独立卡片）。
- 真正的 bug 在 `static/js/world-cup-odds.js:13-18`（同样的问题原样打包进了生产在跑的 `static/js/bundle.js:4221-4223`）：
  ```js
  window.WorldCup.ApiClient.get('/api/world-cup-winner')
    .then((res) => {
      if (!res || !res.odds || res.odds.length === 0) {   // 错了
  ```
  `ApiClient.get()`（`static/js/api-client.js:31-49`）统一返回包装对象 `{ ok, status, data, error, hasData }`，真实数据在 `res.data` 里，不是 `res` 本身——文件头部注释本来就写明了这个约定（"Old: `const data = await api(...)`; New: `const { ok, data, error } = await API.get(...)`"），仓库里其他调用点（如 `static/js/standings.js:62`、`static/js/scores.js:8-9`）都遵守了这个约定，只有这一处没有。结果是不管后端返回真数据还是报错，`res.odds` 永远是 `undefined`，卡片永远展示"暂无数据"，第 20 行的 `res.odds.map(...)` 是永远走不到的死代码。
- 修复方向：`static/js/world-cup-odds.js` 里把 `res.odds` 改成 `res.ok && res.data?.odds`，同步在 `res.data.odds` 上做后续渲染；改完必须 `npm run build:js` 重新生成 `bundle.js`，不能手改编译产物。

### PF-10【范围较大，需先对方案】淘汰赛对阵表队名跟实际赛程不符

- 不是缓存问题，也不是前端渲染问题：`/api/bracket`（`lib/routes/standings.js:45-79`）每次请求都是现算，没有 `getCached`/`setCache`；`static/js/bracket.js:241-274` 只是把 API 返回的 `teamA`/`teamB` 原样渲染，接口给什么就显示什么。
- 根因链条（服务端 `lib/bracket-updater.js`）：
  1. R32 阶段的队名是对的——`resolveSlot()`（`:151-170`）直接从实时小组积分（`posMap`/`thirdPlaceData`，来自 `standings.js:45-79`）解析 F1/C2 这类小组名次占位符，这层没问题（摩洛哥确实是真实的 F1 出线队）。
  2. **FIFA↔ESPN 比赛 ID 桥接表是一次性生成、只覆盖小组赛的**：`resolveDataPath('match_id_bridge.json')`（`:45`）优先找运行时目录，但运行时目录下根本没有这个文件，永远回退到 `resources/seed/wc2026/match_id_bridge.json`——固定 104 条，全是小组赛阶段生成的，`generatedAt` 停在小组赛期间。淘汰赛开始后从未重新生成过映射（`scripts/build-match-id-bridge.js` 是手动一次性脚本，定时任务 `lib/lineups-sync-scheduler.js:81` 只同步阵容/赛程/名单，不碰这张桥接表）。
  3. **主匹配逻辑淘汰赛阶段会静默失效**：`slotToScheduleShortName()`（`:60-72`）期待 ESPN `shortName` 是抽象形式（如 `"2C @ 1F"`），但淘汰赛阶段 ESPN 早就把队伍解出来了，`data/match_snapshot_schedule.json` 里实际是 `"MAR @ NED"`、`"SWE @ FRA"` 这种真实队名——主匹配对不上，退回兜底逻辑（`:96-127`），而兜底又依赖上面那张过期的桥接表，同样失败。结果是像法国-摩洛哥这种确认的 R32 比赛，永远拿不到 `matchId`。
  4. **拿不到 `matchId` 的比分推进被静默跳过**：`propagateResults`（`:296-298`）`if (!espnMatchId) continue;`——没有 matchId 就不写胜负，`status` 一直卡在 `'scheduled'`，往下一轮的推进逻辑（`:342-359`，条件是 `status==='final' && winner`）永远不触发。
  5. **静态对阵树本身跟真实抽签结果对不上**：交叉核对真实数据（`data/wc2026/matches.json` 里 FIFA 比赛 `400021536` 是法国 vs 摩洛哥，阶段 `qf`）和 `data/bracket_2026.json` 的树结构，发现摩洛哥的真实晋级路径是 `R32-3→R16-1→QF-1`，法国是 `R32-15→R16-8→QF-4`——完全是两个不同象限，但两队实际在 QF 相遇。`data/bracket_slot_map.json`（一次性生成于 2026-06-26，早于任何淘汰赛比赛，也从未刷新）纯按"树位置+队名模式"把 ESPN matchId 硬绑到 slot 上，不是按真实队伍身份绑定——这张映射表本身就是错的，所以某个真实比赛最终被塞进了错误的 slot，显示出"摩洛哥 vs 墨西哥"这种查无此赛的虚构配对。
- 修复方向（需要跟我先过一遍再动手）：
  1. `match_id_bridge.json`/`bracket_slot_map.json` 不能再是一次性脚本产物，需要接入实时/定时刷新（挂到现有的 `lib/lineups-sync-scheduler.js` 或类似的调度里）；
  2. `slotToScheduleShortName()` 的主匹配需要能处理淘汰赛阶段 ESPN 已解出真实队名的 `shortName` 形式，不能只认抽象占位符形式；
  3. 用真实官方抽签结果重新核对 `data/bracket_2026.json` 的 feedA/feedB 树结构是否有系统性错位（目前发现摩洛哥/法国这一组对不上，需要抽查其他象限是否也有同类问题，不能只修这一个个例）；
  4. 这块改动直接影响淘汰赛全阶段的展示正确性，验收时我会要求实现者提供修复前后对比：至少 4 强/8 强的真实赛程 vs 修复后的对阵图逐一核对，不能只测一场。

### PF-11 比赛详情页角球预测永远是主场 4.5/客场 3.8——key 名字写错，不是数据缺失

- 根因：`lib/routes/matchup.js:874-875` 先给 `homeAvgCorners=4.5`/`awayAvgCorners=3.8` 兜底默认值，然后尝试用真实数据覆盖（`:876-886`）：
  ```js
  if (homeRecent?.stats?.corners?.avg > 0) homeAvgCorners = homeRecent.stats.corners.avg;
  if (awayRecent?.stats?.corners?.avg > 0) awayAvgCorners = awayRecent.stats.corners.avg;
  ```
  但 `recent-stats`（`lib/routes/recent.js:169-182`）聚合数据时是按 ESPN boxscore 原始类目名 `s.name` 作为 key（`:136`、`:155-158`），ESPN 对角球这项的真实字段名是 `wonCorners`（仓库里其他所有消费点都是按这个名字取的：`matchup.js:903/906` 自己另一处、`static/js/match-renderers.js:1367`、`bundle.js:6755`），从来没有一个字段字面叫 `corners`。所以 `homeRecent.stats.corners` 永远是 `undefined`，`if` 永远不触发，兜底的 4.5/3.8 对每一场比赛都原样返回。
- 历史：这个 bug 是 6-27 那次专门修复"角球用真实数据替代硬编码"的提交（`1c5881f`）引入的——本意是消灭初版硬编码，结果因为 key 名字写错，等于原地踏步，改了个寂寞。跟第一批 PF-2（`recent.js` 取样窗口调宽）无关，那个改动本身没问题。
- 修复方向：把 `lib/routes/matchup.js:883-884` 的 `.stats.corners.avg` 改成 `.stats.wonCorners.avg`，真实的两队最近比赛角球数据本来就已经在正确聚合，只是没接对字段名。这是范围最小、风险最低的一个。

## 派工切分（沿用 §8.0 worktree 规约）

| 任务 | 分支 | worktree | 建议负责人 | 风险 |
|---|---|---|---|---|
| PF-9 夺冠赔率前端解包 | `feat/pf9-worldcup-odds-response-unwrap` | `pf9-worldcup-odds-response-unwrap` | 任一人（前端，改动极小） | 低 |
| PF-11 角球真实数据字段名修正 | `feat/pf11-corners-field-name-fix` | `pf11-corners-field-name-fix` | 任一人（改动一行） | 低 |
| PF-10 淘汰赛对阵表 ID 桥接重构 | `feat/pf10-bracket-id-bridge-refresh` | `pf10-bracket-id-bridge-refresh` | B（涉及调度/数据管线，建议经验更足的人） | **高，需先对方案** |

- 全部从当前已 push 的 main（`8f331d0` 之后）新建 worktree，遵循 §8.0 的一任务一 worktree、测试互斥、不自行合并进 main 的纪律。
- PF-9、PF-11 可以并行且快速交付，建议先合这两个。
- PF-10 在实现者动手前，必须先把"桥接表如何刷新（定时任务 vs 请求时懒加载重建）""对阵树错位是否只有法国/摩洛哥这一处还是系统性"这两点方案发给我确认，再动手写代码——这条改动面广、影响淘汰赛全阶段展示，不能像另外两个一样直接做完再看。
- 每个任务验收要求：`npm test` 全绿 + 对应端点/页面的真实数据核对（不能只看接口返回 200），附验证输出给我复核。
- PF-9、PF-11 改动涉及 `bundle.js`，合并后必须 `npm run build:js` 重新生成并确认哈希更新，不能手改编译产物。
- PF-10 验收时我会要求至少核对 4 强/8 强真实赛程 vs 对阵图逐一比对，且跑一次现有测试确认没有破坏 `test-bracket-updater.js`、`test-knockout-writeback.js`、`test-third-place.js` 这几个已有的淘汰赛回归测试。

## 交付物

本文档为唯一交付物，不改任何代码；本地 commit，不 push（等任务实现完、我验收通过后才 push，push 目标固定是 `backup`，不是 `origin`）。

## 验证

- PF-9：改完起本地服务器，真实 curl `/api/world-cup-winner` 确认后端有数据，再检查前端卡片是否正确渲染出具体队伍赔率（不能只看"不再报错"，要看到真实的球队名+概率数字）。
- PF-11：抽查至少 3 场不同对阵的比赛详情页，确认角球数字随对阵变化（不再是固定 4.5/3.8），且能对应上 `/api/team/:id/recent-matches` 返回的真实聚合值。
- PF-10：用真实官方赛程逐场核对对阵图队名，重点验证法国/摩洛哥这一组本次报告的具体案例已修复，同时抽查另外至少 2 组已确认的淘汰赛比赛没有被引入新的错位；跑 `test-bracket-updater.js`/`test-knockout-writeback.js`/`test-third-place.js` 确认不回归。
- 全部通过后，按老规矩合并进本地 main，push 前再检查一次。
