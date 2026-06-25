'use strict';

/**
 * 跨场次效应分析模块 — Cross-Match Effect Analyzer
 *
 * 两个维度分析已完赛对未来比赛的影响：
 * 1. 同组效应（Same-Group Effect）：同组已完赛对本队下一场对手的战术启示
 * 2. 全局心理效应（Global Psychological Effect）：全锦标赛级别的重大事件
 *    （帽子戏法、红牌、战术意外等）对后续比赛的潜在影响
 */
const { db } = require('./db');
const teamResolver = require('./team_resolver');

// ========== 工具函数 ==========

/**
 * 安全解析 JSON 字符串，失败时返回 fallback
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
 * 归一化球队标识为一组等价键(三套系统:ratings_id / ESPN id / matches.home_team_id 英文名 / zh_name)。
 * 三套系统都对得上的 anchor 是 team_resolver.idMap;无法归一时回退到原值。
 *
 * @param {string} teamId 任意标识(ratings_id / espn_id / zh_name / 英文官方名)
 * @returns {Set<string>} 该队所有等价键(供 review.teamSpecific 字典做兜底键匹配)
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
    // review.match.home.name 在数据库里是 "西班牙 Spain" 这种"中文 英文"复合形式,也要覆盖
    if (r.zh_name && r.official_name) set.add(`${r.zh_name} ${r.official_name}`);
  }
  return set;
}

/**
 * 从 review_json 中提取球队专属教训。
 *
 * AI worker 可能用以下任一形式作 teamSpecific 字典的键:
 *   - ratings_id ("Spain")
 *   - ESPN id ("164")
 *   - 中英复合名 ("西班牙 Spain")
 *   - 中文名 / 英文官方名
 * 因此先用 team_resolver 把目标 teamId 归一成一组等价键,再扫字典 key 是否落在其中。
 *
 * @param {object} review - 解析后的 review_json 对象
 * @param {string} teamId - 任意标识(ratings_id / espn_id / 名称)
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
 * 从 review_json 中提取全局模型教训与重大事件
 * @param {object} review - 解析后的 review_json 对象
 * @returns {{ globalModel: string|null, notableEvents: string[] }}
 */
function extractGlobalInsights(review) {
  const result = { globalModel: null, notableEvents: [] };
  if (!review) return result;

  // globalModel 来自 aiPostmortem.lessonsLearned.globalModel
  const globalModel = review.aiPostmortem?.lessonsLearned?.globalModel;
  if (globalModel && typeof globalModel === 'string' && globalModel.trim()) {
    result.globalModel = globalModel.trim();
  }

  // 从 evidence.events 中识别重大事件（帽子戏法、红牌、战术意外）
  const events = review.evidence?.events;
  if (Array.isArray(events)) {
    for (const evt of events) {
      if (!evt) continue;
      const type = String(evt.type || '').toLowerCase();
      const text = evt.text || evt.textI18n?.en || '';

      // 红牌
      if (type === 'card' && /red/i.test(text)) {
        result.notableEvents.push(`Red card: ${text}`);
      }
      // 帽子戏法（同一球员 3+ 进球）在事件层面难以精确检测，
      // 但 processNotes / headline 可能提到
    }
  }

  // processNotes 中可能包含帽子戏法、VAR 争议等
  const processNotes = review.aiPostmortem?.processNotes;
  if (Array.isArray(processNotes)) {
    for (const note of processNotes) {
      if (!note || typeof note !== 'string') continue;
      if (/hat[- ]?trick|red card|tactical surprise|own goal|penalty|var/i.test(note)) {
        result.notableEvents.push(note);
      }
    }
  }

  // headline 可能提供整场比赛的关键叙事
  const headline = review.aiPostmortem?.headline;
  if (headline && typeof headline === 'string' && headline.trim()) {
    // 只在包含戏剧性关键词时加入
    if (/hat[- ]?trick|red card|shock|upset|collapse|historic|record|stunned/i.test(headline)) {
      result.notableEvents.push(`Headline: ${headline.trim()}`);
    }
  }

  // 去重
  result.notableEvents = [...new Set(result.notableEvents)];

  return result;
}

// ========== 主类 ==========

class CrossMatchEffectAnalyzer {
  /**
   * 获取同组效应 — 同组已完赛复盘对 teamId 下一场对手的战术启示。
   *
   * 修复:不再用 matches.id(自增 1-72) join post_match_reviews.match_id(ESPN 760xxx);
   *      改"按组成员归一 id 集合反查 reviews"——两条数据源的 id 系统彻底解耦。
   *
   * 步骤:
   *   1. 读 matches 拿该组的全部 home/away team 标识(matches 存的是英文官方名,如 "Spain")。
   *   2. 用 team_resolver 把每支球队归一成等价键集合(ratings_id ∪ espn_id ∪ zh_name ∪ ...)。
   *   3. 扫 post_match_reviews:取 review.match.home.id/away.id(ESPN 数字 id),
   *      过滤"双方都属于该组、且都不是 teamId 本人"的复盘。
   *
   * @param {string} teamId - 关注的球队(任意标识)
   * @param {string} groupName - 小组名称('A'..'L')
   * @returns {Array<object>}
   */
  getGroupEffect(teamId, groupName) {
    if (!teamId || !groupName) return [];

    // 1. 该组 id
    const group = db.prepare('SELECT id FROM groups WHERE group_name = ?').get(groupName);
    if (!group) return [];

    // 2. 该组成员(matches 表存英文名) → 每队的归一等价键集合
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

    // 给定一个 review 端的标识,判断它是否属于该组;返回匹配上的 aliasSet(便于去重)
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

    // 3. 扫 reviews — 双方都属该组、都不是 teamId 本人
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
      if (isFocus(homeIdRaw) || isFocus(awayIdRaw)) continue; // 排除 teamId 本人参与的场次

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

    // 按比赛日期升序(无日期排末尾)
    insights.sort((a, b) => {
      if (!a.matchDate) return 1;
      if (!b.matchDate) return -1;
      return a.matchDate.localeCompare(b.matchDate);
    });

    return insights;
  }

