'use strict';

const crypto = require('crypto');

/**
 * 恒定时间字符串比较，用于防止时序攻击。
 * 仅当两字符串长度和内容完全一致时返回 true。
 */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  if (a.length === 0) return b.length === 0;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(aBuf, bBuf);
}

module.exports = { constantTimeEqual };
