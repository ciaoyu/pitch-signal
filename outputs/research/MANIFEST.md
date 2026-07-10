# Research Artifacts v2 Manifest

- **Generated At**: 2026-07-10T14:42:03.662Z
- **Command**: `node scripts/research-generate-artifacts.js`
- **Data License**: Open Database License (ODbL) / FIFA Historical Evaluation Dataset
- **Fixed Seed**: 42 (Bit-identical deterministic replay)

## SHA-256 Checksums
| File | SHA-256 Hash |
|---|---|
| `backtest-predictions.csv` | `adc29cc0c973f6e7245dbc986f06040180e908023d260dbacbc22577d0286a20` |
| `calibration-classwise.json` | `2a8a20b5efe8ecea074276fd4954b65627603439aed193d08981dcd7fb70b60c` |
| `paired-deltas.json` | `cc2a1aa8b80a911e49efc7ce62752cedaf9d975808229f37117347f0a342eae6` |
| `research-summary.json` | `0b588c5a4ee9841af8b06801284c4097bad08f7c9439f4b0c0a0096eedbd1250` |

## Paired Evaluation Baselines Covered
- **Model vs. Uniform Baseline** (`modelVsUniform`)
- **Model vs. Walk-Forward Historical Frequency Baseline** (`modelVsHistoricalFrequency`)

## Separation of Evaluation Domains
> [!IMPORTANT]
> **Prospective vs. Retrospective Separation**:
> - **2026 Prospective Online Sample**: status = **unverified/null** (No verified 2026 online ledger export provided; prospective metrics are marked unverified/null.)
> - **1930-2022 Historical Replay Benchmark (964 matches)**: Brier = **0.5702**, Accuracy = **57.57%**.
> These two evaluation domains are strictly separated in accordance with Owner D governance rules.
