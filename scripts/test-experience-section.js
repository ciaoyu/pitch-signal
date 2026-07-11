#!/usr/bin/env node
/**
 * KO-14: Experience section tests
 *
 * Verifies lib/services/experience-section.js:
 *   - returns null for teams with no knockout matches
 *   - computes knockout match counts from schedule
 *   - counts goals/assists/yellows/reds from player_match_events
 *   - usedInModel: false, confidence: medium
 */

const assert = require('assert');
const { buildExperienceSection, computeTeamExperience } = require('../lib/services/experience-section');
const { db } = require('../lib/db');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== KO-14 experience section test ===\n');

// ---- 1. returns null when no team IDs ----
console.log('📊 Test 1: null when no team IDs');
{
  const r = buildExperienceSection({ matchId: 'x' });
  check(r === null, 'returns null with no home/away IDs');
}

// ---- 2. returns null for team with no knockout matches ----
console.log('\n📊 Test 2: null for team with no KO matches');
{
  const r = buildExperienceSection({ matchId: 'x', homeTeamId: '999999', awayTeamId: '999998' });
  check(r === null, 'returns null for nonexistent team');
}

// ---- 3. computes KO match count for real team ----
console.log('\n📊 Test 3: computes KO match count for real team');
{
  const sched = require('../data/match_snapshot_schedule.json');
  const ko = (sched.matches || []).filter(m => m.stage === 'knockout' && m.status?.completed);
  if (ko.length > 0) {
    const sampleMatch = ko[0];
    const homeId = sampleMatch.teams?.home?.id;
    const awayId = sampleMatch.teams?.away?.id;
    const home = computeTeamExperience(db, homeId, null);
    const away = computeTeamExperience(db, awayId, null);
    check(home.matchesPlayed >= 1, `home (${sampleMatch.teams?.home?.name}) has >= 1 KO match, got ${home.matchesPlayed}`);
    check(away.matchesPlayed >= 1, `away (${sampleMatch.teams?.away?.name}) has >= 1 KO match, got ${away.matchesPlayed}`);
  } else {
    check(true, 'skipped - no completed KO matches yet');
    check(true, 'skipped');
  }
}

// ---- 4. buildExperienceSection returns valid section ----
console.log('\n📊 Test 4: buildExperienceSection returns valid section');
{
  const sched = require('../data/match_snapshot_schedule.json');
  const ko = (sched.matches || []).filter(m => m.stage === 'knockout' && m.status?.completed);
  if (ko.length > 0) {
    const m = ko[0];
    const r = buildExperienceSection({
      matchId: m.matchId,
      homeTeamId: m.teams?.home?.id,
      awayTeamId: m.teams?.away?.id,
      homeName: m.teams?.home?.name,
      awayName: m.teams?.away?.name,
    });
    check(r !== null, 'returns non-null section');
    check(r.confidence === 'medium', `confidence is medium (got ${r.confidence})`);
    check(r.usedInModel === false, 'usedInModel is false');
    check(r.source === 'world-cup-history+schedule+player-events', `source correct (got ${r.source})`);
    check(typeof r.home.matchesPlayed === 'number', 'home.matchesPlayed is number');
    check(typeof r.away.matchesPlayed === 'number', 'away.matchesPlayed is number');
    check(r.home.name !== null, 'home.name populated');
    check(r.note && r.note.zh && r.note.en, 'bilingual note present');
    check(r.home.allTime.matchesPlayed >= r.home.matchesPlayed, 'all-time matches are a superset');
  } else {
    for (let i = 0; i < 8; i++) check(true, 'skipped - no completed KO matches');
  }
}

// ---- 5. usedInModel always false ----
console.log('\n📊 Test 5: usedInModel always false');
{
  const sched = require('../data/match_snapshot_schedule.json');
  const ko = (sched.matches || []).filter(m => m.stage === 'knockout' && m.status?.completed);
  if (ko.length > 0) {
    const m = ko[0];
    const r = buildExperienceSection({
      matchId: m.matchId,
      homeTeamId: m.teams?.home?.id,
      awayTeamId: m.teams?.away?.id,
    });
    check(r.usedInModel === false, 'usedInModel: false');
  } else {
    check(true, 'skipped');
  }
}

console.log('\n📊 Test 6: ESPN id resolves to ratings_id for ET/pens lookup');
{
  const teamResolver = require('../lib/team_resolver');
  const sched = require('../data/match_snapshot_schedule.json');
  const match = (sched.matches || []).find(m => m.stage === 'knockout' && m.status?.completed);
  if (match) {
    const teamId = String(match.teams.home.id);
    const ratingsId = teamResolver.getRatingsIdByEspnId(teamId);
    const opponent = teamResolver.getRatingsIdByEspnId(match.teams.away.id);
    const info = db.prepare(`INSERT INTO matches (home_team_id, away_team_id, played, went_to_et, decided_by_pens, home_score, away_score, stage)
      VALUES (?, ?, 1, 1, 1, 4, 3, 'knockout')`).run(ratingsId, opponent);
    try {
      const result = computeTeamExperience(db, teamId, null);
      check(result.wentToEt === true && result.decidedByPens === true, 'ratings_id match row found from ESPN id');
    } finally {
      db.prepare('DELETE FROM matches WHERE id = ?').run(info.lastInsertRowid);
    }
  } else check(true, 'skipped');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
