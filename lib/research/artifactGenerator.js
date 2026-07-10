'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PairedDeltaEvaluator = require('./pairedDelta');

/**
 * Research Artifact Generator (Owner D v2)
 * Generates machine-readable research artifacts:
 * - backtest-predictions.csv (964 rows)
 * - calibration-classwise.json
 * - paired-deltas.json (Model vs Uniform + Model vs Historical Frequency)
 * - research-summary.json (Dynamic prospective ledger evaluation or unverified/null)
 * - MANIFEST.md
 */

class ArtifactGenerator {
  /**
   * Compute Ranked Probability Score (RPS) for 3 ordered outcomes (home=1, draw=2, away=3).
   */
  static computeRps(homeProb, drawProb, awayProb, actualOutcome) {
    const P1 = homeProb;
    const P2 = homeProb + drawProb;
    const O1 = actualOutcome === 'home' ? 1 : 0;
    const O2 = actualOutcome === 'away' ? 0 : 1;
    return 0.5 * (Math.pow(P1 - O1, 2) + Math.pow(P2 - O2, 2));
  }

  /**
   * Dynamically compute prospective 2026 live service metrics from a real ledger file.
   * Never hardcodes research evidence metrics. If ledger is missing/empty, returns unverified/null.
   */
  static computeProspectiveMetrics(options = {}) {
    const ledgerPath = options.prospectiveLedgerPath || path.join(__dirname, '..', '..', 'data', 'prospective_2026_ledger.json');
    if (!fs.existsSync(ledgerPath)) {
      return {
        status: 'unverified',
        sampleSize: null,
        description: 'Prospective online live service predictions for 2026 matches (awaiting live ledger export)',
        metrics: {
          meanBrier: null,
          topLabelECE: null,
          directionalAccuracy: null
        },
        inputFile: null,
        inputHash: null,
        note: 'No verified 2026 online ledger export provided; prospective metrics are marked unverified/null.'
      };
    }

    try {
      const rawData = fs.readFileSync(ledgerPath, 'utf8');
      const inputHash = crypto.createHash('sha256').update(rawData).digest('hex');
      const ledger = JSON.parse(rawData);
      const records = Array.isArray(ledger) ? ledger : (ledger.records || []);

      const validRecords = records.filter(r => r && r.pred && r.actualOutcome);
      if (validRecords.length === 0) {
        return {
          status: 'unverified',
          sampleSize: 0,
          description: 'Prospective online live service predictions for 2026 matches (awaiting completed match records)',
          metrics: {
            meanBrier: null,
            topLabelECE: null,
            directionalAccuracy: null
          },
          inputFile: path.basename(ledgerPath),
          inputHash,
          note: 'Ledger file found but contains 0 completed matches with verified predictions; marked unverified/null.'
        };
      }

      let totalBrier = 0;
      let correct = 0;
      const bins = Array.from({ length: 10 }, () => ({ sumConf: 0, sumAcc: 0, count: 0 }));

      for (const r of validRecords) {
        const p = r.pred;
        const actual = r.actualOutcome;
        const yH = actual === 'home' ? 1 : 0;
        const yD = actual === 'draw' ? 1 : 0;
        const yA = actual === 'away' ? 1 : 0;

        const brier = Math.pow(p.homeWin - yH, 2) + Math.pow(p.draw - yD, 2) + Math.pow(p.awayWin - yA, 2);
        totalBrier += brier;

        let topOutcome = 'draw';
        let topConf = p.draw;
        if (p.homeWin >= p.draw && p.homeWin >= p.awayWin) {
          topOutcome = 'home';
          topConf = p.homeWin;
        } else if (p.awayWin >= p.draw && p.awayWin >= p.homeWin) {
          topOutcome = 'away';
          topConf = p.awayWin;
        }

        const isCorrect = topOutcome === actual ? 1 : 0;
        correct += isCorrect;

        const binIdx = Math.min(9, Math.floor(topConf * 10));
        bins[binIdx].sumConf += topConf;
        bins[binIdx].sumAcc += isCorrect;
        bins[binIdx].count++;
      }

      const sampleSize = validRecords.length;
      const meanBrier = Number((totalBrier / sampleSize).toFixed(4));
      const directionalAccuracy = Number((correct / sampleSize).toFixed(4));

      let eceSum = 0;
      for (const b of bins) {
        if (b.count > 0) {
          const avgConf = b.sumConf / b.count;
          const avgAcc = b.sumAcc / b.count;
          eceSum += (b.count / sampleSize) * Math.abs(avgConf - avgAcc);
        }
      }
      const topLabelECE = Number(eceSum.toFixed(4));

      return {
        status: 'verified',
        sampleSize,
        description: 'Prospective online live service predictions for 2026 matches computed from real ledger export',
        metrics: {
          meanBrier,
          topLabelECE,
          directionalAccuracy
        },
        inputFile: path.basename(ledgerPath),
        inputHash,
        dataCutoff: ledger.dataCutoff || 'real_time_ledger_export',
        note: `Computed dynamically from verified ledger export (${sampleSize} matches). SHA-256: ${inputHash}`
      };
    } catch (err) {
      return {
        status: 'unverified',
        sampleSize: null,
        description: 'Prospective online live service predictions for 2026 matches',
        metrics: {
          meanBrier: null,
          topLabelECE: null,
          directionalAccuracy: null
        },
        inputFile: ledgerPath,
        inputHash: null,
        note: `Failed to process prospective ledger: ${err.message}`
      };
    }
  }

