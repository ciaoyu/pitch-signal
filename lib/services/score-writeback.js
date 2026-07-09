'use strict';

/**
 * Score Writeback Service
 *
 * Handles writing final match scores back to SQLite matches table (home_score, away_score, played = 1).
 *
 * Core design principles:
 * 1. Authority priority: prefer FIFA API final score/events, fall back to ESPN score if unavailable.
 * 2. Strict idempotency: if matches record already has played = 1 with valid score, never overwrite on repeated calls.
 * 3. Boundary compliance: does not alter live state machine, prediction formulas, or penalty shootout winner semantics (records regular + ET goals only).
 */

const { db } = require('../db');
const teamResolver = require('../team_resolver');

const FINISHED_STATUSES = new Set([
  'STATUS_FINAL',
  'STATUS_FULL_TIME',
  'post',
  'finished',
  '0', // FIFA MatchStatus 0 = finished
]);

/**
 * Resolve team input (ESPN Team ID / FIFA Code / Team Name) to ratings_id used in matches table
 * @param {string|number} teamInput
 * @returns {string|null}
 */
function resolveTeamToRatingsId(teamInput) {
  if (teamInput === null || teamInput === undefined || teamInput === '') return null;
  const str = String(teamInput).trim();
  
  // 1. Prefer lookup by ESPN ID
  const byEspnId = teamResolver.getRatingsIdByEspnId(str);
  if (byEspnId) return byEspnId;

  // 2. Fallback to full name and abbreviation resolver
  const resolved = teamResolver.resolve(str);
  return resolved ? resolved.ratings_id : null;
}

/**
 * Execute final score writeback
 * @param {object} opts
 * @param {string|number} [opts.espnId] - ESPN match ID
 * @param {string|number} opts.homeTeam - Home team name/ID/abbr
 * @param {string|number} opts.awayTeam - Away team name/ID/abbr
 * @param {number|string} opts.homeScore - Final home score
 * @param {number|string} opts.awayScore - Final away score
 * @param {string|number} [opts.statusName] - Match status descriptor (e.g. 'STATUS_FINAL', 'post', 0)
 * @param {string} [opts.matchDate] - Match date prefix 'YYYY-MM-DD'
 * @param {string} [opts.source] - Score data source ('fifa' | 'espn')
 * @param {string} [opts.stage] - Stage label (e.g. 'R32'/'QF'/'SF'/'Final'); written to matches.stage
 *   on knockout upsert insert. Falls back to 'Knockout' if missing.
 * @param {string} [opts.venue] - Match venue name (optional)
 * @param {object} [opts.logger] - Logger instance
 * @returns {object} result `{ success: boolean, updated: boolean, inserted?: boolean, reason?: string, matchId?: number, stage?: string }`
 */
