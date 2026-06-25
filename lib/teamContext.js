'use strict';

const { db } = require('./db');
const crossMatchEffect = require('./crossMatchEffect');
const { extractTeamLesson, teamIdAliasSet } = crossMatchEffect;

/**
 * Team Context Manager — RAG 式球队专属上下文
 *
 * 从赛后复盘(post_match_reviews)中检索"该队近 5 场"的历史教训,供预测注入使用。
 *
 * 设计原则:
 * - 禁止编造:无数据时返回空数组。
 * - "返回空是正确的":所有复盘仍在 ready_for_ai(尚未 completed)时,
 *   pastLessons 合法为空。等 worker 填充 lessonsLearned 后自动有数据。
 * - id 归一与教训提取复用 crossMatchEffect.{extractTeamLesson, teamIdAliasSet},
 *   单一事实源,避免与跨场次模块漂移。
 */
class TeamContextManager {
  /**
   * @param {string} teamId 任意标识(ratings_id / espn_id / 名称)
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
   * 取"该队最近 5 场"已完成复盘里的 teamSpecific 教训。
   *
   * Track D 修复:此前是"全局最近 5 条 completed"——任何 5 条强队的复盘就会把这队
   * 自己的历史挤掉。现在按 review.match.home/away.id 反查"是否该队参与"再排序取 5。
   *
   * 实现:扫所有 completed 复盘,按 teamId 的归一别名集合过滤,按 created_at DESC 取前 5。
   * 数据量级 ~64 场,O(n) 内存过滤足够;避免在 SQL 里写复杂的 JSON 反查。
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
      // 只看该队参与的场次
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
   * 最新新闻 / 伤停 / 阵容动态。
   *
   * TODO: 真实新闻源(ESPN 伤停、官方阵容公告等)尚未接入。
   *       接入前返回空数组,绝不编造。接入后在此填充真实数据。
   *
   * @param {string} teamId
   * @returns {string[]}
   */
  _getLatestNews(/* teamId */) {
    // 真实新闻源未接入前返回空——禁止编造。
    return [];
  }

  /**
   * 组装供预测注入的 prompt 文本块。
   * 空数据时显式标注"暂无",作为状态说明(非假数据)。
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
}

// 模块级 helper(与 crossMatchEffect.safeJsonParse 一致)
function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = new TeamContextManager();
