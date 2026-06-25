'use strict';
/**
 * 末轮战略情境模块测试
 * 运行: /opt/homebrew/bin/node scripts/test-final-round-context.js
 */
const assert = require('assert');
const { buildFinalRoundContext, _internals } = require('../lib/finalRoundContext');

let passed = 0;
const ok = (name) => { console.log(`  ✅ ${name}`); passed += 1; };

// ---- mock 构造:用真实英文队名(id 即 name,可被 team_resolver 解析出 Elo) ----
// 行顺序即榜序(模块假设 groupRows 已排序)
function makeGroup(letter, names, opts = {}) {
  const ptsArr = opts.pts || [6, 3, 1, 1];
  const gdArr = opts.gd || [5, 0, -2, -3];
  const played = opts.played != null ? opts.played : 2;
  return {
    name: `小组 ${letter}`,
    standings: names.map((nm, i) => ({
      id: nm,
      name: nm,
      nameI18n: { zh: nm, en: nm },
      played,
      pts: ptsArr[i],
      gd: gdArr[i],
      gf: Math.max(0, gdArr[i]) + 2,
    })),
  };
}

// 强队 / 弱队(用真实 Elo 制造对手强度差)
const STRONG = 'Brazil';        // 1824
const WEAK = ['Saudi Arabia', 'Qatar', 'New Zealand', 'Curacao', 'Bosnia-Herzegovina'];

// A 组剧情:Spain 锁定第一;本场 = Mexico(home) vs South Africa(away);平行 = Spain vs Qatar
const groups = [
  makeGroup('A', ['Spain', 'Mexico', 'South Africa', 'Qatar']),
  // B 组第 2 名 = 超强队 Brazil(A2 出线路径 R32-1 对手 = B2)
  makeGroup('B', ['Argentina', STRONG, 'Croatia', 'Iran']),
  // C/E/F/H/I 组第 3 名 = 弱队(A1 出线路径 R32-5 对手 = "3rd C/E/F/H/I")
  makeGroup('C', ['France', 'Senegal', WEAK[0], 'Australia']),
  makeGroup('D', ['England', 'Netherlands', 'Ecuador', 'Tunisia']),
  makeGroup('E', ['Germany', 'Belgium', WEAK[1], 'Panama']),
  makeGroup('F', ['Portugal', 'Uruguay', WEAK[2], 'Ghana']),
  makeGroup('G', ['Italy', 'Colombia', 'Egypt', 'Scotland']),
  makeGroup('H', ['Japan', 'Switzerland', WEAK[3], 'Cameroon']),
  makeGroup('I', ['Spain', 'Denmark', WEAK[4], 'Wales'].map((n, i) => (i === 0 ? 'Norway' : n)),),
  makeGroup('J', ['United States', 'Morocco', 'Algeria', 'Paraguay']),
  makeGroup('K', ['Netherlands', 'Sweden', 'Ivory Coast', 'Jordan'].map((n, i) => (i === 0 ? 'Czechia' : n))),
  makeGroup('L', ['Turkiye', 'Nigeria', 'Cape Verde', 'Haiti']),
];

console.log('\n=== Final-Round Context Tests ===\n');

// --- 1. 基本可用性 + 末轮判定 ---
{
  const ctx = buildFinalRoundContext({ homeId: 'Mexico', awayId: 'South Africa', standingsGroups: groups });
  assert.strictEqual(ctx.applicable, true, 'should be applicable');
  assert.strictEqual(ctx.groupLetter, 'A', 'group A');
  assert.strictEqual(ctx.finalRound, true);
  ok('末轮可用,正确识别 A 组');

  // 平行比赛 = Spain vs Qatar(组内非本场两队)
  const pm = ctx.parallelMatch;
  const pmIds = [pm.homeId, pm.awayId].sort();
  assert.deepStrictEqual(pmIds, ['Qatar', 'Spain'], 'parallel = Spain vs Qatar');
  ok('正确推导同时进行的另一场 (Spain vs Qatar)');
}

