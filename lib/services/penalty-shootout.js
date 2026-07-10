'use strict';

/**
 * KO-8a: Penalty shootout round-by-round spike analysis
 *
 * Computes live win probability for a penalty shootout given the kicks so far,
 * and the per-round probability "spike" after each round of kicks. The model
 * assumes a configurable baseline kick success rate (professional average ~
 * 75%) for both sides in the absence of player-specific data.
 *
 * This module is display-only (`usedInModel: false`). Future work can feed the
 * computed `homeWin`/`awayWin` into live-reprice to replace its default 50/50
 * penalty assumption.
 */

const DEFAULT_SUCCESS_RATE = 0.75;
const REGULATION_ROUNDS = 5;

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

function kickSuccessRate(side, options = {}) {
  const rates = options.successRates || {};
  return rates[side] ?? options.successRate ?? DEFAULT_SUCCESS_RATE;
}

function memoKey(h, a, hRem, aRem, nextSide) {
  return `${h}|${a}|${hRem}|${aRem}|${nextSide}`;
}

function suddenDeathHomeWin(pHome, pAway) {
  // In sudden death, each round has:
  //   home wins:  pHome * (1 - pAway)
  //   away wins:  (1 - pHome) * pAway
  //   continue:   pHome * pAway + (1 - pHome) * (1 - pAway)
  // Conditional on the round ending, home's win probability is:
  const homeWinsRound = pHome * (1 - pAway);
  const awayWinsRound = (1 - pHome) * pAway;
  const denom = homeWinsRound + awayWinsRound;
  if (denom === 0) return 0.5; // degenerate: both always score or always miss
  return homeWinsRound / denom;
}

/**
 * Recursive DP probability that home wins the shootout from the given state.
 *
 * State: (homeScored, awayScored, homeRemaining, awayRemaining, nextSide)
 *   - homeRemaining/awayRemaining count kicks remaining in the current phase.
 *   - In regulation both start at 5; in sudden death both start at 1.
 *   - nextSide is 'home' or 'away'.
 */
function shootoutWinProbability(homeScored, awayScored, homeRemaining, awayRemaining, nextSide, options = {}) {
  const pHome = kickSuccessRate('home', options);
  const pAway = kickSuccessRate('away', options);
  const memo = new Map();

  function prob(h, a, hRem, aRem, side) {
    // Base cases: shootout already decided (team cannot be caught).
    if (h > a + aRem) return 1; // home has already won
    if (a > h + hRem) return 0; // away has already won

    // Tied after regulation (or tied after a completed sudden-death round) -> sudden death.
    if (hRem === 0 && aRem === 0 && h === a) {
      return suddenDeathHomeWin(pHome, pAway);
    }

    const key = memoKey(h, a, hRem, aRem, side);
    if (memo.has(key)) return memo.get(key);

    let result;
    if (side === 'home') {
      const hRem2 = Math.max(0, hRem - 1);
      result = pHome * prob(h + 1, a, hRem2, aRem, 'away')
             + (1 - pHome) * prob(h, a, hRem2, aRem, 'away');
    } else {
      const aRem2 = Math.max(0, aRem - 1);
      result = pAway * prob(h, a + 1, hRem, aRem2, 'home')
             + (1 - pAway) * prob(h, a, hRem, aRem2, 'home');
    }

    memo.set(key, result);
    return result;
  }

  return prob(homeScored, awayScored, homeRemaining, awayRemaining, nextSide);
}

function normalizeKick(k, index) {
  return {
    round: k.round ?? Math.floor(index / 2) + 1,
    side: k.side === 'home' || k.side === 'away' ? k.side : 'home',
    result: k.result === 'scored' || k.result === 'missed' || k.result === 'saved' ? k.result : 'scored',
    player: k.player || null,
  };
}

function normalizeKicks(kicks) {
  if (!Array.isArray(kicks)) return [];
  return kicks.map(normalizeKick);
}

