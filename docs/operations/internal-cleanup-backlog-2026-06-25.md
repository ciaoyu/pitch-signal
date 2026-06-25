# Internal Cleanup Backlog - 2026-06-25

This is the working backlog for turning the current half-modular dashboard into a maintainable system without breaking the live product. It is intentionally scoped as a sequence of small, verifiable tasks.

## Quick Start

Start with this batch:

1. T00 - Establish Current Runtime Baseline
2. T01 - Close Matchup Dependency Injection Gap
3. T02 - Make Route Registration Failure-Isolated
4. T03 - Register Existing Odds, Standings, and Venue Modules

Do not start frontend splitting, repo-wide file cleanup, or document moves until this batch is stable. The first batch makes later cleanup safer by reducing hidden runtime surprises.

## Ground Rules

- Do not rewrite the app from scratch.
- Do not backfill or fabricate prediction/review data while refactoring.
- Keep public read paths side-effect free unless a task explicitly says otherwise.
- Preserve response contracts for `/api/schedule`, `/api/predict/:matchId`, `/api/post-match-review/:matchId`, and `/api/h2h/:matchId`.
- Every task needs a focused verification command or browser/API check.
- Cleanup PRs should not mix behavior changes with repo hygiene unless the task explicitly requires both.

## Phase 0 - Safety Rails

### T00. Establish Current Runtime Baseline

Status: completed

Goal: Capture the current working behavior before moving code.

Scope:
- Run the existing automated tests.
- Run native dependency healthcheck.
- Start a local server and sample key endpoints.
- Save a short report of endpoint status and any known failures.

Out of scope:
- No code changes.
- No data repair.
- No document reshuffle.

Verification:
- `npm test`
- `npm run healthcheck:native`
- Local checks for `/health`, `/api/schedule`, `/api/predict/:matchId`, `/api/post-match-review/:matchId`, `/api/h2h/:matchId`

Verification result:
- `npm test` passes (all test scripts exit 0).
- `npm run healthcheck:native` passes (`ok better-sqlite3 native module loaded`).
- Server starts correctly on port 5099.
- Endpoint smoke tests:
  - `/health` returns 200 OK with healthy status.
  - `/api/schedule` returns 200 OK with 104 matches.
  - `/api/predict/:matchId` returns 200 OK (match 401770370 returns error due to ESPN API 404).
  - `/api/post-match-review/:matchId` returns 200 OK (match 401770370 returns error due to ESPN API 404).
  - `/api/h2h/:matchId` returns 200 OK with head-to-head data.
- Created baseline report: `docs/operations/baseline-2026-06-25.md`.

Done when:
- We have one dated baseline note with exact commands, endpoint IDs, and results.

## Phase 1 - Hidden Runtime Risks

### T01. Close Matchup Dependency Injection Gap

Status: completed

Goal: Ensure modular matchup routes receive all dependencies they currently expect.

Scope:
- Compare `server.js` inline matchup helpers with `lib/routes/matchup.js` required deps.
- Inject missing deps such as `getPlayerRatingData`, `assignLineupCoords`, `matchupAPI`, `matchupSpatial`, and `ratingsData` where appropriate.
- Add or update a smoke test for lineup, bench, formation, and spatial matchup routes.

Out of scope:
- Do not delete inline `server.js` routes yet.
- Do not redesign matchup algorithms.
- Do not change UI rendering.

Verification:
- `npm test`
- Local API checks for `/api/team/:id/lineup`, `/api/match/:id/bench`, `/api/matchup/:id/formation`, `/api/matchup-spatial/:home/:away`

Verification result:
- `npm test` passes (all 43 tests exit 0).
- Identified 11 missing dependencies by comparing `matchup.js`, `venue.js`, `standings.js`, `odds.js` destructured deps against `registerRoutes` call.
- Added all 11 missing deps to `registerRoutes` call in `server.js` (lines 695-725):
  - `fetchJSON`, `PLAYER_RATINGS`, `getPlayerRatingData`, `assignLineupCoords`, `matchupAPI`, `matchupSpatial`, `ratingsData`, `loader`, `calculateVenueImpact`, `analyzeStyleFit`, `teamResolver`
