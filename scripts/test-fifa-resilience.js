#!/usr/bin/env node
/**
 * FIFA API 容错降级单测 (P0-1)
 *
 * 覆盖：
 *  1. Schema 校验（正常历表/实时比赛、缺失必要字段、格式非对象）
 *  2. 缓存回退与 stale: true 标记（正常获取后模拟网络/校验失败，应当回退缓存）
 *  3. API 连通状态查询（ok / stale / down 转换）
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

console.log('=== FIFA API Resilience (P0-1) 单测 ===\n');

// ---------- 1. Schema 校验 ----------
console.log('📊 1. Schema 校验');
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

// ---------- 2. 状态与缓存回退测试 ----------
console.log('📊 2. Live match 解析');
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

// ---------- 3. 状态与缓存回退测试 ----------
console.log('📊 3. 状态转换与缓存回退 (stale/down)');
{
  clearCache();
  fifaApi._resetStatus();
  check(fifaApi.getStatus() === 'ok', '初始状态应为 ok');
  check(fifaApi.getLastSyncAt() === null, '初始 lastSyncAt 为 null');

  // 模拟缓存中已有数据，利用本地断连端口 127.0.0.1:1 触发秒级网络异常
  const mockUrl = 'https://127.0.0.1:1/test_endpoint';
  const mockData = { Results: [{ IdMatch: '999', HomeTeam: { IdCountry: 'ARG' } }] };
  setCache(mockUrl, mockData);

  // 传 ttlMs = -1 确保 _getFresh 判定为缓存过期，触发从网络拉取
  // 当连接 127.0.0.1:1 失败时，应当触发 fallback 回退到缓存中的 mockData 并标记 stale
  fifaApi._fetchJsonWithFallback(mockUrl, -1, null).then(result => {
    check(result.stale === true, '连接失败但有缓存时，应标记 stale: true');
    check(result.data !== null && result.data.Results[0].IdMatch === '999', '回退到了老旧缓存数据');
    check(fifaApi.getStatus() === 'stale', 'API 状态转换为 stale');

    // 清空缓存后再次请求，模拟彻底无法连通 (down)
    clearCache();
    fifaApi._resetStatus();
    return fifaApi._fetchJsonWithFallback(mockUrl, -1, null);
  }).then(resultDown => {
    check(resultDown.down === true, '无缓存且请求失败时，应标记 down: true');
    check(resultDown.data === null, '无数据返回 null');
    check(fifaApi.getStatus() === 'down', 'API 状态转换为 down');

    // ---------- 总结 ----------
    console.log('\n=== 总结 ===');
    console.log(`  通过: ${pass}`);
    console.log(`  失败: ${fail}`);
    if (fail > 0) {
      console.error('\n❌ test-fifa-resilience 单测失败:');
      failures.forEach((m) => console.error('   -', m));
      process.exit(1);
    }
    console.log('\n✅ test-fifa-resilience 单测全部通过!');
    process.exit(0);
  }).catch(err => {
    console.error('测试异常报错:', err);
    process.exit(1);
  });
}
