# T20: H2H Historical Coverage Plan

**Status:** draft
**Created:** 2026-06-25

---

## 1. Current State

### Endpoints

| Endpoint | File | Used By |
|----------|------|---------|
| `GET /api/h2h/:matchId` | `lib/routes/matchup.js:9` | Frontend `app.js:1123` |
| `GET /api/match/:id/head-to-head` | `lib/routes/news.js:509` | Unknown (possibly unused) |

### Data Sources

| Source | Coverage | Status |
|--------|----------|--------|
| ESPN `/summary?event={matchId}` → `headToHeadGames` | Recent years only; spotty for pre-2000 and friendlies | **Active** — primary source |
| `world cup data/WorldCupMatches.csv` | 1930–2014, ~900 WC matches (Year, Teams, Score, Stage, Stadium) | **Not loaded** — sits unused |
| `buildDeterministicH2H()` (news.js) | Fake data seeded from team IDs | **Active** — fallback in `/api/match/:id/head-to-head` |

### Known Problems

1. **ESPN coverage is thin.** Many match pairs return empty `headToHeadGames`, showing `dataQuality: 'unavailable'` to the user.
2. **The CSV is unused.** `WorldCupMatches.csv` has 90+ years of verified World Cup match results but is never queried by the H2H route.
3. **Deterministic mock is misleading.** `buildDeterministicH2H()` generates fake scores and dates from a hash seed. It returns `dataQuality: 'estimated'` — users may treat fabricated scores as real.
4. **Two duplicate endpoints.** `/api/h2h/:matchId` and `/api/match/:id/head-to-head` do overlapping work with different fallback strategies.
5. **The TODO in matchup.js:40–42** explicitly notes: "TODO: Load local DB matches (with competition field)".

---

## 2. Goal

> Improve H2H truthfulness without pretending unavailable history exists.

**Non-goals:**
- Do not scrape new external sources in this task.
- Do not fabricate match data.

---

## 3. Proposed Solution

### 3A. Load `WorldCupMatches.csv` at startup

Add a CSV loader to `data/loader.js` that parses `world cup data/WorldCupMatches.csv` into an in-memory index keyed by `{homeTeam, awayTeam}` (normalized to lowercase).

```
// Index structure
h2hIndex = Map<string, Array<{
  year: number,
  stage: string,
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number,
  stadium: string,
  city: string,
  competition: 'World Cup'
}>>
```

Key: `normalize(homeTeam) + '|' + normalize(awayTeam)` (bidirectional — store both directions).

**Size:** ~900 rows, ~100KB in memory. Negligible.

### 3B. Merge ESPN + CSV in `GET /api/h2h/:matchId`

Update `lib/routes/matchup.js`:

1. Fetch ESPN H2H (existing logic).
2. Query `h2hIndex` for the current team pair.
3. Merge and deduplicate:
   - ESPN data takes precedence (has `gameDate`, `gameResult`).
   - CSV data fills gaps (pre-ESPN matches).
   - Deduplicate by year + approximate score (if both sources have the same match).
4. Set `dataQuality`:
   - `'live'` — ESPN data present and merged.
   - `'historical'` — only CSV data (no ESPN H2H, but local history exists).
   - `'unavailable'` — neither source has data.

Remove `buildDeterministicH2H()` from the primary path entirely.

### 3C. Deprecate deterministic mock

In `lib/routes/news.js`:
- Replace `buildDeterministicH2H()` with a call to the shared CSV loader.
- If no data exists, return `dataQuality: 'unavailable'` honestly.

### 3D. Consolidate endpoints

Decide whether to keep both endpoints or deprecate one:
- **Option A:** Deprecate `/api/match/:id/head-to-head` (news.js), redirect to `/api/h2h/:matchId`.
- **Option B:** Keep both but share the merge logic via a shared helper.

**Recommendation:** Option B — extract `buildH2HResponse(matchId, homeId, awayId)` into a shared service.

---

## 4. Response Contract

The merged response should preserve the existing shape for frontend compatibility:

```json
{
  "dataQuality": "live" | "historical" | "unavailable",
  "source": "ESPN" | "ESPN+CSV" | "CSV" | null,
  "matchId": "...",
  "homeTeam": "Brazil",
  "awayTeam": "Argentina",
  "homeId": "205",
  "awayId": "203",
  "grouped": {
    "worldCup": { "matches": [...], "stats": { "total": 5, "homeWins": 2, ... } },
    "other": { "subGroups": { "友谊赛": { "matches": [...], "stats": {...} } } }
  },
  "summary": { "home": {...}, "away": {...}, "totalMatches": 8, ... },
  "recentMatches": [...],
  "statistics": { "totalGoals": 0, "avgGoals": "0.0", ... }
}
```

**Key invariant:** `dataQuality: 'unavailable'` only when truly no data exists. Never fabricate.

---

## 5. Team Name Normalization

The CSV uses full English names (e.g., "Brazil", "Argentina") while ESPN uses team IDs. Need a mapping layer:

1. Load `data/team_names_zh.json` (already loaded).
2. Build a reverse map: `normalized name → ESPN ID`.
3. For CSV rows, match by normalized name to resolve ESPN IDs.

Alternatively, the `matchup-rating/ratings.json` contains `name` fields that can bridge.

---

## 6. Implementation Steps

| Step | Description | Files |
|------|-------------|-------|
| 1 | Add `loadH2HIndex()` to `data/loader.js` | `data/loader.js` |
| 2 | Export `getH2HIndex()` getter | `data/loader.js` |
| 3 | Add `buildH2HFromCSV(homeId, awayId)` helper to matchup routes | `lib/routes/matchup.js` |
| 4 | Merge ESPN + CSV in `GET /api/h2h/:matchId` | `lib/routes/matchup.js` |
| 5 | Update `dataQuality` logic to include `'historical'` | `lib/routes/matchup.js` |
| 6 | Replace `buildDeterministicH2H` in news.js with CSV lookup | `lib/routes/news.js` |
| 7 | Extract shared `buildH2HResponse()` if both endpoints are kept | new `lib/h2h-helper.js` or inline |
| 8 | Update frontend `renderHeadToHead` to handle `dataQuality: 'historical'` | `static/js/app.js` |
| 9 | Smoke test: `/api/h2h/{matchId}` for a known pair (e.g., Brazil vs Argentina) | manual |
| 10 | Verify no `NaN`, `undefined`, or fabricated scores in response | manual |

---

## 7. Risk Assessment

| Risk | Mitigation |
|------|------------|
| CSV team names don't match ESPN IDs | Build normalization map from ratings.json + team_names_zh.json |
| Duplicate matches in merge | Deduplicate by year ± 1 and exact score |
| Frontend breaks on new `dataQuality` values | `'historical'` renders same as `'live'` in frontend; only `'unavailable'` triggers empty state |
| Memory usage | 900 rows × ~200 bytes = ~180KB. Negligible. |

---

## 8. Verification

- `/api/h2h/{matchId}` for Brazil (205) vs Argentina (203): should return WC matches from 1930–2014 from CSV, plus any ESPN data.
- `/api/h2h/{matchId}` for a pair with no history: should return `dataQuality: 'unavailable'` (not fabricated data).
- Frontend renders "历史交锋样本不足" only when truly no data exists.
- No `NaN`, `undefined`, or `[object Object]` in H2H tab.

---

## 9. Open Questions

1. Should we keep `/api/match/:id/head-to-head` (news.js) or deprecate it?
2. Should we include non-World-Cup matches (qualifiers, friendlies) from the CSV? (Current CSV is WC-only.)
3. Should `dataQuality: 'historical'` show a data source disclaimer in the UI?