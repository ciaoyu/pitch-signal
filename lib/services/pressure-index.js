'use strict';

/**
 * Pressure Index — Track B Threat Momentum Index
 *
 * Display-only, does not affect probabilities. Only eligible for promotion to calibrated mover after validation.
 *
 * Calculation method: cumulative statistics difference (delta) between two timestamps,
 * mapped to a 0-100 pressure index.
 *
 * Signals and weights (all from ESPN boxscore/statistics, no third-party required):
 *   shots_on_target  35%  — Strongest attacking signal
 *   total_shots      20%  — Attacking volume
 *   corners          20%  — Active progression
 *   possession       15%  — Field control (absolute ratio, not delta)
 *   crosses          10%  — Dangerous crosses
 *
 * Surge detection (Jordan/Algeria pattern):
 *   When a team has at least 3 out of recent 5 snapshots with PI >= 65 (sliding window, tolerating single-minute jitter)
 *   and has scored no goals during the interval, triggers "sustained_pressure_alert".
 */

const { db } = require('../db');

// ─── Weight Definitions ────────────────────────────────────────────────────────
const WEIGHTS = {
  shotsOnTarget: 0.35,
  totalShots:    0.20,
  corners:       0.20,
  possession:    0.15,
  crosses:       0.10,
};

// ─── 15-minute "full pressure" reference ceilings (for normalization) ───────────
const MAX_15MIN = {
  shotsOnTarget: 4,   // 4 shots on target within 15min = extremely high pressure
  totalShots:    7,
  corners:       5,
  possession:    70,  // % absolute value (not delta)
  crosses:       5,
};

/**
 * Compute Pressure Index from two cumulative stat snapshots
 *
 * @param {StatSnapshot} prev   - Earlier snapshot (or null for match start)
 * @param {StatSnapshot} curr   - Current snapshot
 * @param {number} windowMin    - Minutes between snapshots (for normalization)
 * @returns {{ home: number, away: number, dominantTeam: 'home'|'away'|'even', components: object }}
 */
function computePressureIndex(prev, curr, windowMin = 15) {
  const scale = 15 / Math.max(windowMin, 1); // Scale to per-15-min

  const homePi = calcTeamPI(prev?.home, curr.home, scale);
  const awayPi = calcTeamPI(prev?.away, curr.away, scale);

  const diff = homePi - awayPi;
  const dominantTeam = Math.abs(diff) < 8 ? 'even'
    : diff > 0 ? 'home' : 'away';

  return {
    home: round1(homePi),
    away: round1(awayPi),
    dominantTeam,
    diff: round1(diff),
    components: {
      home: calcComponents(prev?.home, curr.home, scale),
      away: calcComponents(prev?.away, curr.away, scale),
    },
  };
}

function calcTeamPI(prev, curr, scale) {
  const delta = statDelta(prev, curr);

  const sot  = clamp01(delta.shotsOnTarget * scale / MAX_15MIN.shotsOnTarget);
  const shot = clamp01(delta.totalShots    * scale / MAX_15MIN.totalShots);
  const corn = clamp01(delta.corners       * scale / MAX_15MIN.corners);
  const poss = clamp01(curr.possessionPct / MAX_15MIN.possession);
  const cros = clamp01(delta.crosses       * scale / MAX_15MIN.crosses);

  return (
    sot  * WEIGHTS.shotsOnTarget +
    shot * WEIGHTS.totalShots    +
    corn * WEIGHTS.corners       +
    poss * WEIGHTS.possession    +
    cros * WEIGHTS.crosses
  ) * 100;
}

function calcComponents(prev, curr, scale) {
  const d = statDelta(prev, curr);
  return {
    shotsOnTargetDelta: d.shotsOnTarget,
    totalShotsDelta:    d.totalShots,
    cornersDelta:       d.corners,
    possessionPct:      curr.possessionPct,
    crossesDelta:       d.crosses,
  };
}

function statDelta(prev, curr) {
  return {
    shotsOnTarget: delta(prev?.shotsOnTarget, curr.shotsOnTarget),
    totalShots:    delta(prev?.totalShots,    curr.totalShots),
    corners:       delta(prev?.corners,       curr.corners),
    crosses:       delta(prev?.crosses,       curr.crosses),
  };
}

