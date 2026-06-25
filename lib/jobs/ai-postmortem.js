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

const MIN_MS = 60 * 1000;           // never sleep less than 1 min
const FALLBACK_MS = 2 * 60 * 60 * 1000; // 2h when nothing is scheduled

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
      console.log(`🤖 AI postmortem: 下次唤醒在 ${label} 后 (${new Date(future).toISOString()})`);
      return Math.max(MIN_MS, delta);
    } catch {
      return FALLBACK_MS;
    }
  }

  async function runAndSchedule(dataDir) {
    const { db } = require('../db');
    const claudeClient = require('../claudeClient');
    const {
      AI_POSTMORTEM_INSTRUCTION,
      AI_POSTMORTEM_OUTPUT_FORMAT,
      getSavedPostMatchReview,
      savePostMatchReview,
    } = require('../postMatchReview');

    if (claudeClient.isConfigured()) {
      const rows = db.prepare(
        "SELECT match_id FROM post_match_reviews WHERE status='ready_for_ai' ORDER BY created_at ASC LIMIT 10"
      ).all();
      if (rows.length) {
        console.log(`🤖 AI postmortem: ${rows.length} 场待处理`);
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
            const logHeadline = result.headlineI18n?.zh || result.headlineI18n?.en || result.headline || '';
            console.log(`🤖 AI postmortem done: ${matchId} — ${result.failureCategory || 'ok'} | ${logHeadline}`);
          } catch (e) {
            console.error(`🤖 AI postmortem failed for ${matchId}: ${e.message}`);
          }
        }
      }
    }
    if (started) {
      timer = setTimeout(() => runAndSchedule(dataDir), nextAnalysisDelay(dataDir));
      timer.unref();
    }
  }

  return {
    start() {
      if (process.env.AI_POSTMORTEM_ENABLED !== 'true') {
        console.log('✅ [GATE-4 AI 赛后复盘后台生成] AI_POSTMORTEM_ENABLED=false 已确认');
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
    },
  };
}

module.exports = { createAiPostmortemJob };
