'use strict';

/**
 * Cross-Match Effect Analyzer module
 *
 * Analyzes the impact of completed matches on future matches across two dimensions:
 * 1. Same-Group Effect: tactical insights from completed matches in the same group on the team's next opponent
 * 2. Global Psychological Effect: potential impact of major tournament-wide events
 *    (hat-tricks, red cards, tactical surprises, etc.) on subsequent matches
 */
const { db } = require('./db');
const teamResolver = require('./team_resolver');

// ========== Utility functions ==========

/**
 * Safely parse JSON string, returning fallback on failure
 */
function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Normalize team identifier into a set of equivalent keys (three systems: ratings_id / ESPN id / matches.home_team_id English name / zh_name).
 * The anchor linking all three systems is team_resolver.idMap; falls back to original value when normalization fails.
 *
 * @param {string} teamId arbitrary identifier (ratings_id / espn_id / zh_name / official English name)
 * @returns {Set<string>} all equivalent keys for this team (for fallback key matching against review.teamSpecific dictionary)
 */
function teamIdAliasSet(teamId) {
  const set = new Set();
  if (teamId == null) return set;
  const s = String(teamId);
  set.add(s);
  const r = teamResolver.resolve(s);
  if (r) {
    if (r.ratings_id) set.add(r.ratings_id);
    if (r.espn_id) set.add(String(r.espn_id));
    if (r.zh_name) set.add(r.zh_name);
    if (r.official_name) set.add(r.official_name);
    // review.match.home.name in the DB is a composite "zh_name + English" format (e.g. "Spain"), which should also be covered
    if (r.zh_name && r.official_name) set.add(`${r.zh_name} ${r.official_name}`);
  }
  return set;
}

/**
 * Extract team-specific lessons from review_json.
 *
 * AI worker may use any of the following formats as keys in the teamSpecific dictionary:
 *   - ratings_id ("Spain")
 *   - ESPN id ("164")
 *   - Composite zh_name + English name (e.g. "Spain")
 *   - Chinese name / official English name
 * Therefore, first normalize target teamId into a set of equivalent keys via team_resolver, then scan whether dictionary keys match any of them.
 *
 * @param {object} review - parsed review_json object
 * @param {string} teamId - arbitrary identifier (ratings_id / espn_id / name)
 * @returns {string|null}
 */
