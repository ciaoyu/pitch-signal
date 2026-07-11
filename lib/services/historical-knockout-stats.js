'use strict';

const { detectKnockout } = require('../knockoutStage');
const { loadAllHistoryMatches } = require('../backtest');
const teamResolver = require('../team_resolver');

const FINAL_SHOOTOUT_WINNERS = { '1994': 'Brazil', '2006': 'Italy', '2022': 'Argentina' };
let cache = null;

function ratingsId(name) {
  return teamResolver.resolve(String(name || ''))?.ratings_id || String(name || '');
}

function isThirdPlace(match) {
  return /third.?place|match for third/i.test(String(match?.stage || ''));
}

function inferDrawOutcome(match, matches, year) {
  const home = ratingsId(match.home);
  const away = ratingsId(match.away);
  const later = matches.filter(candidate => new Date(candidate.date) > new Date(match.date));
  const replay = later.find(candidate => {
    const pair = new Set([ratingsId(candidate.home), ratingsId(candidate.away)]);
    return pair.has(home) && pair.has(away) && candidate.homeScore !== candidate.awayScore;
  });
  if (replay) return { winner: ratingsId(replay.homeScore > replay.awayScore ? replay.home : replay.away), method: 'replay' };

  if (/^finals?$/i.test(String(match.stage || ''))) {
    const winner = FINAL_SHOOTOUT_WINNERS[String(year)] || null;
    return winner ? { winner, method: 'shootout' } : null;
  }

  const progressed = new Set();
  for (const candidate of later) {
    if (isThirdPlace(candidate)) continue;
    progressed.add(ratingsId(candidate.home));
    progressed.add(ratingsId(candidate.away));
  }
  const homeProgressed = progressed.has(home);
  const awayProgressed = progressed.has(away);
  if (homeProgressed !== awayProgressed) return { winner: homeProgressed ? home : away, method: 'shootout' };
  return null;
}

function inferDrawWinner(match, matches, year) {
  return inferDrawOutcome(match, matches, year)?.winner || null;
}

function calculateYearStats(year, matches) {
  const stats = {};
  const ensure = team => (stats[team] ||= {
    matchesPlayed: 0, goals: 0, shootouts: 0, shootoutsWon: 0,
    decidedByPens: false, wentToEtLowerBound: false, unresolvedDraws: 0,
  });
  for (const match of matches) {
    if (!detectKnockout(match.stage).isKnockout) continue;
    const home = ratingsId(match.home);
    const away = ratingsId(match.away);
    const hs = Number(match.homeScore);
    const as = Number(match.awayScore);
    ensure(home).matchesPlayed++;
    ensure(away).matchesPlayed++;
    ensure(home).goals += Number.isFinite(hs) ? hs : 0;
    ensure(away).goals += Number.isFinite(as) ? as : 0;
    if (hs !== as) continue;
    const outcome = inferDrawOutcome(match, matches, year);
    if (!outcome) {
      ensure(home).unresolvedDraws++;
      ensure(away).unresolvedDraws++;
      continue;
    }
    if (outcome.method === 'replay') continue;
    for (const team of [home, away]) {
      ensure(team).shootouts++;
      ensure(team).decidedByPens = true;
      ensure(team).wentToEtLowerBound = true;
    }
    ensure(outcome.winner).shootoutsWon++;
  }
  return stats;
}

function loadHistoricalKnockoutStats() {
  if (cache) return cache;
  const { byYear } = loadAllHistoryMatches();
  const yearly = {};
  const allTime = {};
  for (const [year, matches] of Object.entries(byYear)) {
    yearly[year] = calculateYearStats(year, matches);
    for (const [team, row] of Object.entries(yearly[year])) {
      const total = (allTime[team] ||= {
        matchesPlayed: 0, goals: 0, shootouts: 0, shootoutsWon: 0,
        decidedByPens: false, wentToEtLowerBound: false, unresolvedDraws: 0,
      });
      total.matchesPlayed += row.matchesPlayed;
      total.goals += row.goals;
      total.shootouts += row.shootouts;
      total.shootoutsWon += row.shootoutsWon;
      total.unresolvedDraws += row.unresolvedDraws;
      total.decidedByPens ||= row.decidedByPens;
      total.wentToEtLowerBound ||= row.wentToEtLowerBound;
    }
  }
  cache = { yearly, allTime };
  return cache;
}

function getHistoricalTeamStats(teamId) {
  const id = teamResolver.resolve(String(teamId || ''))?.ratings_id || String(teamId || '');
  return loadHistoricalKnockoutStats().allTime[id] || {
    matchesPlayed: 0, goals: 0, shootouts: 0, shootoutsWon: 0,
    decidedByPens: false, wentToEtLowerBound: false, unresolvedDraws: 0,
  };
}

module.exports = { inferDrawWinner, calculateYearStats, loadHistoricalKnockoutStats, getHistoricalTeamStats };
