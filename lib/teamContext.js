'use strict';

const { db } = require('./db');
const crossMatchEffect = require('./crossMatchEffect');
const { extractTeamLesson, teamIdAliasSet } = crossMatchEffect;

/**
 * Team Context Manager — RAG-style team-specific context
 *
 * Retrieves "last 5 matches" historical lessons for the specified team from post-match reviews (post_match_reviews) for injection into predictions.
 *
 * Design principles:
 * - No fabrication: return empty array when no data is available.
 * - "Returning empty is correct": when all reviews are still in ready_for_ai (not yet completed),
 *   pastLessons is legitimately empty. Data will be available once worker populates lessonsLearned.
 * - ID normalization and lesson extraction reuse crossMatchEffect.{extractTeamLesson, teamIdAliasSet},
 *   providing a single source of truth to avoid drift across cross-match modules.
 */
class TeamContextManager {
  constructor() {
    // P2-5: teamId → { items: string[], updatedAt: ISO }
    this._newsCache = new Map();
    this._newsMaxAgeMs = 30 * 60 * 1000; // 30-minute freshness
  }

  /**
   * @param {string} teamId - Any identifier (ratings_id / espn_id / name)
   * @returns {Promise<{teamId:string, pastLessons:string[], latestNews:string[], compiledPrompt:string}>}
   */
  async getContext(teamId) {
    const pastLessons = this._getRecentTeamLessons(teamId);
    const latestNews = this._getLatestNews(teamId);

    return {
      teamId,
      pastLessons,
      latestNews,
      compiledPrompt: this._compilePrompt(teamId, pastLessons, latestNews),
    };
  }

  /**
   * Retrieve teamSpecific lessons from "last 5 matches" completed reviews for the team.
   *
   * Track D fix: previously grabbed "global last 5 completed reviews" — any 5 reviews of strong teams
   * would squeeze out this team's own history. Now queries review.match.home/away.id to verify participation before sorting and taking top 5.
   *
   * Implementation: scan all completed reviews, filter by teamId normalized alias set, order by created_at DESC and take top 5.
   * Data volume is ~64 matches; O(n) in-memory filtering is fast enough and avoids writing complex JSON lookups in SQL.
   */
  _getRecentTeamLessons(teamId) {
    if (!teamId) return [];
    const aliases = teamIdAliasSet(teamId);
    if (aliases.size === 0) return [];

    const rows = db.prepare(`
      SELECT review_json
      FROM post_match_reviews
      WHERE status = 'completed'
      ORDER BY created_at DESC
    `).all();

    const lessons = [];
    const seen = new Set();
    for (const row of rows) {
      const review = safeJsonParse(row.review_json);
      if (!review) continue;
      const homeId = String(review.match?.home?.id ?? '');
      const awayId = String(review.match?.away?.id ?? '');
      // Only examine matches where this team participated
      if (!aliases.has(homeId) && !aliases.has(awayId)) continue;

      const lesson = extractTeamLesson(review, teamId);
      if (lesson && !seen.has(lesson)) {
        seen.add(lesson);
        lessons.push(lesson);
        if (lessons.length >= 5) break;
      }
    }
    return lessons;
  }

  /**
   * Latest news / injury / squad updates.
   *
   * Source: written to cache by news.js route (Tavily/ESPN mock);
   * PredictiveContextService fetches news and injects before prediction execution.
   *
   * @param {string} teamId — ID normalized via autoId in getContext()
   * @returns {string[]}
   */
  _getLatestNews(teamId) {
    if (!teamId) return [];
    // Direct ID match — cache hit
    const direct = this._newsCache.get(teamId);
    if (direct && Date.now() - new Date(direct.updatedAt).getTime() < this._newsMaxAgeMs) {
      return direct.items;
    }
    // Iterate all cached alias resolutions (espn_id -> normalized) — if prediction uses ratings_id but cache keyed by espn_id, bridge via aliases.
    for (const [cachedTeamId, entry] of this._newsCache) {
      if (Date.now() - new Date(entry.updatedAt).getTime() >= this._newsMaxAgeMs) continue;
      const aliases = teamIdAliasSet(cachedTeamId);
      if (aliases.has(teamId)) return entry.items;
    }
    return [];
  }

