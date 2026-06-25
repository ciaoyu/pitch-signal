# Changelog

## v1.0.0-beta (2026-06)

### Public Beta

**Core Features**
- Live fixtures & scores (ESPN API)
- Group standings (12 groups, 48 teams)
- Knockout bracket visualization
- Elo + Poisson/Dixon-Coles probability predictions
- Spatial matchup analysis (formation simulation)
- AI post-match review (experimental, controlled access)
- AI Bot Q&A (controlled access, requires auth)

**Operational Safety**
- Polymarket / Pundit / AI auto-calibration: hard-disabled during beta
- All write endpoints gated behind auth tokens
- Readiness health check (503 on DB failure)
- Frontend prediction disclaimer (experimental model, not betting advice)
- Test database isolation (TEST_DB_PATH=:memory:)

**Known Limitations**
- Probability model is experimental — no accuracy metrics displayed
- Bot access is controlled (not public)
- AI post-match review translations pending

## v0.x (2026-05 ~ 2026-06)

### Development Phase
- Elo rating engine (dynamic K-factor, home advantage)
- Poisson/Dixon-Coles goal model
- ESPN API integration (scores, rosters, standings, news)
- Chinese team name mapping (team_names_zh.json)
- Team logo caching
- Coach database
- SVG formation diagrams
- Dark theme + animations
- Hash-based routing
- Post-match review engine
- Prediction snapshot system
- Walk-forward backtest framework
