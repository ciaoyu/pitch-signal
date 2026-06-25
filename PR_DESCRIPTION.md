# Retrospective Predictions + Security Hardening + UI Fixes

## Summary

为 47 场 `kickoff_passed` 比赛新增 **赛后回溯模拟 (retrospective prediction)** 通道，同时修复 API key 传输安全和前端重复展示问题。

> **Integrity statement**: `prediction_snapshots` 表仅保留 1 行合法赛前快照（match 760461），无任何伪造的 `created_at` 历史时间。47 场回溯预测存储在独立的 `retrospective_predictions` 表中，DB 字段、UI 标注和 AI prompt 均明确标识为 "赛后回溯模拟"，不与赛前快照混淆。

## Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | `c1da365` | feat | Add retrospective predictions for missed pre-match snapshots |
| 2 | `922d8fb` | fix | Harden api key transport and demo bot access |
| 3 | `99a4ba0` | fix | Remove duplicate h2h block and improve ai postmortem display |
| 4 | `059def3` | fix | Handle bilingual notes in eventFilter tests and escape predictionSnapshotNote |

## What changed

### 1. Retrospective Predictions (c1da365)

**Problem**: 47 场 kickoff_passed 比赛没有赛前快照，post-match review 无法进行模型输出与赛果偏差分析；不能作为赛前预测准确率评估。

**Solution**: 新增 `retrospective_predictions` 独立表，使用本地 PredictionEngine (Elo + Poisson + Dixon-Coles) 为每场比赛生成当前模型的回溯模拟预测。

- `lib/db.js` — 新增 `retrospective_predictions` 表 (ALLOWED_TABLES + CREATE TABLE + 3 helper functions)
- `lib/postMatchReview.js` — 无赛前快照时自动回退到 retrospective 预测，注入 `predictionSource` 和 `predictionSnapshotNote`
- `scripts/generate-ai-postmortem.js` — 传播 `predictionSource` 到 AI prompt 上下文
- `scripts/backfill-retrospective-predictions.js` — 回填脚本，47 场比赛独立预测（非统一假数据）
- `lib/eventFilter.js` — 新增中英文双语 notes（门将失误、补水窗口、黄牌累积）

**Key design decisions**:
- `prediction_snapshots` 表完全不动，`created_at` 无伪造
- 回溯预测存入独立的 `retrospective_predictions` 表
- `predictionSource: 'pre_match' | 'retrospective'` 字段贯穿整个 review pipeline
- UI 展示黄色警告横幅："⚠️ 本预测为赛后当前模型回溯模拟（非赛前快照）"
- AI postmortem prompt 明确标注 retrospective 语境，禁止使用 "our prediction" 等措辞
- `shouldUseSavedPostMatchReview` 缓存失效：当回溯预测可用时自动重新生成 review

**Data verification**:
- `retrospective_predictions`: 47 rows, 46 unique probability combinations
- `post_match_reviews`: 48 completed (47 retrospective + 1 pre-match)
- `prediction_snapshots`: 1 row (legitimate pre-match for 760461)

### 2. Security Hardening (922d8fb)

- `services/espn.js` — `fetchJSON` 支持 `options.headers` 参数
- `server.js` — ODDS_API_KEY 从 URL query param 迁移到 `x-api-key` header (2 locations)
- `lib/routes/venue.js` — OWM API 改用 `appid` query param（free tier 正确方式）
- `lib/routes/bot.js` — Demo 模式新增 per-IP rate limiter (5 req/min)
- **Deleted** `temp_routes.js` — 死代码，1486 行，含 `apiKey=${ODDS_API_KEY}` 暴露在 URL 中

### 3. UI Fixes (99a4ba0)

- `static/js/app.js` — 移除 renderHeadToHead 中重复的 "近期交锋" 区块（与 "对阵记录" 数据相同）
- 修复 momentum notes 渲染以支持 `{zh, en}` 双语对象
- AI postmortem 即使缺少中文翻译也展示 headline，附 "English Only" 标签
- `templates/index.html` — cache bust 更新

### 4. Test & XSS Fix (059def3)

- `scripts/test-eventFilter.js` — 5 个测试用例适配 bilingual notes 对象
- `static/js/app.js` — `predictionSnapshotNote` 输出包裹 `esc(i18nText(...))` 防 XSS

## Test Results

```
43 passed, 0 failed, 43 total
```

## Files Changed

```
lib/db.js                              |  70 +++++++-
lib/eventFilter.js                     |  15 +-
lib/postMatchReview.js                 |  81 ++++++++
lib/routes/bot.js                      |  32 ++
lib/routes/venue.js                    |  10 +-
scripts/backfill-retrospective-predictions.js | 185 ++++++++++++++++++++
scripts/generate-ai-postmortem.js      |   8 +-
scripts/test-eventFilter.js            |  17 +-
server.js                              |   8 +-
services/espn.js                       |   8 +-
static/js/app.js                       |  11 +-
templates/index.html                   |   2 +-
temp_routes.js                         | 1486 deleted
```

## Merge Checklist

- [x] `prediction_snapshots` 未伪造历史时间
- [x] 47 场回溯预测存储在独立 `retrospective_predictions` 表
- [x] DB/UI/AI 三重标注 "赛后回溯模拟，非赛前快照"
- [x] API key 不再暴露在 URL query param 中
- [x] temp_routes.js 安全隐患已删除
- [x] All tests pass (43/43)
- [x] XSS: predictionSnapshotNote 已 escape
