/**
 * Player-level match event extraction + persistence (KO-4)
 *
 * Extracts goal/assist/card events for individual players from an ESPN
 * match summary's `keyEvents`, and persists them idempotently into the
 * `player_match_events` table. This is the single source of truth that feeds
 * both the suspension ledger (KO-4) and the star-form signal (KO-11).
 *
 * Idempotency: the table has UNIQUE(match_id, player_name, event_type,
 * minute, minute_added), so INSERT OR IGNORE makes re-runs safe.
 */

// Classify an ESPN keyEvent into one of our event_types (or null to skip).
// Splits yellow vs red explicitly and detects a second-yellow sending-off.
//
// IMPORTANT: ESPN reports a second-yellow sending-off as `type.text = "Yellow
// Card"` with `text = "Second Yellow Card"` — i.e. a *yellow* card type, not a
// red. So the second-yellow check must run BEFORE the generic yellow match,
// otherwise it would be misclassified as a plain yellow and the suspension
// ledger would under-count accumulated cards.
function classifyPlayerEventType(typeText, text) {
  const t = String(typeText || '').toLowerCase();
  const full = `${typeText || ''} ${text || ''}`.toLowerCase();

  if (/second yellow|2nd yellow|segunda (tarjeta )?amarilla|doubled? (booking|yellow)/.test(full)) {
    return 'secondyellow';
  }
  if (/red/.test(t)) return 'red';
  if (/yellow/.test(t)) return 'yellow';
  if (/assist/.test(t)) return 'assist';
  if (/goal/.test(t)) return 'goal';
  return null;
}

// Parse an ESPN clock displayValue ("45'+2'") into base minute + added time.
function parseClock(displayValue) {
  const s = String(displayValue || '');
  const m = s.match(/(\d+)'(?:\+(\d+))?'/);
  if (m) return { minute: parseInt(m[1], 10), minuteAdded: m[2] ? parseInt(m[2], 10) : 0 };
  const n = s.match(/(\d+)/);
  return { minute: n ? parseInt(n[1], 10) : 0, minuteAdded: 0 };
}

// Derive the standardized round vocabulary (Group / Round of 32 / Round of 16 /
// Quarter-finals / Semi-finals / Third place / Final) from an ESPN summary.
//
// ESPN's site-api summary carries the stage in `header.season.name`, e.g.
// "2026 FIFA World Cup, Group Stage" / "...Round of 32" / "...Final". This MUST
// be shared by both the backfill and the live moment-sync capture so they store
// identical `round` strings — otherwise INSERT OR IGNORE would treat the same
// card as two distinct rows (round is not part of the UNIQUE key).
const { normalizeStage } = require('../knockoutStage');
function roundFromSummary(data) {
  const seasonName = data?.header?.season?.name;
  const stageName =
    seasonName ||
    data?.competitions?.[0]?.stage?.name ||
    data?.competitions?.[0]?.stage ||
    data?.header?.stage?.name;
  if (!stageName) return null;
  const s = String(stageName);
  if (/group stage/i.test(s)) return 'Group';
  return normalizeStage(s);
}

/**
 * Extract player events from an ESPN summary's keyEvents array.
 *
 * @param {string} matchId
 * @param {Array} keyEvents - ESPN summary.keyEvents
 * @param {object} meta - { homeTeamId, awayTeamId, stage, round }
 * @returns {Array} normalized player events
 */
function extractPlayerEvents(matchId, keyEvents, meta = {}) {
  if (!Array.isArray(keyEvents)) return [];
  const out = [];
  for (const ev of keyEvents) {
    const typeText = ev?.type?.text ?? ev?.type ?? '';
    const eventType = classifyPlayerEventType(typeText, ev?.text);
    if (!eventType) continue; // skip goals-against/subs/shots/etc. for player ledger

    // The primary participant is the player the event is about (scorer /
    // assister / booked player). assist keyEvents carry the assister.
    const athlete = ev?.participants?.[0]?.athlete;
    const playerName = athlete?.displayName ?? null;
    const playerId = athlete?.id ?? null;
    if (!playerName) continue; // cannot attribute without a name

    const teamId = ev?.team?.id ?? meta?.homeTeamId ?? meta?.awayTeamId ?? null;
    const { minute, minuteAdded } = parseClock(ev?.clock?.displayValue ?? ev?.period?.displayValue);

    out.push({
      match_id: String(matchId),
      team_id: teamId ? String(teamId) : null,
      player_name: playerName,
      player_id: playerId ? String(playerId) : null,
      event_type: eventType,
      minute,
      minute_added: minuteAdded,
      stage: meta?.stage ?? null,
      round: meta?.round ?? null,
      raw_json: JSON.stringify({ text: ev?.text ?? null, typeText }),
    });
  }
  return out;
}

/**
 * Idempotently persist player events.
 * @param {Array} events
 * @param {object} [db] - optional DB override (defaults to lib/db)
 * @returns {number} number of rows (attempted)
 */
function upsertPlayerEvents(events, db) {
  if (!events || events.length === 0) return 0;
  const database = db || require('../db').db;
  const stmt = database.prepare(
    `INSERT OR IGNORE INTO player_match_events
       (match_id, team_id, player_name, player_id, event_type, minute, minute_added, stage, round, raw_json)
     VALUES (@match_id, @team_id, @player_name, @player_id, @event_type, @minute, @minute_added, @stage, @round, @raw_json)`
  );
  let inserted = 0;
  const tx = database.transaction((evs) => {
    for (const e of evs) {
      const info = stmt.run({
        match_id: e.match_id,
        team_id: e.team_id ?? null,
        player_name: e.player_name,
        player_id: e.player_id ?? null,
        event_type: e.event_type,
        minute: e.minute ?? 0,
        minute_added: e.minute_added ?? 0,
        stage: e.stage ?? null,
        round: e.round ?? null,
        raw_json: e.raw_json ?? null,
      });
      inserted += info.changes; // INSERT OR IGNORE => changes=0 when duplicate
    }
  });
  tx(events);
  return inserted;
}

module.exports = { classifyPlayerEventType, parseClock, roundFromSummary, extractPlayerEvents, upsertPlayerEvents };
