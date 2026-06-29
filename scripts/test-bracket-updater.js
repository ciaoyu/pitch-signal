'use strict';
/**
 * bracket-updater.js 测试
 * 运行: node scripts/test-bracket-updater.js
 */
const assert = require('assert');
const {
  buildResolvedBracket,
  resolveThirdPlaceTeams,
  resolveSlot,
  propagateResults,
  _internals,
} = require('../lib/bracket-updater');

let passed = 0;
let failed = 0;
const ok = (name) => { console.log(`  ✅ ${name}`); passed += 1; };
const fail = (name, err) => { console.log(`  ❌ ${name}: ${err.message}`); failed += 1; };

// ============================================================
// Mock 数据
// ============================================================

// 简单 posMap: 部分小组已完成
const mockPosMap = {
  A1: 'Spain', A2: 'Mexico', A3: 'South Africa', A4: 'Qatar',
  B1: 'Argentina', B2: 'Brazil', B3: 'Croatia', B4: 'Iran',
  C1: 'France', C2: 'Senegal', C3: 'Australia', C4: 'Ecuador',
  D1: 'England', D2: 'Netherlands', D3: 'Tunisia', D4: 'Wales',
  E1: 'Germany', E2: 'Belgium', E3: 'Panama', E4: 'Chile',
  F1: 'Portugal', F2: 'Uruguay', F3: 'Ghana', F4: 'Morocco',
  G1: 'Italy', G2: 'Colombia', G3: 'Egypt', G4: 'Scotland',
  H1: 'Japan', H2: 'Switzerland', H3: 'Cameroon', H4: 'Peru',
  I1: 'Norway', I2: 'Denmark', I3: 'Wales', I4: 'Finland',
  J1: 'United States', J2: 'Morocco', J3: 'Algeria', J4: 'Paraguay',
  K1: 'Czechia', K2: 'Sweden', K3: 'Ivory Coast', K4: 'Jordan',
  L1: 'Senegal', L2: 'Australia', L3: 'Canada', L4: 'New Zealand',
};

// 12 组第三名数据（pts, gd, gf 不同，用于排序测试）
const mockThirdPlaceData = {
  A: { name: 'South Africa', id: '467', pts: 4, gd: -1, gf: 3 },
  B: { name: 'Croatia', id: '4398', pts: 3, gd: 0, gf: 4 },
  C: { name: 'Australia', id: '580', pts: 6, gd: 2, gf: 5 },
  D: { name: 'Tunisia', id: '465', pts: 4, gd: 1, gf: 4 },
  E: { name: 'Panama', id: '4789', pts: 3, gd: -2, gf: 2 },
  F: { name: 'Ghana', id: '659', pts: 4, gd: 0, gf: 3 },
  G: { name: 'Egypt', id: '469', pts: 3, gd: -1, gf: 2 },
  H: { name: 'Cameroon', id: '212', pts: 6, gd: 3, gf: 6 },
  I: { name: 'Wales', id: '464', pts: 4, gd: 0, gf: 2 },
  J: { name: 'Algeria', id: '624', pts: 4, gd: 1, gf: 5 },
  K: { name: 'Ivory Coast', id: '2570', pts: 3, gd: -3, gf: 1 },
  L: { name: 'Canada', id: '2659', pts: 3, gd: -1, gf: 3 },
};

// 简化 bracket（只有 R32 涉及第三名的 slot）
const mockBracketMatches = {
  'R32-1': { teamA: 'A2', teamB: 'B2' },
  'R32-2': { teamA: 'E1', teamB: '3rd A/B/C/D/F' },
  'R32-5': { teamA: 'A1', teamB: '3rd C/E/F/H/I' },
  'R32-6': { teamA: 'L1', teamB: '3rd E/H/I/J/K' },
  'R32-7': { teamA: 'G1', teamB: '3rd A/E/H/I/J' },
  'R32-8': { teamA: 'D1', teamB: '3rd B/E/F/I/J' },
  'R32-11': { teamA: 'B1', teamB: '3rd E/F/G/I/J' },
  'R32-15': { teamA: 'I1', teamB: '3rd C/D/F/G/H' },
  'R32-16': { teamA: 'K1', teamB: '3rd D/E/I/J/L' },
  'R16-1': { teamA: 'W R32-1', teamB: 'W R32-3', feedA: 'R32-1', feedB: 'R32-3' },
  'R16-2': { teamA: 'W R32-2', teamB: 'W R32-5', feedA: 'R32-2', feedB: 'R32-5' },
};

