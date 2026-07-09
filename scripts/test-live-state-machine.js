/**
 * test-live-state-machine.js — P0-4 state machine closure and live-score tests
 */
const assert = require('assert');
const { resolveMatchState } = require('../lib/services/live-state-machine');

console.log('=== P0-4: Live Score & State Machine Closure Test ===\n');

// 1. Test pre (before kickoff)
const tPre = resolveMatchState({ statusName: 'STATUS_SCHEDULED', statusState: 'pre' });
assert.strictEqual(tPre.state, 'pre', 'STATUS_SCHEDULED -> pre');
assert.strictEqual(tPre.label, 'PRE', 'label PRE');
console.log('✅ PRE state resolved correctly:', tPre);

// 2. Test match (in progress)
const tMatch1 = resolveMatchState({ statusName: 'STATUS_FIRST_HALF', statusState: 'in', minute: 23, displayClock: "23'" });
assert.strictEqual(tMatch1.state, 'match', 'STATUS_FIRST_HALF -> match');
assert.strictEqual(tMatch1.period, 1, 'period 1');
assert.strictEqual(tMatch1.label, "LIVE 23'", 'label LIVE 23\'');
console.log('✅ LIVE (1H) state resolved correctly:', tMatch1);

const tMatch2 = resolveMatchState({ statusName: 'STATUS_SECOND_HALF', statusState: 'in', minute: 68, displayClock: "68'" });
assert.strictEqual(tMatch2.state, 'match', 'STATUS_SECOND_HALF -> match');
assert.strictEqual(tMatch2.period, 2, 'period 2');
assert.strictEqual(tMatch2.label, "LIVE 68'", 'label LIVE 68\'');
console.log('✅ LIVE (2H) state resolved correctly:', tMatch2);

// 3. Test ht (halftime)
const tHT = resolveMatchState({ statusName: 'STATUS_HALFTIME', statusState: 'in', statusDetail: 'HT' });
assert.strictEqual(tHT.state, 'ht', 'STATUS_HALFTIME -> ht');
assert.strictEqual(tHT.label, 'HT', 'label HT');
console.log('✅ HT state resolved correctly:', tHT);

// 4. Test et (extra time)
const tET = resolveMatchState({ statusName: 'STATUS_FIRST_EXTRA', statusState: 'in', minute: 98, displayClock: "98'" });
assert.strictEqual(tET.state, 'et', 'STATUS_FIRST_EXTRA -> et');
assert.strictEqual(tET.period, 3, 'period 3 (first extra)');
assert.strictEqual(tET.label, "ET 98'", 'label ET 98\'');
console.log('✅ ET state resolved correctly:', tET);

// 5. Test pen (penalty shootout)
const tPen = resolveMatchState({ statusName: 'STATUS_SHOOTOUT', statusState: 'in', statusDetail: 'Shootout' });
assert.strictEqual(tPen.state, 'pen', 'STATUS_SHOOTOUT -> pen');
assert.strictEqual(tPen.label, 'PENS', 'label PENS');
console.log('✅ PEN state resolved correctly:', tPen);

// 6. Test end (full time)
const tEnd = resolveMatchState({ statusName: 'STATUS_FINAL', statusState: 'post' });
assert.strictEqual(tEnd.state, 'end', 'STATUS_FINAL -> end');
assert.strictEqual(tEnd.label, 'FT', 'label FT');
console.log('✅ END (FT) state resolved correctly:', tEnd);

const tEndPen = resolveMatchState({ statusName: 'STATUS_FINAL_PEN', statusState: 'post', hasPenalties: true });
assert.strictEqual(tEndPen.state, 'end', 'STATUS_FINAL_PEN -> end');
assert.strictEqual(tEndPen.label, 'FT-Pens', 'label FT-Pens');
console.log('✅ END (FT-Pens) state resolved correctly:', tEndPen);

console.log('\n🎉 All 6-state match stage transitions verified successfully!');
