#!/usr/bin/env node
/**
 * P2-3: odds-divergence 纯函数测试
 */
'use strict';

const div = require('../lib/routes/odds-divergence');

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }
function near(a, b, eps, label) { Math.abs(a - b) <= eps ? (console.log('  ✅', label, `(${a.toFixed(4)})`), passed++) : (console.error('  ❌', label, `expected ~${b}, got ${a}`), failed++); }

console.log('━━━ odds-divergence unit tests ━━━');

// 1. impliedProb normal
{
  const p = div.impliedProbabilitiesFromDecimal(2.0, 3.5, 4.0);
  assert(p !== null, 'impliedProb returns object');
  const sum = p.home + p.draw + p.away;
  near(sum, 1.0, 0.001, 'impliedProb normalizes to 1.0');
}

// 2. impliedProb with vig
{
  const p = div.impliedProbabilitiesFromDecimal(1.9, 3.6, 4.2);
  assert(p !== null, 'impliedProb handles vig');
  near(p.home + p.draw + p.away, 1.0, 0.001, 'vig removed → sum=1');
}

// 3. null input
assert(div.impliedProbabilitiesFromDecimal(null, 3, 4) === null, 'null returns null');

// 4. computeDivergence identical → no divergence
{
  const d = div.computeDivergence({ home: 0.5, draw: 0.25, away: 0.25 }, { home: 0.5, draw: 0.25, away: 0.25 });
  assert(d && !d.divergence, 'identical probs → no divergence');
}

// 5. small diff (<8pp) → no divergence
{
  const d = div.computeDivergence({ home: 0.48, draw: 0.27, away: 0.25 }, { home: 0.45, draw: 0.28, away: 0.27 });
  assert(d && !d.divergence, '3pp diff → below threshold');
}

// 6. large diff (>8pp) → divergence
{
  const d = div.computeDivergence({ home: 0.60, draw: 0.20, away: 0.20 }, { home: 0.40, draw: 0.30, away: 0.30 });
  assert(d && d.divergence, '20pp diff → divergence flagged');
  assert(d.direction === 'model_home_lean', 'direction = model_home_lean');
}

// 7. null input
assert(div.computeDivergence(null, null) === null, 'null inputs → null');

// 8. threshold constant
assert(div.DIVERGENCE_THRESHOLD === 0.08, 'threshold = 0.08');

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
