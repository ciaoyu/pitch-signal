/**
 * CORS middleware — PitchSignal
 * Applies security headers, restricts browser origins, and handles OPTIONS preflight.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5099',
  'http://127.0.0.1:5099',
];

function getAllowedOrigins() {
  return (process.env.CORS_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function wrapCORS(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // CSP Report-Only header for security monitoring
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join(';');
  res.setHeader('Content-Security-Policy-Report-Only', cspDirectives);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(origin && !allowedOrigins.includes(origin) ? 403 : 204);
    res.end();
    return true; // caller should return early
  }
  return false;
}

module.exports = { wrapCORS };
