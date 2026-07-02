#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const PredictionEngine = require('../lib/prediction');
const signal = require('../lib/services/market-value-signal');

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

console.log('━━━ market-value signal tests ━━━');

assert(signal.parseEur('€1.2bn') === 1_200_000_000, 'parseEur handles billion shorthand');
assert(signal.parseEur('410m') === 410_000_000, 'parseEur handles million shorthand');

const dataset = {
  source: 'unit-test',
  updatedAt: '2026-07-03',
  teams: {
    Brazil: { squadValueEur: 1_260_000_000 },
    Morocco: { squadValueEur: 410_000_000 },
    Spain: {
      players: [
        { name: 'A', marketValueEur: 100_000_000 },
        { name: 'B', marketValueEur: 50_000_000 },
      ],
    },
  },
};

const built = signal.buildSignal('Brazil', 'Morocco', { dataset });
assert(built && built.home > built.away, 'higher squad value leans toward home team');
assert(built && built.homeValueEur === 1_260_000_000 && built.awayValueEur === 410_000_000, 'signal keeps source values for audit');
assert(built && built.confidence <= 0.78, 'confidence is capped');

const playerSum = signal.buildSignal('Spain', 'Morocco', { dataset });
assert(playerSum && playerSum.homeValueEur === 150_000_000, 'team value can be derived from player market values');

const tmpFile = path.join(os.tmpdir(), `pitch-signal-market-values-${process.pid}.json`);
fs.writeFileSync(tmpFile, JSON.stringify(dataset), 'utf8');
assert(signal.buildSignal('brazil', 'morocco', { filePath: tmpFile })?.source === 'unit-test', 'file-backed lookup is case/diacritic tolerant');
try { fs.unlinkSync(tmpFile); } catch (_) {}

const engine = new PredictionEngine();
const baseParams = {
  homeId: 'Home',
  awayId: 'Away',
  homeRating: { rating: 1500, attack_strength: 1, defense_strength: 1 },
  awayRating: { rating: 1500, attack_strength: 1, defense_strength: 1 },
};
const baseline = engine.predict(baseParams);
const withSignal = engine.predict({ ...baseParams, marketValueSignal: built });
assert(!baseline.components.marketValue, 'baseline has no market-value component without injected signal');
assert(withSignal.components.marketValue && withSignal.marketValueSignalUsed !== true, 'engine exposes market-value component when injected');
assert(withSignal.homeWin > baseline.homeWin, 'market-value signal shifts probabilities only when injected');

const serviceSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'services', 'PredictionService.js'), 'utf8');
assert(serviceSrc.includes("MARKET_VALUE_SIGNAL_ENABLED === 'true'"), 'PredictionService keeps market-value signal behind explicit env gate');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
