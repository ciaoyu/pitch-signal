'use strict';

/**
 * Tactical Style Matchup Analyzer (KO-12)
 *
 * Evaluates static tactical style tags for teams and detects tactical counter matchups.
 * Outputs styleMatchup section for knockout intelligence card & bot context.
 * Does NOT modify quantitative win probability (display + bot context only).
 */
const teamResolver = require('../team_resolver');

// Static tactical style tags dictionary
const STYLE_TAG_LABELS = {
  possession:   { zh: '控球主导', en: 'Possession Dominant' },
  counter_fast: { zh: '防反极速', en: 'Fast Counter-Attack' },
  high_press:   { zh: '高位逼抢', en: 'High Press' },
  low_block:    { zh: '铁桶防守', en: 'Low Block Defense' },
  crossing:     { zh: '传中定点', en: 'Crossing & Set-Pieces' },
};

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
  if (!teamIdentifier) return [];
  const s = String(teamIdentifier);
  if (TEAM_STYLE_TAGS[s]) return TEAM_STYLE_TAGS[s];

  const resolved = teamResolver.resolve(s);
  if (resolved) {
    if (resolved.official_name && TEAM_STYLE_TAGS[resolved.official_name]) {
      return TEAM_STYLE_TAGS[resolved.official_name];
    }
    if (resolved.ratings_id && TEAM_STYLE_TAGS[resolved.ratings_id]) {
      return TEAM_STYLE_TAGS[resolved.ratings_id];
    }
  }
  return [];
}

/**
 * Analyzes whether style tags between team A and team B trigger counter rules
 */
function analyzeStyleMatchup(params = {}) {
  const homeTarget = params.homeName || params.homeTeamId || params.homeId;
  const awayTarget = params.awayName || params.awayTeamId || params.awayId;

  const homeTags = getTeamStyleTags(homeTarget);
  const awayTags = getTeamStyleTags(awayTarget);

  const counterAdvantages = [];

  // Rule 1: counter_fast vs possession
  if (homeTags.includes('counter_fast') && awayTags.includes('possession')) {
    counterAdvantages.push({
      favored: 'home',
      rule: 'counter_vs_possession',
      description: {
        zh: '防反极速克制高位控球：快速反击易针对控球方防线身后留空',
        en: 'Fast counters exploit space behind high possession defensive line'
      }
    });
  } else if (awayTags.includes('counter_fast') && homeTags.includes('possession')) {
    counterAdvantages.push({
      favored: 'away',
      rule: 'counter_vs_possession',
      description: {
        zh: '防反极速克制高位控球：快速反击易针对控球方防线身后留空',
        en: 'Fast counters exploit space behind high possession defensive line'
      }
    });
  }

  // Rule 2: low_block vs possession without crossing
  if (homeTags.includes('low_block') && awayTags.includes('possession') && !awayTags.includes('crossing')) {
    counterAdvantages.push({
      favored: 'home',
      rule: 'lowblock_vs_possession',
      description: {
        zh: '铁桶防守限制地面传控：低位防线易迫使纯控球方进攻受阻',
        en: 'Low block restricts ground penetration of possession-only attacks'
      }
    });
  } else if (awayTags.includes('low_block') && homeTags.includes('possession') && !homeTags.includes('crossing')) {
    counterAdvantages.push({
      favored: 'away',
      rule: 'lowblock_vs_possession',
      description: {
        zh: '铁桶防守限制地面传控：低位防线易迫使纯控球方进攻受阻',
        en: 'Low block restricts ground penetration of possession-only attacks'
      }
    });
  }

  if (counterAdvantages.length === 0) {
    return {
      status: 'normal',
      label: { zh: '常规对决', en: 'Standard Matchup' },
      homeTags,
      awayTags,
      counterAdvantages: []
    };
  }

  return {
    status: 'countered',
    label: { zh: '战术打法相克', en: 'Tactical Counter Matchup' },
    homeTags,
    awayTags,
    counterAdvantages
  };
}

/**
 * Builds dedicated styleMatchup section (KO-12)
 * Does NOT hijack familiarity.
 */
function buildStyleMatchupSection(params = {}) {
  const styleMatchup = analyzeStyleMatchup(params);
  if (styleMatchup.homeTags.length === 0 && styleMatchup.awayTags.length === 0) {
    return null;
  }
  const isLowCoverage = (styleMatchup.homeTags.length === 0 || styleMatchup.awayTags.length === 0);

  return {
    confidence: isLowCoverage ? 'low' : 'medium',
    source: 'tactical-style-matrix',
    usedInModel: false,
    ...styleMatchup
  };
}

module.exports = {
  STYLE_TAG_LABELS,
  TEAM_STYLE_TAGS,
  getTeamStyleTags,
  analyzeStyleMatchup,
  buildStyleMatchupSection,
};
