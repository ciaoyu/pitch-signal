/**
 * AI 智能反馈与问答路由
 * /api/bot/*
 * Track 4: 集成知识库 + matchId 真实比赛数据注入 + claudeClient.chat(Haiku)
 */
const { db: dbInstance } = require('../db');
const { constantTimeEqual } = require('../security');
const botKB = require('../botKnowledgeBase');
let claudeClient = null;
try {
  claudeClient = require('../claudeClient');
} catch (_) { /* 无 ANTHROPIC_API_KEY 时回退到 localizedFallback */ }

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

function localizedFallback(userQuery, lang) {
  const q = String(userQuery || '').toLowerCase();
  const isEn = lang === 'en';

  if (/预测|概率|model|prediction|probability|odds|forecast/.test(q)) {
    return isEn
      ? 'Our forecast is based on Elo ratings and a Poisson goal-expectation model. Elo reflects long-term team strength and updates over time. The probabilities are experimental and are not betting advice.'
      : '我们的预测基于 Elo 评分系统与 Poisson 进球预期模型。Elo 评分反映球队长期实力，通过每场比赛动态更新。预测结果仅供参考，不构成投注建议。';
  }

  if (/错误|问题|bug|反馈|wrong|issue|problem|feedback|error/.test(q)) {
    return isEn
      ? 'Thanks for the feedback. I have recorded the issue, and we will keep improving data accuracy and the interface.'
      : '感谢您的反馈！我已记录您报告的问题。我们会持续改进数据准确性与界面体验。';
  }

  if (/数据|排名|积分|source|data|ranking|table|standings/.test(q)) {
    return isEn
      ? 'Team data comes from ESPN live feeds plus our Elo calculations. Rankings are based on the current Elo ratings and update as match results are processed.'
      : '球队数据来自 ESPN 实时信息与 Elo 评分计算。排名基于当前 Elo 评分，会随比赛结果动态更新。';
  }

  return isEn
    ? 'Hi, I am the match analysis assistant. I can answer questions about the prediction model, data sources, and rankings, and you can also report data or interface issues here.'
    : '您好！我是赛事分析助理。我可以解答关于预测模型、数据来源、排名计算的问题，也欢迎您反馈任何数据或界面错误。';
}

