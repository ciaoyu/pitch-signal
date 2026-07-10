#!/usr/bin/env node
/**
 * KO-9: super-subs section tests
 */

const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-ko9.db');
try { fs.unlinkSync(process.env.TEST_DB_PATH); } catch (_) {}

const { db } = require('../lib/db');
const { buildSuperSubsSection } = require('../lib/services/super-subs-section');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

function insertSubstitutionKey(matchId, teamId, minute, playerIn, playerOut, slopeDelta) {
  const raw = {
    playerIn,
    playerOut,
    substitution_impact: {
      status: 'ready',
      metric: 'pressure_index',
      slopeDelta,
      direction: slopeDelta > 0 ? 'positive' : slopeDelta < 0 ? 'negative' : 'neutral',
    },
  };
  db.prepare(`
    INSERT INTO match_moments (match_id, type, minute, team_id, source, raw_json, detected_at)
    VALUES (?, 'substitution_key', ?, ?, 'test', ?, datetime('now'))
  `).run(String(matchId), minute, String(teamId), JSON.stringify(raw));
}

function insertPlayerEvent(matchId, teamId, playerName, eventType, minute) {
  db.prepare(`
    INSERT INTO player_match_events (match_id, team_id, player_name, event_type, minute, minute_added, stage, round, raw_json)
    VALUES (?, ?, ?, ?, ?, 0, 'Group', 'Group', ?)
  `).run(String(matchId), String(teamId), playerName, eventType, minute, JSON.stringify({ player_name: playerName }));
}

console.log('=== KO-9 super-subs section test ===\n');

// ---- 1. Missing inputs => null ----
console.log('📊 missing inputs => null');
{
  check(buildSuperSubsSection({}) === null, 'empty ctx returns null');
  check(buildSuperSubsSection({ matchId: '1', homeTeamId: '203' }) === null, 'missing awayTeamId/db returns null');
}

// ---- 2. Section contract ----
console.log('\n📊 section contract');
{
  const section = buildSuperSubsSection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    homeName: 'Mexico',
    awayName: 'South Africa',
    db,
  });
  check(section !== null, 'section returned');
  check(section.usedInModel === false, 'usedInModel false');
  check(section.source === 'match_moments+substitution-impact+player-events', 'source field');
  check(Array.isArray(section.home.superSubs), 'home superSubs array');
  check(Array.isArray(section.away.superSubs), 'away superSubs array');
  check(typeof section.home.aggregateImpact === 'number', 'home aggregateImpact numeric');
  check(typeof section.away.aggregateImpact === 'number', 'away aggregateImpact numeric');
  check(['home', 'away', 'even'].includes(section.comparison.side), 'comparison side');
}

// ---- 3. No data => empty ----
console.log('\n📊 no data => empty');
{
  const section = buildSuperSubsSection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  check(section.home.superSubs.length === 0, 'home no super subs');
  check(section.away.superSubs.length === 0, 'away no super subs');
  check(section.confidence === 'low', 'low confidence when no data');
}

// ---- 4. Super sub with impact only ----
console.log('\n📊 super sub with impact');
{
  insertSubstitutionKey('m100', '203', 60, 'Lozano', 'Jimenez', 1.2);
  const section = buildSuperSubsSection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  const sub = section.home.superSubs.find((s) => s.playerName === 'Lozano');
  check(sub !== undefined, 'Lozano found as super sub');
  check(sub.appearances === 1, 'one appearance');
  check(sub.avgImpact === 1.2, 'avgImpact 1.2');
  check(section.home.aggregateImpact === 1.2, 'home aggregateImpact 1.2');
  check(section.confidence === 'medium', 'medium confidence when one team has data');
}

// ---- 5. Super sub with goal after sub ----
console.log('\n📊 super sub with goal after sub');
{
  insertSubstitutionKey('m101', '467', 55, 'Tau', 'Mokoena', 0.5);
  insertPlayerEvent('m101', '467', 'Tau', 'goal', 72);
  const section = buildSuperSubsSection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  const sub = section.away.superSubs.find((s) => s.playerName === 'Tau');
  check(sub !== undefined, 'Tau found as super sub');
  check(sub.goalsAfterSub === 1, 'Tau scored after sub');
  check(sub.notes.some((n) => n.includes('1 goal')), 'notes mention goal');
}

// ---- 6. Multiple appearances + ranking ----
console.log('\n📊 multiple appearances and ranking');
{
  insertSubstitutionKey('m102', '203', 70, 'Lozano', 'Alvarez', 0.8);
  insertSubstitutionKey('m103', '203', 65, 'NewStar', 'Veteran', 0.3);
  insertPlayerEvent('m103', '203', 'NewStar', 'goal', 80);
  insertSubstitutionKey('m104', '203', 50, 'Acosta', 'Reyes', 1.5);
  const section = buildSuperSubsSection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  const lozano = section.home.superSubs.find((s) => s.playerName === 'Lozano');
  check(lozano.appearances === 2, 'Lozano two appearances');
  check(lozano.avgImpact === 1.0, 'Lozano avg impact (1.2+0.8)/2 = 1.0');
  // Acosta has the highest impact score, so ranks top.
  check(section.home.superSubs[0].playerName === 'Acosta', 'Acosta ranks top due to highest impact');
  check(section.home.superSubs.length <= 5, 'top 5 capped');
}

// ---- 7. Comparison side ----
console.log('\n📊 comparison side');
{
  const section = buildSuperSubsSection({
    matchId: '760777',
    homeTeamId: '203',
    awayTeamId: '467',
    db,
  });
  check(section.comparison.side === 'home', 'home bench stronger in this fixture');
  check(section.comparison.reason.includes('Home bench'), 'reason mentions home bench');
  check(section.confidence === 'medium', 'medium confidence (away has fewer than 2 subs)');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