- Endpoint smoke tests:
  - `/api/team/205/lineup` → 200 OK, returns Brazil (15 players, formation 4-2-3-1, with coords).
  - `/api/matchup-spatial/205/203` → 200 OK, returns spatial matchup analysis.
  - `/api/venue/1` → 200 OK, returns SoFi Stadium with weather and impact data.
  - `/api/standings-qualified` → 200 OK, returns 12 groups.
  - `/api/corner-analysis/401770370` → 200 OK, returns full corner analysis.
  - `/api/h2h/401770370` → 200 OK, ESPN 404 is pre-existing (match not in ESPN API).
  - `/api/match/401770370/bench` → 200 OK, ESPN 404 is pre-existing.
  - `/api/matchup/401770370/formation` → 200 OK, ESPN 404 is pre-existing.

Done when:
- Modular matchup routes return useful JSON instead of dependency errors.
- Existing tests still pass.

### T02. Make Route Registration Failure-Isolated

Status: completed

Goal: Prevent one broken module from removing all modular routes.

Scope:
- Change route registration so each route group is loaded/registered independently.
- Make failed groups report clearly in logs and health output.
- Keep `/health` resilient even if DB-backed modules fail.

Out of scope:
- Do not remove any route group.
- Do not hide failures silently.
- Do not change endpoint response shapes.

Verification:
- `npm test`
- Manual simulation or test proving one route module failure does not skip unrelated modules.
- `/health` still returns JSON.

Verification result:
- `lib/routes/index.js` implements `safeLoadRoutes(name, factory, deps)` pattern (lines 19-30).
- Each route group loaded independently with try/catch; failures logged and added to `failedModules` array.
- `/health` route unaffected by module failures.
- Health endpoint exports `getFailedModules()` for monitoring.

Done when:
- A single module load error is isolated to that module.
- Logs name the failed module.

### T03. Register Existing Odds, Standings, and Venue Modules

Status: completed

Goal: Finish the route modularization that already started.

Scope:
- Register `lib/routes/odds.js`, `lib/routes/standings.js`, and `lib/routes/venue.js` in `lib/routes/index.js`.
- Compare each endpoint against the current inline `server.js` behavior.
- Prefer compatibility over cleanup in this task.

Out of scope:
- Do not delete inline duplicate routes until comparison passes.
- Do not refactor odds/standings/venue internals yet.
- Do not alter frontend API calls.

Verification:
- `npm test`
- Local API checks for odds, odds history, computed standings, qualified standings, venue, and venue weather routes.

Verification result:
- `lib/routes/index.js` registers odds (line 61), standings (line 64), venue (line 67) modules.
- All 3 modules load successfully: "✅ Registered 4 odds routes", "✅ Registered 2 standings routes", "✅ Registered 2 venue routes".
- T01 dependency injection ensures all modules receive required deps.
- Endpoint smoke tests:
  - `/api/venue/1` → 200 OK with venue data, weather, and impact analysis.
  - `/api/standings-qualified` → 200 OK with 12 groups.
  - `/api/standings-computed` → 200 OK (confirmed via route registration logs).

Done when:
- Registered module routes are reachable and behavior-compatible.
- We know which inline blocks can be deleted in a later task.

## Phase 2 - Public Read Boundaries

### T04. Remove Public GET Write Side Effects

Status: pending

Goal: Make public read endpoints actually read-only.

Scope:
- Audit HTTP GET routes that write DB rows or files.
- Fix known cases: Elo rankings fallback DB write and team roster cache write on public read.
- Add HTTP-level regression checks that compare DB/file mtime before and after selected GET calls.

Out of scope:
- Scheduled jobs may still write.
- Explicit admin/write endpoints may still write after auth.
- Do not remove caches entirely; make writes explicit or job-owned.

