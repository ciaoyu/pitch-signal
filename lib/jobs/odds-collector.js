'use strict';

/**
 * Owner G: Controlled Odds Snapshot Collector Job
 *
 * Replaced blind 5-minute unconditional polling with:
 * 1. API Quota Control: Enforces daily budget limits and pauses API calls when quota is exhausted.
 * 2. Milestone Snapshots: Prioritizes snapshots at key match lifecycle milestones (Opening, T-24h, Post-Lineup/T-1h, Closing/Kickoff).
 * 3. Permanent Archival & Dual Devigging: Archives full bookmaker response, raw decimal odds, and dual devigged
 *    probabilities (proportional & Shin) without historical slice(-200) truncation.
 */

const fs = require('fs');
const path = require('path');
const { fetchJSON } = require('../../services/espn');
const { recordStart, recordSuccess, recordError, recordStop } = require('./registry');
const MarketShadowLedger = require('../services/market-shadow-ledger');

// Configurable polling interval (default 1 hour instead of blind 5-minute polling)
const ODDS_INTERVAL_MS = Number(process.env.ODDS_COLLECTION_INTERVAL_MS) || 3600000;
const MAX_DAILY_CALLS = Number(process.env.ODDS_MAX_DAILY_CALLS) || 24;
const MAX_MILESTONE_CALLS = Number(process.env.ODDS_MAX_MILESTONE_CALLS) || 16;
const REGISTERED_MILESTONES = ['OPENING_LINE', 'T_MINUS_24H', 'LINEUP_ANNOUNCED', 'PRE_KICKOFF'];

let dailyCalls = 0;
let regularCalls = 0;
let milestoneCalls = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

/**
 * Create the odds snapshot collector job
 * @param {Object} deps - Dependencies
 * @param {string} deps.dataDir - Data directory path
 * @returns {Object} Job with start/stop methods
 */
function createOddsCollectorJob(deps) {
  let interval = null;

  async function collectOdds(options = {}) {
    const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY || '';
    if (!ODDS_API_KEY) {
      return { status: 'unavailable', reason: 'Missing THE_ODDS_API_KEY' };
    }

    // Check daily quota unless force milestone snapshot is requested
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastResetDate) {
      dailyCalls = 0;
      regularCalls = 0;
      milestoneCalls = 0;
      lastResetDate = today;
    }

    const isRegisteredMilestone = options.milestone && REGISTERED_MILESTONES.includes(options.milestone);
    if (options.force && !isRegisteredMilestone) {
      return {
        status: 'quota_exhausted',
        reason: 'force:true requires a registered milestone type (OPENING_LINE, T_MINUS_24H, LINEUP_ANNOUNCED, PRE_KICKOFF) to bypass standard quota',
        dailyCalls,
        maxDailyCalls: MAX_DAILY_CALLS
      };
    }

    if (isRegisteredMilestone) {
      if (milestoneCalls >= MAX_MILESTONE_CALLS) {
        return {
          status: 'quota_exhausted',
          reason: `Milestone quota exhausted (${milestoneCalls}/${MAX_MILESTONE_CALLS})`,
          dailyCalls,
          milestoneCalls
        };
      }
    } else if (regularCalls >= MAX_DAILY_CALLS) {
      const quotaMsg = `Odds collector quota exhausted (${regularCalls}/${MAX_DAILY_CALLS} daily calls). Skipping non-milestone collection.`;
      console.log(`⏸️ ${quotaMsg}`);
      return { status: 'quota_exhausted', dailyCalls, regularCalls, maxDailyCalls: MAX_DAILY_CALLS };
    }

    recordStart('odds-collector');
    try {
      dailyCalls++;
      if (isRegisteredMilestone) {
        milestoneCalls++;
      } else {
        regularCalls++;
      }
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${encodeURIComponent(ODDS_API_KEY)}&regions=uk,eu&markets=h2h,spreads,totals&oddsFormat=decimal`;
      const oddsData = await fetchJSON(oddsUrl);

      if (!Array.isArray(oddsData)) {
        recordError('odds-collector', new Error('Odds data is not an array'));
        return { status: 'error', reason: 'Invalid API response structure' };
      }

      const { dataDir } = deps;
      let recordedCount = 0;

      for (const game of oddsData) {
        const matchKey = `${game.home_team}_vs_${game.away_team}`;
        const bm = game.bookmakers?.[0];
        const h2h = bm?.markets?.find(m => m.key === 'h2h');

        if (!h2h || !h2h.outcomes) continue;

        const homeWin = h2h.outcomes.find(o => o.name === game.home_team)?.price;
        const draw = h2h.outcomes.find(o => o.name === 'Draw')?.price;
        const awayWin = h2h.outcomes.find(o => o.name !== game.home_team && o.name !== 'Draw')?.price;

        if (!homeWin || !draw || !awayWin) continue;

        MarketShadowLedger.recordSnapshot({
          matchKey,
          kickoffTime: game.commence_time || null,
          bookmaker: bm.title || 'consensus',
          odds: { homeWin, draw, awayWin },
          rawResponse: game,
          milestone: options.milestone || null,
          dataDir
        });
        recordedCount++;
      }

      console.log(`📊 Odds snapshot saved: ${recordedCount} games (Daily calls: ${dailyCalls}/${MAX_DAILY_CALLS})`);
      recordSuccess('odds-collector');
      return {
        status: 'success',
        recordedCount,
        dailyCalls,
        auditCounts: { regularCalls, milestoneCalls, totalCalls: dailyCalls }
      };
    } catch (e) {
      console.log('Odds snapshot error:', e.message);
      recordError('odds-collector', e);
      return { status: 'error', reason: e.message };
    }
  }

  return {
    start() {
      interval = setInterval(collectOdds, ODDS_INTERVAL_MS);
      if (interval.unref) interval.unref();
      return true;
    },

    stop() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      recordStop('odds-collector');
    },

    collectOdds,
    getQuotaStatus() {
      return { dailyCalls, regularCalls, milestoneCalls, maxDailyCalls: MAX_DAILY_CALLS, remaining: Math.max(0, MAX_DAILY_CALLS - regularCalls) };
    }
  };
}

module.exports = { createOddsCollectorJob };
