#!/usr/bin/env node
'use strict';

/**
 * P4-1: prediction page market-divergence UI contract.
 *
 * This is intentionally a static contract test: the feature is pure frontend
 * rendering around existing /api/predict and /api/odds-divergence endpoints.
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'static', 'js', 'elo-prediction.js'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'static', 'js', 'bundle.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');

console.log('━━━ prediction market UI contract tests ━━━');

assert(source.includes('function renderMarketDivergencePanel'), 'prediction page renders a market-divergence panel');
assert(source.includes("① ${tx('模型预测'") || source.includes('① ${tx("模型预测"'), 'panel has model prediction column');
assert(source.includes("② ${tx('市场参考'") || source.includes('② ${tx("市场参考"'), 'panel has market reference column');
assert(source.includes("③ ${tx('分歧指数'") || source.includes('③ ${tx("分歧指数"'), 'panel has divergence-index column');
assert(source.includes('/api/odds-divergence/${m.id}'), 'prediction cards fetch odds-divergence per upcoming match');
assert(source.includes('b.divergenceScore - a.divergenceScore'), 'prediction cards sort by divergence score descending');
assert(source.includes('Market data pending') && source.includes('市场数据采集中'), 'pending-market fallback is visible');
assert(source.includes('No market data yet') && source.includes('暂无市场数据'), 'no-market fallback is visible');
assert(bundle.includes('market-divergence-grid'), 'rebuilt bundle contains market-divergence grid');

const versionMatch = html.match(/bundle\.js\?v=([a-f0-9]{8})/);
assert(Boolean(versionMatch), 'index.html references hashed JS bundle');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed ? 1 : 0);
