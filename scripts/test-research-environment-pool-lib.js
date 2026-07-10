#!/usr/bin/env node
/**
 * UNIT TEST — Owner E pool adapter logic.
 *
 * Uses a SMALL SYNTHETIC CSV (3 rows) to verify parsing, tournament
 * classification, as-of confederation inference, rest-day gap and
 * cross-confederation join. Synthetic data is used ONLY here for unit testing;
 * it must NEVER enter a research artifact / coverage report (per governance:
 * synthetic data is unit-test-only).
 *
 * Run: node scripts/test-research-environment-pool-lib.js
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./research-environment-pool-lib');

const SYNTHETIC_CSV = [
  'date,home_team,away_team,home_score,away_score,tournament,city,country,neutral',
  '2000-01-01,TeamA,TeamB,1,0,Friendly,CityX,CountryX,FALSE',
  '2000-01-05,TeamA,TeamC,2,1,UEFA Euro qualification,CityY,CountryY,FALSE',
  '2000-01-10,TeamB,TeamC,0,0,Copa América,CityZ,CountryZ,TRUE',
].join('\n');

// Parse
const rows = lib.parseCsv(SYNTHETIC_CSV);
assert.strictEqual(rows.length, 3, 'should parse 3 rows');
assert.strictEqual(rows[0].played, true);
assert.strictEqual(rows[2].neutral, true);

// Classify
assert.strictEqual(lib.classifyTournament('Friendly').type, 'friendly');
assert.strictEqual(lib.classifyTournament('UEFA Euro qualification').type, 'qualifier');
assert.strictEqual(lib.classifyTournament('UEFA Euro qualification').confed, 'UEFA');
assert.strictEqual(lib.classifyTournament('Copa América').type, 'continental');
assert.strictEqual(lib.classifyTournament('Copa América').confed, 'CONMEBOL');
assert.strictEqual(lib.classifyTournament('FIFA World Cup').type, 'world_cup');

// As-of confederation inference (earliest confederation-specific tournament)
// TeamC's earliest confed-specific tournament is UEFA Euro qualification (row 2),
// so its inferred confederation is UEFA, NOT Copa América (row 3).
const conf = lib.inferConfederations(rows);
assert.strictEqual(conf.get('TeamA'), 'UEFA');
assert.strictEqual(conf.get('TeamB'), 'CONMEBOL');
assert.strictEqual(conf.get('TeamC'), 'UEFA');

// analyzePool on the synthetic set (no venues -> 2026 altitude N/A)
const tmp = path.join(os.tmpdir(), 'e-synth-' + Date.now() + '.csv');
fs.writeFileSync(tmp, SYNTHETIC_CSV);
const r2 = lib.analyzePool(tmp, { venues: [] });
assert.strictEqual(r2.present, true);
assert.strictEqual(r2.pool.total_non_wc, 3);     // no WC rows
assert.strictEqual(r2.heldOut.world_cup_total, 0);
assert.strictEqual(r2.coverage.tournament_type_pct, 100);
assert.strictEqual(r2.coverage.neutral_pct, 100);
assert.strictEqual(r2.coverage.confed_home_resolved_pct, 100);
assert.strictEqual(r2.coverage.altitude_historical_pct, 0);
assert.strictEqual(r2.coverage.weather_wbgt_pct, 0);
assert.strictEqual(r2.coverage.cross_confederation_resolved_pct, 100);
fs.unlinkSync(tmp);

console.log('PASS: research-environment-pool-lib unit tests (synthetic data, unit-test-only)');
