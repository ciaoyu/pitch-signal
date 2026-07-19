const { createLogger } = require('./logger');
const logger = createLogger('schedule_updater');
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Start the background schedule status updater cron.
 * @param {string} dataDir - Directory containing match_snapshot_schedule.json
 * @param {function} espn - ESPN API fetcher service function
 * @param {object} loader - Data loader cache manager
 * @returns {object} - Controller with stop method
 */
function startScheduleUpdater(dataDir, espn, loader, options = {}) {
  const scheduleFile = path.join(dataDir, 'match_snapshot_schedule.json');
  let inFlight = null;

  async function runUpdate() {
    try {
      if (!fs.existsSync(scheduleFile)) return;
      const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
      if (!schedule || !Array.isArray(schedule.matches)) return;

      // Helper to check placeholder patterns across display fields
      function isPlaceholderText(str) {
        if (!str) return false;
        const s = String(str).trim();
        return /^(TBD|待定|QFW\d*|QW\d*|SFW\d*|SF\d*|W\d+|L\d+|RD\d+\s*[WL]\d*)$/i.test(s) ||
               s.includes('Winner') || s.includes('Loser') || s.includes('QFW') || s.includes('SFW') || s.includes('RD16') ||
               /^(Quarterfinal|Semifinal|Round of|胜者|负者|小组第一|小组第二)/i.test(s);
      }

      // Find matches that are not completed/post, or are completed but still have placeholder/inconsistent display fields
      const pendingMatches = schedule.matches.filter(m => {
        if (!m.status?.completed && m.status?.state !== 'post') return true;
        const hAbbr = String(m.teams?.home?.abbreviation || '').trim();
        const aAbbr = String(m.teams?.away?.abbreviation || '').trim();
        const hName = String(m.teams?.home?.name || '').trim();
        const aName = String(m.teams?.away?.name || '').trim();
        const matchName = String(m.name || '').trim();
        const shortName = String(m.shortName || '').trim();
        if (isPlaceholderText(hAbbr) || isPlaceholderText(aAbbr) || isPlaceholderText(hName) || isPlaceholderText(aName) || isPlaceholderText(matchName) || isPlaceholderText(shortName)) return true;
        if (hName && aName && !isPlaceholderText(hName) && !isPlaceholderText(aName)) {
          if (matchName !== `${aName} at ${hName}`) return true;
        }
        if (hAbbr && aAbbr && !isPlaceholderText(hAbbr) && !isPlaceholderText(aAbbr)) {
          if (shortName !== `${aAbbr} @ ${hAbbr}`) return true;
        }
        return false;
      });
      if (pendingMatches.length === 0) {
        return; // All matches completed and fully synchronized
      }

      // Group pending matches by date key (YYYYMMDD)
      const datesToFetch = new Set();
      for (const match of pendingMatches) {
        if (match.kickoffUtc) {
          const dateStr = match.kickoffUtc.slice(0, 10).replace(/-/g, '');
          datesToFetch.add(dateStr);
        }
      }

      let updatedAny = false;
      const eventsByMatchId = {};
      for (const dateStr of datesToFetch) {
        const cacheKey = `schedule_updater_${dateStr}_${Date.now()}`;
        const data = await espn(`/scoreboard?dates=${dateStr}`, cacheKey, 0).catch(err => {
          logger.error(`⚠️ Schedule updater failed to fetch scoreboard for ${dateStr}:`, { error: err.message });
          return null;
        });
        if (data && Array.isArray(data.events)) {
          for (const event of data.events) {
            eventsByMatchId[String(event.id)] = event;
          }
        }
      }

      function mapEspnState(state) {
        if (!state) return state;
        if (['post', 'pre', 'in'].includes(state.toLowerCase())) return state.toLowerCase();
        return state;
      }

      for (const match of schedule.matches) {
        const matchId = match.matchId;
        const event = eventsByMatchId[matchId];
        if (!event) continue;

        const comp = event.competitions?.[0];
        if (comp) {
          const statusType = comp.status?.type || event.status?.type || {};
          const newState = mapEspnState(statusType.state || statusType.name);
          const newCompleted = Boolean(statusType.completed);

          if (newState && (match.status?.state !== newState || match.status?.completed !== newCompleted || match.status?.detail !== (statusType.detail || '') || match.status?.shortDetail !== (statusType.shortDetail || ''))) {
            match.status = {
              ...match.status,
              state: newState,
              name: statusType.name || '',
              completed: newCompleted,
              detail: statusType.detail || '',
              shortDetail: statusType.shortDetail || '',
            };
            updatedAny = true;
            logger.info(`🔄 [Cron] Updated match ${matchId} status on disk: ${newState} (${statusType.detail || ''})`);
          }

          const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
          const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
          const newHomeId = homeComp?.team?.id ? String(homeComp.team.id) : null;
          const newAwayId = awayComp?.team?.id ? String(awayComp.team.id) : null;
          const newHomeName = homeComp?.team?.displayName || '';
          const newAwayName = awayComp?.team?.displayName || '';
          const newHomeAbbr = homeComp?.team?.abbreviation || homeComp?.team?.abbrev || (newHomeName ? newHomeName.slice(0, 3).toUpperCase() : '');
          const newAwayAbbr = awayComp?.team?.abbreviation || awayComp?.team?.abbrev || (newAwayName ? newAwayName.slice(0, 3).toUpperCase() : '');

          const nextName = (newAwayName && newHomeName) ? `${newAwayName} at ${newHomeName}` : (match.name || '');
          const nextShortName = (newAwayAbbr && newHomeAbbr) ? `${newAwayAbbr} @ ${newHomeAbbr}` : (match.shortName || '');

          const teamsChanged = newHomeId && newAwayId && (
            newHomeId !== match.teams?.home?.id ||
            newAwayId !== match.teams?.away?.id ||
            newHomeName !== match.teams?.home?.name ||
            newAwayName !== match.teams?.away?.name ||
            newHomeAbbr !== match.teams?.home?.abbreviation ||
            newAwayAbbr !== match.teams?.away?.abbreviation ||
            nextName !== (match.name || '') ||
            nextShortName !== (match.shortName || '')
          );

          if (teamsChanged) {
            match.teams = match.teams || { home: {}, away: {} };
            match.teams.home = { ...match.teams.home, id: newHomeId, name: newHomeName, abbreviation: newHomeAbbr };
            match.teams.away = { ...match.teams.away, id: newAwayId, name: newAwayName, abbreviation: newAwayAbbr };
            if (nextName) match.name = nextName;
            if (nextShortName) match.shortName = nextShortName;
            updatedAny = true;
            logger.info(`🔄 [Cron] Updated match ${matchId} teams/fields on disk: ${newHomeName} vs ${newAwayName} (${match.name} / ${match.shortName})`);
          }
        }
      }

      if (updatedAny) {
        schedule.generatedAt = new Date().toISOString();
        fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2) + '\n');

        // Update loader cache in place
        const loadedSchedule = loader.getSchedule();
        if (loadedSchedule && Array.isArray(loadedSchedule.matches)) {
          for (const match of schedule.matches) {
            const target = loadedSchedule.matches.find(m => m.matchId === match.matchId);
            if (target) {
              target.status = match.status;
              target.teams = match.teams;
              target.name = match.name;
              target.shortName = match.shortName;
            }
          }
          loadedSchedule.generatedAt = schedule.generatedAt;
        }
      }
    } catch (e) {
      logger.error('⚠️ Schedule updater tick failed:', { error: e.message });
    }
  }

  function updateStatuses() {
    if (inFlight) return inFlight;
    inFlight = runUpdate().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  // Run immediately on start unless runImmediately is false, then every 15 minutes (or options.intervalMs)
  if (options.runImmediately !== false) {
    updateStatuses();
  }
  const intervalId = setInterval(updateStatuses, options.intervalMs || 15 * 60 * 1000);

  return {
    stop() {
      clearInterval(intervalId);
    },
    updateOnce: updateStatuses,
  };
}

module.exports = { startScheduleUpdater };
