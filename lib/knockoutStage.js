/**
 * World Cup round stage normalization
 *
 * openfootball dataset round names are inconsistent across years (2010 uses "Quarterfinals"/
 * "Third-place play-off", 2022 uses "Quarter-finals"/"Match for third place").
 * This module normalizes them to the standardized vocabulary in data/history/worldcup_*.json:
 *   Group X / Round of 32 / Round of 16 / Quarter-finals / Semi-finals /
 *   Third place / Final / Final Round / First round
 *
 * Shared by scripts/fetch-worldcup-history.js (writes to stage field during conversion) and
 * lib/backtest.js (identifies knockout rounds).
 */

/**
 * Normalize round stage name
 * @param {string} round - raw round name (e.g., "Matchday 3", "Quarterfinals")
 * @param {string} [group] - group name (e.g., "Group A", "Group 1"), prioritized during group stage
 * @returns {string} standardized stage name
 */
function normalizeStage(round, group) {
  if (group) return group;
  // Remove replay suffixes like ", Replays" (e.g., 1938 "First round, Replays") --
  // replays belong to the same stage and do not need a separate stage value
  const cleaned = String(round || '').replace(/,\s*replays?\s*$/i, '').trim();
  const r = cleaned.toLowerCase();

  if (/round of 32/.test(r)) return 'Round of 32';
  if (/round of 16|eighth.?finals?/.test(r)) return 'Round of 16';
  if (/quarter.?finals?/.test(r)) return 'Quarter-finals';
  if (/semi.?finals?/.test(r)) return 'Semi-finals';
  if (/third.?place|match for third/.test(r)) return 'Third place';
  // 1950 Final Round was a 4-team round-robin ("Final Round"), not a single final match
  if (/final round/.test(r)) return 'Final Round';
  if (/^finals?$/.test(r)) return 'Final';

  // Keep remaining names as is (Matchday N without group, First round, Preliminary round, etc. after removing replay suffix)
  return cleaned;
}

/**
 * Detect knockout round from normalized stage name
 * Semantics match original inline logic in lib/backtest.js: Third place match is treated as SF
 * @param {string} stage
 * @returns {{ isKnockout: boolean, knockoutRound: string|null }}
 */
function detectKnockout(stage) {
  const s = String(stage || '').toLowerCase();

  // "Final Round" (1950 round-robin) is not a knockout match and must be excluded prior to checking "final"
  if (/final round/.test(s)) return { isKnockout: false, knockoutRound: null };

  if (/round of 32/.test(s)) return { isKnockout: true, knockoutRound: 'R32' };
  if (/round of 16/.test(s)) return { isKnockout: true, knockoutRound: 'R16' };
  if (/quarter.?finals?/.test(s)) return { isKnockout: true, knockoutRound: 'QF' };
  if (/semi.?finals?|third.?place/.test(s)) return { isKnockout: true, knockoutRound: 'SF' };
  if (/^finals?$/.test(s)) return { isKnockout: true, knockoutRound: 'F' };

  // Live schedule snapshot (match_snapshot_schedule.json) labels every
  // elimination fixture coarsely as "knockout" without naming the round.
  // Treat it as a knockout match; the engine falls back to the QF-average
  // shrinkage (poisson.js) since no specific round is available.
  if (/knockout/.test(s)) return { isKnockout: true, knockoutRound: null };

  return { isKnockout: false, knockoutRound: null };
}

module.exports = { normalizeStage, detectKnockout };
