/**
 * AI 智能反馈与问答路由
 * /api/bot/*
 * Track 4: 集成知识库 + matchId 真实比赛数据注入 + DeepSeek chat
 */
let dbInstance = null;
try {
  dbInstance = require('../db').db;
} catch (e) {
  console.warn('Database module not available for bot routes:', e.message);
}
const { constantTimeEqual } = require('../security');
const botKB = require('../botKnowledgeBase');
let claudeClient = null;
try {
  claudeClient = require('../claudeClient');
} catch (_) { /* 配置错误在请求时返回明确错误 */ }

function detectLanguage(text = '', context = {}) {
  const requested = String(context.uiLang || context.language || '').toLowerCase();
  if (requested === 'zh' || requested === 'en') return requested;

  const value = String(text || '');
  const cjkCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latinWords = (value.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;

  if (cjkCount > 0 && cjkCount >= latinWords) return 'zh';
  if (latinWords > 0) return 'en';
  return 'zh';
}

function bilingualFallback(userQuery) {
  const q = String(userQuery || '').toLowerCase();
  if (/预测|概率|model|prediction|probability|forecast/.test(q)) {
    return '预测基于 Elo 长期实力评分与 Poisson 进球分布，结果仅供分析参考，不构成投注建议。\n\nThe forecast combines long-term Elo strength with a Poisson goal model. It is for analysis only and is not betting advice.';
  }
  return '我是 PitchSignal 比赛分析助理，可以解释预测、数据来源、积分榜和比赛详情。\n\nI am the PitchSignal match analysis assistant. I can explain forecasts, data sources, standings, and match details.';
}

function buildSystemPrompt(lang, kbContext, matchContextStr, globalCtxStr) {
  const kbBlock = kbContext
    ? (lang === 'en'
      ? `## Internal Knowledge Base (use this for factual explanations)\n${kbContext}\n\nAnswer the user's question by FIRST explaining the relevant concept from the knowledge base above, THEN incorporating any match-specific data provided below. If the knowledge base does not cover a topic, use your general football expertise.\n`
      : `## 内部知识库（请基于此回答）\n${kbContext}\n\n先基于上述知识库解释核心概念，再结合下方比赛数据做具体分析。如知识库未涵盖该问题，可使用通用足球知识。\n`)
    : '';

  const globalBlock = globalCtxStr
    ? (lang === 'en'
      ? `## Tournament Data (always reference when relevant)\n${globalCtxStr}\n`
      : `## 赛事数据（回答相关问题时务必引用）\n${globalCtxStr}\n`)
    : '';

  if (lang === 'en') {
    return `You are the PitchSignal match analysis assistant. Answer user questions about World Cup predictions, data models (Elo ratings, Poisson distribution), matchup analysis, and venue/weather factors.
${kbBlock}
${globalBlock}
Current page / match context: ${matchContextStr || 'none'}

Rules:
- Always provide two sections: Chinese first, then English
- Be professional, objective, and concise (2-4 paragraphs max)
- When match data is provided, always relate your conceptual explanation to the actual match
- If the user reports a bug or data error, thank them and say it has been recorded
- Never provide betting advice`;
  }

  return `你是 PitchSignal 的智能分析助理。你的任务是回答用户关于世界杯赛事预测、数据模型（Elo评分、Poisson分布模型）、对位分析、场馆/天气因素等问题。
${kbBlock}
${globalBlock}
当前页面 / 比赛上下文信息：${matchContextStr || '无'}

规则：
- 始终输出两部分：先中文，后英文
- 保持专业、客观、简洁（2-4 段即可）
- 当提供了比赛数据时，务必结合比赛实际情况做分析
- 用户反馈 bug 或数据错误时，感谢并告知已记录
- 绝不提供投注建议`;
}

// --- Demo-mode rate limiter (per-IP token bucket) ---
const _demoBuckets = new Map();
const DEMO_WINDOW_MS = 60_000;   // 1 minute
const DEMO_MAX_PER_WINDOW = 5;   // 5 requests/min per IP

function _demoRateCheck(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim() || req?.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = _demoBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + DEMO_WINDOW_MS };
    _demoBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count > DEMO_MAX_PER_WINDOW ? ip : null;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of _demoBuckets) {
    if (bucket.resetAt <= now) _demoBuckets.delete(ip);
  }
}, DEMO_WINDOW_MS).unref?.();

