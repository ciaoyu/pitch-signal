# F: Player / Lineup / Availability / xG - Data Feasibility Audit

**Date**: 2026-07-10
**Baseline**: `78da1b5` (Owner A v4, clean pre-D state)
**Scope**: 4 data domains, shadow-only (must not enter public probability)
**Status**: ✅ Passed — data research phase complete. Awaiting real data.

## Methodology Notes (保留)

### Note 1: "75-minute lineup release" is a data-source contract assumption

The claim that FIFA publishes confirmed lineups ~75 minutes before kickoff
(MatchStatus = 12 "lineup_confirmed") is a **data-source contract hypothesis**
based on FIFA API documentation. When the sync pipeline is live:

- Save and timestamp the **raw API response** for every lineup fetch.
- Verify the actual release delay against kickoff time retrospectively.
- If the observed release is closer to kickoff (e.g. 30 min), the
  pre-match window in `lineups-sync-scheduler.js` must be tightened.

This assumption must not be treated as verified until production data
confirms it.

### Note 2: "xG useful from MD2" is a minimum-sample threshold, not proven gain

`getTeamXgProfile()` requires ≥2 matches to return non-null. MD2 is the
earliest point any team reaches that threshold. However:

- **Minimum sample ≠ predictive signal.** Two matches of xG data may be
  dominated by opponent quality, red cards, or game state.
- **xG must still pass OOS validation** before entering the model:
  - LogLoss comparison: Poisson-λ with xG blending vs. pure Elo-λ
  - Brier score on held-out matches
  - Calibration curve (reliability diagram) for xG-blended probabilities
- Until these comparisons are done against real tournament data, xG
  remains a **shadow-only research signal** regardless of sample size.

**Verdict**: All 4 domains are **shadow-eligible** but **zero have production-ready data today**. None may enter the model until each passes its own gate.

---

## 1. Players (IDs, Names, Photos)

### Data Source
- **Primary**: FIFA API → `player_id_bridge.json` (ESPN athlete ID ↔ local slug)
- **Fallback**: ESPN `/summary` endpoint athlete lists
- **Augmentation**: `player_name_zh.json` (manual Chinese names, exists in baseline ✅)

### License & Cost
- FIFA API: public, no key required, no rate limits
- ESPN: needs API access (project already has this)

### Current Status
| Artifact | Exists? | Records |
|---|---|---|
| `player_id_bridge.json` | ❌ | 0 |
| `player_name_zh.json` | ✅ | ~600 manual entries |
| Bridge seed script | ⚠️ `scripts/build-player-id-bridge.js` exists | Not run |

### Coverage
- 48 teams × ~26 players = ~1,248 players
- FIFA API returns full squad lists per match
- Can be bootstrapped by running the seed script across match data

### As-Of (Look-Ahead) Proof
- Squad lists locked 30 days before tournament (May 2026)
- In-tournament: FIFA publishes squad updates for injuries
- **Risk**: late withdrawals (injury replacements) may create stale data window of ≤24h

### Failure Modes
- ESPN athlete ID changes between tournaments (known issue with historical data)
- Non-latin names in FIFA API may not match ESPN display names
- Photo URLs from ESPN CDN may 404 for lesser-known players

### Verdict
**Shadow only** until bridge coverage ≥ 90% of 48 teams × 23 players.
Can be bootstrapped in hours. Not a data licensing blocker.

---

## 2. Lineups & Formations

### Data Source
- **Primary**: FIFA API official match feed (formation + player coordinates)
- **Static**: `lib/lineup-coords.js` - 5 formation templates (4-3-3, 4-4-2, 3-5-2, 3-4-2-1, 4-1-2-3)
- **Sync scheduler**: `lib/lineups-sync-scheduler.js` - polls FIFA API 15min pre-kickoff

### License & Cost
- FIFA API: free, public, official
- No third-party dependency