  /**
   * Generate CSV content for 964 evaluated records.
   */
  static generateCsv(evaluatedRecords) {
    const headers = [
      'match_id',
      'tournament_year',
      'date',
      'stage',
      'home_team',
      'away_team',
      'home_win_prob',
      'draw_prob',
      'away_win_prob',
      'actual_outcome',
      'elo_diff',
      'is_knockout',
      'model_version',
      'data_cutoff',
      'brier',
      'log_loss',
      'rps'
    ];

    const rows = [headers.join(',')];

    for (let i = 0; i < evaluatedRecords.length; i++) {
      const rec = evaluatedRecords[i];
      const match = rec.match;
      const pred = rec.pred;
      const actual = rec.actualOutcome;

      const matchId = match.matchId || `hist_${rec.tournamentYear || String(match.date).slice(0, 4)}_${i + 1}`;
      const year = rec.tournamentYear || String(match.date).slice(0, 4);
      const date = match.date;
      const stage = `"${(match.stage || '').replace(/"/g, '""')}"`;
      const homeTeam = `"${(match.home || '').replace(/"/g, '""')}"`;
      const awayTeam = `"${(match.away || '').replace(/"/g, '""')}"`;

      const homeProb = Number(pred.homeWin.toFixed(4));
      const drawProb = Number(pred.draw.toFixed(4));
      const awayProb = Number(pred.awayWin.toFixed(4));

      const eloDiff = rec.eloDiff !== undefined ? rec.eloDiff : 0;
      const isKnockout = rec.isKnockout ? 'true' : 'false';
      const modelVersion = pred.modelVersion || 'p0-quarantine-v3-2026-07-10';
      const dataCutoff = `pre_${year}_kickoff`;

      const eps = 1e-15;
      const brier = Number((Math.pow(homeProb - rec.yH, 2) + Math.pow(drawProb - rec.yD, 2) + Math.pow(awayProb - rec.yA, 2)).toFixed(6));
      const pH = Math.max(eps, Math.min(1 - eps, homeProb));
      const pD = Math.max(eps, Math.min(1 - eps, drawProb));
      const pA = Math.max(eps, Math.min(1 - eps, awayProb));
      const logLoss = Number((-(rec.yH * Math.log(pH) + rec.yD * Math.log(pD) + rec.yA * Math.log(pA))).toFixed(6));
      const rps = Number(ArtifactGenerator.computeRps(homeProb, drawProb, awayProb, actual).toFixed(6));

      rows.push([
        matchId,
        year,
        date,
        stage,
        homeTeam,
        awayTeam,
        homeProb,
        drawProb,
        awayProb,
        actual,
        eloDiff,
        isKnockout,
        modelVersion,
        dataCutoff,
        brier,
        logLoss,
        rps
      ].join(','));
    }

    return rows.join('\n') + '\n';
  }

