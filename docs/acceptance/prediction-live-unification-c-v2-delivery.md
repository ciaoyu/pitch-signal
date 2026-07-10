# C v2 Delivery Report — Prediction Live Unification

**Branch**: `codex/prediction-live-unification`  
**Base SHA**: `4900f49`  
**Date**: 2026-07-10  
**Author**: 猪鼻巴布 (zbbb's agent)

## Executive Summary

All three T0 blocking issues from the first-pass only-read audit are **resolved**. 33/33 new C v2 tests pass. All 76 pre-existing tests continue to pass (3 baseline failures unrelated to changes).

---

## Three C v2 Blockers (T0 Audit Findings) → Resolved

### 1. ❌ `espn_id` column does not exist → ✅ `getKnockoutContextForMatch()`

**T0 finding**: `lib/routes/prediction.js` queried `SELECT stage FROM matches WHERE espn_id = ?`, but the `matches` table has no `espn_id` column. This would crash every live-probability request for knockout matches.

**Fix**: Replaced the broken DB query with `getKnockoutContextForMatch(matchId)` which reads from the schedule snapshot JSON file:
- Exported `getKnockoutContextForMatch` from `lib/services/PredictionService.js`
- Imported and used in `lib/routes/prediction.js` live-probability route
- Falls back gracefully to `isKnockout: false` when schedule data is unavailable — never crashes

### 2. ❌ `moment-sync` doesn't pass `addedTime` → ✅ parsed + passed

**T0 finding**: `moment-sync` calls `reprice()` but never passes `addedTime`. The `displayClock` from ESPN was discarded.

**Fix**:
- Added `displayClock` field preservation in `getLiveMatches()` mapping
- Added `parseAddedTime(displayClock)` — parses `"90'+4"` → `4`, `"45'+2"` → `2`, all others → `0`
- Passed `addedTime` to every `reprice()` call in `processMatch` step 4

### 3. ❌ Monitor `countRedCardsFromDetails` matches by name vs ID → ✅ fixed

**T0 finding**: `live-match-monitor.js` called `countRedCardsFromDetails(details, teamId)` but the `details[].team` field is a **display name** string, not an ESPN ID. Result: always 0 red cards detected.

**Fix**: Rewrote `countRedCardsFromDetails` to compare via **case-insensitive substring match** on display names (both directions: contains × contained-by), added second-yellow-tracking, and added `parseAddedTime` helper for the monitor caller.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `isKnockout` authority: **schedule snapshot, not DB** | `matches` table has no `espn_id` column; schedule JSON is the source of truth for stage data |
| `isKnockout` authority: **server, not client** | Client URL `?isKnockout=true` is advisory only; stage string from schedule wins |
| Added time cap | `reprice()` clips total remaining minute to 90 — added time never inflates λ above pre-match baseline (W1-B §1.3) |
| Red card factor = 0.72 | Preserved from T0; remains unvalidated heuristic (not calibrated) |
| `buildLiveAnalysis` = adapter | Now calls `reprice()` with hard facts only; soft signals (shots/possession/yellows/odds) are **logged but ignored** for probability |

---

## File Changes

| File | Change |
|---|---|
| `lib/routes/prediction.js` | Replaced broken `matches WHERE espn_id = ?` with `getKnockoutContextForMatch()` |
| `lib/services/PredictionService.js` | Exported `getKnockoutContextForMatch` |
| `lib/jobs/moment-sync.js` | Added `displayClock` preservation, `parseAddedTime()`, passes `addedTime` to `reprice()` |
| `scripts/live-match-monitor.js` | Fixed `countRedCardsFromDetails` (name matching), added `parseAddedTime()` helper |

---

## Test Results

### C v2 (33/33) ✅
```
📋 Test 1:  Knockout stage — 6 / 6
📋 Test 2:  Added time parsing — 4 / 4
📋 Test 3:  Red card detection — 4 / 4
📋 Test 4:  Cross-path consistency — 4 / 4
📋 Test 5:  Soft-signal immunity — 2 / 2
📋 Test 6:  regulation/advance split — 8 / 8
📋 Test 7:  Route code audit — 2 / 2
📋 Test 8:  moment-sync passes addedTime — 3 / 3
```

### T0 Baselines (unchanged) ✅
- `test-live-endpoint-discipline.js` — 8/8
- `test-live-state-machine.js` — 6/6
- `npm test` — 76 pass, 3 baseline failures (pre-existing, unrelated)

---

## Live Probability Path (Definitive)

```
Frontend                      Server
────────                      ──────
match-detail.js               lib/routes/prediction.js
  │                             │
  │ GET /api/match/:id/         │
  │   live-probability          │
  │   ?minute=...               │
  │   &homeScore/awayScore      ├─ getKnockoutContextForMatch(matchId)
  │   &homeRed/awayRed   ◄fix   │   → schedule snapshot (not DB)
  │   &isKnockout          ◄new │
  │   &addedTime            ◄fix│
  │                             ├─ reprice({ ... })
  │                             │   → lib/live-reprice.js
  │                             │   → PoissonModel.goalProbabilityMatrix
  │                             │
  │ ◄── { regulation: H/D/A,   │
  │       advance: H/A|null,   │
  │       lambdaRemaining: .. }│
  │                             │
  renderLiveProbPanel()        moment-sync (background)
  → regulation panel            → reprice() + addedTime ◄fix
  → advance panel (knockout)   live-match-monitor (background)
                                  → reprice() via buildLiveAnalysis
                                  → name-matched red cards ◄fix
```

---

## Compliance

| Acceptance Criteria | Status |
|---|---|
| Single canonical Poisson engine (`reprice()`) | ✅ |
| Red cards end-to-end traceable | ✅ (frontend → API → reprice) |
| `isKnockout` end-to-end traceable | ✅ (schedule → route → reprice → UI) |
| `addedTime` end-to-end traceable | ✅ (ESPN → moment-sync → reprice → UI) |
| Soft signals do NOT move probability | ✅ (8/8 test-live-endpoint-discipline) |
| `buildLiveAnalysis` = adapter (no duplicate formula) | ✅ |
| No `espn_id` column dependency | ✅ |
| Bundle rebuilt | ✅ (v=2e2b4456) |

---

## Remaining Known Gaps (out of scope for this delivery)

- `RED_CARD_LAMBDA_FACTOR = 0.72` is an unvalidated heuristic
- W1-C eval baselines need recalibration (57.88% accuracy assertion fails — pre-existing)
- `live-match-monitor.js` uses `reprice()` but still independently fetches + serializes — future scope: consolidate into a shared `live-reprice` service
