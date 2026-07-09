const { createLogger } = require('./logger');
const logger = createLogger('team_resolver');
/**
 * Team Resolver - Global team name resolver
 * 
 * Solves asymmetry across ESPN, The Odds API, and ratings.json team names
 * Supports exact matching + Levenshtein fuzzy matching
 * 
 * Performance optimizations:
 * - Length difference check (skips candidates with excessive length difference)
 * - Early exit condition (stops when distance exceeds threshold)
 * - Query result cache (LRU cache for frequent queries)
 */

const fs = require('fs');
const path = require('path');


// LRU cache implementation (simple version)
class LRUCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Delete oldest entry (first entry in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.clear();
  }
}

class TeamResolver {
  constructor() {
    this.idMap = null;
    this.reverseMap = null; // espn_id -> ratings_id
    this.initialized = false;
    this.resolveCache = new LRUCache(500); // Cache resolution results
  }

  /**
   * Initialize: load id_map_center.json and build reverse mapping
   */
  init() {
    if (this.initialized) return;
    
    try {
      const mapPath = path.join(__dirname, '..', 'data', 'id_map_center.json');
      this.idMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      
      // Build reverse mapping: espn_id -> ratings_id
      this.reverseMap = {};
      for (const [ratingsId, entry] of Object.entries(this.idMap)) {
        if (entry.espn_id) {
          this.reverseMap[entry.espn_id] = ratingsId;
        }
      }
      
      this.initialized = true;
      logger.info(`✅ TeamResolver initialized: ${Object.keys(this.idMap).length} teams mapped`);
    } catch (e) {
      logger.error('❌ TeamResolver init failed:', { error: e.message });
      this.idMap = {};
      this.reverseMap = {};
      this.initialized = true;
    }
  }

  /**
   * Exact match: lookup team by any name
   * @param {string} name - Team name (can be ratings_id, espn_id, the_odds_name, zh_name)
   * @returns {object|null} - Mapping object or null (contains ratings_id field)
   */
  resolve(name) {
    if (!this.initialized) this.init();
    if (!name) return null;
    
    // Check cache
    const cacheKey = `resolve:${name}`;
    const cached = this.resolveCache.get(cacheKey);
    if (cached) return cached;
    
    const nameLower = name.toLowerCase();

    // 1. Direct match on ratings_id
    if (this.idMap[name]) {
      const result = { ratings_id: name, ...this.idMap[name], matchedBy: 'ratings_id', confidence: 1.0 };
      this.resolveCache.set(cacheKey, result);
      return result;
    }

    // 2. Match espn_id
    if (this.reverseMap[name]) {
      const ratingsId = this.reverseMap[name];
      const result = { ratings_id: ratingsId, ...this.idMap[ratingsId], matchedBy: 'espn_id', confidence: 1.0 };
      this.resolveCache.set(cacheKey, result);
      return result;
    }

    // 3. Match the_odds_name
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      if (entry.the_odds_name && entry.the_odds_name.toLowerCase() === nameLower) {
        const result = { ratings_id: ratingsId, ...entry, matchedBy: 'the_odds_name', confidence: 1.0 };
        this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // 4. Match zh_name
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      if (entry.zh_name && entry.zh_name === name) {
        const result = { ratings_id: ratingsId, ...entry, matchedBy: 'zh_name', confidence: 1.0 };
        this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // 4.5. Match aliases
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      if (entry.aliases && entry.aliases.some(alias => alias.toLowerCase() === nameLower)) {
        const result = { ratings_id: ratingsId, ...entry, matchedBy: 'alias', confidence: 1.0 };
        this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // 5. Fuzzy match (Levenshtein distance)
    const fuzzyResult = this.fuzzyResolve(name);
    if (fuzzyResult) {
      this.resolveCache.set(cacheKey, fuzzyResult);
      return fuzzyResult;
    }

    // 6. Partial match (substring inclusion) - prefer shorter candidate names
    let bestPartial = null;
    let bestPartialScore = 0;
    
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      const candidates = [ratingsId, entry.official_name, entry.the_odds_name, entry.zh_name].filter(Boolean);
      for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        
        // Full inclusion
        if (candidateLower.includes(nameLower) || nameLower.includes(candidateLower)) {
          // Calculate match score: closer matches score higher
          const score = nameLower.length / candidateLower.length;
          if (score > bestPartialScore) {
            bestPartialScore = score;
            bestPartial = { ratings_id: ratingsId, ...entry, matchedBy: 'partial', confidence: Math.min(0.9, 0.7 + score * 0.2) };
          }
        }
      }
    }
    
    if (bestPartial) {
      this.resolveCache.set(cacheKey, bestPartial);
      return bestPartial;
    }

    // Cache null result (avoid duplicate queries)
    this.resolveCache.set(cacheKey, null);
    return null;
  }

  /**
   * Fuzzy match: lookup most similar team using Levenshtein distance
   * Performance optimizations:
   * - Length difference check (skips candidates with excessive length difference)
   * - Early exit condition (stops when distance exceeds threshold)
   * 
   * @param {string} name - Team name
   * @returns {object|null} - Best match or null
   */
  fuzzyResolve(name) {
    if (!name || name.length < 3) return null;

    // Check cache
    const cacheKey = `fuzzy:${name}`;
    const cached = this.resolveCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let bestMatch = null;
    let bestDistance = Infinity;
    let bestConfidence = 0;
    const nameLower = name.toLowerCase();
    const nameLen = nameLower.length;
    
    // Maximum allowed distance: 40% of name length (at least 2)
    const maxAllowedDistance = Math.max(2, Math.floor(nameLen * 0.4));

    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      // Compare all possible names
      const candidates = [
        ratingsId,
        entry.official_name,
        entry.the_odds_name,
        entry.zh_name
      ].filter(Boolean);

      for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        const candidateLen = candidateLower.length;
        
        // Length difference check: skip candidates with excessive length difference
        const lengthDiff = Math.abs(nameLen - candidateLen);
        if (lengthDiff > maxAllowedDistance) continue;
        
        // Early exit: skip if length difference already exceeds current best distance
        if (lengthDiff >= bestDistance) continue;

        const distance = this.levenshtein(nameLower, candidateLower);
        
        // Early exit: skip if distance already exceeds maximum allowed distance
        if (distance > maxAllowedDistance) continue;
        
        const maxLen = Math.max(nameLen, candidateLen);
        const confidence = 1 - (distance / maxLen);

        if (distance < bestDistance && confidence > 0.6) {
          bestDistance = distance;
          bestMatch = { ratings_id: ratingsId, ...entry, matchedBy: 'fuzzy', confidence: Math.round(confidence * 100) / 100 };
          bestConfidence = confidence;
          
          // Early exit if perfect match found (distance 0)
          if (distance === 0) break;
        }
      }
      
      // Early exit outer loop if perfect match found
      if (bestDistance === 0) break;
    }

