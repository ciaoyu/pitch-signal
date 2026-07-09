#!/usr/bin/env node
'use strict';

/**
 * PF-9 regression: the title-odds card must unwrap ApiClient.get() results
 * through res.data.odds. ApiClient.get() never returns the payload directly.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function run() {
  const tabMarkets = { innerHTML: '' };
  const context = {
    window: {
      WorldCup: {
        Utils: {
          tx: (zh) => zh,
          esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          }[c])),
        },
        ApiClient: {
          get: async (url) => {
            assert.strictEqual(url, '/api/world-cup-winner');
            return {
              ok: true,
              data: {
                source: 'polymarket-gamma',
                odds: [
                  { team: 'Spain', probability: 19.65 },
                  { team: 'Argentina', probability: 14.2 },
                ],
              },
            };
          },
        },
      },
    },
    document: {
      getElementById: (id) => (id === 'tab-markets' ? tabMarkets : null),
    },
    console,
  };
  context.global = context;

  const script = fs.readFileSync(path.join(__dirname, '..', 'static/js/world-cup-odds.js'), 'utf8');
  vm.runInNewContext(script, context);

  await context.window.loadWorldCupOdds();

  assert.match(tabMarkets.innerHTML, /Spain/);
  assert.match(tabMarkets.innerHTML, /19\.6%/);
  assert.doesNotMatch(tabMarkets.innerHTML, /夺冠赔率数据暂无/);
}

run()
  .then(() => {
    console.log('✅ PF-9 world-cup odds UI unwrap regression passed');
  })
  .catch((error) => {
    console.error('❌ PF-9 world-cup odds UI unwrap regression failed');
    console.error(error);
    process.exit(1);
  });