function buildSystemPrompt(lang, kbContext, matchContextStr) {
  const kbBlock = kbContext
    ? (lang === 'en'
      ? `## Internal Knowledge Base (use this for factual explanations)\n${kbContext}\n\nAnswer the user's question by FIRST explaining the relevant concept from the knowledge base above, THEN incorporating any match-specific data provided below. If the knowledge base does not cover a topic, use your general football expertise.\n`
      : `## 内部知识库（请基于此回答）\n${kbContext}\n\n先基于上述知识库解释核心概念，再结合下方比赛数据做具体分析。如知识库未涵盖该问题，可使用通用足球知识。\n`)
    : '';

  if (lang === 'en') {
    return `You are the PitchSignal match analysis assistant. Answer user questions about World Cup predictions, data models (Elo ratings, Poisson distribution), matchup analysis, and venue/weather factors.
${kbBlock}
Current page / match context: ${matchContextStr || 'none'}

Rules:
- Answer in the user's language
- Be professional, objective, and concise (2-4 paragraphs max)
- When match data is provided, always relate your conceptual explanation to the actual match
- If the user reports a bug or data error, thank them and say it has been recorded
- Never provide betting advice`;
  }

  return `你是 PitchSignal 的智能分析助理。你的任务是回答用户关于世界杯赛事预测、数据模型（Elo评分、Poisson分布模型）、对位分析、场馆/天气因素等问题。
${kbBlock}
当前页面 / 比赛上下文信息：${matchContextStr || '无'}

规则：
- 用中文回答
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

    if (expected) {
      if (authHeader.startsWith('Bearer ') && constantTimeEqual(authHeader.slice(7).trim(), expected)) {
        // authorized
      } else if (constantTimeEqual(token, expected)) {
        // authorized
      } else {
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        throw err;
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        const err = new Error('Token required in production');
        err.statusCode = 401;
        throw err;
      }
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

    // 优先走 Claude (Haiku)
    if (!isDemoMode && claudeClient && claudeClient.isConfigured()) {
      try {
        const systemPrompt = buildSystemPrompt(lang, kbContext, matchContextStr);
        const chatMessages = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
        }));
        aiResponseText = await claudeClient.chat(chatMessages, systemPrompt);
        source = 'claude-haiku';
      } catch (e) {
        console.warn('Claude chat failed, falling back:', e.message);
        aiResponseText = localizedFallback(userQuery, lang);
        source = 'fallback';
      }
    } else {
      // 知识库兜底文案（带真实数据时给更精准的体验回复）
      if (kbResult.sections.length > 0) {
        const titles = kbResult.sections.map(s => s.title).join('、');
        const hasMatchData = matchId && matchContextStr && matchContextStr.length > 20;
        if (lang === 'en') {
          aiResponseText = hasMatchData
            ? `I found relevant information about "${titles}" in our knowledge base. Here's how it applies to this match:\n\nMatch data loaded. Let me analyze…\n\n(Full AI analysis requires Anthropic API key configured. The match data has been loaded and is ready for analysis.)`
            : `I found relevant information about "${titles}" in our knowledge base. Here's a summary:\n\n${kbResult.sections[0].content.slice(0, 400)}\n\n(Full AI analysis requires Anthropic API key configured.)`;
        } else {
          aiResponseText = hasMatchData
            ? `我在知识库中找到了关于「${titles}」的相关资料。当前比赛数据已加载，可以结合具体数据做分析。\n\n（需要配置 Anthropic API Key 以启用完整 AI 分析。当前已加载比赛上下文数据。）`
            : `我在知识库中找到了关于「${titles}」的相关资料：\n\n${kbResult.sections[0].content.slice(0, 400)}\n\n（需要配置 Anthropic API Key 以启用完整 AI 分析。）`;
        }
        source = 'kb-fallback';
      } else {
        aiResponseText = localizedFallback(userQuery, lang);
        source = 'fallback';
      }
    }

    try {
      dbInstance.prepare(`
        INSERT INTO user_feedback (user_query, ai_response, match_context, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(userQuery, aiResponseText, matchContextStr);
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
      dbInstance.prepare(`
        INSERT INTO user_feedback (user_query, ai_response, match_context, type, page_url, created_at)
        VALUES (?, ?, ?, 'message', ?, datetime('now'))
      `).run(content, '[留言已收录]', contextStr, pageUrl || null);
    } catch (dbErr) {
      console.error('Failed to save bot message:', dbErr.message);
    }

    return { response: ack, status: 'saved' };
  }

  function handleAdminMessages(params, body, req) {
    const expected = process.env.ADMIN_TOKEN || process.env.WRITE_API_TOKEN || '';
    if (expected) {
      const token = req?.headers?.['x-admin-token'] || params?.token || '';
      const authHeader = req?.headers?.authorization || '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!constantTimeEqual(token, expected) && !constantTimeEqual(bearer, expected)) {
        const err = new Error('Unauthorized'); err.statusCode = 401; throw err;
      }
    }

    const type = params?.type || 'all';
    const limit = Math.min(parseInt(params?.limit || '100', 10), 500);
    const offset = parseInt(params?.offset || '0', 10);

    const typeFilter = type === 'all' ? '' : `WHERE type = '${type === 'message' ? 'message' : 'question'}'`;

    const rows = dbInstance.prepare(`
      SELECT id, type, user_query, ai_response, match_context, page_url, created_at
      FROM user_feedback
      ${typeFilter}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const stats = dbInstance.prepare(`
      SELECT type, COUNT(*) as count FROM user_feedback GROUP BY type
    `).all();

    return { rows, stats, total: rows.length, limit, offset };
  }

  return {
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
};
