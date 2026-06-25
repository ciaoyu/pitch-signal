'use strict';

/**
 * Execute due snapshot jobs from data/match_snapshot_schedule.json.
 *
 * This script is deliberately conservative:
 * - It never creates a "pre-match" snapshot after kickoff.
 * - It records misses instead of silently backfilling.
 * - It only marks post-match jobs done when the review endpoint returns a final
 *   completed match.
 */

const fs = require('fs');
const { execFileSync } = require('child_process');
const http = require('http');
const https = require('https');
const path = require('path');
const { db } = require('../lib/db');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(ROOT, 'data', 'match_snapshot_schedule.json');
const RUNS_FILE = path.join(ROOT, 'data', 'match_snapshot_runs.json');
const BASE_URL = process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:5099';
const NOW = process.env.NOW ? new Date(process.env.NOW) : new Date();
const DRY_RUN = process.argv.includes('--dry-run');
const RECONCILE_ONLY = process.argv.includes('--reconcile-only');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { timeout: 30000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400 || parsed.error) {
            const error = new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`);
            error.payload = parsed;
            reject(error);
            return;
          }
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', (error) => {
      if (error.code === 'EPERM') {
        try {
          const body = execFileSync('curl', ['-fsSL', url], {
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024,
          });
          resolve(JSON.parse(body));
        } catch (curlError) {
          reject(curlError);
        }
        return;
      }
      reject(error);
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
  });
}

function jobState(runs, matchId) {
  runs.matches ||= {};
  runs.matches[matchId] ||= {};
  return runs.matches[matchId];
}

function parseDbTime(value) {
  if (!value) return null;
  const text = String(value);
  const iso = text.includes('T') ? text : `${text.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function getExistingPreSnapshot(match) {
  const row = db.prepare(`
    SELECT id, created_at
    FROM prediction_snapshots
    WHERE match_id = ?
    ORDER BY created_at ASC
    LIMIT 1
  `).get(String(match.matchId));
  if (!row) return null;

  const createdMs = parseDbTime(row.created_at);
  const kickoffMs = Date.parse(match.kickoffUtc);
  if (createdMs != null && createdMs < kickoffMs) {
    return {
      id: row.id,
      createdAt: row.created_at,
    };
  }
  return null;
}

function getSavedPostReview(match) {
  return db.prepare(`
    SELECT actual_home_score, actual_away_score, status, updated_at
    FROM post_match_reviews
    WHERE match_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(String(match.matchId));
}

function isCompletedReview(payload) {
  return Boolean(payload?.match?.completed || payload?.match?.status === 'STATUS_FINAL' || payload?.match?.status === 'STATUS_FULL_TIME');
}

async function runPre(match, state, actions) {
  const existingPre = getExistingPreSnapshot(match);
  if (existingPre) {
    state.preSnapshotAt ||= existingPre.createdAt;
    state.preSnapshotId ||= existingPre.id;
    delete state.preMissedAt;
    delete state.preMissReason;
    return;
  }

  if (RECONCILE_ONLY) return;
  if (state.preSnapshotAt || state.preMissedAt) return;

  const nowMs = NOW.getTime();
  const preMs = Date.parse(match.preSnapshotAtUtc);
  const kickoffMs = Date.parse(match.kickoffUtc);
  if (nowMs < preMs) return;

  if (nowMs >= kickoffMs) {
    state.preMissedAt = NOW.toISOString();
    state.preMissReason = 'kickoff_passed';
    actions.push(`missed pre ${match.matchId} ${match.name}`);
    return;
  }

  actions.push(`pre snapshot ${match.matchId} ${match.name}`);
  if (DRY_RUN) return;
  const payload = await requestJson(`${BASE_URL}/api/predict/${match.matchId}`);
  state.preSnapshotAt = NOW.toISOString();
  state.preSnapshotSummary = {
    likelyScore: payload.likelyScore || null,
    homeWin: payload.homeWin ?? null,
    draw: payload.draw ?? null,
    awayWin: payload.awayWin ?? null,
  };
}

async function runPost(match, state, actions) {
  const savedReview = getSavedPostReview(match);
  if (savedReview) {
    state.postReviewAt ||= savedReview.updated_at || NOW.toISOString();
    state.postReviewSummary ||= {
      actualScore: `${savedReview.actual_home_score}-${savedReview.actual_away_score}`,
      status: savedReview.status || null,
    };
    return;
  }

  if (RECONCILE_ONLY) return;
  if (state.postReviewAt) return;
  if (NOW.getTime() < Date.parse(match.postSnapshotAtUtc)) return;

  actions.push(`post review ${match.matchId} ${match.name}`);
  if (DRY_RUN) return;
  const payload = await requestJson(`${BASE_URL}/api/post-match-review/${match.matchId}`);
  if (!isCompletedReview(payload)) {
    state.lastPostAttemptAt = NOW.toISOString();
    state.lastPostAttemptStatus = payload?.match?.status || 'not_final';
    return;
  }

  state.postReviewAt = NOW.toISOString();
  state.postReviewSummary = {
    actualScore: payload.actual?.score || (payload.match ? `${payload.match.homeScore}-${payload.match.awayScore}` : null),
    resultCorrect: payload.accuracy?.resultCorrect ?? payload.resultCorrect ?? null,
    scoreExact: payload.accuracy?.scoreExact ?? payload.scoreExact ?? null,
  };
}

async function main() {
  const schedule = readJson(SCHEDULE_FILE, null);
  if (!schedule?.matches?.length) {
    throw new Error(`No schedule found at ${SCHEDULE_FILE}. Run scripts/build-match-snapshot-schedule.js first.`);
  }

  const runs = readJson(RUNS_FILE, {
    createdAt: new Date().toISOString(),
    scheduleGeneratedAt: schedule.generatedAt,
    matches: {},
  });
  runs.updatedAt = NOW.toISOString();
  runs.baseUrl = BASE_URL;
  if (RECONCILE_ONLY) runs.reconciledAt = NOW.toISOString();

  const actions = [];
  for (const match of schedule.matches) {
    const state = jobState(runs, match.matchId);
    await runPre(match, state, actions);
    await runPost(match, state, actions);
  }

  if (!DRY_RUN) writeJson(RUNS_FILE, runs);
  console.log(actions.length ? actions.join('\n') : 'No due snapshot jobs.');
  if (RECONCILE_ONLY) console.log('Reconcile only; no API calls were made.');
  if (DRY_RUN) console.log('Dry run; state file was not written.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
