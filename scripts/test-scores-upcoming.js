#!/usr/bin/env node
'use strict';

/**
 * Regression: the Scores tab must show the nearest future matchday when
 * ESPN's default scoreboard contains only completed matches for today.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const liveList = { innerHTML: '' };
const elements = {
  'live-list': liveList,
  'live-count-badge': { style: {}, querySelector: () => ({ textContent: '' }) },
  'live-date': { textContent: '' },
  'update-time': { textContent: '' },
  'tournament-stats': { style: {} },
  'tournament-stats-inner': { innerHTML: '' },
};
const state = { scheduleCache: [], scheduleLoaded: false, uiLang: 'zh' };
let scheduleLoads = 0;

const tx = (zh) => zh;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const team = (name, id) => ({ name, id, score: '0', flag: '🏳️' });

const context = {
  window: {
    t: () => '',
    WorldCup: {
      State: state,
      Utils: { tx, esc, attr: esc, displayMaybeTeamName: t => t.name || '' },
      ApiClient: {
        get: async (url) => {
          if (url === '/api/scores') return {
            ok: true,
            data: { matches: [{ id: 'finished', state: 'post', home: team('Spain', '1'), away: team('Belgium', '2'), venue: '' }] },
          };
          if (url === '/api/tournament-stats') return { ok: false };
          if (url.startsWith('/api/matches/batch?ids=')) return { ok: false };
          throw new Error(`Unexpected request: ${url}`);
        },
      },
    },
  },
  document: {
    getElementById: id => elements[id] || null,
    querySelector: () => null,
  },
  Date,
  console,
};
context.window.loadSchedule = async () => {
  scheduleLoads += 1;
  state.scheduleLoaded = true;
  state.scheduleCache = [
    { id: 'next-1', state: 'pre', date: '2099-07-12T01:00:00.000Z', dateBJT: '07/12 09:00', timeBJT: '09:00', home: team('Argentina', '3'), away: team('Switzerland', '4'), venue: '' },
    { id: 'next-2', state: 'pre', date: '2099-07-12T05:00:00.000Z', dateBJT: '07/12 13:00', timeBJT: '13:00', home: team('Norway', '5'), away: team('England', '6'), venue: '' },
    { id: 'later', state: 'pre', date: '2099-07-15T01:00:00.000Z', dateBJT: '07/15 09:00', timeBJT: '09:00', home: team('France', '7'), away: team('Spain', '1'), venue: '' },
  ];
};
context.global = context;

const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'scores.js'), 'utf8');
vm.runInNewContext(source, context);

context.window.WorldCup.Scores.loadScores()
  .then(() => {
    assert.strictEqual(scheduleLoads, 1, 'loads the full schedule once when today has no upcoming fixture');
    assert.match(liveList.innerHTML, /即将开始/, 'renders the upcoming section');
    assert.match(liveList.innerHTML, /Argentina/, 'renders the first upcoming matchday');
    assert.match(liveList.innerHTML, /Norway/, 'keeps all fixtures on that matchday together');
    assert.doesNotMatch(liveList.innerHTML, /France/, 'does not append later matchdays');
    assert.strictEqual(state._lastScoresMatches.length, 3, 'keeps upcoming fixtures in the match-detail lookup cache');
    console.log('✅ Scores page upcoming-match regression passed');
  })
  .catch(error => {
    console.error('❌ Scores page upcoming-match regression failed');
    console.error(error);
    process.exit(1);
  });
