#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const context = { window: { WorldCup: { Utils: { tx: zh => zh, esc: v => String(v ?? '') }, I18n: { i18nText: o => o?.zh || '', displayMaybeTeamName: x => x }, State: { uiLang: 'zh' } } }, console };
context.global = context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'static/js/match-review.js'), 'utf8'), context);
const html = context.window.WorldCup.MatchReview.renderMatchReview({
  match: { homeScore: 2, awayScore: 1 }, keyEvents: [{ minute: "88'", type: 'goal', text: 'Goal! Spain 2, Belgium 1.', textI18n: { zh: '进球：西班牙将比分改写为 2-1。', en: 'Goal! Spain 2, Belgium 1.' } }],
  predictionSnapshot: { payload: { knockoutIntel: { sections: { styleMatchup: { source: 'tactical-style-matrix', confidence: 'low', homeTags: ['possession'], awayTags: [] }, penalty: { comparison: { reason: 'Home side shows clear advantage in Elo/defence/shootout experience' } } } } } },
});
assert.match(html, /赛前淘汰赛情报（冻结快照）/, 'renders frozen pre-match column');
assert.match(html, /赛后事实与验证/, 'renders post-match facts column');
assert.match(html, /info only/, 'labels static style material as info only');
assert.match(html, /进球：西班牙将比分改写为 2-1/, 'uses localized actual event evidence');
assert.match(html, /主队在 Elo、防守与点球大战经验上优势明显/, 'localizes legacy frozen comparison reason');
assert.doesNotMatch(html, /Home side shows clear advantage/, 'does not leak legacy English reason into Chinese UI');

// Regression test for penalty goal with directional text vs saved attempt
const htmlFacts = context.window.WorldCup.MatchReview.renderFrozenKnockoutComparison({
  match: { homeScore: 2, awayScore: 0 },
  keyEvents: [
    { minute: "22'", type: 'penalty', text: 'Goal! Mikel Oyarzabal converts the penalty with a right footed shot to the top right corner.', textI18n: { zh: '点球破门：米克尔·奥亚萨瓦尔主罚命中球门右上角。' } },
    { minute: "35'", type: 'attempt', text: 'Attempt saved. Mikel Oyarzabal right footed shot from the center of the box is saved in the center of the goal.', textI18n: { zh: '扑出：米克尔·奥亚萨瓦尔禁区中央右脚射门被球门中央扑出。' } },
    { minute: "58'", type: 'goal', text: 'Goal! Spain 2, France 0.', textI18n: { zh: '进球：西班牙 2-0 法国。' } }
  ],
  predictionSnapshot: { payload: { knockoutIntel: { sections: {} } } },
});
assert.match(htmlFacts, /点球破门：米克尔·奥亚萨瓦尔主罚命中球门右上角/, 'retains penalty goal even with directional text');
assert.match(htmlFacts, /进球：西班牙 2-0 法国/, 'retains ordinary goal');
assert.doesNotMatch(htmlFacts, /扑出：米克尔·奥亚萨瓦尔禁区中央右脚射门被球门中央扑出/, 'filters out saved attempt with goal keyword');

console.log('✅ post-match frozen-intel UI regression passed');
