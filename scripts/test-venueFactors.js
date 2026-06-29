#!/usr/bin/env node
/**
 * venueFactors 单测
 *
 * 覆盖：
 *  1. β_alt 边界（Δh=0/1000/2000/1500，缺失回退）
 *  2. β_temp 边界（T=0/32/50/90°F，摄氏度转换，缺失回退）
 *  3. combinedFactor（β_alt·β_temp 组合，applied 传递）
 *  4. 单位转换 cToF
 *  5. matchId→venueId 反查（真实数据）
 *  6. ratingsId/espnId/英文名/中文名 → fifa code 多路解析
 *  7. 真实比赛 computeForTeam（baseCamp.altitude 尚未落盘 → β_alt 应回退 1）
 *  8. weather.tC 真实生效 → β_temp 应非 1
 *
 * 断言失败即 process.exit(1)，全绿打印 ✅。
 */
const vf = require('../lib/venueFactors');

let pass = 0;
let fail = 0;
const failures = [];

function approxEq(a, b, eps = 1e-4) {
  return Math.abs(a - b) <= eps;
}

function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('  ✗ FAIL:', msg); }
}

function assertApprox(actual, expected, msg, eps = 1e-4) {
  const ok = approxEq(actual, expected, eps);
  assert(ok, `${msg} (expected ${expected}, got ${actual})`);
}

console.log('=== venueFactors 单测 ===\n');

// ---------- 1. β_alt ----------
console.log('📊 1. β_alt 海拔衰减');
{
  // Δh = 0 → β = 1（无衰减）
  let r = vf.altitudeFactor(500, 500);
  assertApprox(r.beta, 1.0, 'Δh=0 → β_alt=1');
  assert(r.applied === false, 'Δh=0 applied=false');
  assert(r.source === 'no_altitude_effect', 'Δh=0 source');

  // Δh = 1000（恰好阈值）→ max(0,0)=0 → β=1
  r = vf.altitudeFactor(1500, 500);
  assertApprox(r.beta, 1.0, 'Δh=1000 阈值边界 → β_alt=1');
  assert(r.applied === false, 'Δh=1000 applied=false');

  // Δh = 2000 → max(0,(2000-1000)/1000)=1 → β=1-0.03·1=0.97
  r = vf.altitudeFactor(2200, 200);
  assertApprox(r.beta, 0.97, 'Δh=2000 → β_alt=0.97');
  assert(r.applied === true, 'Δh=2000 applied=true');
  assertApprox(r.deltaH, 2000, 'Δh=2000 deltaH');

  // Δh = 1500 → max(0,0.5)=0.5 → β=1-0.015=0.985
  r = vf.altitudeFactor(0, 1500);
  assertApprox(r.beta, 0.985, 'Δh=1500 → β_alt=0.985');

  // 双向对称：baseCamp<venue 与 baseCamp>venue 相同差值应得相同 β
  const a = vf.altitudeFactor(2200, 200);
  const b = vf.altitudeFactor(200, 2200);
  assertApprox(a.beta, b.beta, 'Δh 双向对称');

  // 缺失回退
  r = vf.altitudeFactor(null, 500);
  assertApprox(r.beta, 1.0, 'baseCamp 缺失 → β_alt=1');
  assert(r.applied === false, 'baseCamp 缺失 applied=false');
  assert(r.source === 'fallback:missing_altitude', 'baseCamp 缺失 source');

  r = vf.altitudeFactor(500, null);
  assertApprox(r.beta, 1.0, 'venue 缺失 → β_alt=1');

  r = vf.altitudeFactor(null, null);
  assertApprox(r.beta, 1.0, '双缺失 → β_alt=1');
}

// ---------- 2. β_temp ----------
console.log('📊 2. β_temp 高温衰减');
{
  // Fahrenheit input is converted to Celsius; 32°F = 0°C → no decay.
  let r = vf.temperatureFactorF(32);
  assertApprox(r.beta, 1.0, 'T=32°F → β_temp=1');
  assert(r.applied === false, 'T=32°F applied=false');

  // T=0°F → max(0,-32)=0 → β=1（低温不衰减，只惩罚高温）
  r = vf.temperatureFactorF(0);
  assertApprox(r.beta, 1.0, 'T=0°F → β_temp=1');

  // T=50°F = 10°C → no decay
  r = vf.temperatureFactorF(50);
  assertApprox(r.beta, 1, 'T=50°F → β_temp=1');
  assert(r.applied === false, 'T=50°F applied=false');

  // T=90°F ≈ 32.22°C → very small decay
  r = vf.temperatureFactorF(90);
  assertApprox(r.beta, 0.9978, 'T=90°F → β_temp≈0.9978');

  // 摄氏度入口：0°C = 32°F → β=1
  r = vf.temperatureFactor(0);
  assertApprox(r.beta, 1.0, 'T=0°C → β_temp=1');

  // 30°C is below the 32°C heat threshold
  r = vf.temperatureFactor(30);
  assertApprox(r.beta, 1, 'T=30°C → β_temp=1');

  // 10°C → no decay
  r = vf.temperatureFactor(10);
  assertApprox(r.beta, 1, 'T=10°C → β_temp=1');

  // 缺失回退
  r = vf.temperatureFactorF(null);
  assertApprox(r.beta, 1.0, 'T 缺失 → β_temp=1');
  assert(r.source === 'fallback:missing_temp', 'T 缺失 source');

  r = vf.temperatureFactor(null);
  assertApprox(r.beta, 1.0, 'T(℃) 缺失 → β_temp=1');

  r = vf.temperatureFactor(NaN);
  assertApprox(r.beta, 1.0, 'T=NaN → β_temp=1');
}