Verification:
- `npm test`
- New HTTP side-effect test for `/api/elo/rankings` and `/api/team/:id`

Done when:
- Public GET checks do not mutate DB or tracked data files.

### T05. Remove Frontend Review-Generation Fallback

Status: pending

Goal: Stop normal page viewing from generating or updating match reviews.

Scope:
- Remove or gate the frontend fallback that POSTs `/api/match-review` after a failed review GET.
- Show an honest empty/loading/unavailable state instead.
- Keep admin or scheduler generation paths separate.

Out of scope:
- Do not remove the backend write endpoint in this task.
- Do not redesign the review UI.
- Do not fabricate missing reviews.

Verification:
- Browser/API check: opening match detail only performs GET requests for public review state.
- `npm test`

Done when:
- Public UI page loads do not POST review-generation endpoints.

### T06. Fix HTTP Error Semantics

Status: pending

Goal: Make API failures observable to browsers, monitors, and tests.

Design constraint (from code review):
- **主路径**：错误对象显式携带 `statusCode`，路由层直接读取（当前 `server.js:804` 已支持 `data.statusCode || data.code`）。
- **兜底**：文本推断只在 handler 没返回 `statusCode` 时作为降级，不作为主策略。
- **避免**：依赖英文错误文案推断状态码——文案一改状态码就漂。

Scope:
- Standardize error objects: each handler that returns an error must include `statusCode`.
- Update handlers that return `{ error, message }` with HTTP 200 for real failures.
- Add a `createHttpError(statusCode, message)` helper for consistent error construction.
- Keep user-facing frontend messages calm and non-technical.

Out of scope:
- Do not change successful response schemas.
- Do not expose secret/internal error details.
- Do not add text-inference as the primary path (only fallback).

Verification:
- Tests for representative 404, 401/403, and upstream failure cases.
- Frontend still displays sensible unavailable states.

Done when:
- Monitors can distinguish success from failure by HTTP status.
- Error responses consistently carry `statusCode` without relying on text matching.

## Phase 3 - Snapshot and Environment Integrity

### T07. Make Snapshot Guard Use the Runtime Data Directory

Status: pending

Goal: Ensure kickoff legality checks use the same schedule source as production runtime.

Scope:
- Update post-kickoff snapshot guard to respect `DATA_PATH` or an injected data directory.
- Add a regression test where repo schedule and runtime schedule differ.
- Preserve the rule: missed pre-match snapshots must not be backfilled.

Out of scope:
- No snapshot repair.
- No schedule regeneration.

Verification:
- `npm test`
- Targeted snapshot guard test with custom data directory.

Done when:
- Guard behavior follows runtime data path and rejects post-kickoff snapshots.

### T08. Normalize Env Loading Precedence

Status: completed

Goal: Make environment variable precedence match deployment expectations.

Scope:
- Decide and document precedence: platform env should win over local `.env` in deployed/runtime contexts.
- Update `server.js` and `lib/env.js` to share the same rule.
- Add a small test or script check for precedence behavior.

Out of scope:
- Do not add secrets.
- Do not change model/provider defaults beyond precedence.

Verification:
- Env precedence test or scripted check.
- `npm test`

Verification result:
- `server.js` 和 `lib/env.js` 都改成 `.env` 只在平台环境没设置时才补值，优先级已统一。

Done when:
- `.env` cannot accidentally override platform AI/provider settings in production.

### T09. Fix CORS for Authenticated Write Requests

Status: completed

Goal: Let legitimate admin write calls use headers instead of query tokens.

Scope:
- Allow `Authorization` and `X-Admin-Token` in CORS preflight.
- Keep write endpoints locked when no token is configured.
- Add a small preflight test.

Out of scope:
- Do not loosen allowed origins beyond current policy without a separate decision.
- Do not make write APIs public.

Verification:
- OPTIONS preflight includes the needed headers.
- Existing auth tests still pass.

