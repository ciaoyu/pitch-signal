#!/usr/bin/env node
'use strict';

/**
 * .dockerignore regression guard.
 *
 * Real incident: ".dockerignore" had a blanket "data/wc2026/" exclusion,
 * added when that directory only held files the live-fifa-sync job
 * regenerates on every boot (lineups.json/matches.json/squads.json/
 * sync-log.json). When static data (fifa_player_statistics.json,
 * team_style_facts.json) was later committed under the same directory, the
 * blanket rule silently dropped it from the built image too — the deploy
 * succeeded, health checked out, but /api/tournament-stats quietly fell back
 * to old data because the file it wanted simply wasn't in the container.
 * Docker's .dockerignore cannot selectively re-include a file whose parent
 * directory is excluded (negation doesn't cross an excluded ancestor), so
 * the only safe fix is excluding files individually, never the whole dir.
 *
 * This test fails if that directory-level pattern ever comes back, and
 * fails if any git-tracked file under data/ is covered by a directory-level
 * (trailing-slash) exclusion pattern in .dockerignore.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;
function assert(cond, label) {
  cond ? (console.log('  ✅', label), passed++) : (console.error('  ❌', label), failed++);
}

console.log('━━━ .dockerignore data-safety tests ━━━');

const root = path.join(__dirname, '..');
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

// 1) The exact bug that shipped: a bare directory-level exclusion of
// data/wc2026 (with or without trailing slash) must never reappear.
const hasBlanketWc2026Exclusion = dockerignore.some((l) => l === 'data/wc2026' || l === 'data/wc2026/' || l === 'data/wc2026/**');
assert(!hasBlanketWc2026Exclusion, 'no blanket "data/wc2026/" directory exclusion in .dockerignore');

// 2) General guard: no directory-level (trailing-slash) pattern in
// .dockerignore should match any git-tracked file under data/ — a
// directory-level match is exactly the failure mode that silently drops
// newly-added static data files.
const directoryPatterns = dockerignore.filter((l) => l.endsWith('/') && l.startsWith('data/'));
let trackedDataFiles = [];
try {
  trackedDataFiles = execSync('git ls-files data/', { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  trackedDataFiles = [];
}
assert(trackedDataFiles.length > 0, 'git ls-files data/ returns tracked files (sanity check)');

const shadowed = trackedDataFiles.filter((f) => directoryPatterns.some((dir) => f === dir.slice(0, -1) || f.startsWith(dir)));
assert(shadowed.length === 0, `no git-tracked data/ file is covered by a directory-level .dockerignore pattern${shadowed.length ? `: ${shadowed.slice(0, 5).join(', ')}` : ''}`);

// 3) The two static files this incident was about must specifically survive.
for (const f of ['data/wc2026/fifa_player_statistics.json', 'data/wc2026/team_style_facts.json']) {
  assert(trackedDataFiles.includes(f), `${f} is tracked in git`);
  const literallyExcluded = dockerignore.includes(f);
  assert(!literallyExcluded, `${f} is not individually excluded either`);
}

console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
