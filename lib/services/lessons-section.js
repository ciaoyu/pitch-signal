'use strict';

/**
 * Lessons section builder (KO-6)
 *
 * Extracts past-match postmortem lessons for the home and away teams from the
 * `post_match_reviews` table, capping each side at <=3 lessons to control bot
 * prompt token growth. Downgrades to null (section absent) when neither team
 * has any lesson - per the KO batch contract ("section-absent = skip").
 *
 * Display + bot only (usedInModel: false). Never touches the prediction engine.
 */

const { db: defaultDb } = require('../db');
const crossMatchEffect = require('../crossMatchEffect');

function buildLessonsSection(ctx = {}) {
  try {
    const homeTarget = ctx.homeTeamId || ctx.homeName;
    const awayTarget = ctx.awayTeamId || ctx.awayName;
    if (!homeTarget && !awayTarget) return null;

    const db = ctx.db || defaultDb;

    let rows = [];
    try {
      if (ctx.matchId) {
        rows = db.prepare('SELECT match_id, review_json FROM post_match_reviews WHERE match_id != ? ORDER BY id DESC').all(String(ctx.matchId));
      } else {
        rows = db.prepare('SELECT match_id, review_json FROM post_match_reviews ORDER BY id DESC').all();
      }
    } catch (_) {
      return null;
    }

    const homeLessons = [];
    const awayLessons = [];

    for (const row of rows) {
      if (!row || !row.review_json) continue;
      let review = null;
      try {
        review = JSON.parse(row.review_json);
      } catch (_) {
        continue;
      }

      if (homeTarget && homeLessons.length < 3) {
        const lesson = crossMatchEffect.extractTeamLesson(review, homeTarget);
        if (lesson) {
          homeLessons.push({
            zh: lesson,
            en: lesson,
            fromMatchId: String(row.match_id),
          });
        }
      }

      if (awayTarget && awayLessons.length < 3) {
        const lesson = crossMatchEffect.extractTeamLesson(review, awayTarget);
        if (lesson) {
          awayLessons.push({
            zh: lesson,
            en: lesson,
            fromMatchId: String(row.match_id),
          });
        }
      }

      if (homeLessons.length >= 3 && awayLessons.length >= 3) break;
    }

    if (homeLessons.length === 0 && awayLessons.length === 0) {
      return null;
    }

    return {
      confidence: 'low',
      source: 'ai-postmortem',
      usedInModel: false,
      home: homeLessons,
      away: awayLessons,
    };
  } catch (_) {
    return null;
  }
}

module.exports = { buildLessonsSection };
