/**
 * live-state-machine.js — 实时比赛状态机闭环 (pre/match/ht/et/pen/end)
 * 解决问题：统一 ESPN / FIFA 比赛状态为标准的 6 态模型，供后端服务和前端界面渲染使用。
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
 * 将 ESPN / FIFA 的原始比赛状态映射至标准的 6 态状态机：
 * @param {Object} opts
 * @param {string|number} [opts.statusName] - ESPN 状态名称 (e.g. 'STATUS_FIRST_HALF', 'STATUS_HALFTIME')
 * @param {string} [opts.statusState] - ESPN 大状态 (e.g. 'in', 'pre', 'post')
 * @param {string} [opts.statusDetail] - 描述或附言 (e.g. "45'", "HT", "Pens")
 * @param {number|string} [opts.minute] - 比赛进行时间（分钟）
 * @param {string} [opts.displayClock] - 比赛展示时钟 (e.g. "45'+2'", "68'")
 * @param {boolean} [opts.hasPenalties] - 是否进入点球决胜
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

  // ── 1. 终场 end ──────────────────────────────────────────────────────────
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

  // ── 2. 点球大战 pen ──────────────────────────────────────────────────────
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

  // ── 3. 加时赛 et ─────────────────────────────────────────────────────────
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

  // ── 4. 中场休息 ht ───────────────────────────────────────────────────────
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

  // ── 5. 进行中 match ──────────────────────────────────────────────────────
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

  // ── 6. 赛前 pre ──────────────────────────────────────────────────────────
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