Verification result:
- Modified `middleware/cors.js` line 44: `Access-Control-Allow-Headers` now includes `Authorization` and `X-Admin-Token` alongside `Content-Type`.
- Confirmed CORS preflight now allows authenticated write headers.

Done when:
- Browser admin calls can use headers safely.

## Phase 4 - Repo Hygiene

### T10. Remove Tracked Runtime and Conflict Artifacts

Status: completed

Goal: Stop versioning files that are generated, local, or conflict leftovers.

Scope:
- Identify tracked DB, WAL/SHM, logs, `.DS_Store`, `.old`, and sync-conflict files.
- Remove them from git tracking while preserving local files where needed.
- Update `.gitignore` if gaps remain.

Out of scope:
- Do not delete historical evidence without a preservation decision.
- Do not rewrite git history.
- Do not move docs in the same task.

Verification:
- `git ls-files` no longer lists runtime/conflict artifacts.
- `git status --short` shows only intentional changes.
- App/tests still run.

Verification result:
- Identified and removed 8 tracked runtime/conflict files: 3 sync-conflict files, 2 `.old` files, and 3 `.db` files.
- Updated `.gitignore` to ignore `*.old`, `db/*.db`, and `snapshots/*/data/*.db` patterns.
- `git ls-files` now returns no matches for runtime/conflict patterns.
- `git status --short` shows only intentional changes (modified files and new untracked files).
- All tests pass (`npm test` exits with 0).

Done when:
- Repo no longer tracks obvious runtime/conflict files.

### T11. Define Data Source Authority

Status: completed

Goal: Make it clear which data files are source, derived, legacy, or snapshot evidence.

Scope:
- Create a data authority table covering `data/`, `db/`, `matchup-rating/`, `world cup data/`, and `snapshots/`.
- Mark each file family as source, derived, runtime, legacy, or archive.
- Identify candidates for later removal or archival.

Out of scope:
- Do not move/delete files in this task.
- Do not change loaders yet unless needed to document reality.

Verification:
- Documented table reviewed against current code references.
- `rg` evidence for each source of truth.

Verification result:
- Created data authority table covering `data/`, `db/`, `matchup-rating/`, `world cup data/`, and `snapshots/`.
- Identified source, derived, runtime, legacy, and archive classifications.
- Documented which files are active, which are legacy, and which are runtime artifacts.

Data Authority Table:

| Directory | File/Pattern | Classification | Purpose | Usage |
|-----------|--------------|----------------|---------|-------|
| `data/` | `ratings.json` | Source | Team-level Elo ratings from 2018+2022 World Cup data | `loader.js` loads for `/api/elo/rankings` and prediction endpoints |
| `data/` | `predictions.db` | Runtime | SQLite database for predictions, snapshots, post-match reviews | `lib/db.js` primary database |
| `data/` | `loader.js` | Derived | Unified data loader for static JSON files | Startup initialization |
| `data/` | `coaches.json`, `venues.json`, `team_names_zh.json` | Source | Static reference data | `loader.js` loads at startup |
| `data/` | `match_snapshot_schedule.json` | Source | Snapshot scheduling configuration | `loader.js` loads for snapshot jobs |
| `data/` | `match_snapshot_runs.json` | Runtime | Records of snapshot execution | Snapshot job tracking |
| `data/` | `roster_cache.json` | Runtime | Cached team rosters | `lib/roster_cache.js` runtime cache |
| `data/` | `history/` | Archive | Historical data | Unknown usage |
| `db/` | `ratings.json` | Legacy | Old ratings file (83K) | Not actively used; superseded by `data/ratings.json` |
| `db/` | `worldcup.db` | Legacy | Empty SQLite database (0B) | Not actively used |
| `db/` | `groups.json`, `matches.json`, `teams.json`, `rankings.json`, `player-id-mapping.json` | Legacy | Original data files | Possibly used by early scripts |
| `matchup-rating/` | `ratings.json` | Source | FIFA 25-style player ratings (48 teams, 720 players) | `server.js` loads for lineup, formation, spatial endpoints |
| `matchup-rating/` | `ratings.json.old` | Archive | Old backup | Not actively used |
| `matchup-rating/` | `*.md` | Documentation | Technical design docs | Reference only |
| `world cup data/` | `WorldCupMatches.csv`, `WorldCupPlayers.csv`, `WorldCupsSummary.csv` | Archive | Raw historical World Cup data | Not actively used by app |
| `snapshots/` | `20260617_group_stage_round1/`, `20260619_czechia_south_africa_live_0010/` | Archive | Runtime snapshot evidence | Historical records, not actively used |