  /**
   * Generate paired deltas JSON against baselines (Uniform + Historical Frequency)
   * clustered by tournament edition.
   */
  static generatePairedDeltas(evaluatedRecords) {
    // 1. Construct paired records against Uniform (1/3, 1/3, 1/3)
    const uniformRecords = evaluatedRecords.map(r => {
      const uBrier = Math.pow(1/3 - r.yH, 2) + Math.pow(1/3 - r.yD, 2) + Math.pow(1/3 - r.yA, 2);
      const uLogLoss = -Math.log(1/3);
      const eps = 1e-15;
      const mBrier = Math.pow(r.pred.homeWin - r.yH, 2) + Math.pow(r.pred.draw - r.yD, 2) + Math.pow(r.pred.awayWin - r.yA, 2);
      const mLogLoss = -(r.yH * Math.log(Math.max(eps, r.pred.homeWin)) + r.yD * Math.log(Math.max(eps, r.pred.draw)) + r.yA * Math.log(Math.max(eps, r.pred.awayWin)));
      const mAcc = (r.pred.homeWin > r.pred.draw && r.pred.homeWin > r.pred.awayWin && r.yH === 1) ||
                   (r.pred.awayWin > r.pred.draw && r.pred.awayWin > r.pred.homeWin && r.yA === 1) ? 1 : 0;

      return {
        clusterKey: r.tournamentYear || String(r.match.date).slice(0, 4),
        brierA: mBrier,
        brierB: uBrier,
        accuracyA: mAcc,
        accuracyB: 0,
        logLossA: mLogLoss,
        logLossB: uLogLoss
      };
    });

    // 2. Construct paired records against Walk-Forward Historical Frequency
    const histFreqRecords = evaluatedRecords.map(r => {
      const hPred = r.histPred || { homeWin: 1/3, draw: 1/3, awayWin: 1/3 };
      const eps = 1e-15;
      const hBrier = Math.pow(hPred.homeWin - r.yH, 2) + Math.pow(hPred.draw - r.yD, 2) + Math.pow(hPred.awayWin - r.yA, 2);
      const hLogLoss = -(r.yH * Math.log(Math.max(eps, hPred.homeWin)) + r.yD * Math.log(Math.max(eps, hPred.draw)) + r.yA * Math.log(Math.max(eps, hPred.awayWin)));
      const hAcc = (hPred.homeWin > hPred.draw && hPred.homeWin > hPred.awayWin && r.yH === 1) ||
                   (hPred.awayWin > hPred.draw && hPred.awayWin > hPred.homeWin && r.yA === 1) ? 1 : 0;

      const mBrier = Math.pow(r.pred.homeWin - r.yH, 2) + Math.pow(r.pred.draw - r.yD, 2) + Math.pow(r.pred.awayWin - r.yA, 2);
      const mLogLoss = -(r.yH * Math.log(Math.max(eps, r.pred.homeWin)) + r.yD * Math.log(Math.max(eps, r.pred.draw)) + r.yA * Math.log(Math.max(eps, r.pred.awayWin)));
      const mAcc = (r.pred.homeWin > r.pred.draw && r.pred.homeWin > r.pred.awayWin && r.yH === 1) ||
                   (r.pred.awayWin > r.pred.draw && r.pred.awayWin > r.pred.homeWin && r.yA === 1) ? 1 : 0;

      return {
        clusterKey: r.tournamentYear || String(r.match.date).slice(0, 4),
        brierA: mBrier,
        brierB: hBrier,
        accuracyA: mAcc,
        accuracyB: hAcc,
        logLossA: mLogLoss,
        logLossB: hLogLoss
      };
    });

    const pairedVsUniform = PairedDeltaEvaluator.computeClusteredPairedDelta(uniformRecords, { seed: 42 });
    const pairedVsHistoricalFrequency = PairedDeltaEvaluator.computeClusteredPairedDelta(histFreqRecords, { seed: 42 });

    return {
      metadata: {
        clusteringUnit: 'tournament_year',
        resamples: 1000,
        seed: 42,
        evalMethod: 'Clustered Bootstrap Paired Difference',
        coveredBaselines: [
          'Uniform Baseline (1/3, 1/3, 1/3)',
          'Walk-Forward Historical Frequency Baseline'
        ]
      },
      modelVsUniform: pairedVsUniform,
      modelVsHistoricalFrequency: pairedVsHistoricalFrequency
    };
  }