### Current Status
| Artifact | Exists? | Records |
|---|---|---|
| `lineups.json` | ❌ | 0 |
| `matches.json` | ❌ | 0 |
| `match_id_bridge.json` | ❌ | 0 |
| `player-ratings.json` | ❌ | 0 |

### Coverage Potential
- FIFA API returns `{ home: { tactics, players[] }, away: { tactics, players[] } }` per match
- 104 matches × 22 starters = 2,288 player-slot records
- Formation data: string like "4-3-3" directly from FIFA

### As-Of (Look-Ahead) Proof
- FIFA publishes lineups **~75 minutes before kickoff** (MatchStatus = 12 "lineup_confirmed")
- This is the official gate - same data broadcasters and betting markets use
- **No look-ahead leakage**: data becomes available at exactly the same moment for all consumers

### Failure Modes
- FIFA API may return `tactics: null` or empty `players[]` for matches before lineup lock
- Sync scheduler may miss the 75-min window → fallback to last-known formation
- Formation string normalization: FIFA may use "4-2-3-1" which isn't in our template set → defaults to 4-3-3

### Verdict
**Shadow only** until `lineups.json` has ≥ 5 matches with confirmed formations.
This is the **highest-value domain** - pre-match lineups are the single most predictive non-odds signal in football. But it needs live data, not pre-seeded.

---

## 3. Availability (Suspensions, Injuries, Fatigue)

### Data Source
- **Suspensions**: `lib/suspension.js` - pure rule engine against `player_match_events` DB
- **Injuries**: ❌ No dedicated source. FIFA API may include availability flags (TBD)
- **Fatigue**: ❌ No source. Would need minutes-played tracking

### License & Cost
- Suspensions: zero-cost (rule engine, no external data)
- Injuries: FIFA API or ESPN injury report (TBD if exists)

### Current Status
| Artifact | Exists? | Records |
|---|---|---|
| `player_match_events` DB table | ✅ (schema) | 0 |
| Suspension rule engine | ✅ `lib/suspension.js` | N/A |
| Injury data source | ❌ | N/A |
| Fatigue data source | ❌ | N/A |

### As-Of (Look-Ahead) Proof
- **Suspensions**: deterministic. After each match, compute who is suspended for the next round. No look-ahead.
- **Injuries**: FIFA publishes "availability" status per player. Need to confirm field exists in API response.
- **Fatigue**: can be derived from minutes played (lagging indicator, 3+ matches needed per team)

### Failure Modes
- Yellow card accumulation depends on correct event parsing from ESPN/FIFA
- FIFA double-reset rule (after group stage AND after QF) is 2026-specific - rules must match actual tournament
- Injury data may lag by 24-48h if FIFA doesn't surface it in the match feed
- "Questionable" / "doubtful" injury tags are subjective - no deterministic threshold

### Verdict
- **Suspensions**: shadow-ready today (pure rule engine). Can surface in display/bot only.
- **Injuries**: blocked on FIFA API inspection. May not exist.
- **Fatigue**: blocked until 3+ matches completed per team.

---

## 4. xG (Expected Goals)

### Data Source
- **Primary**: API-Football (`v3.football.api-sports.io`) - 100 req/day free tier
- **Key**: `API_FOOTBALL_KEY` env var required (status: **unknown** in production)
- **Collector**: `lib/jobs/xg-collector.js` - daily cron, disabled if no key

### License & Cost
- API-Football free tier: 100 requests/day
- Terms: non-commercial use, attribution required
- Commercial tier: paid plans available ($XX/month, TBD)

### Current Status
| Artifact | Exists? | Records |
|---|---|---|
| `API_FOOTBALL_KEY` | ❓ Unknown | N/A |
| `team_xg_stats` DB table | ✅ (schema) | **0** |
| xG for any WC2026 team | ❌ | 0 |

### Sample Size Constraint
- `getTeamXgProfile()` requires **≥ 2 matches** to return non-null
- With 48 teams × 3 group matches = 144 group-stage fixtures:
  - After group stage MD1: 0 teams eligible
  - After group stage MD2: up to 48 teams eligible (2 matches each)
  - After group stage MD3: all 48 teams eligible (3 matches each)
