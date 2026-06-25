#!/usr/bin/env node
'use strict';

/**
 * 拱心石 worker — 消费 post_match_reviews 中 status='ready_for_ai' 的赛后复盘,
 * 调 Claude 生成 7 分类归因 + 双层教训(teamSpecific / globalModel),写回并置为 'completed'。
 *
 * 这是赛后复盘数据管线的启动器:复盘填充后,teamContext / crossMatchEffect 等
 * 离线分析模块才能读到真实教训。(dailyCalibration 在公测期未接入,见 AUTO_CALIBRATION 闸门)
 *
 * 用法:
 *   node scripts/generate-ai-postmortem.js              # 处理全部积压
 *   node scripts/generate-ai-postmortem.js --limit 5    # 只处理前 5 场
 *   node scripts/generate-ai-postmortem.js --match 760443
 *   node scripts/generate-ai-postmortem.js --dry-run    # 只列出待处理,不调用 Claude
 */

const { loadEnv } = require('../lib/env');
loadEnv();

const { db } = require('../lib/db');
const claudeClient = require('../lib/claudeClient');
const {
  AI_POSTMORTEM_INSTRUCTION,
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

/** 列出待处理的 match_id(status='ready_for_ai') */
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
 * 取得(或在缺失时合成)可喂给 Claude 的 aiPromptContext。
 * 老记录(早于 schema)缺 aiPromptContext,用常量 + 已有字段重建。
 */
function resolvePromptContext(review) {
  const ctx = review.aiPromptContext;
  if (ctx && ctx.requiredOutputFormat) return ctx;

  const m = review.match || {};
  const predictionSnapshot = review.predictionSnapshot || review.aiPrediction || null;
  // 将 predictionSource 标注到 prediction 对象上，让 AI 知道是否为 retrospective
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

/** 把 Claude 返回的归因合并进 review.aiPostmortem,并把整条复盘置为 completed。 */
function applyResult(review, result) {
  const prev = review.aiPostmortem || {};
  review.aiPostmortem = {
    ...prev,
    status: 'completed',
    failureCategory: result.failureCategory ?? null,
    lessonsLearned: result.lessonsLearned || prev.lessonsLearned || { teamSpecific: {}, globalModel: null },
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

  console.log(`⚽ AI Postmortem Worker — ${pending.length} 场待处理 (status='ready_for_ai')`);
  if (pending.length === 0) {
    console.log('没有待处理的复盘。');
    return;
  }

  if (args.dryRun) {
    console.log('[dry-run] 待处理 match_id:', pending.join(', '));
    return;
  }

  if (!claudeClient.isConfigured()) {
    console.error('❌ ANTHROPIC_API_KEY 未设置。在 .env 填入后重试,或用 --dry-run 预览。');
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
        console.warn(`${tag} — 跳过:无法读取 review_json`);
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

  console.log(`\n完成:成功 ${ok} 场,失败 ${failed} 场。`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Worker 致命错误:', e);
  process.exitCode = 1;
});
