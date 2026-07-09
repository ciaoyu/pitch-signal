/**
 * backfill-bilingual-reviews.js
 *
  * One-shot script: batch-rebirth existing English-only (v1) post-match reviews into bilingual (zh+en).
 *
  * Background:
  *   The schema and worker now produce bilingual output, but the post_match_reviews in data/predictions.db
  *   still hold old v1 English rows that are never re-queued, so they won't refresh automatically.
 *
  * Approach:
  *   Iterate over review rows with status='completed', take them one by one → set review.status to 'ready_for_ai',
  *   inject the latest aiPromptContext (instruction + requiredOutputFormat) → savePostMatchReview
  *   write back, so the background worker (server.js runAndSchedule) regenerates them in batches with DeepSeek.
 *
  * Cost and rate limiting:
  *   N rows = N DeepSeek calls. The background worker uses LIMIT 10 per round + a nextAnalysisDelay interval
  *   (at least 1 min, 2 h when idle), which is natural rate limiting. Suggest a dry-run first to confirm data volume before the real run.
 *
  * Usage:
 *   node scripts/backfill-bilingual-reviews.js [--dry-run] [--batch=N]
 *
  *   --dry-run    only preview which existing rows exist; no writes
  *   --batch=N    mark at most N rows per batch (default 10); pause 2s after each batch before the next
  *   --all       mark all at once (default is batched, to avoid queuing everything in one go)
 */

'use strict';

const path = require('path');

// ── argument parsing ───────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN  = argv.includes('--dry-run');
const ALL_AT_ONCE = argv.includes('--all');

let BATCH_SIZE = 10;
const batchArg = argv.find(a => a.startsWith('--batch='));
if (batchArg) {
  const v = parseInt(batchArg.split('=')[1], 10);
  if (v > 0 && v <= 50) BATCH_SIZE = v;
}

// ── DB connection ──────────────────────────────────────────────────────────
const { db } = require('../lib/db');
const {
  AI_POSTMORTEM_INSTRUCTION,
  AI_POSTMORTEM_OUTPUT_FORMAT,
  getSavedPostMatchReview,
  savePostMatchReview,
} = require('../lib/postMatchReview');

// ── utilities ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── main logic ─────────────────────────────────────────────────────────────
async function main() {
  log('🔍 开始扫描存量 completed 复盘行...');

    // 1. query all rows with status='completed'
  const rows = db.prepare(
    "SELECT id, match_id, review_json, status, created_at FROM post_match_reviews WHERE status='completed' ORDER BY created_at ASC"
  ).all();

  if (!rows.length) {
    log('✅ 没有需要处理的存量 completed 行，退出。');
    return;
  }

  log(`📋 找到 ${rows.length} 条 status='completed' 的复盘行：`);
  rows.forEach((r, i) => {
    let review;
    try { review = JSON.parse(r.review_json); } catch { review = null; }
    const hasI18n = review?.aiPromptContext?.requiredOutputFormat?.headlineI18n != null;
    const label = review?.match
      ? `${review.match.homeName || '?'} ${review.match.homeScore}-${review.match.awayScore} ${review.match.awayName || '?'}`
      : r.match_id;
    log(`  ${i+1}. match_id=${r.match_id} | ${label} | 已有双语=${hasI18n ? 'YES' : 'NO'}`);
  });

    // 2. filter: skip rows that already have a bilingual prompt (may have been re-queued already)
  const toProcess = [];
  for (const row of rows) {
    const review = getSavedPostMatchReview(row.match_id);
    if (!review) {
      log(`  ⚠️ 跳过 match_id=${row.match_id}：review JSON 解析失败`);
      continue;
    }
        // check whether it already has a bilingual prompt (requiredOutputFormat contains headlineI18n)
    const fmt = review.aiPromptContext?.requiredOutputFormat || {};
    if (fmt.headlineI18n !== undefined) {
      log(`  ⏭️ 跳过 match_id=${row.match_id}：已有双语输出格式（可能已刷新）`);
      continue;
    }
    toProcess.push({ match_id: row.match_id, review });
  }

  log(`\n🎯 实际需处理 ${toProcess.length} 行（已排除 ${rows.length - toProcess.length} 行已双语/解析失败）`);

  if (DRY_RUN) {
    log('\n🔍 --dry-run 模式，不做任何写入。要实跑请去掉 --dry-run。');
    log(`预计产生 ${toProcess.length} 次 DeepSeek 重生成请求。`);
    return;
  }

  if (!toProcess.length) {
    log('✅ 没有需要处理的存量行，退出。');
    return;
  }

    // 3. branching: all-at-once vs batched
  if (ALL_AT_ONCE) {
    log('\n🚀 一次性标记全部（后台 worker LIMIT 10 + 间隔延迟会自动限速）');
    for (const { match_id, review } of toProcess) {
      review.status = 'ready_for_ai';
      review.aiPromptContext = review.aiPromptContext || {};
      review.aiPromptContext.instruction = AI_POSTMORTEM_INSTRUCTION;
      review.aiPromptContext.requiredOutputFormat = AI_POSTMORTEM_OUTPUT_FORMAT;
      savePostMatchReview(match_id, review);
      log(`  ✅ 已标记 ready_for_ai: ${match_id}`);
    }
    log(`\n🏁 完毕。共标记 ${toProcess.length} 行，后台 worker 将逐批取出 LIMIT 10 处理。`);
  } else {
        // mark in batches, pausing in between to let the worker consume
    log(`\n🚀 分批标记，每批 ${BATCH_SIZE} 行，批次间暂停 2 秒...`);
    let totalMarked = 0;
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

      log(`\n📦 第 ${batchNum}/${totalBatches} 批 (${batch.length} 行)...`);
      for (const { match_id, review } of batch) {
        review.status = 'ready_for_ai';
        review.aiPromptContext = review.aiPromptContext || {};
        review.aiPromptContext.instruction = AI_POSTMORTEM_INSTRUCTION;
        review.aiPromptContext.requiredOutputFormat = AI_POSTMORTEM_OUTPUT_FORMAT;
        savePostMatchReview(match_id, review);
        log(`  ✅ 已标记 ready_for_ai: ${match_id}`);
        totalMarked++;
      }

      if (i + BATCH_SIZE < toProcess.length) {
        log(`  ⏳ 暂停 2 秒（让 worker 有时间消费前一批）...`);
        await sleep(2000);
      }
    }
    log(`\n🏁 完毕。共标记 ${totalMarked} 行，后台 worker 将逐批取出 LIMIT 10 处理。`);
  }

    // 4. close connection
  db.close();
  log('📦 DB 连接已关闭。');
}

main().catch(err => {
  console.error('❌ script error:', err);
  process.exit(1);
});
