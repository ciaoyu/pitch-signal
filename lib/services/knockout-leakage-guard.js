'use strict';

/**
 * Knockout Intelligence Leakage Guard (KO-15)
 *
 * Prevents future or post-match data leakage into pre-match knockout intelligence sections.
 * Intercepts buildKnockoutIntel and filters/rejects sections containing post-kickoff data.
 */

function isPostMatchLeakage(data, ctx = {}) {
  if (!data || typeof data !== 'object') return false;

  // Check for explicit post-match result attributes inside a pre-match intel section
  const forbiddenKeys = ['actualScore', 'postMatchReview', 'finalResult', 'postMatchSummary'];
  for (const key of forbiddenKeys) {
    if (data[key] !== undefined) {
      return true;
    }
  }

  // Check timestamp ordering if both section eventDate/timestamp and ctx matchDate/kickoffTime are present
  const kickoffStr = ctx.kickoffTime || ctx.matchDate || ctx.date;
  if (kickoffStr) {
    const kickoffTs = new Date(kickoffStr).getTime();
    if (!isNaN(kickoffTs)) {
      const secTimeStr = data.timestamp || data.eventDate || data.dataAsOf;
      if (secTimeStr) {
        const secTs = new Date(secTimeStr).getTime();
        if (!isNaN(secTs) && secTs > kickoffTs) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Validates a single section against future/post-match data leakage
 * @param {string} sectionKey
 * @param {object} sec
 * @param {object} ctx
 * @returns {object|null} sanitized section or null if rejected
 */
function guardSection(sectionKey, sec, ctx = {}) {
  if (!sec) return null;

  if (isPostMatchLeakage(sec, ctx)) {
    if (ctx.strictLeakageCheck) {
      throw new Error(`[LeakageGuard] Future/post-match leakage detected in knockoutIntel section: ${sectionKey}`);
    }
    return null;
  }

  return sec;
}

/**
 * Validates all built knockout intel sections
 * @param {object} ctx
 * @param {object} sections
 * @returns {object} sanitized sections map
 */
function guardKnockoutIntel(ctx = {}, sections = {}) {
  const cleanSections = {};
  for (const [key, sec] of Object.entries(sections)) {
    const guarded = guardSection(key, sec, ctx);
    if (guarded) {
      cleanSections[key] = guarded;
    }
  }
  return cleanSections;
}

module.exports = {
  isPostMatchLeakage,
  guardSection,
  guardKnockoutIntel,
};
