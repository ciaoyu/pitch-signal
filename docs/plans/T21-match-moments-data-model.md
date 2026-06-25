# T21: Match Moments Data Model

**Status:** draft
**Created:** 2026-06-25

---

## 1. Current State

### Existing Event System

| File | Function | Purpose |
|------|----------|---------|
| `lib/eventFilter.js` | `filterMatchEvents(events, ctx)` | Compresses ESPN events into key events + momentum buckets |
| `lib/matchReview.js` | `MatchReviewEngine.generateDefaultEvents()` | Generates synthetic events from final score |
| `lib/services/ReviewService.js` | orchestrates | Passes events through to review output |
| `static/js/app.js:3918–4079` | `renderPostMatchReview` | Renders key events timeline + momentum chart |

### Current `keyEvents` Shape

```js
// From eventFilter.js:194
{ minute: string, type: string, text: string, gameState: string }
```

### Current `matchScript` Values

`'comeback'` | `'control_win'` | `'smash_and_grab'` | `'collapse'` | `'even'` | `'unknown'`

### Current Event Categories (from `classifyEvent`)

`'goal'` | `'own_goal'` | `'var'` | `'penalty'` | `'card'` | `'substitution'` | `'shot'` | `null`

### Current Momentum Buckets

```js
{ window: string, homeShots: number, awayShots: number, goals: number }
// window = "0-15", "15-30", "30-45", "45-60", "60-75", "75-90"
```

---

## 2. Problems

1. **Flat text events.** `keyEvents` stores `{ minute, type, text, gameState }` — no structured fields for player, team, assist, score before/after.
2. **No "moment" concept.** Goals, red cards, and penalties are all treated equally. A 90th-minute equalizer is the same as a 5th-minute routine goal.
3. **`matchScript` only considers goals.** A red card at 10' that changes the entire game isn't captured as a "swing moment."
4. **No source provenance.** Events from ESPN, CSV, or synthetic generation are mixed without origin tracking.
5. **No confidence scoring.** Synthetic events (from `generateDefaultEvents`) look identical to real ESPN events.
6. **No review impact.** No field indicates whether a moment should trigger a prediction re-evaluation.

---

## 3. Goal

> Turn important live swing events into first-class data.

Define a schema that can represent any significant match moment with enough structure for:
- UI rendering (timeline, badges, detail cards)
- Prediction impact analysis (did this moment change the expected outcome?)
- Data quality tracking (real vs synthetic)

---

## 4. Proposed `MatchMoment` Schema

```typescript
interface MatchMoment {
  // Identity
  id: string;                    // deterministic: `${matchId}_${minute}_${type}_${seq}`
  matchId: string;

  // Timing
  minute: number;                // integer, 0–120+ (including extra time)
  period: '1H' | '2H' | 'ET1' | 'ET2' | 'PK';

  // Classification
  category: MomentCategory;      // see below
  isSwingMoment: boolean;        // true if this moment materially changed match trajectory

  // Content
  text: { zh: string; en: string };
  detail?: { zh: string; en: string };

  // Team & Players
  teamId?: string;               // ESPN team ID
  teamSide?: 'home' | 'away';
  playerId?: string;
  playerName?: string;
  playerNameI18n?: { zh: string; en: string };
  assistPlayerId?: string;
  assistPlayerName?: string;

  // Score Context
  scoreBefore?: { home: number; away: number };
  scoreAfter?: { home: number; away: number };

  // Significance
  significance: 'routine' | 'notable' | 'critical' | 'decisive';
  // routine: normal yellow card, routine substitution
  // notable: goal that changes lead, second yellow
  // critical: red card, penalty goal, equalizer
  // decisive: late winner, own goal that decides match

  // Data Quality
  source: 'espn' | 'csv' | 'synthetic' | 'inferred';
  confidence: number;            // 0.0–1.0

  // Review Impact
  reviewImpact?: {
    predictionChanged: boolean;  // did this moment flip the predicted winner?
    eloSwing?: number;           // estimated Elo impact
    description?: { zh: string; en: string };
  };
}
```

### `MomentCategory` Enum

```typescript
type MomentCategory =
  | 'goal'            // regular goal
  | 'own_goal'        // own goal
  | 'penalty_scored'  // penalty converted
  | 'penalty_missed'  // penalty saved/off target
  | 'penalty_awarded' // penalty given (VAR or foul)
  | 'red_card'        // straight red or second yellow
  | 'yellow_card'     // first yellow (only if notable, e.g. tactical foul on counter)
  | 'var_decision'    // VAR review result
  | 'substitution'    // tactical substitution (only if notable)
  | 'injury'          // injury forcing substitution
  | 'save'            // notable goalkeeper save
  | 'woodwork'        // hit post/crossbar
  | 'other';          // catch-all
```

