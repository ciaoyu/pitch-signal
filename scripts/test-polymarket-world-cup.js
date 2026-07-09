#!/usr/bin/env node
/**
 * PF-7: live "World Cup Winner" title-odds client test (network-free).
 *
 * Verifies polymarketClient.fetchWorldCupWinner():
 *   1. parses the real Gamma `world-cup-winner` event shape -> ranked list
 *   2. excludes non-title markets
 *   3. returns null on non-200 (never mock, never crash)
 *   4. returns null when fetch throws (never mock, never crash)
 *   5. caches so the API is hit once per TTL window
 */

const PolymarketClient = require('../lib/polymarketClient');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}`); failed++; }
}

const fixture = [{
  title: 'World Cup Winner',
  markets: [
    { question: 'Will France win the 2026 FIFA World Cup?', outcomePrices: '["0.3185","0.6815"]', volumeNum: 104379974, liquidityNum: 5880206 },
    { question: 'Will Spain win the 2026 FIFA World Cup?', outcomePrices: '["0.1935","0.8065"]', volumeNum: 95954306, liquidityNum: 7225896 },
    { question: 'Will England win the 2026 FIFA World Cup?', outcomePrices: '["0.1605","0.8395"]', volumeNum: 90509457, liquidityNum: 6400966 },
    { question: 'Will Togo win the 2026 FIFA World Cup?', outcomePrices: '["0.001","0.999"]', volumeNum: 100, liquidityNum: 10 },
    { question: 'Will it rain in Paris?', outcomePrices: '["0.5","0.5"]', volumeNum: 1, liquidityNum: 1 }, // non-title, excluded
  ],
}];

function setFetch(fn) { global.fetch = fn; }

async function run() {
  // 1 + 2: parse + ranking + exclude non-title markets
  {
    let calls = 0;
    setFetch(async (url) => { calls++; return { ok: true, json: async () => fixture }; });
    const client = new PolymarketClient();
    const data = await client.fetchWorldCupWinner();
    assert(data && Array.isArray(data.odds), 'returns data with odds array');
    assert(data.odds.length === 4, `excludes non-title market (got ${data.odds.length}, expect 4)`);
    assert(data.odds[0].team === 'France' && data.odds[0].probability === 31.85, `top = France 31.85% (got ${data.odds[0].team} ${data.odds[0].probability})`);
    assert(data.odds[0].probability > data.odds[1].probability && data.odds[1].probability > data.odds[2].probability, 'sorted descending by probability');
    assert(data.odds[3].team === 'Togo' && data.odds[3].probability === 0.1, 'eliminated team ~0% (Togo 0.1%)');
    assert(typeof data.fetchedAt === 'string', 'includes fetchedAt timestamp');

    // 5: second call within TTL hits cache (fetch not called again)
    const again = await client.fetchWorldCupWinner();
    assert(again && again.odds[0].team === 'France', 'cached second call returns same data');
    assert(calls === 1, `API called once, not twice (calls=${calls})`);
  }

  // 3: non-200 -> null, no throw
  {
    setFetch(async () => ({ ok: false, status: 500, json: async () => [] }));
    const client = new PolymarketClient();
    let threw = false;
    let res = null;
    try { res = await client.fetchWorldCupWinner(); } catch (e) { threw = true; }
    assert(!threw, 'non-200 does not throw');
    assert(res === null, 'non-200 returns null (no mock fallback)');
  }

  // 4: fetch throws -> null, no throw
  {
    setFetch(async () => { throw new Error('network down'); });
    const client = new PolymarketClient();
    let threw = false;
    let res = null;
    try { res = await client.fetchWorldCupWinner(); } catch (e) { threw = true; }
    assert(!threw, 'fetch throw does not propagate');
    assert(res === null, 'fetch throw returns null (no mock fallback)');
  }
}

run().then(() => {
  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error('test crashed:', e);
  process.exit(1);
});