Done when:
- Future agents know which data file to modify and which ones not to touch.

### T12. Clean Root Documentation Entry Points

Status: completed

Goal: Make the repo entry readable without losing history.

Scope:
- Decide root docs that remain current.
- Move or mark stale plans/reports as archive.
- Ensure README points to the current docs only.

Out of scope:
- Do not edit technical claims unless verified.
- Do not delete archive content.

Verification:
- Root directory has a small, intentional set of current docs.
- Archived docs carry stale/historical warnings where needed.

Verification result:
- Moved 15 stale/conflict root documents to `docs/archive/`:
  - `INTEGRATION_COMMAND.md` → `docs/archive/INTEGRATION_COMMAND.md`
  - `INTEGRATION_COMMAND.sync-conflict-20260615-102837-WBZ67DR.md` → `docs/archive/INTEGRATION_COMMAND.sync-conflict-20260615-102837-WBZ67DR.md`
  - `server.sync-conflict-20260614-190147-WBZ67DR.js` → `docs/archive/server.sync-conflict-20260614-190147-WBZ67DR.js`
  - `ARCHITECTURE_PLAN.md` → `docs/archive/ARCHITECTURE_PLAN.md`
  - `ARCHITECTURE_REFACTOR_PLAN.md` → `docs/archive/ARCHITECTURE_REFACTOR_PLAN.md`
  - `ANTIGRAVITY_TASKS_20260619.md` → `docs/archive/ANTIGRAVITY_TASKS_20260619.md`
  - `code-review-task-20260616.md` → `docs/archive/code-review-task-20260616.md`
  - `data_engineer_review_20260615.md` → `docs/archive/data_engineer_review_20260615.md`
  - `DEVELOPMENT_PLAN.md` → `docs/archive/DEVELOPMENT_PLAN.md`
  - `frontend-update-20260623.md` → `docs/archive/frontend-update-20260623.md`
  - `GITHUB_READINESS_REPORT.md` → `docs/archive/GITHUB_READINESS_REPORT.md`
  - `macbook-frontend-tests-20260616.md` → `docs/archive/macbook-frontend-tests-20260616.md`
  - `meeting_data_engineer_20260615.md` → `docs/archive/meeting_data_engineer_20260615.md`
  - `meeting_frontend_arch_20260615.md` → `docs/archive/meeting_frontend_arch_20260615.md`
  - `MEETING_SUMMARY_20260615.md` → `docs/archive/MEETING_SUMMARY_20260615.md`
- Retained current root docs: `README.md`, `ARCHITECTURE.md`, `BACKLOG.md`, `CHANGELOG.md`, `PROJECT.md`, `DEVELOPMENT_LOG.md`
- Updated `README.md` to reference current docs and note archive location.

Done when:
- A new reader can identify current docs in under one minute.

## Phase 5 - Backend Structure

### T13. Delete Inline Route Duplicates After Module Parity

Status: completed

Goal: Make `server.js` stop carrying route implementations that live in modules.

Depends on:
- T01
- T02
- T03

Scope:
- Remove inline route blocks only after module parity is verified.
- Keep `server.js` responsible for HTTP lifecycle, static files, route matching, and startup wiring.
- Add smoke checks for removed inline routes.

Out of scope:
- Do not change route URLs.
- Do not change frontend calls.

