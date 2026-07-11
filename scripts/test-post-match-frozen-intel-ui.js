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
  match: { homeScore: 2, awayScore: 1 }, keyEvents: [{ minute: "88'", type: 'goal', text: 'Goal! Spain 2, Belgium 1.' }],
  predictionSnapshot: { payload: { knockoutIntel: { sections: { styleMatchup: { source: 'tactical-style-matrix', confidence: 'low', homeTags: ['possession'], awayTags: [] }, penalty: { comparison: { reason: 'Info only' } } } } } },
});
assert.match(html, /赛前淘汰赛情报（冻结快照）/, 'renders frozen pre-match column');
assert.match(html, /赛后事实与验证/, 'renders post-match facts column');
assert.match(html, /info only/, 'labels static style material as info only');
assert.match(html, /Goal! Spain 2, Belgium 1/, 'uses actual event evidence');
console.log('✅ post-match frozen-intel UI regression passed');
