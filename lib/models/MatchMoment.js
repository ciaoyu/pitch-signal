/**
 * MatchMoment data model
 * Represents a significant moment in a match with structured data
 */

// Moment categories
const MOMENT_CATEGORIES = [
  'goal',
  'own_goal',
  'penalty_scored',
  'penalty_missed',
  'penalty_awarded',
  'red_card',
  'yellow_card',
  'var_decision',
  'substitution',
  'injury',
  'save',
  'woodwork',
  'other',
];

// Significance levels
const SIGNIFICANCE_LEVELS = ['routine', 'notable', 'critical', 'decisive'];

// Source types
const SOURCE_TYPES = ['espn', 'csv', 'synthetic', 'inferred'];

/**
 * Create a MatchMoment object with defaults and validation
 * @param {Object} data - Raw moment data
 * @returns {Object} - Validated MatchMoment
 */
function createMatchMoment(data = {}) {
  const moment = {
    // Identity
    id: data.id || `${data.matchId || 'unknown'}_${data.minute || 0}_${data.category || 'other'}_${Date.now()}`,
    matchId: data.matchId || null,
    
    // Timing
    minute: typeof data.minute === 'number' ? data.minute : parseMinute(data.minute),
    period: data.period || inferPeriod(data.minute),
    
    // Classification
    category: MOMENT_CATEGORIES.includes(data.category) ? data.category : 'other',
    isSwingMoment: typeof data.isSwingMoment === 'boolean' ? data.isSwingMoment : false,
    
    // Content
    text: normalizeI18n(data.text),
    detail: normalizeI18n(data.detail),
    
    // Team & Players
    teamId: data.teamId || null,
    teamSide: data.teamSide || null,
    playerId: data.playerId || null,
    playerName: data.playerName || null,
    playerNameI18n: normalizeI18n(data.playerNameI18n),
    assistPlayerId: data.assistPlayerId || null,
    assistPlayerName: data.assistPlayerName || null,
    
    // Score Context
    scoreBefore: data.scoreBefore || null,
    scoreAfter: data.scoreAfter || null,
    
    // Significance
    significance: SIGNIFICANCE_LEVELS.includes(data.significance) ? data.significance : 'routine',
    
    // Data Quality
    source: SOURCE_TYPES.includes(data.source) ? data.source : 'inferred',
    confidence: typeof data.confidence === 'number' ? Math.min(1, Math.max(0, data.confidence)) : 0.5,
    
    // Review Impact (optional)
    reviewImpact: data.reviewImpact || null,
  };
  
  return moment;
}

/**
 * Determine if a moment is a swing moment based on rules
 * @param {Object} moment - MatchMoment object
 * @returns {boolean}
 */
function determineIsSwingMoment(moment) {
  // Goal that changes the lead
  if (moment.category === 'goal' || moment.category === 'penalty_scored') {
    const before = moment.scoreBefore;
    const after = moment.scoreAfter;
    if (before && after) {
      const leadBefore = before.home - before.away;
      const leadAfter = after.home - after.away;
      // Lead changed or equalizer
      if (Math.sign(leadBefore) !== Math.sign(leadAfter) || leadBefore === 0 || leadAfter === 0) {
        return true;
      }
    }
    // Late goal (85+)
    if (moment.minute >= 85) {
      return true;
    }
  }
  
  // Red card
  if (moment.category === 'red_card') {
    return true;
  }
  
  // Penalty awarded
  if (moment.category === 'penalty_awarded') {
    return true;
  }
  
  // Own goal
  if (moment.category === 'own_goal') {
    return true;
  }
  
  return false;
}

/**
 * Determine significance level
 * @param {Object} moment - MatchMoment object
 * @returns {string} - significance level
 */
function determineSignificance(moment) {
  if (moment.isSwingMoment) {
    // Late winner or decisive goal
    if (moment.category === 'goal' && moment.minute >= 85) {
      return 'decisive';
    }
    // Red card, penalty goal, equalizer
    if (['red_card', 'penalty_scored', 'own_goal'].includes(moment.category)) {
      return 'critical';
    }
    return 'notable';
  }
  
  // Routine events
  if (['yellow_card', 'substitution', 'other'].includes(moment.category)) {
    return 'routine';
  }
  
  return 'routine';
}

