const PredictionEngine = require('./lib/prediction');

const engine = new PredictionEngine();

// Simulate a match where Math predicts Home win heavily
const params = {
  homeId: 'ARG',
  awayId: 'KSA', // Saudi Arabia
  homeRating: { rating: 1800, attack_strength: 1.5, defense_strength: 0.5 },
  awayRating: { rating: 1400, attack_strength: 0.7, defense_strength: 1.3 },
  isKnockout: false,
  polymarketOdds: {
    // Market predicts an upset due to insider info / rumors
    homeWin: 0.30,
    draw: 0.10,
    awayWin: 0.60,
    liquidity: 'high' // Market is highly confident and liquid
  }
};

const result = engine.predict(params);
console.log('Result with severe conflict & high liquidity:');
console.log('Final Probs:', {
  homeWin: result.homeWin,
  draw: result.draw,
  awayWin: result.awayWin
});
console.log('Market signal fusion metadata:', result.marketSignalFusion);

// Test 2: Low liquidity conflict (Should trust Math)
params.polymarketOdds.liquidity = 'low';
const resultLow = engine.predict(params);
console.log('\nResult with severe conflict & low liquidity:');
console.log('Final Probs:', {
  homeWin: resultLow.homeWin,
  draw: resultLow.draw,
  awayWin: resultLow.awayWin
});
console.log('Market signal fusion metadata:', resultLow.marketSignalFusion);

// Test 3: No conflict (Market aligns with Math)
params.polymarketOdds = {
  homeWin: 0.85,
  draw: 0.10,
  awayWin: 0.05,
  liquidity: 'high'
};
const resultAlign = engine.predict(params);
console.log('\nResult with no severe conflict:');
console.log('Final Probs:', {
  homeWin: resultAlign.homeWin,
  draw: resultAlign.draw,
  awayWin: resultAlign.awayWin
});
console.log('Market signal fusion metadata:', resultAlign.marketSignalFusion);
