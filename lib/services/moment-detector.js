'use strict';

/**
 * Match Moment Detector
 *
 * Converts ESPN events + FIFA events into structured match_moments records.
 * Each moment represents a trigger point for prediction repricing signals.
 *
 * Trigger point types:
 *   kickoff            Kickoff
 *   goal               Goal (immediate repricing)
 *   goal_disallowed    Disallowed goal (warning signal, no score change)
 *   woodwork           Woodwork hit (threat accumulation signal)
 *   red_card           Red card (major repricing)
 *   yellow_card        Yellow card (accumulation signal)
 *   hydration_break    Hydration break (~30', ~75')
 *   substitution_key   Key substitution (triggered when score >= 60)
 *   halftime           45min halftime snapshot
 *   ht_added_time      First half stoppage time start
 *   second_half_start  Second half start
 *   fulltime           90min fulltime snapshot
 *   ft_added_time      Second half stoppage time start
 *   et_start           Extra time start
 *   et_halftime        Extra time halftime
 *   et_ht_added        Extra time first half stoppage time
 *   et_fulltime        Extra time fulltime (-> penalty shootout)
 *   penalty_shootout   Penalty shootout start
 */

const { db } = require('../db');

// ─── ESPN event type -> moment type mapping ──────────────────────────────────────
// ESPN keyEvents type.text values (from ESPN summary API)
const ESPN_TYPE_MAP = {
  'Goal':            'goal',
  'Goal (Penalty)':  'goal',
  'Own Goal':        'goal',
  'Red Card':        'red_card',
  'Yellow Card':     'yellow_card',
  'Substitution':    'substitution_raw',
  'VAR Review':      'goal_disallowed', // VAR disallowed goal
  'Offside':         'goal_disallowed',
};

// FIFA MatchEvent Type numeric -> moment type
const FIFA_EVENT_MAP = {
  0:  'goal',
  2:  'yellow_card',
  3:  'red_card',
  5:  'substitution_raw',
  6:  'goal_disallowed',   // VAR
  65: 'goal',              // Own goal
};

function resolveEspnMomentType(event) {
  const typeName = event?.type?.text ?? event?.type ?? '';
  if (ESPN_TYPE_MAP[typeName]) return ESPN_TYPE_MAP[typeName];

  // ESPN uses several goal labels (for example "Goal - Header") while
  // `scoringPlay` remains the stable, event-level contract.
  if (event?.scoringPlay === true || String(event?.type?.type || '').startsWith('goal')) return 'goal';
  return null;
}

function scoreStateFromEspnGoal(event, fallback = {}) {
  if (resolveEspnMomentType(event) !== 'goal') return fallback;
  const match = String(event?.text || '').match(/\b(\d+)\s*,\s*[^.]*?\b(\d+)\./);
  if (!match) return fallback;
  return { home: Number(match[1]), away: Number(match[2]) };
}

/**
 * Extract moments from ESPN summary keyEvents array
 * @param {string} matchId
 * @param {Array}  keyEvents  - ESPN summary.keyEvents
 * @param {object} matchState - { homeScore, awayScore, status }
 * @returns {MomentRecord[]}
 */
function detectFromEspn(matchId, keyEvents, matchState) {
  if (!Array.isArray(keyEvents)) return [];
  const moments = [];

  for (const ev of keyEvents) {
    const momentType = resolveEspnMomentType(ev);
    if (!momentType) continue;

    const minute = parseMinute(ev.clock?.displayValue ?? ev.period?.displayValue ?? '');
    const teamId = ev.team?.id ?? null;

    const importance = scoreImportance(momentType, minute, matchState);

    // Substitutions: skip if below threshold importance (to filter noise)
    if (momentType === 'substitution_raw' && importance < 60) continue;

    moments.push(buildMoment(matchId, {
      type: momentType === 'substitution_raw' ? 'substitution_key' : momentType,
      minute,
      teamId,
      importance,
      source: 'espn',
      raw: {
        playerIn:  ev.participants?.[0]?.athlete?.displayName ?? null,
        playerOut: ev.participants?.[1]?.athlete?.displayName ?? null,
        text:      ev.text ?? null,
      },
      // The score board can lag a key event by one poll. A goal's own text
      // carries the authoritative post-goal score and must win over that
      // polling snapshot for immediate repricing.
      scoreState: scoreStateFromEspnGoal(ev, {
        home: matchState.homeScore ?? 0,
        away: matchState.awayScore ?? 0,
      }),
    }));
  }

  return moments;
}