// --- 2. 非末轮(played=1)→ 不可用 ---
{
  const notFinal = groups.map((g) => ({ ...g, standings: g.standings.map((r) => ({ ...r, played: 1 })) }));
  const ctx = buildFinalRoundContext({ homeId: 'Mexico', awayId: 'South Africa', standingsGroups: notFinal });
  assert.strictEqual(ctx.applicable, false);
  assert.strictEqual(ctx.reason, 'not-final-round');
  ok('非末轮(played=1)正确返回 applicable:false');
}

// --- 3. 锁定第一:Spain 无论平行场结果恒第一 ---
{
  const ctx = buildFinalRoundContext({ homeId: 'Spain', awayId: 'Qatar', standingsGroups: groups });
  const spain = ctx.teams['Spain'];
  assert.ok(spain.locked, 'Spain should be locked');
  assert.strictEqual(spain.locked.state, 'first', 'Spain locks top spot');
  ok('Spain 锁定小组第一 (locked.state=first)');

  // Qatar 已出局(pts1,gd-3,即便赢 Spain 也难翻盘看场景)
  const qatar = ctx.teams['Qatar'];
  assert.ok(qatar.ifLose.ranks.every((r) => r >= 3), 'Qatar if lose stays bottom-2');
  ok('Qatar 负则维持后两位(出局风险)');
}

// --- 4. bracket 对手 token 正确 ---
{
  const ctx = buildFinalRoundContext({ homeId: 'Mexico', awayId: 'South Africa', standingsGroups: groups });
  const mex = ctx.teams['Mexico'];
  assert.strictEqual(mex.bracket.asFirst.opponent.token, '3rd C/E/F/H/I', 'A1 → 3rd C/E/F/H/I');
  assert.strictEqual(mex.bracket.asSecond.opponent.token, 'B2', 'A2 → B2');
  ok('R32 对手位置正确 (A1→3rd C/E/F/H/I, A2→B2)');

  // asSecond 对手 = B 组第二 = Brazil,elo 应解析
  assert.ok(mex.bracket.asSecond.opponent.elo > 1700, 'B2 = Brazil strong elo');
  ok(`A2 路径对手 Elo 解析正确 (Brazil=${mex.bracket.asSecond.opponent.elo})`);
}

// --- 5. 避强动机方向:A1 路径对手(弱第三名均值) << A2 路径对手(Brazil) → prefer first ---
{
  const ctx = buildFinalRoundContext({ homeId: 'Mexico', awayId: 'South Africa', standingsGroups: groups });
  const inc = ctx.teams['Mexico'].bracket.incentive;
  assert.ok(inc, 'incentive should exist');
  assert.strictEqual(inc.prefer, 'first', 'first-place path is weaker → prefer first');
  assert.ok(inc.deltaElo > 40, 'delta beyond threshold');
  ok(`识别赛程动机:第一名路径对手更弱 → prefer first (Δ${inc.deltaElo} Elo)`);
}

// --- 6. 单元:rankAfter 平分检测净胜球依赖 ---
{
  const { rankAfter } = _internals;
  const t = [
    { id: 'x', pts: 6, gd: 3, gf: 5 },
    { id: 'y', pts: 4, gd: 1, gf: 3 },
    { id: 'z', pts: 4, gd: 0, gf: 2 }, // y,z 同分卡在出线线 → gdDependent
    { id: 'w', pts: 1, gd: -4, gf: 1 },
  ];
  const { rankById, gdDependent } = rankAfter(t);
  assert.strictEqual(rankById['x'], 1);
  assert.strictEqual(gdDependent, true, '2nd/3rd tie on points → GD dependent');
  ok('rankAfter 正确检测出线线净胜球依赖');
}

// --- 7. summarizeRanks 文案归纳 ---
{
  const { summarizeRanks } = _internals;
  assert.strictEqual(summarizeRanks(new Set([1]), false).status.zh, '锁定小组第一');
  assert.strictEqual(summarizeRanks(new Set([3, 4]), false).status.zh, '出局');
  assert.ok(summarizeRanks(new Set([2, 3]), false).status.zh.includes('取决于另一场'));
  ok('summarizeRanks 文案归纳正确');
}

console.log(`\n🎉 全部 ${passed} 组断言通过\n`);
