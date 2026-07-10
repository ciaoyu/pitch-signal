'use strict';

const assert = require('assert');
const { isPostMatchLeakage, guardSection, guardKnockoutIntel } = require('../lib/services/knockout-leakage-guard');
const { buildKnockoutIntel, SECTION_BUILDERS } = require('../lib/services/knockout-intel');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('=== KO-15 knockout intelligence leakage guard ===');

test('blocks explicit post-match result fields', () => {
  const leaking = { confidence: 'medium', actualScore: '2-1', homeOut: [] };
  assert.strictEqual(isPostMatchLeakage(leaking), true);
  assert.strictEqual(guardSection('suspensions', leaking), null);
});

test('blocks a timestamp after kickoff, including nested section data', () => {
  const leaking = { evidence: [{ dataAsOf: '2026-07-15T22:00:00.000Z' }] };
  const ctx = { kickoffTime: '2026-07-15T18:00:00.000Z' };
  assert.strictEqual(isPostMatchLeakage(leaking, ctx), true);
  assert.strictEqual(guardSection('fatigue', leaking, ctx), null);
});

test('keeps a legitimate pre-match section unchanged', () => {
  const safe = { confidence: 'medium', timestamp: '2026-07-15T12:00:00.000Z', homeOut: [] };
  assert.deepStrictEqual(guardSection('suspensions', safe, { kickoffTime: '2026-07-15T18:00:00.000Z' }), safe);
});

test('filters only the leaking entry from a complete section map', () => {
  const clean = guardKnockoutIntel({}, {
    suspensions: { confidence: 'high', homeOut: [] },
    leakingSection: { finalResult: '1-0' },
  });
  assert.ok(clean.suspensions);
  assert.strictEqual(clean.leakingSection, undefined);
});

test('strict mode fails closed for audit callers', () => {
  assert.throws(() => guardSection('test', { postMatchSummary: 'leaked' }, { strictLeakageCheck: true }), /LeakageGuard/);
});

test('integration preserves the current multi-section pipeline and removes a leaking builder', () => {
  SECTION_BUILDERS.push({ key: 'mockLeak', build: () => ({ actualScore: '3-2', postMatchReview: 'leaked' }) });
  try {
    const intel = buildKnockoutIntel({ matchId: 'k999', stage: 'Semi-finals' });
    assert.ok(intel && intel.sections);
    assert.strictEqual(intel.sections.mockLeak, undefined);
  } finally {
    SECTION_BUILDERS.pop();
  }
});

console.log(`${passed} passed, 0 failed`);
