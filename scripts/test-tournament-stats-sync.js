#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pitch-signal-stats-'));
const runtimeRoot = path.join(tempRoot, 'runtime');
const runtimeDir = path.join(runtimeRoot, 'wc2026');
fs.mkdirSync(runtimeDir, { recursive: true });

process.env.DATA_PATH = runtimeRoot;
process.env.SEED_DATA_PATH = path.join(__dirname, '..', 'resources', 'seed', 'wc2026');

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
}

function squads(goals) {
  return {
    ARG: {
      players: [
        { id: 'lionel-messi', name: 'Lionel Messi', wcGoals: goals, wcApps: 3 },
      ],
    },
  };
}

async function main() {
  writeJson(path.join(runtimeDir, 'matches.json'), {
    matches: [
      { id: '1', status: 'finished', home: { code: 'ARG', score: 1 }, away: { code: 'FRA', score: 0 } },
    ],
  });
  const squadsPath = path.join(runtimeDir, 'squads.json');
  writeJson(squadsPath, squads(5));

  const createEntityRoutes = require('../lib/routes/entities');
  const route = createEntityRoutes({})['GET /api/tournament-stats'];

  const first = await route();
  assert.strictEqual(first.topScorers[0].goals, 5);

  writeJson(squadsPath, squads(6));
  const future = new Date(Date.now() + 2000);
  fs.utimesSync(squadsPath, future, future);

  const second = await route();
  assert.strictEqual(second.topScorers[0].goals, 6, 'cache must refresh when squads.json changes');

  const { createLineupsSyncScheduler } = require('../lib/lineups-sync-scheduler');
  const syncCalls = [];
  const scheduler = createLineupsSyncScheduler({
    dataDir: tempRoot,
    syncFifa: async (names) => {
      syncCalls.push(names);
      return { results: names.map(name => ({ name })), errors: [] };
    },
    lineupsSource: { clearCache() {} },
    logger: { log() {}, error() {} },
  });
  await scheduler.executeSync();
  assert.deepStrictEqual(syncCalls[0], ['lineups.json', 'matches.json', 'squads.json']);

  console.log('2 passed, 0 failed');
}

main()
  .finally(() => fs.rmSync(tempRoot, { recursive: true, force: true }))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
