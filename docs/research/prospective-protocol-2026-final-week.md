# Prospective Prediction Protocol — 2026 FIFA World Cup Final Week

## Frozen release identity

| Field | Value |
|---|---|
| Public model contract | `p0-quarantine-v3-2026-07-10` |
| Configuration hash | `2066763607e5` |
| Final code commit | `f0db28c` |
| Active public signals | `elo`, `poisson` |
| Candidate / market signals | Shadow only (`usedInModel:false`) |

`f0db28c` is the release identifier for this protocol. It removes a client-side
match-detail crash and does not change the Elo+Poisson public-probability
contract or its configuration hash.

## Pre-match rule

For each eligible remaining fixture, persist the prediction before kickoff with
the code commit, configuration hash, generated timestamp, regulation H/D/A
probabilities and (for knockout matches) separate advancement probabilities.
Snapshots created after kickoff are `pre_missed`; they are never backfilled as
pre-match evidence.

## Market shadow rule

Archive `OPENING_LINE`, `T_MINUS_24H`, `LINEUP_ANNOUNCED` and `PRE_KICKOFF`
odds only when the source timestamp is strictly before kickoff. Store the raw
payload hash and keep market data outside the public probability.

## Post-match rule

Join a verified immutable pre-match prediction to the official result only after
the match ends. Report Brier score, log loss and directional accuracy as
descriptive final-week evidence; do not claim statistical significance from the
small sample.
