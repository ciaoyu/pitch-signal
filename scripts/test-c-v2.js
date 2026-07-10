#!/usr/bin/env node
'use strict';

/**
 * C v2 — Cross-Path Live-Probability Unification Acceptance Tests
 *
 * Covers the three blocking issues from T0 audit:
 *   1. Knockout stage: getKnockoutContextForMatch() (no espn_id column query)
 *   2. Added time: parseAddedTime() with real clock-string input
 *   3. Monitor red cards: countRedCardsFromDetails() with real ESPN detail objects
 *
 * Plus cross-path consistency:
 *   4. GET / POST / moment-sync → identical reprice() for same hard facts
 *   5. Soft signals (shots/possession/yellows/external-odds) do NOT move probability
 *   6. regulation/advance split correct for group-stage vs knockout
 *   7. Added time capped (W1-B §1.3)
 *   8. stageSource: 'schedule' vs 'unavailable' (never client-trusted)
 *
 * Run: node scripts/test-c-v2.js
 */

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ── 1. Knockout stage from schedule snapshot ──
console.log('\n📋 Test 1: Knockout stage from schedule snapshot (no espn_id column)');
{
  const { getKnockoutContextForMatch } = require('../lib/services/PredictionService');

  const groupCtx = getKnockoutContextForMatch('760428');
  assert(groupCtx !== null && typeof groupCtx === 'object',
    `getKnockoutContextForMatch(760428) returns object`);
  assert(/group/i.test(groupCtx.stage),
    `760428 stage contains 'group': "${groupCtx.stage}"`);
  assert(groupCtx.isKnockout === false,
    `760428 isKnockout === false`);

  const unknownCtx = getKnockoutContextForMatch('nonexistent');
  assert(unknownCtx !== null && typeof unknownCtx === 'object',
    `nonexistent returns object (no crash)`);
  assert(unknownCtx.stage === null || unknownCtx.stage === undefined || unknownCtx.stage === '',
    `nonexistent stage is empty: "${unknownCtx.stage}"`);
  assert(unknownCtx.isKnockout === false,
    `nonexistent isKnockout === false`);

  // Route code: must NOT reference espn_id in matches table query
  const routeCode = fs.readFileSync(path.join(__dirname, '..', 'lib', 'routes', 'prediction.js'), 'utf8');
  assert(
    !routeCode.includes("SELECT stage FROM matches WHERE espn_id"),
    'route prediction.js: no espn_id column query'
  );
  assert(routeCode.includes('getKnockoutContextForMatch'),
    'route prediction.js: uses getKnockoutContextForMatch');

  // Route code: schedule unavailable → isKnockout=false (NEVER client-trusted)
  assert(
    routeCode.includes("isKnockout = false") &&
    routeCode.includes("stageSource = 'unavailable'"),
    'route: schedule unavailable → isKnockout=false, stageSource=unavailable'
  );
  assert(
    !routeCode.includes("params.isKnockout"),
    'route: NEVER reads params.isKnockout for knockout authority'
  );
  assert(routeCode.includes('stageSource'),
    'route: includes stageSource in response');
}

