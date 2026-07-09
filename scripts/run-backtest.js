#!/usr/bin/env node
const BacktestRunner = require('../lib/backtest');
const runner = new BacktestRunner();
const isJson = process.argv.includes('--json');
runner.run({ silent: isJson }).then(results => {
  if (isJson && results && results.fullSeeded) {
    const output = {
      fullSeeded: {
        evaluatedCount: results.fullSeeded.evaluatedCount,
        accuracy: results.fullSeeded.accuracy,
        meanBrier: results.fullSeeded.meanBrier,
        meanLogLoss: results.fullSeeded.meanLogLoss,
        baselines: results.fullSeeded.baselines,
        hypothesisReport: results.fullSeeded.hypothesisReport,
        reliabilityDiagram: results.fullSeeded.reliabilityDiagram
      }
    };
    console.log(JSON.stringify(output, null, 2));
  }
}).catch(err => {
  console.error(err);
  process.exit(1);
});
