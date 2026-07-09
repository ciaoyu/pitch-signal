'use strict';

/**
 * Knockout-intel aggregation (KO batch)
 *
 * Section-registry pattern: each intel section is built in isolation (per-section
 * try/catch) so a single failing section never kills the whole card. A section
 * that returns null/throws is simply absent from the output, and the consumer
 * (card renderer / bot) skips it — per the KO batch contract
 * ("section-absent = skip; tasks can land out of order without blocking").
 *
 * Fixed card render priority (knockout-intel-plan):
 *   suspensions -> fatigue -> penalty -> referee -> superSubs -> starForm
 *   -> familiarity -> gameState -> experience -> lessons
 *
 * KO-4 registers `suspensions` here. The remaining sections are registered by
 * their respective KO tasks (B: fatigue/penalty/referee/superSubs/starForm/
 * familiarity/gameState/experience; A: lessons). Each builder receives the same
 * `ctx` object passed to buildKnockoutIntel.
 */

const { buildSuspensionsSection } = require('../suspension');
const { buildFatigueSection } = require('./fatigue-signal');
const { buildPenaltySection } = require('./penalty-section');
const { detectKnockout } = require('../knockoutStage');

// Ordered by the fixed card render priority above. Append new section builders
// here as their KO tasks land.
const SECTION_BUILDERS = [
  { key: 'suspensions', build: (ctx) => buildSuspensionsSection(ctx) },
  { key: 'fatigue',     build: (ctx) => buildFatigueSection(ctx) },       // KO-5
  { key: 'penalty',     build: (ctx) => buildPenaltySection(ctx) },       // KO-7
  // { key: 'referee',       build: (ctx) => buildRefereeSection(ctx) },       // KO-10
  // { key: 'superSubs',     build: (ctx) => buildSuperSubsSection(ctx) },     // KO-9
  // { key: 'starForm',      build: (ctx) => buildStarFormSection(ctx) },      // KO-11
  // { key: 'familiarity',   build: (ctx) => buildFamiliaritySection(ctx) },   // KO-?
  // { key: 'gameState',     build: (ctx) => buildGameStateSection(ctx) },     // KO-13
  // { key: 'experience',    build: (ctx) => buildExperienceSection(ctx) },    // KO-?
  // { key: 'lessons',       build: (ctx) => buildLessonsSection(ctx) },       // KO-6 (A)
];

function normalizeCtx(ctx = {}) {
  // Map the public buildKnockoutIntel signature onto what section builders want.
  return {
    matchId: ctx.matchId,
    homeTeamId: ctx.homeId || ctx.homeTeamId || null,
    awayTeamId: ctx.awayId || ctx.awayTeamId || null,
    homeName: ctx.homeName || null,
    awayName: ctx.awayName || null,
    stage: ctx.stage || null,
    nextRound: ctx.nextRound || ctx.stage || null,
    db: ctx.db || null,
  };
}

/**
 * Build all registered knockout-intel sections for a fixture.
 *
 * Group-stage matches are NOT knockout fixtures, so the whole `knockoutIntel`
 * object is omitted (returns null) — the card renderer hides the section and
 * the bot context stays clean, per the KO batch contract ("section-absent = skip").
 *
 * @param {object} ctx - { matchId, homeId, awayId, homeName, awayName, stage,
 *                         nextRound, db }
 * @returns {object|null} { meta:{isKnockout,round,stage}, sections } or null for
 *                        group-stage / unknown fixtures
 */
function buildKnockoutIntel(ctx = {}) {
  const params = normalizeCtx(ctx);

  // Gate on knockout: derive from the supplied stage (which KO-3's
  // getKnockoutContextForMatch already normalized to 'group'|'knockout'|round).
  const ko = detectKnockout(params.stage);
  if (!ko.isKnockout) return null;

  const sections = {};
  for (const { key, build } of SECTION_BUILDERS) {
    try {
      const sec = build(params);
      if (sec) sections[key] = sec;
    } catch (e) {
      // Section-isolated failure: skip, never kill the card.
      if (e && e.message) {
        console.error(`[knockout-intel] section "${key}" build failed: ${e.message}`);
      }
    }
  }

  return {
    meta: {
      isKnockout: true,
      round: ko.knockoutRound,
      stage: params.stage,
    },
    sections,
  };
}

module.exports = { buildKnockoutIntel, SECTION_BUILDERS, normalizeCtx };
