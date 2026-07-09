const { constantTimeEqual } = require('../lib/security');

/**
 * Write-endpoint auth middleware.
 * Protects anonymous write endpoints such as POST /api/post-match-review.
 *
 * Auth method:
 *   - Authorization: Bearer <token>
 *
 * Config: set the WRITE_API_TOKEN environment variable.
 * If WRITE_API_TOKEN is unset or empty, all write requests are rejected.
 */
function requireWriteToken(req) {
  const expected = process.env.WRITE_API_TOKEN || '';
  if (!expected) {
    console.warn('⚠️ Write request rejected: WRITE_API_TOKEN not configured (all write endpoints are 403 in Beta)');
    const err = new Error('Write API disabled: WRITE_API_TOKEN not configured');
    err.statusCode = 403;
    throw err;
  }

  // Authorization: Bearer <token>
  const authHeader = req?.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const provided = authHeader.slice(7).trim();
    if (constantTimeEqual(provided, expected)) return;
  }

  const err = new Error('Unauthorized: invalid or missing write token');
  err.statusCode = 401;
  throw err;
}

module.exports = { requireWriteToken };
