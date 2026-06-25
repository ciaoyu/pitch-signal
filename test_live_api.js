const PredictionEngine = require('./lib/prediction');

async function testLiveFusion() {
  const engine = new PredictionEngine();
  
  const params = {
    homeId: 'Argentina',
    awayId: 'Brazil',
    homeRating: { rating: 1800, attack_strength: 1.5, defense_strength: 0.8 },
    awayRating: { rating: 1750, attack_strength: 1.4, defense_strength: 0.9 },
    isKnockout: true, 
    knockoutRound: 'SF'
  };

  console.log('Fetching live/mock Polymarket data and predicting...');
  const result = await engine.predictWithMarket(params);
  
  console.log('\n--- Final Prediction Result ---');
  console.log(`Match: ${params.homeId} vs ${params.awayId}`);
  console.log(`Home Win: ${(result.homeWin * 100).toFixed(2)}%`);
  console.log(`Draw: ${(result.draw * 100).toFixed(2)}%`);
  console.log(`Away Win: ${(result.awayWin * 100).toFixed(2)}%`);
  
  console.log('\n--- Fusion Metadata ---');
  console.log(result.marketSignalFusion);
}

testLiveFusion().catch(console.error);
