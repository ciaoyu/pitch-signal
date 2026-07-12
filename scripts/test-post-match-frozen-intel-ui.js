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
console.log('✅ post-match frozen-intel UI regression passed');
