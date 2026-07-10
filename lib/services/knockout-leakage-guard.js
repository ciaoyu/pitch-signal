'use strict';

/**
 * Knockout intelligence is display-only, but it is still generated as part of
 * a pre-match prediction. Keep post-kickoff facts out of that payload so a
 * future section cannot accidentally leak a result into the pre-match card.
 */

const FORBIDDEN_KEYS = new Set([
  'actualScore',
  'finalScore',
  'finalResult',
  'actualResult',
  'postMatchReview',
  'postMatchSummary',
]);
const TIME_KEYS = ['timestamp', 'eventDate', 'dataAsOf'];

function isAfterKickoff(value, ctx = {}) {
  const kickoff = ctx.kickoffTime || ctx.matchDate || ctx.date;
  if (!kickoff || !value) return false;
  const kickoffMs = new Date(kickoff).getTime();
  const valueMs = new Date(value).getTime();
  return Number.isFinite(kickoffMs) && Number.isFinite(valueMs) && valueMs > kickoffMs;
}

function isPostMatchLeakage(data, ctx = {}, seen = new Set()) {
  if (!data || typeof data !== 'object') return false;
  if (seen.has(data)) return false;
  seen.add(data);
  if (Array.isArray(data)) return data.some((item) => isPostMatchLeakage(item, ctx, seen));

  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (TIME_KEYS.includes(key) && isAfterKickoff(value, ctx)) return true;
    if (isPostMatchLeakage(value, ctx, seen)) return true;
  }
  return false;
}

function guardSection(sectionKey, section, ctx = {}) {
  if (!section) return null;
  if (!isPostMatchLeakage(section, ctx)) return section;
  const message = `[LeakageGuard] Future/post-match leakage detected in knockoutIntel section: ${sectionKey}`;
  if (ctx.strictLeakageCheck) throw new Error(message);
  return null;
}

function guardKnockoutIntel(ctx = {}, sections = {}) {
  const cleanSections = {};
  for (const [key, section] of Object.entries(sections)) {
    const guarded = guardSection(key, section, ctx);
    if (guarded) cleanSections[key] = guarded;
  }
  return cleanSections;
}

module.exports = { isPostMatchLeakage, guardSection, guardKnockoutIntel };