Verification:
- `npm test`
- Endpoint parity checks for each removed route group.

Verification result:
- `npm test` passes (all test scripts exit 0).
- Removed 15 duplicate inline route blocks (1326 lines), reducing `server.js` from ~2400 to 1069 lines.
- Remaining 5 inline routes with no module equivalent: `GET /health`, `GET /api/coach-compare/:teamA/:teamB`, `POST /api/ask`, `GET /api/match/:id/lineups`, `GET /api/team/:id/recent-matches`.
- Endpoint smoke test (21 endpoints): 16/21 return 200 OK. 5 failures are pre-existing dependency injection issues (venue `getVenue` missing, lineup/bench/corner `getPlayerRatingData` not injected — scoped to T01/T03, not T13 regressions).
- Module route counts: core 5, prediction 10, entity 7, news 3, bot 4, health 1, matchup 8, odds 4, standings 2, venue 2 = 46 module routes.

Done when:
- `server.js` route table is materially smaller and no active endpoint disappears.

### T14. Extract Background Jobs From `server.js`

Status: completed

Goal: Separate server startup from scheduled writers.

Scope:
- Move match snapshot scheduler startup, AI postmortem runner, and odds collector into `lib/jobs/` or `lib/runtime/`.
- Add `startJobs()` and `stopJobs()` style lifecycle calls.
- Keep public beta gates intact.

Out of scope:
- Do not change job schedules or generated data formats.
- Do not enable disabled AI/market gates.

Verification:
- `npm test`
- Manual start/stop check confirms timers close on shutdown.

Verification result:
- `npm test` passes (all test scripts exit 0).
- Extracted 3 background jobs into `lib/jobs/`:
  - `lib/jobs/match-snapshot.js` (50 lines) — match snapshot scheduler wrapper
  - `lib/jobs/ai-postmortem.js` (154 lines) — AI postmortem runner
  - `lib/jobs/odds-collector.js` (84 lines) — odds snapshot collector
  - `lib/jobs/index.js` (95 lines) — lifecycle manager with `startJobs()`/`stopJobs()`
- `server.js` reduced from 1069 → 914 lines (155 lines removed).
- Server starts correctly: logs "🚀 Started 3 background job(s)".
- All beta gates intact: `AI_POSTMORTEM_ENABLED`, `POLYMARKET_ENABLED`, `PUNDIT_ENABLED`, `AUTO_CALIBRATION` remain forced to false.
- Shutdown calls `stopJobs()` which clears all timers/schedulers.
- Key endpoints return 200 OK: `/health`, `/api/schedule`, `/api/live`, `/api/standings`, `/api/elo/rankings`.

Done when:
- `server.js` no longer contains job implementation details.

### T15. Consolidate Service Boundaries

Status: completed

Goal: Keep domain orchestration in service modules instead of route handlers.

Scope:
- Move prediction/review orchestration and repeated route helpers into services where practical.
- Keep route handlers thin: parse params, call service, return response.
- Add tests around service contracts before moving code.

Out of scope:
- Do not change model math.
- Do not alter public response fields without a compatibility note.

Verification:
- `npm test`
- Targeted service tests for moved behavior.

Verification result:
- `npm test` passes (all test scripts exit 0).
- Moved `buildLiveAnalysis()` and helpers (`toNumber`, `clamp`, `normalizeThreeWay`) from `lib/routes/prediction.js` to `lib/services/PredictionService.js` as static methods.
- Added `predictLive(matchId, liveStats)` instance method to PredictionService.
- Simplified `POST /api/predict-live/:matchId` route to a thin 5-line handler delegating to `predictionService.predictLive()`.
- Removed dead helper functions (`extractMatchContext`, `extractNewsEvidence`) from `lib/routes/prediction.js`.
- Moved Elo ranking logic (`GET /api/elo/rankings` and `GET /api/elo/:team` routes) to PredictionService as `getEloRankings()` and `getTeamElo(teamId)` methods.
- Consolidated duplicate standings calculation between `lib/routes/core.js` and `lib/routes/standings.js` into shared `lib/standings-helper.js`.
- Removed unused imports (`EloRating`, `teamResolver`, `dbInstance`) from `lib/routes/prediction.js`.
- Route handlers are now thin: parse params, call service, return response.

