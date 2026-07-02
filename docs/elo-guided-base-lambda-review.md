# P4-5 Elo-guided base lambda review

## Verdict

Do not change the production default from `1.5` to `0.6`.

The `0.6` candidate is now available as an explicit `compareBaseline()` parameter, but the default remains the accepted legacy baseline because the candidate failed the guard.

## Validation

Command shape:

```js
const oldBaseline = await runner._walkForward(matches, { eloGuidedBaseLambda: 1.5 }, null, wfOpts);
await runner.compareBaseline({ eloGuidedBaseLambda: 0.6 }, oldBaseline);
```

Result on the 964-match walk-forward sample:

```json
{
  "accepted": false,
  "baseline": {
    "brier": 0.5708,
    "accuracy": 0.5788
  },
  "proposed": {
    "brier": 0.5727,
    "accuracy": 0.5685
  }
}
```

Reason: accuracy fell from 57.88% to 56.85%. CI overlap means the change is not significantly worse, but the project gate rejects lower accuracy.