/**
 * Infer period from minute
 * @param {number|string} minute
 * @returns {string}
 */
function inferPeriod(minute) {
  const min = parseMinute(minute);
  if (min === null) return '1H';
  if (min <= 45) return '1H';
  if (min <= 90) return '2H';
  if (min <= 105) return 'ET1';
  if (min <= 120) return 'ET2';
  return 'PK';
}

/**
 * Parse minute value to integer
 * @param {string|number} minute
 * @returns {number|null}
 */
function parseMinute(minute) {
  if (typeof minute === 'number') return minute;
  const match = String(minute || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

/**
 * Normalize i18n object
 * @param {Object|string} value
 * @returns {Object|null}
 */
function normalizeI18n(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return { zh: value, en: value };
  }
  if (typeof value === 'object') {
    return {
      zh: value.zh || value.en || '',
      en: value.en || value.zh || '',
    };
  }
  return null;
}

/**
 * Create a moment from an ESPN event
 * @param {Object} event - ESPN event object
 * @param {Object} context - Match context (matchId, teams, score)
 * @returns {Object} - MatchMoment
 */
function fromESPNEvent(event, context = {}) {
  const category = mapESPNTypeToCategory(event.type);
  const minute = parseMinute(event.minute || event.time?.displayValue);
  const teamSide = event.homeAway || null;
  
  // Extract player info from text if not in event
  const playerName = event.athlete?.displayName || extractPlayerFromText(event.text);
  
  const moment = createMatchMoment({
    matchId: context.matchId,
    minute,
    category,
    text: event.text || event.description,
    teamId: event.team?.id || context[`${teamSide}Id`],
    teamSide,
    playerId: event.athlete?.id,
    playerName,
    source: 'espn',
    confidence: 0.9,
    scoreBefore: context.scoreBefore,
    scoreAfter: context.scoreAfter,
  });
  
  // Determine swing and significance
  moment.isSwingMoment = determineIsSwingMoment(moment);
  moment.significance = determineSignificance(moment);
  
  return moment;
}

/**
 * Map ESPN event type to moment category
 * @param {Object|string} type
 * @returns {string}
 */
function mapESPNTypeToCategory(type) {
  const typeName = typeof type === 'object' ? type.name || type.text : type;
  const normalized = String(typeName || '').toLowerCase();
  
  if (normalized.includes('goal') && !normalized.includes('own')) return 'goal';
  if (normalized.includes('own')) return 'own_goal';
  if (normalized.includes('penalty') && normalized.includes('miss')) return 'penalty_missed';
  if (normalized.includes('penalty') && normalized.includes('score')) return 'penalty_scored';
  if (normalized.includes('penalty')) return 'penalty_awarded';
  if (normalized.includes('red') || normalized.includes('sending off')) return 'red_card';
  if (normalized.includes('yellow')) return 'yellow_card';
  if (normalized.includes('var')) return 'var_decision';
  if (normalized.includes('substitution') || normalized.includes('sub')) return 'substitution';
  if (normalized.includes('injury')) return 'injury';
  if (normalized.includes('save')) return 'save';
  if (normalized.includes('post') || normalized.includes('crossbar') || normalized.includes('woodwork')) return 'woodwork';
  
  return 'other';
}

/**
 * Extract player name from event text
 * @param {string} text
 * @returns {string|null}
 */
function extractPlayerFromText(text) {
  if (!text) return null;
  // Common patterns: "Player Name (assist by...)", "Player Name scores..."
  const patterns = [
    /^([A-Z][a-z]+ [A-Z][a-z]+)/, // "First Last"
    /([A-Z][a-z]+ [A-Z][a-z]+)\s*(scores|heads|shoots|fouls|receives)/i,
    /([A-Z][a-z]+ [A-Z][a-z]+)\s*\(/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

module.exports = {
  MOMENT_CATEGORIES,
  SIGNIFICANCE_LEVELS,
  SOURCE_TYPES,
  createMatchMoment,
  determineIsSwingMoment,
  determineSignificance,
  inferPeriod,
  parseMinute,
  normalizeI18n,
  fromESPNEvent,
  mapESPNTypeToCategory,
  extractPlayerFromText,
};