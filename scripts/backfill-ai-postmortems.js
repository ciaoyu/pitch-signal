/**
 * backfill-ai-postmortems.js
 *
 * 一次性脚本：把 post_match_reviews 里 status='ready_for_ai' 的存量行（结构化复盘已生成，
 * AI 文字复盘还没写）逐条喂给 LLM，写回 aiPostmortem 并把 status 改成 'completed'。
 *
 * 背景：
 *   结构化复盘（比分、赛前快照对比、factors）由 match-snapshot-scheduler 在服务器运行时
 *   自动生成，历史比赛也不例外（触发条件是纯时间戳比较 now >= postSnapshotAtUtc，不区分
 *   "刚结束"还是"历史"）。核查发现本地库里所有到期比赛(82/82)都已经有 post_match_reviews
 *   行，真正缺的是 AI 叙事这一层 —— 本地 AI_POSTMORTEM_ENABLED=false 且没配 key，生产的
 *   后台 worker（lib/jobs/ai-postmortem.js runAndSchedule）从没在这台机器上跑起来过。
 *   这个脚本做同样的事，但只跑一轮就退出，不像后台 worker 那样常驻。
 *
 *   顺带：如果 docs/MATCH_DAY_REPORTS.md 里有对应比赛的实盘复盘笔记（按主客队名双重匹配），
 *   会作为 evidence.humanNotes 注入 prompt（见 lib/postMatchReview.js getMatchDayReportNote），
 *   让 AI 复盘基于第一手实战观察，而不是只有泛泛的 ESPN 文字直播。
 *
 * 限速：
 *   严格单条 await 串行，不并发。每条调用之间 sleep --delay 毫秒（默认 1500ms）。
 *   跟生产 worker 用同一套 claudeClient + prompt，行为一致。
 *
 * 安全：
 *   - 运行前必须确认没有其他进程（本地 npm start 或生产 server）正在写同一个 predictions.db —
 *     SQLite 单实例写，并发写可能互相 SQLITE_BUSY 报错。
 *   - 失败的行不会用兜底文案顶替 —— 保持 status='ready_for_ai'，方便重跑或交给正式 worker 处理。
 *   - DB 路径完全交给 lib/db.js 的现有优先级（TEST_DB_PATH > DB_PATH > DATA_PATH > 默认
 *     data/predictions.db），运行前会打印出实际连的是哪个文件，动手前肉眼确认。
 *
 * 用法：
 *   node scripts/backfill-ai-postmortems.js [--dry-run] [--limit=N] [--delay=ms] [--match=ID]
 *
 *   --dry-run     只列出待处理的行（含是否命中实盘笔记），不调用 LLM，不写库
 *   --limit=N     最多处理 N 行（默认全部）
 *   --delay=ms    每条调用之间的暂停（默认 1500ms）
 *   --match=ID    只处理单场比赛（先跑通一条再放量）
 */

'use strict';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const limitArg = argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const delayArg = argv.find((a) => a.startsWith('--delay='));
const DELAY_MS = delayArg ? parseInt(delayArg.split('=')[1], 10) : 1500;
const matchArg = argv.find((a) => a.startsWith('--match='));
const ONLY_MATCH = matchArg ? matchArg.split('=')[1] : null;

