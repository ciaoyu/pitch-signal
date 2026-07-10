#!/usr/bin/env node
'use strict';

const path = require('path');
const BacktestRunner = require('../lib/backtest');
const ArtifactGenerator = require('../lib/research/artifactGenerator');

async function generate() {
  const outputDir = process.argv[2] || path.join(__dirname, '..', 'outputs', 'research');
  console.log(`📦 Running 964-match backtest and exporting research artifacts to: ${outputDir}`);

  const runner = new BacktestRunner();
  const results = await runner.run({ silent: true });

  if (results && results.fullSeeded) {
    const manifestInfo = await ArtifactGenerator.writeArtifacts(outputDir, results, 'node scripts/research-generate-artifacts.js');
    console.log('✅ Generated research artifacts successfully:');
    for (const file of manifestInfo.files) {
      console.log(`   - ${file}`);
    }
  } else {
    throw new Error('Backtest fullSeeded results missing');
  }
}

if (require.main === module) {
  generate().catch(err => {
    console.error('❌ Failed to generate research artifacts:', err);
    process.exit(1);
  });
}

module.exports = generate;
