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
- `/scripts` - Utilities for data scraping (e.g., Transfermarkt values).
- `/docs/archive` - Historical planning and architecture documents.

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
| `ODDS_API_KEY` | No | — | the-odds-api.com key |
| `OWM_API_KEY` | No | — | OpenWeatherMap key (venue weather) |
| `ANTHROPIC_API_KEY` | No | — | AI post-match review (experimental, beta disabled) |
| `ADMIN_TOKEN` | **Beta: must be unset** | — | Fallback token for protected endpoints |
| `BOT_API_TOKEN` | **Beta: must be unset** | — | Bot chat endpoint token |
| `WRITE_API_TOKEN` | **Beta: must be unset** | — | Write endpoint token |
| `POLYMARKET_ENABLED` | **Beta: must be `false`** | `false` | Market odds fusion |
| `PUNDIT_ENABLED` | **Beta: must be `false`** | `false` | Pundit opinion aggregation |
| `AUTO_CALIBRATION` | **Beta: must be `false`** | `false` | Auto parameter calibration |

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

### Current Docs
- **[README.md](README.md)** - This file
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
- **[BACKLOG.md](BACKLOG.md)** - Current backlog and known issues
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[PROJECT.md](PROJECT.md)** - Project documentation
- **[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md)** - Development log

### Detailed Documentation
- **[docs/API.md](docs/API.md)** - Full API reference
- **[docs/operations/](docs/operations/)** - Operations guides and runbooks
- **[docs/archive/](docs/archive/)** - Historical planning and architecture documents

> **Note**: Stale planning documents, conflict files, and outdated reports have been moved to `docs/archive/` to keep the root directory clean.
