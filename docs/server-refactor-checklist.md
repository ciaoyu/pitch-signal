# server.js 重构检查清单

## 基线（2026-06-26）
- `server.js` 重构前: **1068 行**
- `server.js` 重构后: **297 行** ✅
- 测试: **19 个测试文件，0 失败** ✅

## 验证标准（每条任务完成后必须满足）
1. `npm test` 全绿，0 失败
2. `node server.js` 能正常启动（Ctrl+C 退出）
3. server.js 行数减少
4. 新建的模块文件存在且有 `module.exports`

---

## Phase 1 — 纯函数提取（无外部依赖，最安全）

### 任务 1: `lib/venue-impact.js`

**涉及文件：**
- 源：`server.js` 第 149-289 行
- 目标：新建 `lib/venue-impact.js`

**要做什么：**
把 server.js 中 7 个场地/天气影响分析函数原样搬到 `lib/venue-impact.js`，用 `module.exports` 导出。然后在 server.js 中用 `const { calculateVenueImpact, analyzeStyleFit } = require('./lib/venue-impact')` 替换原有定义。最后把依赖注入注册（~836-866行）中传入的 `calculateVenueImpact` 和 `analyzeStyleFit` 改为 require 进来的引用。

**搬出的函数清单：**
- `calculateVenueImpact(venue, weather)` — 综合场地影响评分
- `analyzeGrassImpact(grass)` — 草皮类型影响
- `analyzeAltitudeImpact(altitude)` — 海拔影响
- `analyzeTemperatureImpact(temp)` — 温度影响
- `analyzeHumidityImpact(humidity)` — 湿度影响
- `analyzeWindImpact(windSpeed)` — 风速影响
- `analyzeStyleFit(venue, weather, style)` — 风格匹配分析

**边界：**
- 这 7 个函数全部是**纯函数**（无副作用、无外部依赖、不读文件、不调 API），可以直接搬
- 它们之间有内部调用关系（calculateVenueImpact 调 analyzeGrassImpact 等），必须一起搬，不能拆散
- 不能改动函数签名和返回值格式

**完成标志：**
- [x] `lib/venue-impact.js` 存在，导出 7 个函数
- [x] server.js 中不再有这 7 个函数的定义
- [x] server.js 行数: 1068 → 297（总计减少 771 行）
- [x] `npm test` 全绿
- [x] `node server.js` 正常启动

---

### 任务 2: `lib/lineup-coords.js`

**涉及文件：**
- 源：`server.js` 第 399-464 行
- 目标：新建 `lib/lineup-coords.js`

**要做什么：**
把阵型坐标数据和阵容排布函数搬到 `lib/lineup-coords.js`，用 `module.exports` 导出。在 server.js 中删除原定义，改为 require 引入。同时更新依赖注入注册中传入的 `assignLineupCoords`。

**搬出的内容清单：**
- `POS_MATCHUP` — 位置对位映射（GK→GK, CB→ST 等）
- `FORM_COORDS` — 5 种阵型的坐标模板（4-3-3, 4-4-2, 3-5-2 等）
- `POS_COORD_ALIASES` — 位置别名表（RCB→CB, LCM→CM 等）
- `assignLineupCoords(players, formation)` — 将球员分配到阵型坐标的函数

**边界：**
- 全部是**纯数据 + 纯函数**，零外部依赖
- POS_MATCHUP 和 FORM_COORDS 是常量表，assignLineupCoords 依赖它们，必须一起搬
- 不能改动 assignLineupCoords 的函数签名和返回值格式

**完成标志：**
- [x] `lib/lineup-coords.js` 存在，导出 4 项
- [x] server.js 中不再有 POS_MATCHUP / FORM_COORDS / POS_COORD_ALIASES / assignLineupCoords 的定义
- [x] `npm test` 全绿
- [x] `node server.js` 正常启动

---

## Phase 2 — 数据初始化提取（有依赖注入，需小心）

### 任务 3: `lib/team-data.js`

**涉及文件：**
- 源：`server.js` 第 73-91 行（resolveTeam, getPlayerRatingData）+ 第 291-376 行（数据表构建）+ 第 363-376 行（getTeamNameZh, getTeamNameI18n）
- 目标：新建 `lib/team-data.js`

**要做什么：**
创建 `lib/team-data.js`，导出一个 `init(deps)` 初始化函数和若干查找接口。init 接收 `{ loader, teamResolver, idBridge, PLAYER_RATINGS }` 作为参数，在内部构建 TEAM_NAMES、TEAM_FLAGS、TEAM_LOGOS、ELO_RANK_MAP 等查找表。导出 `getTeamNameZh(id)`、`getTeamNameI18n(id, fallback)`、`resolveTeam(input)`、`getPlayerRatingData(input)` 等查询函数。server.js 在数据加载完成后调用 `teamData.init({...})`，然后从 teamData 拿各查找表和函数使用。

