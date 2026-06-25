#!/usr/bin/env node
'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { db } = require('../lib/db');
const PredictionService = require('../lib/services/PredictionService');
const ReviewService = require('../lib/services/ReviewService');

let passed = 0;
let failed = 0;

function testAssert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// Stubs for PredictionService and ReviewService dependencies
const cache = {};
const deps = {
  getCached: (key) => cache[key] || null,
  setCache: (key, val) => { cache[key] = val; },
  espn: async (endpoint, cacheKey) => {
    // Stub ESPN response for summary
    return {
      header: {
        date: '2026-06-21T18:00:00Z',
        competitions: [{
          id: 'test_comp_1',
          date: '2026-06-21T18:00:00Z',
          venue: { fullName: 'Test Stadium' },
          status: { type: { name: 'STATUS_FINAL', completed: true } },
          competitors: [
            { homeAway: 'home', score: '2', team: { id: 'Australia', displayName: 'Australia' } },
            { homeAway: 'away', score: '0', team: { id: 'Türkiye', displayName: 'Turkey' } }
          ]
        }]
      },
      commentary: [
        { time: { displayValue: "10'" }, type: 'goal', text: 'Australia Goal' }
      ]
    };
  },
  getTeamNameZh: (id) => id,
  getTeamNameI18n: (id, fallback) => ({ zh: id, en: fallback || id }),
  TEAM_FLAGS: { Australia: '🇦🇺', Türkiye: '🇹🇷' },
  RATINGS: {
    teams: {
      Australia: { rating: 1700, attack_strength: 1.2, defense_strength: 0.9 },
      Türkiye: { rating: 1650, attack_strength: 1.1, defense_strength: 1.0 }
    }
  },
  routes: {
    'GET /api/odds/:matchId': async () => ({ homeWin: '2.10', draw: '3.20', awayWin: '3.50' }),
    'GET /api/match/:id/news': async () => ({ news: [] })
  }
};

async function run() {
  console.log('=== Running Service Layer Integration Tests ===\n');

  // Clean up database tables before test
  db.prepare('DELETE FROM post_match_reviews').run();
  db.prepare('DELETE FROM prediction_snapshots').run();
  db.prepare('DELETE FROM predictions').run();

  const predictionService = new PredictionService(deps);
  const reviewService = new ReviewService(deps);

  console.log('📋 Test 0: Public service reads are side-effect free');
  try {
    await predictionService.predictMatch('test_match_001');
    testAssert(
      db.prepare('SELECT * FROM predictions WHERE match_id = ?').get('test_match_001') === undefined,
      'Public prediction read does not write a prediction row'
    );
    testAssert(
      db.prepare('SELECT * FROM prediction_snapshots WHERE match_id = ?').get('test_match_001') === undefined,
      'Public prediction read does not write a snapshot'
    );
  } catch (e) {
    console.error('  ❌ Public read test failed:', e);
    failed++;
  }

  // Test 1: PredictionService.predictMatch
  try {
    console.log('📋 Test 1: Prediction Service execution and database write');
    const result = await predictionService.predictMatch('test_match_001', { persist: true });
    
    testAssert(result !== null, 'Returned prediction result');
    testAssert(result.match.homeId === 'Australia', 'Result contains Australia home team');
    
    // Verify prediction record in test database
    const predRow = db.prepare('SELECT * FROM predictions WHERE match_id = ?').get('test_match_001');
    testAssert(predRow !== undefined, 'Prediction row written to test DB');
    testAssert(predRow.home_win_prob > 0, 'Home probability is stored');
    
    // Verify snapshot written to test database
    const snapRow = db.prepare('SELECT * FROM prediction_snapshots WHERE match_id = ?').get('test_match_001');
    testAssert(snapRow !== undefined, 'Prediction snapshot written to test DB');
  } catch (e) {
    console.error('  ❌ Prediction Service test failed:', e);
    failed++;
  }

  // Test 2: ReviewService.reviewMatch
  try {
    console.log('\n📋 Test 2: Review Service execution and database write');
    const publicResult = await reviewService.reviewMatch('test_match_001');
    testAssert(publicResult !== null, 'Public review read returns a review');
    testAssert(
      db.prepare('SELECT * FROM post_match_reviews WHERE match_id = ?').get('test_match_001') === undefined,
      'Public review read does not write a review row'
    );

    const result = await reviewService.reviewMatch('test_match_001', { persist: true });
    
    testAssert(result !== null, 'Returned review result');
    testAssert(result.matchId === 'test_match_001', 'Result contains matchId');
    testAssert(result.match.homeScore === 2, 'Result contains actual homeScore=2');
    
    // Verify review record in test database
    const reviewRow = db.prepare('SELECT * FROM post_match_reviews WHERE match_id = ?').get('test_match_001');
    testAssert(reviewRow !== undefined, 'Post-match review row written to test DB');
    const reviewJson = JSON.parse(reviewRow.review_json);
    testAssert(reviewJson.match.homeScore === 2, 'Stored actual home score is 2');
  } catch (e) {
    console.error('  ❌ Review Service test failed:', e);
    failed++;
  }

  // Close database to allow unlinking
  try { db.close(); } catch (e) {}

  // Cleanup DB files
  const dbPath = path.join(__dirname, '..', 'data', 'test.db');
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch (e) {}
  }

  // Print results summary
  console.log('\n============================');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('============================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Unhandle test failure:', err);
  process.exit(1);
});