function buildStateFromKicks(kicks) {
  const normalized = normalizeKicks(kicks);

  let homeScored = 0;
  let awayScored = 0;
  let homeKicksTaken = 0;
  let awayKicksTaken = 0;
  const rounds = [];
  let currentRound = { round: 1, events: [] };
  let maxRound = 1;

  for (const k of normalized) {
    if (k.round !== currentRound.round) {
      if (currentRound.events.length) rounds.push(currentRound);
      currentRound = { round: k.round, events: [] };
    }
    currentRound.events.push(k);
    if (k.side === 'home') {
      homeKicksTaken++;
      if (k.result === 'scored') homeScored++;
    } else {
      awayKicksTaken++;
      if (k.result === 'scored') awayScored++;
    }
    maxRound = Math.max(maxRound, k.round);
  }
  if (currentRound.events.length) rounds.push(currentRound);

  const regulationComplete = homeKicksTaken >= REGULATION_ROUNDS && awayKicksTaken >= REGULATION_ROUNDS;
  const tied = homeScored === awayScored;
  const suddenDeath =
    homeKicksTaken > REGULATION_ROUNDS ||
    awayKicksTaken > REGULATION_ROUNDS ||
    (regulationComplete && tied);

  // Next kicker: home always starts each round; order is home, away, home, away...
  const totalKicks = homeKicksTaken + awayKicksTaken;
  let nextSide = totalKicks % 2 === 0 ? 'home' : 'away';

  let homeRemaining;
  let awayRemaining;
  let roundNumber;

  if (suddenDeath) {
    // In sudden death, each round is one kick per team. After each pair, if tied, repeat.
    // homeRemaining/awayRemaining represent kicks remaining in the current sudden-death round.
    const sdKicksTaken = totalKicks - 2 * REGULATION_ROUNDS;
    if (sdKicksTaken % 2 === 0) {
      homeRemaining = 1;
      awayRemaining = 1;
    } else {
      // One kick has been taken in this sudden-death round; the other side remains.
      homeRemaining = sdKicksTaken % 4 === 1 ? 0 : 1; // home took the kick if sdKicksTaken % 2 === 1 and (sdKicksTaken-1)/2 % 2 === 0? simpler: nextSide tells us who is next
      awayRemaining = nextSide === 'home' ? 1 : 0; // if next is home, away already kicked and has 0 remaining
      // Wait, we need a better way. Let's use nextSide.
      if (nextSide === 'home') {
        homeRemaining = 1;
        awayRemaining = 0;
      } else {
        homeRemaining = 0;
        awayRemaining = 1;
      }
    }
    roundNumber = REGULATION_ROUNDS + Math.ceil((sdKicksTaken + 1) / 2);
  } else {
    homeRemaining = Math.max(0, REGULATION_ROUNDS - homeKicksTaken);
    awayRemaining = Math.max(0, REGULATION_ROUNDS - awayKicksTaken);
    // Round number is the round of the next kick.
    roundNumber = Math.max(1, Math.min(homeKicksTaken, awayKicksTaken) + 1);
  }

  return {
    current: { home: homeScored, away: awayScored },
    rounds,
    homeKicksTaken,
    awayKicksTaken,
    homeRemaining,
    awayRemaining,
    nextSide,
    suddenDeath,
    roundNumber,
  };
}

function summaryText(current, nextSide, suddenDeath, homeRemaining, awayRemaining) {
  const h = current.home;
  const a = current.away;

  if (h > a + awayRemaining) return `Home wins ${h}-${a}`;
  if (a > h + homeRemaining) return `Away wins ${h}-${a}`;
  if (suddenDeath) return `Tied ${h}-${a}: sudden death`;

  if (nextSide === 'home') {
    if (h > a) return `Home leads ${h}-${a}; away must score to stay alive`;
    return `Home to kick next, score ${h}-${a}`;
  }
  if (a > h) return `Away leads ${h}-${a}; home must score to stay alive`;
  return `Away to kick next, score ${h}-${a}`;
}

