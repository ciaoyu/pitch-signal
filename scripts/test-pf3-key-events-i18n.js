const assert = require('assert');
const {
  translateFootballCommentaryToZh,
  translateEventToBilingual,
  computeEventImportance,
  extractKeyEvents,
} = require('../lib/keyEvents');

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

console.log('=== PF-3: Key Events Translation and Importance Test Suite ===');

test('1. Penalty conceded phrase translates to genuine Chinese without English fallback', () => {
  const text = 'Penalty conceded by Paraguay after a foul in the penalty area.';
  const res = translateFootballCommentaryToZh(text);
  assert.ok(!res.startsWith('赛场动态：'), `Should not fall back to 赛场动态：, got: ${res}`);
  assert.ok(res.includes('点球判罚') && res.includes('Paraguay'), `Should contain genuine translation, got: ${res}`);
});

test('2. Penalty draws a foul phrase translates to genuine Chinese', () => {
  const text = 'Penalty France. Kylian Mbappé draws a foul in the penalty area.';
  const res = translateFootballCommentaryToZh(text);
  assert.ok(!res.startsWith('赛场动态：'), `Should not fall back to 赛场动态：, got: ${res}`);
  assert.ok(res.includes('获得点球') || res.includes('造点'), `Should contain penalty drawing translation, got: ${res}`);
});

test('3. VAR Decision Penalty phrase translates to genuine Chinese', () => {
  const text = 'VAR Decision: Penalty France.';
  const res = translateFootballCommentaryToZh(text);
  assert.ok(!res.startsWith('赛场动态：'), `Should not fall back to 赛场动态：, got: ${res}`);
  assert.ok(res.includes('VAR') && res.includes('点球'), `Should contain VAR penalty translation, got: ${res}`);
});

test('4. translateEventToBilingual returns structured bilingual textI18n for penalty events', () => {
  const item = {
    type: { text: 'Penalty' },
    text: 'Penalty conceded by Paraguay after a foul in the penalty area.',
  };
  const i18n = translateEventToBilingual(item);
  assert.strictEqual(i18n.en, item.text);
  assert.ok(i18n.zh && !i18n.zh.startsWith('赛场动态：'), `zh should be genuine Chinese translation, got: ${i18n.zh}`);
});

test('5. computeEventImportance scores goals, penalties, and VAR decisions appropriately', () => {
  const goalScore = computeEventImportance({ type: 'goal', text: 'Goal! France 1, Paraguay 0.' });
  const penScore = computeEventImportance({ type: 'penalty', text: 'Penalty conceded by Paraguay.' });
  const varScore = computeEventImportance({ type: 'var', text: 'VAR Decision: Penalty France.' });
  const cornerScore = computeEventImportance({ type: 'corner', text: 'Corner, France.' });

  assert.ok(goalScore >= 90, `goalScore (${goalScore}) should be >= 90`);
  assert.ok(penScore >= 80, `penScore (${penScore}) should be >= 80`);
  assert.ok(varScore >= 70, `varScore (${varScore}) should be >= 70`);
  assert.ok(penScore > cornerScore, `penScore (${penScore}) should be > cornerScore (${cornerScore})`);
});

test('6. extractKeyEvents filters and translates commentary list properly', () => {
  const commentary = [
    { time: { displayValue: '12\'' }, type: { text: 'Corner' }, text: 'Corner, France.' },
    { time: { displayValue: '45\'' }, type: { text: 'Penalty' }, text: 'Penalty conceded by Paraguay after a foul in the penalty area.' },
    { time: { displayValue: '46\'' }, type: { text: 'Goal' }, text: 'Goal! France 1, Paraguay 0. Kylian Mbappé converts the penalty.' },
  ];
  const events = extractKeyEvents(commentary);
  assert.strictEqual(events.length, 3);
  const penEvent = events.find((e) => e.minute === "45'");
  assert.ok(penEvent && penEvent.textI18n && penEvent.textI18n.zh, 'penalty event should have textI18n');
  assert.ok(!penEvent.textI18n.zh.startsWith('赛场动态：'), `penalty event zh should not start with 赛场动态：, got: ${penEvent.textI18n.zh}`);
});

console.log('All PF-3 Key Events tests passed!');
