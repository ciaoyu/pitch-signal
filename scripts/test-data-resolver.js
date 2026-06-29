#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pitch-signal-data-resolver-'));
const runtimeRoot = path.join(tempRoot, 'runtime');
const seedDir = path.join(tempRoot, 'seed', 'wc2026');
fs.mkdirSync(seedDir, { recursive: true });

process.env.DATA_PATH = runtimeRoot;
process.env.SEED_DATA_PATH = seedDir;

const {
  getRuntimeDataPath,
  resolveDataPath,
  writeJsonAtomic,
  writeTextAtomic,
} = require('../lib/data-resolver');

let passed = 0;

function check(name, fn) {
  fn();
  passed++;
  console.log(`  ✅ ${name}`);
}

try {
  const seedFile = path.join(seedDir, 'sample.json');
  fs.writeFileSync(seedFile, '{"source":"seed"}\n');

  check('falls back to immutable seed data', () => {
    assert.strictEqual(resolveDataPath('sample.json'), seedFile);
  });

  const runtimeFile = getRuntimeDataPath('sample.json');
  fs.writeFileSync(runtimeFile, '{"source":"runtime"}\n');

  check('runtime data takes precedence over seed data', () => {
    assert.strictEqual(resolveDataPath('sample.json'), runtimeFile);
  });

  fs.writeFileSync(runtimeFile, '{broken json');
  check('corrupt runtime data is not silently replaced by seed data', () => {
    assert.throws(
      () => JSON.parse(fs.readFileSync(resolveDataPath('sample.json'), 'utf8')),
      SyntaxError
    );
  });

  check('missing required data fails explicitly', () => {
    assert.throws(() => resolveDataPath('missing.json'), /Missing wc2026 data file/);
  });

  check('path traversal is rejected', () => {
    assert.throws(() => resolveDataPath('../secret.json'), /Invalid wc2026 data filename/);
  });

  check('JSON writes are atomic and runtime-only', () => {
    const target = writeJsonAtomic('written.json', { ok: true });
    assert.strictEqual(target, path.join(runtimeRoot, 'wc2026', 'written.json'));
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { ok: true });
    assert.strictEqual(fs.existsSync(path.join(seedDir, 'written.json')), false);
    assert.deepStrictEqual(
      fs.readdirSync(path.dirname(target)).filter(name => name.includes('.tmp-')),
      []
    );
  });

  check('text writes are runtime-only', () => {
    const target = writeTextAtomic('report.txt', 'ok\n');
    assert.strictEqual(fs.readFileSync(target, 'utf8'), 'ok\n');
    assert.strictEqual(fs.existsSync(path.join(seedDir, 'report.txt')), false);
  });

  console.log(`\n${passed} passed, 0 failed`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