function writebackMatchScore(opts) {
  const {
    espnId = null,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    statusName = 'STATUS_FINAL',
    matchDate = null,
    stage = null,
    venue = null,
    source = 'unknown',
    logger = console,
  } = opts || {};

  // 1. Validate finished status
  if (statusName === null || statusName === undefined || statusName === '' || !FINISHED_STATUSES.has(String(statusName).trim())) {
    return { success: false, updated: false, reason: 'not_finished' };
  }

  // 2. Validate score numeric validity
  const numHomeScore = Number.parseInt(homeScore, 10);
  const numAwayScore = Number.parseInt(awayScore, 10);
  if (!Number.isFinite(numHomeScore) || !Number.isFinite(numAwayScore)) {
    if (logger && logger.warn) {
      logger.warn(`[score-writeback] Invalid scores received: home=${homeScore}, away=${awayScore}`);
    }
    return { success: false, updated: false, reason: 'invalid_score' };
  }

  // 3. Resolve teams to DB matches table ratings_id
  const homeId = resolveTeamToRatingsId(homeTeam);
  const awayId = resolveTeamToRatingsId(awayTeam);
  if (!homeId || !awayId) {
    if (logger && logger.warn) {
      logger.warn(`[score-writeback] Failed to resolve teams: homeInput="${homeTeam}" -> ${homeId}, awayInput="${awayTeam}" -> ${awayId}`);
    }
    return { success: false, updated: false, reason: 'team_resolve_failed' };
  }

  if (homeId === awayId) {
    return { success: false, updated: false, reason: 'identical_teams' };
  }

  // 4. Query match rows in matches table
  const rows = db.prepare(`
    SELECT id, home_team_id, away_team_id, home_score, away_score, played, match_date
    FROM matches
    WHERE (home_team_id = ? AND away_team_id = ?)
       OR (home_team_id = ? AND away_team_id = ?)
  `).all(homeId, awayId, awayId, homeId);

  if (!rows || rows.length === 0) {
    // Knockout / unseeded schedule self-healing upsert:
    // Previously returned match_not_found here, causing all scores outside group stage
    // to silently fail writeback and remain missing from matches table.
    // Now inserts a new match row directly:
    // - group_id = NULL: SQL matches table is not authoritative schedule (bracket JSON is)
    // - stage: passed by caller (ESPN season.slug mapping); falls back to 'Knockout' if missing
    // - Idempotency: this branch only triggers when no matching row exists; subsequent calls hit step 6
    const writebackStage = (stage && String(stage).trim()) || 'Knockout';
    const insertStmt = db.prepare(`
      INSERT INTO matches (group_id, home_team_id, away_team_id, home_score, away_score, played, match_date, venue, stage)
      VALUES (NULL, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    const info = insertStmt.run(homeId, awayId, numHomeScore, numAwayScore, matchDate || null, venue || null, writebackStage);
    const newId = Number(info.lastInsertRowid);
    if (logger && logger.info) {
      logger.info(`[score-writeback] Upserted previously-missing match row id=${newId} (${homeId} ${numHomeScore}-${numAwayScore} ${awayId}), stage=${writebackStage}, source=${source}, espnId=${espnId || 'N/A'}`);
    }
    return {
      success: true,
      updated: true,
      inserted: true,
      reason: 'upserted_new_match',
      matchId: newId,
      homeScore: numHomeScore,
      awayScore: numAwayScore,
      stage: writebackStage,
    };
  }

  // If multiple matching records exist, sort by date and prefer unplayed (played=0) with closest date
  let targetRow = null;
  if (rows.length === 1) {
    targetRow = rows[0];
  } else {
    // If matchDate provided, prefer same date
    if (matchDate && typeof matchDate === 'string') {
      const datePrefix = matchDate.slice(0, 10);
      targetRow = rows.find(r => r.match_date && r.match_date.startsWith(datePrefix));
    }
    // Otherwise prefer first unplayed row
    if (!targetRow) {
      targetRow = rows.find(r => r.played === 0) || rows[0];
    }
  }

  // 5. Check if DB row direction is flipped relative to input (to avoid home/away swap)
  const isFlipped = (targetRow.home_team_id === awayId && targetRow.away_team_id === homeId);
  const dbHomeScore = isFlipped ? numAwayScore : numHomeScore;
  const dbAwayScore = isFlipped ? numHomeScore : numAwayScore;

  // 6. Idempotency and anti-overwrite check (Idempotency Guard)
  if (targetRow.played === 1 && targetRow.home_score !== null && targetRow.away_score !== null) {
    if (targetRow.home_score === dbHomeScore && targetRow.away_score === dbAwayScore) {
      // Identical score, return idempotent success
      return {
        success: true,
        updated: false,
        reason: 'already_written',
        matchId: targetRow.id,
        homeScore: targetRow.home_score,
        awayScore: targetRow.away_score,
      };
    } else {
      // Never overwrite existing correct record
      if (logger && logger.warn) {
        logger.warn(`[score-writeback] Idempotency guard: Match id=${targetRow.id} (${targetRow.home_team_id} vs ${targetRow.away_team_id}) is already completed with score ${targetRow.home_score}-${targetRow.away_score}. Refusing to overwrite with new score ${dbHomeScore}-${dbAwayScore} (source=${source}).`);
      }
      return {
        success: true,
        updated: false,
        reason: 'idempotent_protected',
        matchId: targetRow.id,
        homeScore: targetRow.home_score,
        awayScore: targetRow.away_score,
      };
    }
  }

  // 7. Execute transaction writeback
  const updateStmt = db.prepare(`
    UPDATE matches
    SET home_score = ?, away_score = ?, played = 1
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    updateStmt.run(dbHomeScore, dbAwayScore, targetRow.id);
  });
  tx();

  if (logger && logger.info) {
    logger.info(`[score-writeback] Successfully wrote back final score for match id=${targetRow.id} (${targetRow.home_team_id} ${dbHomeScore}-${dbAwayScore} ${targetRow.away_team_id}), source=${source}, espnId=${espnId || 'N/A'}`);
  }

  return {
    success: true,
    updated: true,
    matchId: targetRow.id,
    homeScore: dbHomeScore,
    awayScore: dbAwayScore,
  };
}

module.exports = {
  writebackMatchScore,
  resolveTeamToRatingsId,
  FINISHED_STATUSES,
};
