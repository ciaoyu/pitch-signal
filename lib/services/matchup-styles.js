'use strict';

/**
 * Tactical Style Matchup Analyzer (KO-12)
 *
 * Evaluates static tactical style tags for teams and detects tactical counter matchups.
 * Outputs styleMatchup section for knockout intelligence card & bot context.
 * Does NOT modify quantitative win probability (display + bot context only).
 */
const teamResolver = require('../team_resolver');
const { resolveDataPath } = require('../data-resolver');
const fs = require('fs');

// Static tactical style tags dictionary
const STYLE_TAG_LABELS = {
  possession:   { zh: '控球主导', en: 'Possession Dominant' },
  counter_fast: { zh: '防反极速', en: 'Fast Counter-Attack' },
  high_press:   { zh: '高位逼抢', en: 'High Press' },
  low_block:    { zh: '铁桶防守', en: 'Low Block Defense' },
  crossing:     { zh: '传中定点', en: 'Crossing & Set-Pieces' },
  observed_possession_high: { zh: '观测到的高控球', en: 'Observed high possession' },
  observed_possession_low: { zh: '观测到的低控球', en: 'Observed low possession' },
};

let _facts = null;
function loadFacts() {
  if (_facts) return _facts;
  try { _facts = JSON.parse(fs.readFileSync(resolveDataPath('team_style_facts.json'), 'utf8')).teams || {}; }
  catch { _facts = {}; }
  return _facts;
}

function getTeamStyleFacts(teamIdentifier) {
  if (!teamIdentifier) return null;
  const facts = loadFacts();
  const raw = String(teamIdentifier);
  if (facts[raw]) return facts[raw];
  const resolved = teamResolver.resolve(raw);
  const candidates = [resolved?.official_name, resolved?.ratings_id, resolved?.espn_id, resolved?.fifa_code].filter(Boolean).map(String);
  for (const candidate of candidates) if (facts[candidate]) return facts[candidate];
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.values(facts).find(record => String(record.teamName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normalized) || null;
}

// Map national teams to their primary static tactical style tags
const TEAM_STYLE_TAGS = {
  'Spain':       ['possession', 'high_press'],
  'France':      ['counter_fast'],
  'Morocco':     ['low_block', 'counter_fast'],
  'Germany':     ['possession', 'high_press'],
  'England':     ['possession', 'crossing'],
  'Argentina':   ['possession'],
  'Portugal':    ['possession', 'crossing'],
  'Netherlands': ['possession', 'counter_fast'],
  'Italy':       ['low_block', 'counter_fast'],
  'Croatia':     ['possession', 'low_block'],
  'Brazil':      ['possession', 'counter_fast'],
  'Japan':       ['counter_fast', 'high_press'],
};

function getTeamStyleTags(teamIdentifier) {
  return getTeamStyleFacts(teamIdentifier)?.derivedTags || [];
}

/**
 * Analyzes whether style tags between team A and team B trigger counter rules
 */
function analyzeStyleMatchup(params = {}) {
  const homeTarget = params.homeName || params.homeTeamId || params.homeId;
  const awayTarget = params.awayName || params.awayTeamId || params.awayId;

  const homeTags = getTeamStyleTags(homeTarget);
  const awayTags = getTeamStyleTags(awayTarget);
  const homeFacts = getTeamStyleFacts(homeTarget);
  const awayFacts = getTeamStyleFacts(awayTarget);

  const counterAdvantages = [];

  return {
    status: 'insufficient_coverage',
    label: { zh: '事实画像待补齐', en: 'Fact coverage incomplete' },
    homeTags,
    awayTags,
    counterAdvantages,
    homeFacts,
    awayFacts,
    ruleEligible: false,
    note: { zh: '当前仅有控球/阵型/换人等观测事实；压迫、反击和推进未覆盖，暂不触发对位规则。', en: 'Observed possession, formation and substitution facts are available; pressing, counterplay and progression are not covered, so no matchup rule is triggered.' }
  };
}

/**
 * Builds dedicated styleMatchup section (KO-12)
 * Does NOT hijack familiarity.
 */
function buildStyleMatchupSection(params = {}) {
  const styleMatchup = analyzeStyleMatchup(params);
  if (!styleMatchup.homeFacts && !styleMatchup.awayFacts) {
    return null;
  }

  return {
    confidence: 'low',
    source: 'wc2026/team_style_facts.json',
    usedInModel: false,
    ruleVersion: 'style-facts-v1',
    coverage: {
      home: styleMatchup.homeFacts?.coverage || null,
      away: styleMatchup.awayFacts?.coverage || null,
    },
    ...styleMatchup
  };
}

module.exports = {
  STYLE_TAG_LABELS,
  TEAM_STYLE_TAGS,
  getTeamStyleFacts,
  getTeamStyleTags,
  analyzeStyleMatchup,
  buildStyleMatchupSection,
};
