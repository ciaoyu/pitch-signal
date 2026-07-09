/**
 * Suspension ledger rules engine (KO-4)
 *
 * Pure, DB-independent logic that turns a player's card history into a
 * suspension / one-yellow-risk verdict for an upcoming match.
 *
 * Rules are grounded in the FIFA World Cup 2026 card regulations
 * (FIFA official article "When will yellow cards reset at FIFA World Cup 2026?"):
 *   - Single yellow cards are CANCELLED after the group stage (entering R16)
 *     AND AGAIN after the quarter-finals (entering SF). The expanded 48-team
 *     format resets TWICE (previously only once, post-QF).
 *   - Two yellow cards in DIFFERENT matches before a reset => 1-match ban.
 *   - A straight red card => minimum 1-match ban, with any additional ban
 *     subject to the FIFA disciplinary committee (flagged pendingDisciplinary).
 *   - Two yellows in the SAME match => sending-off (treated as a red), and the
 *     two bookings are CONSUMED by the sending-off — they do NOT also count as
 *     two accumulated yellows toward a future ban.
 *   - A sending-off bans ONLY the next match; once the team has advanced
 *     through the subsequent round the ban is served and the player is no
 *     longer flagged for future fixtures.
 *
 * This module does NOT touch the prediction model (usedInModel is always false
 * downstream). It only produces a display/bot signal.
 */

// 2026 FIFA: single yellows are CANCELLED AFTER the group stage (entering R32)
// and AGAIN AFTER the quarter-finals (entering SF). The expanded 48-team format
// resets the accumulation window TWICE. R32 yellows survive the first reset
// (they occur after the group-stage reset) and are only wiped by the QF reset.
// These are the rounds AFTER which the accumulation window restarts.
const YELLOW_CARD_RESET_AFTER_ROUNDS = ['Group', 'Quarter-finals'];

// Tournament round ordering (2026 expanded format).
const ROUND_ORDER = {
  'Group': 0,
  'Round of 32': 1,
  'Round of 16': 2,
  'Quarter-finals': 3,
  'Semi-finals': 4,
  'Final': 5,
  'Third place': 5,
};

function roundOrder(round) {
  if (!round) return -1;
  // Normalize "Group X" to the base 'Group' bucket.
  const base = String(round).startsWith('Group') ? 'Group' : String(round);
  return ROUND_ORDER[base] != null ? ROUND_ORDER[base] : -1;
}

// The order of the most recent reset round that is STRICTLY before the target
// round. Yellows from rounds with order <= this value are wiped for any match
// at/after the target round. Returns -1 if no reset has occurred yet (before
// the first reset, i.e. group stage).
function resetOrderBefore(targetRound) {
  const target = roundOrder(targetRound);
  let best = -1;
  for (const r of YELLOW_CARD_RESET_AFTER_ROUNDS) {
    const o = roundOrder(r);
    if (o < target) best = Math.max(best, o);
  }
  return best;
}

// A sending-off (straight red or second-yellow) bans ONLY the immediately
// following round. Once the team has advanced through that round the ban is
// served and the player must NOT be flagged for any later fixture. We detect
// "active" by comparing round orders: a sending-off in round O bans round O+1,
// so it is active only when the assessed round is exactly one step after it.
// Unknown rounds fall back to "active" (conservative - flags the player) so we
// never silently un-suspend someone when round info is missing.
function sendingOffIsActive(sendingOffRound, nextRound) {
  const o = roundOrder(sendingOffRound);
  const target = roundOrder(nextRound);
  if (o < 0 || target < 0) return true;
  return target === o + 1;
}

/**
 * Evaluate a single player's suspension status for an upcoming match.
 *
 * @param {Array} events - player card events from COMPLETED matches.
 *        Each: { match_id, round, event_type } where event_type ∈
 *        'yellow' | 'red' | 'secondyellow' (goal/assist ignored by caller).
 * @param {object} opts
 * @param {string} [opts.nextRound] - round of the match being assessed
 *        (assumed to be the immediate next match after the player's latest
 *        completed match). Drives the yellow-card reset window.
 * @returns {{ suspended:boolean, reason:?string, pendingDisciplinary:boolean,
 *            yellowCount:number, atRisk:boolean, windowReset:boolean }}
 */
