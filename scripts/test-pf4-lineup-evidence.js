#!/usr/bin/env node
'use strict';

const assert = require('assert');
const MatchReviewEngine = require('../lib/matchReview');
const { buildPostMatchReview, AI_POSTMORTEM_INSTRUCTION } = require('../lib/postMatchReview');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('=== PF-4: Lineup Evidence & AI Attribution Test Suite ===');

test('1. MatchReviewEngine.checkLineupChanges detects injured/suspended players', () => {
  const engine = new MatchReviewEngine();
  const evidence = engine.checkLineupChanges({
    homeId: 'FRA',
    awayId: 'ENG',
    injuries: [
      { teamId: 'FRA', player: 'Mbappé', issue: 'injured' }
    ]
  });
  assert.strictEqual(evidence.length, 1);
  assert.strictEqual(evidence[0].player, 'Mbappé');
  assert.strictEqual(evidence[0].type, 'absence_injury');
});

test('2. MatchReviewEngine.checkLineupChanges detects benched star players', () => {
  const engine = new MatchReviewEngine();
  const evidence = engine.checkLineupChanges({
    homeId: 'FRA',
    awayId: 'ENG',
    lineups: {
      home: {
        bench: [
          { name: 'Kylian Mbappé', isStar: true }
        ]
      }
    }
  });
  assert.strictEqual(evidence.length, 1);
  assert.strictEqual(evidence[0].type, 'star_on_bench');
  assert.ok(evidence[0].detail.includes('未进入首发名单'));
});

test('3. MatchReviewEngine.analyzeBias includes lineup changes in factors', () => {
  const engine = new MatchReviewEngine();
  const matchData = {
    homeId: 'FRA',
    awayId: 'ENG',
    homeScore: 0,
    awayScore: 1,
    injuries: [
      { teamId: 'FRA', player: 'Mbappé', issue: 'injured' }
    ]
  };
  const result = engine.analyzeBias(matchData, 1800, 1750, { homeWin: 0.6, draw: 0.25, awayWin: 0.15 });
  const lineupFactor = result.factors.find(f => f.key === 'lineup_change_Mbappé');
  assert.ok(lineupFactor, 'should include lineup_change_Mbappé factor');
  assert.strictEqual(lineupFactor.factor, '首发调整/主力缺阵');
});

test('4. summarizeEvidence in postMatchReview preserves lineupEvidence', () => {
  const review = buildPostMatchReview({
    matchId: 'TEST-PF4',
    match: { homeId: 'FRA', awayId: 'ENG', homeScore: 1, awayScore: 1 },
    evidence: {
      lineupEvidence: [
        { team: 'FRA', player: 'Mbappé', type: 'star_on_bench', detail: '核心球员未进入首发' }
      ]
    }
  });
  assert.ok(review.evidence.lineupEvidence, 'evidence should have lineupEvidence');
  assert.strictEqual(review.evidence.lineupEvidence.length, 1);
  assert.strictEqual(review.evidence.lineupEvidence[0].player, 'Mbappé');
});

test('5. AI_POSTMORTEM_INSTRUCTION contains lineup evidence instructions', () => {
  assert.ok(AI_POSTMORTEM_INSTRUCTION.includes('evidence.lineupEvidence'), 'Instruction should mention evidence.lineupEvidence');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
