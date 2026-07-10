const assert = require('assert');
const { analyzeStyleMatchup, buildStyleMatchupSection } = require('../lib/services/matchup-styles');
const { buildKnockoutIntel } = require('../lib/services/knockout-intel');

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

console.log('=== KO-12: Tactical Style Matchup Test Suite ===');

test('1. returns "常规对决" when no style tags or no counter rule hit (never fabricates)', () => {
  const res1 = analyzeStyleMatchup({ homeName: 'UnknownTeamX', awayName: 'UnknownTeamY' });
  assert.strictEqual(res1.status, 'normal');
  assert.strictEqual(res1.label.zh, '常规对决');
  assert.strictEqual(res1.counterAdvantages.length, 0);

  const res2 = analyzeStyleMatchup({ homeName: 'Spain', awayName: 'Germany' });
  assert.strictEqual(res2.status, 'normal');
  assert.strictEqual(res2.label.zh, '常规对决');
});

test('2. detects counter matchup (e.g., France counter_fast vs Spain possession)', () => {
  const res = analyzeStyleMatchup({ homeName: 'France', awayName: 'Spain' });
  assert.strictEqual(res.status, 'countered');
  assert.strictEqual(res.label.zh, '战术打法相克');
  assert.strictEqual(res.counterAdvantages.length, 1);
  assert.strictEqual(res.counterAdvantages[0].favored, 'home');
  assert.strictEqual(res.counterAdvantages[0].rule, 'counter_vs_possession');
});

test('3. buildStyleMatchupSection exports dedicated section key without hijacking familiarity and sets low confidence when coverage missing', () => {
  const secLow = buildStyleMatchupSection({ homeName: 'UnknownX', awayName: 'Spain' });
  assert.strictEqual(secLow.confidence, 'low');
  assert.strictEqual(secLow.source, 'tactical-style-matrix');
  assert.strictEqual(secLow.usedInModel, false);

  const secMedium = buildStyleMatchupSection({ homeName: 'Morocco', awayName: 'Spain' });
  assert.strictEqual(secMedium.confidence, 'medium');
  assert.strictEqual(secMedium.status, 'countered');
});

test('4. buildKnockoutIntel includes styleMatchup section', () => {
  const intel = buildKnockoutIntel({
    homeName: 'France',
    awayName: 'Spain',
    stage: 'Semi-finals'
  });
  assert.ok(intel && intel.sections && intel.sections.styleMatchup, 'Should include styleMatchup section');
  assert.strictEqual(intel.sections.styleMatchup.status, 'countered');
});

console.log('All KO-12 tests passed!');
