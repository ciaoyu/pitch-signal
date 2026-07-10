# Research Artifacts v2 Manifest

- **Generated At**: 2026-07-10T14:36:09.416Z
- **Command**: `node scripts/research-generate-artifacts.js`
- **Data License**: Open Database License (ODbL) / FIFA Historical Evaluation Dataset
- **Fixed Seed**: 42 (Bit-identical deterministic replay)

## SHA-256 Checksums
| File | SHA-256 Hash |
|---|---|
| `backtest-predictions.csv` | `adc29cc0c973f6e7245dbc986f06040180e908023d260dbacbc22577d0286a20` |
| `calibration-classwise.json` | `2a8a20b5efe8ecea074276fd4954b65627603439aed193d08981dcd7fb70b60c` |
| `paired-deltas.json` | `07eb971d47a673a9cf208b8601bf1ea44efa50110c7d0834b31318725d5d1a23` |
| `research-summary.json` | `808d823ae82741c973d58aff4313a50fbbdfa8e0f13463fd3e59d1c387123c8d` |

## Separation of Evaluation Domains
> [!IMPORTANT]
> **Prospective vs. Retrospective Separation**:
> - **2026 Prospective Online Sample (43 matches)**: Brier = **0.5059**, ECE = **0.1563**.
> - **1930-2022 Historical Replay Benchmark (964 matches)**: Brier = **0.5702**, Accuracy = **57.57%**.
> These two evaluation domains are strictly separated in accordance with Owner D governance rules.