/**
 * Extract moments from FIFA live match events
 * @param {string} matchId
 * @param {Array}  events   - fifa-api.js parseLiveMatch().events
 * @param {object} matchState
 * @returns {MomentRecord[]}
 */
function detectFromFifa(matchId, events, matchState) {
  if (!Array.isArray(events)) return [];
  const moments = [];

  for (const ev of events) {
    const momentType = FIFA_EVENT_MAP[ev.type];
    if (!momentType) continue;

    const minute = Number.isFinite(ev.minute) ? ev.minute : 0;
    const importance = scoreImportance(momentType, minute, matchState);

    if (momentType === 'substitution_raw' && importance < 60) continue;

    moments.push(buildMoment(matchId, {
      type: momentType === 'substitution_raw' ? 'substitution_key' : momentType,
      minute,
      minuteAdded: ev.minuteAdded ?? 0,
      teamId: ev.team ?? null,
      importance,
      source: 'fifa',
      raw: { playerId: ev.player, playerOffId: ev.playerOff },
      scoreState: { home: matchState.homeScore ?? 0, away: matchState.awayScore ?? 0 },
    }));
  }

  return moments;
}

/**
 * Generate structural moments (hydration breaks, halftime, extra time start, etc.)
 * These events lack explicit ESPN/FIFA event types and are inferred from match clock/status
 *
 * @param {string} matchId
 * @param {number} currentMinute
 * @param {string} espnStatus     - ESPN status.type.name
 * @param {object} matchState
 * @param {Set}    alreadyEmitted - Set of structural moment types already emitted
 * @returns {MomentRecord[]}
 */
function detectStructural(matchId, currentMinute, espnStatus, matchState, alreadyEmitted) {
  const moments = [];
  const min = Number(currentMinute) || 0;

  const emit = (type, minute, extra = {}) => {
    if (alreadyEmitted.has(type)) return;
    alreadyEmitted.add(type);
    moments.push(buildMoment(matchId, {
      type, minute,
      importance: structuralImportance(type),
      source: 'inferred',
      raw: extra,
      scoreState: { home: matchState.homeScore ?? 0, away: matchState.awayScore ?? 0 },
    }));
  };

  // Hydration break windows (28-33' and 73-78')
  if (min >= 28 && min <= 33) emit('hydration_break', min, { half: 1 });
  if (min >= 73 && min <= 78) emit('hydration_break', min, { half: 2 });

  // Halftime snapshot (when entering second half)
  if (espnStatus === 'STATUS_SECOND_HALF' && !alreadyEmitted.has('halftime')) {
    emit('halftime', 45);
  }

  // First half stoppage time
  if (min > 45 && min <= 50 && espnStatus === 'STATUS_FIRST_HALF') {
    emit('ht_added_time', min);
  }

  // Second half stoppage time
  if (min > 90 && min <= 97 && espnStatus === 'STATUS_SECOND_HALF') {
    emit('ft_added_time', min);
  }

  // Extra time
  if (espnStatus === 'STATUS_FIRST_EXTRA') {
    emit('et_start', min);
    if (min >= 103 && min <= 108) emit('et_ht_added', min);
  }
  if (espnStatus === 'STATUS_SECOND_EXTRA') {
    if (!alreadyEmitted.has('et_halftime')) emit('et_halftime', 105);
    if (min > 120 && min <= 127) emit('et_ft_added', min);
  }
  if (espnStatus === 'STATUS_SHOOTOUT') emit('penalty_shootout', 120);

  return moments;
}

