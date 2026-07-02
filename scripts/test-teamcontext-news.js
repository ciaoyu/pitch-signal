#!/usr/bin/env node
/**
 * P2-5: teamcontext-news 纯函数测试
 */
'use strict';

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }

console.log('━━━ teamcontext-news pure logic tests ━━━');

// 重新执行 news.js 以获取 buildContextAwareSearchTerms
// 通过 eval 的方式隔离，不依赖 DB
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../lib/routes/news.js', 'utf8');
const buildFn = src.match(/function buildContextAwareSearchTerms[\s\S]*?^}/m);
const fnBody = buildFn ? buildFn[0] : null;
if (!fnBody) { console.error('❌ Could not extract buildContextAwareSearchTerms'); process.exit(1); }

// eslint-disable-next-line no-eval
const buildContextAwareSearchTerms = eval(`(${fnBody})`);

// 1. 基础赛前搜索词（无上下文）
{
  const ctx = { homeTeam: 'Germany', awayTeam: 'Curaçao', homeId: 'GER', awayId: 'CUW' };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false });
  assert(terms.length === 5, 'base pre-match = 5 terms');
  assert(terms.some(t => t.includes('Germany vs Curaçao preview')), 'contains preview');
  assert(terms.some(t => t.includes('injury update')), 'contains injury');
}

// 2. 基础赛后搜索词
{
  const ctx = { homeTeam: 'Brazil', awayTeam: 'Argentina', homeId: 'BRA', awayId: 'ARG' };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: true });
  assert(terms.some(t => t.includes('result highlights')), 'post has result highlights');
  assert(terms.some(t => t.includes('match analysis')), 'post has match analysis');
  assert(terms.some(t => t.includes('post-match reaction')), 'post has reaction');
}

// 3. Elo 差值 >100 → 冷门/热门词
{
  const ctx = { homeTeam: 'France', awayTeam: 'Iceland', homeId: 'FRA', awayId: 'ISL' };
  const getElo = (id) => id === 'FRA' ? 1850 : 1550; // 300 diff
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getElo });
  assert(terms.some(t => t.includes('France') && t.includes('upset')), 'Elo diff adds upset chance query');
  assert(terms.some(t => t.includes('Iceland') && t.includes('underdog')), 'Elo diff adds underdog tactics query');
  assert(terms.length > 5, 'Elo diff increases term count');
}

// 4. Elo 差值 <100 → 不加额外词
{
  const ctx = { homeTeam: 'Spain', awayTeam: 'Netherlands', homeId: 'ESP', awayId: 'NED' };
  const getElo = () => 1700; // all equal
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getElo });
  assert(terms.length === 5, 'small Elo diff = no extra terms');
}

// 5. 战术风格碰撞：进攻 vs 防守
{
  const ctx = { homeTeam: 'Brazil', awayTeam: 'Switzerland', homeId: 'BRA', awayId: 'SUI' };
  const getStyle = (id) => id === 'BRA' ? 'attacking' : 'defensive';
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getStyle });
  assert(terms.some(t => t.includes('breaking low block')), 'attack vs defence → low block query');
  assert(terms.some(t => t.includes('defensive tactics')), 'attack vs defence → defensive tactics');
}

// 6. 战术风格碰撞：防守 vs 进攻
{
  const ctx = { homeTeam: 'Morocco', awayTeam: 'England', homeId: 'MAR', awayId: 'ENG' };
  const getStyle = (id) => id === 'MAR' ? 'defensive' : 'attacking';
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getStyle });
  assert(terms.some(t => t.includes('counter attack threat')), 'defence vs attack → counter');
  assert(terms.some(t => t.includes('defensive setup')), 'defence vs attack → defensive setup');
}

// 7. 极端天气
{
  const ctx = { homeTeam: 'Norway', awayTeam: 'Spain', homeId: 'NOR', awayId: 'ESP', weatherCondition: 'Rain' };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false });
  assert(terms.some(t => t.includes('weather impact')), 'rain → weather impact query');
}

// 8. 高温
{
  const ctx = { homeTeam: 'Qatar', awayTeam: 'Japan', homeId: 'QAT', awayId: 'JPN', temperature: 97 };
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false });
  assert(terms.some(t => t.includes('heat stress')), 'high temp → heat stress query');
}

// 9. 晋级形势（淘汰赛）
{
  const ctx = { homeTeam: 'Argentina', awayTeam: 'Portugal', homeId: 'ARG', awayId: 'POR' };
  const getQualification = () => ({ stage: 'knockout' });
  const terms = buildContextAwareSearchTerms(ctx, { isFinished: false, getQualification });
  assert(terms.some(t => t.includes('must win')), 'knockout → must win');
  assert(terms.some(t => t.includes('qualification scenario')), 'knockout → scenario');
}

// 10. 最大 8 条限制
{
  const ctx = { homeTeam: 'France', awayTeam: 'Iceland', homeId: 'FRA', awayId: 'ISL' };
  const getElo = (id) => id === 'FRA' ? 1850 : 1550;
  const getStyle = (id) => id === 'FRA' ? 'attacking' : 'defensive';
  const getQualification = () => ({ stage: 'knockout' });
  const terms = buildContextAwareSearchTerms(ctx, {
    isFinished: false, getElo, getStyle, getQualification,
  });
  assert(terms.length <= 8, 'max 8 queries enforced');
  const unique = new Set(terms.map(t => t.toLowerCase().trim()));
  assert(unique.size === terms.length, 'all queries are unique');
}

// 11. null/undefined 安全（无上下文）
{
  const ctx = { homeTeam: 'England', awayTeam: 'Senegal', homeId: 'ENG', awayId: 'SEN' };
  const terms = buildContextAwareSearchTerms(ctx, {
    isFinished: false, getElo: null, getStyle: undefined, getQualification: undefined,
  });
  assert(terms.length === 5, 'null opts = base 5 only');
}

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