function evaluatePlayerSuspension(events, opts = {}) {
  const nextRound = opts.nextRound;
  const all = (events || []).filter((e) => roundOrder(e.round) >= 0);
  const reset = resetOrderBefore(nextRound);

  // Sending-offs (red / second-yellow) are INDEPENDENT of the yellow reset: a
  // red always bans the next match regardless of which accumulation window it
  // falls in. Detect the second-yellow sending-off from the FULL history.
  // Collect the round of each same-match double-yellow so we can test whether
  // its ban is still active (not yet served) for the assessed round.
  const byMatchAll = new Map();
  for (const e of all) {
    if (!byMatchAll.has(e.match_id)) byMatchAll.set(e.match_id, []);
    byMatchAll.get(e.match_id).push(e);
  }
  const secondYellowMatchRounds = [];
  for (const evs of byMatchAll.values()) {
    const yellows = evs.filter((e) => e.event_type === 'yellow').length;
    const hasRed = evs.some((e) => e.event_type === 'red' || e.event_type === 'secondyellow');
    if (yellows >= 2 && !hasRed) secondYellowMatchRounds.push(evs[0].round);
  }

  // Straight/second-yellow reds (never wiped by the yellow reset), filtered to
  // those whose 1-match ban is still active for the assessed round.
  const reds = all.filter((e) => e.event_type === 'red' || e.event_type === 'secondyellow');
  const activeReds = reds.filter((e) => sendingOffIsActive(e.round, nextRound));
  const activeSecondYellow = secondYellowMatchRounds.some((r) => sendingOffIsActive(r, nextRound));

  // Accumulated yellows for the 2-yellow threshold: only yellows AFTER the
  // reset boundary count; exclude any match that was a second-yellow
  // sending-off (those yellows were consumed by the red).
  const byMatchActive = new Map();
  for (const e of all) {
    if (roundOrder(e.round) <= reset) continue; // wiped by reset
    if (!byMatchActive.has(e.match_id)) byMatchActive.set(e.match_id, []);
    byMatchActive.get(e.match_id).push(e);
  }
  let yellowCount = 0;
  for (const evs of byMatchActive.values()) {
    const yellows = evs.filter((e) => e.event_type === 'yellow').length;
    const hasRed = evs.some((e) => e.event_type === 'red' || e.event_type === 'secondyellow');
    if (yellows >= 2 && !hasRed) continue; // consumed by sending-off
    yellowCount += yellows;
  }

  let suspended = false;
  let reason = null;
  let pendingDisciplinary = false;

  if (activeReds.length > 0) {
    suspended = true;
    reason = activeReds.some((e) => e.event_type === 'red') ? 'red' : 'second_yellow';
    pendingDisciplinary = activeReds.some((e) => e.event_type === 'red'); // straight red => committee review
  } else if (activeSecondYellow) {
    suspended = true;
    reason = 'second_yellow';
  } else if (yellowCount >= 2) {
    suspended = true;
    reason = 'two_yellow';
  }

  const atRisk = !suspended && yellowCount === 1;

  return {
    suspended,
    reason,
    pendingDisciplinary,
    yellowCount,
    atRisk,
    windowReset: resetOrderBefore(nextRound) >= 0,
  };
}

/**
 * Evaluate a roster's players and split into suspended / at-risk lists.
 *
 * @param {Array} playerEvents - flat list of { player_name, team_id, round, event_type, match_id }
 * @param {object} opts
 * @param {string} opts.nextRound
 * @param {string} [opts.homeTeamId] - team_id (ESPN) of the home side
 * @param {string} [opts.awayTeamId]
 * @returns {{ suspended:{home:Array,away:Array}, atRisk:{home:Array,away:Array} }}
 */
function evaluateRoster(playerEvents, opts = {}) {
  const byPlayer = new Map();
  for (const e of (playerEvents || [])) {
    if (!e.player_name) continue;
    if (!byPlayer.has(e.player_name)) {
      byPlayer.set(e.player_name, { team_id: e.team_id, events: [] });
    }
    byPlayer.get(e.player_name).events.push({
      match_id: e.match_id,
      round: e.round,
      event_type: e.event_type,
    });
  }

  const out = {
    suspended: { home: [], away: [] },
    atRisk: { home: [], away: [] },
  };

  for (const [playerName, rec] of byPlayer) {
    const side = rec.team_id === opts.homeTeamId ? 'home'
      : rec.team_id === opts.awayTeamId ? 'away'
      : null;
    if (!side) continue;

    const v = evaluatePlayerSuspension(rec.events, { nextRound: opts.nextRound });
    const entry = { player: playerName, yellowCount: v.yellowCount, reason: v.reason, pendingDisciplinary: v.pendingDisciplinary };

    if (v.suspended) out.suspended[side].push(entry);
    else if (v.atRisk) out.atRisk[side].push(entry);
  }

  return out;
}

