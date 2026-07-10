'use strict';

/**
 * Live-match helper functions shared across moment-sync, live-match-monitor,
 * and the prediction route. Extracted for testability — every function here
 * MUST be covered by scripts/test-c-v2.js with real input.
 */

/**
 * Parse added minutes from a clock string.
 *   "90'+4" → 4
 *   "45'+2" → 2
 *   "120'+1" → 1
 *   "23'"     → 0
 *   ""        → 0
 *   null      → 0
 */
function parseAddedTime(displayClock) {
  if (!displayClock || typeof displayClock !== 'string') return 0;
  const m = displayClock.match(/\+(\d+)/);
  return m ? parseInt(m[1], 10) || 0 : 0;
}

/**
 * Count red cards from ESPN competition `details` array by team DISPLAY NAME.
 *
 * Used by: live-match-monitor (fetchLiveMatches uses detail.team?.displayName)
 *
 * @param {Array} details — ESPN comp.details, each item has { type, team, player }
 * @param {string} teamName — display name to match (case-insensitive substring)
 * @returns {number} red cards (direct red + accumulated second yellows)
 */
function countRedCardsFromDetails(details, teamNameOrId) {
  if (!teamNameOrId || !Array.isArray(details) || !details.length) return 0;
  const needle = String(teamNameOrId).trim().toLowerCase();
  if (!needle) return 0;

  let reds = 0;
  const yellowsByPlayer = new Map();

  for (const d of details) {
    const dTeamName = String(d.team || '').trim().toLowerCase();
    if (!dTeamName) continue;

    // Loose match: "Germany" ↔ "GER" ↔ "germany"
    const isOurTeam = dTeamName === needle || dTeamName.includes(needle) || needle.includes(dTeamName);
    if (!isOurTeam) continue;

    const type = String(d.type || '').trim().toLowerCase();
    const player = String(d.player || '').trim();

    if (type.includes('red')) {
      reds++;
    } else if (type.includes('yellow') && player) {
      const prev = yellowsByPlayer.get(player) || 0;
      yellowsByPlayer.set(player, prev + 1);
      if (prev + 1 >= 2) {
        reds++;
        // Remove from tracking so we don't double-count in future calls
        yellowsByPlayer.delete(player);
      }
    }
  }

  return reds;
}

/**
 * Count red cards from ESPN keyEvents by team ESPN ID (numeric).
 *
 * Used by: moment-sync (getLiveMatches uses homeEspnId/awayEspnId)
 *
 * ESPN key event format:
 *   { id, text, shortText, team: { id: "12345" },  // ← numeric ESPN team ID
 *     participants: [{ athlete: { displayName } }],
 *     clock: { displayValue: "34'" } }
 *
 * @param {Array} events — ESPN keyEvents array
 * @param {number|string} teamEspnId — ESPN numeric team ID
 * @returns {number} red cards (direct red + accumulated second yellows)
 */
function countRedCardsFromKeyEvents(events, teamEspnId) {
  if (!teamEspnId || !Array.isArray(events) || !events.length) return 0;
  const tid = String(teamEspnId);

  let reds = 0;
  const yellowsByPlayer = new Map();

  for (const evt of events) {
    const evtTeamId = String(evt.team?.id ?? '');
    if (evtTeamId !== tid) continue;

    const type = String(evt.type?.text || evt.shortText || '').trim();
    // First participant name for second-yellow tracking
    const player = evt.participants?.[0]?.athlete?.displayName || '';

    if (/red/i.test(type) && !/yellow/i.test(type)) {
      // Direct red card
      reds++;
    } else if (/yellow/i.test(type)) {
      if (/second yellow/i.test(type) || /second_yellow/i.test(type)) {
        // Explicit second yellow → red
        reds++;
      } else if (player) {
        const prev = yellowsByPlayer.get(player) || 0;
        yellowsByPlayer.set(player, prev + 1);
        if (prev + 1 >= 2) {
          reds++;
          yellowsByPlayer.delete(player);
        }
      }
    }
  }

  return reds;
}

module.exports = {
  parseAddedTime,
  countRedCardsFromDetails,
  countRedCardsFromKeyEvents,
};
