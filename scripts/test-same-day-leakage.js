#!/usr/bin/env node
/**
 * Same-Day Match Isolation Regression Test
 *
 * Verifies that matches played on the same day do not leak ratings or strength updates
 * to each other during backtesting. This is tested by changing the score of the first match
 * and confirming that the prediction for the second match remains identical.
 */

'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const BacktestRunner = require('../lib/backtest');

class MockBacktestRunner extends BacktestRunner {
  constructor(matches) {
    super();
    this.mockMatches = matches;
  }

  loadHistory() {
    return {
      m2018: this.mockMatches,
      m2022: []
    };
  }
}

async function run() {
  console.log('=== Same-Day Match Leakage Test ===\n');

  // Match A and Match B are on the same day.
  // Match B is predicted. We will change the score of Match A and verify Match B's prediction is unaffected.
  const matchB = {
    date: '2018-06-15',
    home: 'Uruguay',
    away: 'Egypt',
    homeScore: 1,
    awayScore: 0,
    stage: 'Group A'
  };

  const runTestWithScore = async (matchAHomeScore, matchAAwayScore) => {
    const matchA = {
      date: '2018-06-15',
      home: 'Russia',
      away: 'Saudi Arabia',
      homeScore: matchAHomeScore,
      awayScore: matchAAwayScore,
      stage: 'Group A'
    };

    const runner = new MockBacktestRunner([matchA, matchB]);
    
    // Capture predictions by wrapping predictionEngine.predictWithMarket
    const predictions = [];
    const originalPredict = runner.engine.predictWithMarket;
    runner.engine.predictWithMarket = async function(params) {
      const res = await originalPredict.call(runner.engine, params);
      predictions.push({ homeId: params.homeId, awayId: params.awayId, res });
      return res;
    };

    await runner._walkForward([matchA, matchB]);
    
    // Find Match B's prediction
    const predB = predictions.find(p => p.homeId === 'Uruguay' && p.awayId === 'Egypt');
    return predB.res;
  };

  try {
    console.log('📋 Running Run 1: Match A score is 0 - 0');
    const pred1 = await runTestWithScore(0, 0);

    console.log('📋 Running Run 2: Match A score is 10 - 0 (Extreme Elo/Poisson impact)');
    const pred2 = await runTestWithScore(10, 0);

    // Verify predictions for Match B are identical
    console.log('📋 Comparing Match B prediction probabilities...');
    console.log(`  Run 1: homeWin=${pred1.homeWin.toFixed(4)}, draw=${pred1.draw.toFixed(4)}, awayWin=${pred1.awayWin.toFixed(4)}`);
    console.log(`  Run 2: homeWin=${pred2.homeWin.toFixed(4)}, draw=${pred2.draw.toFixed(4)}, awayWin=${pred2.awayWin.toFixed(4)}`);

    assert.strictEqual(pred1.homeWin, pred2.homeWin, 'Home win probability leaked same-day score change!');
    assert.strictEqual(pred1.draw, pred2.draw, 'Draw probability leaked same-day score change!');
    assert.strictEqual(pred1.awayWin, pred2.awayWin, 'Away win probability leaked same-day score change!');

    console.log('\n✅ PASS: Same-day matches are strictly isolated. No look-ahead leakage.');
    process.exit(0);
  } catch (e) {
    console.error('\n❌ FAIL: Same-day match isolation failed:', e.message);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