// ── 2. Added time: REAL parseAddedTime() with clock strings ──
console.log('\n📋 Test 2: parseAddedTime() with real clock-string input');
{
  const { parseAddedTime } = require('../lib/live-helpers');

  // Standard clock strings
  assert(parseAddedTime("90'+4") === 4, `"90'+4" → 4`);
  assert(parseAddedTime("45'+2") === 2, `"45'+2" → 2`);
  assert(parseAddedTime("120'+1") === 1, `"120'+1" → 1`);
  assert(parseAddedTime("90'+11") === 11, `"90'+11" → 11`);

  // No added time
  assert(parseAddedTime("23'") === 0, `"23'" → 0`);
  assert(parseAddedTime("HT") === 0, `"HT" → 0`);
  assert(parseAddedTime("FT") === 0, `"FT" → 0`);
  assert(parseAddedTime("") === 0, `"" → 0`);

  // Falsy inputs
  assert(parseAddedTime(null) === 0, `null → 0`);
  assert(parseAddedTime(undefined) === 0, `undefined → 0`);
  assert(parseAddedTime(90) === 0, `number 90 → 0`);

  // End-to-end: parseAddedTime → reprice()
  const { reprice } = require('../lib/live-reprice');
  const base = {
    preLambdaHome: 1.5, preLambdaAway: 1.2,
    homeScore: 1, awayScore: 0, minuteElapsed: 90,
    homeRedCards: 0, awayRedCards: 0, isKnockout: false,
  };

  const clockStr = "90'+4";
  const at = parseAddedTime(clockStr);
  const result = reprice({ ...base, addedTime: at });
  const expectedHome = Math.round((1.5 * 4 / 90) * 1000) / 1000;
  assert(result.lambdaHomeRemaining === expectedHome,
    `E2E: "${clockStr}" → parseAddedTime=${at} → reprice λHome=${result.lambdaHomeRemaining} (expected ${expectedHome})`);
  assert(result.minuteElapsed === 90 && result.minutesRemaining === 4,
    `E2E: elapsed=90, remaining=4`);

  // W1-B §1.3: cap — added time never inflates λ above pre-match baseline
  const longAdded = reprice({ ...base, minuteElapsed: 0, addedTime: 10 });
  assert(longAdded.lambdaHomeRemaining <= 1.5 && longAdded.lambdaAwayRemaining <= 1.2,
    `W1-B §1.3: 0'+10 → λHome=${longAdded.lambdaHomeRemaining} ≤ 1.5, λAway=${longAdded.lambdaAwayRemaining} ≤ 1.2`);

  // moment-sync code: passes addedTime to reprice
  const syncCode = fs.readFileSync(path.join(__dirname, '..', 'lib', 'jobs', 'moment-sync.js'), 'utf8');
  assert(syncCode.includes('parseAddedTime'),
    'moment-sync: calls parseAddedTime');
  assert(syncCode.includes('displayClock: e.status?.displayClock'),
    'moment-sync: preserves displayClock from ESPN');
  assert(syncCode.includes('addedTime') && syncCode.includes('reprice'),
    'moment-sync: passes addedTime to reprice()');

  // monitor code: passes addedTime
  const monitorCode = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'live-match-monitor.js'), 'utf8');
  assert(monitorCode.includes('parseAddedTime(m.statusDetail'),
    'monitor: passes statusDetail to parseAddedTime');
}

