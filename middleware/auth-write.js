const { constantTimeEqual } = require('../lib/security');

/**
 * 写接口鉴权中间件
 * 用于保护 POST /api/post-match-review 等匿名写入端点。
 *
 * 鉴权方式（任一满足即通过）：
 *   - Authorization: Bearer <token>
 *   - ?token=<token> 查询参数
 *
 * 配置：设置环境变量 WRITE_API_TOKEN。
 * 若 WRITE_API_TOKEN 未设置或为空字符串，所有写入请求一律拒绝。
 */
function requireWriteToken(req) {
  const expected = process.env.WRITE_API_TOKEN || '';
  if (!expected) {
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

  // ?token=<token>
  const queryToken = req?.query?.token || '';
  if (constantTimeEqual(queryToken, expected)) return;

  const err = new Error('Unauthorized: invalid or missing write token');
  err.statusCode = 401;
  throw err;
}

module.exports = { requireWriteToken };