  /**
   * Write all artifacts to outputDir and return manifest info.
   */
  static async writeArtifacts(outputDir, backtestResults, commandStr = 'node scripts/research-generate-artifacts.js', options = {}) {
    fs.mkdirSync(outputDir, { recursive: true });

    const fullSeeded = backtestResults.fullSeeded;
    const evaluatedRecords = fullSeeded.evaluatedRecords || [];

    // 1. backtest-predictions.csv
    const csvContent = ArtifactGenerator.generateCsv(evaluatedRecords);
    const csvPath = path.join(outputDir, 'backtest-predictions.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf8');

    // 2. calibration-classwise.json
    const calibContent = JSON.stringify({
      evaluatedCount: fullSeeded.evaluatedCount,
      reliabilityDiagram: fullSeeded.reliabilityDiagram
    }, null, 2);
    const calibPath = path.join(outputDir, 'calibration-classwise.json');
    fs.writeFileSync(calibPath, calibContent, 'utf8');

    // 3. paired-deltas.json
    const pairedContent = JSON.stringify(ArtifactGenerator.generatePairedDeltas(evaluatedRecords), null, 2);
    const pairedPath = path.join(outputDir, 'paired-deltas.json');
    fs.writeFileSync(pairedPath, pairedContent, 'utf8');

    // 4. research-summary.json
    const prospectiveMetrics = ArtifactGenerator.computeProspectiveMetrics(options);

    const summaryData = {
      retrospective_historical_replay_964: {
        sampleSize: fullSeeded.evaluatedCount,
        description: 'Out-of-sample historical replay evaluation across 22 FIFA World Cup tournaments (1930-2022)',
        modelVersion: 'p0-quarantine-v3-2026-07-10',
        metrics: {
          accuracy: Number(fullSeeded.accuracy.toFixed(6)),
          meanBrier: Number(fullSeeded.meanBrier.toFixed(6)),
          meanLogLoss: Number(fullSeeded.meanLogLoss.toFixed(6))
        },
        note: 'Historical 964-match replay benchmark under strict A v4 quarantined core model.'
      },
      prospective_2026_online: prospectiveMetrics,
      governance_separation_rule: 'Prospective online metrics must be computed dynamically from verified ledger exports and never hardcoded. Retrospective replay metrics apply strictly to the 964-match historical dataset. The two must never be mixed or conflated.'
    };
    const summaryContent = JSON.stringify(summaryData, null, 2);
    const summaryPath = path.join(outputDir, 'research-summary.json');
    fs.writeFileSync(summaryPath, summaryContent, 'utf8');

    // Calculate SHA-256 hashes
    const hashFile = (filepath) => {
      const data = fs.readFileSync(filepath);
      return crypto.createHash('sha256').update(data).digest('hex');
    };

    const files = [
      'backtest-predictions.csv',
      'calibration-classwise.json',
      'paired-deltas.json',
      'research-summary.json'
    ];

    const hashes = {};
    for (const f of files) {
      hashes[f] = hashFile(path.join(outputDir, f));
    }

    // Format prospective section in MANIFEST
    const prospectiveManifestSection = prospectiveMetrics.status === 'verified'
      ? `> - **2026 Prospective Online Sample (${prospectiveMetrics.sampleSize} matches)**: Brier = **${prospectiveMetrics.metrics.meanBrier}**, ECE = **${prospectiveMetrics.metrics.topLabelECE}**.
>   - Input Ledger: \`${prospectiveMetrics.inputFile}\` (SHA-256: \`${prospectiveMetrics.inputHash}\`)`
      : `> - **2026 Prospective Online Sample**: status = **unverified/null** (${prospectiveMetrics.note})`;

    // 5. MANIFEST.md
    const manifestMd = `# Research Artifacts v2 Manifest

- **Generated At**: ${new Date().toISOString()}
- **Command**: \`${commandStr}\`
- **Data License**: Open Database License (ODbL) / FIFA Historical Evaluation Dataset
- **Fixed Seed**: 42 (Bit-identical deterministic replay)

## SHA-256 Checksums
| File | SHA-256 Hash |
|---|---|
| \`backtest-predictions.csv\` | \`${hashes['backtest-predictions.csv']}\` |
| \`calibration-classwise.json\` | \`${hashes['calibration-classwise.json']}\` |
| \`paired-deltas.json\` | \`${hashes['paired-deltas.json']}\` |
| \`research-summary.json\` | \`${hashes['research-summary.json']}\` |

## Paired Evaluation Baselines Covered
- **Model vs. Uniform Baseline** (\`modelVsUniform\`)
- **Model vs. Walk-Forward Historical Frequency Baseline** (\`modelVsHistoricalFrequency\`)

## Separation of Evaluation Domains
> [!IMPORTANT]
> **Prospective vs. Retrospective Separation**:
${prospectiveManifestSection}
> - **1930-2022 Historical Replay Benchmark (964 matches)**: Brier = **${Number(fullSeeded.meanBrier.toFixed(4))}**, Accuracy = **${Number((fullSeeded.accuracy * 100).toFixed(2))}%**.
> These two evaluation domains are strictly separated in accordance with Owner D governance rules.
`;

    fs.writeFileSync(path.join(outputDir, 'MANIFEST.md'), manifestMd, 'utf8');

    return {
      outputDir,
      files: [...files, 'MANIFEST.md'],
      hashes,
      prospectiveMetrics
    };
  }
}

module.exports = ArtifactGenerator;
