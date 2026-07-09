const assert = require('assert');
const PredictionEngine = require('../lib/prediction');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  console.log('=== PF-8: Score Matrix Top Scores Display Test Suite ===');

  const engine = new PredictionEngine();

  test('1. predict() returns topScores sorted by probability descending', async () => {
    const res = await engine.predict({
      matchId: 'test-1',
      homeId: 'ARG',
      awayId: 'FRA',
      homeRating: { elo: 2100, attack: 1.3, defense: 0.8 },
      awayRating: { elo: 2080, attack: 1.25, defense: 0.85 },
    });

    assert.ok(Array.isArray(res.topScores), 'topScores should be an array');
    assert.ok(res.topScores.length > 0, 'topScores should not be empty');

    for (let i = 0; i < res.topScores.length - 1; i++) {
      assert.ok(
        res.topScores[i].prob >= res.topScores[i + 1].prob,
        `score prob at index ${i} (${res.topScores[i].prob}) should be >= index ${i + 1} (${res.topScores[i + 1].prob})`
      );
    }
  });

  test('2. topScores probability sum does not exceed 1.0', async () => {
    const res = await engine.predict({
      matchId: 'test-2',
      homeId: 'BRA',
      awayId: 'GER',
      homeRating: { elo: 2050, attack: 1.4, defense: 0.9 },
      awayRating: { elo: 2040, attack: 1.3, defense: 0.9 },
    });

    const sum = res.topScores.reduce((acc, item) => acc + item.prob, 0);
    assert.ok(sum <= 1.0001, `sum of topScores probabilities (${sum}) should be <= 1.0`);
  });

  test('3. each item in topScores has valid score format and probability', async () => {
    const res = await engine.predict({
      matchId: 'test-3',
      homeId: 'ESP',
      awayId: 'ITA',
      homeRating: { elo: 2000, attack: 1.1, defense: 0.7 },
      awayRating: { elo: 1980, attack: 1.0, defense: 0.75 },
    });

    for (const item of res.topScores) {
      assert.match(item.score, /^\d+-\d+$/, `score format should be X-Y, got ${item.score}`);
      assert.ok(typeof item.prob === 'number' && item.prob >= 0 && item.prob <= 1, `prob should be in [0, 1], got ${item.prob}`);
    }
  });

  console.log('All PF-8 tests passed!');
}

runTests();