module.exports = function createBotRoutes(deps) {
  /**
   * P2-6: 全局上下文 — 出线概率 + 积分榜，始终注入（30min 缓存）
   */
  async function fetchGlobalContext({ getCached, setCache }) {
    const cacheKey = 'bot_global_ctx';
    const cached = getCached ? getCached(cacheKey, 1800000) : null;
    if (cached) return cached;

    const globalCtx = { qualification: null, standings: null };

    // 出线概率
    try {
      const qualRes = await deps.routes?.['GET /api/qualification-probabilities']?.({}) || [];
      const qualificationResults = Array.isArray(qualRes)
        ? qualRes
        : (Array.isArray(qualRes.results)
          ? qualRes.results
          : Object.values(qualRes)
            .flatMap(group => Array.isArray(group?.results) ? group.results : []));
      if (!qualRes.error && Array.isArray(qualificationResults) && qualificationResults.length > 0) {
        globalCtx.qualification = qualificationResults
          .map(t => ({
            team: t.teamName || t.name || t.id,
            qualify: t.qualifyProb,
            thirdPlace: t.thirdPlaceQualifyProb ?? 0,
            champion: t.championProb ?? 0,
            eliminated: t.eliminatedProb ?? 0,
          }))
          .sort((a, b) => (b.qualify ?? -1) - (a.qualify ?? -1));
      }
    } catch (_) { console.debug('bot: qualification context fetch skipped'); }

    // 积分榜优先复用线上实际数据源；group_standings 可能未被持久化。
    try {
      const standingsRes = await deps.routes?.['GET /api/standings']?.({}) || null;
      if (!standingsRes?.error && Array.isArray(standingsRes?.groups) && standingsRes.groups.length > 0) {
        globalCtx.standings = {};
        for (const group of standingsRes.groups) {
          const groupId = group.group || String(group.name || '').replace(/^小组\s*/i, '') || 'unknown';
          globalCtx.standings[groupId] = (group.standings || []).map(row => ({
            team_name: row.nameI18n?.zh || row.name || row.team_name,
            played: Number(row.played || 0),
            wins: Number(row.wins || 0),
            draws: Number(row.draws || 0),
            losses: Number(row.losses || 0),
            goals_for: Number(row.gf ?? row.goals_for ?? 0),
            goals_against: Number(row.ga ?? row.goals_against ?? 0),
            goal_difference: Number(row.gd ?? row.goal_difference ?? 0),
            points: Number(row.pts ?? row.points ?? 0),
          }));
        }
      }
    } catch (_) { console.debug('bot: standings route context fetch skipped'); }

    // DB 仅作兼容旧环境的 fallback。
    if (!globalCtx.standings) {
      try {
        const db = require('../db').db;
        if (db) {
        const groups = db.prepare('SELECT DISTINCT group_id FROM group_standings').all();
        const standingsMap = {};
        for (const g of groups) {
          standingsMap[g.group_id] = db.prepare(
            'SELECT team_name, played, wins, draws, losses, goals_for, goals_against, goal_difference, points FROM group_standings WHERE group_id = ? ORDER BY points DESC, goal_difference DESC, goals_for DESC'
          ).all(g.group_id);
        }
        if (Object.keys(standingsMap).length > 0) globalCtx.standings = standingsMap;
        }
      } catch (_) { console.debug('bot: standings DB context fetch skipped'); }
      }

    if (setCache && (globalCtx.qualification || globalCtx.standings)) {
      setCache(cacheKey, globalCtx);
    }
    return globalCtx;
  }

  /**
   * 当 context 含 matchId 时，后台拉取真实比赛数据注入 system prompt
   */
  async function fetchMatchContext(matchId, { getCached, setCache }) {
    if (!matchId) return null;
    const cacheKey = `bot_match_ctx_${matchId}`;
    const cached = getCached ? getCached(cacheKey, 60000) : null;
    if (cached) return cached;

    const ctx = {};
    try {
      // 拉比赛基本信息
      const matchRes = await deps.routes?.['GET /api/match/:id']?.({ id: matchId }) || {};
      if (!matchRes.error) {
        ctx.match = {
          home: matchRes.home?.name || matchRes.home,
          away: matchRes.away?.name || matchRes.away,
          score: { home: matchRes.home?.score || '', away: matchRes.away?.score || '' },
          status: matchRes.state,
          venue: matchRes.venue || '',
        };
      }
    } catch (_) { console.debug('bot: match context fetch skipped for', matchId); }

    try {
      // 拉对位数据
      const homeId = deps.routes?.['GET /api/match/:id']
        ? (await deps.routes['GET /api/match/:id']?.({ id: matchId }) || {}).home?.id : null;
      const awayId = deps.routes?.['GET /api/match/:id']
        ? (await deps.routes['GET /api/match/:id']?.({ id: matchId }) || {}).away?.id : null;
      if (homeId && awayId) {
        const spatialRes = await deps.routes?.['GET /api/matchup-spatial/:home/:away']?.({ home: homeId, away: awayId }) || {};
        if (!spatialRes.error && spatialRes.summary) {
          ctx.spatial = {
            summary: spatialRes.summary,
            pairs: (spatialRes.pairs || []).filter(p => p.key).map(p => ({
              home: p.home?.name, away: p.away?.name,
              advantage: p.advantage, diff: p.diff,
            })).slice(0, 5),
          };
        }
      }
    } catch (_) { console.debug('bot: spatial matchup fetch skipped for', matchId); }

    try {
      // 拉预测数据
      const predRes = await deps.routes?.['GET /api/predict/:matchId']?.({ matchId }) || {};
      if (!predRes.error) {
        ctx.prediction = {
          homeWin: predRes.homeWin, draw: predRes.draw, awayWin: predRes.awayWin,
          expectedScore: predRes.expectedScore,
          poissonModeScore: predRes.poissonModeScore,
          venueFactor: predRes.venueFactor?.applied ? predRes.venueFactor : null,
        };
      }
    } catch (_) {}

    if (setCache) setCache(cacheKey, ctx);
    return ctx;
  }

  async function handleChat(params, body, req) {
    const expected = process.env.BOT_API_TOKEN || process.env.ADMIN_TOKEN || '';
    const authHeader = req?.headers?.authorization || '';
    const token = req?.headers?.['x-admin-token'] || params?.admin_token || params?.token || '';

    let isDemoMode = false;

    const isAuthorized = expected && (
      (authHeader.startsWith('Bearer ') && constantTimeEqual(authHeader.slice(7).trim(), expected))
      || constantTimeEqual(token, expected)
    );
    if (!isAuthorized) {
      if (_demoRateCheck(req)) {
        const err = new Error('Rate limit exceeded for demo mode (5 requests/min)');
        err.statusCode = 429;
        throw err;
      }
      isDemoMode = true;
    }

    const { messages, context } = body || {};

    if (!messages || !Array.isArray(messages)) {
      return { error: 'Invalid messages format' };
    }

    const userQuery = messages[messages.length - 1]?.content || '';
    const lang = detectLanguage(userQuery, context);
    const matchId = context?.matchId || null;

    // 知识库检索
    const kbResult = botKB.search(userQuery, lang);
    const kbContext = botKB.buildContextText(kbResult.sections, lang);

    // P2-6: 全局赛事数据（始终注入，30min 缓存）
    const globalCtx = await fetchGlobalContext(deps);
    let globalCtxStr = '';
    if (globalCtx) {
      const parts = [];
      if (globalCtx.qualification) {
        parts.push('## 全部球队出线概率\n' + JSON.stringify(globalCtx.qualification, null, 1));
      }
      if (globalCtx.standings) {
        parts.push('## 小组积分榜\n' + JSON.stringify(globalCtx.standings, null, 1));
      }
      if (parts.length > 0) globalCtxStr = parts.join('\n\n');
    }

    // 比赛真实数据上下文
    let matchContextStr = '';
    if (matchId) {
      const matchCtx = await fetchMatchContext(matchId, deps);
      if (matchCtx) {
        matchContextStr = JSON.stringify(matchCtx, null, 2);
      }
    }
    if (!matchContextStr) {
      matchContextStr = context ? JSON.stringify({ ...context, detectedLanguage: lang }) : '';
    }

    let aiResponseText = '';
    let source = 'unknown';

    if (!claudeClient || !claudeClient.isChatConfigured()) {
      aiResponseText = bilingualFallback(userQuery);
      source = 'local-bilingual-fallback';
    } else {
      try {
        const systemPrompt = buildSystemPrompt(lang, kbContext, matchContextStr, globalCtxStr);
        const chatMessages = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
        }));
        aiResponseText = await claudeClient.chat(chatMessages, systemPrompt);
        source = 'deepseek-v4-flash';
      } catch (e) {
        aiResponseText = bilingualFallback(userQuery);
        source = 'local-bilingual-fallback';
      }
    }

    try {
      if (dbInstance) {
        dbInstance.prepare(`
          INSERT INTO user_feedback (user_query, ai_response, match_context, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(userQuery, aiResponseText, matchContextStr);
      } else {
        console.debug('Database not available, skipping feedback storage');
      }
    } catch (dbErr) {
      console.error('Failed to save user feedback:', dbErr.message);
    }

    return {
      response: aiResponseText,
      answer: aiResponseText,
      language: lang,
      source,
      kbHits: kbResult.sections.length,
      matchDataLoaded: !!matchId,
      status: 'success'
    };
  }
  
  async function handleMessage(params, body) {
    const content = String(body?.content || '').trim();
    if (!content) return { error: 'Empty message' };

    const lang = detectLanguage(content, { uiLang: body?.uiLang });
    const pageUrl = String(body?.pageUrl || body?.page_url || '').slice(0, 512);
    const contextStr = body?.context ? JSON.stringify(body.context).slice(0, 1024) : null;

    const ack = lang === 'en'
      ? 'Thank you for your message! We have received your feedback and will review it.'
      : '感谢您的留言！我们已收到您的意见，会认真参考。';

    try {
      if (dbInstance) {
        dbInstance.prepare(`
          INSERT INTO user_feedback (user_query, ai_response, match_context, type, page_url, created_at)
          VALUES (?, ?, ?, 'message', ?, datetime('now'))
        `).run(content, '[留言已收录]', contextStr, pageUrl || null);
      } else {
        console.debug('Database not available, skipping message storage');
      }
    } catch (dbErr) {
      console.error('Failed to save bot message:', dbErr.message);
    }

    return { response: ack, status: 'saved' };
  }

  function handleAdminMessages(params, body, req) {
    const expected = process.env.ADMIN_TOKEN || process.env.WRITE_API_TOKEN || '';
    if (!expected) {
      // 安全兜底：无 token 配置时拒绝访问
      const err = new Error('Admin token not configured');
      err.statusCode = 503;
      throw err;
    }
    const token = req?.headers?.['x-admin-token'] || params?.token || '';
    const authHeader = req?.headers?.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!constantTimeEqual(token, expected) && !constantTimeEqual(bearer, expected)) {
      const err = new Error('Unauthorized'); err.statusCode = 401; throw err;
    }

    if (!dbInstance) {
      return { rows: [], stats: [], total: 0, limit: 100, offset: 0, error: 'Database not available' };
    }

    const type = params?.type || 'all';
    const limit = Math.min(parseInt(params?.limit || '100', 10), 500);
    const offset = parseInt(params?.offset || '0', 10);

    const typeFilter = type === 'all' ? '' : `WHERE type = ?`;
    const typeParam = type === 'message' ? 'message' : 'question';
    const queryParams = type === 'all' ? [limit, offset] : [typeParam, limit, offset];
    const rows = dbInstance.prepare(`
      SELECT id, type, user_query, ai_response, match_context, page_url, created_at
      FROM user_feedback
      ${typeFilter}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams);

    const stats = dbInstance.prepare(`
      SELECT type, COUNT(*) as count FROM user_feedback GROUP BY type
    `).all();

    return { rows, stats, total: rows.length, limit, offset };
  }

  // P2-6: exposed for testing
  const publicApi = {
    'POST /api/bot/chat': async (params, body, req) => {
      try {
        return await handleChat(params, body, req);
      } catch (e) {
        if (e.statusCode) throw e;
        console.error("Bot Chat Error:", e);
        return { error: 'Bot service failed', message: 'Internal bot error' };
      }
    },

    'POST /api/bot/ask': async (params, body, req) => {
      try {
        const question = body?.question || '';
        return await handleChat(params, {
          messages: [{ role: 'user', content: question }],
          context: {
            ...(typeof body?.context === 'object' ? body.context : { source: body?.context || 'ask' }),
            uiLang: body?.uiLang,
            matchId: body?.matchId,
            homeId: body?.homeId,
            awayId: body?.awayId,
          },
        }, req);
      } catch (e) {
        if (e.statusCode) throw e;
        console.error("Bot Ask Error:", e);
        return { error: 'Bot service failed', message: 'Internal bot error' };
      }
    },

    'POST /api/bot/message': async (params, body) => {
      try {
        return await handleMessage(params, body);
      } catch (e) {
        if (e.statusCode) throw e;
        console.error("Bot Message Error:", e);
        return { error: 'Failed to save message' };
      }
    },

    'GET /api/admin/bot-messages': (params, body, req) => {
      try {
        return handleAdminMessages(params, body, req);
      } catch (e) {
        if (e.statusCode) throw e;
        console.error("Admin Messages Error:", e);
        return { error: 'Failed to fetch messages' };
      }
    },
  };
  Object.defineProperty(publicApi, '__test__', {
    value: { fetchGlobalContext, buildSystemPrompt },
    enumerable: false,
  });
  return publicApi;
};
