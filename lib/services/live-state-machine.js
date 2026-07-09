/**
 * live-state-machine.js — Live match state machine loop (pre/match/ht/et/pen/end)
 * Purpose: Unify ESPN/FIFA match statuses into a standard 6-state model for backend services and frontend rendering.
 */

const FINISHED_STATUSES = new Set([
  'STATUS_FINAL',
  'STATUS_FULL_TIME',
  'STATUS_POST',
  'STATUS_FINAL_PEN',
  'post',
  '0',
  0,
]);

/**
 * Map raw ESPN/FIFA match statuses to standard 6-state machine:
 * @param {Object} opts
 * @param {string|number} [opts.statusName] - ESPN status name (e.g. 'STATUS_FIRST_HALF', 'STATUS_HALFTIME')
 * @param {string} [opts.statusState] - ESPN macro state (e.g. 'in', 'pre', 'post')
 * @param {string} [opts.statusDetail] - Description or note (e.g. "45'", "HT", "Pens")
 * @param {number|string} [opts.minute] - Elapsed match time in minutes
 * @param {string} [opts.displayClock] - Match display clock (e.g. "45'+2'", "68'")
 * @param {boolean} [opts.hasPenalties] - Whether match went to penalty shootout
 * @returns {{ state: 'pre'|'match'|'ht'|'et'|'pen'|'end', label: string, period: number, clock: string }}
 */
function resolveMatchState({
  statusName = '',
  statusState = '',
  statusDetail = '',
  minute = 0,
  displayClock = '',
  hasPenalties = false,
} = {}) {
  const name = String(statusName).trim();
  const stateStr = String(statusState).trim().toLowerCase();
  const detail = String(statusDetail).trim();
  const min = parseInt(minute, 10) || 0;
  const clockStr = String(displayClock).trim() || (min > 0 ? `${min}'` : '');

  // ── 1. End state (end) ──────────────────────────────────────────────────────────
  if (
    FINISHED_STATUSES.has(name) ||
    stateStr === 'post' ||
    name === '0' ||
    name === 'STATUS_FINAL_PEN'
  ) {
    const isPenResult = hasPenalties || name === 'STATUS_FINAL_PEN' || detail.includes('Pens') || detail.includes('Penalties');
    return {
      state: 'end',
      label: isPenResult ? 'FT-Pens' : 'FT',
      period: isPenResult ? 5 : 2,
      clock: 'FT',
    };
  }

  // ── 2. Penalty shootout (pen) ──────────────────────────────────────────────────────
  if (
    name === 'STATUS_SHOOTOUT' ||
    name === 'STATUS_PENALTY' ||
    (stateStr === 'in' && (detail.toLowerCase().includes('pens') || detail.toLowerCase().includes('shootout')))
  ) {
    return {
      state: 'pen',
      label: 'PENS',
      period: 5,
      clock: clockStr || '120\'',
    };
  }

  // ── 3. Extra time (et) ─────────────────────────────────────────────────────────
  if (
    name === 'STATUS_FIRST_EXTRA' ||
    name === 'STATUS_SECOND_EXTRA' ||
    name === 'STATUS_HALFTIME_ET' ||
    (stateStr === 'in' && (detail.toLowerCase().includes('et') || detail.toLowerCase().includes('extra') || min > 90))
  ) {
    let period = 3;
    if (name === 'STATUS_SECOND_EXTRA' || min > 105) period = 4;
    let label = 'ET';
    if (name === 'STATUS_HALFTIME_ET') {
      label = 'ET HT';
    } else if (clockStr) {
      label = `ET ${clockStr}`;
    } else if (min > 0) {
      label = `ET ${min}'`;
    }
    return {
      state: 'et',
      label,
      period,
      clock: clockStr || `${min}'`,
    };
  }

  // ── 4. Half-time break (ht) ───────────────────────────────────────────────────────
  if (
    name === 'STATUS_HALFTIME' ||
    name === 'STATUS_HALF_TIME' ||
    detail === 'HT' ||
    detail.toLowerCase().includes('halftime')
  ) {
    return {
      state: 'ht',
      label: 'HT',
      period: 1,
      clock: 'HT',
    };
  }

  // ── 5. In progress (match) ──────────────────────────────────────────────────────
  if (
    stateStr === 'in' ||
    stateStr === 'live' ||
    name === 'STATUS_FIRST_HALF' ||
    name === 'STATUS_SECOND_HALF' ||
    name === 'STATUS_IN_PROGRESS' ||
    min > 0 ||
    clockStr
  ) {
    const period = name === 'STATUS_SECOND_HALF' || min > 45 ? 2 : 1;
    const label = clockStr ? `LIVE ${clockStr}` : min > 0 ? `LIVE ${min}'` : 'LIVE';
    return {
      state: 'match',
      label,
      period,
      clock: clockStr || `${min}'`,
    };
  }

  // ── 6. Pre-match (pre) ──────────────────────────────────────────────────────────
  return {
    state: 'pre',
    label: 'PRE',
    period: 0,
    clock: '',
  };
}

module.exports = {
  resolveMatchState,
  FINISHED_STATUSES,
};
