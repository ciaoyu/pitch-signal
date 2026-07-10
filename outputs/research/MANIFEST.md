# Research Artifacts v2 Manifest

- **Generated At**: 2026-07-10T14:48:07.805Z
- **Command**: `node scripts/research-generate-artifacts.js`
- **Data License**: Open Database License (ODbL) / FIFA Historical Evaluation Dataset
- **Fixed Seed**: 42 (Bit-identical deterministic replay)

## SHA-256 Checksums
| File | SHA-256 Hash |
|---|---|
| `backtest-predictions.csv` | `adc29cc0c973f6e7245dbc986f06040180e908023d260dbacbc22577d0286a20` |
| `calibration-classwise.json` | `2a8a20b5efe8ecea074276fd4954b65627603439aed193d08981dcd7fb70b60c` |
| `paired-deltas.json` | `d47579a4571541c7a5b91defce7521ba14bbea1adfc2b03bc46bf82af537bcfa` |
| `research-summary.json` | `0b588c5a4ee9841af8b06801284c4097bad08f7c9439f4b0c0a0096eedbd1250` |

## Paired Evaluation Baselines Covered
- **Model vs. Uniform Baseline** (`modelVsUniform`)
- **Model vs. Walk-Forward Historical Frequency Baseline** (`modelVsHistoricalFrequency`)

## Separation of Evaluation Domains & Boundary Statement
> [!IMPORTANT]
> **Prospective vs. Retrospective Separation**:
> - **2026 Prospective Online Sample**: status = **unverified/null** (No verified 2026 online ledger export provided; prospective metrics are marked unverified/null.)
> - **1930-2022 Historical Replay Benchmark (964 matches)**: Brier = **0.5702**, Accuracy = **57.57%**.
>
> **Evaluation Boundary Note**: Historical 964-match replay evaluates strictly the pre-match quarantined model (Owner A v4 @ `78da1b5`). Owner B immutable ledger recording and Owner C live-reprice runtime paths do not alter pre-match historical predictions.
