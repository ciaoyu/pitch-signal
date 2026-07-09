#!/usr/bin/env node
/**
 * KO-4: suspension rules engine table-driven tests
 *
 * Verifies lib/suspension.js against the 2026 FIFA card regulations:
 *   - two yellows in DIFFERENT matches (same window) => 1-match ban
 *   - two yellows in the SAME match => sending-off (red), NOT counted as 2 accumulated
 *   - straight red => ban + pendingDisciplinary
 *   - yellow reset after group stage (entering R16) AND after QF (entering SF)
 *   - no cards => no suspension / no risk
 */

const { evaluatePlayerSuspension, evaluateRoster, YELLOW_CARD_RESET_AFTER_ROUNDS } = require('../lib/suspension');

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== KO-4 suspension rules engine test ===\n');

// ---- 1. Two yellows in DIFFERENT matches (same window, no reset between) => ban ----
console.log('📊 Test 1: 隔场两黄停一场 (two yellows, different matches, same window)');
{
  const v = evaluatePlayerSuspension(
    [
      { match_id: 'm1', round: 'Round of 32', event_type: 'yellow' },
      { match_id: 'm2', round: 'Round of 16', event_type: 'yellow' },
    ],
    { nextRound: 'Quarter-finals' }
  );
  check(v.suspended, 'suspended for next match');
  check(v.reason === 'two_yellow', `reason === 'two_yellow' (got ${v.reason})`);
  check(v.yellowCount === 2, `yellowCount === 2 (got ${v.yellowCount})`);
  check(v.pendingDisciplinary === false, 'no pending disciplinary for accumulation ban');
}

// ---- 2. Reset boundary: group yellow wiped entering R16 ----
console.log('\n📊 Test 2: 清零边界 (group yellow reset entering R16)');
{
  const v = evaluatePlayerSuspension(
    [{ match_id: 'm1', round: 'Group A', event_type: 'yellow' }],
    { nextRound: 'Round of 16' }
  );
  check(v.yellowCount === 0, 'group yellow wiped at R16 reset');
  check(!v.suspended, 'not suspended');
  check(!v.atRisk, 'not at-risk (yellow reset)');
}

// ---- 3. Two yellows in SAME match => sending-off, NOT 2 accumulated ----
console.log('\n📊 Test 3: 一场两黄=红不算两黄 (same-match double booking)');
{
  const v = evaluatePlayerSuspension(
    [
      { match_id: 'm1', round: 'Quarter-finals', event_type: 'yellow' },
      { match_id: 'm1', round: 'Quarter-finals', event_type: 'yellow' },
    ],
    { nextRound: 'Semi-finals' }
  );
  check(v.suspended, 'suspended (sent off)');
  check(v.reason === 'second_yellow', `reason === 'second_yellow' (got ${v.reason})`);
  check(v.yellowCount === 0, 'the two bookings are NOT counted as 2 accumulated yellows');
}

// ---- 4. Straight red + a yellow already on the player (same window) ----
console.log('\n📊 Test 4: 红+身上有黄 (straight red with an existing yellow, same window)');
{
  const v = evaluatePlayerSuspension(
    [
      { match_id: 'm1', round: 'Round of 32', event_type: 'yellow' },
      { match_id: 'm2', round: 'Round of 16', event_type: 'red' },
    ],
    { nextRound: 'Quarter-finals' }
  );
  check(v.suspended, 'suspended (straight red)');
  check(v.reason === 'red', `reason === 'red' (got ${v.reason})`);
  check(v.pendingDisciplinary === true, 'straight red flagged pendingDisciplinary');
  check(v.yellowCount === 1, 'existing yellow still tracked independently (not erased by red)');
}

// ---- 5. Straight red alone => ban + pending ----
console.log('\n📊 Test 5: 直红 pendingDisciplinary');
{
  const v = evaluatePlayerSuspension(
    [{ match_id: 'm1', round: 'Round of 16', event_type: 'red' }],
    { nextRound: 'Quarter-finals' }
  );
  check(v.suspended && v.reason === 'red' && v.pendingDisciplinary, 'straight red => suspended + pending');
}

// ---- 6. Second-yellow stored explicitly as event_type ----
console.log('\n📊 Test 6: secondyellow event_type (ESPN reports as red)');
{
  const v = evaluatePlayerSuspension(
    [{ match_id: 'm1', round: 'Quarter-finals', event_type: 'secondyellow' }],
    { nextRound: 'Semi-finals' }
  );
  check(v.suspended && v.reason === 'second_yellow', 'secondyellow => suspended, reason second_yellow');
  check(v.pendingDisciplinary === false, 'second-yellow red is NOT a straight red (no committee flag)');
}

// ---- 7. No cards => nothing ----
console.log('\n📊 Test 7: 无牌 (no cards)');
{
  const v = evaluatePlayerSuspension([], { nextRound: 'Semi-finals' });
  check(!v.suspended && !v.atRisk && v.yellowCount === 0, 'no cards => clean');
}

// ---- 8. Second reset: R16/QF yellows wiped entering SF ----
console.log('\n📊 Test 8: 清零边界 (R16 yellow wiped entering SF)');
{
  const v = evaluatePlayerSuspension(
    [{ match_id: 'm1', round: 'Round of 16', event_type: 'yellow' }],
    { nextRound: 'Semi-finals' }
  );
  check(v.yellowCount === 0, 'R16 yellow wiped at SF reset');
  check(!v.atRisk, 'not at-risk after reset');
}

// ---- 9. Two yellows across reset boundary => only the post-reset one counts ----
console.log('\n📊 Test 9: 跨清零的隔场两黄 (one pre-reset, one post-reset)');
{
  const v = evaluatePlayerSuspension(
    [
      { match_id: 'm1', round: 'Group A', event_type: 'yellow' }, // wiped at R16
      { match_id: 'm2', round: 'Round of 16', event_type: 'yellow' }, // active window
    ],
    { nextRound: 'Quarter-finals' }
  );
  check(v.yellowCount === 1, 'only the post-reset (R16) yellow counts');
  check(!v.suspended && v.atRisk, 'one active yellow => at-risk, not suspended');
}

// ---- 10. evaluateRoster splits home/away ----
console.log('\n📊 Test 10: evaluateRoster home/away split');
{
  const r = evaluateRoster(
    [
      { player_name: 'P Home', team_id: 'H', round: 'Round of 32', event_type: 'yellow' },
      { player_name: 'P Home', team_id: 'H', round: 'Round of 16', event_type: 'yellow' },
      { player_name: 'P Away', team_id: 'A', round: 'Round of 16', event_type: 'red' },
    ],
    { nextRound: 'Quarter-finals', homeTeamId: 'H', awayTeamId: 'A' }
  );
  check(r.suspended.home.length === 1 && r.suspended.home[0].player === 'P Home', 'home player suspended (two_yellow)');
  check(r.suspended.away.length === 1 && r.suspended.away[0].reason === 'red', 'away player suspended (red)');
}

// ---- 11. Reset constants sanity ----
console.log('\n📊 Test 11: reset constants (2026 two-reset rule)');
{
  check(Array.isArray(YELLOW_CARD_RESET_AFTER_ROUNDS) && YELLOW_CARD_RESET_AFTER_ROUNDS.length === 2,
    'two reset points defined (group-stage + QF)');
  check(YELLOW_CARD_RESET_AFTER_ROUNDS.includes('Group') && YELLOW_CARD_RESET_AFTER_ROUNDS.includes('Quarter-finals'),
    'resets AFTER Group and AFTER Quarter-finals');
}

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
