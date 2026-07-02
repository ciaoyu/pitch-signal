#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const PredictionEngine = require('../lib/prediction');
const signal = require('../lib/services/continental-strength-signal');

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

console.log('━━━ continental-strength signal tests ━━━');

assert(signal.confederationForTeam('France') === 'UEFA', 'maps UEFA teams');
assert(signal.confederationForTeam('Brazil') === 'CONMEBOL', 'maps CONMEBOL teams');
assert(signal.confederationForTeam('United States') === 'CONCACAF', 'maps common aliases');

const uefaVsCaf = signal.buildSignal('France', 'Senegal');
assert(uefaVsCaf && uefaVsCaf.homeConfed === 'UEFA' && uefaVsCaf.awayConfed === 'CAF', 'builds cross-confederation signal');
assert(uefaVsCaf && uefaVsCaf.home > uefaVsCaf.away, 'positive Elo head leans toward stronger confederation');
assert(uefaVsCaf && uefaVsCaf.eloDelta === 157, 'uses reference Elo head delta');

const sameConfed = signal.buildSignal('France', 'Germany');
assert(sameConfed === null, 'same-confederation matches do not inject a signal');

const engine = new PredictionEngine();
const baseParams = {
  homeId: 'Home',
  awayId: 'Away',
  homeRating: { rating: 1500, attack_strength: 1, defense_strength: 1 },
  awayRating: { rating: 1500, attack_strength: 1, defense_strength: 1 },
};
const baseline = engine.predict(baseParams);
const withSignal = engine.predict({ ...baseParams, continentalStrengthSignal: uefaVsCaf });
assert(!baseline.components.continentalStrength, 'baseline has no continental component without injected signal');
assert(withSignal.components.continentalStrength, 'engine exposes continental component when injected');
assert(withSignal.homeWin > baseline.homeWin, 'continental signal shifts probabilities only when injected');

const serviceSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'services', 'PredictionService.js'), 'utf8');
assert(serviceSrc.includes("CONTINENTAL_STRENGTH_SIGNAL_ENABLED === 'true'"), 'PredictionService keeps continental signal behind explicit env gate');

const backtestSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'backtest.js'), 'utf8');
assert(backtestSrc.includes("'continentalStrengthSignal'"), 'compareBaseline accepts continental signal as an explicit candidate config');
assert(backtestSrc.includes('continentalStrengthSignal.buildSignal(homeTeam, awayTeam)'), 'walk-forward backtest injects continental signal only when candidate config enables it');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
