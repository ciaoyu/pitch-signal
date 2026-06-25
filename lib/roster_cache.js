/**
 * Roster Cache Manager - 球队阵容缓存管理器
 * 
 * 解决 ESPN Roster 返回空的问题
 * 策略：ESPN → 本地缓存 → BallDontLie → 结构化降级
 */

const fs = require('fs');
const path = require('path');

class RosterCache {
  constructor() {
    this.cachePath = path.join(__dirname, '..', 'data', 'roster_cache.json');
    this.cache = {};
    this.initialized = false;
  }

  /**
   * 初始化：加载本地缓存
   */
  init() {
    if (this.initialized) return;
    
    try {
      if (fs.existsSync(this.cachePath)) {
        this.cache = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        const teamCount = Object.keys(this.cache).length;
        const playerCount = Object.values(this.cache).reduce((sum, r) => sum + (r.roster?.length || 0), 0);
        console.log(`📋 Roster cache loaded: ${teamCount} teams, ${playerCount} players`);
      } else {
        console.log('📋 No roster cache found, will create on first fetch');
        this.cache = {};
      }
    } catch (e) {
      console.error('❌ Roster cache load failed:', e.message);
      this.cache = {};
    }
    
    this.initialized = true;
  }

  /**
   * 保存缓存到文件
   */
  save() {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
      console.log(`💾 Roster cache saved: ${Object.keys(this.cache).length} teams`);
    } catch (e) {
      console.error('❌ Roster cache save failed:', e.message);
    }
  }

  /**
   * 获取球队阵容（带缓存）
   * @param {string} teamId - ESPN 球队 ID
   * @param {Function} fetchFn - ESPN 获取函数
   * @returns {object} - { roster, source, cached }
   */
  async getRoster(teamId, fetchFn) {
    this.init();

    // 1. 尝试 ESPN API
    try {
      const r = await fetchFn(`/teams/${teamId}/roster`, `roster_${teamId}`, 600000);
      const roster = (r?.athletes || []).map(p => ({
        id: p.id || '',
        name: p.displayName || '',
        pos: p.position?.abbreviation || '',
        jersey: p.jersey || '',
        age: p.age || null,
        height: p.displayHeight || '',
        nationality: p.citizenship || '',
      }));

      if (roster.length > 0) {
        // ESPN 有数据，更新内存缓存（不写入文件，避免GET端点的写操作副作用）
        this.cache[teamId] = {
          roster,
          source: 'espn',
          lastUpdated: new Date().toISOString(),
          playerCount: roster.length
        };
        // T04: 移除GET端点的文件写入，写入应由定时任务或显式调用save()完成
        
        return {
          roster,
          source: 'espn',
          cached: false,
          playerCount: roster.length
        };
      }
    } catch (e) {
      console.log(`ESPN roster fetch failed for ${teamId}:`, e.message);
    }

    // 2. ESPN 无数据，尝试本地缓存
    if (this.cache[teamId] && this.cache[teamId].roster?.length > 0) {
      console.log(`Using cached roster for ${teamId} (${this.cache[teamId].roster.length} players)`);
      return {
        roster: this.cache[teamId].roster,
        source: 'cache',
        cached: true,
        playerCount: this.cache[teamId].roster.length,
        lastUpdated: this.cache[teamId].lastUpdated
      };
    }

    // 3. 无缓存，返回结构化降级响应
    console.log(`No roster data for ${teamId}, returning empty with dataQuality marker`);
    return {
      roster: [],
      source: 'unavailable',
      cached: false,
      playerCount: 0,
      dataQuality: 'unavailable',
      _note: '球队阵容数据暂不可用，请稍后再试'
    };
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    this.init();
    
    const teams = Object.keys(this.cache).length;
    const players = Object.values(this.cache).reduce((sum, r) => sum + (r.roster?.length || 0), 0);
    const sources = {};
    
    for (const [teamId, entry] of Object.entries(this.cache)) {
      const source = entry.source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    }
    
    return { teams, players, sources };
  }

  /**
   * 清除缓存
   */
  clear() {
    this.cache = {};
    this.save();
    console.log('🗑️ Roster cache cleared');
  }

  /**
   * 批量预加载（从 ESPN 获取多支球队阵容）
   */
  async preload(teamIds, fetchFn) {
    this.init();
    
    console.log(`Preloading roster for ${teamIds.length} teams...`);
    let loaded = 0;
    let failed = 0;
    
    for (const teamId of teamIds) {
      try {
        const result = await this.getRoster(teamId, fetchFn);
        if (result.source === 'espn' && result.playerCount > 0) {
          loaded++;
        } else {
          failed++;
        }
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        failed++;
      }
    }
    
    console.log(`Preload complete: ${loaded} loaded, ${failed} failed`);
    return { loaded, failed };
  }
}

// 单例导出
const rosterCache = new RosterCache();
module.exports = rosterCache;