const { db } = require('../lib/db');
const {
  AI_POSTMORTEM_INSTRUCTION,
  AI_POSTMORTEM_OUTPUT_FORMAT,
  getSavedPostMatchReview,
  savePostMatchReview,
  getMatchDayReportNote,
} = require('../lib/postMatchReview');
const claudeClient = require('../lib/claudeClient');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  log(`📦 DB_PATH env: ${process.env.DB_PATH || '(unset)'} | DATA_PATH env: ${process.env.DATA_PATH || '(unset)'}`);
  log('⚠️  运行前请确认没有其他进程正在写同一个 predictions.db（本地 npm start / 生产 server）。');

  let rows = db
    .prepare("SELECT match_id, created_at FROM post_match_reviews WHERE status='ready_for_ai' ORDER BY created_at ASC")
    .all();

  if (ONLY_MATCH) rows = rows.filter((r) => String(r.match_id) === String(ONLY_MATCH));
  if (Number.isFinite(LIMIT)) rows = rows.slice(0, LIMIT);

  if (!rows.length) {
    log('✅ 没有 status=ready_for_ai 的待处理行，退出。');
    return;
  }

  log(`📋 找到 ${rows.length} 场待生成 AI 复盘：`);
  for (const r of rows) {
    const review = getSavedPostMatchReview(String(r.match_id));
    const homeName = review?.match?.homeName || review?.match?.home?.name;
    const awayName = review?.match?.awayName || review?.match?.away?.name;
    const hasNotes = Boolean(getMatchDayReportNote(homeName, awayName));
    log(`  - match_id=${r.match_id} | ${homeName || '?'} vs ${awayName || '?'} | created_at=${r.created_at}${hasNotes ? ' | 命中实盘笔记' : ''}`);
  }

  if (DRY_RUN) {
    log('\n🔍 --dry-run 模式，不调用 LLM，不写库。');
    return;
  }

  if (!claudeClient.isConfigured()) {
    log('❌ 未配置 ANTHROPIC_API_KEY / DEEPSEEK_API_KEY，无法调用 AI，退出。');
    log('   请在 .env 设置其一后重试（参考 .env.example）。');
    process.exitCode = 1;
    return;
  }

  const done = [];
  const failed = [];

  for (const { match_id: matchId } of rows) {
    try {
      const review = getSavedPostMatchReview(String(matchId));
      if (!review) {
        failed.push({ matchId, reason: 'review row missing or unparsable JSON' });
        continue;
      }

      const homeName = review.match?.homeName || review.match?.home?.name;
      const awayName = review.match?.awayName || review.match?.away?.name;
      const humanNotes = getMatchDayReportNote(homeName, awayName);
      if (humanNotes && !review.evidence?.humanNotes) {
        review.evidence = { ...(review.evidence || {}), humanNotes };
      }

      const ctx = review.aiPromptContext?.requiredOutputFormat
        ? { ...review.aiPromptContext, evidence: review.evidence || review.aiPromptContext.evidence }
        : {
            instruction: AI_POSTMORTEM_INSTRUCTION,
            match: {
              homeName: homeName || 'Home',
              awayName: awayName || 'Away',
              homeScore: review.match?.home?.score ?? review.match?.homeScore ?? null,
              awayScore: review.match?.away?.score ?? review.match?.awayScore ?? null,
            },
            prediction: review.predictionSnapshot || review.aiPrediction || null,
            evidence: review.evidence || {},
            requiredOutputFormat: AI_POSTMORTEM_OUTPUT_FORMAT,
          };

      log(`▶️  处理 match_id=${matchId} (${homeName} vs ${awayName})${humanNotes ? ' [含实盘笔记]' : ''}...`);
      const result = await claudeClient.analyzePostMatch(ctx);

      const prev = review.aiPostmortem || {};
      review.aiPostmortem = {
        ...prev,
        status: 'completed',
        failureCategory: result.failureCategory ?? null,
        lessonsLearned: result.lessonsLearned || prev.lessonsLearned || { teamSpecific: {}, globalModel: null },
        headlineI18n: result.headlineI18n || { zh: '', en: result.headline || '' },
        whyRightI18n: result.whyRightI18n || { zh: [], en: Array.isArray(result.whyRight) ? result.whyRight : [] },
        whyWrongI18n: result.whyWrongI18n || { zh: [], en: Array.isArray(result.whyWrong) ? result.whyWrong : [] },
        processNotesI18n: result.processNotesI18n || { zh: [], en: Array.isArray(result.processNotes) ? result.processNotes : [] },
        expertCommentaryNotes: Array.isArray(result.expertCommentaryNotes) ? result.expertCommentaryNotes : [],
        provider: 'claude',
        model: claudeClient.POSTMORTEM_MODEL,
        generatedAt: new Date().toISOString(),
      };
      review.status = 'completed';
      savePostMatchReview(String(matchId), review);

      const headline = result.headlineI18n?.zh || result.headlineI18n?.en || result.headline || '';
      log(`  ✅ 完成: ${matchId} — ${result.failureCategory || 'ok'} | ${headline}`);
      done.push(matchId);
    } catch (e) {
      log(`  ❌ 失败: ${matchId} — ${e.message}`);
      failed.push({ matchId, reason: e.message });
    }

    await sleep(DELAY_MS);
  }

  log('\n🏁 完毕。');
  log(`  成功: ${done.length} 场`);
  log(`  失败: ${failed.length} 场`);
  for (const f of failed) log(`    - match_id=${f.matchId}: ${f.reason}`);

  db.close();
  log('📦 DB 连接已关闭。');
}

main().catch((err) => {
  console.error('❌ 脚本异常:', err);
  process.exit(1);
});