// ── 3. Red cards: REAL countRedCardsFromDetails with ESPN detail objects ──
console.log('\n📋 Test 3: countRedCardsFromDetails() with real ESPN details');
{
  const { countRedCardsFromDetails, countRedCardsFromKeyEvents } = require('../lib/live-helpers');

  // Empty / null
  assert(countRedCardsFromDetails(null, 'GER') === 0, 'null details → 0');
  assert(countRedCardsFromDetails([], 'GER') === 0, '[] details → 0');
  assert(countRedCardsFromDetails([{type:'red', team:'GER'}], null) === 0, 'null teamName → 0');

  // Direct red card
  assert(countRedCardsFromDetails([
    { type: 'Red Card', team: 'Germany', player: 'Müller' }
  ], 'Germany') === 1, 'direct red: "Red Card" on Germany → 1');

  // Case-insensitive team name matching
  assert(countRedCardsFromDetails([
    { type: 'Red Card', team: 'GERMANY', player: 'Kroos' }
  ], 'germany') === 1, 'case-insensitive: GERMANY ↔ germany → 1');

  // Substring matching: "Germany" contains "GER", "GER" is contained in "Germany"
  assert(countRedCardsFromDetails([
    { type: 'Red Card', team: 'Germany', player: 'Neuer' }
  ], 'GER') === 1, 'substring: team="Germany" matches needle="GER" → 1');

  assert(countRedCardsFromDetails([
    { type: 'Red Card', team: 'GER', player: 'Havertz' }
  ], 'Germany') === 1, 'substring: team="GER" matches needle="Germany" → 1');

  // Two yellows → red
  assert(countRedCardsFromDetails([
    { type: 'Yellow Card', team: 'Germany', player: 'Kimmich' },
    { type: 'Yellow Card', team: 'Germany', player: 'Kimmich' },
  ], 'Germany') === 1, 'two yellows on same player → 1 red (second yellow)');

  // Two yellows on different players → 0 reds
  assert(countRedCardsFromDetails([
    { type: 'Yellow Card', team: 'Germany', player: 'Kimmich' },
    { type: 'Yellow Card', team: 'Germany', player: 'Gündoğan' },
  ], 'Germany') === 0, 'two yellows on DIFFERENT players → 0 reds');

  // Mixed: direct red + two yellows on other player
  assert(countRedCardsFromDetails([
    { type: 'Yellow Card', team: 'Germany', player: 'Musiala' },
    { type: 'Red Card', team: 'Germany', player: 'Rüdiger' },
    { type: 'Yellow Card', team: 'Germany', player: 'Musiala' },
  ], 'Germany') === 2, 'direct red + two yellows second player → 2');

  // Wrong team — not counted
  assert(countRedCardsFromDetails([
    { type: 'Red Card', team: 'France', player: 'Mbappé' },
  ], 'Germany') === 0, 'red on France when looking for Germany → 0');

  // Real ESPN-like details (mixed teams)
  const realDetails = [
    { type: 'Yellow Card', team: 'Germany', player: 'Kroos', minute: "34'" },
    { type: 'Red Card', team: 'Curaçao', player: 'Martis', minute: "56'" },
    { type: 'Yellow Card', team: 'Germany', player: 'Kroos', minute: "71'" },
    { type: 'Yellow Card', team: 'Curaçao', player: 'Bacuna', minute: "82'" },
    { type: 'Red Card', team: 'Germany', player: 'Rüdiger', minute: "88'" },
  ];
  assert(countRedCardsFromDetails(realDetails, 'Germany') === 2,
    'real details: Kroos 2Y→R + Rüdiger direct R → 2 reds for Germany');
  assert(countRedCardsFromDetails(realDetails, 'Curaçao') === 1,
    'real details: Martis direct R → 1 red for Curaçao');

  // countRedCardsFromKeyEvents (used by moment-sync)
  const espnKeyEvents = [
    { team: { id: '4780' }, type: { text: 'Yellow Card' }, participants: [{ athlete: { displayName: 'Toni Kroos', id: '678' } }] },
    { team: { id: '4780' }, type: { text: 'Yellow Card' }, participants: [{ athlete: { displayName: 'Toni Kroos', id: '678' } }] },
    { team: { id: '25678' }, type: { text: 'Red Card' }, participants: [{ athlete: { displayName: 'Leandro', id: '999' } }] },
  ];
  assert(countRedCardsFromKeyEvents(espnKeyEvents, '4780') === 1,
    'keyEvents: Kroos 2Y → 1 red for team 4780');
  assert(countRedCardsFromKeyEvents(espnKeyEvents, '25678') === 1,
    'keyEvents: Leandro direct red for team 25678');

  // monitor code: uses live-helpers
  const monitorCode = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'live-match-monitor.js'), 'utf8');
  assert(monitorCode.includes("liveHelpers.countRedCardsFromDetails"),
    'monitor: delegates to liveHelpers.countRedCardsFromDetails');
}

// ── 4. Cross-path consistency ──
console.log('\n📋 Test 4: Cross-path consistency (reprice / buildLiveAnalysis)');
{
  const { reprice } = require('../lib/live-reprice');
  const PredictionService = require('../lib/services/PredictionService');

  const params = {
    preLambdaHome: 1.5, preLambdaAway: 1.2,
    homeScore: 1, awayScore: 0, minuteElapsed: 60, addedTime: 3,
    homeRedCards: 0, awayRedCards: 0, isKnockout: false,
  };

  const direct = reprice(params);
  const basePrediction = {
    homeWin: 0.46, draw: 0.247, awayWin: 0.293,
    goals: { homeExpected: 1.5, awayExpected: 1.2 },
  };
  const viaAdapter = PredictionService.buildLiveAnalysis(
    basePrediction,
    { homeName: 'GER', awayName: 'CUR', stage: 'Group E' },
    { minute: 60, homeScore: 1, awayScore: 0, addedTime: 3, homeRedCards: 0, awayRedCards: 0 },
  );

  assert(
    direct.regulation.homeWin === viaAdapter.probabilities.homeWin &&
    direct.regulation.draw === viaAdapter.probabilities.draw &&
    direct.regulation.awayWin === viaAdapter.probabilities.awayWin,
    `reprice == buildLiveAnalysis: ${direct.regulation.homeWin}/${direct.regulation.draw}/${direct.regulation.awayWin}`
  );
  assert(viaAdapter.source === 'live_reprice',
    `buildLiveAnalysis source = 'live_reprice'`);

  // Knockout from stage string
  const koAdapter = PredictionService.buildLiveAnalysis(
    { ...basePrediction, goals: { homeExpected: 1.5, awayExpected: 1.2 } },
    { ...{ homeName: 'GER', awayName: 'ARG' }, stage: 'Round of 16' },
    { minute: 60, homeScore: 1, awayScore: 0, addedTime: 0, homeRedCards: 0, awayRedCards: 0 },
  );
  assert(koAdapter.advance !== null && typeof koAdapter.advance === 'object',
    'Round of 16 → advance present');
  assert(koAdapter.advance.homeWin !== undefined,
    'advance has homeWin');
}

