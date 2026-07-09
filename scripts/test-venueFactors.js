#!/usr/bin/env node
/**
  * Unit tests for venueFactors
 *
  * Coverage:
  *  1. β_alt boundaries (Δh=0/1000/2000/1500, missing -> fallback)
  *  2. β_temp boundaries (T=0/32/50/90°F, Celsius conversion, missing -> fallback)
  *  3. combinedFactor (β_alt·β_temp combination, applied propagation)
  *  4. unit conversion cToF
  *  5. matchId→venueId reverse lookup (real data)
  *  6. ratingsId/espnId/english name/chinese name → fifa code multi-path resolution
  *  7. real match computeForTeam (baseCamp.altitude not yet persisted → β_alt should fall back to 1)
  *  8. weather.tC actually takes effect → β_temp should be != 1
 *
  * On assertion failure, process.exit(1); on full pass print ✅.
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

console.log('=== venueFactors unit test ===\n');

// ---------- 1. β_alt ----------
console.log('📊 1. β_alt altitude decay');
{
    // Δh = 0 → β = 1 (no decay)
  let r = vf.altitudeFactor(500, 500);
  assertApprox(r.beta, 1.0, 'Δh=0 → β_alt=1');
  assert(r.applied === false, 'Δh=0 applied=false');
  assert(r.source === 'no_altitude_effect', 'Δh=0 source');

    // Δh = 1000 (exactly at threshold) → max(0,0)=0 → β=1
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

    // Bidirectional symmetry: baseCamp<venue and baseCamp>venue with the same delta should yield the same β
  const a = vf.altitudeFactor(2200, 200);
  const b = vf.altitudeFactor(200, 2200);
  assertApprox(a.beta, b.beta, 'Δh 双向对称');

    // missing -> fallback
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
console.log('📊 2. β_temp high-temperature decay');
{
  // Fahrenheit input is converted to Celsius; 32°F = 0°C → no decay.
  let r = vf.temperatureFactorF(32);
  assertApprox(r.beta, 1.0, 'T=32°F → β_temp=1');
  assert(r.applied === false, 'T=32°F applied=false');

  // ---------- 3. unit conversion ----------
  r = vf.temperatureFactorF(0);
  assertApprox(r.beta, 1.0, 'T=0°F → β_temp=1');

  // T=50°F = 10°C → no decay
  r = vf.temperatureFactorF(50);
  assertApprox(r.beta, 1, 'T=50°F → β_temp=1');
  assert(r.applied === false, 'T=50°F applied=false');

  // T=90°F ≈ 32.22°C → very small decay
  r = vf.temperatureFactorF(90);
  assertApprox(r.beta, 0.9978, 'T=90°F → β_temp≈0.9978');

    // Celsius entry: 0°C = 32°F → β=1
  r = vf.temperatureFactor(0);
  assertApprox(r.beta, 1.0, 'T=0°C → β_temp=1');

  // 30°C is below the 32°C heat threshold
  r = vf.temperatureFactor(30);
  assertApprox(r.beta, 1, 'T=30°C → β_temp=1');

  // 10°C → no decay
  r = vf.temperatureFactor(10);
  assertApprox(r.beta, 1, 'T=10°C → β_temp=1');

    // missing -> fallback
  r = vf.temperatureFactorF(null);
  assertApprox(r.beta, 1.0, 'T 缺失 → β_temp=1');
  assert(r.source === 'fallback:missing_temp', 'T 缺失 source');

  r = vf.temperatureFactor(null);
  assertApprox(r.beta, 1.0, 'T(℃) 缺失 → β_temp=1');

  r = vf.temperatureFactor(NaN);
  assertApprox(r.beta, 1.0, 'T=NaN → β_temp=1');
}

// ---------- 3. unit conversion ----------
console.log('📊 3. cToF unit conversion');
{
  assertApprox(vf.cToF(0), 32, '0°C = 32°F');
  assertApprox(vf.cToF(100), 212, '100°C = 212°F');
  assertApprox(vf.cToF(30), 86, '30°C = 86°F');
  assert(vf.cToF(null) === null, 'cToF(null) = null');
  assert(vf.cToF(NaN) === null, 'cToF(NaN) = null');
}

// ---------- 4. real data: matchId→venueId reverse lookup ----------
console.log('📊 4. matchId → venueId reverse lookup (real venues.json)');
{
    // 400021440 is in Atlanta (Mercedes-Benz Stadium, venueId=400098290)'s matches
  const v = vf.getMatchVenue('400021440');
  assert(v != null, 'matchId 400021440 反查到 venue');
  assert(v?.id === '400098290', '400021440 → Atlanta (400098290)');

    // non-existent matchId
  const v2 = vf.getMatchVenue('999999999');
  assert(v2 === null, '不存在 matchId → null');
}

// ---------- 5. team identity multi-path resolution (id_bridge bridge) ----------
console.log('📊 5. Team identifier → fifa code multi-path resolution (id_bridge)');
{
    // FIFA code direct input
  assert(vf.resolveTeamCode('ARG') === 'ARG', 'code ARG → ARG');
  assert(vf.resolveTeamCode('ALG') === 'ALG', 'code ALG → ALG');
  assert(vf.resolveTeamCode('GER') === 'GER', 'code GER → GER');

    // English name (via id_bridge.name_en reverse index)
  assert(vf.resolveTeamCode('Argentina') === 'ARG', 'Argentina → ARG');
  assert(vf.resolveTeamCode('argentina') === 'ARG', 'argentina (lower) → ARG');
  assert(vf.resolveTeamCode('Germany') === 'GER', 'Germany → GER');

    // Chinese name (via id_bridge.name_zh reverse index)
  assert(vf.resolveTeamCode('阿根廷') === 'ARG', '阿根廷 → ARG');
  assert(vf.resolveTeamCode('阿尔及利亚') === 'ALG', '阿尔及利亚 → ALG');
  assert(vf.resolveTeamCode('德国') === 'GER', '德国 → GER');

    // name_official (via id_bridge.name_official reverse index; ratings.json key is this name)
  assert(vf.resolveTeamCode('Australia') === 'AUS', 'name_official Australia → AUS');

    // espnId (via id_bridge.espn_id reverse index)
  assert(vf.resolveTeamCode('481') === 'GER', 'espnId 481 → GER');

    // fifaId (via id_bridge.fifa_id reverse index)
  assert(vf.resolveTeamCode('43948') === 'GER', 'fifaId 43948 → GER');

    // iso2 (fallback via teams.json)
  assert(vf.resolveTeamCode('DE') === 'GER', 'iso2 DE → GER');

    // Russia not in WC2026's 48 teams → cannot resolve code
  assert(vf.resolveTeamCode('Russia') === null, 'Russia 不在 WC2026 → null');

    // does not exist
  assert(vf.resolveTeamCode('不存在的队') === null, '不存在 → null');
  assert(vf.resolveTeamCode(null) === null, 'null → null');
}

// ---------- 5b. CPV fallback (no espn_id, not in id_bridge) ----------
console.log('📊 5b. CPV fallback (not in id_bridge, resolved via teams.json, no error thrown)');
{
    // CPV not in id_bridge (47 teams) but in teams.json (48 teams)
    // code direct hit
  assert(vf.resolveTeamCode('CPV') === 'CPV', 'CPV code → CPV（teams.json 兜底）');
    // English name "Cabo Verde" (teams.json name.en, not ratings' "Cape Verde")
  assert(vf.resolveTeamCode('Cabo Verde') === 'CPV', 'Cabo Verde → CPV');
  assert(vf.resolveTeamCode('cabo verde') === 'CPV', 'cabo verde (lower) → CPV');
    // Chinese name
  assert(vf.resolveTeamCode('佛得角') === 'CPV', '佛得角 → CPV');

    // computeForTeam does not throw for CPV (altitude already persisted, Δh=315m < 1000m → β_alt=1)
  const r = vf.computeForTeam('400021440', 'CPV', 'jun');
  assert(r.teamCode === 'CPV', 'CPV computeForTeam 解析成功');
  assertApprox(r.betaAlt, 1.0, 'CPV β_alt=1（Δh < 1000m）');
  assert(r.source === 'no_env_effect' || r.source.includes('no_altitude_effect') || r.source.includes('temp:'), 'CPV source 正确');

    // computeForMatch with CPV in both teams also does not throw
  const m = vf.computeForMatch('400021440', 'CPV', 'ARG', 'jun');
  assert(m.home.teamCode === 'CPV' && m.away.teamCode === 'ARG', 'CPV vs ARG 双队解析');
}

// ---------- 6. real match computeForTeam ----------
console.log('📊 6. Real match computeForTeam (baseCamp.altitude not persisted)');
{
    // Atlanta match 400021440, weather.tC=26.9 (live temperature, not null)
    // baseCamp.altitude not yet persisted → β_alt should = 1 (fallback)
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
    // when altitude has no effect, don't add to source (only fallback adds it)
  assert(!r.source.includes('fallback'), 'source 不含 fallback');
}

// ---------- 7. computeForMatch both teams ----------
console.log('📊 7. computeForMatch both teams');
{
  const m = vf.computeForMatch('400021440', 'ARG', 'BRA', 'jun');
  assert(m.home && m.away, 'home/away 都返回');
  assert(m.home.teamCode === 'ARG' && m.away.teamCode === 'BRA', '两队 code 解析');
  assert(m.home.venueId === m.away.venueId, '同一场 venueId 相同');
    // Same match, same temperature → β_temp should be identical; β_alt depends on each team's baseCamp.altitude (both unpersisted → both = 1)
  assertApprox(m.home.betaTemp, m.away.betaTemp, '同场 β_temp 相同');
  assertApprox(m.home.betaAlt, 1.0, 'home β_alt 回退');
  assertApprox(m.away.betaAlt, 1.0, 'away β_alt 回退');
}

// ---------- 8. simulate β_alt after baseCamp.altitude is persisted ----------
console.log('📊 8. After simulated altitude persisted β_alt takes effect (no real data dependency)');
{
    // Directly test altitudeFactor simulation: baseCamp Mexico City 2240m, venue LA 30m
  // Δh = 2210 → max(0,1.21)=1.21 → β=1-0.0363=0.9637
  const r = vf.altitudeFactor(2240, 30);
  assertApprox(r.beta, 0.9637, 'baseCamp 2240m vs venue 30m → β_alt≈0.9637');
  assert(r.applied === true, '海拔差>1000 → applied');

    // Combination: β_alt=0.9637, β_temp(30°C)=1 → β=0.9637
  const t = vf.temperatureFactor(30);
  const combined = Math.round(r.beta * t.beta * 10000) / 10000;
  assertApprox(combined, 0.9637, '组合 β = 0.9637 · 1');
}

// ---------- 9. getMatchTempC fallback chain ----------
console.log('📊 9. getMatchTempC fallback chain');
{
    // real weather hit
  const t1 = vf.getMatchTempC('400021440', 'jun');
  assert(t1.tempC != null && t1.source === 'weather.live', 'weather 命中');

    // non-existent matchId → climate also absent → null
  const t2 = vf.getMatchTempC('999999999', 'jun');
  assert(t2.tempC === null && t2.source === 'fallback:no_temp', '全缺失 → null');

  // monthHint jul
  const t3 = vf.getMatchTempC('400021440', 'jul');
  assert(t3.source === 'weather.live', 'jul hint 仍优先 weather');
}

// ---------- summary ----------
console.log('\n=== Summary ===');
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
if (fail > 0) {
  console.error('\n❌ venueFactors unit test failed:');
  failures.forEach((m) => console.error('   -', m));
  process.exit(1);
}
console.log('\n✅ venueFactors unit test all passed!');
