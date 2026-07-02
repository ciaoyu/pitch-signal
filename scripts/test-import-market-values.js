#!/usr/bin/env node
'use strict';

const { parseCsv, buildNameMap } = require('./import-market-values');

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

console.log('━━━ import-market-values tests ━━━');

const rows = parseCsv('name,total_market_value,coach\n"United States",100000000,"A, B"\nBrazil,1200000000,Tite\n');
assert(rows.length === 2, 'parseCsv returns rows');
assert(rows[0].coach === 'A, B', 'parseCsv handles quoted commas');
assert(rows[1].total_market_value === '1200000000', 'parseCsv keeps numeric fields as strings for caller conversion');

const resolver = buildNameMap({
  'United States': { name_official: 'United States', the_odds_name: 'USA', fifa_code: 'USA' },
});
assert(resolver.resolve('USA') === 'United States', 'buildNameMap maps aliases to ratings id');
assert(resolver.resolve('Brazil') === 'Brazil', 'buildNameMap falls back to original name');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
