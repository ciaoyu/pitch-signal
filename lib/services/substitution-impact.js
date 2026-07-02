'use strict';

const { db } = require('../db');

const DEFAULT_WINDOW_MINUTES = 10;
const MIN_SNAPSHOTS = 3;
const MEANINGFUL_SLOPE_DELTA = 0.5;

function round2(value) {
  return Math.round(value * 100) / 100;
}

function linearSlope(rows, field) {
  const points = rows
    .map(row => ({ x: Number(row.minute), y: Number(row[field]) }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (points.length < MIN_SNAPSHOTS) return null;

  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + ((point.x - meanX) ** 2), 0);
  if (denominator === 0) return null;

  const numerator = points.reduce(
    (sum, point) => sum + ((point.x - meanX) * (point.y - meanY)),
    0
  );
  return round2(numerator / denominator);
}

function classifySlopeDelta(delta) {
  if (delta > MEANINGFUL_SLOPE_DELTA) return 'positive';
  if (delta < -MEANINGFUL_SLOPE_DELTA) return 'negative';
  return 'neutral';
}

function computeSideImpact(rows, minute, field, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const before = rows.filter(row => row.minute >= minute - windowMinutes && row.minute <= minute);
  const after = rows.filter(row => row.minute >= minute && row.minute <= minute + windowMinutes);
  const beforeSlope = linearSlope(before, field);
  const afterSlope = linearSlope(after, field);

  if (beforeSlope == null || afterSlope == null) {
    return {
      status: 'insufficient_data',
      beforeSnapshots: before.length,
      afterSnapshots: after.length,
      beforeSlope,
      afterSlope,
      slopeDelta: null,
      direction: null,
    };
  }

  const slopeDelta = round2(afterSlope - beforeSlope);
  return {
    status: 'ready',
    beforeSnapshots: before.length,
    afterSnapshots: after.length,
    beforeSlope,
    afterSlope,
    slopeDelta,
    direction: classifySlopeDelta(slopeDelta),
  };
}

function computeSubstitutionImpact(rows, minute, currentMinute, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const complete = currentMinute >= minute + windowMinutes;
  const base = {
    status: complete ? 'insufficient_data' : 'pending',
    metric: 'pressure_index',
    windowMinutes,
    minimumSnapshots: MIN_SNAPSHOTS,
    substitutionMinute: minute,
    evaluatedAtMinute: Math.min(currentMinute, minute + windowMinutes),
  };
  if (!complete) return base;

  const home = computeSideImpact(rows, minute, 'pressure_home', windowMinutes);
  const away = computeSideImpact(rows, minute, 'pressure_away', windowMinutes);
  return {
    ...base,
    status: home.status === 'ready' || away.status === 'ready' ? 'ready' : 'insufficient_data',
    home,
    away,
  };
}

function parseRawJson(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function updateSubstitutionImpacts(matchId, currentMinute, database = db, windowMinutes = DEFAULT_WINDOW_MINUTES) {
  const id = String(matchId);
  const moments = database.prepare(`
    SELECT id, minute, raw_json
    FROM match_moments
    WHERE match_id = ? AND type = 'substitution_key'
    ORDER BY minute ASC
  `).all(id);
  if (!moments.length) return 0;

  const rows = database.prepare(`
    SELECT minute, pressure_home, pressure_away
    FROM match_live_stats
    WHERE match_id = ? AND minute >= ? AND minute <= ?
    ORDER BY minute ASC
  `).all(
    id,
    Math.max(0, moments[0].minute - windowMinutes),
    Number(currentMinute)
  );
  const update = database.prepare('UPDATE match_moments SET raw_json = ? WHERE id = ?');
  const apply = database.transaction(items => {
    let changed = 0;
    for (const moment of items) {
      const raw = parseRawJson(moment.raw_json);
      const substitutionImpact = computeSubstitutionImpact(
        rows,
        Number(moment.minute),
        Number(currentMinute),
        windowMinutes
      );
      const next = JSON.stringify({ ...raw, substitution_impact: substitutionImpact });
      if (next !== moment.raw_json) changed += update.run(next, moment.id).changes;
    }
    return changed;
  });
  return apply(moments);
}

function getSubstitutionImpacts(matchId, database = db) {
  return database.prepare(`
    SELECT minute, minute_added, team_id, source, raw_json
    FROM match_moments
    WHERE match_id = ? AND type = 'substitution_key'
    ORDER BY minute ASC, minute_added ASC
  `).all(String(matchId)).map(row => {
    const raw = parseRawJson(row.raw_json);
    return {
      minute: row.minute,
      minuteAdded: row.minute_added,
      teamId: row.team_id,
      source: row.source,
      playerIn: raw.playerIn || null,
      playerOut: raw.playerOut || null,
      impact: raw.substitution_impact || {
        status: 'insufficient_data',
        metric: 'pressure_index',
        windowMinutes: DEFAULT_WINDOW_MINUTES,
        minimumSnapshots: MIN_SNAPSHOTS,
      },
    };
  });
}

module.exports = {
  DEFAULT_WINDOW_MINUTES,
  MIN_SNAPSHOTS,
  MEANINGFUL_SLOPE_DELTA,
  linearSlope,
  classifySlopeDelta,
  computeSideImpact,
  computeSubstitutionImpact,
  updateSubstitutionImpacts,
  getSubstitutionImpacts,
};
