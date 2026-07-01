'use strict';

/**
 * P0-2 Health Enhancement Tests
 */

const assert = require('assert');
const createHealthRoutes = require('../lib/routes/health');
const fifaApi = require('../lib/services/fifa-api');
const { recordStart, recordSuccess, recordError, recordStop, _resetForTest } = require('../lib/jobs/registry');

async function testHealthEnhancement() {
  console.log('=== Test: /health Enhancement ===');
  
  _resetForTest();
  fifaApi._resetStatus();

  const routes = createHealthRoutes({});
  const healthHandler = routes['GET /health'];
  assert(typeof healthHandler === 'function', 'GET /health route handler must exist');

  // 1. Initial health state
  let res = await healthHandler();
  assert.strictEqual(res.status, 'healthy', 'status should be healthy');
  assert.strictEqual(res.fifaApi, 'ok', 'initial fifaApi status should be ok');
  assert.strictEqual(res.fifaLastSyncAt, null, 'initial fifaLastSyncAt should be null');
  assert(res.jobs, 'jobs object should be present');
  assert(res.jobs['moment-sync'], 'moment-sync job should be registered by default');
  assert.strictEqual(res.jobs['moment-sync'].status, 'idle', 'default status should be idle');
  assert.strictEqual(res.jobs['moment-sync'].lastSyncAt, null, 'default lastSyncAt should be null');

  // 2. Simulate job success
  recordStart('moment-sync');
  recordSuccess('moment-sync');
  res = await healthHandler();
  assert.strictEqual(res.jobs['moment-sync'].status, 'ok', 'moment-sync status should be ok');
  assert(typeof res.jobs['moment-sync'].lastSyncAt === 'string', 'lastSyncAt should be timestamp string');
  assert.strictEqual(res.jobs['moment-sync'].lastError, null, 'lastError should be null');

  // 3. Simulate job error
  recordStart('xg-collector');
  recordError('xg-collector', new Error('API limit reached'));
  res = await healthHandler();
  assert.strictEqual(res.jobs['xg-collector'].status, 'error', 'xg-collector status should be error');
  assert.strictEqual(res.jobs['xg-collector'].lastError, 'API limit reached', 'lastError should match error message');

  // 4. Simulate stopped job
  recordStop('odds-collector');
  res = await healthHandler();
  assert.strictEqual(res.jobs['odds-collector'].status, 'stopped', 'odds-collector status should be stopped');

  console.log('✅ PASS: /health Enhancement');
}

if (require.main === module) {
  testHealthEnhancement().catch(e => {
    console.error('❌ FAIL:', e);
    process.exit(1);
  });
}

module.exports = { testHealthEnhancement };
