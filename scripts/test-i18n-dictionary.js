#!/usr/bin/env node
'use strict';

/**
 * T6 regression test — i18n name dictionary externalization.
 *
 * Guards the refactor that moved the hardcoded ZH_NAMES literal out of
 * static/js/i18n.js into the canonical data file data/player_name_zh.json
 * (imported by i18n.js at build time).
 *
 * Invariants:
 *   1. The canonical dictionary JSON is valid, non-empty, well-formed.
 *   2. No duplicate keys (JSON.parse silently keeps the last on dupes).
 *   3. Every key/value is a non-empty string.
 *   4. i18n.js no longer inlines the dictionary (it imports the JSON).
 *   5. i18n.js stays small (the whole point of the split).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DICT_PATH = path.join(ROOT, 'data', 'player_name_zh.json');
const I18N_PATH = path.join(ROOT, 'static', 'js', 'i18n.js');

let passed = 0, failed = 0;
function check(cond, label) {
  try {
    assert(cond);
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('=== i18n Dictionary Externalization Tests ===\n');

console.log('📊 Canonical dictionary (data/player_name_zh.json):');
let dict;
try {
  dict = require(DICT_PATH);
  check(dict && typeof dict === 'object', 'loads as an object');
} catch (e) {
  check(false, `loads as an object (${e.message})`);
}
const entries = dict ? Object.keys(dict) : [];
check(entries.length >= 1000, `entry count >= 1000 (actual ${entries.length})`);

if (dict) {
  let badKey = 0, badVal = 0;
  for (const [k, v] of Object.entries(dict)) {
    if (typeof k !== 'string' || k.length === 0) badKey++;
    if (typeof v !== 'string' || v.length === 0) badVal++;
  }
  check(badKey === 0, `all ${entries.length} keys are non-empty strings`);
  check(badVal === 0, `all ${entries.length} values are non-empty strings`);

  // Spot-check a few well-known mappings survived the externalization
  check(dict['Lionel Messi'] === '莱昂内尔·梅西', 'Lionel Messi -> 莱昂内尔·梅西');
  check(dict['Kylian Mbappé'] === '基利安·姆巴佩', 'Kylian Mbappé -> 基利安·姆巴佩');
  check(dict['RODRI'] === '罗德里', 'uppercase fallback key RODRI preserved');
}

console.log('\n📊 No duplicate keys (raw text scan):');
{
  const raw = fs.readFileSync(DICT_PATH, 'utf8');
  const keys = [];
  const re = /"((?:[^"\\]|\\.)*)"\s*:/g;
  let m;
  while ((m = re.exec(raw)) !== null) keys.push(m[1]);
  const uniq = new Set(keys);
  check(uniq.size === keys.length, `no duplicate keys (${keys.length} keys, ${uniq.size} unique)`);
  check(uniq.size === entries.length, `scanned key count matches parsed entry count`);
}

console.log('\n📊 static/js/i18n.js no longer inlines the dictionary:');
{
  const src = fs.readFileSync(I18N_PATH, 'utf8');
  const lines = src.split('\n');
  check(!src.includes('const ZH_NAMES = {'), 'ZH_NAMES literal removed from i18n.js');
  check(src.includes("import ZH_NAMES from '../../data/player_name_zh.json'"),
    'i18n.js imports the canonical dictionary JSON');
  check(lines.length <= 320, `i18n.js is small (${lines.length} lines, limit 320)`);
  // The dictionary entries must not be inlined as '"English": "中文"' lines.
  const inlined = src.split('\n').filter(l => /^\s*"[^"]+"\s*:\s*"[\u3400-\u9fff]/.test(l)).length;
  check(inlined === 0, `no inlined "English": "中文" entries (found ${inlined})`);
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