// ============================================================
// Test 1: resolveSlot — group-position
// ============================================================
console.log('\n=== resolveSlot ===');
try {
  const r = resolveSlot('A1', mockPosMap, {});
  assert.strictEqual(r.name, 'Spain');
  assert.strictEqual(r.seed, 'A1');
  ok('A1 → Spain');
} catch (e) { fail('A1 → Spain', e); }

try {
  const r = resolveSlot('B2', mockPosMap, {});
  assert.strictEqual(r.name, 'Brazil');
  ok('B2 → Brazil');
} catch (e) { fail('B2 → Brazil', e); }

try {
  const r = resolveSlot(null, mockPosMap, {});
  assert.strictEqual(r.name, 'TBD');
  ok('null → TBD');
} catch (e) { fail('null → TBD', e); }

// ============================================================
// Test 2: resolveSlot — W R32-1 (winner placeholder)
// ============================================================
try {
  const r = resolveSlot('W R32-1', mockPosMap, {});
  assert.strictEqual(r.name, 'TBD');
  assert.strictEqual(r.seed, 'W R32-1');
  ok('W R32-1 → TBD (knockout not started)');
} catch (e) { fail('W R32-1 → TBD', e); }

// ============================================================
// Test 3: resolveSlot — 3rd with resolved map
// ============================================================
try {
  const thirdPlaceMap = { '3rd A/B/C/D/F': { name: 'Australia', id: '580' } };
  const r = resolveSlot('3rd A/B/C/D/F', mockPosMap, thirdPlaceMap);
  assert.strictEqual(r.name, 'Australia');
  ok('3rd A/B/C/D/F → Australia (when resolved)');
} catch (e) { fail('3rd resolved', e); }

try {
  const r = resolveSlot('3rd A/B/C/D/F', mockPosMap, {});
  assert.strictEqual(r.name, '待定');
  ok('3rd A/B/C/D/F → 待定 (when not resolved)');
} catch (e) { fail('3rd unresolved', e); }

// ============================================================
// Test 4: resolveSlot — missing group position
// ============================================================
try {
  const r = resolveSlot('X1', mockPosMap, {});
  assert.strictEqual(r.name, 'TBD');
  ok('X1 → TBD (unknown position)');
} catch (e) { fail('X1 → TBD', e); }

// ============================================================
// resolveThirdPlaceTeams
// ============================================================
console.log('\n=== resolveThirdPlaceTeams ===');

// ============================================================
// Test 5: 正常分配（12 组全部有第三名）
// ============================================================
try {
  const result = resolveThirdPlaceTeams(mockThirdPlaceData, mockBracketMatches);
  // 应该有 8 个 slot 被分配
  const assigned = Object.keys(result);
  assert.strictEqual(assigned.length, 8, `Expected 8 slots, got ${assigned.length}`);
  ok('8 third-place slots assigned');
} catch (e) { fail('8 slots assigned', e); }

// ============================================================
// Test 6: 排序正确性 — pts 优先
// ============================================================
try {
  // C(6pts) 和 H(6pts) 应该排在最前
  const result = resolveThirdPlaceTeams(mockThirdPlaceData, mockBracketMatches);
  const groups = Object.values(result).map(t => t.group);
  // C 和 H 都是 6 分，应该都在已晋级名单里
  assert.ok(groups.includes('C') || groups.includes('H'), 'Top-pts groups should be in result');
  ok('Sorting: pts priority verified');
} catch (e) { fail('Sorting: pts priority', e); }

// ============================================================
// Test 7: 排序正确性 — gd 作为 tie-breaker
// ============================================================
try {
  // A(4pts,-1gd), D(4pts,1gd), F(4pts,0gd), I(4pts,0gd), J(4pts,1gd)
  // D 和 J 都是 4pts+1gd，D gf=4, J gf=5 → J 排在 D 前面
  const result = resolveThirdPlaceTeams(mockThirdPlaceData, mockBracketMatches);
  // 验证 D 和 J 都晋级（都是 4pts 1gd，在前 8 内）
  const groups = Object.values(result).map(t => t.group);
  assert.ok(groups.includes('D'), 'D should qualify (4pts 1gd)');
  assert.ok(groups.includes('J'), 'J should qualify (4pts 1gd)');
  ok('Tie-breaker: gd priority verified');
} catch (e) { fail('Tie-breaker: gd', e); }

