#!/usr/bin/env node
'use strict';

const http = require('http');

const baseUrl = process.env.HEALTHCHECK_BASE_URL || 'http://127.0.0.1:5099';
const nativeOnly = process.argv.includes('--native-only');

function checkBetterSqlite() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.prepare('select 1 as ok').get();
    db.close();
    console.log('ok better-sqlite3 native module loaded');
  } catch (error) {
    console.error('fail better-sqlite3 native module did not load');
    console.error(error.message);
    console.error('hint run `npm rebuild better-sqlite3` on this machine, or reinstall with `npm ci`');
    process.exitCode = 1;
  }
}

function request(pathname, options = {}) {
  const target = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(target, options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.setTimeout(5000, () => req.destroy(new Error(`${pathname} timed out`)));
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

async function main() {
  checkBetterSqlite();
  if (process.exitCode || nativeOnly) return;

  await checkEndpoint('/api/predict/760429', (payload) => {
    if (!payload || typeof payload !== 'object') return 'empty response';
    if (!payload.match || typeof payload.match !== 'object') return 'missing match object';
    if (!payload.match.homeName || !payload.match.awayName) return 'missing team names';
    return true;
  });

  await checkEndpoint('/api/elo/rankings', (payload) => {
    const rankings = Array.isArray(payload) ? payload : payload?.rankings;
    if (!Array.isArray(rankings)) return 'rankings is not an array';
    if (rankings.length < 10) return `expected rankings, got ${rankings.length}`;
    return true;
  });

  await checkRaw('/static/js/app.js', {}, (res) => {
    if (res.statusCode !== 200) return `expected 200, got ${res.statusCode}`;
    if (!res.body.includes('function')) return 'does not look like javascript';
    return true;
  });

  await checkEndpoint('/api/matchup-spatial/478/654', (payload) => {
    if (!payload || !Array.isArray(payload.pairs)) return 'missing pairs array';
    return true;
  });

  await checkEndpoint('/api/news/search?query=france', (payload) => {
    if (payload.error === 'Query parameter required') return 'failed to parse query param';
    return true;
  });

  await checkRaw('/api/ask', { method: 'POST', body: JSON.stringify({ question: 'hello' }) }, (res) => {
    if (res.statusCode < 200 || res.statusCode >= 300) return `expected 2xx, got ${res.statusCode}`;
    try { JSON.parse(res.body); } catch(e) { return 'invalid json'; }
    return true;
  });

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