- xG data is **only useful starting MD2**, and only becomes robust after MD3
- For knockout rounds (R32 onward): 3-match sample is thin but usable

### Model Entry Path
- Currently: `getTeamXgProfile()` is defined but **never called** by `prediction.js`, `poisson.js`, or `elo.js`
- Designed to feed into Poisson λ blending (pre-match expected goals)
- Integration not yet built - this is purely data plumbing

### Failure Modes
- API-Football rate limit: 100 req/day. Each fixture stat call = 1 request. 48 matches/gameweek means key may expire
- WC_LEAGUE_ID and WC_SEASON env vars hardcoded to defaults (league=1, season=2026) - may not match API-Football's data
- API-Football team IDs ≠ ESPN team IDs - requires `id_map_center.json` crosswalk (exists ✅)
- 100 req/day free tier may be insufficient for 48-team tournament (104 matches total)
- Historical xG not available via free tier (only current season)

### Verdict
**Shadow only** until:
1. `API_FOOTBALL_KEY` confirmed set and valid in production
2. `team_xg_stats` has ≥ 10 matches of data
3. WC_LEAGUE_ID confirmed correct for World Cup 2026
4. Cross-walk from API-Football team ID → ESPN team ID verified for ≥ 20 teams
xG data will only become statistically meaningful from MD2 onward (July 2026).

---

## 5. Known Data Files: Presence Audit

| File | F Domain | Exists | Records | Notes |
|---|---|---|---|---|
| `player_id_bridge.json` | Players | ❌ | 0 | Seed script exists |
| `player_name_zh.json` | Players | ✅ | ~600 | Manual, Chinese names |
| `player-ratings.json` | Players | ❌ | 0 | Required by lineups-source |
| `lineups.json` | Lineups | ❌ | 0 | FIFA API sync target |
| `matches.json` | Lineups | ❌ | 0 | FIFA API sync target |
| `match_id_bridge.json` | Lineups | ❌ | 0 | ESPN ↔ FIFA cross-walk |
| `roster_cache.json` | Availability | ❌ | 0 | ESPN roster fallback |
| `player_match_events` DB | Availability | ✅ (schema) | 0 | Card tracking |
| `team_xg_stats` DB | xG | ✅ (schema) | 0 | API-Football target |

**Bottom line**: 7 of 9 data artifacts are empty. This entire research domain is at **Day 0 infrastructure stage**.

---

## 6. OOS Validation

None possible today - all data sources are empty.

| Domain | OOS Status | Earliest Possible |
|---|---|---|
| Players | N/A (no data) | After bridge bootstrap |
| Lineups | N/A (no data) | After 5+ matches synced |
| Suspensions | N/A (no events) | After 1+ match with cards |
| Injuries | N/A (no source) | After FIFA API inspection |
| xG | N/A (no data) | After MD2 (July 2026) |

---

## 7. Integrated Verdict

| Signal | Shadow Today? | Enter Model? | Gate |
|---|---|---|---|
| Player IDs & names | ✅ | ❌ | Bridge ≥ 90% coverage |
| Pre-match formation | ✅ | ❌ | 5+ matches with confirmed lineups |
| In-match formation change | ✅ | ❌ | Same as above + substitution events |
| Suspension (cards) | ✅ | ❌ | 1+ tournament match completed |
| Player injury/absence | ❌ | ❌ | FIFA API availability field confirmed |
| Player fatigue | ❌ | ❌ | 3+ matches per team |
| Team xG profile | ⚠️ (needs key) | ❌ | Key valid + 10+ matches |
| Player xG contribution | ❌ | ❌ | No player-level xG source |

**F does NOT block C/D/E**. All 4 F domains are independent and can be integrated incrementally as data becomes available.

Next immediate action: run the bridge bootstrap scripts to populate the player data artifacts.
