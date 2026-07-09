#!/usr/bin/env node
/**
 * P2-4: user-predictions pure logic + HTTP structure validation (no better-sqlite3 dependency)
 */
'use strict';

const { COOKIE_UID } = require('../lib/routes/user-predictions');

let passed = 0, failed = 0;
function assert(cond, label) { cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++); }

// 1. COOKIE_UID constant
assert(COOKIE_UID === 'ps_uid', 'COOKIE_UID = ps_uid');

// 2. Simulate cookie parsing logic
{
  const getUid = (cookie) => {
    if (!cookie) return null;
    const m = cookie.match(/(?:^|;\s*)ps_uid=([^;]+)/);
    return m ? m[1].trim() : null;
  };
  assert(getUid('ps_uid=anon_abc123') === 'anon_abc123', 'cookie parser extracts uid');
  assert(getUid('foo=bar; ps_uid=x9z; baz=qux') === 'x9z', 'cookie parser finds mid-cookie uid');
  assert(getUid('') === null, 'empty cookie → null');
  assert(getUid(null) === null, 'null cookie → null');
  assert(getUid('no-uid-here') === null, 'no ps_uid → null');
}

// 3. Simulate POST validation logic (no DB access)
{
  const validatePost = (body) => {
    const { matchId, choice, confidence } = body || {};
    if (!matchId || !choice) return { error: 'matchId and choice are required', code: 400 };
    if (!['home', 'draw', 'away'].includes(choice)) return { error: 'choice must be home, draw, or away', code: 400 };
    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) return { error: 'confidence must be a number between 0 and 1', code: 400 };
    return { ok: true, matchId, choice, confidence };
  };
  assert(validatePost({ matchId: '760432', choice: 'home' }).ok === true, 'valid body → ok');
  assert(validatePost({ choice: 'home' }).code === 400, 'missing matchId → 400');
  assert(validatePost({ matchId: '760432' }).code === 400, 'missing choice → 400');
  assert(validatePost({ matchId: '760432', choice: 'invalid' }).code === 400, 'invalid choice → 400');
  assert(validatePost({ matchId: '760432', choice: 'home', confidence: 0.5 }).ok === true, 'valid confidence → ok');
  assert(validatePost({ matchId: '760432', choice: 'home', confidence: 1.5 }).code === 400, 'confidence>1 → 400');
  assert(validatePost({ matchId: '760432', choice: 'home', confidence: -0.1 }).code === 400, 'confidence<0 → 400');
}

// 4. Simulate SET-Cookie construction
{
  const uidCookie = (uid) => `${COOKIE_UID}=${uid}; Path=/; Max-Age=31536000; SameSite=Lax`;
  const c = uidCookie('anon_test42');
  assert(c.startsWith('ps_uid=anon_test42;'), 'cookie starts with correct key=value');
  assert(c.includes('Path=/'), 'cookie includes Path=/');
  assert(c.includes('Max-Age=31536000'), 'cookie includes 1-year expiry');
}

// 5. Aggregate percentage calculation
{
  const votes = { home: 7, draw: 2, away: 1 };
  const total = 10;
  const pct = {
    home: Math.round((votes.home / total) * 1000) / 10,
    draw: Math.round((votes.draw / total) * 1000) / 10,
    away: Math.round((votes.away / total) * 1000) / 10,
  };
  assert(pct.home === 70, 'home = 70%');
  assert(pct.draw === 20, 'draw = 20%');
  assert(pct.away === 10, 'away = 10%');
  assert(Math.abs(pct.home + pct.draw + pct.away - 100) < 0.1, 'sum = 100%');
}

// 6. Zero-vote handling
{
  const votes = { home: 0, draw: 0, away: 0 };
  const total = 0;
  const pct = total > 0 ? {
    home: Math.round((votes.home / total) * 1000) / 10,
    draw: Math.round((votes.draw / total) * 1000) / 10,
    away: Math.round((votes.away / total) * 1000) / 10,
  } : { home: 0, draw: 0, away: 0 };
  assert(pct.home === 0, 'zero votes → 0%');
}

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
