#!/usr/bin/env node
'use strict';

/**
 * node:test 测试运行器
 * 替代旧的手工 testAssert 模式，使用 Node.js 内置测试框架。
 *
 * 用法:
 *   node scripts/test-runner.js                    # 运行所有
 *   node scripts/test-runner.js --match "Elo"      # 匹配过滤
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'scripts');

// 测试文件列表（按依赖顺序）
const TEST_FILES = [
  'test-elo.js',
  'test-poisson.js',
  'test-prediction.js',
  'test-backtest-sort.js',
  'test-pre-match-snapshot-guard.js',
  'test-same-day-leakage.js',
  'test-eventFilter.js',
  'test-post-match-review.js',
  'test-services.js',
];

const filter = process.argv.includes('--match')
  ? process.argv[process.argv.indexOf('--match') + 1]
  : null;

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

console.log('=== PitchSignal Test Suite (node:test) ===\n');

for (const file of TEST_FILES) {
  if (filter && !file.toLowerCase().includes(filter.toLowerCase())) continue;

  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} — file not found, skipping`);
    continue;
  }

  process.stdout.write(`📋 ${file} ... `);
  try {
    const env = {
      ...process.env,
      TEST_MODE: '1',
      TEST_DB_PATH: ':memory:',
      NODE_ENV: 'test',
    };
    execSync(`node "${filePath}"`, {
      cwd: ROOT,
      env,
      stdio: 'pipe',
      timeout: 30000,
    });
    console.log('✅ PASS');
    totalPassed++;
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    const stdout = e.stdout?.toString() || '';

    // Count individual test results from output
    const passCount = (stdout.match(/PASS:|✅/g) || []).length;
    const failCount = (stdout.match(/FAIL:|❌/g) || []).length;

    console.log(`❌ FAIL (${failCount} failures)`);
    totalFailed++;

    failures.push({
      file,
      passCount,
      failCount,
      output: (stdout + '\n' + stderr).slice(-500),
    });
  }
}

// Summary
console.log('\n============================');
console.log(`Results: ${totalPassed} passed, ${totalFailed} failed, ${totalPassed + totalFailed} total suites`);
console.log('============================');

if (failures.length > 0) {
  console.log('\n--- Failure Details ---');
  for (const f of failures) {
    console.log(`\n❌ ${f.file} (${f.failCount} failures):`);
    console.log(f.output.slice(0, 300));
  }
  process.exit(1);
}

process.exit(0);
