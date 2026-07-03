# Live Match Node Flow

This document defines the default runtime flow for knockout matches.

## Purpose

For every live knockout match, the monitor should proactively collect data and produce analysis at fixed nodes without waiting for the user to prompt each step.

## Required Nodes

1. Kickoff forecast
2. First hydration break
3. Halftime
4. Second hydration break
5. Fulltime

## Knockout Extension

If the match is tied after 90 minutes:

1. Extra time first half
2. Extra time second half

If the match still ends tied after extra time, the monitor should mark the game as going to penalties and continue only if penalty data is available.

## Inputs

The monitor should use:

- Live scoreboard state
- Event stream details
- Match statistics
- Any user-provided goal or substitution notes

## Output Rules

At each node, output:

- Current score
- Match state summary
- Tactical interpretation
- What changed since the last node

At kickoff, also output:

- Latest team news / injury context
- Pre-match baseline probabilities
- The starting tactical expectation for the match

At fulltime, also output:

- Final verdict
- Key turning points
- What was right or wrong in the live read
- Reusable lesson for the next match

## Implementation Notes

- `scripts/live-match-monitor.js` is the active collector.
- Hydration windows are currently set to `27-33'` and `72-78'`.
- Halftime is fixed at `45'`.
- Extra time nodes are enabled for knockout matches at `105'` and `120'`.
- Final summaries are written to `data/live-snapshots/YYYY-MM-DD/<matchId>/final-summary.json`.
- Kickoff snapshots should include latest news context when available.

## Operator Contract

- The system should not invent missing event data.
- If a node has no fresh external data, it should be marked as unverified.
- User-supplied goal and substitution details should be folded into the final summary, not used to fabricate earlier nodes.
