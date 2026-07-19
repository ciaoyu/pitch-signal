#!/usr/bin/env node
'use strict';

/**
 * Regression Test Suite: Scheduler strict team matching and schedule_updater live team syncing
 * Verifies:
 * 1. match-snapshot-scheduler ignores placeholder snapshots when real teams are scheduled.
 * 2. match-snapshot-scheduler accepts real team snapshots when schedule still has placeholders or when teams match.
 * 3. schedule_updater updates match.teams on disk and in loader cache when scoreboard returns real IDs.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createMatchSnapshotScheduler } = require('../lib/match-snapshot-scheduler');
const { startScheduleUpdater } = require('../lib/schedule_updater');
const loader = require('../data/loader');

console.log('=== PitchSignal Scheduler Team Sync & Strict Matching Tests ===\n');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`📋 ${name} ... ✅ PASS`);
    passCount++;
  } catch (err) {
    console.error(`📋 ${name} ... ❌ FAIL`);
    console.error(err);
    failCount++;
  }
}

// Mock predictionService
const mockPredictionService = {
  predictCalledFor: [],
  async predictMatch(matchId, opts) {
    this.predictCalledFor.push(matchId);
    return { likelyScore: '2-1', homeWin: 0.5, draw: 0.2, awayWin: 0.3 };
  }
};

// Mock DB with prepare/all
function createMockDb(rows) {
  return {
    prepare(query) {
      return {
        all(matchId) {
          return rows.filter(r => String(r.match_id) === String(matchId));
        }
      };
    }
  };
}

async function runAllTests() {
  await test('1. Scheduler executeDueJobs rejects placeholder snapshot when real teams are scheduled', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-sched-1');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // DB has an old placeholder snapshot from when the match was QFW1 vs QFW2
    const mockDb = createMockDb([
      { id: 101, match_id: '760514', created_at: '2026-07-14T12:00:00Z', home_team_id: '17631', away_team_id: '17629' }
    ]);

    mockPredictionService.predictCalledFor = [];
    const scheduler = createMatchSnapshotScheduler({
      predictionService: mockPredictionService,
      reviewService: {},
      db: mockDb,
      dataDir: tmpDir,
      logger: { info: () => {}, warn: () => {}, error: () => {}, log: () => {} }
    });

    const schedule = {
      generatedAt: '2026-07-14T10:00:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T19:00:00Z',
          preSnapshotAtUtc: '2026-07-14T18:00:00Z',
          postSnapshotAtUtc: '2026-07-14T22:45:00Z',
          teams: {
            home: { id: '478', name: 'France' },
            away: { id: '164', name: 'Spain' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'match_snapshot_schedule.json'), JSON.stringify(schedule, null, 2));

    // Execute right at preSnapshotAtUtc time
    await scheduler.executeDueJobs({ schedule, now: Date.parse('2026-07-14T18:05:00Z') });

    const runsFile = path.join(tmpDir, 'match_snapshot_runs.json');
    const runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    const matchState = runs.matches['760514'];

    // Because DB only had placeholder snapshot (17631/17629), executeDueJobs should NOT attach id 101.
    // Instead, since now >= preSnapshotAtUtc, it should trigger predictMatch for the real teams!
    assert.strictEqual(mockPredictionService.predictCalledFor.includes('760514'), true, 'Should predict fresh snapshot when only placeholder snapshot exists for real fixture');
    assert.notStrictEqual(matchState.preSnapshotId, 101, 'Should not attach placeholder snapshot ID to real match state');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await test('2. Scheduler executeDueJobs attaches existing matching snapshot when IDs match', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-sched-2');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // DB has a matching real teams snapshot
    const mockDb = createMockDb([
      { id: 202, match_id: '760514', created_at: '2026-07-14T18:01:00Z', home_team_id: '478', away_team_id: '164' }
    ]);

    mockPredictionService.predictCalledFor = [];
    const scheduler = createMatchSnapshotScheduler({
      predictionService: mockPredictionService,
      reviewService: {},
      db: mockDb,
      dataDir: tmpDir,
      logger: { info: () => {}, warn: () => {}, error: () => {}, log: () => {} }
    });

    const schedule = {
      generatedAt: '2026-07-14T10:00:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T19:00:00Z',
          preSnapshotAtUtc: '2026-07-14T18:00:00Z',
          postSnapshotAtUtc: '2026-07-14T22:45:00Z',
          teams: {
            home: { id: '478', name: 'France' },
            away: { id: '164', name: 'Spain' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'match_snapshot_schedule.json'), JSON.stringify(schedule, null, 2));

    await scheduler.executeDueJobs({ schedule, now: Date.parse('2026-07-14T18:05:00Z') });

    const runsFile = path.join(tmpDir, 'match_snapshot_runs.json');
    const runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    const matchState = runs.matches['760514'];

    assert.strictEqual(matchState.preSnapshotId, 202, 'Should attach matching snapshot id 202');
    assert.strictEqual(mockPredictionService.predictCalledFor.length, 0, 'Should not re-predict when valid snapshot already exists');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await test('3. schedule_updater syncs real teams from scoreboard to match_snapshot_schedule and loader cache', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-schedule');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const schedulePath = path.join(tmpDir, 'match_snapshot_schedule.json');

    const initialSchedule = {
      generatedAt: '2026-07-01T00:00:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T18:00:00Z',
          teams: {
            home: { id: '17631', name: 'QFW1' },
            away: { id: '17629', name: 'QFW2' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(schedulePath, JSON.stringify(initialSchedule, null, 2));

    const originalGetSchedule = loader.getSchedule;
    loader.getSchedule = () => initialSchedule;

    let scoreboardCalled = false;
    const mockEspnFn = async (url, cacheKey, ttl) => {
      scoreboardCalled = true;
      return {
        events: [
          {
            id: '760514',
            status: { type: { state: 'pre', completed: false } },
            competitions: [
              {
                status: { type: { state: 'pre', completed: false } },
                competitors: [
                  { homeAway: 'home', team: { id: '478', displayName: '法国 France', abbreviation: 'FRA' } },
                  { homeAway: 'away', team: { id: '164', displayName: '西班牙 Spain', abbreviation: 'ESP' } }
                ]
              }
            ]
          }
        ]
      };
    };

    const updater = startScheduleUpdater(tmpDir, mockEspnFn, loader, { runImmediately: false });

    await updater.updateOnce();
    updater.stop();

    const updatedDisk = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    const matchDisk = updatedDisk.matches.find(m => m.matchId === '760514');
    assert.strictEqual(matchDisk.teams.home.id, '478');
    assert.strictEqual(matchDisk.teams.home.name, '法国 France');
    assert.strictEqual(matchDisk.teams.home.abbreviation, 'FRA');
    assert.strictEqual(matchDisk.teams.away.id, '164');
    assert.strictEqual(matchDisk.teams.away.name, '西班牙 Spain');
    assert.strictEqual(matchDisk.teams.away.abbreviation, 'ESP');
    assert.strictEqual(matchDisk.name, '西班牙 Spain at 法国 France');
    assert.strictEqual(matchDisk.shortName, 'ESP @ FRA');

    const matchCache = initialSchedule.matches.find(m => m.matchId === '760514');
    assert.strictEqual(matchCache.teams.home.id, '478');
    assert.strictEqual(matchCache.teams.away.id, '164');
    assert.strictEqual(matchCache.name, '西班牙 Spain at 法国 France');

    loader.getSchedule = originalGetSchedule;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await test('4. Scheduler accepts snapshot for real team with ID >= 10000 like Curaçao (11678)', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-sched-4');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // DB has a matching real teams snapshot with Curaçao (11678) vs Ivory Coast (4789)
    const mockDb = createMockDb([
      { id: 303, match_id: '760473', created_at: '2026-07-14T18:01:00Z', home_team_id: '11678', away_team_id: '4789', home_team_name: 'Curaçao', away_team_name: 'Ivory Coast' }
    ]);

    mockPredictionService.predictCalledFor = [];
    const scheduler = createMatchSnapshotScheduler({
      predictionService: mockPredictionService,
      reviewService: {},
      db: mockDb,
      dataDir: tmpDir,
      logger: { info: () => {}, warn: () => {}, error: () => {}, log: () => {} }
    });

    const schedule = {
      generatedAt: '2026-07-14T10:00:00Z',
      matches: [
        {
          matchId: '760473',
          kickoffUtc: '2026-07-14T19:00:00Z',
          preSnapshotAtUtc: '2026-07-14T18:00:00Z',
          postSnapshotAtUtc: '2026-07-14T22:45:00Z',
          teams: {
            home: { id: '11678', name: 'Curaçao', abbreviation: 'CUR' },
            away: { id: '4789', name: 'Ivory Coast', abbreviation: 'CIV' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'match_snapshot_schedule.json'), JSON.stringify(schedule, null, 2));

    await scheduler.executeDueJobs({ schedule, now: Date.parse('2026-07-14T18:05:00Z') });

    const runsFile = path.join(tmpDir, 'match_snapshot_runs.json');
    const runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    const matchState = runs.matches['760473'];

    assert.strictEqual(matchState.preSnapshotId, 303, 'Should attach matching snapshot id 303 without considering Curaçao ID 11678 a placeholder');
    assert.strictEqual(mockPredictionService.predictCalledFor.length, 0, 'Should not re-predict when valid snapshot exists for ID >= 10000');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await test('5. Scheduler rejects DB snapshot with numeric placeholder ID + NULL team_name when schedule is still placeholder', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-sched-5');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // DB only has a snapshot created when match was TBD (home: 17631, away: 17629, team names are NULL)
    const mockDb = createMockDb([
      { id: 99, match_id: '760514', created_at: '2026-07-14T12:00:00Z', home_team_id: '17631', away_team_id: '17629', home_team_name: null, away_team_name: null }
    ]);

    mockPredictionService.predictCalledFor = [];
    const scheduler = createMatchSnapshotScheduler({
      predictionService: mockPredictionService,
      reviewService: {},
      db: mockDb,
      dataDir: tmpDir,
      logger: { info: () => {}, warn: () => {}, error: () => {}, log: () => {} }
    });

    // Schedule right now is still placeholder (17631 / QFW1)
    const schedule = {
      generatedAt: '2026-07-14T10:00:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T19:00:00Z',
          preSnapshotAtUtc: '2026-07-14T18:00:00Z',
          postSnapshotAtUtc: '2026-07-14T22:45:00Z',
          teams: {
            home: { id: '17631', name: 'Quarterfinal 1 Winner', abbreviation: 'QFW1' },
            away: { id: '17629', name: 'Quarterfinal 2 Winner', abbreviation: 'QFW2' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'match_snapshot_schedule.json'), JSON.stringify(schedule, null, 2));

    const actions = await scheduler.executeDueJobs({ schedule, now: Date.parse('2026-07-14T18:05:00Z') });

    const runsFile = path.join(tmpDir, 'match_snapshot_runs.json');
    let runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    let matchState = runs.matches['760514'];

    assert.strictEqual(matchState.preSnapshotId, undefined, 'Should NOT attach DB snapshot id 99 because 17631/17629 with null names is recognized as a placeholder snapshot');
    assert.strictEqual(mockPredictionService.predictCalledFor.length, 0, 'Should NOT call predictMatch when schedule teams are still placeholders');
    assert.strictEqual(actions.includes('pre_snapshot:760514'), false, 'Should NOT trigger pre_snapshot action when schedule teams are placeholders');

    // Phase 2: Schedule updates to real teams France (478) vs Spain (164) inside pre-match window
    const scheduleReal = {
      generatedAt: '2026-07-14T18:10:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T19:00:00Z',
          preSnapshotAtUtc: '2026-07-14T18:00:00Z',
          postSnapshotAtUtc: '2026-07-14T22:45:00Z',
          teams: {
            home: { id: '478', name: '法国 France', abbreviation: 'FRA' },
            away: { id: '164', name: '西班牙 Spain', abbreviation: 'ESP' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(path.join(tmpDir, 'match_snapshot_schedule.json'), JSON.stringify(scheduleReal, null, 2));

    const actionsReal = await scheduler.executeDueJobs({ schedule: scheduleReal, now: Date.parse('2026-07-14T18:15:00Z') });
    runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    matchState = runs.matches['760514'];

    assert.strictEqual(mockPredictionService.predictCalledFor.includes('760514'), true, 'Should call predictMatch after teams resolve to real teams');
    assert.strictEqual(actionsReal.includes('pre_snapshot:760514'), true, 'Should trigger pre_snapshot action once real teams are resolved');
    assert.notStrictEqual(matchState.preSnapshotAt, undefined, 'Should record preSnapshotAt after predicting for real teams');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await test('6. schedule_updater syncs completed match (status=post, completed=true) if top-level name or shortName is stale/placeholder', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-sched-6');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const schedulePath = path.join(tmpDir, 'match_snapshot_schedule.json');

    // A completed match where teams.home and teams.away are synced (478 vs 164),
    // but top-level name and shortName are still placeholders ("Quarterfinal 2 Winner at Quarterfinal 1 Winner", "QFW2 @ QFW1")
    const initialSchedule = {
      generatedAt: '2026-07-14T10:00:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T19:00:00Z',
          name: 'Quarterfinal 2 Winner at Quarterfinal 1 Winner',
          shortName: 'QFW2 @ QFW1',
          teams: {
            home: { id: '478', name: '法国 France', abbreviation: 'FRA' },
            away: { id: '164', name: '西班牙 Spain', abbreviation: 'ESP' }
          },
          status: { state: 'post', completed: true }
        }
      ]
    };
    fs.writeFileSync(schedulePath, JSON.stringify(initialSchedule, null, 2));

    const originalGetSchedule = loader.getSchedule;
    loader.getSchedule = () => initialSchedule;

    let scoreboardCalled = false;
    const mockEspnFn = async (url, cacheKey, ttl) => {
      scoreboardCalled = true;
      return {
        events: [
          {
            id: '760514',
            status: { type: { state: 'post', completed: true } },
            competitions: [
              {
                status: { type: { state: 'post', completed: true } },
                competitors: [
                  { homeAway: 'home', team: { id: '478', displayName: '法国 France', abbreviation: 'FRA' } },
                  { homeAway: 'away', team: { id: '164', displayName: '西班牙 Spain', abbreviation: 'ESP' } }
                ]
              }
            ]
          }
        ]
      };
    };

    const updater = startScheduleUpdater(tmpDir, mockEspnFn, loader, { runImmediately: false });
    await updater.updateOnce();
    updater.stop();

    const updatedDisk = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    const matchDisk = updatedDisk.matches.find(m => m.matchId === '760514');
    assert.strictEqual(scoreboardCalled, true, 'Should fetch scoreboard even when match status is post/completed if top-level display fields are placeholders');
    assert.strictEqual(matchDisk.name, '西班牙 Spain at 法国 France', 'Should update top-level match.name from scoreboard');
    assert.strictEqual(matchDisk.shortName, 'ESP @ FRA', 'Should update top-level match.shortName from scoreboard');

    loader.getSchedule = originalGetSchedule;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await test('7. schedule_updater prevents concurrent overlapping execution via single-flight lock', async () => {
    const tmpDir = path.join(__dirname, '../data/.test-tmp-sched-7');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const schedulePath = path.join(tmpDir, 'match_snapshot_schedule.json');

    const initialSchedule = {
      generatedAt: '2026-07-14T10:00:00Z',
      matches: [
        {
          matchId: '760514',
          kickoffUtc: '2026-07-14T19:00:00Z',
          name: 'Quarterfinal 2 Winner at Quarterfinal 1 Winner',
          shortName: 'QFW2 @ QFW1',
          teams: {
            home: { id: '17631', name: 'QFW1', abbreviation: 'QFW1' },
            away: { id: '17629', name: 'QFW2', abbreviation: 'QFW2' }
          },
          status: { state: 'pre', completed: false }
        }
      ]
    };
    fs.writeFileSync(schedulePath, JSON.stringify(initialSchedule, null, 2));

    const originalGetSchedule = loader.getSchedule;
    loader.getSchedule = () => initialSchedule;

    let calls = 0;
    let resolveFirstFetch;
    const firstFetchPromise = new Promise(resolve => { resolveFirstFetch = resolve; });

    const mockEspnFn = async (url, cacheKey, ttl) => {
      calls++;
      if (calls === 1) {
        // Slow first response
        await firstFetchPromise;
        return {
          events: [
            {
              id: '760514',
              status: { type: { state: 'pre', completed: false } },
              competitions: [
                {
                  status: { type: { state: 'pre', completed: false } },
                  competitors: [
                    { homeAway: 'home', team: { id: '478', displayName: 'Old Home', abbreviation: 'FRA' } },
                    { homeAway: 'away', team: { id: '164', displayName: 'Old Away', abbreviation: 'ESP' } }
                  ]
                }
              ]
            }
          ]
        };
      }
      return { events: [] };
    };

    const updater = startScheduleUpdater(tmpDir, mockEspnFn, loader, { runImmediately: false });

    // Trigger two calls immediately without awaiting the first
    const p1 = updater.updateOnce();
    const p2 = updater.updateOnce();

    assert.strictEqual(p1, p2, 'updateOnce() should return the same in-flight promise when an update is already running');

    // Resolve the slow fetch
    resolveFirstFetch();
    await Promise.all([p1, p2]);
    assert.strictEqual(calls, 1, 'ESPN API should only be called once when concurrent updateOnce() calls occur');

    updater.stop();
    loader.getSchedule = originalGetSchedule;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  console.log(`\n==================================================`);
  console.log(`Results: ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
  console.log(`==================================================\n`);

  if (failCount > 0) process.exit(1);
}

runAllTests().catch(err => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
