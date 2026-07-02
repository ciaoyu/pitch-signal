#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const PredictionEngine = require('../lib/prediction');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('━━━ elo-guided base lambda tests ━━━');

const engine = new PredictionEngine();
assert(engine.eloGuidedBaseLambda === 1.5, 'default Elo-guided base lambda keeps accepted legacy baseline');

const candidate = new PredictionEngine({ eloGuidedBaseLambda: 0.6 });
assert(candidate.eloGuidedBaseLambda === 0.6, '0.6 candidate remains available for compareBaseline');

const currentLambda = engine.eloGuidedLambda(0.5, 1.2, 1500, 1500);
const candidateLambda = candidate.eloGuidedLambda(0.5, 1.2, 1500, 1500);
assert(candidateLambda < currentLambda, '0.6 candidate lowers neutral Elo pull versus accepted default');

const backtestSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'backtest.js'), 'utf8');
assert(backtestSrc.includes("'eloGuidedBaseLambda'"), 'compareBaseline accepts eloGuidedBaseLambda as an explicit candidate config');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
