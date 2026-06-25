/**
 * AI 智能反馈与问答路由
 * /api/bot/*
 */
const { db: dbInstance } = require('../db');
const { constantTimeEqual } = require('../security');

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

function buildSystemPrompt(lang, matchContextStr) {
  if (lang === 'en') {
    return `You are the PitchSignal match analysis assistant. Answer user questions about World Cup predictions, data sources, Elo ratings, and Poisson goal models.
If the user reports an interface or data issue, thank them and say it has been recorded.
Reply in English. Keep the answer professional, objective, and concise.
Current page context: ${matchContextStr || 'none'}`;
  }

  return `你是 PitchSignal 的智能分析助理。你的任务是回答用户关于世界杯赛事预测、数据模型（Elo评分、Poisson分布模型）的疑问。
如果用户反馈界面或数据错误，感谢他们并表示记录在案。
请用中文回答，保持专业、客观且简洁。
当前页面上下文信息：${matchContextStr || '无'}`;
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
  // 注入依赖（如果有需要，可获取全局缓存或配置）
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
      // Rate-limit unauthenticated demo requests to prevent abuse
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
    const matchContextStr = context ? JSON.stringify({ ...context, detectedLanguage: lang }) : null;

    let aiResponseText = '';

    if (isDemoMode || !process.env.TRANSLATE_API_URL || !process.env.TRANSLATE_API_KEY) {
      aiResponseText = localizedFallback(userQuery, lang);
    } else {
      const apiUrl = process.env.TRANSLATE_API_URL;
      const apiKey = process.env.TRANSLATE_API_KEY;
      const modelName = process.env.TRANSLATE_MODEL || 'gpt-3.5-turbo';
      const systemPrompt = {
        role: 'system',
        content: buildSystemPrompt(lang, matchContextStr)
      };

      const payload = {
        model: modelName,
        messages: [systemPrompt, ...messages],
        temperature: 0.7,
        max_tokens: 500
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM API request failed: ${response.status} ${errText}`);
      }

      const data = await response.json();
      aiResponseText = data.choices?.[0]?.message?.content || localizedFallback(userQuery, lang);
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
