'use strict';

/**
 * KO-7: Penalty shootout readiness section (display/bot-only)
 *
 * Surfaces pre-match penalty context for knockout fixtures. Because no reliable
 * historical team penalty-shootout dataset exists, this section is **not** used
 * in the probability model (`usedInModel: false`). It reads available proxies:
 *
 *   - Elo rating & defensive strength from data/ratings.json
 *   - Current-tournament knockout matches played (schedule-lookup)
 *   - Current-tournament penalty-shootout experience (matches.decided_by_pens)
 *   - Current-tournament penalty-kick scorers (player_match_events)
 *
 * The section returns a structured object that the knockout-intel card / bot
 * context can render directly. Future data (historical shootout records, player
 * penalty-conversion rates) can upgrade this into a model signal later.
 */

const fs = require('fs');
const path = require('path');
const { detectKnockout } = require('../knockoutStage');
const { teamMatches } = require('./schedule-lookup');
const teamResolver = require('../team_resolver');
const { getHistoricalTeamStats } = require('./historical-knockout-stats');

const RATINGS_PATH = path.join(__dirname, '..', '..', 'data', 'ratings.json');

let _ratingsCache = null;
function loadRatings() {
  if (_ratingsCache) return _ratingsCache;
  try {
    _ratingsCache = JSON.parse(fs.readFileSync(RATINGS_PATH, 'utf8'));
  } catch (_) {
    _ratingsCache = { teams: {} };
  }
  return _ratingsCache;
}

function getRatingsTeam(ratingsId) {
  const ratings = loadRatings();
  return ratings.teams?.[ratingsId] || null;
}

function isPenaltyGoal(rawJson) {
  if (!rawJson) return false;
  try {
    const obj = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    const text = String(obj?.text || '').toLowerCase();
    const typeText = String(obj?.typeText || '').toLowerCase();
    return /penalty|pk\b|spot.?kick/.test(text) || /penalty/.test(typeText);
  } catch (_) {
    return false;
  }
}

function countKnockoutMatches(teamId) {
  const matches = teamMatches(teamId);
  let count = 0;
  for (const m of matches) {
    if (detectKnockout(m.stage).isKnockout) count++;
  }
  return count;
}

function countPenaltyShootoutExperience(teamId, db) {
  if (!db) return { shootouts: 0, won: 0 };
  const ratingsId = teamResolver.getRatingsIdByEspnId(teamId);
  if (!ratingsId) return { shootouts: 0, won: 0 };
  try {
    const rows = db.prepare(`
      SELECT home_team_id, away_team_id, home_score, away_score
      FROM matches
      WHERE decided_by_pens = 1 AND (home_team_id = ? OR away_team_id = ?)
    `).all(ratingsId, ratingsId);
    let shootouts = 0;
    let won = 0;
    for (const r of rows) {
      shootouts++;
      const isHome = String(r.home_team_id) === String(ratingsId);
      const homePens = r.home_score ?? 0;
      const awayPens = r.away_score ?? 0;
      if (isHome && homePens > awayPens) won++;
      if (!isHome && awayPens > homePens) won++;
    }
    return { shootouts, won };
  } catch (_) {
    return { shootouts: 0, won: 0 };
  }
}