function extractTeamLesson(review, teamId) {
  if (!review) return null;
  const teamSpecific = review.aiPostmortem?.lessonsLearned?.teamSpecific;
  if (!teamSpecific || typeof teamSpecific !== 'object') return null;

  const aliases = teamIdAliasSet(teamId);
  for (const key of Object.keys(teamSpecific)) {
    if (aliases.has(key)) {
      const v = teamSpecific[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

/**
 * Extract global model lessons and notable events from review_json
 * @param {object} review - parsed review_json object
 * @returns {{ globalModel: string|null, notableEvents: string[] }}
 */
function extractGlobalInsights(review) {
  const result = { globalModel: null, notableEvents: [] };
  if (!review) return result;

  // globalModel comes from aiPostmortem.lessonsLearned.globalModel
  const globalModel = review.aiPostmortem?.lessonsLearned?.globalModel;
  if (globalModel && typeof globalModel === 'string' && globalModel.trim()) {
    result.globalModel = globalModel.trim();
  }

  // Identify notable events from evidence.events (hat-tricks, red cards, tactical surprises)
  const events = review.evidence?.events;
  if (Array.isArray(events)) {
    for (const evt of events) {
      if (!evt) continue;
      const type = String(evt.type || '').toLowerCase();
      const text = evt.text || evt.textI18n?.en || '';

      // Red card
      if (type === 'card' && /red/i.test(text)) {
        result.notableEvents.push(`Red card: ${text}`);
      }
      // Hat-trick (3+ goals by same player) is hard to detect precisely at event level,
      // but processNotes / headline may mention it
    }
  }

  // processNotes may contain hat-tricks, VAR controversies, etc.
  const processNotes = review.aiPostmortem?.processNotes;
  if (Array.isArray(processNotes)) {
    for (const note of processNotes) {
      if (!note || typeof note !== 'string') continue;
      if (/hat[- ]?trick|red card|tactical surprise|own goal|penalty|var/i.test(note)) {
        result.notableEvents.push(note);
      }
    }
  }

  // headline may provide key narrative of entire match
  const headline = review.aiPostmortem?.headline;
  if (headline && typeof headline === 'string' && headline.trim()) {
    // Only add when containing dramatic keywords
    if (/hat[- ]?trick|red card|shock|upset|collapse|historic|record|stunned/i.test(headline)) {
      result.notableEvents.push(`Headline: ${headline.trim()}`);
    }
  }

  // Deduplicate
  result.notableEvents = [...new Set(result.notableEvents)];

  return result;
}

// ========== Main class ==========

class CrossMatchEffectAnalyzer {
  /**
   * Get same-group effect - tactical insights from completed reviews in the same group on teamId's next opponent.
   *
   * Fix: no longer join matches.id (auto-increment 1-72) with post_match_reviews.match_id (ESPN 760xxx);
   *      instead query reviews by normalized ID set of group members - completely decoupling the two data sources' ID systems.
   *
   * Steps:
   *   1. Read matches to get all home/away team identifiers in the group (matches stores official English names, e.g., "Spain").
   *   2. Normalize each team into an equivalent key set via team_resolver (ratings_id U espn_id U zh_name U ...).
   *   3. Scan post_match_reviews: take review.match.home.id/away.id (ESPN numeric id),
   *      filter reviews where both sides belong to the group and neither is teamId itself.
   *
   * @param {string} teamId - focus team (arbitrary identifier)
   * @param {string} groupName - group name ('A'..'L')
   * @returns {Array<object>}
   */
  getGroupEffect(teamId, groupName) {
    if (!teamId || !groupName) return [];

    // 1. Group ID
    const group = db.prepare('SELECT id FROM groups WHERE group_name = ?').get(groupName);
    if (!group) return [];

    // 2. Group members (matches table stores English names) -> normalized equivalent key sets per team
    const memberRows = db.prepare(`
      SELECT DISTINCT home_team_id AS t FROM matches WHERE group_id = ?
      UNION
      SELECT DISTINCT away_team_id AS t FROM matches WHERE group_id = ?
    `).all(group.id, group.id);
    const groupAliasSets = memberRows
      .map((r) => teamIdAliasSet(r.t))
      .filter((s) => s.size > 0);
    if (groupAliasSets.length === 0) return [];

    const focusAliases = teamIdAliasSet(teamId);

    // Given an identifier from review side, check if it belongs to group; return matched aliasSet (for deduplication)
    const matchesGroup = (id) => {
      const s = String(id ?? '');
      if (!s) return null;
      for (const set of groupAliasSets) if (set.has(s)) return set;
      return null;
    };
    const isFocus = (id) => {
      const s = String(id ?? '');
      return s && focusAliases.has(s);
    };

    // 3. Scan reviews - both sides belong to group and neither is teamId itself
    const allReviews = db.prepare(`
      SELECT match_id, review_json, status
      FROM post_match_reviews
      WHERE status IN ('completed','ready_for_ai')
    `).all();

    const insights = [];
    for (const row of allReviews) {
      const review = safeJsonParse(row.review_json);
      if (!review) continue;
      const homeIdRaw = review.match?.home?.id;
      const awayIdRaw = review.match?.away?.id;
      const homeInGroup = matchesGroup(homeIdRaw);
      const awayInGroup = matchesGroup(awayIdRaw);
      if (!homeInGroup || !awayInGroup) continue;
      if (isFocus(homeIdRaw) || isFocus(awayIdRaw)) continue; // Exclude matches involving teamId itself

      const homeLesson = extractTeamLesson(review, homeIdRaw);
      const awayLesson = extractTeamLesson(review, awayIdRaw);

      const biasFactors = review?.biasAnalysis?.factors || [];
      const accuracy = review?.biasAnalysis?.accuracy || null;
      const failureCategory = review?.aiPostmortem?.failureCategory || null;
      const homeName = review.match?.home?.name || review.match?.homeName || homeIdRaw;
      const awayName = review.match?.away?.name || review.match?.awayName || awayIdRaw;

      insights.push({
        matchId: row.match_id,
        homeTeamId: String(homeIdRaw),
        awayTeamId: String(awayIdRaw),
        homeName,
        awayName,
        score: `${review.match?.home?.score ?? '?'}-${review.match?.away?.score ?? '?'}`,
        matchDate: review.match?.date || null,
        venue: review.match?.venue || null,
        reviewAvailable: true,
        reviewStatus: row.status,
        teamLessons: {
          [String(homeIdRaw)]: homeLesson,
          [String(awayIdRaw)]: awayLesson,
        },
        predictionAccuracy: accuracy,
        failureCategory,
        highImpactFactors: biasFactors
          .filter((f) => f.impact === 'high')
          .map((f) => ({
            key: f.key,
            detail: f.detail || f.detailI18n?.en || '',
          })),
      });
    }

    // Sort ascending by match date (missing date placed at end)
    insights.sort((a, b) => {
      if (!a.matchDate) return 1;
      if (!b.matchDate) return -1;
      return a.matchDate.localeCompare(b.matchDate);
    });

    return insights;
  }

  /**
   * Get global effect - extract global lessons and notable events from all completed match reviews that may affect subsequent matches
   *
   * @param {string} upcomingHomeId - upcoming match home team ID
   * @param {string} upcomingAwayId - upcoming match away team ID
   * @returns {object} aggregated global effects
   */
  getGlobalEffects(upcomingHomeId, upcomingAwayId) {
    const result = {
      globalModelLessons: [],
      notableEvents: [],
      teamSpecificContext: {},
    };

    if (!upcomingHomeId || !upcomingAwayId) return result;

    // Query all completed or AI-ready post-match reviews
    const reviews = db.prepare(`
      SELECT pmr.match_id, pmr.review_json, pmr.status,
             pmr.actual_home_score, pmr.actual_away_score
      FROM post_match_reviews pmr
      WHERE pmr.status IN ('completed', 'ready_for_ai')
      ORDER BY pmr.created_at ASC
    `).all();

    if (reviews.length === 0) return result;

    const seenLessons = new Set();
    const allNotableEvents = [];

    for (const row of reviews) {
      const review = safeJsonParse(row.review_json);
      if (!review) continue;

      // Global model lessons
      const insights = extractGlobalInsights(review);

      if (insights.globalModel && !seenLessons.has(insights.globalModel)) {
        seenLessons.add(insights.globalModel);
        result.globalModelLessons.push({
          matchId: row.match_id,
          lesson: insights.globalModel,
          score: `${row.actual_home_score}-${row.actual_away_score}`,
        });
      }

      // Notable events
      for (const evt of insights.notableEvents) {
        allNotableEvents.push({
          matchId: row.match_id,
          event: evt,
        });
      }

      // If review involves either side of upcoming match, extract lessons specific to that team
      for (const targetId of [upcomingHomeId, upcomingAwayId]) {
        const lesson = extractTeamLesson(review, targetId);
        if (lesson) {
          if (!result.teamSpecificContext[targetId]) {
            result.teamSpecificContext[targetId] = [];
          }
          result.teamSpecificContext[targetId].push({
            matchId: row.match_id,
            lesson,
          });
        }
      }
    }

    // Deduplicate and truncate notable events (to avoid prompt being too long)
    const uniqueEvents = [];
    const eventSet = new Set();
    for (const item of allNotableEvents) {
      if (!eventSet.has(item.event)) {
        eventSet.add(item.event);
        uniqueEvents.push(item);
      }
    }
    result.notableEvents = uniqueEvents.slice(0, 20);

    return result;
  }

  /**
   * Compile cross-match effect prompt - combine same-group and global effects into structured prompt readable by Gemini
   *
   * @param {string} teamId - focus team ID (usually home team or focal team)
   * @param {string} opponentId - opponent ID
   * @param {string} groupName - group name
   * @returns {string} text block suitable for injection into Gemini prompt
   */
  compileCrossMatchPrompt(teamId, opponentId, groupName) {
    const sections = [];

    // ===== 1. Same-group effects =====
    const groupEffects = this.getGroupEffect(teamId, groupName);

    if (groupEffects.length > 0) {
      const groupLines = ['## Same-Group Effects (小组内跨场次效应)'];
      groupLines.push(`Group ${groupName} has ${groupEffects.length} completed match(es) not involving ${teamId}:\n`);

      for (const insight of groupEffects) {
        groupLines.push(`### ${insight.homeTeamId} ${insight.score} ${insight.awayTeamId} (${insight.matchDate || 'date unknown'})`);

        // Highlight opponent lesson if opponent appeared in that match
        const opponentLesson = insight.teamLessons[opponentId];
        if (opponentLesson) {
          groupLines.push(`**Direct opponent insight (${opponentId}):** ${opponentLesson}`);
        }

        // Lessons from other teams may also reveal tactical trends
        for (const [tid, lesson] of Object.entries(insight.teamLessons)) {
          if (tid !== opponentId && lesson) {
            groupLines.push(`- ${tid}: ${lesson}`);
          }
        }

        if (insight.highImpactFactors.length > 0) {
          groupLines.push('High-impact factors:');
          for (const factor of insight.highImpactFactors) {
            groupLines.push(`  - [${factor.key}] ${factor.detail}`);
          }
        }

        if (insight.failureCategory) {
          groupLines.push(`Prediction failure category: ${insight.failureCategory}`);
        }

        groupLines.push(''); // Blank line separator
      }

      sections.push(groupLines.join('\n'));
    }

    // ===== 2. Global effects =====
    const globalEffects = this.getGlobalEffects(teamId, opponentId);

    const hasGlobalContent = globalEffects.globalModelLessons.length > 0
      || globalEffects.notableEvents.length > 0
      || Object.keys(globalEffects.teamSpecificContext).length > 0;

    if (hasGlobalContent) {
      const globalLines = ['## Global Cross-Match Effects (全局跨场次效应)'];

      // Global model lessons
      if (globalEffects.globalModelLessons.length > 0) {
        globalLines.push('\n### Model-Level Lessons (模型级教训)');
        for (const item of globalEffects.globalModelLessons) {
          globalLines.push(`- [Match ${item.matchId}, ${item.score}] ${item.lesson}`);
        }
      }

      // Notable events
      if (globalEffects.notableEvents.length > 0) {
        globalLines.push('\n### Notable Events Across Tournament (锦标赛重大事件)');
        globalLines.push('These events may cause psychological or tactical adjustments in upcoming matches:');
        for (const item of globalEffects.notableEvents) {
          globalLines.push(`- [Match ${item.matchId}] ${item.event}`);
        }
      }

      // Historical lessons for upcoming match sides
      if (Object.keys(globalEffects.teamSpecificContext).length > 0) {
        globalLines.push('\n### Accumulated Team Lessons (累积球队教训)');
        for (const [tid, lessons] of Object.entries(globalEffects.teamSpecificContext)) {
          globalLines.push(`\n**${tid}:**`);
          for (const l of lessons) {
            globalLines.push(`- [From match ${l.matchId}] ${l.lesson}`);
          }
        }
      }

      sections.push(globalLines.join('\n'));
    }

    // ===== 3. Assemble final prompt =====
    if (sections.length === 0) {
      return `# Cross-Match Effect Analysis\nNo completed match data available for cross-match analysis. Proceed with baseline prediction.`;
    }

    const header = [
      '# Cross-Match Effect Analysis (跨场次效应分析)',
      `**Focus:** ${teamId} vs ${opponentId} | Group ${groupName}`,
      '',
      'Use the following insights from completed matches to refine your prediction.',
      'Pay special attention to direct opponent lessons and high-impact factors.',
      '',
    ].join('\n');

    return header + sections.join('\n\n');
  }
}

const analyzer = new CrossMatchEffectAnalyzer();
// Main instance exported by default (preserves contract); also exports normalization utility functions for reuse in teamContext,
// avoiding maintaining the same teamSpecific key matching logic in two places.
analyzer.extractTeamLesson = extractTeamLesson;
analyzer.teamIdAliasSet = teamIdAliasSet;
module.exports = analyzer;
