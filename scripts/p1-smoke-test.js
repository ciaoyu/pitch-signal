#!/usr/bin/env node
'use strict';
const http = require('http');

const TEST_PORT = 5100;
const HOST = '127.0.0.1';
const ADMIN_TOKEN = 'test-token';

function request(port, pathname, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: HOST, port, path: pathname, method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const tests = [];

  // 1. Invalid JSON body to /api/match-review on default server
  const t1 = await request(5099, '/api/match-review', 'POST', '{not valid json', { 'Content-Type': 'application/json' });
  tests.push({ name: 'invalid JSON -> 400', status: t1.status, ok: t1.status === 400 });

  // 2. Valid JSON but no auth to /api/match-review on default server
  const t2 = await request(5099, '/api/match-review', 'POST', JSON.stringify({ homeId: 'France', awayId: 'Germany', homeScore: 1, awayScore: 0 }), { 'Content-Type': 'application/json' });
  tests.push({ name: 'match-review no auth -> 401/403', status: t2.status, ok: t2.status === 401 || t2.status === 403 });

  // 3. Invalid JSON to /api/post-match-review
  const t3 = await request(5099, '/api/post-match-review', 'POST', '{bad', { 'Content-Type': 'application/json' });
  tests.push({ name: 'post-match-review invalid JSON -> 400', status: t3.status, ok: t3.status === 400 });

  // 4. Health still 200
  const t4 = await request(5099, '/health', 'GET', null, {});
  tests.push({ name: 'health -> 200', status: t4.status, ok: t4.status === 200 });

  // 5. /api/ask with invalid JSON
  const t5 = await request(5099, '/api/ask', 'POST', '{bad json', { 'Content-Type': 'application/json' });
  tests.push({ name: 'ask invalid JSON -> 400', status: t5.status, ok: t5.status === 400 });

  // 6. Authenticated match-review on port 5100 (ADMIN_TOKEN set)
  const t6 = await request(TEST_PORT, '/api/match-review', 'POST', JSON.stringify({
    matchId: 'test-auth-match',
    homeId: 'France',
    awayId: 'Germany',
    homeScore: 2,
    awayScore: 1,
    matchDate: '2026-06-22',
    competition: 'FIFA World Cup 2026',
    group: 'Group A',
    venue: 'Berlin Stadium'
  }), { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_TOKEN}` });
  tests.push({ name: 'match-review with auth -> 200', status: t6.status, ok: t6.status === 200 });
  if (t6.status === 200) {
    try {
      const json = JSON.parse(t6.body);
      tests.push({ name: 'match-review returns review object', status: json && json.match ? 'yes' : 'no', ok: !!(json && json.match) });
    } catch { tests.push({ name: 'match-review returns JSON', status: 'parse-fail', ok: false }); }
  }

  for (const t of tests) {
    console.log(t.ok ? '✅' : '❌', t.name, `(status ${t.status})`);
  }
  const allOk = tests.every(t => t.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