  /**
   * P2-5: Write team news to in-memory cache for _getLatestNews retrieval.
   *
   * Caller: requestTeamNews() called in PredictiveContextService.assembleTeamContext()
   * after actively fetching ESPN/Tavily news; also allows news.js route to push into cache directly.
   *
   * @param {string} teamId — Any identifier (espn_id/ratings_id/name, caller normalizes if needed)
   * @param {string[]} items — headline snippets, keep up to 8 items (most relevant first)
   * @returns {number} Current entry count in cache (for verification, not functionally required)
   */
  updateTeamNews(teamId, items) {
    if (!teamId || !Array.isArray(items)) return 0;
    const normalId = String(teamId);
    this._newsCache.set(normalId, {
      items: items.slice(0, 8),
      updatedAt: new Date().toISOString(),
    });
    return this._newsCache.get(normalId).items.length;
  }

  /**
   * Assemble prompt text block for prediction injection.
   * Explicitly annotate empty data as status note instead of fabricating fake data.
   */
  _compilePrompt(teamId, pastLessons, latestNews) {
    const lessonLines = pastLessons.length > 0
      ? pastLessons.map(l => '- ' + l).join('\n')
      : '(none yet — no completed post-match reviews for this team)';
    const newsLines = latestNews.length > 0
      ? latestNews.map(l => '- ' + l).join('\n')
      : '(none — news source not yet integrated)';

    return `TEAM CONTEXT FOR ${teamId}:
Past AI Postmortem Lessons (this team's last 5 completed reviews):
${lessonLines}

Latest News / Roster Updates:
${newsLines}`;
  }

  /**
   * P2-5: Asynchronously fetch team news and inject into cache (real Tavily API).
   *
   * Call chain:
   *   prediction.js:predictWithAI() -> teamContext.requestTeamNews(homeId/awayId)
   *
   * Anti-overwrite strategy: check cache first; if fresh (<= _newsMaxAgeMs), return directly without refetching.
   * Return [] on API error or empty results; do not write empty cache or fabricate.
   *
   * @param {string} teamId - Team ID (espn_id/ratings_id/name)
   * @param {object} options - { maxItems }
   * @returns {Promise<string[]>} - Returns injected headline list
   */
  async requestTeamNews(teamId, options = {}) {
    if (!teamId) return [];

    // Anti-overwrite: cache is fresh -> return directly without fetching
    const cached = this._getLatestNews(teamId);
    if (cached.length > 0) return cached;

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
    if (!TAVILY_API_KEY) return [];

    const maxItems = (typeof options.maxItems === 'number' && options.maxItems >= 0) ? options.maxItems : 8;
    if (maxItems <= 0) return [];
    const name = String(teamId);
    const queries = [
      `${name} World Cup team news`,
      `${name} injury update squad`,
      `${name} lineup formation`,
    ];

    const headlines = [];
    const seen = new Set();

    for (const query of queries) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            search_depth: 'basic',
            max_results: 4,
          }),
        });

        if (!response.ok) continue;

        const data = await response.json();
        for (const result of (data.results || [])) {
          const title = (result.title || '').trim();
          if (!title) continue;
          const key = title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          headlines.push(title);
          if (headlines.length >= maxItems) break;
        }
        if (headlines.length >= maxItems) break;
      } catch (_e) {
        // Network error -> do not crash, continue to next query
      }
    }

    // Only write cache when results exist; empty results do not overwrite existing data
    if (headlines.length > 0) {
      this.updateTeamNews(teamId, headlines);
    }

    return headlines;
  }
}

// Module-level helper (consistent with crossMatchEffect.safeJsonParse)
function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = new TeamContextManager();