**搬出的内容清单：**
- TEAM_NAMES / TEAM_FLAGS / TEAM_LOGOS 构建逻辑（从 RATINGS + ID_MAP + PLAYER_RATINGS + idBridge 四个来源合并）
- ELO_RANK_MAP 构建逻辑（按 rating 排序生成排名）
- `getTeamNameZh(id)` / `getTeamNameI18n(id, fallback)` — 双语队名查询
- `resolveTeam(input)` — 团队标识解析
- `getPlayerRatingData(input)` — 球员评分数据查询

**边界：**
- 这些逻辑有**顺序依赖**：必须先加载 RATINGS → 再构建 TEAM_NAMES → 再用 ID_MAP 覆盖 → 再用 PLAYER_RATINGS 补充 → 再用 idBridge 补充。顺序不能乱
- TEAM_NAMES_ZH 由 loader.getTeamNames() 提供，init 时作为参数传入
- 导出的查找表（TEAM_NAMES 等）必须是**同一个引用**，因为后续 routes 里直接读取这些对象
- 不要改动任何查找表的 key 格式（espn_id、fifa_code 等）

**完成标志：**
- [x] `lib/team-data.js` 存在，有 init 函数 + 查询接口
- [x] server.js 中不再有 TEAM_NAMES/FLAGS/LOGOS/ELO_RANK_MAP 的构建逻辑和 getTeamNameZh 等函数定义
- [x] server.js 行数: 929 → 844（减少 85 行）
- [x] `npm test` 全绿
- [x] `node server.js` 正常启动

---

## Phase 3 — 内联路由迁移到 lib/routes/

### 任务 4: health 路由去重

**涉及文件：**
- 源：`server.js` 第 466-482 行（内联 health 路由）
- 参考：`lib/routes/health.js`（已有模块化版本）

**要做什么：**
先读 `lib/routes/health.js`，确认它是否已经覆盖了 server.js 内联版本的功能（DB 健康检查 + 返回 status/db/time）。如果已覆盖，直接删除 server.js 466-482 行的内联定义。如果未覆盖，将内联逻辑合并到 lib/routes/health.js 中再删除。

**边界：**
- health 路由是**安全网**（server.js 注释明确写了），删除前必须确认模块化版本能正确响应
- 模块化版本通过 registerRoutes 注册，会覆盖同路径的内联路由，所以实际上内联版本已经是死代码
- 删除后 server.js 的 routes 对象初始化仍需保留（`const routes = {}` 或类似结构），因为其他代码依赖它

**完成标志：**
- [x] server.js 中不再有 `'GET /health'` 的内联定义
- [x] `lib/routes/health.js` 正确处理健康检查
- [x] `npm test` 全绿
- [x] `node server.js` 正常启动

---

### 任务 5: `lib/routes/coach.js`

**涉及文件：**
- 源：`server.js` 第 485-544 行
- 目标：新建 `lib/routes/coach.js`
- 注册点：`lib/routes/index.js`（registerRoutes 函数）

**要做什么：**
把 coach-compare 路由 handler 提取到 `lib/routes/coach.js`。该文件导出一个函数，接收 `registerRoute` 和依赖对象 `{ routes }` 作为参数，用 `registerRoute('GET /api/coach-compare/:teamA/:teamB', handler)` 注册。在 `lib/routes/index.js` 中 require 并调用这个模块。

**搬出的路由：**
- `GET /api/coach-compare/:teamA/:teamB` — 教练对比分析（风格克制、经验差距、临场调整评分）

**边界：**
- 这个路由内部调用了 `routes['GET /api/coach/:teamId']`（复用已有教练路由），必须通过依赖注入拿到 routes 对象
- 返回值格式不能变：`{ coachA, coachB, comparison: { styleMatchup, experienceGap, adjustmentEdge, overallScore } }`
- 返回值包含 i18n 字段（styleMatchupI18n 等），中英文都要保留

**完成标志：**
- [x] `lib/routes/coach.js` 存在
- [x] server.js 中不再有 coach-compare 路由定义
- [x] `npm test` 全绿
- [x] `node server.js` 正常启动

---

### 任务 6: `lib/routes/ask.js`

**涉及文件：**
- 源：`server.js` 第 547-612 行
- 目标：新建 `lib/routes/ask.js`
- 注册点：`lib/routes/index.js`

**要做什么：**
把 POST /api/ask 路由 handler 提取到 `lib/routes/ask.js`。该 handler 是 AI 问答接口，内部调用 `getPlayerRatingData`、`getTeamNameZh`、`routes['GET /api/matchup-spatial/:home/:away']` 获取数据，然后用规则引擎生成回答。提取后这些依赖通过 registerRoutes 的 deps 对象注入。

**搬出的路由：**
- `POST /api/ask` — AI 问答（谁会赢、关键对位、战术分析、通用回答）