### `isSwingMoment` Rules

A moment is a **swing moment** if ANY of:
- Goal that changes the lead (go-ahead, equalizer, go-ahead after being tied)
- Red card (team goes to 10)
- Penalty awarded (regardless of outcome)
- Goal in 85th minute or later
- Own goal

---

## 5. Migration Path

### Phase 1: Define Schema (this task)
- Create `lib/models/MatchMoment.js` with the schema and validation helpers
- Add `toMatchMoment(rawEvent, ctx)` converter in `lib/eventFilter.js`
- Keep backward compatibility: output both old `keyEvents` and new `moments`

### Phase 2: Enrich Event Filter
- Update `filterMatchEvents` to produce `moments` alongside `keyEvents`
- Add `isSwingMoment` and `significance` scoring
- Track `scoreBefore`/`scoreAfter` for all goal-type events

### Phase 3: Frontend Consumption
- Update `renderPostMatchReview` to use `moments` when available
- Add swing moment badges (🔥 for decisive, ⚡ for critical)
- Show score context on hover/tap

### Phase 4: Synthetic Event Upgrade
- Update `generateDefaultEvents` to produce `MatchMoment` objects
- Set `source: 'synthetic'` and `confidence: 0.3` for generated events
- Frontend shows "推断" badge for synthetic events

---

## 6. Impact on Existing Code

| File | Change | Risk |
|------|--------|------|
| `lib/eventFilter.js` | Add `moments` output field | Low — additive |
| `lib/matchReview.js` | Update `generateDefaultEvents` to return moments | Low |
| `lib/services/ReviewService.js` | Pass `moments` through to review output | Low |
| `static/js/app.js` | Render moments when available, fall back to keyEvents | Low |
| `lib/postMatchReview.js` | Store moments in DB alongside keyEvents | Medium — schema change |

---

## 7. DB Considerations

Current `post_match_reviews` table stores `keyEvents` as JSON text. Options:

1. **Add `moments` column** — store alongside `keyEvents`, migrate gradually.
2. **Replace `keyEvents`** — breaking change, requires migration script.
3. **Store in `evidence` JSON** — already flexible, no schema change.

**Recommendation:** Option 3 — store `moments` inside the existing `evidence` JSON field. No DB migration needed.

---

## 8. Example

### Input (ESPN event)
```json
{
  "minute": "89'",
  "type": { "name": "goal" },
  "text": "Goal! Brazil 2-1 Argentina. Neymar Jr. right footed shot from the centre of the box to the bottom right corner.",
  "homeAway": "home"
}
```

### Output (MatchMoment)
```json
{
  "id": "401770370_89_goal_1",
  "matchId": "401770370",
  "minute": 89,
  "period": "2H",
  "category": "goal",
  "isSwingMoment": true,
  "text": { "zh": "进球！巴西 2-1 阿根廷", "en": "Goal! Brazil 2-1 Argentina" },
  "detail": { "zh": "内马尔右脚射门", "en": "Neymar Jr. right footed shot" },
  "teamId": "205",
  "teamSide": "home",
  "playerId": "19030",
  "playerName": "Neymar Jr.",
  "scoreBefore": { "home": 1, "away": 1 },
  "scoreAfter": { "home": 2, "away": 1 },
  "significance": "decisive",
  "source": "espn",
  "confidence": 0.95,
  "reviewImpact": {
    "predictionChanged": true,
    "eloSwing": 45,
    "description": { "zh": "89分钟绝杀，逆转预测结果", "en": "89th minute winner, flipped predicted outcome" }
  }
}
```

---

## 9. Open Questions

1. Should `significance` thresholds be configurable per tournament stage (group vs knockout)?
2. Should yellow cards be moments? (Only 2nd yellow / tactical foul on counter?)
3. Should we store raw ESPN event alongside the processed moment for debugging?
4. How should penalty shootouts be modeled? (Series of `penalty_scored`/`penalty_missed` moments?)

---

## 10. Implementation Steps

| Step | Description | Files |
|------|-------------|-------|
| 1 | Create `lib/models/MatchMoment.js` with schema + validation | new file |
| 2 | Add `toMatchMoment()` converter to `lib/eventFilter.js` | `lib/eventFilter.js` |
| 3 | Update `filterMatchEvents` to output `moments` array | `lib/eventFilter.js` |
| 4 | Update `generateDefaultEvents` to produce moments | `lib/matchReview.js` |
| 5 | Add moment rendering to frontend | `static/js/app.js` |
| 6 | Smoke test with a completed match | manual |