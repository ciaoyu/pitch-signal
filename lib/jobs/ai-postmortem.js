'use strict';

/**
 * T14: AI Postmortem Runner Job
 * Extracted from server.js — schedule-aware AI post-match analysis.
 *
 * Public beta default: disabled. When explicitly enabled, wakes up at each
 * match's analysisAtUtc from match_snapshot_schedule.json, then sleeps until
 * the next scheduled window. Falls back to 2h if no schedule.
 */

const fs = require('fs');
const path = require('path');
const { recordStart, recordSuccess, recordError, recordStop } = require('./registry');

const MIN_MS = 60 * 1000;           // never sleep less than 1 min
const FALLBACK_MS = 2 * 60 * 60 * 1000; // 2h when nothing is scheduled

function teamName(name, lang) {
  const value = String(name || '').trim();
  if (lang === 'zh') return value.replace(/\s+[A-Z][A-Za-z .'-]*$/, '').trim() || value;
  return value.replace(/[\u3400-\u9fff（）()·]+/g, '').trim() || value;
}

function createBilingualFallback(review, error) {
  const match = review.match || {};
  const prediction = review.predictionSnapshot || review.aiPrediction || {};
  const homeScore = Number(match.homeScore ?? match.home?.score ?? 0);
  const awayScore = Number(match.awayScore ?? match.away?.score ?? 0);
  const predictedScore = String(prediction.predictedScore || prediction.likelyScore || '--');
  const actualScore = `${homeScore}-${awayScore}`;
  const homeZh = teamName(match.homeName || match.home?.name || '主队', 'zh');
  const awayZh = teamName(match.awayName || match.away?.name || '客队', 'zh');
  const homeEn = teamName(match.homeName || match.home?.name || 'Home', 'en');
  const awayEn = teamName(match.awayName || match.away?.name || 'Away', 'en');
  const resultZh = homeScore > awayScore ? `${homeZh}取胜` : homeScore < awayScore ? `${awayZh}取胜` : '双方战平';
  const resultEn = homeScore > awayScore ? `${homeEn} won` : homeScore < awayScore ? `${awayEn} won` : 'the match ended level';
  const exact = predictedScore === actualScore;
  const commentaryCount = review.evidence?.commentary?.length || 0;
  const eventCount = review.evidence?.events?.length || 0;

  return {
    status: 'completed',
    failureCategory: exact ? null : 'scoreline_variance',
    lessonsLearned: {
      teamSpecific: {},
      globalModel: exact
        ? { zh: '本场比分校准准确。', en: 'The scoreline calibration was accurate for this match.' }
        : { zh: '保留赛果方向信号，同时重新校准具体比分的置信度。', en: 'Recalibrate scoreline confidence while preserving the directional result signal.' },
    },
    headlineI18n: {
      zh: `${homeZh} ${homeScore}:${awayScore} ${awayZh}：${resultZh}`,
      en: `${homeEn} ${homeScore}-${awayScore} ${awayEn}: ${resultEn}`,
    },
    whyRightI18n: {
      zh: [`终场结果为${actualScore}，赛前模型预测比分为${predictedScore}。`],
      en: [`The final score was ${actualScore}; the pre-match model projected ${predictedScore}.`],
    },
    whyWrongI18n: exact ? { zh: [], en: [] } : {
      zh: ['模型对具体进球数的判断存在偏差，比分置信度需要降低。'],
      en: ['The model missed the exact goal totals, so scoreline confidence should be reduced.'],
    },
    processNotesI18n: {
      zh: [`本复盘依据终场比分、赛前预测及${eventCount}条事件、${commentaryCount}条文字直播生成。`],
      en: [`This review uses the final score, the pre-match snapshot, ${eventCount} events and ${commentaryCount} commentary entries.`],
    },
    expertCommentaryNotes: [],
    provider: 'deterministic-fallback',
    model: null,
    providerError: String(error?.message || 'AI provider unavailable').slice(0, 240),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create the AI postmortem runner job
 * @param {Object} deps - Dependencies
 * @param {string} deps.dataDir - Data directory path
 * @returns {Object} Job with start/stop methods
 */
function createAiPostmortemJob(deps) {
  let timer = null;
  let started = false;

  function nextAnalysisDelay(dataDir) {
    const scheduleFile = path.join(dataDir, 'match_snapshot_schedule.json');
    try {
      const { db } = require('../db');
      const sched = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
      const now = Date.now();
      // Get match_ids already completed so we skip them
      const doneIds = new Set(
        db.prepare("SELECT match_id FROM post_match_reviews WHERE status='completed'")
          .all().map(r => String(r.match_id))
      );
      const future = sched.matches
        .filter(m => !doneIds.has(String(m.matchId)))
        .map(m => Date.parse(m.analysisAtUtc))
        .filter(t => Number.isFinite(t) && t > now)
        .sort((a, b) => a - b)[0];
      if (!future) return FALLBACK_MS;
      const delta = future - now;
      const label = delta < 60000
        ? `${Math.round(delta / 1000)}s`
        : delta < 3600000
          ? `${Math.round(delta / 60000)}min`
          : `${(delta / 3600000).toFixed(1)}h`;
      console.log(`🤖 AI postmortem: next wake-up in ${label} (${new Date(future).toISOString()})`);
      return Math.max(MIN_MS, delta);
    } catch {
      return FALLBACK_MS;
    }
  }

  async function runAndSchedule(dataDir) {
    recordStart('ai-postmortem');
    const { db } = require('../db');
    const claudeClient = require('../claudeClient');
    const {
      AI_POSTMORTEM_INSTRUCTION,
      AI_POSTMORTEM_OUTPUT_FORMAT,
      getSavedPostMatchReview,
      savePostMatchReview,
      normalizeLessonsLearned,
    } = require('../postMatchReview');

    try {
      const rows = db.prepare(
        "SELECT match_id FROM post_match_reviews WHERE status='ready_for_ai' ORDER BY created_at ASC LIMIT 100"
      ).all();
      if (rows.length) {
        console.log(`🤖 AI postmortem: ${rows.length} matches pending`);
        for (const { match_id: matchId } of rows) {
          try {
            const review = getSavedPostMatchReview(String(matchId));
            if (!review) continue;
            const ctx = review.aiPromptContext?.requiredOutputFormat
              ? review.aiPromptContext
              : {
                  instruction: AI_POSTMORTEM_INSTRUCTION,
                  match: {
                    homeName: review.match?.homeName || 'Home',
                    awayName: review.match?.awayName || 'Away',
                    homeScore: review.match?.home?.score ?? null,
                    awayScore: review.match?.away?.score ?? null,
                  },
                  prediction: review.predictionSnapshot || review.aiPrediction || null,
                  evidence: review.evidence || {},
                  requiredOutputFormat: AI_POSTMORTEM_OUTPUT_FORMAT,
                };
            if (!claudeClient.isConfigured()) throw new Error('AI provider is not configured');
            const result = await claudeClient.analyzePostMatch(ctx);
            const prev = review.aiPostmortem || {};
            review.aiPostmortem = {
              ...prev,
              status: 'completed',
              failureCategory: result.failureCategory ?? null,
              lessonsLearned: normalizeLessonsLearned(result.lessonsLearned, prev.lessonsLearned),
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
            const logHeadline = result.headlineI18n?.zh || result.headlineI18n?.en || result.headline || '';
            console.log(`🤖 AI postmortem done: ${matchId} — ${result.failureCategory || 'ok'} | ${logHeadline}`);
          } catch (e) {
            console.error(`🤖 AI postmortem failed for ${matchId}: ${e.message}`);
            const review = getSavedPostMatchReview(String(matchId));
            if (review) {
              review.aiPostmortem = {
                ...(review.aiPostmortem || {}),
                ...createBilingualFallback(review, e),
              };
              review.status = 'completed';
              savePostMatchReview(String(matchId), review);
              console.log(`🤖 AI postmortem fallback done: ${matchId}`);
            }
          }
        }
      }
      recordSuccess('ai-postmortem');
    } catch (err) {
      recordError('ai-postmortem', err);
    }
    if (started) {
      timer = setTimeout(() => runAndSchedule(dataDir), nextAnalysisDelay(dataDir));
      timer.unref();
    }
  }

  return {
    start() {
      if (process.env.AI_POSTMORTEM_ENABLED !== 'true') {
        console.log('✅ [GATE-4 AI Post-match Review Background Generation] AI_POSTMORTEM_ENABLED=false confirmed');
        return false;
      }

      try {
        started = true;
        const { dataDir } = deps;
        // Run once at startup (clears backlog), then self-schedules
        runAndSchedule(dataDir);
        console.log('🤖 AI postmortem runner started (schedule-aware)');
        return true;
      } catch (e) {
        console.log('AI postmortem runner unavailable:', e.message);
        return false;
      }
    },

    stop() {
      started = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      recordStop('ai-postmortem');
    },
  };
}

module.exports = { createAiPostmortemJob };
