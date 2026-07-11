'use strict';

/**
 * Odds Milestone Collector
 *
 * Replaces two previous, uncontrolled the-odds-api call sites:
 *   1. lib/jobs/odds-collector.js's unconditional hourly "regular" poll (removed —
 *      provided no value beyond the 4 milestones below, at 6x the necessary cost).
 *   2. lib/routes/odds-divergence.js's live-compute-on-cache-miss fallback (removed —
 *      it ran on ordinary public page loads with zero auth, chaining up to 2 real
 *      the-odds-api requests per match on first view).
 *
 * Instead, odds are captured exactly once per (match, milestone) pair, driven by
 * the same restart-safe self-pacing loop as lib/match-snapshot-scheduler.js. A
 * single successful fetch feeds BOTH consumers of odds data:
 *   - MarketShadowLedger (research shadow ledger, read by scripts/audit-market-shadow-ledger.js)
 *   - match_odds_benchmark (the "model vs market" panel shown on the homepage /
 *     match-detail page, read by GET /api/odds-divergence/:matchId)
 *
 * Budget: 4 milestones x N remaining matches x 1 credit/call (single region,
 * single market — the only market any consumer reads is h2h).
 */

const fs = require('fs');
const path = require('path');
const teamResolver = require('../team_resolver');
// Requires the module object (not a destructured copy) so tests can stub
// fetchMatchOdds/getQuotaSnapshot by mutating the shared exports object.
const theOddsApiClient = require('./the-odds-api');
const MarketShadowLedger = require('./market-shadow-ledger');
const { computeDivergence, impliedProbabilitiesFromDecimal } = require('../routes/odds-divergence');

const MILESTONES = ['OPENING_LINE', 'T_MINUS_24H', 'LINEUP_ANNOUNCED', 'PRE_KICKOFF'];
const MILESTONE_OFFSET_MS = {
  T_MINUS_24H: 24 * 60 * 60 * 1000,
  LINEUP_ANNOUNCED: 60 * 60 * 1000,
  PRE_KICKOFF: 5 * 60 * 1000,
};
// Don't hammer the API while waiting for a bookmaker to post a line (or after a
// transient error) — retry at most once per window per milestone.
const RETRY_THROTTLE_MS = 6 * 60 * 60 * 1000;
// Mirrors the-odds-api.js's own safety margin so the wake scheduler can stop
// attempting new milestones once the account is nearly dry.
const MIN_QUOTA_REMAINING = 5;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function runsFilePath(dataDir) {
  return path.join(dataDir, 'odds_milestone_runs.json');
}

function getMatchState(runs, matchId) {
  runs.matches ||= {};
  runs.matches[matchId] ||= {};
  return runs.matches[matchId];
}

function isDue(milestone, kickoffMs, now, state) {
  if (state[milestone]?.capturedAt) return false;
  if (now >= kickoffMs) return false; // never fetch after kickoff (anti-leakage)
  const lastAttemptAt = state[milestone]?.lastAttemptAt ? Date.parse(state[milestone].lastAttemptAt) : 0;
  if (now - lastAttemptAt < RETRY_THROTTLE_MS) return false;
  if (milestone === 'OPENING_LINE') return true; // eligible as soon as we notice the match
  return now >= kickoffMs - MILESTONE_OFFSET_MS[milestone];
}

function upsertBenchmark(db, { matchId, modelProbs, marketProbs, oddsSource }) {
  const div = computeDivergence(modelProbs, marketProbs);
  if (!div) return;
  try {
    db.prepare(`
      INSERT INTO match_odds_benchmark
        (match_id, model_home_prob, model_draw_prob, model_away_prob,
         market_home_prob, market_draw_prob, market_away_prob,
         delta_home, delta_draw, delta_away, divergence_flag, odds_source,
         model_version, computed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(match_id) DO UPDATE SET
        model_home_prob=excluded.model_home_prob,
        model_draw_prob=excluded.model_draw_prob,
        model_away_prob=excluded.model_away_prob,
        market_home_prob=excluded.market_home_prob,
        market_draw_prob=excluded.market_draw_prob,
        market_away_prob=excluded.market_away_prob,
        delta_home=excluded.delta_home,
        delta_draw=excluded.delta_draw,
        delta_away=excluded.delta_away,
        divergence_flag=excluded.divergence_flag,
        odds_source=excluded.odds_source,
        computed_at=datetime('now'),
        updated_at=datetime('now')
    `).run(
      String(matchId),
      modelProbs.home, modelProbs.draw, modelProbs.away,
      marketProbs.home, marketProbs.draw, marketProbs.away,
      div.deltaHome, div.deltaDraw, div.deltaAway,
      div.divergence ? 1 : 0,
      oddsSource || 'the-odds-api',
      'v4'
    );
  } catch (e) {
    // Table missing or write failed — never let benchmark bookkeeping break
    // the milestone loop itself.
  }
}

