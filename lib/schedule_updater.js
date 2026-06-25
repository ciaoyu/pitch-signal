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
function startScheduleUpdater(dataDir, espn, loader) {
  const scheduleFile = path.join(dataDir, 'match_snapshot_schedule.json');

  async function updateStatuses() {
    try {
      if (!fs.existsSync(scheduleFile)) return;
      const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
      if (!schedule || !Array.isArray(schedule.matches)) return;

      // Find matches that are not completed/post
      const pendingMatches = schedule.matches.filter(m => !m.status?.completed && m.status?.state !== 'post');
      if (pendingMatches.length === 0) {
        return; // All matches completed
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
      for (const dateStr of datesToFetch) {
        // Fetch scoreboard for this date (bypass cache by using unique cacheKey)
        const cacheKey = `schedule_updater_${dateStr}_${Date.now()}`;
        const data = await espn(`/scoreboard?dates=${dateStr}`, cacheKey, 0).catch(err => {
          console.error(`⚠️ Schedule updater failed to fetch scoreboard for ${dateStr}:`, err.message);
          return null;
        });

        if (!data || !Array.isArray(data.events)) continue;

        for (const event of data.events) {
          const matchId = String(event.id);
          const match = schedule.matches.find(m => m.matchId === matchId);
          if (match) {
            const comp = event.competitions?.[0] || {};
            const statusType = comp.status?.type || event.status?.type || {};
            const newState = statusType.state || '';
            const newCompleted = Boolean(statusType.completed);

            if (match.status?.state !== newState || match.status?.completed !== newCompleted || match.status?.detail !== statusType.detail) {
              match.status = {
                state: newState,
                name: statusType.name || '',
                completed: newCompleted,
                detail: statusType.detail || '',
                shortDetail: statusType.shortDetail || '',
              };
              updatedAny = true;
              console.log(`🔄 [Cron] Updated match ${matchId} status on disk: ${newState} (${statusType.detail || ''})`);
            }
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
            }
          }
          loadedSchedule.generatedAt = schedule.generatedAt;
        }
      }
    } catch (e) {
      console.error('⚠️ Schedule updater tick failed:', e.message);
    }
  }

  // Run immediately on start, then every 15 minutes
  updateStatuses();
  const intervalId = setInterval(updateStatuses, 15 * 60 * 1000);

  return {
    stop() {
      clearInterval(intervalId);
    }
  };
}

module.exports = { startScheduleUpdater };
