/**
 * Roster Cache Manager - Team roster cache manager
 * 
 * Resolves empty ESPN Roster return issue
 * Strategy: ESPN -> Local cache -> BallDontLie -> Structured fallback
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
   * Initialize: load local cache
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
   * Save cache to file
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
   * Get team roster (with cache)
   * @param {string} teamId - ESPN team ID
   * @param {Function} fetchFn - ESPN fetch function
   * @returns {object} - { roster, source, cached }
   */
  async getRoster(teamId, fetchFn) {
    this.init();

    // 1. Try ESPN API
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
        // ESPN has data, update memory cache (do not write to file to avoid write side effects on GET endpoints)
        this.cache[teamId] = {
          roster,
          source: 'espn',
          lastUpdated: new Date().toISOString(),
          playerCount: roster.length
        };
        // T04: Remove file write from GET endpoint; write should be done by scheduled task or explicit save() call
        
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

    // 2. No ESPN data, try local cache
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

    // 3. No cache, return structured fallback response
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
   * Get cache statistics
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
   * Clear cache
   */
  clear() {
    this.cache = {};
    this.save();
    console.log('🗑️ Roster cache cleared');
  }

  /**
   * Batch preload (fetch multiple team rosters from ESPN)
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
        // Avoid requesting too fast
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        failed++;
      }
    }
    
    console.log(`Preload complete: ${loaded} loaded, ${failed} failed`);
    return { loaded, failed };
  }
}

// Singleton export
const rosterCache = new RosterCache();
module.exports = rosterCache;
