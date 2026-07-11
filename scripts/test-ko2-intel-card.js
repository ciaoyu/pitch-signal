const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.tx = (zh, en) => zh || en;
global.esc = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
global.Fmt = {
  safeNum: (val, def = 0) => (val === undefined || val === null || isNaN(Number(val)) ? def : Number(val))
};

global.window = {
  WorldCup: {
    State: { uiLang: 'zh' },
    Formatters: global.Fmt,
    Utils: {
      tx: global.tx,
      esc: global.esc
    },
    I18n: {
      i18nText: (obj, fallback) => {
        if (!obj) return fallback || '';
        if (typeof obj === 'string') return obj;
        return obj.zh || obj.en || fallback || '';
      }
    }
  }
};

// Evaluate match-renderers.js
const renderersCode = fs.readFileSync(
  path.join(__dirname, '../static/js/match-renderers.js'),
  'utf8'
);
eval(renderersCode);

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

console.log('=== KO-2: Knockout Intel Card Renderers Test Suite ===');

test('1. returns empty string when knockoutIntel is missing, not knockout, or empty sections', () => {
  assert.strictEqual(window.renderKnockoutIntel(null), '');
  assert.strictEqual(window.renderKnockoutIntel({ meta: { isKnockout: false } }), '');
  assert.strictEqual(window.renderKnockoutIntel({ meta: { isKnockout: true }, sections: {} }), '');
});

test('2. renders full fixture with all sections in exact priority order', () => {
  const fixture = {
    meta: { isKnockout: true, round: 'SF', roundLabel: { zh: '半决赛', en: 'Semifinal' } },
    sections: {
      lessons: { confidence: 'low', source: 'ai-postmortem', usedInModel: false, home: ['警惕高空轰炸'] },
      fatigue: { confidence: 'high', source: 'schedule+venues', usedInModel: true, home: { restDays: 4, cumEtMinutes: 30, travelKm: 1200, score: 0.5 }, away: { restDays: 5, cumEtMinutes: 0, travelKm: 400, score: 0.2 }, differential: -0.3 },
      suspensions: { confidence: 'high', source: 'espn-events', usedInModel: false, home: { out: [{ player: 'PlayerX', playerZh: { zh: '张三' }, reason: { zh: '红牌停赛' } }], atRisk: [] }, away: { out: [], atRisk: [] } },
      penalty: { confidence: 'medium', source: 'history', usedInModel: false, home: { shootouts: 5, wins: 4, skill: 0.6 } }
    }
  };

  const html = window.renderKnockoutIntel(fixture);
  assert.ok(html.includes('淘汰赛赛前情报'), 'Should contain main card title');
  assert.ok(html.includes('半决赛'), 'Should contain round label');

  // Check order of rendered headers
  const idxSuspensions = html.indexOf('停赛与伤停风险');
  const idxFatigue = html.indexOf('体能与赛程负荷');
  const idxPenalty = html.indexOf('点球大战能力');
  const idxLessons = html.indexOf('既往淘汰赛复盘教训');

  assert.ok(idxSuspensions !== -1 && idxFatigue !== -1 && idxPenalty !== -1 && idxLessons !== -1, 'All sections rendered');
  assert.ok(idxSuspensions < idxFatigue, 'suspensions before fatigue');
  assert.ok(idxFatigue < idxPenalty, 'fatigue before penalty');
  assert.ok(idxPenalty < idxLessons, 'penalty before lessons');
});

test('3. renders confidence and usedInModel badges properly', () => {
  const fixture = {
    meta: { isKnockout: true, round: 'QF' },
    sections: {
      fatigue: { confidence: 'high', source: 'schedule+venues', usedInModel: true, home: {}, away: {} }
    }
  };
  const html = window.renderKnockoutIntel(fixture);
  assert.ok(html.includes('高'), 'Should render localized confidence badge');
  assert.ok(html.includes('已入量化模型'), 'Should render MODEL SIGNAL badge');
  assert.ok(html.includes('赛程与场地'), 'Should render localized source badge');
});

test('4. every real section builder\'s source string has a sourceLabel translation', () => {
  // Regression guard: match-renderers.js's sourceLabel map is a hand-maintained
  // lookup, hardcoded against each lib/services/*-section.js's `source:` string
  // literal at review time. A section added or edited later (e.g. experience-section.js
  // gaining a "world-cup-history+..." source when its historical scope was added)
  // silently falls back to rendering the raw internal string if nobody remembers
  // to update this list by hand — this test catches that automatically instead of
  // relying on someone noticing an untranslated badge in the UI.
  const rendererSrc = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'match-renderers.js'), 'utf8');
  const mapMatch = rendererSrc.match(/const sourceLabel = \(\{([\s\S]*?)\}\[sec\.source\]/);
  assert.ok(mapMatch, 'sourceLabel map block found in match-renderers.js');
  const mapBlock = mapMatch[1];

  // Scoped to exactly the files registered in knockout-intel.js's SECTION_BUILDERS
  // (not every file under lib/services/ — most of those are candidate signals,
  // player-rating lookups, etc. whose `source` field never flows through this
  // card's sec.source at all).
  const sectionBuilderFiles = [
    'suspension.js', 'services/fatigue-signal.js', 'services/penalty-section.js',
    'services/referee-stats.js', 'services/super-subs-section.js', 'services/star-form.js',
    'services/matchup-styles.js', 'services/game-state-section.js',
    'services/experience-section.js', 'services/lessons-section.js',
  ].map((f) => path.join(__dirname, '..', 'lib', f));

  const missing = [];
  for (const file of sectionBuilderFiles) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/source:\s*'([^']+)'/g)) {
      const value = m[1];
      const key = `'${value}':`;
      if (!mapBlock.includes(key) && !missing.includes(value)) missing.push(value);
    }
  }
  assert.deepStrictEqual(missing, [], `sourceLabel map is missing translations for: ${missing.join(', ')}`);
});

console.log('All KO-2 tests passed!');