    // Cache result
    this.resolveCache.set(cacheKey, bestMatch);
    return bestMatch;
  }

  /**
   * Levenshtein distance algorithm (with early exit optimization)
   * 
   * @param {string} a - First string
   * @param {string} b - Second string
   * @param {number} [maxDistance=Infinity] - Maximum allowed distance (exits early if exceeded)
   * @returns {number} Edit distance
   */
  levenshtein(a, b, maxDistance = Infinity) {
    // Directly return maxDistance + 1 if length difference exceeds maxDistance
    if (Math.abs(a.length - b.length) > maxDistance) {
      return maxDistance + 1;
    }
    
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
        rowMin = Math.min(rowMin, matrix[i][j]);
      }
      
      // Early exit: return early if minimum value of current row exceeds maxDistance
      if (rowMin > maxDistance) {
        return maxDistance + 1;
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Extension: load 2026 World Cup team mapping from id_bridge.json
   * Append to idMap and reverseMap (without overwriting existing entries)
   */
  extendWithBridge(bridgeData) {
    if (!this.initialized) this.init();
    if (!bridgeData || typeof bridgeData !== 'object') return;
    let added = 0;
    for (const [fifaCode, entry] of Object.entries(bridgeData)) {
      const officialName = entry.name_official;
      if (!officialName) continue;
      // Do not overwrite existing entries in id_map
      if (this.idMap[officialName]) continue;
      // Build entry compatible with id_map_center
      const bridgeEntry = {
        official_name: officialName,
        zh_name: entry.name_zh || officialName,
        flag: '', // id_bridge has no flag
        from: 'id_bridge',
        group: entry.group || '',
        ranking: entry.ranking || null,
      };
      this.idMap[officialName] = bridgeEntry;
      if (entry.espn_id) {
        this.idMap[officialName].espn_id = entry.espn_id;
        if (!this.reverseMap[entry.espn_id]) {
          this.reverseMap[entry.espn_id] = officialName;
        }
      }
      added++;
    }
    logger.info(`🔗 TeamResolver extended with id_bridge: ${added} new teams`);
  }

  /**
   * Get ratings_id by ESPN ID
   */
  getRatingsIdByEspnId(espnId) {
    if (!this.initialized) this.init();
    return this.reverseMap[espnId] || null;
  }

  /**
   * Get ESPN ID by ratings_id
   */
  getEspnIdByRatingsId(ratingsId) {
    if (!this.initialized) this.init();
    const entry = this.idMap[ratingsId];
    return entry ? entry.espn_id : null;
  }

  /**
   * Get all teams list
   */
  getAllTeams() {
    if (!this.initialized) this.init();
    return Object.entries(this.idMap).map(([ratingsId, entry]) => ({
      ratings_id: ratingsId,
      ...entry
    }));
  }

  /**
   * Batch resolve: resolve two team names (for match lookup)
   */
  resolveMatch(homeTeam, awayTeam) {
    const home = this.resolve(homeTeam);
    const away = this.resolve(awayTeam);
    
    return {
      home: home,
      away: away,
      bothResolved: home && away,
      confidence: home && away ? Math.min(home.confidence, away.confidence) : 0
    };
  }
}

// Singleton export
const resolver = new TeamResolver();
module.exports = resolver;
