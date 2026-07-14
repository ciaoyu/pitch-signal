'use strict';

// Observed FIFA World Cup 2026 average after 100 completed matches on 2026-07-15:
// 920 corners / 100 matches = 9.2. This is a model prior, not a betting line.
const TOURNAMENT_TOTAL_PRIOR = 9.2;

// Manually supplied reference lines are match-specific and must never be
// presented as bookmaker odds. Add a source URL before changing kind to market.
const REFERENCE_LINES = Object.freeze({
  '760514': Object.freeze({
    line: 8.5,
    kind: 'reference',
    source: 'manual_reference',
    asOf: '2026-07-15',
  }),
});

function getCornerReferenceLine(matchId) {
  const item = REFERENCE_LINES[String(matchId || '')];
  return item ? { ...item } : null;
}

function finitePositive(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function average(values, fallback) {
  const valid = values.map(finitePositive).filter(value => value !== null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : fallback;
}

function sampleWeight(counts) {
  const valid = counts
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  // Eight matches is enough to reach the deliberately conservative 75% cap;
  // at least 25% always remains on the tournament prior.
  return Math.min(0.75, Math.min(...valid) / 8);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Estimate matchup corners from each team's corners won and the opponent's
 * corners conceded. This intentionally excludes coach labels, surface type,
 * and the comparison line because none is a validated predictive coefficient.
 */
function estimateMatchCorners(input = {}) {
  const priorTotal = finitePositive(input.priorTotal) ?? TOURNAMENT_TOTAL_PRIOR;
  const priorPerTeam = priorTotal / 2;

  const homeRaw = average([input.homeFor, input.awayAgainst], priorPerTeam);
  const awayRaw = average([input.awayFor, input.homeAgainst], priorPerTeam);
  const homeWeight = sampleWeight([input.homeForCount, input.awayAgainstCount]);
  const awayWeight = sampleWeight([input.awayForCount, input.homeAgainstCount]);

  // Shrink small tournament samples toward the observed tournament mean.
  const home = clamp(priorPerTeam + homeWeight * (homeRaw - priorPerTeam), 1.5, 8);
  const away = clamp(priorPerTeam + awayWeight * (awayRaw - priorPerTeam), 1.5, 8);

  return {
    home: Math.round(home * 10) / 10,
    away: Math.round(away * 10) / 10,
    total: Math.round((home + away) * 10) / 10,
    priorTotal,
    sampleWeight: {
      home: Math.round(homeWeight * 100) / 100,
      away: Math.round(awayWeight * 100) / 100,
    },
    method: 'corners_for_plus_opponent_conceded_shrunk_to_tournament_mean',
    status: 'experimental_unvalidated',
  };
}

module.exports = {
  TOURNAMENT_TOTAL_PRIOR,
  getCornerReferenceLine,
  estimateMatchCorners,
};
