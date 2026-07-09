#!/usr/bin/env node
'use strict';
/**
  * lib/security.js — constantTimeEqual tests
 */
const assert = require('assert');
const { constantTimeEqual } = require('../lib/security');

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

console.log('=== Security: constantTimeEqual Tests ===\n');

// Identical strings
check(constantTimeEqual('abc123', 'abc123'), 'Identical strings → true');
check(constantTimeEqual('hello-world-token', 'hello-world-token'), 'Longer identical → true');

// Different strings (same length)
check(!constantTimeEqual('abc123', 'abc124'), 'Same-length different → false');
check(!constantTimeEqual('token_a', 'token_b'), 'Same-length different (short) → false');

// Different lengths
check(!constantTimeEqual('short', 'longer-token'), 'Different lengths → false');
check(!constantTimeEqual('', 'a'), 'Empty vs non-empty → false');

// Empty strings
check(constantTimeEqual('', ''), 'Both empty → true');

// Non-string inputs
check(!constantTimeEqual(null, 'abc'), 'null vs string → false');
check(!constantTimeEqual('abc', undefined), 'string vs undefined → false');
check(!constantTimeEqual(123, 123), 'Number inputs → false');
check(!constantTimeEqual({}, {}), 'Object inputs → false');

// Edge cases
check(!constantTimeEqual('abc', 'ABC'), 'Case-sensitive (abc vs ABC) → false');
check(constantTimeEqual('abc def', 'abc def'), 'String with space → true');

console.log(`\n============================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('============================');
process.exit(failed > 0 ? 1 : 0);
