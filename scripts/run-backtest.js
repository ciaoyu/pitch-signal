#!/usr/bin/env node
'use strict';

const path = require('path');
const BacktestRunner = require('../lib/backtest');
const ArtifactGenerator = require('../lib/research/artifactGenerator');

async function main() {
  const isJson = process.argv.includes('--json');
  const shouldExport = process.argv.includes('--export') || !isJson; // Default exports when run directly
  const exportDirIdx = process.argv.indexOf('--export-dir');
  const outputDir = exportDirIdx > -1 ? process.argv[exportDirIdx + 1] : path.join(__dirname, '..', 'outputs', 'research');

  const runner = new BacktestRunner();
  const results = await runner.run({ silent: isJson });

  if (isJson && results && results.fullSeeded) {
    const output = {
      fullSeeded: {
        evaluatedCount: results.fullSeeded.evaluatedCount,
        accuracy: results.fullSeeded.accuracy,
        meanBrier: results.fullSeeded.meanBrier,
        meanLogLoss: results.fullSeeded.meanLogLoss,
        baselines: results.fullSeeded.baselines,
        hypothesisReport: results.fullSeeded.hypothesisReport,
        reliabilityDiagram: results.fullSeeded.reliabilityDiagram,
        venueAudit: results.fullSeeded.venueAudit
      }
    };
    console.log(JSON.stringify(output, null, 2));
  }

  if (shouldExport && results && results.fullSeeded) {
    console.log(`📦 Generating research artifacts to: ${outputDir}`);
    const manifestInfo = await ArtifactGenerator.writeArtifacts(outputDir, results, process.argv.join(' '));
    console.log('✅ Generated research artifacts:');
    for (const file of manifestInfo.files) {
      console.log(`   - ${file}`);
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Backtest execution failed:', err);
    process.exit(1);
  });
}

module.exports = main;
