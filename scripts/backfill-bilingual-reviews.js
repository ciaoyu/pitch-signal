/**
 * backfill-bilingual-reviews.js
 *
 * 一次性脚本：把存量纯英文（v1）赛后复盘批量重生为中英双语。
 *
 * 背景：
 *   schema 和 worker 现在已产双语，但 data/predictions.db 的 post_match_reviews
 *   里旧行是 v1 英文、永远不会被重排，所以不会自动刷新。
 *
 * 做法：
 *   遍历 status='completed' 的复盘行，逐个取出 → 把 review.status 设为 'ready_for_ai'、
 *   注入最新 aiPromptContext（instruction + requiredOutputFormat）→ savePostMatchReview
 *   写回，让后台 worker（server.js runAndSchedule）用 DeepSeek 逐批复生成。
 *
 * 成本与限速：
 *   N 行 = N 次 DeepSeek 调用。后台 worker 每轮 LIMIT 10 + nextAnalysisDelay 间隔
 *   （最少 1 min，闲时 2 h），天然限速。建议先 dry-run 确认数据量再实跑。
 *
 * 用法：
 *   node scripts/backfill-bilingual-reviews.js [--dry-run] [--batch=N]
 *
 *   --dry-run    仅查看有哪些存量行，不做写操作
 *   --batch=N    每批最多标记 N 行（默认 10），标记完一批后暂停 2 秒再做下一批
 *   --all        一次性标记全部（默认分批，防止一次性全排）
 */

'use strict';

const path = require('path');

// ── 参数解析 ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN  = argv.includes('--dry-run');
const ALL_AT_ONCE = argv.includes('--all');

let BATCH_SIZE = 10;
const batchArg = argv.find(a => a.startsWith('--batch='));
if (batchArg) {
  const v = parseInt(batchArg.split('=')[1], 10);
  if (v > 0 && v <= 50) BATCH_SIZE = v;
}

// ── DB 连接 ────────────────────────────────────────────────────────────
const { db } = require('../lib/db');
const {
  AI_POSTMORTEM_INSTRUCTION,
  AI_POSTMORTEM_OUTPUT_FORMAT,
  getSavedPostMatchReview,
  savePostMatchReview,
} = require('../lib/postMatchReview');

// ── 工具 ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── 主逻辑 ─────────────────────────────────────────────────────────────
async function main() {
  log('🔍 开始扫描存量 completed 复盘行...');

  // 1. 查出所有 status='completed' 的行
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

  // 2. 过滤：跳过已经有双语 prompt 的行（可能已经被重排过）
  const toProcess = [];
  for (const row of rows) {
    const review = getSavedPostMatchReview(row.match_id);
    if (!review) {
      log(`  ⚠️ 跳过 match_id=${row.match_id}：review JSON 解析失败`);
      continue;
    }
    // 检查是否已经是双语 prompt（requiredOutputFormat 里有 headlineI18n）
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

  // 3. 分流：一次性 vs 分批
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
    // 分批标记，中间暂停让 worker 消费
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

  // 4. 关闭连接
  db.close();
  log('📦 DB 连接已关闭。');
}

main().catch(err => {
  console.error('❌ 脚本异常:', err);
  process.exit(1);
});
