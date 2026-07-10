#!/usr/bin/env node
'use strict';

/**
 * Unified test runner — PitchSignal Test Suite
 *
 * Usage:
 *   node scripts/test-runner.js                    # run all
 *   node scripts/test-runner.js --match "Elo"      # match filter
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'scripts');

// All test files (alphabetical, core + boundary)
const TEST_FILES = [
  'test-backtest-sort.js',
  'test-bracket-updater.js',
  'test-data-resolver.js',
  'test-diagnostic-scripts.js',
  'test-elo.js',
  'test-elo-guided-base-lambda.js',
  'test-eventFilter.js',
  'test-fifa-resilience.js',
  'test-final-round-context.js',
  'test-fuzzy-match.js',
  'test-health-enhance.js',
  'test-import-market-values.js',
  'test-ko12-matchup-styles.js',
  'test-ko14-scenarios.js',
  'test-live-state-machine.js',
  'test-logger-trycatch.js',
  'test-ko2-intel-card.js',
  'test-ko11-star-form.js',
  'test-lessons-section.js',
  'test-super-subs-section.js',
  'test-game-state-section.js',
  'test-penalty-section.js',
  'test-penalty-shootout.js',
  'test-matchup-spatial.js',
  'test-output-rules.js',
  'test-parse-event-stage.js',
  'test-pf3-key-events-i18n.js',
  'test-pf4-lineup-evidence.js',
  'test-pf9-worldcup-odds-ui.js',
  'test-pf10-official-bracket-graph.js',
  'test-pf11-corner-analysis-won-corners.js',
  'test-pf8-top-scores.js',
  'test-poisson.js',
  'test-post-match-review.js',
  'test-pre-match-snapshot-guard.js',
  'test-prediction.js',
  'test-referee-stats.js',
  'test-roster-cache.js',
  'test-same-day-leakage.js',
  'test-score-writeback.js',
  'test-security.js',
  'test-services.js',
  'test-substitution-impact.js',
  'test-tactical-board.js',
  'test-team-resolver.js',
  'test-temp-units.js',
  'test-third-place.js',
  'test-tournament-stats-sync.js',
  'test-venue-factor.js',
  'test-venueFactors.js',
    // P2 dedicated tests
  'test-bot-kb.js',
  'test-calibration-report.js',
  'test-odds-divergence.js',
  'test-pwa-push.js',
  'test-user-predictions.js',
  'test-teamcontext-news.js',
    // P4 dedicated tests
  'test-continental-strength-signal.js',
  'test-market-value-signal.js',
  'test-prediction-market-ui.js',
  'test-recent-stats-window.js',
  'test-polymarket-world-cup.js',
  'test-shin-devig.js',
    // Defect-fix regression tests
  'test-moment-review-integration.js',
  'test-matches-seed.js',
  'test-surge-detection.js',
  'test-knockout-writeback.js',
  'test-eval-baselines.js',
    // W1-A live-endpoint discipline regression
  'test-live-endpoint-discipline.js',
    // W1-B deterministic-bug regression
  'test-deterministic-bugs.js',
  'test-w1d-pipeline-audit.js',
    // KO-3 knockout prediction parameter wiring
  'test-knockout-prediction-wiring.js',
    // KO-4 suspension ledger rules engine
  'test-suspension-rules.js',
    // KO-4 player-event extraction (ESPN keyEvents -> player_match_events)
  'test-player-events.js',
    // KO-4 suspensions section contract (wired into knockout-intel)
  'test-knockout-intel-suspensions.js',
    // KO-1 knockout-intel foundation + venue-distance + schedule-lookup + ET/Pens backfill
  'test-knockout-intel.js',
    // KO-5 fatigue index signal
  'test-fatigue-signal.js',
];

const filter = process.argv.includes('--match')
  ? process.argv[process.argv.indexOf('--match') + 1]
  : null;

let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;
const failures = [];
let totalAssertions = 0;
let totalFailedAssertions = 0;

console.log('=== PitchSignal Test Suite ===\n');

for (const file of TEST_FILES) {
  if (filter && !file.toLowerCase().includes(filter.toLowerCase())) continue;

  const filePath = path.join(TEST_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} — file not found, skipping`);
    continue;
  }

  process.stdout.write(`📋 ${file} ... `);
  try {
    const env = {
      ...process.env,
      TEST_MODE: '1',
      TEST_DB_PATH: path.join(ROOT, 'data', 'test.db'),
      NODE_ENV: 'test',
    };
    const output = execSync(`node "${filePath}"`, {
      cwd: ROOT,
      env,
      stdio: 'pipe',
      timeout: 60000,
    }).toString();

    // Parse assertion counts from output (lines containing "passed" and "failed")
    const passMatch = output.match(/(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    if (passMatch) totalAssertions += parseInt(passMatch[1]);
    if (failMatch) totalFailedAssertions += parseInt(failMatch[1]);

    if (output.includes('⚠️  SKIP:') || output.includes('⚠️ SKIP:')) {
      console.log('⚠️  SKIP');
      totalSkipped++;
    } else {
      console.log('✅ PASS');
      totalPassed++;
    }
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    const stdout = e.stdout?.toString() || '';

    // Try to extract assertion counts from partial output
    const passMatch = stdout.match(/(\d+)\s+passed/);
    const failMatch = stdout.match(/(\d+)\s+failed/);
    if (passMatch) totalAssertions += parseInt(passMatch[1]);
    if (failMatch) totalFailedAssertions += parseInt(failMatch[1]);

    console.log('❌ FAIL');
    totalFailed++;
    failures.push({ file, output: (stdout + '\n' + stderr).slice(-600) });
  }
}

// Summary
const totalSuites = totalPassed + totalFailed + totalSkipped;
console.log('\n============================');
console.log(`Suites:  ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped, ${totalSuites} total`);
console.log(`Asserts: ${totalAssertions} passed, ${totalFailedAssertions} failed`);
console.log('============================');

if (failures.length > 0) {
  console.log('\n--- Failure Details ---');
  for (const f of failures) {
    console.log(`\n❌ ${f.file}:`);
    console.log(f.output.slice(0, 400));
  }
  process.exit(1);
}

process.exit(0);