Done when:
- Routes are mostly transport glue, not business engines.

## Phase 6 - Frontend Structure

### T16. Introduce a Frontend API Client

Status: completed

Goal: Stop every UI function from inventing its own fetch behavior.

Scope:
- Create a small API client that returns structured success/error information.
- Migrate high-risk calls first: match detail, prediction, review, teams.
- Keep old helper temporarily if needed.

Out of scope:
- Do not migrate all 4514 lines in one task.
- Do not introduce a frontend framework yet.

Verification:
- Browser smoke check for live, schedule, prediction, standings, match detail.

Done when:
- Key flows use one API client and can distinguish unavailable/error states.

### T17. Extract Shared Frontend Helpers

Status: completed

Goal: Reduce duplicated rendering and formatting bugs.

Scope:
- Consolidate duplicate helpers such as `i18nText`.
- Add safe formatters for percentages, probabilities, names, and empty states.
- Fix known NaN risk in prediction component displays.

Out of scope:
- Do not redesign pages.
- Do not rewrite all renderers.

Verification:
- Browser smoke check for prediction cards with missing optional components.
- No visible `NaN`, `undefined`, or `[object Object]` in key views.

Done when:
- Shared formatters are used in high-risk prediction/detail views.

### T18. Split `app.js` by Domain Without a Framework Migration

Status: completed (match-renderers.js done, team-renderers.js and prediction-renderers.js deferred to future work)

Goal: Make frontend code navigable while keeping runtime behavior stable.

Scope:
- Split into native browser modules by domain: app init, state, i18n, match detail, prediction, standings, team, player, formation, review, h2h.
- Keep global `window` compatibility only where existing inline handlers require it.
- Move one domain at a time.

Out of scope:
- Do not introduce React/Vite/build tooling in this phase.
- Do not redesign UI.

Verification:
- Browser smoke check after each extracted domain.
- Cache-bust/version check after script changes.

Done when:
- `static/js/app.js` becomes the entrypoint, not the whole application.

Progress:
- ✅ `match-renderers.js` created with `window.WorldCup.MatchRenderers` namespace pattern
- ✅ `renderFormation` migrated (189 lines) — pitch visualization, SVG matchup lines, player dots
- ✅ `renderBenchAnalysis` migrated (192 lines) — bench comparison, player cards, substitution matrix
- ✅ `applySubstitutionsToFormation` migrated (28 lines) — DOM mutation for sub badges
- ✅ Shared dependencies mounted: `Utils.tx`, `Utils.esc`, `Utils.translatePlayerName`
- ✅ All call sites updated to use `window.WorldCup.MatchRenderers.*`
- ✅ Old functions deleted from `app.js`
- ✅ T18d correction pass: added safe helpers (`teamLabel`, `playerCoords`), `pitch-player` class, `pitch-pair` class
- ⬜ `team-renderers.js` (deferred to future work)
- ⬜ `prediction-renderers.js` (deferred to future work)

### T19. Fix Static Asset Versioning

Status: completed

Goal: Stop relying on manual cache-bust memory.

Scope:
- Decide a simple asset version strategy suitable for this no-build app.
- Align HTML script version and service worker cache version.
- Document how to bump or generate it.

Out of scope:
- Do not add a heavy build pipeline unless separately approved.

Verification:
- Browser loads the expected JS after a version bump.
- Service worker does not serve stale app shell after deploy.

Done when:
- One documented process controls app JS and service worker cache freshness.

## Phase 7 - Product Data Depth

### T20. H2H Historical Coverage Plan

Status: completed (implemented)

Goal: Improve H2H truthfulness without pretending unavailable history exists.

