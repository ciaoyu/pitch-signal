#!/usr/bin/env node
/**
 * P4-1: Shin's method 去水测试
 *
 * 验证：① 数学性质（去水后和为1、不改变排序）② 冷热门修正方向正确
 * （相对简单比例去水，热门概率应上修、冷门概率应下修）③ 边界情况
 * （无水/倒挂退化为比例去水）④ /api/predict 的 odds key 门控读对了变量
 * （此前误判 BALLDONTLIE_API_KEY，应为 THE_ODDS_API_KEY）⑤ legacy odds route/job
 * 也接受 THE_ODDS_API_KEY，且按 The Odds API 官方 apiKey query 参数认证。
 */
const PredictionEngine = require('../lib/prediction');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

const engine = new PredictionEngine();

// 1. 和为1（数值误差兜底生效）
{
  const probs = engine.shinDevig([1 / 1.50, 1 / 4.00, 1 / 8.00]);
  const sum = probs.reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1) < 1e-9, `shinDevig 输出和为1 (${sum})`);
}

// 2. 冷热门修正方向：favorite 上修，longshot 下修（相对简单比例去水）
{
  const raw = [1 / 1.50, 1 / 4.00, 1 / 8.00]; // 强热门/中/长赔
  const overround = raw.reduce((a, b) => a + b, 0);
  const proportional = raw.map(b => b / overround);
  const shin = engine.shinDevig(raw);
  assert(shin[0] > proportional[0], `favorite 概率上修 (${shin[0].toFixed(4)} > ${proportional[0].toFixed(4)})`);
  assert(shin[2] < proportional[2], `longshot 概率下修 (${shin[2].toFixed(4)} < ${proportional[2].toFixed(4)})`);
}

// 3. 排序不变：不会把热门变冷门
{
  const shin = engine.shinDevig([1 / 1.50, 1 / 4.00, 1 / 8.00]);
  assert(shin[0] > shin[1] && shin[1] > shin[2], '去水后排序保持 home > draw > away');
}

// 4. 边界：无水/倒挂退化为比例去水，不抛错
{
  const shin = engine.shinDevig([0.4, 0.35, 0.25]);
  assert(Math.abs(shin[0] - 0.4) < 1e-9 && Math.abs(shin.reduce((a, b) => a + b, 0) - 1) < 1e-9, '无水情况退化为比例去水');
}

// 5. calcOddsFactor 接入 shinDevig，输出仍是三个和为1的概率
{
  const factor = engine.calcOddsFactor({ homeWin: '1.50', draw: '4.00', awayWin: '8.00' });
  const sum = factor.homeWinProb + factor.drawProb + factor.awayWinProb;
  assert(Math.abs(sum - 1) < 0.01, `calcOddsFactor 输出和为1 (${sum})`);
  assert(factor.homeWinProb > 0.64, `calcOddsFactor 热门修正生效 (${factor.homeWinProb} > 简单比例0.64)`);
}

// 6. /api/predict 的 odds key 门控读的是 THE_ODDS_API_KEY，不是 BALLDONTLIE_API_KEY
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'routes', 'prediction.js'), 'utf8');
  const gateLine = src.split('\n').find(l => l.includes('hasOddsKey ='));
  assert(!!gateLine && gateLine.includes('THE_ODDS_API_KEY'), '/api/predict 的 odds 门控读 THE_ODDS_API_KEY');
  assert(!!gateLine && !gateLine.includes('BALLDONTLIE_API_KEY'), '/api/predict 的 odds 门控不再误读 BALLDONTLIE_API_KEY');
}

// 7. 旧 odds route/job 接受 THE_ODDS_API_KEY，且不再用 x-api-key header 空转
{
  const oddsRouteSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'routes', 'odds.js'), 'utf8');
  const oddsJobSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'jobs', 'odds-collector.js'), 'utf8');
  assert(oddsRouteSrc.includes('process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY'), '/api/odds 优先读 THE_ODDS_API_KEY，兼容 ODDS_API_KEY');
  assert(oddsJobSrc.includes('process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY'), 'odds-collector 优先读 THE_ODDS_API_KEY，兼容 ODDS_API_KEY');
  assert(oddsRouteSrc.includes('apiKey=${encodeURIComponent(ODDS_API_KEY)}'), '/api/odds 使用 apiKey query 参数认证');
  assert(oddsJobSrc.includes('apiKey=${encodeURIComponent(ODDS_API_KEY)}'), 'odds-collector 使用 apiKey query 参数认证');
  assert(!oddsRouteSrc.includes('x-api-key') && !oddsJobSrc.includes('x-api-key'), 'odds route/job 不再使用 x-api-key header');
}

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
