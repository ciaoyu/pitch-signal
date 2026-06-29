#!/usr/bin/env node
'use strict';

const http = require('http');

const baseUrl = process.env.HEALTHCHECK_BASE_URL || 'http://127.0.0.1:5099';
const nativeOnly = process.argv.includes('--native-only');

// ── Native module check ────────────────────────────────────────────────

function checkBetterSqlite() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    const row = db.prepare('select 1 as ok').get();
    db.close();
    if (!row || row.ok !== 1) throw new Error('db test returned unexpected value');
    console.log('ok better-sqlite3 native module loaded');
  } catch (error) {
    console.error('fail better-sqlite3 native module did not load');
    console.error(error.message);
    console.error('hint run `npm rebuild better-sqlite3` on this machine, or reinstall with `npm ci`');
    process.exitCode = 1;
  }
}

// ── HTTP helpers ───────────────────────────────────────────────────────

function request(pathname, options = {}) {
  const target = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(target, options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.setTimeout(10000, () => req.destroy(new Error(`${pathname} timed out`)));
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getJson(pathname) {
  const res = await request(pathname);
  if (res.statusCode < 200 || res.statusCode >= 300) throw new Error(`${pathname} returned HTTP ${res.statusCode}`);
  try { return JSON.parse(res.body); } catch (e) { throw new Error(`${pathname} returned invalid JSON: ${e.message}`); }
}

async function checkEndpoint(pathname, validate) {
  const payload = await getJson(pathname);
  const result = validate(payload);
  if (result !== true) throw new Error(`${pathname} failed validation: ${result}`);
  console.log(`ok ${pathname}`);
}

async function checkRaw(pathname, options, validate) {
  const res = await request(pathname, options);
  const result = validate(res);
  if (result !== true) throw new Error(`${pathname} failed validation: ${result}`);
  console.log(`ok ${pathname}`);
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Fetch the homepage HTML and extract all <script> tags.
 * Returns the HTML body so downstream checks can reuse it without a second request.
 */
async function fetchHomepage() {
  const res = await request('/');
  if (res.statusCode !== 200) throw new Error(`homepage returned HTTP ${res.statusCode}`);
  if (!res.body.includes('<!DOCTYPE html>')) throw new Error('homepage does not look like HTML');
  return res.body;
}

/**
 * Extract the bundle.js URL from homepage HTML.
 * Matches: <script ... src="/static/js/bundle.js?v=..." ...></script>
 */
function extractBundleUrl(html) {
  const match = html.match(/src="(\/static\/js\/bundle\.js\?v=[^"]+)"/);
  if (!match) throw new Error('could not find bundle.js script tag in homepage HTML');
  return match[1];
}

/**
 * Verify a JavaScript file is non-empty and contains plausible JS syntax.
 */
function looksLikeJavaScript(body, minBytes) {
  if (body.length < (minBytes || 10000)) return `too small (${body.length} bytes, expected >= ${minBytes || 10000})`;
  // esbuild ESM output uses var/const/class/function/export/import keywords
  const hasKeywords = /\b(var|const|function|class|export|import)\b/.test(body);
  if (!hasKeywords) return 'does not look like JavaScript (missing keywords)';
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  checkBetterSqlite();
  if (process.exitCode || nativeOnly) return;

  // 1. /health endpoint
  await checkEndpoint('/health', (payload) => {
    if (!payload || typeof payload !== 'object') return 'empty response';
    if (payload.status !== 'healthy') return `expected status=healthy, got ${JSON.stringify(payload.status)}`;
    if (typeof payload.uptime !== 'number') return 'missing uptime';
    return true;
  });

  // 2. Homepage HTML → extract dynamic bundle URL
  const homeHtml = await fetchHomepage();
  console.log('ok / (homepage HTML)');

  // 3. Verify the real bundle (dynamic URL from HTML, not hardcoded app.js)
  const bundleUrl = extractBundleUrl(homeHtml);
  await checkRaw(bundleUrl, {}, (res) => {
    if (res.statusCode !== 200) return `bundle returned HTTP ${res.statusCode}`;
    return looksLikeJavaScript(res.body, 10000);
  });

  // 4. /api/schedule — must return matches array
  await checkEndpoint('/api/schedule', (payload) => {
    if (!payload || typeof payload !== 'object') return 'empty response';
    if (!Array.isArray(payload.matches)) return 'matches is not an array';
    return true;
  });

  // 5. /api/standings — must return groups array
  await checkEndpoint('/api/standings', (payload) => {
    if (!payload || typeof payload !== 'object') return 'empty response';
    if (!Array.isArray(payload.groups)) return 'groups is not an array';
    return true;
  });

  // 6. Prediction endpoint (existing)
  await checkEndpoint('/api/predict/760429', (payload) => {
    if (!payload || typeof payload !== 'object') return 'empty response';
    if (!payload.match || typeof payload.match !== 'object') return 'missing match object';
    if (!payload.match.homeName || !payload.match.awayName) return 'missing team names';
    return true;
  });

  // 7. Elo rankings (existing)
  await checkEndpoint('/api/elo/rankings', (payload) => {
    const rankings = Array.isArray(payload) ? payload : payload?.rankings;
    if (!Array.isArray(rankings)) return 'rankings is not an array';
    if (rankings.length < 10) return `expected >= 10 rankings, got ${rankings.length}`;
    return true;
  });

  // 8. Spatial matchup (existing)
  await checkEndpoint('/api/matchup-spatial/478/654', (payload) => {
    if (!payload || !Array.isArray(payload.pairs)) return 'missing pairs array';
    return true;
  });

  // 9. News search (existing)
  await checkEndpoint('/api/news/search?query=france', (payload) => {
    if (payload.error === 'Query parameter required') return 'failed to parse query param';
    return true;
  });

  // 10. Path traversal safety (existing)
  await checkRaw('/static/..%2Fserver.js', {}, (res) => {
    if (res.statusCode !== 403) return `expected 403, got ${res.statusCode}`;
    return true;
  });
}

main().catch((error) => {
  console.error(`fail ${error.message}`);
  console.error(`hint start the server first, or set HEALTHCHECK_BASE_URL. current: ${baseUrl}`);
  process.exit(1);
});