**边界：**
- handler 内部有对 `routes['GET /api/matchup-spatial/:home/:away']` 的动态调用（关键对位分析时），需要通过 deps 拿到 routes 对象
- `getPlayerRatingData` 和 `getTeamNameZh` 也必须通过 deps 注入
- 返回值格式不能变：`{ answer, matchId, homeId, awayId }`
- 问答逻辑是规则引擎（if/else），不是外部 API 调用，整体搬迁即可

**完成标志：**
- [x] `lib/routes/ask.js` 存在
- [x] server.js 中不再有 POST /api/ask 路由定义
- [x] `npm test` 全绿 (283 assertions, 0 failures)
- [x] `node server.js` 正常启动

---

### 任务 7: `lib/routes/recent.js`

**涉及文件：**
- 源：`server.js` 第 638-830 行
- 目标：新建 `lib/routes/recent.js`
- 注册点：`lib/routes/index.js`

**要做什么：**
把 recent-matches 和 recent-stats 两个路由 handler 提取到 `lib/routes/recent.js`。这两个路由逻辑最复杂——需要读取 schedule 数据、按日期查找 ESPN scoreboard、聚合 boxscore 统计。提取后通过 deps 注入 `{ getCached, setCache, espn, loader, parseEvent }`。

**搬出的路由：**
- `GET /api/team/:id/recent-matches` — 球队近期比赛列表（从 schedule + ESPN 组合）
- `GET /api/team/:id/recent-stats` — 球队近期比赛统计聚合（从 ESPN boxscore 汇总平均值）

**边界：**
- 这两个路由共享 `isPast()` 判断逻辑和 `toESPNDateKey()` 日期转换，提取时可以作为模块内部的共用函数
- recent-stats 内部调用 ESPN summary API（`/summary?event=...`），需要通过 deps 注入 espn 函数
- 两者都使用 cache（getCached/setCache），通过 deps 注入
- 返回值格式不能变（matches 数组结构、stats 聚合结构）
- `parseEvent` 是 server.js 中的函数，需要通过 deps 传入

**完成标志：**
- [x] `lib/routes/recent.js` 存在，导出两个路由注册
- [x] server.js 中不再有 recent-matches 和 recent-stats 路由定义
- [x] server.js 行数: 297行（目标≤300）
- [x] `npm test` 全绿 (283 assertions, 0 failures)
- [x] `node server.js` 正常启动

---

### 任务 8: lineups/substitutions 路由去重

**涉及文件：**
- 源：`server.js` 第 615-636 行
- 参考：`lib/routes/lineups.js`（如已存在）

**要做什么：**
先检查 `lib/routes/` 目录下是否已有 lineups 或 match 相关路由模块覆盖了 `/api/match/:id/lineups` 和 `/api/match/:id/substitutions`。如已覆盖，直接删除 server.js 内联版本。如未覆盖，创建 `lib/routes/lineups.js` 并通过 registerRoutes 注册。

**边界：**
- lineups 路由调用 `getMatchLineups(matchId)`（来自 lib/fifa_scraper）
- substitutions 路由调用 `lineupsSource.getSubstitutions(matchId)`（来自 lib/lineups-source）
- 两个路由功能独立，但路径前缀相同（`/api/match/:id/`），适合放在同一个文件

**完成标志：**
- [x] server.js 中不再有 lineups 和 substitutions 的内联路由定义
- [x] 对应功能在 lib/routes/ 中有模块化实现
- [x] `npm test` 全绿
- [x] `node server.js` 正常启动

---

## Phase 4 — 收尾清理

### 任务 9: server.js 瘦身确认

**涉及文件：**
- 目标：`server.js`

**要做什么：**
通读 server.js 全文，确认只剩以下内容：
1. 环境变量加载（.env + process.env）
2. 数据目录初始化
3. 基础设施模块 require（loader、middleware、services）
4. 数据文件加载（PLAYER_RATINGS、idBridge）
5. teamData.init() 调用
6. routes 对象初始化 + registerRoutes 调用
7. matchRoute 路由匹配函数
8. MIME 类型 + serveStatic + safeStaticPath
9. HTTP server 创建（CORS → rateLimit → parseBody → route match → static → SPA fallback）
10. feature gates 断言
11. server.listen + 后台任务启动
12. shutdown 函数 + SIGINT/SIGTERM 处理

**边界：**
- 不允许有注释掉的旧代码残留
- 不允许有未使用的 require
- routes 对象中只能有 `registerRoutes` 注入的路由，不能有内联定义的路由
- 目标行数 ≤ 300

**完成标志：**
- [x] server.js 行数 ≤ 300 (实际 297 行)
- [x] `grep -c 'function ' server.js` 只剩 matchRoute / serveStatic / safeStaticPath / shutdown / bjt / bjtShort / parseEvent
- [x] `npm test` 全绿 (283 assertions, 0 failures)
- [x] `node server.js` 正常启动
- [x] 无 `// TODO` 或注释掉的旧代码
