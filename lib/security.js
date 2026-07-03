'use strict';

const crypto = require('crypto');

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true only when both strings have identical length and content.
 */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 && b.length === 0) return true;
  if (a.length === 0 || b.length === 0) return false;
  // SHA-256 both first so the lengths are always equal before comparing
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

module.exports = { constantTimeEqual };
