# Research Artifacts v2 Manifest

- **Generated At**: 2026-07-10T14:55:44.090Z
- **Command**: `node scripts/research-generate-artifacts.js`
- **Data License**: Open Database License (ODbL) / FIFA Historical Evaluation Dataset
- **Fixed Seed**: 42 (Bit-identical deterministic replay)

## SHA-256 Checksums
| File | SHA-256 Hash |
|---|---|
| `backtest-predictions.csv` | `adc29cc0c973f6e7245dbc986f06040180e908023d260dbacbc22577d0286a20` |
| `calibration-classwise.json` | `2a8a20b5efe8ecea074276fd4954b65627603439aed193d08981dcd7fb70b60c` |
| `paired-deltas.json` | `f3d791e412b487bf4b6f8d8b7cc52a9bcbc1476e2a0653e77e70ed1af46c8940` |
| `research-summary.json` | `3fbefbd0a34bdd4c8c1e0e23ce481adaba52256a1ae8770edea2d40d4c01f1f8` |

## Paired Evaluation Baselines Covered
- **Model vs. Uniform Baseline** (`modelVsUniform`)
- **Model vs. Walk-Forward Historical Frequency Baseline** (`modelVsHistoricalFrequency`)

## Separation of Evaluation Domains & Boundary Statement
> [!IMPORTANT]
> **Prospective vs. Retrospective Separation**:
> - **2026 Prospective Online Sample**: status = **unverified/null** (No verified 2026 online ledger export provided; prospective metrics are marked unverified/null.)
>   - Audit Breakdown: Total=0, Completed=0, Eligible=0, Rejected=0, Pending=0
> - **1930-2022 Historical Replay Benchmark (964 matches)**: Brier = **0.5702**, Accuracy = **57.57%**.
>
> **Evaluation Boundary Note**: Historical 964-match replay evaluates strictly the pre-match quarantined model (Owner A v4 @ `78da1b5`). Owner B immutable ledger recording and Owner C live-reprice runtime paths do not alter pre-match historical predictions.
