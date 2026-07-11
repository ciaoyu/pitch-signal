'use strict';

const lineupsSource = require('../lineups-source');
const { teamMatches } = require('./schedule-lookup');

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function minuteValue(value) {
  const match = String(value ?? '').match(/(\d+)(?:\D+(\d+))?/);
  return match ? Number(match[1]) + Number(match[2] || 0) / 100 : 0;
}

function eventsForMatch(db, matchId) {
  try {
    const playerEvents = db.prepare(`SELECT team_id, player_name, player_id, event_type, minute, minute_added
      FROM player_match_events WHERE match_id = ? AND event_type IN ('goal','assist')`)
      .all(String(matchId));
    const goalMoments = db.prepare(`SELECT team_id, minute, minute_added, raw_json
      FROM match_moments WHERE match_id = ? AND type = 'goal'`).all(String(matchId)).map(row => {
        let raw = {};
        try { raw = JSON.parse(row.raw_json || '{}'); } catch (_) {}
        return { ...row, player_name: raw.playerIn || null, player_id: null, event_type: 'goal' };
      });
    const captured = db.prepare('SELECT COUNT(*) AS c FROM match_moments WHERE match_id = ?').get(String(matchId))?.c > 0;
    return { rows: playerEvents.length ? playerEvents : goalMoments, captured: captured || playerEvents.length > 0 };
  } catch (_) { return { rows: [], captured: false }; }
}

function aggregateSuperSubs(teamId, db, getSubstitutions = lineupsSource.getSubstitutions) {
  const byPlayer = new Map();
  for (const match of teamMatches(teamId).filter(item => item.status?.completed)) {
    const result = getSubstitutions(match.matchId);
    if (!result?.hasData) continue;
    const side = String(match.homeId) === String(teamId) ? 'home' : 'away';
    const events = eventsForMatch(db, match.matchId);
    for (const sub of (result.substitutions || []).filter(item => item.side === side)) {
      const playerName = sub.onName;
      if (!playerName || playerName === '?') continue;
      const key = normalizeName(playerName);
      if (!byPlayer.has(key)) byPlayer.set(key, {
        playerName, playerId: null, appearances: 0, goalsAfterSub: 0,
        assistsAfterSub: 0, goalsFor: 0, goalsAgainst: 0, evaluatedAppearances: 0, keyMoments: [], notes: [],
      });
      const entry = byPlayer.get(key);
      entry.appearances++;
      const subMinute = minuteValue(sub.minute);
      const eventData = events;
      if (!eventData.captured) {
        entry.keyMoments.push({ matchId: String(match.matchId), minute: sub.minute, coverage: 'unavailable' });
        continue;
      }
      entry.evaluatedAppearances++;
      const after = eventData.rows.filter(event => Number(event.minute) + Number(event.minute_added || 0) / 100 >= subMinute);
      const own = after.filter(event => normalizeName(event.player_name) === key);
      entry.goalsAfterSub += own.filter(event => event.event_type === 'goal').length;
      entry.assistsAfterSub += own.filter(event => event.event_type === 'assist').length;
      const goals = after.filter(event => event.event_type === 'goal');
      const goalsFor = goals.filter(event => String(event.team_id) === String(teamId)).length;
      const goalsAgainst = goals.length - goalsFor;
      entry.goalsFor += goalsFor;
      entry.goalsAgainst += goalsAgainst;
      const matched = own.find(event => event.player_id);
      if (matched) entry.playerId = String(matched.player_id);
      entry.keyMoments.push({ matchId: String(match.matchId), minute: sub.minute, goalsFor, goalsAgainst, coverage: 'available' });
    }
  }

  const superSubs = [...byPlayer.values()];
  for (const entry of superSubs) {
    if (entry.evaluatedAppearances === 0) {
      entry.goalsFor = null;
      entry.goalsAgainst = null;
      entry.notes.push('Goal-timeline coverage unavailable; impact not scored as zero');
      continue;
    }
    if (entry.goalsAfterSub) entry.notes.push(`${entry.goalsAfterSub} goal(s) after coming on`);
    if (entry.assistsAfterSub) entry.notes.push(`${entry.assistsAfterSub} assist(s) after coming on`);
    entry.notes.push(`${entry.goalsFor}-${entry.goalsAgainst} team goals after entry`);
  }
  superSubs.sort((a, b) =>
    (b.goalsAfterSub + b.assistsAfterSub) - (a.goalsAfterSub + a.assistsAfterSub)
    || ((b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)) - ((a.goalsFor ?? 0) - (a.goalsAgainst ?? 0))
    || b.appearances - a.appearances);
  return { superSubs: superSubs.slice(0, 5), notes: superSubs.length ? [] : ['No complete substitution data in this tournament yet'] };
}

function strongerBench(home, away) {
  const score = side => side.superSubs.reduce((sum, player) => sum + player.goalsAfterSub + player.assistsAfterSub + (player.goalsFor ?? 0) - (player.goalsAgainst ?? 0), 0);
  const diff = score(home) - score(away);
  if (Math.abs(diff) < 1) return { side: 'even', reason: 'Bench outcomes roughly level' };
  return diff > 0
    ? { side: 'home', reason: 'Home bench produced the stronger post-substitution goal balance' }
    : { side: 'away', reason: 'Away bench produced the stronger post-substitution goal balance' };
}

function buildSuperSubsSection(ctx = {}) {
  const { matchId, homeTeamId, awayTeamId, homeName, awayName, db } = ctx;
  if (!matchId || !homeTeamId || !awayTeamId || !db) return null;
  const source = ctx.getSubstitutions || lineupsSource.getSubstitutions;
  const home = aggregateSuperSubs(homeTeamId, db, source);
  const away = aggregateSuperSubs(awayTeamId, db, source);
  const count = Math.min(home.superSubs.length, away.superSubs.length);
  return {
    confidence: count >= 2 ? 'high' : (home.superSubs.length || away.superSubs.length ? 'medium' : 'low'),
    source: 'fifa-lineups+player-events', usedInModel: false,
    home: { name: homeName || null, ...home }, away: { name: awayName || null, ...away },
    comparison: strongerBench(home, away),
  };
}

module.exports = { buildSuperSubsSection, aggregateSuperSubs, normalizeName, minuteValue };
