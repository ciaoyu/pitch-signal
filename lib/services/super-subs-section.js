'use strict';

/**
 * KO-9: Super-subs section (display/bot-only)
 *
 * Surfaces each team's bench strength for a knockout fixture by aggregating
 * substitute impact from the current tournament. Data sources:
 *   - match_moments (type = 'substitution_key') for sub appearances and the
 *     pressure-index slope delta computed by substitution-impact.js.
 *   - player_match_events (event_type = 'goal' | 'assist') for goals/assists
 *     scored by a substitute after coming on.
 *
 * This section is display/bot metadata only (usedInModel: false).
 */

const { getSubstitutionImpacts } = require('./substitution-impact');

function parseRawJson(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function findMatchesForTeam(teamId, db) {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT DISTINCT match_id FROM match_moments WHERE team_id = ?
      UNION
      SELECT DISTINCT match_id FROM player_match_events WHERE team_id = ?
    `).all(String(teamId), String(teamId));
    return rows.map((r) => r.match_id);
  } catch (_) {
    return [];
  }
}

function getPlayerEventsAfterMinute(teamId, matchId, minute, eventType, db) {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT player_name, player_id, minute, event_type
      FROM player_match_events
      WHERE team_id = ? AND match_id = ? AND event_type = ? AND minute >= ?
    `).all(String(teamId), String(matchId), eventType, minute);
  } catch (_) {
    return [];
  }
}

function aggregateSuperSubs(teamId, db) {
  const matches = findMatchesForTeam(teamId, db);
  if (!matches.length) return { superSubs: [], aggregateImpact: 0, notes: [] };

  const byPlayer = new Map();

  for (const matchId of matches) {
    const impacts = getSubstitutionImpacts(matchId, db);
    for (const sub of impacts) {
      if (String(sub.teamId) !== String(teamId)) continue;
      const playerName = sub.playerIn;
      if (!playerName) continue;

      if (!byPlayer.has(playerName)) {
        byPlayer.set(playerName, {
          playerName,
          playerId: null,
          appearances: 0,
          slopeDeltas: [],
          goalsAfterSub: 0,
          assistsAfterSub: 0,
          keyMoments: [],
        });
      }
      const entry = byPlayer.get(playerName);
      entry.appearances += 1;
      const impact = sub.impact || {};
      const delta = impact.slopeDelta;
      if (typeof delta === 'number') entry.slopeDeltas.push(delta);

      // Count goals/assists after this substitution.
      const goals = getPlayerEventsAfterMinute(teamId, matchId, sub.minute, 'goal', db);
      const ownGoals = goals.filter((g) => {
        const raw = parseRawJson(g.raw_json);
        return String(raw.player_name || g.player_name).toLowerCase() === playerName.toLowerCase();
      });
      const assists = getPlayerEventsAfterMinute(teamId, matchId, sub.minute, 'assist', db);
      const ownAssists = assists.filter((a) => {
        const raw = parseRawJson(a.raw_json);
        return String(raw.player_name || a.player_name).toLowerCase() === playerName.toLowerCase();
      });

      entry.goalsAfterSub += ownGoals.length;
      entry.assistsAfterSub += ownAssists.length;
      if (ownGoals.length > 0 || ownAssists.length > 0) {
        entry.keyMoments.push({ matchId, minute: sub.minute, goals: ownGoals.length, assists: ownAssists.length });
      }
    }
  }

  const superSubs = [];
  for (const entry of byPlayer.values()) {
    const avgImpact = entry.slopeDeltas.length
      ? entry.slopeDeltas.reduce((a, b) => a + b, 0) / entry.slopeDeltas.length
      : 0;
    const notes = [];
    if (entry.goalsAfterSub > 0) notes.push(`${entry.goalsAfterSub} goal${entry.goalsAfterSub > 1 ? 's' : ''} after coming on`);
    if (entry.assistsAfterSub > 0) notes.push(`${entry.assistsAfterSub} assist${entry.assistsAfterSub > 1 ? 's' : ''} after coming on`);
    if (entry.appearances > 1) notes.push(`${entry.appearances} sub appearances`);

    superSubs.push({
      playerName: entry.playerName,
      playerId: entry.playerId,
      appearances: entry.appearances,
      avgImpact: round2(avgImpact),
      goalsAfterSub: entry.goalsAfterSub,
      assistsAfterSub: entry.assistsAfterSub,
      keyMoments: entry.keyMoments.slice(0, 3),
      notes,
    });
  }

  // Rank: goals+assists first, then positive avgImpact, then appearances.
  superSubs.sort((a, b) => {
    const aScore = a.goalsAfterSub + a.assistsAfterSub + Math.max(0, a.avgImpact);
    const bScore = b.goalsAfterSub + b.assistsAfterSub + Math.max(0, b.avgImpact);
    return bScore - aScore;
  });

  const top = superSubs.slice(0, 5);
  const aggregateImpact = top.length
    ? round2(top.reduce((s, p) => s + p.avgImpact, 0) / top.length)
    : 0;

  const notes = [];
  if (top.length === 0) notes.push('No substitute impact data in this tournament yet');
  else if (top.some((p) => p.goalsAfterSub > 0)) notes.push('Bench has produced goals in this tournament');

  return { superSubs: top, aggregateImpact, notes };
}

function strongerBench(home, away) {
  const hScore = home.aggregateImpact + home.superSubs.reduce((s, p) => s + p.goalsAfterSub + p.assistsAfterSub, 0);
  const aScore = away.aggregateImpact + away.superSubs.reduce((s, p) => s + p.goalsAfterSub + p.assistsAfterSub, 0);
  const diff = hScore - aScore;
  const margin = Math.abs(diff);
  if (margin < 0.25) return { side: 'even', reason: 'Bench strength roughly level' };
  if (diff > 0) return { side: 'home', reason: `Home bench shows stronger aggregate impact (+${round2(margin)})` };
  return { side: 'away', reason: `Away bench shows stronger aggregate impact (+${round2(margin)})` };
}

function confidenceLabel(home, away) {
  const homeHas = home.superSubs.length;
  const awayHas = away.superSubs.length;
  if (homeHas >= 2 && awayHas >= 2) return 'high';
  if (homeHas > 0 || awayHas > 0) return 'medium';
  return 'low';
}

/**
 * Build the super-subs section for a knockout fixture.
 *
 * @param {object} ctx - { matchId, homeTeamId, awayTeamId, homeName, awayName, db }
 * @returns {object|null}
 */
function buildSuperSubsSection(ctx = {}) {
  const { matchId, homeTeamId, awayTeamId, homeName, awayName, db } = ctx;
  if (!matchId || !homeTeamId || !awayTeamId || !db) return null;

  const home = aggregateSuperSubs(homeTeamId, db);
  const away = aggregateSuperSubs(awayTeamId, db);

  return {
    confidence: confidenceLabel(home, away),
    source: 'match_moments+substitution-impact+player-events',
    usedInModel: false,
    home: {
      name: homeName || null,
      ...home,
    },
    away: {
      name: awayName || null,
      ...away,
    },
    comparison: strongerBench(home, away),
  };
}

module.exports = { buildSuperSubsSection };
