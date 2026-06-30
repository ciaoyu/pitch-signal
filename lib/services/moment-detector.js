'use strict';

/**
 * Match Moment Detector
 *
 * 把 ESPN events + FIFA events 转换成结构化的 match_moments 记录。
 * 每个 moment 是一个触发点，对应预测重定价的信号。
 *
 * 触发点类型（按你的设计）：
 *   kickoff            开场
 *   goal               进球（立即重定价）
 *   goal_disallowed    被取消进球（警示信号，不改分）
 *   woodwork           门柱/横梁（威胁积累信号）
 *   red_card           红牌（重大重定价）
 *   yellow_card        黄牌（积累信号）
 *   hydration_break    补水时间（~30', ~75'）
 *   substitution_key   重要换人（评分 >= 60 时触发）
 *   halftime           45min 快照
 *   ht_added_time      上半场补时开始
 *   second_half_start  下半场开场
 *   fulltime           90min 快照
 *   ft_added_time      下半场补时开始
 *   et_start           加时赛开始
 *   et_halftime        加时上半场结束
 *   et_ht_added        加时上半场补时
 *   et_fulltime        加时结束（→ 点球大战）
 *   penalty_shootout   点球大战开始
 */

const { db } = require('../db');

// ─── ESPN event type → moment type 映射 ───────────────────────────────────────
// ESPN keyEvents type.text 值（来自 ESPN summary API）
const ESPN_TYPE_MAP = {
  'Goal':            'goal',
  'Goal (Penalty)':  'goal',
  'Own Goal':        'goal',
  'Red Card':        'red_card',
  'Yellow Card':     'yellow_card',
  'Substitution':    'substitution_raw',
  'VAR Review':      'goal_disallowed', // VAR 取消进球
  'Offside':         'goal_disallowed',
};

// FIFA MatchEvent Type 数字 → moment type
const FIFA_EVENT_MAP = {
  0:  'goal',
  2:  'yellow_card',
  3:  'red_card',
  5:  'substitution_raw',
  6:  'goal_disallowed',   // VAR
  65: 'goal',              // 乌龙球
};

/**
 * 从 ESPN summary keyEvents 数组提取 moments
 * @param {string} matchId
 * @param {Array}  keyEvents  - ESPN summary.keyEvents
 * @param {object} matchState - { homeScore, awayScore, status }
 * @returns {MomentRecord[]}
 */
function detectFromEspn(matchId, keyEvents, matchState) {
  if (!Array.isArray(keyEvents)) return [];
  const moments = [];

  for (const ev of keyEvents) {
    const typeName = ev.type?.text ?? ev.type ?? '';
    const momentType = ESPN_TYPE_MAP[typeName];
    if (!momentType) continue;

    const minute = parseMinute(ev.clock?.displayValue ?? ev.period?.displayValue ?? '');
    const teamId = ev.team?.id ?? null;

    const importance = scoreImportance(momentType, minute, matchState);

    // 换人：评分低于阈值不记录（避免噪音）
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
      scoreState: { home: matchState.homeScore ?? 0, away: matchState.awayScore ?? 0 },
    }));
  }

  return moments;
}

/**
 * 从 FIFA live match events 提取 moments
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
 * 合成结构性时刻（补水时间、半场、加时开始等）
 * 这些事件没有 ESPN/FIFA 的明确 event type，需要靠比赛时间推断
 *
 * @param {string} matchId
 * @param {number} currentMinute
 * @param {string} espnStatus     - ESPN status.type.name
 * @param {object} matchState
 * @param {Set}    alreadyEmitted - 已经生成过的结构性 moment 类型集合
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

  // 补水时间窗口（28-33' 和 73-78'）
  if (min >= 28 && min <= 33) emit('hydration_break', min, { half: 1 });
  if (min >= 73 && min <= 78) emit('hydration_break', min, { half: 2 });

  // 半场快照（进入下半场时）
  if (espnStatus === 'STATUS_SECOND_HALF' && !alreadyEmitted.has('halftime')) {
    emit('halftime', 45);
  }

  // 上半场补时
  if (min > 45 && min <= 50 && espnStatus === 'STATUS_FIRST_HALF') {
    emit('ht_added_time', min);
  }

  // 下半场补时
  if (min > 90 && min <= 97 && espnStatus === 'STATUS_SECOND_HALF') {
    emit('ft_added_time', min);
  }

  // 加时赛
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

// ─── 重定价重要性评分 0-100 ──────────────────────────────────────────────────

function scoreImportance(type, minute, state) {
  const { homeScore = 0, awayScore = 0 } = state ?? {};
  const scoreDiff = Math.abs(homeScore - awayScore);
  const late = minute >= 70;

  switch (type) {
    case 'goal': {
      // 均势下进球比大胜时进球更关键
      let base = 80;
      if (scoreDiff === 0) base = 95; // 打破平局
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
      // 落后队 + 晚期换人 = 高重要性
      let base = 40;
      if (late) base += 20;
      if (scoreDiff >= 1 && late) base += 15; // 追分换人
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

// ─── 持久化 ──────────────────────────────────────────────────────────────────

/**
 * 把 moments 批量写入 DB，重复（同 match + type + minute）幂等跳过
 * @param {MomentRecord[]} moments
 * @returns {number} 写入条数
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
 * 取一场比赛所有已记录的 moments（按时间顺序）
 */
function getMoments(matchId) {
  return db.prepare(`
    SELECT * FROM match_moments
    WHERE match_id = ?
    ORDER BY minute ASC, minute_added ASC, detected_at ASC
  `).all(String(matchId));
}

// ─── 工具 ────────────────────────────────────────────────────────────────────

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
};
