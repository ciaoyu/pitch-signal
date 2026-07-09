'use strict';

const assert = require('assert');
const { isPostMatchLeakage, guardSection, guardKnockoutIntel } = require('../lib/services/knockout-leakage-guard');
const { buildKnockoutIntel, SECTION_BUILDERS } = require('../lib/services/knockout-intel');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('=== KO-15: Knockout Intelligence Leakage Guard Test Suite ===');

test('1. detects explicit post-match result fields in section data', () => {
  const leakingSec = {
    confidence: 'medium',
    actualScore: '2-1',
    homeOut: []
  };
  assert.strictEqual(isPostMatchLeakage(leakingSec), true);
  assert.strictEqual(guardSection('suspensions', leakingSec), null);
});

test('2. detects future timestamp relative to match kickoff time', () => {
  const futureSec = {
    confidence: 'high',
    timestamp: '2026-07-15T22:00:00.000Z',
    data: 'after kickoff'
  };
  const ctx = { kickoffTime: '2026-07-15T18:00:00.000Z' };
  assert.strictEqual(isPostMatchLeakage(futureSec, ctx), true);
  assert.strictEqual(guardSection('testSec', futureSec, ctx), null);
});

test('3. allows legitimate pre-match section data', () => {
  const validSec = {
    confidence: 'medium',
    timestamp: '2026-07-15T12:00:00.000Z',
    homeOut: []
  };
  const ctx = { kickoffTime: '2026-07-15T18:00:00.000Z' };
  assert.strictEqual(isPostMatchLeakage(validSec, ctx), false);
  const guarded = guardSection('suspensions', validSec, ctx);
  assert.deepStrictEqual(guarded, validSec);
});

test('4. guardKnockoutIntel strips leaking sections map clean', () => {
  const sections = {
    suspensions: { confidence: 'high', homeOut: [] },
    leakingSection: { confidence: 'low', actualScore: '1-0' }
  };
  const clean = guardKnockoutIntel({}, sections);
  assert.ok(clean.suspensions);
  assert.strictEqual(clean.leakingSection, undefined);
});

test('5. integration: buildKnockoutIntel filters out mock leaking section builder', () => {
  // Register a temporary mock builder that returns post-match data
  SECTION_BUILDERS.push({
    key: 'mockLeak',
    build: () => ({ actualScore: '3-2', postMatchReview: 'leaked' })
  });

  try {
    const intel = buildKnockoutIntel({
      matchId: 'k999',
      stage: 'Semi-finals'
    });
    assert.ok(intel && intel.sections);
    assert.strictEqual(intel.sections.mockLeak, undefined, 'mockLeak section must be blocked by guardKnockoutIntel');
  } finally {
    SECTION_BUILDERS.pop();
  }
});

console.log('All KO-15 tests passed!');
