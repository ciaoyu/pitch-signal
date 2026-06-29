'use strict';

const crypto = require('crypto');

/**
 * 恒定时间字符串比较，用于防止时序攻击。
 * 仅当两字符串长度和内容完全一致时返回 true。
 */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 && b.length === 0) return true;
  if (a.length === 0 || b.length === 0) return false;
  // 先 SHA-256 再比，长度一定一致
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

module.exports = { constantTimeEqual };