/**
 * Build the knockout-intel `suspensions` section for a match.
 *
 * Output conforms to the KO batch section contract (knockout-intel-plan):
 *   { confidence, source, usedInModel:false, note:{zh,en},
 *     home:{ out:[...], atRisk:[...] }, away:{ out:[...], atRisk:[...] } }
 * where each `out` entry is { player, playerZh, reason:{zh,en}, bansRemaining,
 * pendingDisciplinary } and `atRisk` entries drop bansRemaining.
 *
 * Reads player_match_events from the DB, evaluates both rosters, and returns a
 * display/bot-ready section. Chinese names are resolved via player-name-zh.
 * Returns null when neither team has any suspended/at-risk player (the consumer
 * then skips this section, per the contract's "section-absent = skip" rule).
 *
 * @param {object} params
 * @param {string} params.matchId
 * @param {string} [params.homeTeamId] - ESPN team id
 * @param {string} [params.awayTeamId]
 * @param {string} [params.homeName]
 * @param {string} [params.awayName]
 * @param {string} [params.nextRound] - round of the upcoming fixture
 * @param {object} [params.db] - optional DB override (defaults to lib/db)
 * @returns {object|null} section object, or null if no data
 */
const REASON_TEXT = {
  red:          { zh: '直红停赛', en: 'straight red' },
  second_yellow:{ zh: '两黄变红停赛', en: 'second-yellow sending-off' },
  two_yellow:   { zh: '两黄停赛', en: '2 yellows' },
};

function buildSuspensionsSection(params = {}) {
  const { matchId, homeTeamId, awayTeamId, homeName, awayName, nextRound } = params;
  if (!matchId) return null;
  let db;
  try {
    db = params.db || require('./db').db;
  } catch (_) {
    return null;
  }

  let rows = [];
  try {
    rows = db.prepare(
      `SELECT player_name, team_id, event_type, round, match_id
       FROM player_match_events
       WHERE team_id = ? OR team_id = ?`
    ).all(homeTeamId || '', awayTeamId || '');
  } catch (_) {
    return null;
  }

  // The section covers the two teams' players across the tournament.
  const rosterEvents = rows.map((r) => ({
    player_name: r.player_name,
    team_id: r.team_id,
    event_type: r.event_type,
    round: r.round,
    match_id: r.match_id,
  }));

  const result = evaluateRoster(rosterEvents, { nextRound, homeTeamId, awayTeamId });

  let nameZh;
  try { nameZh = require('./player-name-zh'); } catch (_) { nameZh = null; }
  const zh = (n) => (nameZh && nameZh.lookup ? nameZh.lookup(n) : null) || n;

  // Suspended / out entries include bansRemaining (minimum 1; straight reds may
  // be extended by the FIFA committee — flagged via pendingDisciplinary).
  const decorateOut = (list) => list.map((e) => ({
    player: e.player,
    playerZh: zh(e.player),
    reason: REASON_TEXT[e.reason] || { zh: '停赛', en: 'suspended' },
    bansRemaining: 1,
    pendingDisciplinary: !!e.pendingDisciplinary,
  }));
  const decorateRisk = (list) => list.map((e) => ({
    player: e.player,
    playerZh: zh(e.player),
    reason: e.reason ? (REASON_TEXT[e.reason] || { zh: '停赛风险', en: 'suspension risk' }) : { zh: '一黄在身', en: 'one yellow' },
    pendingDisciplinary: !!e.pendingDisciplinary,
  }));

  const outHome = decorateOut(result.suspended.home);
  const outAway = decorateOut(result.suspended.away);
  const riskHome = decorateRisk(result.atRisk.home);
  const riskAway = decorateRisk(result.atRisk.away);

  if (
    outHome.length === 0 && outAway.length === 0 &&
    riskHome.length === 0 && riskAway.length === 0
  ) {
    return null;
  }

  // Contract: confidence "high" when anyone is actually out, else "medium"
  // (only at-risk). ESPN player attribution can be incomplete, so we never claim
  // more than "high" here (coverage caveat documented in the plan).
  const confidence = (outHome.length + outAway.length) > 0 ? 'high' : 'medium';

  return {
    confidence,
    source: 'espn-events+fifa-rules',
    usedInModel: false,
    note: {
      zh: '依据 FIFA 2026 规程：黄牌于小组赛后及 1/4 决赛后两次清零；隔场两黄停一场；直红至少停一场（追加处罚待纪律委员会裁定）。',
      en: 'Per FIFA 2026: yellows reset after the group stage AND after the QFs; 2 yellows in different matches = 1-match ban; straight red = min 1-match ban (further ban pending committee).',
    },
    home: { out: outHome, atRisk: riskHome },
    away: { out: outAway, atRisk: riskAway },
    meta: { homeName, awayName, nextRound },
  };
}

module.exports = {
  YELLOW_CARD_RESET_AFTER_ROUNDS,
  ROUND_ORDER,
  roundOrder,
  resetOrderBefore,
  sendingOffIsActive,
  evaluatePlayerSuspension,
  evaluateRoster,
  buildSuspensionsSection,
};
