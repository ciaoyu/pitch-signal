# Git 仓库清理待办清单

## 问题 1：21 个未提交文件（+1804/-1169 行）

**现状：**
- 25 个文件改动（含 server.js 拆解、cors/auth 修复、UI 改动等）
- 混合了多个不相关功能，直接 commit 历史会很脏

**方案：拆分为 3-4 个语义化 commit**

### Commit A: server.js 重构 + 安全修复
```
refactor(server): extract 6 modules from server.js (1068→297 lines)
```
- [ ] `server.js`（297 行，已瘦身）
- [ ] `lib/venue-impact.js`（新建）
- [ ] `lib/lineup-coords.js`（新建）
- [ ] `lib/team-data.js`（新建）
- [ ] `lib/routes/coach.js`（新建）
- [ ] `lib/routes/ask.js`（新建）
- [ ] `lib/routes/recent.js`（新建）
- [ ] `lib/routes/index.js`（更新注册）
- [ ] `middleware/cors.js`（删除硬编码 LAN IP）
- [ ] `middleware/auth-write.js`（加拒绝日志）
- [ ] `render.yaml`（删除废弃 GEMINI_API_KEY）
- [ ] `docs/server-refactor-checklist.md`（新建）

### Commit B: 依赖更新
```
chore(deps): update package-lock.json
```
- [ ] `package.json`
- [ ] `package-lock.json`

### Commit C: 前端改动（如有独立功能）
```
feat(ui): update match renderers and bot UI
```
- [ ] `static/js/match-renderers.js`
- [ ] `static/js/bot.js`
- [ ] `templates/index.html`
- [ ] `static/css/tailwind-output.css`
- [ ] `static/manifest.json`

### Commit D: 其他功能改动
```
feat: update prediction, matchup-spatial, and bot knowledge base
```
- [ ] `lib/prediction.js`
- [ ] `lib/poisson.js`
- [ ] `lib/matchup-spatial.js`
- [ ] `lib/team_resolver.js`
- [ ] `lib/routes/bot.js`
- [ ] `lib/routes/matchup.js`
- [ ] `lib/routes/standings.js`
- [ ] `lib/services/PredictionService.js`
- [ ] `lib/jobs/index.js`
- [ ] `lib/botKnowledgeBase.js`（新建）
- [ ] `scripts/test-matchup-spatial.js`
- [ ] `scripts/test-post-match-review.js`

**边界：**
- 每个 commit 必须能独立通过 `npm test`
- commit 前先 stash 暂存，逐组 add + commit
- 图标文件 `static/icon-192.png` / `static/icon-512.png` 被删除，确认是否有替代文件（icon-192-v3.png / icon-512-v3.png）再决定是否一起提交

**完成标志：**
- [ ] `git status` 只剩 untracked 文件（无 modified）
- [ ] 每个 commit message 有语义前缀（refactor/chore/feat/fix）
- [ ] `npm test` 全绿

---

## 问题 2：历史 CSV 输入目录需要脱离仓库根目录

**现状：**
- 3 个 CSV 文件属于本地历史数据输入：WorldCupMatches.csv、WorldCupPlayers.csv、WorldCupsSummary.csv
- 旧目录名 `world cup data/` 含空格，不适合继续作为项目根目录结构的一部分
- 属于数据探索输入，不应在公开仓库中

**方案：**
- [ ] 将文件保存在 `data/sources/world-cup-history/`
- [ ] `git rm --cached "data/sources/world-cup-history/WorldCupMatches.csv" "data/sources/world-cup-history/WorldCupPlayers.csv" "data/sources/world-cup-history/WorldCupsSummary.csv"`
- [ ] `.gitignore` 中加 `data/sources/world-cup-history/`
- [ ] 单独 commit：
  ```
  chore: untrack historical world cup CSVs (moved under data/sources)
  ```

**完成标志：**
- [ ] `git ls-files "data/sources/world-cup-history/"` 返回空
- [ ] `.gitignore` 包含 `data/sources/world-cup-history/`
- [ ] 文件仍在本地磁盘（`git rm --cached` 不删本地）

---

## 问题 3：未 tracked 目录/文件缺少 .gitignore 条目

**现状：**
- `scratch/`、`docs/archive/`、`data/sources/seed/`、`data/lineups_sync_runs.json` 未 tracked 也未 ignore
- 容易被 `git add .` 误提交

**方案：`.gitignore` 中追加**
```
# 临时/探索性文件
scratch/
docs/archive/

# 数据探索产物
data/sources/seed/
data/lineups_sync_runs.json

# AI 工具本地配置
.codebuddy/
.workbuddy/

# 临时文件
scratch/previews/
docs/archive/
docs/deployment-strategy.md
*.bak
templates/*.bak
static/css/*.bak
```

**完成标志：**
- [ ] `git status` 中上述文件不再出现为 untracked
- [ ] 本地文件不受影响（只是不再被 git 追踪）

---

## 问题 4：缺少 LICENSE 文件

**现状：**
- `package.json` 声明 `"license": "ISC"` 但无 LICENSE 文件

**方案：**
- [ ] 创建 `LICENSE` 文件，内容为 ISC license 全文
- [ ] 加入 commit A 或单独 commit：
  ```
  docs: add ISC LICENSE file
  ```

**完成标志：**
- [ ] `LICENSE` 文件存在
- [ ] 内容与 ISC 规范一致（copyright holder 需确认）

---

## 问题 5：version.json 日期不一致

**现状：**
- `version.json`: `"version": "20260627"`，但 `"updated": "2026-06-24T21:29:33.460Z"`
- 今天是 2026-06-26，version 写的是明天的日期

**方案：**
- [ ] 确认 version 字段的生成规则（手动？CI？build 脚本？）
- [ ] 如为手动，改为 `20260626` 或等到明天
- [ ] 如为自动，修复生成脚本使其取当天日期

**完成标志：**
- [ ] `version.json` 的 version 与 updated 日期逻辑一致