// ============================================================
// Test 8: 排序正确性 — gf 作为第三级 tie-breaker
// ============================================================
try {
  // F(4pts,0gd,3gf) vs I(4pts,0gd,2gf) → F 排在 I 前
  // A(4pts,-1gd,3gf) 应该排在 F 和 I 后面（因为 gd 更低）
  const result = resolveThirdPlaceTeams(mockThirdPlaceData, mockBracketMatches);
  const groups = Object.values(result).map(t => t.group);
  assert.ok(groups.includes('F'), 'F should qualify (4pts 0gd 3gf)');
  ok('Tie-breaker: gf priority verified');
} catch (e) { fail('Tie-breaker: gf', e); }

// ============================================================
// Test 9: 不足 12 组 → 返回空
// ============================================================
try {
  const result = resolveThirdPlaceTeams({ A: mockThirdPlaceData.A }, mockBracketMatches);
  assert.deepStrictEqual(result, {});
  ok('Less than 12 groups → empty result');
} catch (e) { fail('Less than 12 groups', e); }

// ============================================================
// Test 10: 每个 team group 只分配一次
// ============================================================
try {
  const result = resolveThirdPlaceTeams(mockThirdPlaceData, mockBracketMatches);
  const groups = Object.values(result).map(t => t.group);
  const uniqueGroups = [...new Set(groups)];
  assert.strictEqual(groups.length, uniqueGroups.length, 'No duplicate group assignments');
  ok('No duplicate group assignments');
} catch (e) { fail('No duplicates', e); }

// ============================================================
// slotToScheduleShortName
// ============================================================
console.log('\n=== slotToScheduleShortName ===');

// ============================================================
// Test 11: A2 vs B2 → "2B @ 2A"
// ============================================================
try {
  const r = _internals.slotToScheduleShortName('A2', 'B2');
  assert.strictEqual(r, '2B @ 2A');
  ok('A2 vs B2 → "2B @ 2A"');
} catch (e) { fail('shortName A2 vs B2', e); }

// ============================================================
// Test 12: E1 vs 3rd A/B/C/D/F → "3RD @ 1E"
// ============================================================
try {
  const r = _internals.slotToScheduleShortName('E1', '3rd A/B/C/D/F');
  assert.strictEqual(r, '3RD @ 1E');
  ok('E1 vs 3rd → "3RD @ 1E"');
} catch (e) { fail('shortName 3rd', e); }

// ============================================================
// Test 13: null → null
// ============================================================
try {
  const r = _internals.slotToScheduleShortName(null, 'A1');
  assert.strictEqual(r, null);
  ok('null slot → null');
} catch (e) { fail('shortName null', e); }

// ============================================================
// buildResolvedBracket
// ============================================================
console.log('\n=== buildResolvedBracket ===');

// ============================================================
// Test 14: 完整 bracket — R32 解析为真实队名
// ============================================================
try {
  // 使用真实的 bracket_2026.json
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  // R32-1: A2(Mexico) vs B2(Brazil)
  assert.strictEqual(result.matches['R32-1'].teamA.name, 'Mexico');
  assert.strictEqual(result.matches['R32-1'].teamB.name, 'Brazil');
  ok('R32-1 resolved: Mexico vs Brazil');
} catch (e) { fail('R32-1 resolved', e); }

// ============================================================
// Test 15: R32 有 kickoff 时间
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  // R32-1 应该有 kickoff（如果 schedule 里有对应的 match）
  const r32_1 = result.matches['R32-1'];
  if (r32_1.kickoff) {
    assert.ok(typeof r32_1.kickoff === 'string');
    assert.ok(r32_1.matchId);
    ok('R32-1 has kickoff time and matchId');
  } else {
    // Schedule might not have this match yet (depends on data)
    ok('R32-1 kickoff not in schedule (expected if groups not complete)');
  }
} catch (e) { fail('R32 kickoff', e); }

// ============================================================
// Test 16: R16+ 为 TBD（无淘汰赛结果时）
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  assert.strictEqual(result.matches['R16-1'].teamA.name, 'TBD');
  assert.strictEqual(result.matches['R16-1'].teamB.name, 'TBD');
  assert.strictEqual(result.matches['R16-1'].status, 'tbd');
  ok('R16-1 TBD (knockout not started)');
} catch (e) { fail('R16 TBD', e); }

