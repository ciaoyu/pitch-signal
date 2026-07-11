#!/usr/bin/env node
'use strict';

/**
  * Keystone worker — consumes post-match reviews in post_match_reviews with status='ready_for_ai',
  * calls Claude to generate 7-category attribution + two-tier lessons (teamSpecific / globalModel), writes back and marks as 'completed'.
 *
  * This is the launcher for the post-match review data pipeline: once reviews are filled, offline analysis modules like teamContext / crossMatchEffect
  * can read real lessons. (dailyCalibration is not wired in during the public beta; see AUTO_CALIBRATION gate)
 *
  * Usage:
  *   node scripts/generate-ai-postmortem.js              # process all backlog
  *   node scripts/generate-ai-postmortem.js --limit 5    # process only the first 5 matches
 *   node scripts/generate-ai-postmortem.js --match 760443
  *   node scripts/generate-ai-postmortem.js --dry-run    # only list pending, do not call Claude
 */

const { loadEnv } = require('../lib/env');
loadEnv();

const { db } = require('../lib/db');
const claudeClient = require('../lib/claudeClient');
const {
  AI_POSTMORTEM_INSTRUCTION,
  normalizeLessonsLearned,
  AI_POSTMORTEM_OUTPUT_FORMAT,
  getSavedPostMatchReview,
  savePostMatchReview,
} = require('../lib/postMatchReview');

function parseArgs(argv) {
  const args = { limit: null, match: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--match') args.match = String(argv[++i]);
  }
  return args;
}

/** List pending match_ids (status='ready_for_ai') */
function listPending(args) {
  let rows;
  if (args.match) {
    rows = db
      .prepare("SELECT match_id FROM post_match_reviews WHERE match_id = ? AND status = 'ready_for_ai'")
      .all(args.match);
  } else {
    rows = db
      .prepare("SELECT match_id FROM post_match_reviews WHERE status = 'ready_for_ai' ORDER BY created_at ASC")
      .all();
  }
  let ids = rows.map((r) => String(r.match_id));
  if (Number.isInteger(args.limit) && args.limit > 0) ids = ids.slice(0, args.limit);
  return ids;
}

/**
  * Obtain (or, if missing, synthesize) the aiPromptContext to feed Claude.
  * Old records (pre-schema) lack aiPromptContext; rebuild using constants + existing fields.
 */
function resolvePromptContext(review) {
  const ctx = review.aiPromptContext;
  if (ctx && ctx.requiredOutputFormat) return ctx;

  const m = review.match || {};
  const predictionSnapshot = review.predictionSnapshot || review.aiPrediction || null;
  // Annotate predictionSource onto the prediction object so the AI knows if it's retrospective
  if (predictionSnapshot && review.predictionSource === 'retrospective') {
    predictionSnapshot.predictionSource = 'retrospective';
    predictionSnapshot._source = 'retrospective';
  }
  return {
    instruction: AI_POSTMORTEM_INSTRUCTION,
    match: {
      homeName: m.homeName || m.home?.name || review.predictionSnapshot?.homeTeamName || 'Home',
      awayName: m.awayName || m.away?.name || review.predictionSnapshot?.awayTeamName || 'Away',
      homeScore: m.homeScore ?? m.home?.score ?? null,
      awayScore: m.awayScore ?? m.away?.score ?? null,
    },
    prediction: predictionSnapshot,
    evidence: review.evidence || {},
    requiredOutputFormat: AI_POSTMORTEM_OUTPUT_FORMAT,
  };
}

/** Merge the attribution returned by Claude into review.aiPostmortem and mark the whole review as completed. */
function applyResult(review, result) {
  const prev = review.aiPostmortem || {};
  review.aiPostmortem = {
    ...prev,
    status: 'completed',
    failureCategory: result.failureCategory ?? null,
    lessonsLearned: normalizeLessonsLearned(result.lessonsLearned, prev.lessonsLearned),
    headline: result.headline || '',
    whyRight: Array.isArray(result.whyRight) ? result.whyRight : [],
    whyWrong: Array.isArray(result.whyWrong) ? result.whyWrong : [],
    processNotes: Array.isArray(result.processNotes) ? result.processNotes : [],
    expertCommentaryNotes: Array.isArray(result.expertCommentaryNotes) ? result.expertCommentaryNotes : [],
    provider: 'claude',
    model: claudeClient.POSTMORTEM_MODEL,
    generatedAt: new Date().toISOString(),
  };
  review.status = 'completed';
  return review;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pending = listPending(args);

  console.log(`⚽ AI Postmortem Worker — ${pending.length} matches pending (status='ready_for_ai')`);
  if (pending.length === 0) {
    console.log('No postmortems pending.');
    return;
  }

  if (args.dryRun) {
    console.log('[dry-run] pending match_id:', pending.join(', '));
    return;
  }

  if (!claudeClient.isConfigured()) {
    console.error('❌ ANTHROPIC_API_KEY not set. Add it to .env and retry, or use --dry-run to preview.');
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const matchId = pending[i];
    const tag = `[${i + 1}/${pending.length}] match ${matchId}`;
    try {
      const review = getSavedPostMatchReview(matchId);
      if (!review) {
        console.warn(`${tag} — skip: cannot read review_json`);
        failed++;
        continue;
      }
      const ctx = resolvePromptContext(review);
      const result = await claudeClient.analyzePostMatch(ctx);
      applyResult(review, result);
      savePostMatchReview(matchId, review);
      const cat = review.aiPostmortem.failureCategory || 'correct/none';
      console.log(`${tag} — ✅ ${cat} | ${review.aiPostmortem.headline || ''}`);
      ok++;
    } catch (e) {
      console.error(`${tag} — ❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: succeeded ${ok} matches, failed ${failed} matches.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Worker fatal error:', e);
  process.exitCode = 1;
});
