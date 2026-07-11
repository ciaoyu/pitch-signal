'use strict';

/**
 * Owner G: Controlled Odds Snapshot Collector Job (manual/CLI use only)
 *
 * The automatic collection path now lives in lib/services/odds-milestone.js,
 * driven by lib/match-snapshot-scheduler.js's restart-safe tick loop — it fires
 * exactly once per (match, milestone) pair against the real kickoff schedule,
 * with no unconditional background polling. This module is kept only for
 * scripts/run-odds-collector.js (manual/debug CLI invocation) and its tests;
 * start() no longer registers a timer.
 *
 * 1. Permanent Archival & Dual Devigging: Archives full bookmaker response, raw decimal odds, and dual devigged
 *    probabilities (proportional & Shin) without historical slice(-200) truncation.
 * 2. Cost: single region + single market (h2h is the only market any consumer
 *    reads) — 1 credit per call, not the previous 2 regions x 3 markets = 6.
 */

const fs = require('fs');
const path = require('path');
const { fetchJSON } = require('../../services/espn');
const { recordStart, recordSuccess, recordError, recordStop } = require('./registry');
const MarketShadowLedger = require('../services/market-shadow-ledger');

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
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${encodeURIComponent(ODDS_API_KEY)}&regions=eu&markets=h2h&oddsFormat=decimal`;
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
      // No automatic timer: milestone-driven collection now runs from
      // lib/services/odds-milestone.js via the match-snapshot scheduler.
      // This job stays registered only so scripts/run-odds-collector.js and
      // its tests can still call collectOdds() directly.
      return false;
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