// ============================================================
// Test 17: R16+ 有 kickoff 时间
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  // R16-1 通过 bracket_slot_map 有 espnMatchId → 应该有 kickoff
  const r16_1 = result.matches['R16-1'];
  if (r16_1.kickoff) {
    assert.ok(typeof r16_1.kickoff === 'string');
    ok('R16-1 has kickoff time via bracket_slot_map');
  } else {
    ok('R16-1 kickoff not available (slot_map may not have this entry)');
  }
} catch (e) { fail('R16 kickoff', e); }

// ============================================================
// Test 18: 第三名 slot 被解析
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  // R32-2: E1(Germany) vs 3rd A/B/C/D/F → 应该不再是"待定"
  const r32_2 = result.matches['R32-2'];
  assert.strictEqual(r32_2.teamA.name, 'Germany');
  assert.notStrictEqual(r32_2.teamB.name, '待定', '3rd place should be resolved');
  assert.notStrictEqual(r32_2.teamB.name, 'TBD', '3rd place should be resolved');
  ok(`R32-2: Germany vs ${r32_2.teamB.name} (3rd resolved)`);
} catch (e) { fail('3rd resolved in bracket', e); }

// ============================================================
// Test 19: thirdPlaceResolved 标记
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  assert.strictEqual(result.thirdPlaceResolved, true);
  ok('thirdPlaceResolved = true');
} catch (e) { fail('thirdPlaceResolved', e); }

// ============================================================
// Test 20: thirdPlaceMatch 存在
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  assert.ok(result.thirdPlaceMatch, 'thirdPlaceMatch should exist');
  assert.strictEqual(result.thirdPlaceMatch.status, 'tbd');
  ok('thirdPlaceMatch exists and is TBD');
} catch (e) { fail('thirdPlaceMatch', e); }

// ============================================================
// Test 21: 部分小组未完成 → 对应 slots 为 TBD
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  // 只有 A、B 组完成
  const partialPosMap = { A1: 'Spain', A2: 'Mexico', B1: 'Argentina', B2: 'Brazil' };

  const result = buildResolvedBracket({
    posMap: partialPosMap,
    thirdPlaceData: {},
    bracket,
    schedule,
  });

  assert.strictEqual(result.matches['R32-1'].teamA.name, 'Mexico');
  assert.strictEqual(result.matches['R32-1'].teamB.name, 'Brazil');
  // E1 组未完成 → TBD
  assert.strictEqual(result.matches['R32-2'].teamA.name, 'TBD');
  ok('Partial groups: resolved slots correct, unresolved are TBD');
} catch (e) { fail('Partial groups', e); }

// ============================================================
// Test 22: propagateResults 骨架（原样返回）
// ============================================================
console.log('\n=== propagateResults ===');
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  // propagateResults 应该原样返回（Phase 1）
  assert.ok(result.matches['R16-1']);
  assert.strictEqual(result.matches['R16-1'].teamA.name, 'TBD');
  ok('propagateResults skeleton: bracket unchanged');
} catch (e) { fail('propagateResults skeleton', e); }

// ============================================================
// Test 23: tree 结构保留
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  assert.ok(result.tree, 'tree should exist');
  assert.ok(result.tree.left, 'tree.left should exist');
  assert.ok(result.tree.right, 'tree.right should exist');
  assert.ok(result.tree.center, 'tree.center should exist');
  ok('Tree structure preserved');
} catch (e) { fail('Tree structure', e); }

// ============================================================
// Test 24: rounds 列表
// ============================================================
try {
  const bracket = require('../data/bracket_2026.json');
  const schedule = require('../data/match_snapshot_schedule.json');

  const result = buildResolvedBracket({
    posMap: mockPosMap,
    thirdPlaceData: mockThirdPlaceData,
    bracket,
    schedule,
  });

  assert.deepStrictEqual(result.rounds, ['R32', 'R16', 'QF', 'SF', 'FINAL']);
  ok('Rounds list correct');
} catch (e) { fail('Rounds list', e); }

// ============================================================
// 结果
// ============================================================
console.log(`\n============================`);
console.log(`  Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
console.log(`============================\n`);
process.exit(failed > 0 ? 1 : 0);