  /**
   * 获取全局效应 — 从所有已完赛复盘中提取可能影响后续比赛的全局教训和重大事件
   *
   * @param {string} upcomingHomeId - 即将比赛的主队 ID
   * @param {string} upcomingAwayId - 即将比赛的客队 ID
   * @returns {object} 聚合后的全局效应
   */
  getGlobalEffects(upcomingHomeId, upcomingAwayId) {
    const result = {
      globalModelLessons: [],
      notableEvents: [],
      teamSpecificContext: {},
    };

    if (!upcomingHomeId || !upcomingAwayId) return result;

    // 查询所有已完成或 AI 就绪的赛后复盘
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

      // 全局模型教训
      const insights = extractGlobalInsights(review);

      if (insights.globalModel && !seenLessons.has(insights.globalModel)) {
        seenLessons.add(insights.globalModel);
        result.globalModelLessons.push({
          matchId: row.match_id,
          lesson: insights.globalModel,
          score: `${row.actual_home_score}-${row.actual_away_score}`,
        });
      }

      // 重大事件
      for (const evt of insights.notableEvents) {
        allNotableEvents.push({
          matchId: row.match_id,
          event: evt,
        });
      }

      // 如果复盘涉及即将比赛的某一方，提取针对该队的教训
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

    // 去重并截断重大事件（避免 prompt 过长）
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
   * 编译跨场次效应 Prompt — 将同组效应和全局效应合并为 Gemini 可读的结构化 prompt
   *
   * @param {string} teamId - 关注的球队 ID（通常是主队或视角球队）
   * @param {string} opponentId - 对手 ID
   * @param {string} groupName - 小组名称
   * @returns {string} 适合注入 Gemini prompt 的文本块
   */
  compileCrossMatchPrompt(teamId, opponentId, groupName) {
    const sections = [];

    // ===== 1. 同组效应 =====
    const groupEffects = this.getGroupEffect(teamId, groupName);

    if (groupEffects.length > 0) {
      const groupLines = ['## Same-Group Effects (小组内跨场次效应)'];
      groupLines.push(`Group ${groupName} has ${groupEffects.length} completed match(es) not involving ${teamId}:\n`);

      for (const insight of groupEffects) {
        groupLines.push(`### ${insight.homeTeamId} ${insight.score} ${insight.awayTeamId} (${insight.matchDate || 'date unknown'})`);

        // 如果对手在该场比赛中出现过，突出其教训
        const opponentLesson = insight.teamLessons[opponentId];
        if (opponentLesson) {
          groupLines.push(`**Direct opponent insight (${opponentId}):** ${opponentLesson}`);
        }

        // 其他球队的教训也可能揭示战术趋势
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

        groupLines.push(''); // 空行分隔
      }

      sections.push(groupLines.join('\n'));
    }

    // ===== 2. 全局效应 =====
    const globalEffects = this.getGlobalEffects(teamId, opponentId);

    const hasGlobalContent = globalEffects.globalModelLessons.length > 0
      || globalEffects.notableEvents.length > 0
      || Object.keys(globalEffects.teamSpecificContext).length > 0;

    if (hasGlobalContent) {
      const globalLines = ['## Global Cross-Match Effects (全局跨场次效应)'];

      // 全局模型教训
      if (globalEffects.globalModelLessons.length > 0) {
        globalLines.push('\n### Model-Level Lessons (模型级教训)');
        for (const item of globalEffects.globalModelLessons) {
          globalLines.push(`- [Match ${item.matchId}, ${item.score}] ${item.lesson}`);
        }
      }

      // 重大事件
      if (globalEffects.notableEvents.length > 0) {
        globalLines.push('\n### Notable Events Across Tournament (锦标赛重大事件)');
        globalLines.push('These events may cause psychological or tactical adjustments in upcoming matches:');
        for (const item of globalEffects.notableEvents) {
          globalLines.push(`- [Match ${item.matchId}] ${item.event}`);
        }
      }

      // 即将对阵双方的历史教训
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

    // ===== 3. 组装最终 prompt =====
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
// 主实例为默认导出(保持原契约);同时导出归一化工具函数,供 teamContext 复用,
// 避免两处维护同一份 teamSpecific 键匹配逻辑。
analyzer.extractTeamLesson = extractTeamLesson;
analyzer.teamIdAliasSet = teamIdAliasSet;
module.exports = analyzer;
