#!/usr/bin/env node
'use strict';

/**
 * Owner G: CLI Runner for Controlled Odds Milestone Collection Job
 *
 * Usage:
 *   node scripts/run-odds-collector.js
 *   node scripts/run-odds-collector.js --milestone T_MINUS_24H --force
 */

const path = require('path');
const { createOddsCollectorJob } = require('../lib/jobs/odds-collector');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--milestone' && args[i + 1]) {
      options.milestone = args[i + 1];
      i++;
    } else if (args[i] === '--force') {
      options.force = true;
    }
  }

  console.log('📡 Starting Owner G Odds Milestone Collection Job...');
  console.log(`Milestone: ${options.milestone || 'Standard'}, Force: ${Boolean(options.force)}`);

  const job = createOddsCollectorJob({ dataDir: DATA_DIR });
  const result = await job.collectOdds(options);

  console.log('\n==================================================');
  console.log('📊 Odds Collector Job Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('==================================================');

  if (result.status === 'unavailable' || result.status === 'error') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in run-odds-collector:', err);
  process.exit(1);
});
