'use strict';

/**
 * T14: Odds Snapshot Collector Job
 * Extracted from server.js — collects odds data every 5 minutes.
 */

const fs = require('fs');
const path = require('path');

const { fetchJSON } = require('../../services/espn');
const { recordStart, recordSuccess, recordError, recordStop } = require('./registry');

const ODDS_INTERVAL_MS = 300000; // 5 minutes

/**
 * Create the odds snapshot collector job
 * @param {Object} deps - Dependencies
 * @param {string} deps.dataDir - Data directory path
 * @returns {Object} Job with start/stop methods
 */
function createOddsCollectorJob(deps) {
  let interval = null;

  async function collectOdds() {
    const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
    if (!ODDS_API_KEY) return;

    recordStart('odds-collector');
    try {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?regions=uk,eu&markets=h2h,spreads,totals&oddsFormat=decimal`;
      const oddsData = await fetchJSON(oddsUrl, { headers: { 'x-api-key': ODDS_API_KEY } });

      if (!Array.isArray(oddsData)) {
        recordError('odds-collector', new Error('Odds data is not an array'));
        return;
      }

      const { dataDir } = deps;
      const ts = new Date().toISOString();
      for (const game of oddsData) {
        const key = `${game.home_team}_vs_${game.away_team}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const histFile = path.join(dataDir, `odds_${key}.json`);

        // Read existing history
        let history = { match: `${game.home_team} vs ${game.away_team}`, snapshots: [] };
        try { history = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch { history = []; console.debug('odds-collector: failed to parse history file, starting fresh'); }

        // Extract current odds
        const bm = game.bookmakers?.[0];
        const h2h = bm?.markets?.find(m => m.key === 'h2h');
        const snapshot = {
          ts,
          bookmaker: bm?.title || '?',
          homeWin: h2h?.outcomes?.find(o => o.name === game.home_team)?.price || null,
          draw: h2h?.outcomes?.find(o => o.name === 'Draw')?.price || null,
          awayWin: h2h?.outcomes?.find(o => o.name !== game.home_team && o.name !== 'Draw')?.price || null,
        };

        history.snapshots.push(snapshot);
        // Keep last 200 snapshots (~16 hours at 5min intervals)
        if (history.snapshots.length > 200) history.snapshots = history.snapshots.slice(-200);

        fs.writeFileSync(histFile, JSON.stringify(history, null, 2));
      }
      console.log(`📊 Odds snapshot saved: ${oddsData.length} games`);
      recordSuccess('odds-collector');
    } catch (e) {
      console.log('Odds snapshot error:', e.message);
      recordError('odds-collector', e);
    }
  }

  return {
    start() {
      interval = setInterval(collectOdds, ODDS_INTERVAL_MS);
      // Don't keep process alive just for this
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
  };
}

module.exports = { createOddsCollectorJob };