// ── 5. Soft signals do NOT move probability ──
console.log('\n📋 Test 5: Soft signals do NOT affect probability');
{
  const { reprice } = require('../lib/live-reprice');
  const baseParams = {
    preLambdaHome: 1.5, preLambdaAway: 1.2,
    homeScore: 1, awayScore: 0, minuteElapsed: 60, addedTime: 0,
    homeRedCards: 0, awayRedCards: 0, isKnockout: false,
  };

  const clean = reprice(baseParams);
  const withExtra = reprice({
    ...baseParams,
    homeShots: 20, awayShots: 1,
    homePossession: 75, awayPossession: 25,
    homeYellowCards: 3,
    externalOddsHome: 1.5,
  });

  assert(
    clean.regulation.homeWin === withExtra.regulation.homeWin &&
    clean.regulation.draw === withExtra.regulation.draw &&
    clean.regulation.awayWin === withExtra.regulation.awayWin,
    'extra unknown properties ignored'
  );
}

// ── 6. regulation / advance split ──
console.log('\n📋 Test 6: regulation/advance split');
{
  const { reprice } = require('../lib/live-reprice');
  const params = {
    preLambdaHome: 1.5, preLambdaAway: 1.2,
    homeScore: 0, awayScore: 0, minuteElapsed: 90, addedTime: 0,
    homeRedCards: 0, awayRedCards: 0,
  };

  const group = reprice({ ...params, isKnockout: false });
  assert(group.advance === null, 'group → advance == null');
  assert(group.regulation.draw > 0, 'group 0-0 FT: draw > 0');

  const ko = reprice({ ...params, isKnockout: true });
  assert(ko.advance !== null, 'knockout → advance present');
  assert(Math.abs(ko.advance.homeWin + ko.advance.awayWin - 1.0) < 0.01,
    `advance homeWin + awayWin ≈ 1.0 (${ko.advance.homeWin} + ${ko.advance.awayWin})`);
  assert(ko.advance.homeWinAfterET !== undefined, 'advance has homeWinAfterET');
  assert(ko.advance.penaltyHomeWin !== undefined, 'advance has penaltyHomeWin');
}

// ── 7. moment-sync + monitor both delegate to live-helpers ──
console.log('\n📋 Test 7: Delegation to live-helpers');
{
  // moment-sync requires live-helpers
  const syncCode = fs.readFileSync(path.join(__dirname, '..', 'lib', 'jobs', 'moment-sync.js'), 'utf8');
  assert(syncCode.includes("require('../live-helpers')"),
    'moment-sync requires live-helpers');

  // monitor requires live-helpers
  const monitorCode = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'live-match-monitor.js'), 'utf8');
  assert(monitorCode.includes("require('../lib/live-helpers')"),
    'monitor requires live-helpers');

  // Both delegate countRedCards + parseAddedTime to live-helpers
  assert(syncCode.includes('liveHelpers.countRedCardsFromKeyEvents'),
    'moment-sync delegates countRedCards → liveHelpers');
  assert(monitorCode.includes('liveHelpers.countRedCardsFromDetails'),
    'monitor delegates countRedCards → liveHelpers');
  assert(syncCode.includes('liveHelpers.parseAddedTime'),
    'moment-sync delegates parseAddedTime → liveHelpers');
  assert(monitorCode.includes('liveHelpers.parseAddedTime'),
    'monitor delegates parseAddedTime → liveHelpers');
}

// ── Summary ──
console.log(`\n🎯 C v2: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