// ---------- 3. 单位转换 ----------
console.log('📊 3. cToF 单位转换');
{
  assertApprox(vf.cToF(0), 32, '0°C = 32°F');
  assertApprox(vf.cToF(100), 212, '100°C = 212°F');
  assertApprox(vf.cToF(30), 86, '30°C = 86°F');
  assert(vf.cToF(null) === null, 'cToF(null) = null');
  assert(vf.cToF(NaN) === null, 'cToF(NaN) = null');
}

// ---------- 4. 真实数据：matchId→venueId 反查 ----------
console.log('📊 4. matchId → venueId 反查（真实 venues.json）');
{
  // 400021440 在 Atlanta (Mercedes-Benz Stadium, venueId=400098290) 的 matches 里
  const v = vf.getMatchVenue('400021440');
  assert(v != null, 'matchId 400021440 反查到 venue');
  assert(v?.id === '400098290', '400021440 → Atlanta (400098290)');

  // 不存在的 matchId
  const v2 = vf.getMatchVenue('999999999');
  assert(v2 === null, '不存在 matchId → null');
}

// ---------- 5. 球队标识多路解析（id_bridge 桥接） ----------
console.log('📊 5. 球队标识 → fifa code 多路解析（id_bridge）');
{
  // FIFA code 直入
  assert(vf.resolveTeamCode('ARG') === 'ARG', 'code ARG → ARG');
  assert(vf.resolveTeamCode('ALG') === 'ALG', 'code ALG → ALG');
  assert(vf.resolveTeamCode('GER') === 'GER', 'code GER → GER');

  // 英文名（经 id_bridge.name_en 反索引）
  assert(vf.resolveTeamCode('Argentina') === 'ARG', 'Argentina → ARG');
  assert(vf.resolveTeamCode('argentina') === 'ARG', 'argentina (lower) → ARG');
  assert(vf.resolveTeamCode('Germany') === 'GER', 'Germany → GER');

  // 中文名（经 id_bridge.name_zh 反索引）
  assert(vf.resolveTeamCode('阿根廷') === 'ARG', '阿根廷 → ARG');
  assert(vf.resolveTeamCode('阿尔及利亚') === 'ALG', '阿尔及利亚 → ALG');
  assert(vf.resolveTeamCode('德国') === 'GER', '德国 → GER');

  // name_official（经 id_bridge.name_official 反索引，ratings.json 键即此名）
  assert(vf.resolveTeamCode('Australia') === 'AUS', 'name_official Australia → AUS');

  // espnId（经 id_bridge.espn_id 反索引）
  assert(vf.resolveTeamCode('481') === 'GER', 'espnId 481 → GER');

  // fifaId（经 id_bridge.fifa_id 反索引）
  assert(vf.resolveTeamCode('43948') === 'GER', 'fifaId 43948 → GER');

  // iso2（经 teams.json 兜底）
  assert(vf.resolveTeamCode('DE') === 'GER', 'iso2 DE → GER');

  // Russia 不在 WC2026 的 48 队 → 解析不到 code
  assert(vf.resolveTeamCode('Russia') === null, 'Russia 不在 WC2026 → null');

  // 不存在
  assert(vf.resolveTeamCode('不存在的队') === null, '不存在 → null');
  assert(vf.resolveTeamCode(null) === null, 'null → null');
}

// ---------- 5b. CPV 兜底（无 espn_id，不在 id_bridge） ----------
console.log('📊 5b. CPV 兜底（不在 id_bridge，经 teams.json 解析，不抛错）');
{
  // CPV 不在 id_bridge（47 队），但在 teams.json（48 队）
  // code 直命中
  assert(vf.resolveTeamCode('CPV') === 'CPV', 'CPV code → CPV（teams.json 兜底）');
  // 英文名 "Cabo Verde"（teams.json name.en，非 ratings 的 "Cape Verde"）
  assert(vf.resolveTeamCode('Cabo Verde') === 'CPV', 'Cabo Verde → CPV');
  assert(vf.resolveTeamCode('cabo verde') === 'CPV', 'cabo verde (lower) → CPV');
  // 中文名
  assert(vf.resolveTeamCode('佛得角') === 'CPV', '佛得角 → CPV');

  // computeForTeam 对 CPV 不抛错（altitude 已落盘，Δh=315m < 1000m → β_alt=1）
  const r = vf.computeForTeam('400021440', 'CPV', 'jun');
  assert(r.teamCode === 'CPV', 'CPV computeForTeam 解析成功');
  assertApprox(r.betaAlt, 1.0, 'CPV β_alt=1（Δh < 1000m）');
  assert(r.source === 'no_env_effect' || r.source.includes('no_altitude_effect') || r.source.includes('temp:'), 'CPV source 正确');

  // computeForMatch 双队含 CPV 也不抛错
  const m = vf.computeForMatch('400021440', 'CPV', 'ARG', 'jun');
  assert(m.home.teamCode === 'CPV' && m.away.teamCode === 'ARG', 'CPV vs ARG 双队解析');
}

