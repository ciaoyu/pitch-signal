# P2-6 Bot Production Acceptance

Date: 2026-07-03
Production: `https://pitch-signal-production.up.railway.app`

## Verdict

PARTIAL PASS.

- PASS: the production AI key is configured and requests use the real model.
- PASS: the model did not invent qualification or standings values when the
  injected context was empty.
- FAIL: the deployed P2-6 data injection did not provide qualification
  probabilities or group standings.
- FIXED LOCALLY: Bot standings context now reuses the same `/api/standings`
  route that powers the production UI. The legacy `group_standings` table is
  retained only as a fallback.
- PENDING: commit, push, Railway GitHub source redeploy, then repeat the two
  production questions.

## Production Evidence

### Service

- `/health`: `status=healthy`, database connected, FIFA API OK.
- Bot responses: `source=deepseek-v4-flash`, `status=success`.
- `/api/qualification-probabilities`: `{}`.
- `/api/standings`: complete group standings were available.

### Question 1

Asked for the top three teams by injected qualification probability, with an
explicit instruction not to guess.

Result: the model stated that the injected qualification list was empty and did
not provide fabricated values.

### Question 2

Asked for Group A teams, points, and goal difference using only injected
standings.

Result: the model stated that standings were absent from its context, even
though the public standings endpoint contained the data.

## Root Cause

`fetchGlobalContext()` read standings directly from `group_standings`. That
table is empty in production, while the actual UI standings are computed by the
`GET /api/standings` route. Empty qualification arrays were also serialized
into the prompt as if they were useful data.

## Local Fix Verification

- Prefer `GET /api/standings` and normalize its group rows for the Bot prompt.
- Fall back to `group_standings` only when the route has no data.
- Omit an empty qualification collection from the prompt.
- `scripts/test-bot-kb.js`: 26 assertions passed.
- Full suite: 44 suites, 569 assertions passed.

## Redeploy Acceptance

After GitHub source redeploy:

1. Ask for Group A standings and verify Mexico 9 points, goal difference +6;
   South Africa 4/-1; South Korea 3/-1; Czechia 1/-4.
2. Ask for qualification probabilities. If the endpoint remains empty because
   the group stage is complete, the answer must state that probabilities are
   unavailable and then use injected final standings without inventing values.
3. Confirm `source=deepseek-v4-flash` and `status=success`.
