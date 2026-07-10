'use strict';

/**
 * KO-10: Referee assignment and historical stats service
 *
 * Extracts match officials from ESPN match summaries and computes tournament
 * refereeing averages (yellow cards, red cards per match) by joining with
 * player_match_events.
 */

function round2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Extracts officials array from an ESPN match summary payload.
 * @param {object} summary - ESPN summary JSON
 * @returns {Array} List of official objects { name, role }
 */
function parseSummaryOfficials(summary) {
  if (!summary || typeof summary !== 'object') return [];

  const rawOfficials =
    summary.officials ||
    summary.gameInfo?.officials ||
    summary.header?.competitions?.[0]?.officials ||
    summary.competitions?.[0]?.officials ||
    [];

  if (!Array.isArray(rawOfficials)) return [];

  const result = [];
  for (const item of rawOfficials) {
    const name = item.fullName || item.displayName || item.name;
    if (!name) continue;
    const role = item.position?.name || item.role || item.title || 'Referee';
    result.push({
      name: String(name).trim(),
      role: String(role).trim(),
      rawJson: JSON.stringify(item),
    });
  }
  return result;
}

/**
 * Persists extracted officials into match_officials table idempotently.
 * @param {string} matchId
 * @param {object} summary
 * @param {object} db
 * @returns {number} count of inserted rows
 */
function extractAndPersistOfficials(matchId, summary, db) {
  if (!matchId || !db) return 0;
  const officials = parseSummaryOfficials(summary);
  if (!officials.length) return 0;

  let inserted = 0;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO match_officials (match_id, name, role, raw_json) VALUES (?, ?, ?, ?)`
  );

  for (const off of officials) {
    try {
      const info = stmt.run(String(matchId), off.name, off.role, off.rawJson);
      if (info.changes > 0) inserted += 1;
    } catch (_) {
      // ignore individual insertion failure
    }
  }

  return inserted;
}

/**
 * Computes tournament averages for a referee across all matches they refereed.
 * @param {string} refereeName
 * @param {object} db
 * @returns {object} { matchesRefereed, yellowsPerMatch, redsPerMatch }
 */
function getRefereeStats(refereeName, db) {
  if (!refereeName || !db) {
    return { matchesRefereed: 0, yellowsPerMatch: 0, redsPerMatch: 0 };
  }

  try {
    const matchRows = db
      .prepare(
        `SELECT DISTINCT match_id FROM match_officials WHERE name = ? AND role = 'Referee'`
      )
      .all(refereeName);

    const matchIds = matchRows.map((r) => r.match_id);
    const matchesRefereed = matchIds.length;
    if (matchesRefereed === 0) {
      return { matchesRefereed: 0, yellowsPerMatch: 0, redsPerMatch: 0 };
    }

    const placeholders = matchIds.map(() => '?').join(',');
    const cardRows = db
      .prepare(
        `SELECT event_type, COUNT(*) as count
         FROM player_match_events
         WHERE match_id IN (${placeholders})
         GROUP BY event_type`
      )
      .all(...matchIds);

    let yellowCount = 0;
    let redCount = 0;

    for (const row of cardRows) {
      if (row.event_type === 'yellow') yellowCount += row.count;
      else if (row.event_type === 'secondyellow') {
        yellowCount += row.count;
        redCount += row.count;
      } else if (row.event_type === 'red') {
        redCount += row.count;
      }
    }

    return {
      matchesRefereed,
      yellowsPerMatch: round2(yellowCount / matchesRefereed),
      redsPerMatch: round2(redCount / matchesRefereed),
    };
  } catch (_) {
    return { matchesRefereed: 0, yellowsPerMatch: 0, redsPerMatch: 0 };
  }
}

/**
 * Builds the referee section for a knockout fixture.
 * @param {object} ctx - { matchId, db }
 * @returns {object|null}
 */
function buildRefereeSection(ctx = {}) {
  const { matchId, db } = ctx;
  if (!matchId || !db) return null;

  try {
    const refRow = db
      .prepare(
        `SELECT name, role FROM match_officials WHERE match_id = ? AND role = 'Referee' LIMIT 1`
      )
      .get(String(matchId));

    if (!refRow || !refRow.name) {
      return null;
    }

    const refereeName = refRow.name;
    const stats = getRefereeStats(refereeName, db);

    const confidence =
      stats.matchesRefereed >= 3
        ? 'high'
        : stats.matchesRefereed >= 1
        ? 'medium'
        : 'low';

    return {
      refereeName,
      confidence,
      source: 'match_officials+player_match_events',
      usedInModel: false,
      matchesRefereed: stats.matchesRefereed,
      yellowsPerMatch: stats.yellowsPerMatch,
      redsPerMatch: stats.redsPerMatch,
    };
  } catch (_) {
    return null;
  }
}

module.exports = {
  parseSummaryOfficials,
  extractAndPersistOfficials,
  getRefereeStats,
  buildRefereeSection,
};
