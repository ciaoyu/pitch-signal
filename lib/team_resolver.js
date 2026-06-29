/**
 * Team Resolver - 全局球队名称解析器
 * 
 * 解决 ESPN、The Odds API、ratings.json 之间的球队命名不对称问题
 * 支持精确匹配 + Levenshtein 模糊匹配
 * 
 * 性能优化：
 * - 长度差异检查（跳过长度差过大的候选）
 * - 早期退出条件（距离超过阈值时停止）
 * - 查询结果缓存（LRU 缓存常见查询）
 */

const fs = require('fs');
const path = require('path');


// LRU 缓存实现（简单版本）
class LRUCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // 移到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的条目（Map 的第一个条目）
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
    this.resolveCache = new LRUCache(500); // 缓存解析结果
  }

  /**
   * 初始化：加载 id_map_center.json 并构建反向映射
   */
  init() {
    if (this.initialized) return;
    
    try {
      const mapPath = path.join(__dirname, '..', 'data', 'id_map_center.json');
      this.idMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      
      // 构建反向映射：espn_id -> ratings_id
      this.reverseMap = {};
      for (const [ratingsId, entry] of Object.entries(this.idMap)) {
        if (entry.espn_id) {
          this.reverseMap[entry.espn_id] = ratingsId;
        }
      }
      
      this.initialized = true;
      console.log(`✅ TeamResolver initialized: ${Object.keys(this.idMap).length} teams mapped`);
    } catch (e) {
      console.error('❌ TeamResolver init failed:', e.message);
      this.idMap = {};
      this.reverseMap = {};
      this.initialized = true;
    }
  }

  /**
   * 精确匹配：通过任意名称查找球队
   * @param {string} name - 球队名称（可以是 ratings_id、espn_id、the_odds_name、zh_name）
   * @returns {object|null} - 映射对象或 null (包含 ratings_id 字段)
   */
  resolve(name) {
    if (!this.initialized) this.init();
    if (!name) return null;
    
    // 检查缓存
    const cacheKey = `resolve:${name}`;
    const cached = this.resolveCache.get(cacheKey);
    if (cached) return cached;
    
    const nameLower = name.toLowerCase();

    // 1. 直接匹配 ratings_id
    if (this.idMap[name]) {
      const result = { ratings_id: name, ...this.idMap[name], matchedBy: 'ratings_id', confidence: 1.0 };
      this.resolveCache.set(cacheKey, result);
      return result;
    }

    // 2. 匹配 espn_id
    if (this.reverseMap[name]) {
      const ratingsId = this.reverseMap[name];
      const result = { ratings_id: ratingsId, ...this.idMap[ratingsId], matchedBy: 'espn_id', confidence: 1.0 };
      this.resolveCache.set(cacheKey, result);
      return result;
    }

    // 3. 匹配 the_odds_name
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      if (entry.the_odds_name && entry.the_odds_name.toLowerCase() === nameLower) {
        const result = { ratings_id: ratingsId, ...entry, matchedBy: 'the_odds_name', confidence: 1.0 };
        this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // 4. 匹配 zh_name
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      if (entry.zh_name && entry.zh_name === name) {
        const result = { ratings_id: ratingsId, ...entry, matchedBy: 'zh_name', confidence: 1.0 };
        this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // 4.5. 匹配 aliases
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      if (entry.aliases && entry.aliases.some(alias => alias.toLowerCase() === nameLower)) {
        const result = { ratings_id: ratingsId, ...entry, matchedBy: 'alias', confidence: 1.0 };
        this.resolveCache.set(cacheKey, result);
        return result;
      }
    }

    // 5. 模糊匹配（Levenshtein 距离）
    const fuzzyResult = this.fuzzyResolve(name);
    if (fuzzyResult) {
      this.resolveCache.set(cacheKey, fuzzyResult);
      return fuzzyResult;
    }

    // 6. 部分匹配（包含关系）- 优先匹配更短的候选名称
    let bestPartial = null;
    let bestPartialScore = 0;
    
    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      const candidates = [ratingsId, entry.official_name, entry.the_odds_name, entry.zh_name].filter(Boolean);
      for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        
        // 完全包含
        if (candidateLower.includes(nameLower) || nameLower.includes(candidateLower)) {
          // 计算匹配分数：越接近的匹配分数越高
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

    // 缓存 null 结果（避免重复查询）
    this.resolveCache.set(cacheKey, null);
    return null;
  }

  /**
   * 模糊匹配：使用 Levenshtein 距离查找最相似的球队
   * 性能优化：
   * - 长度差异检查（跳过长度差过大的候选）
   * - 早期退出条件（距离超过阈值时停止）
   * 
   * @param {string} name - 球队名称
   * @returns {object|null} - 最佳匹配或 null
   */
  fuzzyResolve(name) {
    if (!name || name.length < 3) return null;

    // 检查缓存
    const cacheKey = `fuzzy:${name}`;
    const cached = this.resolveCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let bestMatch = null;
    let bestDistance = Infinity;
    let bestConfidence = 0;
    const nameLower = name.toLowerCase();
    const nameLen = nameLower.length;
    
    // 最大允许距离：名称长度的 40%（至少为 2）
    const maxAllowedDistance = Math.max(2, Math.floor(nameLen * 0.4));

    for (const [ratingsId, entry] of Object.entries(this.idMap)) {
      // 比较所有可能的名称
      const candidates = [
        ratingsId,
        entry.official_name,
        entry.the_odds_name,
        entry.zh_name
      ].filter(Boolean);

      for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        const candidateLen = candidateLower.length;
        
        // 长度差异检查：跳过长度差过大的候选
        const lengthDiff = Math.abs(nameLen - candidateLen);
        if (lengthDiff > maxAllowedDistance) continue;
        
        // 早期退出：如果长度差已经大于当前最佳距离，跳过
        if (lengthDiff >= bestDistance) continue;

        const distance = this.levenshtein(nameLower, candidateLower);
        
        // 早期退出：如果距离已经超过最大允许距离，跳过
        if (distance > maxAllowedDistance) continue;
        
        const maxLen = Math.max(nameLen, candidateLen);
        const confidence = 1 - (distance / maxLen);

        if (distance < bestDistance && confidence > 0.6) {
          bestDistance = distance;
          bestMatch = { ratings_id: ratingsId, ...entry, matchedBy: 'fuzzy', confidence: Math.round(confidence * 100) / 100 };
          bestConfidence = confidence;
          
          // 如果找到完美匹配（距离为 0），提前退出
          if (distance === 0) break;
        }
      }
      
      // 如果找到完美匹配，提前退出外层循环
      if (bestDistance === 0) break;
    }

    // 缓存结果
    this.resolveCache.set(cacheKey, bestMatch);
    return bestMatch;
  }

  /**
   * Levenshtein 距离算法（带早期退出优化）
   * 
   * @param {string} a - 第一个字符串
   * @param {string} b - 第二个字符串
   * @param {number} [maxDistance=Infinity] - 最大允许距离（超过此值提前退出）
   * @returns {number} 编辑距离
   */
  levenshtein(a, b, maxDistance = Infinity) {
    // 如果长度差超过 maxDistance，直接返回 maxDistance + 1
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
      
      // 早期退出：如果当前行的最小值已经超过 maxDistance，提前返回
      if (rowMin > maxDistance) {
        return maxDistance + 1;
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * 扩展：从 id_bridge.json 加载 2026 世界杯球队映射
   * 追加到 idMap 和 reverseMap（不覆盖已有条目）
   */
  extendWithBridge(bridgeData) {
    if (!this.initialized) this.init();
    if (!bridgeData || typeof bridgeData !== 'object') return;
    let added = 0;
    for (const [fifaCode, entry] of Object.entries(bridgeData)) {
      const officialName = entry.name_official;
      if (!officialName) continue;
      // 不覆盖 id_map 已有条目
      if (this.idMap[officialName]) continue;
      // 构建与 id_map_center 兼容的条目
      const bridgeEntry = {
        official_name: officialName,
        zh_name: entry.name_zh || officialName,
        flag: '', // id_bridge 无 flag
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
    console.log(`🔗 TeamResolver extended with id_bridge: ${added} new teams`);
  }

  /**
   * 通过 ESPN ID 获取 ratings_id
   */
  getRatingsIdByEspnId(espnId) {
    if (!this.initialized) this.init();
    return this.reverseMap[espnId] || null;
  }

  /**
   * 通过 ratings_id 获取 ESPN ID
   */
  getEspnIdByRatingsId(ratingsId) {
    if (!this.initialized) this.init();
    const entry = this.idMap[ratingsId];
    return entry ? entry.espn_id : null;
  }

  /**
   * 获取所有球队列表
   */
  getAllTeams() {
    if (!this.initialized) this.init();
    return Object.entries(this.idMap).map(([ratingsId, entry]) => ({
      ratings_id: ratingsId,
      ...entry
    }));
  }

  /**
   * 批量解析：解析两个球队名称（用于比赛匹配）
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

// 单例导出
const resolver = new TeamResolver();
module.exports = resolver;
