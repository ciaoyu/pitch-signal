/**
 * AI Feedback and Q&A routes
 * /api/bot/*
 * Track 4: Integrated KB + matchId real match data injection + DeepSeek chat
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
} catch (_) { /* Return explicit error on request if config error */ }

function detectLanguage(text = '', context = {}) {
  const value = String(text || '');
  const cjkCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (value.match(/[A-Za-z]/g) || []).length;

  // The question language wins over the UI language. CJK characters carry more
  // information per character, hence the 2x weighting for mixed team names.
  if (cjkCount > 0 && cjkCount * 2 >= latinCount) return 'zh';
  if (latinCount > 0) return 'en';

  const requested = String(context.uiLang || context.language || '').toLowerCase();
  if (requested === 'zh' || requested === 'en') return requested;
  return 'zh';
}

function localFallback(userQuery, lang) {
  const q = String(userQuery || '').toLowerCase();
  if (/预测|概率|model|prediction|probability|forecast/.test(q)) {
    return lang === 'en'
      ? 'The forecast combines long-term Elo strength with a Poisson goal model. It is for analysis only and is not betting advice.'
      : '预测基于 Elo 长期实力评分与 Poisson 进球分布，结果仅供分析参考，不构成投注建议。';
  }
  return lang === 'en'
    ? 'I am the PitchSignal match analysis assistant. I can explain forecasts, data sources, standings, and match details.'
    : '我是 PitchSignal 比赛分析助理，可以解释预测、数据来源、积分榜和比赛详情。';
}

