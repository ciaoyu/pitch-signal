# PitchSignal

2026 FIFA World Cup analytics dashboard — real-time standings, Poisson/Elo predictions, spatial matchups, bracket, bot Q&A, bilingual (ZH/EN), PWA.

## Quick Commands

```bash
npm install              # install deps (better-sqlite3 needs native rebuild)
npm start                # dev server on http://localhost:5099
npm test                 # run all test suites (19 files, ~400 assertions)
npm rebuild better-sqlite3   # fix native binding after device switch
```

## Architecture

- **server.js** (~300 lines) — HTTP server, route matching, static files, startup/shutdown. All business logic extracted to `lib/`.
- **lib/** — core logic: `db.js` (SQLite WAL), `elo.js`, `poisson.js`, `prediction.js`, `backtest.js`
- **lib/routes/** — modular route handlers, registered via `lib/routes/index.js`
- **lib/services/** — `PredictionService`, `ReviewService` (DB write paths)
- **lib/jobs/** — background schedulers (pre-match snapshots, post-match reviews)
- **middleware/** — `cors.js`, `auth-write.js`, `rate-limit.js`, `cache.js`, `body-parser.js`
- **static/** — frontend JS/CSS, PWA manifest, icons
- **templates/** — SPA entry (`index.html`)
- **data/** — JSON data files (ratings, venues, teams, match snapshots). SQLite DB lives here at runtime.
- **scripts/** — test files (`test-*.js`), data scraping, build helpers

## Testing

Tests live in `scripts/test-*.js`. The `npm test` runner executes them serially. Each test is a standalone Node script using `assert` (no test framework).

Integration tests (`test-post-match-review.js`) start a temporary server — they use SIGTERM for cleanup and poll `/health` for readiness.

## Key Conventions

- **Zero external frameworks** — no Express, no lodash. Hand-rolled router (~60 lines), hand-rolled middleware.
- **Dependency injection** — `lib/routes/index.js` receives all deps via a single `deps` object. Modules don't `require()` across boundaries freely.
- **Caching** — `middleware/cache.js` provides `getCached(key, ttlMs)` / `setCache(key, data)`. Hot read paths use this to avoid repeated DB/ESPN calls.
- **Feature gates** — `POLYMARKET_ENABLED`, `PUNDIT_ENABLED`, `AUTO_CALIBRATION` are all force-set to `false` at startup during public Beta. Code in `server.js` → `assertFeatureGates()`.
- **i18n** — team names in Chinese/English via `lib/team-data.js` → `getTeamNameZh()`, `getTeamNameI18n()`. Frontend renders both.
- **DB** — SQLite via `better-sqlite3` (synchronous). WAL mode. Single-instance only. `lib/db.js` exports a singleton connection.
- **No secrets in code** — all API keys and tokens come from env vars. `.env.example` is the source of truth for what's needed.
- **Repository layout** — follow [docs/repository-layout.md](docs/repository-layout.md) before adding or moving files.

## Data Flow

1. ESPN API → `services/espn.js` (with in-memory cache) → scores, standings, events
2. Ratings + Poisson → `prediction.js` → win/draw/loss probabilities
3. Spatial matchup → `matchup-spatial.js` → positional head-to-head analysis
4. Post-match review → `ReviewService` → writes to SQLite `post_match_reviews`
5. Pre-match snapshots → `lib/jobs/` → writes to SQLite `pre_match_snapshots`

## Deployment

- **Railway** (recommended): Dockerfile + `railway.toml`, volume at `/usr/src/app/data`
- **Render**: `render.yaml` (Blueprint)
- **Self-hosted Docker**: `docker build -t pitch-signal . && docker run -p 5099:5099 -v $(pwd)/data:/usr/src/app/data pitch-signal`

Never run more than one instance — SQLite doesn't support concurrent writers.
