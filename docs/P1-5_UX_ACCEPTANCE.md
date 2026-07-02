# P1-5 UI / Device Acceptance

Date: 2026-07-03
Branch: `release/wc2026`
Target: local release candidate at `http://127.0.0.1:5120`

## Verdict

PASS for the local release candidate. The P0/P1 items in
`design_handoff_pitchsignal/UI-AUDIT-REPORT.md` that affect Live, Schedule,
Prediction, Standings, and the match HUD are either implemented or have an
explicit state-dependent explanation below.

Production remains a separate gate: push through GitHub and verify the Railway
source redeploy. Do not use `railway up`.

## Desktop Acceptance (1280 x 720)

| Surface | Result | Evidence |
|---|---|---|
| Global navigation | PASS | Bilingual labels are present; all visible controls are at least 44 x 44 px. |
| Live | PASS | Live score uses the `score-flash` animation; stats strips and persistent W/D/L labels render. |
| Schedule | PASS | Date heading, match count, selected-date styling, and match cards render. Date controls are at least 44 px after the acceptance fix. |
| Prediction | PASS | Main content uses 1080 px max width; probability bars expose ARIA labels and visible percentages; expected scores render. During knockout stage the Elo group-stage column is intentionally hidden and predictions use the available width. |
| Standings | PASS | Main content uses 960 px max width; Groups/Knockout/Scorers tabs expose selected state; groups use a two-column desktop grid and qualification markers render. |
| Match HUD | PASS | Full-screen fixed overlay, 52 px score, 300 px / flexible / 280 px three-column layout, top-left return control, tactical board, prediction, pressure, weather, and bottom tabs render. |

## Mobile Acceptance (320 x 720)

| Check | Result | Evidence |
|---|---|---|
| Page overflow | PASS | HUD, Standings, Schedule, and Prediction have `scrollWidth === clientWidth`. Wide bracket content scrolls inside its own container. |
| HUD layout | PASS | Center, left, and right panels stack vertically at 292 px content width. |
| Touch targets | PASS | No visible button or tab is below 44 px in either dimension. |
| Text/layout | PASS | Navigation, prediction cards, standings tabs, and HUD content do not overlap. |
| Probability accessibility | PASS | W/D/L percentages are always visible, bars have descriptive ARIA labels, and home/draw/away use distinct stripe/dot patterns in addition to color. |

## Acceptance Fixes

1. Added explicit 52 px minimum width and 44 px minimum height to dynamically generated Schedule date buttons.
2. Added 44 px minimum width to Schedule scroll controls.
3. Changed the Prediction market comparison grid to
   `repeat(3, minmax(0, 1fr))` so long divergence text cannot widen the page.

## Deferred Non-Gates

- Team detail remains a bottom sheet. This is outside the P1-5 HUD acceptance scope.
- Instrument Serif and minor flag-size differences remain cosmetic P2 items.
- Production verification is pending commit, push, and Railway GitHub source redeploy.
