'use strict';

const db = require('./db');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function outcomeFromScore(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

function brierScore(row) {
  const yHome = row.outcome === 'home' ? 1 : 0;
  const yDraw = row.outcome === 'draw' ? 1 : 0;
  const yAway = row.outcome === 'away' ? 1 : 0;
  return ((row.homeWin - yHome) ** 2) + ((row.draw - yDraw) ** 2) + ((row.awayWin - yAway) ** 2);
}

function topPrediction(row) {
  const probs = [
    ['home', row.homeWin],
    ['draw', row.draw],
    ['away', row.awayWin],
  ].sort((a, b) => b[1] - a[1]);
  return { choice: probs[0][0], confidence: probs[0][1] };
}

function emptyBuckets() {
  return Array.from({ length: 10 }, (_, i) => ({
    bucket: i,
    range: [i / 10, (i + 1) / 10],
    count: 0,
    avgConfidence: null,
    accuracy: null,
    calibrationError: null,
  }));
}

function buildCalibrationBuckets(rows) {
  const buckets = emptyBuckets();
  for (const row of rows) {
    const top = topPrediction(row);
    const idx = Math.min(9, Math.max(0, Math.floor(top.confidence * 10)));
    const b = buckets[idx];
    b.count += 1;
    b._confidenceSum = (b._confidenceSum || 0) + top.confidence;
    b._hitSum = (b._hitSum || 0) + (top.choice === row.outcome ? 1 : 0);
  }
  return buckets.map((b) => {
    if (!b.count) return b;
    const avgConfidence = b._confidenceSum / b.count;
    const accuracy = b._hitSum / b.count;
    return {
      bucket: b.bucket,
      range: b.range,
      count: b.count,
      avgConfidence: Math.round(avgConfidence * 10000) / 10000,
      accuracy: Math.round(accuracy * 10000) / 10000,
      calibrationError: Math.round(Math.abs(avgConfidence - accuracy) * 10000) / 10000,
    };
  });
}

function fitPlatt(rows) {
  if (rows.length < 20) {
    return { available: false, reason: 'insufficient_sample', minSample: 20 };
  }
  let a = 1;
  let b = 0;
  const lr = 0.05;
  for (let iter = 0; iter < 700; iter++) {
    let gradA = 0;
    let gradB = 0;
    for (const row of rows) {
      const top = topPrediction(row);
      const p = clamp(top.confidence, 0.001, 0.999);
      const x = Math.log(p / (1 - p));
      const y = top.choice === row.outcome ? 1 : 0;
      const z = clamp(a * x + b, -20, 20);
      const pred = 1 / (1 + Math.exp(-z));
      gradA += (pred - y) * x;
      gradB += (pred - y);
    }
    a -= lr * gradA / rows.length;
    b -= lr * gradB / rows.length;
  }
  return {
    available: true,
    slope: Math.round(a * 10000) / 10000,
    intercept: Math.round(b * 10000) / 10000,
    target: 'top_prediction_correctness',
  };
}

function fetchSnapshotRows(database = db) {
  const rows = database.prepare(`
    SELECT
      s.match_id,
      s.home_team_name,
      s.away_team_name,
      s.home_win_prob,
      s.draw_prob,
      s.away_win_prob,
      s.created_at,
      r.actual_home_score,
      r.actual_away_score
    FROM prediction_snapshots s
    JOIN post_match_reviews r ON r.prediction_snapshot_id = s.id
    WHERE r.actual_home_score IS NOT NULL
      AND r.actual_away_score IS NOT NULL
      AND s.home_win_prob IS NOT NULL
      AND s.draw_prob IS NOT NULL
      AND s.away_win_prob IS NOT NULL
    ORDER BY s.created_at ASC
  `).all();

  return rows.map((row) => ({
    matchId: String(row.match_id),
    homeTeamName: row.home_team_name,
    awayTeamName: row.away_team_name,
    homeWin: Number(row.home_win_prob),
    draw: Number(row.draw_prob),
    awayWin: Number(row.away_win_prob),
    actualHomeScore: Number(row.actual_home_score),
    actualAwayScore: Number(row.actual_away_score),
    outcome: outcomeFromScore(Number(row.actual_home_score), Number(row.actual_away_score)),
    createdAt: row.created_at,
  })).filter((row) => (
    Number.isFinite(row.homeWin) &&
    Number.isFinite(row.draw) &&
    Number.isFinite(row.awayWin) &&
    Number.isFinite(row.actualHomeScore) &&
    Number.isFinite(row.actualAwayScore)
  ));
}

function buildCalibrationReport(options = {}) {
  const rows = options.rows || fetchSnapshotRows(options.db || db);
  const sampleSize = rows.length;
  const scoredRows = rows.map((row) => {
    const top = topPrediction(row);
    return {
      ...row,
      predictedOutcome: top.choice,
      predictedConfidence: top.confidence,
      correct: top.choice === row.outcome,
      brier: brierScore(row),
    };
  });

  const meanBrier = sampleSize
    ? scoredRows.reduce((sum, row) => sum + row.brier, 0) / sampleSize
    : null;
  const accuracy = sampleSize
    ? scoredRows.filter((row) => row.correct).length / sampleSize
    : null;
  const buckets = buildCalibrationBuckets(scoredRows);
  const ece = sampleSize
    ? buckets.reduce((sum, b) => sum + (b.count ? (b.count / sampleSize) * b.calibrationError : 0), 0)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    source: 'prediction_snapshots+post_match_reviews',
    sampleSize,
    status: sampleSize ? 'ok' : 'empty',
    metrics: {
      brier: meanBrier == null ? null : Math.round(meanBrier * 10000) / 10000,
      accuracy: accuracy == null ? null : Math.round(accuracy * 10000) / 10000,
      expectedCalibrationError: ece == null ? null : Math.round(ece * 10000) / 10000,
    },
    buckets,
    platt: fitPlatt(scoredRows),
    recent: scoredRows.slice(-8).reverse().map((row) => ({
      matchId: row.matchId,
      match: `${row.homeTeamName || 'Home'} vs ${row.awayTeamName || 'Away'}`,
      predictedOutcome: row.predictedOutcome,
      predictedConfidence: Math.round(row.predictedConfidence * 10000) / 10000,
      actualOutcome: row.outcome,
      score: `${row.actualHomeScore}-${row.actualAwayScore}`,
      brier: Math.round(row.brier * 10000) / 10000,
      correct: row.correct,
    })),
  };
}

module.exports = {
  buildCalibrationReport,
  buildCalibrationBuckets,
  fitPlatt,
  brierScore,
  outcomeFromScore,
};
