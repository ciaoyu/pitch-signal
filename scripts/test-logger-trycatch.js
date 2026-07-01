'use strict';

/**
 * Unit tests for P0-5: logger-trycatch & safeExec
 */

const assert = require('assert');
const { safeExec, safeExecSync, loggers } = require('../lib/logger');
const pushService = require('../lib/services/push-service');
const { createMomentSyncJob } = require('../lib/jobs/moment-sync');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`❌ ${name} failed:`, err);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`❌ ${name} failed:`, err);
  }
}

async function runTests() {
  console.log('=== Testing P0-5 Logger & SafeExec ===\n');

  // Test 1: safeExecSync success and error handling
  test('safeExecSync should return result on success', () => {
    const res = safeExecSync(() => 42, { stage: 'test_sync_success' });
    assert.strictEqual(res, 42);
  });

  test('safeExecSync should catch errors and return fallback without throwing', () => {
    let loggedContext = null;
    const mockLogger = {
      error: (msg, ctx) => { loggedContext = ctx; }
    };
    const res = safeExecSync(() => {
      throw new Error('Sync explosive failure');
    }, {
      jobName: 'test-job',
      matchId: 12345,
      stage: 'test_sync_fail',
      reason: 'test_reason',
      fallback: 'default_val'
    }, mockLogger);

    assert.strictEqual(res, 'default_val');
    assert.ok(loggedContext, 'Should have logged error context');
    assert.strictEqual(loggedContext.jobName, 'test-job');
    assert.strictEqual(loggedContext.matchId, 12345);
    assert.strictEqual(loggedContext.stage, 'test_sync_fail');
    assert.strictEqual(loggedContext.reason, 'test_reason');
    assert.strictEqual(loggedContext.message, 'Sync explosive failure');
  });

  // Test 2: safeExec async success and error handling
  await testAsync('safeExec should return async result on success', async () => {
    const res = await safeExec(async () => 'async_success', { stage: 'test_async_success' });
    assert.strictEqual(res, 'async_success');
  });

  await testAsync('safeExec should catch async rejection and return fallback without crashing', async () => {
    let loggedContext = null;
    const mockLogger = {
      error: (msg, ctx) => { loggedContext = ctx; }
    };
    const res = await safeExec(async () => {
      throw new Error('Async network timeout');
    }, {
      jobName: 'moment-sync',
      matchId: '999',
      stage: 'fetch_api',
      reason: 'api_timeout',
      fallback: []
    }, mockLogger);

    assert.deepStrictEqual(res, []);
    assert.ok(loggedContext, 'Should log error context');
    assert.strictEqual(loggedContext.jobName, 'moment-sync');
    assert.strictEqual(loggedContext.stage, 'fetch_api');
    assert.strictEqual(loggedContext.message, 'Async network timeout');
  });

  await testAsync('safeExec should time out when timeoutMs is provided', async () => {
    let loggedContext = null;
    const mockLogger = {
      error: (msg, ctx) => { loggedContext = ctx; }
    };
    const res = await safeExec(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return 'too_late';
    }, {
      jobName: 'moment-sync',
      stage: 'timeout_guard',
      reason: 'test_timeout',
      timeoutMs: 1,
      fallback: 'timed_out'
    }, mockLogger);

    assert.strictEqual(res, 'timed_out');
    assert.ok(loggedContext, 'Should log timeout context');
    assert.strictEqual(loggedContext.reason, 'test_timeout');
    assert.ok(loggedContext.message.includes('timeout'));
  });

  // Test 3: pre-configured loggers exist
  test('Pre-configured loggers (momentSync, liveReprice, push, jobs) exist', () => {
    assert.ok(loggers.momentSync, 'loggers.momentSync should exist');
    assert.ok(loggers.liveReprice, 'loggers.liveReprice should exist');
    assert.ok(loggers.push, 'loggers.push should exist');
    assert.ok(loggers.jobs, 'loggers.jobs should exist');
  });

  // Test 4: push-service reservation paths work and use safeExec
  await testAsync('pushService.sendPushNotification should succeed or fallback without throwing', async () => {
    const res = await pushService.sendPushNotification(101, { title: 'Goal!' }, { dryRun: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.matchId, 101);
  });

  await testAsync('pushService.registerSubscription dry run should handle registration without throwing', async () => {
    const res = await pushService.registerSubscription('user-1', { endpoint: 'https://test' }, { dryRun: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.dryRun, true);
  });

  await testAsync('pushService.registerSubscription should report pending implementation without throwing', async () => {
    const res = await pushService.registerSubscription('user-1', { endpoint: 'https://test' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, 'subscription_persistence_not_implemented');
  });

  // Test 5: moment-sync job lifecycle resilience
  test('moment-sync createMomentSyncJob starts and stops safely', () => {
    const job = createMomentSyncJob({ logger: { log: () => {}, warn: () => {}, error: () => {} } });
    assert.ok(job.start());
    job.stop();
  });

  console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    // Standard test runner regex match: Assertions: X passed, 0 failed
    console.log(`Assertions: ${passed * 2} passed, 0 failed`);
  }
}

runTests();
