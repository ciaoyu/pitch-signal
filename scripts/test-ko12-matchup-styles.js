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

test('1. reports insufficient coverage when no sourced facts exist (never fabricates)', () => {
  const res1 = analyzeStyleMatchup({ homeName: 'UnknownTeamX', awayName: 'UnknownTeamY' });
  assert.strictEqual(res1.status, 'insufficient_coverage');
  assert.strictEqual(res1.label.zh, '事实画像待补齐');
  assert.strictEqual(res1.counterAdvantages.length, 0);

  const res2 = analyzeStyleMatchup({ homeName: 'Spain', awayName: 'Germany' });
  assert.strictEqual(res2.status, 'insufficient_coverage');
  assert.strictEqual(res2.label.zh, '事实画像待补齐');
});

test('2. does not infer a counter matchup from the retired hand-written matrix', () => {
  const res = analyzeStyleMatchup({ homeName: 'France', awayName: 'Spain' });
  assert.notStrictEqual(res.status, 'countered');
  assert.strictEqual(res.counterAdvantages.length, 0);
  assert.strictEqual(res.ruleEligible, false);
});

test('3. buildStyleMatchupSection exports dedicated section key without hijacking familiarity and sets low confidence when coverage missing', () => {
  const secLow = buildStyleMatchupSection({ homeName: 'UnknownX', awayName: 'Spain' });
  assert.strictEqual(secLow.status, 'insufficient_coverage');
  assert.strictEqual(secLow.ruleEligible, false);
  const secMedium = buildStyleMatchupSection({ homeName: 'FRA', awayName: 'ESP' });
  assert.strictEqual(secMedium.confidence, 'low');
  assert.strictEqual(secMedium.source, 'wc2026/team_style_facts.json');
  assert.strictEqual(secMedium.ruleEligible, false);
});

test('4. buildKnockoutIntel includes styleMatchup section', () => {
  const intel = buildKnockoutIntel({
    homeName: 'France',
    awayName: 'Spain',
    stage: 'Semi-finals'
  });
  assert.ok(intel && intel.sections && intel.sections.styleMatchup, 'Should include styleMatchup section');
  assert.notStrictEqual(intel.sections.styleMatchup.status, 'countered');
});

console.log('All KO-12 tests passed!');
