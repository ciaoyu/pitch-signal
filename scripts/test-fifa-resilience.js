#!/usr/bin/env node
/**
  * FIFA API fault-tolerance / graceful-degradation unit test (P0-1)
 *
  * Coverage:
  *  1. Schema validation (normal fixture/real-time match, missing required field, non-object format)
  *  2. Cache fallback with stale: true flag (after normal fetch, simulate network/validation failure, should fall back to cache)
  *  3. API connectivity status query (ok / stale / down transitions)
 */

const assert = require('assert');
const fifaApi = require('../lib/services/fifa-api');
const { setCache, clearCache } = require('../middleware/cache');

let pass = 0;
let fail = 0;
const failures = [];

function check(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('  ✗ FAIL:', msg); }
}

console.log('=== FIFA API Resilience (P0-1) unit test ===\n');

// ---------- 1. Schema validation ----------
console.log('📊 1. Schema validation');
{
  const valCal = fifaApi._validateCalendarSchema;
  check(valCal({ Results: [] }) === true, '空数组 Results 合法');
  check(valCal({ Results: [{ IdMatch: '101', HomeTeam: {} }] }) === true, '正常比赛列表合法');
  check(valCal(null) === false, 'null 非法');
  check(valCal({}) === false, '无 Results 字段非法');
  check(valCal({ Results: [{}] }) === false, '列表元素无 ID 字段非法');

  const valLive = fifaApi._validateLiveMatchSchema;
  check(valLive({ IdMatch: '101', IdStage: '201', HomeTeam: {}, AwayTeam: {} }) === true, '正常实时数据合法');
  check(valLive({ IdMatch: '101' }) === false, '缺 IdStage 非法');
  check(valLive({ IdStage: '201' }) === false, '缺 IdMatch 非法');
  check(valLive(null) === false, 'null 实时数据非法');
}

// ---------- 2. Status & cache fallback test ----------
console.log('📊 2. Live match parsing');
{
  const parsed = fifaApi._parseLiveMatch({
    IdMatch: 'm1',
    IdStage: 's1',
    MatchStatus: 0,
    HomeTeam: { IdCountry: 'ARG', Score: 3 },
    AwayTeam: { IdCountry: 'FRA', Score: 2 },
  });
  check(parsed.status === 0, 'FIFA 终场状态保留为 0');
  check(parsed.homeScore === 3 && parsed.awayScore === 2, 'FIFA 比分正确解析');
  check(parsed.homeTeam.id === 'ARG' && parsed.awayTeam.id === 'FRA', 'FIFA IdCountry 暴露给回写映射');
}

// ---------- 3. Status & cache fallback test ----------
console.log('📊 3. State transition and cache fallback (stale/down)');
{
  clearCache();
  fifaApi._resetStatus();
  check(fifaApi.getStatus() === 'ok', '初始状态应为 ok');
  check(fifaApi.getLastSyncAt() === null, '初始 lastSyncAt 为 null');

  // Simulate cache already has data; use local dead port 127.0.0.1:1 to trigger a second-level network error
  const mockUrl = 'https://127.0.0.1:1/test_endpoint';
  const mockData = { Results: [{ IdMatch: '999', HomeTeam: { IdCountry: 'ARG' } }] };
  setCache(mockUrl, mockData);

  // Pass ttlMs = -1 to force _getFresh to treat cache as expired, triggering a network fetch
  // When connecting to 127.0.0.1:1 fails, should trigger fallback to mockData in cache and mark stale
  fifaApi._fetchJsonWithFallback(mockUrl, -1, null).then(result => {
    check(result.stale === true, '连接失败但有缓存时，应标记 stale: true');
    check(result.data !== null && result.data.Results[0].IdMatch === '999', '回退到了老旧缓存数据');
    check(fifaApi.getStatus() === 'stale', 'API 状态转换为 stale');

    // After clearing cache, request again to simulate total unreachability (down)
    clearCache();
    fifaApi._resetStatus();
    return fifaApi._fetchJsonWithFallback(mockUrl, -1, null);
  }).then(resultDown => {
    check(resultDown.down === true, '无缓存且请求失败时，应标记 down: true');
    check(resultDown.data === null, '无数据返回 null');
    check(fifaApi.getStatus() === 'down', 'API 状态转换为 down');

    // ---------- Summary ----------
    console.log('\n=== Summary ===');
    console.log(`  Passed: ${pass}`);
    console.log(`  Failed: ${fail}`);
    if (fail > 0) {
      console.error('\n❌ test-fifa-resilience unit test failed:');
      failures.forEach((m) => console.error('   -', m));
      process.exit(1);
    }
    console.log('\n✅ test-fifa-resilience all unit tests passed!');
    process.exit(0);
  }).catch(err => {
    console.error('Test exception error:', err);
    process.exit(1);
  });
}