// ─── Repricing Importance Score 0-100 ────────────────────────────────────────

function scoreImportance(type, minute, state) {
  const { homeScore = 0, awayScore = 0 } = state ?? {};
  const scoreDiff = Math.abs(homeScore - awayScore);
  const late = minute >= 70;

  switch (type) {
    case 'goal': {
      // Goal scored in an even match is more critical than during a blowout
      let base = 80;
      if (scoreDiff === 0) base = 95; // Tiebreaker goal
      if (late && scoreDiff <= 1) base = Math.min(100, base + 10);
      return base;
    }
    case 'red_card':
      return late ? 95 : 85;
    case 'goal_disallowed':
      return late ? 75 : 60;
    case 'woodwork':
      return late && scoreDiff === 0 ? 70 : 50;
    case 'substitution_raw': {
      // Trailing team + late substitution = high importance
      let base = 40;
      if (late) base += 20;
      if (scoreDiff >= 1 && late) base += 15; // Chasing sub
      return Math.min(100, base);
    }
    default:
      return 30;
  }
}

function structuralImportance(type) {
  const map = {
    kickoff: 50, halftime: 70, second_half_start: 55,
    ht_added_time: 45, ft_added_time: 65,
    hydration_break: 40,
    et_start: 80, et_halftime: 75, et_ht_added: 60,
    et_ft_added: 70, et_fulltime: 85, penalty_shootout: 100,
    fulltime: 80,
  };
  return map[type] ?? 40;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Batch insert moments into DB, skipping duplicates idempotently (by match + type + minute)
 * @param {MomentRecord[]} moments
 * @returns {number} inserted count
 */
function persistMoments(moments) {
  if (!moments.length) return 0;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO match_moments
      (match_id, type, minute, minute_added, team_id, importance, source,
       score_state_json, raw_json,
       prob_home_win, prob_draw, prob_away_win,
       delta_home_win, delta_draw, delta_away_win,
       detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insert = db.transaction(rows => {
    let count = 0;
    for (const m of rows) {
      const r = stmt.run(
        m.matchId, m.type, m.minute, m.minuteAdded ?? 0,
        m.teamId ?? null, m.importance, m.source,
        JSON.stringify(m.scoreState ?? {}),
        JSON.stringify(m.raw ?? {}),
        m.probHomeWin  ?? null, m.probDraw    ?? null, m.probAwayWin  ?? null,
        m.deltaHomeWin ?? null, m.deltaDraw   ?? null, m.deltaAwayWin ?? null,
        m.detectedAt,
      );
      count += r.changes;
    }
    return count;
  });
  return insert(moments);
}

/**
 * Fetch all recorded moments for a match ordered chronologically
 */
function getMoments(matchId) {
  return db.prepare(`
    SELECT * FROM match_moments
    WHERE match_id = ?
    ORDER BY minute ASC, minute_added ASC, detected_at ASC
  `).all(String(matchId));
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function parseMinute(displayValue) {
  if (!displayValue) return 0;
  const m = String(displayValue).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function buildMoment(matchId, opts) {
  return {
    matchId: String(matchId),
    type: opts.type,
    minute: opts.minute ?? 0,
    minuteAdded: opts.minuteAdded ?? 0,
    teamId: opts.teamId ?? null,
    importance: opts.importance ?? 50,
    source: opts.source ?? 'unknown',
    scoreState: opts.scoreState ?? {},
    raw: opts.raw ?? {},
    detectedAt: new Date().toISOString(),
  };
}

module.exports = {
  detectFromEspn,
  detectFromFifa,
  detectStructural,
  persistMoments,
  getMoments,
  resolveEspnMomentType,
  scoreStateFromEspnGoal,
};