function delta(prev, curr) {
  const p = Number(prev ?? 0);
  const c = Number(curr ?? 0);
  return Math.max(0, c - p); // Prevent negative delta on clock reset
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function round1(v)  { return Math.round(v * 10) / 10; }

// ─── ESPN stats parsing ──────────────────────────────────────────────────────────

/**
 * Parse ESPN boxscore.teams into standard StatSnapshot
 * @param {Array} teams  - ESPN boxscore.teams
 * @returns {{ home: RawStats, away: RawStats } | null}
 */
function parseEspnStats(teams) {
  if (!Array.isArray(teams) || teams.length < 2) return null;

  const parse = (team) => {
    const get = (name) => {
      const s = team.statistics?.find(s => s.name === name);
      return parseFloat(s?.displayValue ?? '0') || 0;
    };
    return {
      shotsOnTarget: get('shotsOnTarget'),
      totalShots:    get('totalShots'),
      corners:       get('wonCorners'),
      possessionPct: get('possessionPct'),
      crosses:       get('accurateCrosses'),
      saves:         get('saves'),
    };
  };

  // ESPN: competitors[0]=home, [1]=away  or via homeAway field
  const homeTeam = teams.find(t => t.homeAway === 'home') ?? teams[0];
  const awayTeam = teams.find(t => t.homeAway === 'away') ?? teams[1];

  return { home: parse(homeTeam), away: parse(awayTeam) };
}

// ─── Surge Detection ─────────────────────────────────────────────────────────

/**
 * Detect sustained high pressure without goals (Jordan/Algeria pattern)
 *
 * @param {string} matchId
 * @param {'home'|'away'} team
 * @param {number} currentMinute
 * @returns {{ surge: boolean, sustainedMinutes: number, consecutiveHighPI: number }}
 */
function detectSurge(matchId, team, currentMinute, opts = {}) {
  const windowSize = opts.windowSize ?? 5;
  const threshold = opts.threshold ?? 65;
  const minHigh = opts.minHigh ?? 3;

  // Fetch recent windowSize pressure snapshots
  const rows = db.prepare(`
    SELECT minute, pressure_home, pressure_away
    FROM match_live_stats
    WHERE match_id = ?
    ORDER BY minute DESC LIMIT ?
  `).all(String(matchId), windowSize);

  if (rows.length < minHigh) {
    return { surge: false, sustainedMinutes: 0, consecutiveHighPI: 0, highCount: 0, suppressedByGoal: false };
  }

  const piField = team === 'home' ? 'pressure_home' : 'pressure_away';
  // Sliding window: at least minHigh out of recent windowSize snapshots >= threshold is treated as sustained pressure.
  // Fix: original strict streak check broke on single-minute dips; PI delta allows tolerating 1-minute noise.
  const highCount = rows.filter(r => (r[piField] ?? 0) >= threshold).length;
  if (highCount < minHigh) {
    return { surge: false, sustainedMinutes: 0, consecutiveHighPI: highCount, highCount, suppressedByGoal: false };
  }

  // No goal scored during window: if team scored, pressure is released and alert suppressed
  const windowStart = rows[rows.length - 1].minute;
  const windowEnd = rows[0].minute;
  if (goalScoredInWindow(matchId, team, windowStart, windowEnd, opts.matchState)) {
    return { surge: false, sustainedMinutes: 0, consecutiveHighPI: highCount, highCount, suppressedByGoal: true };
  }

  const sustainedMinutes = Math.max(0, windowEnd - windowStart);
  return { surge: true, sustainedMinutes, consecutiveHighPI: highCount, highCount, suppressedByGoal: false };
}

/**
 * Check whether a team scored during the window (suppresses "sustained pressure without goals" alert).
 * Queries specific team if ESPN id is available; otherwise conservatively checks any goal in window.
 */
function goalScoredInWindow(matchId, team, startMinute, endMinute, matchState) {
  let teamId = null;
  if (matchState) teamId = team === 'home' ? matchState.homeTeamId : matchState.awayTeamId;

  const sql = `
    SELECT 1 FROM match_moments
    WHERE match_id = ? AND type = 'goal'
      AND minute BETWEEN ? AND ?
      ${teamId ? 'AND team_id = ?' : ''}
    LIMIT 1
  `;
  const params = teamId
    ? [String(matchId), startMinute, endMinute, teamId]
    : [String(matchId), startMinute, endMinute];
  return !!db.prepare(sql).get(...params);
}

// ─── DB Read / Write ─────────────────────────────────────────────────────────

/**
 * Save stat snapshot and current pressure index
 */
function saveStatSnapshot(matchId, minute, rawStats, pressureResult) {
  db.prepare(`
    INSERT OR REPLACE INTO match_live_stats
      (match_id, minute, home_shots, away_shots, home_sot, away_sot,
       home_corners, away_corners, home_poss, away_poss, home_crosses, away_crosses,
       pressure_home, pressure_away, pressure_dominant, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(matchId), minute,
    rawStats.home.totalShots,    rawStats.away.totalShots,
    rawStats.home.shotsOnTarget, rawStats.away.shotsOnTarget,
    rawStats.home.corners,       rawStats.away.corners,
    rawStats.home.possessionPct, rawStats.away.possessionPct,
    rawStats.home.crosses,       rawStats.away.crosses,
    pressureResult.home, pressureResult.away, pressureResult.dominantTeam,
    new Date().toISOString(),
  );
}

/**
 * Fetch most recent snapshot (used for delta calculation)
 */
function getPrevSnapshot(matchId) {
  const row = db.prepare(`
    SELECT * FROM match_live_stats WHERE match_id = ? ORDER BY minute DESC LIMIT 1
  `).get(String(matchId));
  if (!row) return null;
  return {
    home: { shotsOnTarget: row.home_sot, totalShots: row.home_shots, corners: row.home_corners, possessionPct: row.home_poss, crosses: row.home_crosses },
    away: { shotsOnTarget: row.away_sot, totalShots: row.away_shots, corners: row.away_corners, possessionPct: row.away_poss, crosses: row.away_crosses },
    minute: row.minute,
  };
}

/**
 * Fetch full pressure curve for a match
 */
function getPressureCurve(matchId) {
  return db.prepare(`
    SELECT minute, pressure_home, pressure_away, pressure_dominant, captured_at
    FROM match_live_stats WHERE match_id = ?
    ORDER BY minute ASC
  `).all(String(matchId));
}

module.exports = {
  computePressureIndex,
  parseEspnStats,
  detectSurge,
  saveStatSnapshot,
  getPrevSnapshot,
  getPressureCurve,
};