function buildSystemPrompt(lang, kbContext, matchContextStr, globalCtxStr) {
  const kbBlock = kbContext
    ? (lang === 'en'
      ? `## Internal Knowledge Base (conceptual reference only)\n${kbContext}\n\nThe knowledge base can contain older match reports. Use it for concepts, but never treat it as the latest tournament state. The current match context below is authoritative.\n`
      : `## 内部知识库（仅作概念参考）\n${kbContext}\n\n知识库可能包含较早的比赛回顾，只用于解释概念，不得当作最新赛况；下方当前比赛上下文优先级最高。\n`)
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
- Answer only in English; do not append a Chinese translation
- Be professional, objective, and concise (2-4 paragraphs max)
- Use current match context first for match-specific questions, including the stage and both teams' tournament journeys
- When match data is provided, always relate your conceptual explanation to the actual match
- If the user reports a bug or data error, thank them and say it has been recorded
- Never provide betting advice`;
  }

  return `你是 PitchSignal 的智能分析助理。你的任务是回答用户关于世界杯赛事预测、数据模型（Elo评分、Poisson分布模型）、对位分析、场馆/天气因素等问题。
${kbBlock}
${globalBlock}
当前页面 / 比赛上下文信息：${matchContextStr || '无'}

规则：
- 只用中文回答，不附英文翻译
- 保持专业、客观、简洁（2-4 段即可）
- 比赛类问题优先使用当前比赛上下文，包括赛事阶段和两队本届赛事晋级路径
- 当提供了比赛数据时，务必结合比赛实际情况做分析
- 用户反馈 bug 或数据错误时，感谢并告知已记录
- 绝不提供投注建议`;
}

function compactValue(value, depth = 0) {
  if (value === null || value === undefined || depth > 6) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 8).map(item => compactValue(item, depth + 1));

  const omitted = new Set(['matchSources', 'raw', 'commentary', 'timeline', 'moments']);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (omitted.has(key)) continue;
    result[key] = compactValue(item, depth + 1);
  }
  return result;
}

function normalizeJourney(payload) {
  return (payload?.matches || [])
    .filter(match => match?.state === 'post' || match?.state === 'in' || match?.state === 'pre')
    .map(match => ({
      matchId: String(match.matchId || ''),
      date: match.date || match.dateBJT || '',
      stage: match.stage || '',
      state: match.state || '',
      home: match.homeTeam?.name || match.homeTeam?.abbreviation || '',
      away: match.awayTeam?.name || match.awayTeam?.abbreviation || '',
      score: match.score || null,
      result: match.result || null,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function compactRecentStats(payload) {
  if (!payload || payload.error) return null;
  const priority = /goal|shot|possession|corner|foul|yellow|red|save|pass|expected|xg/i;
  const stats = Object.fromEntries(
    Object.entries(payload.stats || {})
      .filter(([key]) => priority.test(key))
      .slice(0, 20)
  );
  return {
    completedMatches: payload.matches || 0,
    matchIds: (payload.matchIds || []).slice(0, 10),
    averages: stats,
    source: payload.source || '',
  };
}

function compactLineups(payload) {
  if (!payload || payload.error) return null;
  const playerNames = list => (list || []).slice(0, 11).map(player => player?.nameZh || player?.name || player?.playerName || '').filter(Boolean);
  return {
    homeFormation: payload.homeFormation || null,
    awayFormation: payload.awayFormation || null,
    homeXI: playerNames(payload.homeXI),
    awayXI: playerNames(payload.awayXI),
    source: payload.source || payload.homeFormationSource || null,
  };
}

function shouldLoadGlobalContext(userQuery, matchId) {
  if (!matchId) return true;
  return /积分榜|小组排名|出线|qualification|standings|group table/i.test(String(userQuery || ''));
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
   * P2-6: Global context — qualification probability + standings, always injected (30min cache)
   */
  async function fetchGlobalContext({ getCached, setCache }) {
    const cacheKey = 'bot_global_ctx';
    const cached = getCached ? getCached(cacheKey, 1800000) : null;
    if (cached) return cached;

    const globalCtx = { qualification: null, standings: null };

    // Qualification probabilities
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

    // Prefer real online data source for standings; group_standings may not be persisted.
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

    // DB fallback only for compatibility with old environments.
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
   * When context contains matchId, fetch real match data in background and inject into system prompt
   */
  async function fetchMatchContext(matchId, { getCached, setCache }) {
    if (!matchId) return null;
    const cacheKey = `bot_match_ctx_${matchId}`;
    const cached = getCached ? getCached(cacheKey, 60000) : null;
    if (cached) return cached;

    const ctx = {};
    let matchRes = null;
    let homeId = null;
    let awayId = null;
    try {
      // Fetch basic match info
      matchRes = await deps.routes?.['GET /api/match/:id']?.({ id: matchId }) || {};
      if (!matchRes.error) {
        homeId = matchRes.home?.id || null;
        awayId = matchRes.away?.id || null;
        ctx.match = {
          id: String(matchId),
          home: matchRes.home?.name || matchRes.home,
          away: matchRes.away?.name || matchRes.away,
          score: { home: matchRes.home?.score ?? '', away: matchRes.away?.score ?? '' },
          status: matchRes.state,
          date: matchRes.date || '',
          venue: matchRes.venue || '',
        };
      }
    } catch (_) { console.debug('bot: match context fetch skipped for', matchId); }

    const routeCall = async (route, params) => {
      try { return await deps.routes?.[route]?.(params) || null; }
      catch (_) { return null; }
    };
    const [spatialRes, predRes, homeJourneyRes, awayJourneyRes, homeStatsRes, awayStatsRes, lineupsRes] = await Promise.all([
      homeId && awayId ? routeCall('GET /api/matchup-spatial/:home/:away', { home: homeId, away: awayId }) : null,
      routeCall('GET /api/predict/:matchId', { matchId }),
      homeId ? routeCall('GET /api/team/:id/recent-matches', { id: homeId }) : null,
      awayId ? routeCall('GET /api/team/:id/recent-matches', { id: awayId }) : null,
      homeId ? routeCall('GET /api/team/:id/recent-stats', { id: homeId }) : null,
      awayId ? routeCall('GET /api/team/:id/recent-stats', { id: awayId }) : null,
      routeCall('GET /api/match/:id/lineups', { id: matchId }),
    ]);

    if (spatialRes && !spatialRes.error && spatialRes.summary) {
      ctx.spatial = {
        summary: spatialRes.summary,
        pairs: (spatialRes.pairs || []).filter(p => p.key).map(p => ({
          home: p.home?.name, away: p.away?.name,
          advantage: p.advantage, diff: p.diff,
        })).slice(0, 5),
      };
    }

    if (predRes && !predRes.error) {
      ctx.prediction = {
        homeWin: predRes.homeWin, draw: predRes.draw, awayWin: predRes.awayWin,
        expectedScore: predRes.expectedScore,
        poissonModeScore: predRes.poissonModeScore,
        venueFactor: predRes.venueFactor?.applied ? predRes.venueFactor : null,
      };
      if (predRes.knockoutIntel) ctx.knockoutIntel = compactValue(predRes.knockoutIntel);
    }

    const homeJourney = normalizeJourney(homeJourneyRes);
    const awayJourney = normalizeJourney(awayJourneyRes);
    if (homeJourney.length || awayJourney.length) {
      ctx.tournamentJourney = { home: homeJourney, away: awayJourney };
      const current = [...homeJourney, ...awayJourney].find(item => item.matchId === String(matchId));
      if (current?.stage && ctx.match) ctx.match.stage = current.stage;
    }

    const homeStats = compactRecentStats(homeStatsRes);
    const awayStats = compactRecentStats(awayStatsRes);
    if (homeStats || awayStats) ctx.tournamentStats = { home: homeStats, away: awayStats };

    const lineups = compactLineups(lineupsRes);
    if (lineups) ctx.currentLineups = lineups;

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

    // KB search
    const kbResult = botKB.search(userQuery, lang);
    // Static match-day reports currently trail the live tournament. For a known
    // fixture, rely on the live journey/stats context and retain only conceptual KB hits.
    const kbSections = matchId
      ? kbResult.sections.filter(section => section.source !== 'MATCH_DAY_REPORTS')
      : kbResult.sections;
    const kbContext = botKB.buildContextText(kbSections, lang);

    // Group tables are useful globally, but they are noise for a known knockout
    // fixture unless the user explicitly asks about qualification or standings.
    const globalCtx = shouldLoadGlobalContext(userQuery, matchId)
      ? await fetchGlobalContext(deps)
      : null;
    let globalCtxStr = '';
    if (globalCtx) {
      const parts = [];
      if (globalCtx.qualification) {
        parts.push((lang === 'en' ? '## Qualification probabilities\n' : '## 全部球队出线概率\n') + JSON.stringify(globalCtx.qualification, null, 1));
      }
      if (globalCtx.standings) {
        parts.push((lang === 'en' ? '## Group standings\n' : '## 小组积分榜\n') + JSON.stringify(globalCtx.standings, null, 1));
      }
      if (parts.length > 0) globalCtxStr = parts.join('\n\n');
    }

    // Match real data context
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
      aiResponseText = localFallback(userQuery, lang);
      source = 'local-fallback';
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
        aiResponseText = localFallback(userQuery, lang);
        source = 'local-fallback';
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
      // Safety fallback: reject access when no token configured
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
    value: { fetchGlobalContext, fetchMatchContext, buildSystemPrompt, detectLanguage, localFallback, shouldLoadGlobalContext },
    enumerable: false,
  });
  return publicApi;
};
