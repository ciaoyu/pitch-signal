const assert = require('assert');
const { KNOCKOUT_SCENARIOS, getRelevantScenarios } = require('../static/js/tactical-scenarios');

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

console.log('=== KO-14: Knockout Tactical Scenarios Test Suite ===');

test('1. library has 8-10 complete bilingual knockout scenarios', () => {
  assert.ok(KNOCKOUT_SCENARIOS.length >= 8 && KNOCKOUT_SCENARIOS.length <= 10, `Should have 8-10 scenarios, found ${KNOCKOUT_SCENARIOS.length}`);
  for (const sc of KNOCKOUT_SCENARIOS) {
    assert.ok(sc.id, 'Scenario must have id');
    assert.ok(sc.title.zh && sc.title.en, 'Scenario must have bilingual title');
    assert.ok(sc.condition.zh && sc.condition.en, 'Scenario must have bilingual condition');
    assert.ok(sc.deduction.zh && sc.deduction.en, 'Scenario must have bilingual deduction');
  }
});

test('2. falls back gracefully to default top 3 scenarios when no intel/tags available', () => {
  const res = getRelevantScenarios({ homeTags: [], awayTags: [] });
  assert.strictEqual(res.length, 3);
  assert.strictEqual(res[0].id, 'draw_90');
  assert.strictEqual(res[1].id, 'et_behind');
  assert.strictEqual(res[2].id, 'penalty_fatigue');
});

test('3. dynamically ranks relevant scenarios higher when team tags match', () => {
  const res = getRelevantScenarios({ homeTags: ['high_press'], awayTags: ['possession'] });
  assert.strictEqual(res.length, 3);
  const ids = res.map(r => r.id);
  assert.ok(ids.includes('high_press_fatigue') || ids.includes('et_red_card'), 'Should prioritize high press scenarios');
});

console.log('All KO-14 tests passed!');