function findPenaltyTakers(teamId, db) {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT match_id, player_name, player_id, minute, raw_json
      FROM player_match_events
      WHERE team_id = ? AND event_type = 'goal'
      ORDER BY minute ASC
    `).all(String(teamId));
    const out = [];
    for (const r of rows) {
      if (isPenaltyGoal(r.raw_json)) {
        out.push({
          matchId: r.match_id,
          playerName: r.player_name,
          playerId: r.player_id,
          minute: r.minute,
        });
      }
    }
    return out;
  } catch (_) {
    return [];
  }
}

function experienceLabel(shootouts) {
  if (shootouts >= 2) return 'multiple';
  if (shootouts === 1) return 'once';
  return 'none';
}

function shootoutLikelihood(home, away) {
  // Likelihood is a heuristic based on team parity: closer Elo => more likely
  // to remain tied after 120 minutes. Also, previous shootout experience in
  // this tournament raises the subjective chance of another shootout.
  const eloDiff = Math.abs(home.elo - away.elo);
  const anyRecentShootout = home.shootoutExperience !== 'none' || away.shootoutExperience !== 'none';

  if (eloDiff < 60 || anyRecentShootout) return 'high';
  if (eloDiff < 140) return 'medium';
  return 'low';
}

function strongerSide(home, away) {
  // Composite advantage: Elo + defensive solidity + shootout experience.
  const homeScore = home.elo * 0.5 + home.defenseStrength * 100 + (home.shootoutsWon * 50);
  const awayScore = away.elo * 0.5 + away.defenseStrength * 100 + (away.shootoutsWon * 50);
  const diff = homeScore - awayScore;
  const margin = Math.abs(diff);
  if (margin < 25) return { side: 'even', reason: 'Elo and experience roughly level' };
  if (diff > 0) {
    return {
      side: 'home',
      reason: `Home side shows ${margin > 70 ? 'clear' : 'slight'} advantage in Elo/defence/shootout experience`,
    };
  }
  return {
    side: 'away',
    reason: `Away side shows ${margin > 70 ? 'clear' : 'slight'} advantage in Elo/defence/shootout experience`,
  };
}

function buildTeamPenaltyContext(teamId, db) {
  const ratingsId = teamResolver.getRatingsIdByEspnId(teamId);
  const ratingsTeam = ratingsId ? getRatingsTeam(ratingsId) : null;
  const knockoutMatchesPlayed = countKnockoutMatches(teamId);
  const { shootouts, won } = countPenaltyShootoutExperience(teamId, db);
  const historical = getHistoricalTeamStats(ratingsId || teamId);
  const allTimeShootouts = historical.shootouts + shootouts;
  const allTimeWon = historical.shootoutsWon + won;
  const takers = findPenaltyTakers(teamId, db);
  const elo = ratingsTeam?.rating ?? 1500;
  const defenseStrength = ratingsTeam?.defense_strength ?? 1.0;

  const notes = [];
  if (knockoutMatchesPlayed === 0) notes.push('No knockout minutes logged in this tournament yet');
  if (allTimeShootouts > 0) notes.push(`${allTimeWon}/${allTimeShootouts} World Cup shootout wins (through current tournament)`);
  if (takers.length > 0) notes.push(`${takers.length} penalty kick goal${takers.length > 1 ? 's' : ''} in this tournament`);

  return {
    ratingsId: ratingsId || null,
    elo: Math.round(elo),
    defenseStrength: Math.round(defenseStrength * 1000) / 1000,
    knockoutMatchesPlayed,
    shootoutExperience: experienceLabel(allTimeShootouts),
    shootouts: allTimeShootouts,
    shootoutsWon: allTimeWon,
    winRate: allTimeShootouts ? allTimeWon / allTimeShootouts : 0,
    currentTournament: { shootouts, shootoutsWon: won },
    historicalWorldCup: { shootouts: historical.shootouts, shootoutsWon: historical.shootoutsWon, throughYear: 2022 },
    keyTakers: takers.slice(0, 5),
    notes,
  };
}

function confidenceLabel(home, away) {
  const hasData = (t) => t.knockoutMatchesPlayed > 0 || t.shootouts > 0 || t.keyTakers.length > 0;
  if (hasData(home) && hasData(away)) return 'medium';
  if (hasData(home) || hasData(away)) return 'low';
  return 'low';
}

/**
 * Build the penalty section for a knockout fixture.
 *
 * @param {object} ctx - { matchId, homeTeamId, awayTeamId, homeName, awayName, db }
 * @returns {object|null} penalty section or null if inputs missing
 */
function buildPenaltySection(ctx = {}) {
  const { matchId, homeTeamId, awayTeamId, homeName, awayName, db } = ctx;
  if (!matchId || !homeTeamId || !awayTeamId) return null;

  const home = buildTeamPenaltyContext(homeTeamId, db);
  const away = buildTeamPenaltyContext(awayTeamId, db);

  const likelihood = shootoutLikelihood(home, away);
  const comparison = strongerSide(home, away);

  return {
    confidence: confidenceLabel(home, away),
    source: 'world-cup-history+ratings+schedule+player-events',
    usedInModel: false,
    likelihood,
    home: {
      name: homeName || null,
      ...home,
    },
    away: {
      name: awayName || null,
      ...away,
    },
    comparison,
  };
}

module.exports = { buildPenaltySection, isPenaltyGoal };
