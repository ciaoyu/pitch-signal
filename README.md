# ⚽ PitchSignal

**PitchSignal** is a comprehensive analytics dashboard for the 2026 FIFA World Cup, featuring real-time standings, match predictions using Poisson and Elo models, spatial matchups, and interactive bracket visualizations.

## 🌟 Key Features
- **Live Match Integration**: Fetches real-time fixtures, scores, and standings from the ESPN API.
- **Advanced Predictive Analytics**: Uses a custom Dixon-Coles adjusted Poisson model + Elo ratings to calculate win/draw/loss probabilities for upcoming matches.
- **Interactive Knockout Bracket**: Visualizes the 32-team knockout stage based on official 2026 format rules.
- **Spatial Matchups**: Simulates team formations and head-to-head positional clashes.
- **Real-time Team Stats**: Extracts squad data to provide real-time average age, coach info, and form.

## 🚀 Getting Started

### Prerequisites
- Node.js (v22 recommended)
- npm

### Installation
```bash
npm install
```
*(If you run into `better-sqlite3` native binding errors after syncing across devices, run `npm rebuild better-sqlite3`)*

### Running the Server
```bash
npm start
```
The application will be accessible at `http://127.0.0.1:5099`

### Testing
```bash
npm test
```
Runs the test suites for Prediction Models, Elo rating, and Poisson distribution logic.

## 📂 Project Structure
- `/lib` - Core business logic: `db.js`, `elo.js`, `poisson.js`, `prediction.js`
- `/lib/routes` - Modularized API handlers for entities, predictions, news, and core data.
- `/static` - Frontend JS, CSS, and SVG assets.
- `/templates` - Single Page Application HTML.
- `/data` - Static JSON files (brackets, base ratings, offline scrape data).
- `/data/sources/world-cup-history` - Local historical CSV inputs used for H2H enrichment.
- `/scripts` - Utilities for data scraping (e.g., Transfermarkt values).
- `/middleware`, `/services` - HTTP middleware and domain services.

## 🚢 Deployment

### Railway (Recommended)

1. Create a Railway project and connect the GitHub repository.
2. Add a **volume** at mount path `/usr/src/app/data` (SQLite + snapshots + runtime JSON).
3. Set environment variables (see below).
4. Railway auto-detects the `Dockerfile`.

### Docker (Self-hosted)

```bash
docker build -t pitch-signal .
docker run -p 5099:5099 -v $(pwd)/data:/usr/src/app/data pitch-signal
```

> ⚠️ SQLite does not support multiple instances. Set `numInstances: 1` (Railway) or `replicas: 1` (compose).

## 🔐 Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `5099` | Server port |
| `NODE_ENV` | No | `development` | `production` enables stricter security |
| `DATA_PATH` | No | `./data` | SQLite + snapshots directory. Must be on a persistent volume in deployed environments. |
| `DB_PATH` | No | `${DATA_PATH}/predictions.db` | Override SQLite database path |
| `CORS_ORIGINS` | No | `localhost:5099` | Comma-separated allowed browser origins |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per rate-limit window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit window in milliseconds |
| `ODDS_API_KEY` | No | — | the-odds-api.com key |
| `OWM_API_KEY` | No | — | OpenWeatherMap key (venue weather) |
| `BALLDONTLIE_API_KEY` | No | — | balldontlie.io roster/stats enrichment |
| `TAVILY_API_KEY` | No | — | Tavily search (AI post-match research) |
| `ANTHROPIC_API_KEY` | No | — | AI post-match review (experimental, beta disabled) |
| `ADMIN_TOKEN` | **Beta: must be unset** | — | Fallback token for protected endpoints |
| `BOT_API_TOKEN` | **Beta: must be unset** | — | Bot chat endpoint token |
| `WRITE_API_TOKEN` | **Beta: must be unset** | — | Write endpoint token |
| `POLYMARKET_ENABLED` | **Beta: must be `false`** | `false` | Market odds fusion |
| `PUNDIT_ENABLED` | **Beta: must be `false`** | `false` | Pundit opinion aggregation |
| `AUTO_CALIBRATION` | **Beta: must be `false`** | `false` | Auto parameter calibration |
| `AI_POSTMORTEM_ENABLED` | **Beta: must be `false`** | `false` | Background AI post-match review worker |
| `PRE_SNAPSHOT_MINUTES` | No | `30` | Minutes before kickoff to take prediction snapshot |
| `GROUP_POST_MINUTES` | No | `120` | Minutes after group match to post review |
| `KNOCKOUT_POST_MINUTES` | No | `180` | Minutes after knockout match to post review |
| `ANALYSIS_DELAY_MINUTES` | No | `10` | Delay before running post-match analysis |

> **Public Beta**: All three security tokens must be unset → anonymous write returns 401.
> All three feature gates are force-overridden to `false` at startup.
> See `docs/operations/public-beta-safety-manual.md` for details.

## 📖 API Reference

Full endpoint documentation: **[docs/API.md](docs/API.md)**

Quick overview:

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Core | `/api/scores`, `/api/standings`, `/api/schedule`, `/api/match/:id` | Fixtures, scores, standings |
| Prediction | `/api/elo/*`, `/api/match-review/*`, `/api/post-match-review/*` | Elo rankings, predictions, reviews |
| Entities | `/api/player/:id`, `/api/team/:id`, `/api/coach/:teamId` | Player/team/coach profiles |
| Matchup | `/api/h2h/*`, `/api/matchup/*`, `/api/analysis/*` | Head-to-head, formations, spatial |
| News | `/api/match/:id/news`, `/api/news/search` | Match news, search |
| Bot | `POST /api/bot/chat` | AI Q&A (requires auth token) |
| Odds | `/api/odds/*`, `/api/odds-alerts` | Betting odds (mock when no API key) |
| Venue | `/api/venue/:id`, `/api/venue/:id/weather` | Stadium info, weather |
| Health | `GET /health` | Readiness check (503 on DB failure) |

## 📚 Documentation

- **[docs/repository-layout.md](docs/repository-layout.md)** - Where to put new files and which docs stay internal
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
- **[ENVIRONMENT.md](ENVIRONMENT.md)** - Environment variables and key hygiene
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[docs/API.md](docs/API.md)** - Full API reference
- **[docs/VERSIONING.md](docs/VERSIONING.md)** - Static asset / cache versioning strategy
- **[docs/prediction_model_explanation.md](docs/prediction_model_explanation.md)** - How the prediction model works
- **[docs/deployment-guide-railway.md](docs/deployment-guide-railway.md)** - Railway deployment guide
- **[docs/operations/public-beta-safety-manual.md](docs/operations/public-beta-safety-manual.md)** - Public beta safety & gates

## ⚠️ Disclaimer

- **Experimental probability model.** Predictions come from a custom Dixon-Coles-adjusted Poisson + Elo model. Outputs are statistical estimates for analysis and entertainment only — they are **not guarantees** of any result.
- **Not betting advice.** Nothing in PitchSignal is gambling or investment advice. Do not use it to place bets.
- **Third-party data dependency.** Live fixtures, scores, standings, and squads are fetched from the **ESPN API** (plus optional OpenWeatherMap / odds providers). PitchSignal does not own this data; availability, accuracy, and coverage depend entirely on those upstream sources and may break or lag without notice.
- **Single-instance deployment.** Persistence uses **SQLite** (single-writer). Run exactly **one** instance — do not horizontally scale — and keep the data directory on a persistent volume.
