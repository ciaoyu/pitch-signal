'use strict';

/**
 * Knockout-intel aggregation (KO batch)
 *
 * Section-registry pattern: each intel section is built in isolation (per-section
 * try/catch) so a single failing section never kills the whole card.
 */

const { buildSuspensionsSection } = require('../suspension');
const { db: defaultDb } = require('../db');
const crossMatchEffect = require('../crossMatchEffect');

/**
 * Section Builder: lessons (KO-6)
 * Extracts past match postmortem lessons for home and away teams.
 */
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
            fromMatchId: String(row.match_id)
          });
        }
      }

      if (awayTarget && awayLessons.length < 3) {
        const lesson = crossMatchEffect.extractTeamLesson(review, awayTarget);
        if (lesson) {
          awayLessons.push({
            zh: lesson,
            en: lesson,
            fromMatchId: String(row.match_id)
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

const SECTION_BUILDERS = [
  { key: 'suspensions', build: (ctx) => buildSuspensionsSection(ctx) },
  { key: 'lessons',     build: (ctx) => buildLessonsSection(ctx) },
];

function normalizeCtx(ctx = {}) {
  return {
    matchId: ctx.matchId,
    homeTeamId: ctx.homeTeamId || ctx.homeId || null,
    awayTeamId: ctx.awayTeamId || ctx.awayId || null,
    homeName: ctx.homeName || null,
    awayName: ctx.awayName || null,
    stage: ctx.stage || null,
    nextRound: ctx.nextRound || ctx.stage || null,
    db: ctx.db || null,
  };
}

function buildKnockoutIntel(ctx = {}) {
  const params = normalizeCtx(ctx);
  const sections = {};
  for (const { key, build } of SECTION_BUILDERS) {
    try {
      const sec = build(params);
      if (sec) sections[key] = sec;
    } catch (e) {
      if (e && e.message) {
        console.error(`[knockout-intel] section "${key}" build failed: ${e.message}`);
      }
    }
  }
  return { sections };
}

module.exports = { buildKnockoutIntel, SECTION_BUILDERS, normalizeCtx, buildLessonsSection };
