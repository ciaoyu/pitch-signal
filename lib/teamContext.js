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
  constructor() {
    // P2-5: teamId → { items: string[], updatedAt: ISO }
    this._newsCache = new Map();
    this._newsMaxAgeMs = 30 * 60 * 1000; // 30-minute freshness
  }

  /**
   * @param {string} teamId - 任意标识(ratings_id / espn_id / 名称)
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
   * 数据来源:由 news.js 路由(Tavily/ESPN mock)写入缓存;
   * PredictiveContextService 在执行预测前先拉取新闻并注入。
   *
   * @param {string} teamId — 使用 getContext() 中 autoId 归一后的 ID
   * @returns {string[]}
   */
  _getLatestNews(teamId) {
    if (!teamId) return [];
    // 正向 ID 匹配——直接命中缓存
    const direct = this._newsCache.get(teamId);
    if (direct && Date.now() - new Date(direct.updatedAt).getTime() < this._newsMaxAgeMs) {
      return direct.items;
    }
    // 遍历所有缓存的别名解析(espn_id → normalized)——如果预测用的是
    // ratings_id 但我们缓存的是 espn_id,用别名桥接。
    for (const [cachedTeamId, entry] of this._newsCache) {
      if (Date.now() - new Date(entry.updatedAt).getTime() >= this._newsMaxAgeMs) continue;
      const aliases = teamIdAliasSet(cachedTeamId);
      if (aliases.has(teamId)) return entry.items;
    }
    return [];
  }

  /**
   * P2-5: 写入球队新闻到内存缓存,供 _getLatestNews 拉取。
   *
   * 调用方: requestTeamNews() 在 PredictiveContextService.assembleTeamContext()
   * 中主动拉取 ESPN/Tavily 新闻后调用;也供 news.js 路由侧直接推入缓存。
   *
   * @param {string} teamId — 任意标识(espn_id/ratings_id/名称,由调用方自行归一)
   * @param {string[]} items — headline snippets,最多保留 8 条(最相关优先)
   * @returns {number} 缓存中当前条目数(验证用,非功能必需)
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

  /**
   * P2-5: 异步拉取球队新闻并注入缓存(Tavily/ESPN mock -> updateTeamNews)。
   *
   * 实际调用链:
   *   prediction.js:predictWithAI() → teamContext.requestTeamNews(homeId/awayId)
   *   news.js 路由的 /api/news/search 搜索逻辑被复制至此,适配 prediction.js 的预热需求。
   *
   * @param {string} teamId - 球队 ID(espn_id/ratings_id/名称)
   * @param {object} options - { lang, maxItems }
   * @returns {Promise<string[]>} - 返回注入的 headline 列表(调试用)
   */
  async requestTeamNews(teamId, options = {}) {
    if (!teamId) return [];
    const maxItems = options.maxItems || 8;
    const lang = options.lang || 'en';
    // 简单实现:调用 news.js 路由内部的 mock 新闻生成逻辑
    // (真实生产应调用 Tavily API 或 ESPN injury API)
    const teamName = teamId; // TODO: ID → 球队名映射
    const headlines = [];
    // Mock headline 生成(沿用 news.js 的 mock 模式)
    // 真实实现需要:
    //   1. Tavily search: "${teamName} news injury lineup"
    //   2. 过滤博彩源
    //   3. 提取 headline
    // 此处先返回空数组,等 news.js 真实新闻接入后再补全
    // 避免编造假新闻
    const injected = headlines.slice(0, maxItems);
    this.updateTeamNews(teamId, injected);
    return injected;
  }
}

// 模块级 helper(与 crossMatchEffect.safeJsonParse 一致)
function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

module.exports = new TeamContextManager();
