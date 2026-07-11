#!/usr/bin/env node
/**
  * P2-3: odds-divergence pure-function tests
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

// 9. P4-1: route uses PURE model probs (includeExternalOdds:false), not the
// odds-blended prediction — otherwise "divergence" is model+20%market vs
// 100%market, which understates the real gap. Mock PredictionService and
// assert the route's modelProbs matches the pure call.
//
// 10. The route must NEVER fetch odds live on a cache miss (that used to chain
// up to two real the-odds-api requests on every unauthenticated page view —
// the actual cause of the account's quota exhaustion). On a miss it should
// return a clean "market_data_pending" note with no marketProbs, computed
// from a single free (no-odds) predictMatch call — assert predictMatch is
// called with includeExternalOdds:false and never with true.
(async () => {
  process.env.TEST_MODE = '1';
  const PredictionService = require('../lib/services/PredictionService');
  const original = PredictionService.prototype.predictMatch;
  const calls = [];

  PredictionService.prototype.predictMatch = async function (matchId, opts = {}) {
    calls.push(opts.includeExternalOdds === true);
    return { homeWin: 0.60, draw: 0.25, awayWin: 0.15 };
  };

  const createOddsDivergenceRoutes = require('../lib/routes/odds-divergence');
  const routes = createOddsDivergenceRoutes({ getCached: () => null, setCache: () => {} });
  const result = await routes['GET /api/odds-divergence/:matchId']({ matchId: 'test-p4-1-pure-model' });

  PredictionService.prototype.predictMatch = original;

  assert(!result.error, `route did not error: ${result.error || ''}`);
  near(result.modelProbs?.home ?? -1, 0.60, 0.001, 'modelProbs.home uses PURE prediction (0.60)');
  assert(result.marketProbs == null, 'marketProbs is absent when no benchmark row exists (no live odds fetch)');
  assert(result.note === 'market_data_pending', 'note explains market data is pending, not "no odds"');
  assert(calls.length === 1, 'predictMatch called exactly once on a cache miss (no live odds fetch)');
  assert(calls[0] === false, 'the single predictMatch call never requests externalOdds');

  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