async function captureOneMilestone({ match, milestone, predictionService, dataDir, db, logger }) {
  const apiKey = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY || '';
  if (!apiKey) return { status: 'no_key' };

  // Pure model prediction — free (served from the normal 5-min result cache),
  // and gives us the *current* team identity for this matchId. The static
  // schedule snapshot's team names can still be placeholders like "Round of 16
  // 3 Winner" before the bracket resolves; the live ESPN-backed prediction
  // always has the real teams once they're known.
  const pred = await predictionService.predictMatch(match.matchId, { includeExternalOdds: false });
  if (pred?.error || !pred?.match) return { status: 'model_unavailable', detail: pred?.error };

  const homeResolved = teamResolver.resolve(String(pred.match.homeId));
  const awayResolved = teamResolver.resolve(String(pred.match.awayId));
  const homeRatingsId = homeResolved?.ratings_id || pred.match.homeNameI18n?.en;
  const awayRatingsId = awayResolved?.ratings_id || pred.match.awayNameI18n?.en;
  if (!homeRatingsId || !awayRatingsId) return { status: 'team_unresolved' };

  let odds;
  try {
    odds = await theOddsApiClient.fetchMatchOdds(homeRatingsId, awayRatingsId, apiKey);
  } catch (e) {
    logger.warn(`odds-milestone: fetch failed for ${match.matchId}/${milestone}: ${e.message}`);
    return { status: 'error', detail: e.message };
  }

  // Bookmakers haven't posted a line for this fixture yet — not an error, just
  // not ready. Leaves the milestone uncaptured so it retries after the
  // throttle window instead of being marked done on empty data.
  if (!odds) return { status: 'not_listed_yet' };

  MarketShadowLedger.recordSnapshot({
    matchKey: `${homeRatingsId}_vs_${awayRatingsId}`,
    kickoffTime: match.kickoffUtc,
    bookmaker: odds.vendor,
    odds,
    rawResponse: odds,
    dataDir,
    milestone,
  });

  const modelProbs = {
    home: Number(pred.homeWin || 0),
    draw: Number(pred.draw || 0),
    away: Number(pred.awayWin || 0),
  };
  const marketProbs = impliedProbabilitiesFromDecimal(Number(odds.homeWin), Number(odds.draw), Number(odds.awayWin));
  if (marketProbs) {
    upsertBenchmark(db, { matchId: match.matchId, modelProbs, marketProbs, oddsSource: odds.source });
  }

  return { status: 'captured' };
}

/**
 * Run every (match, milestone) pair that is currently due. Intended to be
 * called from the same tick as lib/match-snapshot-scheduler.js so odds
 * collection shares its restart-safe, self-pacing loop.
 */
async function runDueOddsMilestones({ schedule, dataDir, db, predictionService, logger = console }) {
  if (!schedule?.length) return [];
  // Whole-feature gate, checked once: if unconfigured, don't touch any
  // per-milestone state at all. Marking a "lastAttemptAt" here would start the
  // retry-throttle clock for every match even though no real attempt was
  // made, delaying real collection by up to RETRY_THROTTLE_MS after a key is
  // finally added.
  if (!process.env.THE_ODDS_API_KEY && !process.env.ODDS_API_KEY) return [];
  const file = runsFilePath(dataDir);
  const runs = readJson(file, { matches: {} });
  const now = Date.now();
  const actions = [];

  for (const match of schedule) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs)) continue;
    const state = getMatchState(runs, match.matchId);

    for (const milestone of MILESTONES) {
      if (!isDue(milestone, kickoffMs, now, state)) continue;

      const quota = theOddsApiClient.getQuotaSnapshot();
      if (quota && Number.isFinite(quota.remaining) && quota.remaining <= MIN_QUOTA_REMAINING) {
        logger.warn(`odds-milestone: quota nearly exhausted (${quota.remaining} left) — pausing collection`);
        writeJson(file, runs);
        return actions;
      }

      state[milestone] ||= {};
      state[milestone].lastAttemptAt = new Date().toISOString();

      try {
        const result = await captureOneMilestone({ match, milestone, predictionService, dataDir, db, logger });
        if (result.status === 'captured') {
          state[milestone].capturedAt = new Date().toISOString();
          state[milestone].status = 'captured';
          actions.push(`odds_${milestone}:${match.matchId}`);
        } else {
          state[milestone].status = result.status;
        }
      } catch (e) {
        logger.error(`odds-milestone: unexpected error for ${match.matchId}/${milestone}: ${e.message}`);
        state[milestone].status = 'error';
      }
    }
  }

  writeJson(file, runs);
  return actions;
}

/**
 * Earliest future timestamp any remaining milestone becomes actionable, for
 * the scheduler's self-pacing wake delay. Returns null when nothing remains.
 */
function nextOddsWakeDelay(schedule, dataDir) {
  if (!schedule?.length) return null;
  const runs = readJson(runsFilePath(dataDir), { matches: {} });
  const now = Date.now();
  const candidates = [];

  for (const match of schedule) {
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (!Number.isFinite(kickoffMs) || kickoffMs <= now) continue;
    const state = runs.matches?.[match.matchId] || {};

    for (const milestone of MILESTONES) {
      if (state[milestone]?.capturedAt) continue;
      const lastAttemptAt = state[milestone]?.lastAttemptAt ? Date.parse(state[milestone].lastAttemptAt) : 0;
      const throttleFloor = lastAttemptAt + RETRY_THROTTLE_MS;
      const targetAt = milestone === 'OPENING_LINE' ? now : kickoffMs - MILESTONE_OFFSET_MS[milestone];
      const dueAt = Math.max(targetAt, throttleFloor);
      if (dueAt < kickoffMs) candidates.push(dueAt);
    }
  }

  const future = candidates.filter((v) => Number.isFinite(v) && v > now).sort((a, b) => a - b)[0];
  if (!future) return null;
  return Math.max(1000, future - now);
}

module.exports = { runDueOddsMilestones, nextOddsWakeDelay, MILESTONES };