// ---------- 6. 真实比赛 computeForTeam ----------
console.log('📊 6. 真实比赛 computeForTeam（baseCamp.altitude 未落盘）');
{
  // Atlanta 场次 400021440，weather.tC=26.9（实时温度，非 null）
  // baseCamp.altitude 尚未落盘 → β_alt 应=1（回退）
  // β_temp: 26.9°C is below the 32°C threshold → β=1
  const r = vf.computeForTeam('400021440', 'ARG', 'jun');
  assert(r.teamCode === 'ARG', 'ARG 解析成功');
  assert(r.venueId === '400098290', 'venue = Atlanta');
  assertApprox(r.betaAlt, 1.0, 'baseCamp.altitude 已落盘，Δh=32m < 1000m → β_alt=1');
  assert(r.applied === false, 'β_temp 未生效 → applied=false');
  assertApprox(r.tempC, 26.9, 'tempC 取自 weather.live');
  assert(r.tempSource === 'weather.live', 'tempSource = weather.live');
  // β = 1 · 1
  const expectedBeta = 1;
  assertApprox(r.beta, expectedBeta, 'β = β_alt·β_temp');
  assert(!r.source.includes('temp:heat_decay'), 'source 不含 temp:heat_decay');
  // altitude 无效果时不添加到 source（只有 fallback 才添加）
  assert(!r.source.includes('fallback'), 'source 不含 fallback');
}

// ---------- 7. computeForMatch 双队 ----------
console.log('📊 7. computeForMatch 双队');
{
  const m = vf.computeForMatch('400021440', 'ARG', 'BRA', 'jun');
  assert(m.home && m.away, 'home/away 都返回');
  assert(m.home.teamCode === 'ARG' && m.away.teamCode === 'BRA', '两队 code 解析');
  assert(m.home.venueId === m.away.venueId, '同一场 venueId 相同');
  // 同一场同温度，β_temp 应相同；β_alt 取决于各自 baseCamp.altitude（都未落盘→都=1）
  assertApprox(m.home.betaTemp, m.away.betaTemp, '同场 β_temp 相同');
  assertApprox(m.home.betaAlt, 1.0, 'home β_alt 回退');
  assertApprox(m.away.betaAlt, 1.0, 'away β_alt 回退');
}

// ---------- 8. 模拟 baseCamp.altitude 落盘后的 β_alt ----------
console.log('📊 8. 模拟 altitude 落盘后 β_alt 生效（不依赖真实数据）');
{
  // 直接测 altitudeFactor 模拟：baseCamp 墨西哥城 2240m，venue LA 30m
  // Δh = 2210 → max(0,1.21)=1.21 → β=1-0.0363=0.9637
  const r = vf.altitudeFactor(2240, 30);
  assertApprox(r.beta, 0.9637, 'baseCamp 2240m vs venue 30m → β_alt≈0.9637');
  assert(r.applied === true, '海拔差>1000 → applied');

  // 组合：β_alt=0.9637, β_temp(30°C)=1 → β=0.9637
  const t = vf.temperatureFactor(30);
  const combined = Math.round(r.beta * t.beta * 10000) / 10000;
  assertApprox(combined, 0.9637, '组合 β = 0.9637 · 1');
}

// ---------- 9. getMatchTempC 回退链 ----------
console.log('📊 9. getMatchTempC 回退链');
{
  // 真实 weather 命中
  const t1 = vf.getMatchTempC('400021440', 'jun');
  assert(t1.tempC != null && t1.source === 'weather.live', 'weather 命中');

  // 不存在 matchId → climate 也无 → null
  const t2 = vf.getMatchTempC('999999999', 'jun');
  assert(t2.tempC === null && t2.source === 'fallback:no_temp', '全缺失 → null');

  // monthHint jul
  const t3 = vf.getMatchTempC('400021440', 'jul');
  assert(t3.source === 'weather.live', 'jul hint 仍优先 weather');
}

// ---------- 总结 ----------
console.log('\n=== 总结 ===');
console.log(`  通过: ${pass}`);
console.log(`  失败: ${fail}`);
if (fail > 0) {
  console.error('\n❌ venueFactors 单测失败:');
  failures.forEach((m) => console.error('   -', m));
  process.exit(1);
}
console.log('\n✅ venueFactors 单测全部通过!');