function stateAfterRound(roundsTaken, options) {
  let homeScored = 0;
  let awayScored = 0;
  let homeKicksTaken = 0;
  let awayKicksTaken = 0;

  for (const r of roundsTaken) {
    for (const ev of r.events) {
      if (ev.side === 'home') {
        homeKicksTaken++;
        if (ev.result === 'scored') homeScored++;
      } else {
        awayKicksTaken++;
        if (ev.result === 'scored') awayScored++;
      }
    }
  }

  const regulationComplete = homeKicksTaken >= REGULATION_ROUNDS && awayKicksTaken >= REGULATION_ROUNDS;
  const tied = homeScored === awayScored;
  const suddenDeath =
    homeKicksTaken > REGULATION_ROUNDS ||
    awayKicksTaken > REGULATION_ROUNDS ||
    (regulationComplete && tied);

  const totalKicks = homeKicksTaken + awayKicksTaken;
  const nextSide = totalKicks % 2 === 0 ? 'home' : 'away';

  let hRem;
  let aRem;
  if (suddenDeath) {
    const sdKicksTaken = totalKicks - 2 * REGULATION_ROUNDS;
    if (sdKicksTaken % 2 === 0) {
      hRem = 1;
      aRem = 1;
    } else if (nextSide === 'home') {
      hRem = 1;
      aRem = 0;
    } else {
      hRem = 0;
      aRem = 1;
    }
  } else {
    hRem = Math.max(0, REGULATION_ROUNDS - homeKicksTaken);
    aRem = Math.max(0, REGULATION_ROUNDS - awayKicksTaken);
  }

  const homeWin = shootoutWinProbability(homeScored, awayScored, hRem, aRem, nextSide, options);
  return { homeWin, awayWin: 1 - homeWin };
}

/**
 * Analyze a penalty shootout.
 *
 * @param {Array} kicks - e.g. [{ side: 'home', result: 'scored', player: 'X' }, ...]
 *   Order is chronological. If `round` is omitted, it is inferred from position.
 * @param {object} [options] - { successRate: 0.75, successRates: { home: 0.75, away: 0.75 } }
 * @returns {object} analysis result
 */
function analyzeShootout(kicks, options = {}) {
  const state = buildStateFromKicks(kicks);
  const { current, rounds, homeRemaining, awayRemaining, nextSide, suddenDeath, roundNumber } = state;

  const currentHomeWin = shootoutWinProbability(
    current.home, current.away, homeRemaining, awayRemaining, nextSide, options
  );
  const currentAwayWin = 1 - currentHomeWin;

  const roundHistory = [];
  const takenRounds = [];

  for (const r of rounds) {
    const before = stateAfterRound(takenRounds, options);
    takenRounds.push(r);
    const after = stateAfterRound(takenRounds, options);

    roundHistory.push({
      round: r.round,
      before: { homeWin: round3(before.homeWin), awayWin: round3(before.awayWin) },
      after: { homeWin: round3(after.homeWin), awayWin: round3(after.awayWin) },
      spike: {
        home: round3(after.homeWin - before.homeWin),
        away: round3(after.awayWin - before.awayWin),
      },
      events: r.events.map((e) => ({
        side: e.side,
        result: e.result,
        player: e.player,
      })),
    });
  }

  return {
    homeWin: round3(currentHomeWin),
    awayWin: round3(currentAwayWin),
    currentScore: current,
    round: roundNumber,
    suddenDeath,
    nextTaker: nextSide,
    roundHistory,
    summary: summaryText(current, nextSide, suddenDeath, homeRemaining, awayRemaining),
    source: 'penalty-shootout-model',
    usedInModel: false,
  };
}

module.exports = {
  analyzeShootout,
  shootoutWinProbability,
  kickSuccessRate,
};
