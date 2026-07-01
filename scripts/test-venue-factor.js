#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const venueFactors = require('../lib/venueFactors');

const ROOT = path.join(__dirname, '..');
const schedule = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'match_snapshot_schedule.json'), 'utf8'));

const mismatches = [];
const unverifiable = [];
const noEffect = [];
const applied = [];

for (const match of schedule.matches) {
  const home = match.teams?.home?.abbreviation || match.teams?.home?.name;
  const away = match.teams?.away?.abbreviation || match.teams?.away?.name;
  const result = venueFactors.computeForMatch(String(match.matchId), home, away);
  const mismatchReasons = [];
  const unverifiableReasons = [];
  const isPlaceholder = value => !value
    || /^\d[A-L]$/i.test(value)
    || /^3RD$/i.test(value)
    || /^(TBD|RD|R\d|QF|QW|SF|[WLP]\s)/i.test(value);
  const homeIsPlaceholder = isPlaceholder(home);
  const awayIsPlaceholder = isPlaceholder(away);

  if (!result.home.venueId || !result.away.venueId) mismatchReasons.push('venue_unmatched');
  if (!result.home.teamCode && !homeIsPlaceholder) mismatchReasons.push('home_team_unmatched');
  if (!result.away.teamCode && !awayIsPlaceholder) mismatchReasons.push('away_team_unmatched');
  if (homeIsPlaceholder) unverifiableReasons.push('home_team_not_yet_determined');
  if (awayIsPlaceholder) unverifiableReasons.push('away_team_not_yet_determined');
  if (result.home.tempC == null || result.away.tempC == null) unverifiableReasons.push('temperature_missing');
  if (result.home.teamCode && result.home.baseCampAltM == null) unverifiableReasons.push('home_altitude_missing');
  if (result.away.teamCode && result.away.baseCampAltM == null) unverifiableReasons.push('away_altitude_missing');

  if (mismatchReasons.length) {
    mismatches.push({ matchId: match.matchId, venue: match.venue, reasons: [...new Set(mismatchReasons)] });
  } else if (unverifiableReasons.length) {
    unverifiable.push({ matchId: match.matchId, reasons: [...new Set(unverifiableReasons)] });
  } else if (result.home.applied || result.away.applied) {
    applied.push({ matchId: match.matchId, homeBeta: result.home.beta, awayBeta: result.away.beta });
  } else {
    noEffect.push({ matchId: match.matchId, reason: 'mapped_but_below_model_thresholds' });
  }
}

assert.strictEqual(venueFactors.resolveVenueIdByName('Los Angeles Stadium'), '400017978');
assert.strictEqual(venueFactors.resolveVenueIdByName('SoFi Stadium'), '400017978');
assert.strictEqual(mismatches.length, 0, JSON.stringify(mismatches, null, 2));

console.log('=== venueFactor offline coverage ===');
console.log(`schedule: ${schedule.matches.length}`);
console.log(`applied: ${applied.length}`);
console.log(`mapped_no_effect: ${noEffect.length}`);
console.log(`unverifiable: ${unverifiable.length}`);
console.log(`mismatched: ${mismatches.length}`);
if (unverifiable.length) {
  const counts = {};
  for (const item of unverifiable) {
    for (const reason of item.reasons) counts[reason] = (counts[reason] || 0) + 1;
  }
  console.log(`unverifiable_reasons: ${JSON.stringify(counts)}`);
}
if (applied[0]) {
  console.log(`lambda evidence: ${applied[0].matchId} 1.0000 -> home ${applied[0].homeBeta.toFixed(4)}, away ${applied[0].awayBeta.toFixed(4)}`);
}
console.log('3 passed, 0 failed');
