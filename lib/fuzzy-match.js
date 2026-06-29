/**
 * lib/fuzzy-match.js
 * 
 * Provides weighted Levenshtein matching for player identities
 * and derivation of player ratings from raw squad data.
 */

/**
 * Basic Levenshtein distance algorithm
 */
function levenshteinDistance(a, b) {
  const an = a ? a.toLowerCase() : '';
  const bn = b ? b.toLowerCase() : '';
  if (an.length === 0) return bn.length;
  if (bn.length === 0) return an.length;

  const matrix = [];
  for (let i = 0; i <= bn.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn.length; i++) {
    for (let j = 1; j <= an.length; j++) {
      if (bn.charAt(i - 1) === an.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn.length][an.length];
}

/**
 * Normalize strings (remove accents, lowercase)
 */
function normalizeString(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Calculates a match score between a source player (from squad) and target player (from lineup).
 * Weights: Name (0.5), Number (0.3), Position (0.2).
 * 
 * @param {Object} source { name, num, pos }
 * @param {Object} target { name, num, pos }
 * @returns {number} Score between 0 and 1
 */
function calculateMatchScore(source, target) {
  let score = 0;

  // Name similarity (50%)
  const sName = normalizeString(source.name);
  const tName = normalizeString(target.name);
  const maxLen = Math.max(sName.length, tName.length);
  
  if (maxLen > 0) {
    const dist = levenshteinDistance(sName, tName);
    const nameSimilarity = 1 - (dist / maxLen);
    score += nameSimilarity * 0.5;
  }

  // Number match (30%)
  if (source.num !== undefined && target.num !== undefined && source.num !== null && target.num !== null) {
    if (String(source.num) === String(target.num)) {
      score += 0.3;
    }
  }

  // Position match (20%)
  if (source.pos && target.pos) {
    // exact match or substring match (e.g., 'CB' in 'RCB')
    if (source.pos === target.pos || source.pos.includes(target.pos) || target.pos.includes(source.pos)) {
      score += 0.2;
    }
  }

  return score;
}

/**
 * Fuzzy matches a target player against an array of squad players.
 * 
 * @param {Object} targetPlayer { name, num, pos }
 * @param {Array} squadPlayers Array of { name, num, pos, ...otherData }
 * @param {number} threshold Minimum score to accept (default 0.75)
 * @returns {Object|null} Best matching squad player, or null if below threshold
 */
function fuzzyMatchPlayer(targetPlayer, squadPlayers, threshold = 0.75) {
  if (!squadPlayers || !Array.isArray(squadPlayers) || squadPlayers.length === 0) return null;

  let bestMatch = null;
  let highestScore = 0;

  for (const squadPlayer of squadPlayers) {
    const score = calculateMatchScore(squadPlayer, targetPlayer);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = squadPlayer;
    }
  }

  return highestScore >= threshold ? bestMatch : null;
}

/**
 * Derives a player's rating based on caps, wcApps, and club tier.
 * 
 * @param {number} caps National team caps
 * @param {number} wcApps World Cup appearances
 * @param {number} clubTier Tier of the club (1 = elite, 2 = top 5 league standard, 3 = other)
 * @returns {number} Rating from 0 to 99
 */
function derivePlayerRating(caps = 0, wcApps = 0, clubTier = 3) {
  let base = 60;

  // Club tier bonus
  if (clubTier === 1) base += 20;      // Elite club (Real Madrid, Man City, etc)
  else if (clubTier === 2) base += 10; // Mid-table top 5 league
  else if (clubTier === 3) base += 0;  // Other

  // Caps bonus (max 10 points for 50+ caps)
  const capsBonus = Math.min(10, Math.floor(caps / 5));
  base += capsBonus;

  // WC Apps bonus (max 9 points for 15+ wc apps)
  const wcBonus = Math.min(9, Math.floor(wcApps * 0.6));
  base += wcBonus;

  return Math.min(99, Math.max(1, base)); // clamp between 1 and 99
}

/**
 * Map external IDs to internal IDs.
 * 
 * @param {string} externalId 
 * @param {Object} idBridge Mapping object { externalId: internalId }
 * @returns {string} internalId or original if not found
 */
function mapId(externalId, idBridge) {
  if (!idBridge) return externalId;
  return idBridge[externalId] || externalId;
}

module.exports = {
  levenshteinDistance,
  calculateMatchScore,
  fuzzyMatchPlayer,
  derivePlayerRating,
  mapId
};
