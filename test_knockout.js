const PredictionEngine = require('./lib/prediction');
const engine = new PredictionEngine();
console.log(engine.predict({
  homeId: 'France', awayId: 'Argentina',
  homeRating: { rating: 1800, attack_strength: 1.5, defense_strength: 0.8 },
  awayRating: { rating: 1750, attack_strength: 1.4, defense_strength: 0.9 },
  isKnockout: true, knockoutRound: 'F'
}).components.poisson);
console.log(engine.predict({
  homeId: 'France', awayId: 'Argentina',
  homeRating: { rating: 1800, attack_strength: 1.5, defense_strength: 0.8 },
  awayRating: { rating: 1750, attack_strength: 1.4, defense_strength: 0.9 },
  isKnockout: false
}).components.poisson);