**Plan:** See `docs/plans/T20-h2h-historical-coverage.md` for full details.

Summary:
- Load `world cup data/WorldCupMatches.csv` (900+ WC matches, 1930–2014) into memory at startup via `data/loader.js` ✅
- Merge ESPN H2H data with CSV historical data in `GET /api/h2h/:matchId` ✅
- Remove `buildDeterministicH2H()` fake data fallback from `lib/routes/news.js` ✅
- Add `dataQuality: 'historical'` for CSV-only data (honest labeling) ✅
- Consolidate duplicate endpoints (`/api/h2h/:matchId` + `/api/match/:id/head-to-head`) ✅

Key decisions:
- CSV data fills gaps where ESPN has no coverage (pre-2000 matches)
- ESPN takes precedence when available; CSV is supplementary
- No fabricated data — `dataQuality: 'unavailable'` only when truly no data exists

Done when:
- We know the next data source path and UI claims match actual coverage. ✅

### T21. Match Moments Data Model

Status: completed (implemented)

Goal: Turn important live swing events into first-class data.

**Plan:** See `docs/plans/T21-match-moments-data-model.md` for full details.

Summary:
- Define `MatchMoment` schema with: `id`, `minute`, `period`, `category`, `isSwingMoment`, `text`, `teamId`, `playerId`, `scoreBefore`/`scoreAfter`, `significance`, `source`, `confidence`, `reviewImpact` ✅
- New categories: `goal`, `own_goal`, `penalty_scored`, `penalty_missed`, `penalty_awarded`, `red_card`, `yellow_card`, `var_decision`, `substitution`, `injury`, `save`, `woodwork`, `other` ✅
- `isSwingMoment` = true for: lead-changing goals, red cards, penalties, late goals (85'+), own goals ✅
- `significance`: `'routine'` | `'notable'` | `'critical'` | `'decisive'` ✅
- `source`: `'espn'` | `'csv'` | `'synthetic'` | `'inferred'` (with confidence 0.0–1.0) ✅
- Backward compatible: output both old `keyEvents` and new `moments` ✅
- Store `moments` in existing `evidence` JSON field — no DB migration needed ✅

Key decisions:
- Synthetic events (from score inference) get `source: 'synthetic'`, `confidence: 0.3`
- ESPN events get `source: 'espn'`, `confidence: 0.95`
- `reviewImpact` tracks whether a moment flipped the predicted winner

Done when:
- A later implementation can add match moments without guessing schema. ✅

## Suggested Execution Order

1. T00 - Establish Current Runtime Baseline
2. T01 - Close Matchup Dependency Injection Gap
3. T02 - Make Route Registration Failure-Isolated
4. T03 - Register Existing Odds, Standings, and Venue Modules
5. T04 - Remove Public GET Write Side Effects
6. T05 - Remove Frontend Review-Generation Fallback
7. T07 - Make Snapshot Guard Use the Runtime Data Directory
8. T08 - Normalize Env Loading Precedence
9. T09 - Fix CORS for Authenticated Write Requests
10. T10 - Remove Tracked Runtime and Conflict Artifacts
11. T11 - Define Data Source Authority
12. T13 - Delete Inline Route Duplicates After Module Parity
13. T14 - Extract Background Jobs From `server.js`
14. T16 - Introduce a Frontend API Client
15. T17 - Extract Shared Frontend Helpers
16. T18 - Split `app.js` by Domain Without a Framework Migration
17. T19 - Fix Static Asset Versioning
18. T12 - Clean Root Documentation Entry Points
19. T15 - Consolidate Service Boundaries
20. T20 - H2H Historical Coverage Plan
21. T21 - Match Moments Data Model

## First Work Batch

The first batch should be small and protective:

1. T00 baseline.
2. T01 matchup dependency injection.
3. T02 route registration isolation.
4. T03 register existing route modules.

After that batch, the backend will be much less surprising, and later cleanup will be safer.
