const assert = require('assert');
const { db } = require('../lib/db');
const { buildLessonsSection, buildKnockoutIntel } = require('../lib/services/knockout-intel');

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

console.log('=== KO-6: Lessons Learned Section & Bot Context Test Suite ===');

test('1. returns null when neither team has any lessons in post_match_reviews (downgrades to absent)', () => {
  const res = buildLessonsSection({ matchId: '999999', homeName: 'NonExistentTeamA', awayName: 'NonExistentTeamB' });
  assert.strictEqual(res, null, 'Should return null when no lessons exist');
});

test('2. extracts teamSpecific lessons with source matchId and caps at <= 3 items per team', () => {
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO post_match_reviews (match_id, review_json, created_at, updated_at) VALUES (?, ?, ?, ?)');
  const testIds = ['888001', '888002', '888003', '888004'];

  for (let i = 0; i < testIds.length; i++) {
    const review = {
      aiPostmortem: {
        lessonsLearned: {
          teamSpecific: {
            'Spain': `Lesson #${i + 1} for Spain`,
            'Brazil': `Lesson #${i + 1} for Brazil`,
          }
        }
      }
    };
    stmt.run(testIds[i], JSON.stringify(review), now, now);
  }

  try {
    const res = buildLessonsSection({
      matchId: '888005',
      homeName: 'Spain',
      awayName: 'Brazil'
    });

    assert.ok(res, 'Should return lessons section object');
    assert.strictEqual(res.confidence, 'low');
    assert.strictEqual(res.source, 'ai-postmortem');
    assert.strictEqual(res.usedInModel, false);

    assert.ok(Array.isArray(res.home));
    assert.ok(Array.isArray(res.away));

    // Must cap at <= 3 items to avoid prompt token bloat
    assert.ok(res.home.length <= 3, `home lessons count (${res.home.length}) should be <= 3`);
    assert.ok(res.away.length <= 3, `away lessons count (${res.away.length}) should be <= 3`);

    // Check entry shape
    const firstHome = res.home[0];
    assert.ok(firstHome.zh && firstHome.en);
    assert.ok(firstHome.fromMatchId);
  } finally {
    const delStmt = db.prepare('DELETE FROM post_match_reviews WHERE match_id IN (?, ?, ?, ?)');
    delStmt.run(...testIds);
  }
});

test('3. buildKnockoutIntel includes lessons section in sections map', async () => {
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO post_match_reviews (match_id, review_json, created_at, updated_at) VALUES (?, ?, ?, ?)');
  stmt.run('888010', JSON.stringify({
    aiPostmortem: {
      lessonsLearned: {
        teamSpecific: { 'France': 'Maintain defensive structure in extra time' }
      }
    }
  }), now, now);

  try {
    const intel = buildKnockoutIntel({
      matchId: '888011',
      homeName: 'France',
      awayName: 'England',
      stage: 'Semi-finals'
    });

    assert.ok(intel.sections.lessons, 'Should include lessons section');
    assert.strictEqual(intel.sections.lessons.home[0].fromMatchId, '888010');
  } finally {
    db.prepare('DELETE FROM post_match_reviews WHERE match_id = ?').run('888010');
  }
});

console.log('All KO-6 tests passed!');
