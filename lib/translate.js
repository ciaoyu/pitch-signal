/**
 * Lightweight translation pipeline for PitchSignal
 * Generates zh i18n fields for real (Tavily) English news.
 *
 * Priority: LLM (if configured) > rule-based template > raw English passthrough
 * All translations are tagged with translatedBy + translatedAt for transparency.
 */

const { createHash } = require('crypto');

// ── Team name registry (loaded lazily) ──────────────────
let _teamMap = null; // Map<"lowercase english" => {zh, en, id}>

function loadTeamMap(teamNamesZh) {
  if (_teamMap) return _teamMap;
  _teamMap = new Map();
  if (!teamNamesZh || typeof teamNamesZh !== 'object') return _teamMap;
  for (const [id, names] of Object.entries(teamNamesZh)) {
    if (names?.en) _teamMap.set(names.en.toLowerCase(), { zh: names.zh, en: names.en, id });
  }
  return _teamMap;
}

// ── Source hostname i18n ─────────────────────────────────
const SOURCE_I18N = {
  'espn.com': { zh: 'ESPN体育', en: 'ESPN' },
  'espnfc.com': { zh: 'ESPN足球', en: 'ESPN FC' },
  'bbc.co.uk': { zh: 'BBC体育', en: 'BBC Sport' },
  'bbc.com': { zh: 'BBC体育', en: 'BBC Sport' },
  'skysports.com': { zh: '天空体育', en: 'Sky Sports' },
  'goal.com': { zh: 'Goal足球网', en: 'Goal.com' },
  'theguardian.com': { zh: '卫报', en: 'The Guardian' },
  'reuters.com': { zh: '路透社', en: 'Reuters' },
  'apnews.com': { zh: '美联社', en: 'AP News' },
  'cnn.com': { zh: 'CNN', en: 'CNN' },
  'nytimes.com': { zh: '纽约时报', en: 'NY Times' },
  'foxsports.com': { zh: '福克斯体育', en: 'Fox Sports' },
  'cbssports.com': { zh: 'CBS体育', en: 'CBS Sports' },
  'theathletic.com': { zh: 'The Athletic', en: 'The Athletic' },
  'marca.com': { zh: '马卡报', en: 'Marca' },
  'as.com': { zh: '阿斯报', en: 'AS' },
  'sport.es': { zh: '世界体育报', en: 'Sport' },
  'mundodeportivo.com': { zh: '世界体育报', en: 'Mundo Deportivo' },
  'kicker.de': { zh: '踢球者', en: 'Kicker' },
  'bild.de': { zh: '图片报', en: 'Bild' },
  'gazzetta.it': { zh: '米兰体育报', en: 'Gazzetta' },
  'corriere.it': { zh: '晚邮报', en: 'Corriere' },
  'sofascore.com': { zh: 'SofaScore', en: 'SofaScore' },
  'flashscore.com': { zh: 'FlashScore', en: 'FlashScore' },
  'transfermarkt.com': { zh: '转会市场', en: 'Transfermarkt' },
};

// ── Football keyword dictionaries ────────────────────────
const KEYWORD_MAP = {
  // Match events
  'injury': '伤病', 'injured': '受伤', 'hurt': '受伤', 'fitness': '身体状况',
  'suspended': '停赛', 'suspension': '停赛', 'ban': '禁赛', 'red card': '红牌',
  'yellow card': '黄牌', 'goal': '进球', 'score': '比分', 'draw': '平局',
  'win': '胜利', 'victory': '胜利', 'defeat': '失利', 'loss': '失利',
  'clean sheet': '零封', 'hat-trick': '帽子戏法', 'penalty': '点球',
  'free kick': '任意球', 'corner': '角球', 'offside': '越位',

  // Team/status
  'lineup': '首发阵容', 'starting xi': '首发阵容', 'squad': '阵容',
  'formation': '阵型', 'tactics': '战术', 'strategy': '策略',
  'coach': '主教练', 'manager': '主教练', 'press conference': '新闻发布会',
  'transfer': '转会', 'signing': '签约', 'contract': '合同',
  'preview': '前瞻', 'analysis': '分析', 'report': '报道',
  'training': '训练', 'practice': '训练',
  'world cup': '世界杯', 'group stage': '小组赛', 'knockout': '淘汰赛',
  'round of 16': '十六强', 'quarter-final': '四分之一决赛',
  'semi-final': '半决赛', 'final': '决赛',
  'qualifying': '预选赛', 'qualifiers': '预选赛',

  // Time/condition
  'doubtful': '出战成疑', 'questionable': '出战成疑', 'out': '缺席',
  'confirmed': '确认', 'expected': '预计', 'likely': '可能',
  'return': '回归', 'comeback': '复出', 'recover': '恢复',
  'key player': '主力球员', 'star': '球星', 'captain': '队长',
};

// ── Rule-based translation ───────────────────────────────

/**
 * Replace known team English names with Chinese names in text.
 * Longest match first to avoid partial replacements.
 */
function replaceTeamNames(text, teamMap, homeI18n, awayI18n) {
  if (!text) return text;

  // Priority: explicitly passed i18n names first, then registry
  const replacements = [];
  if (homeI18n?.zh && homeI18n?.en) {
    replacements.push({ en: homeI18n.en, zh: homeI18n.zh });
  }
  if (awayI18n?.zh && awayI18n?.en) {
    replacements.push({ en: awayI18n.en, zh: awayI18n.zh });
  }

  // Add all team map entries (sorted longest first for greedy match)
  if (teamMap?.size) {
    const entries = [...teamMap.values()].sort((a, b) => b.en.length - a.en.length);
    for (const t of entries) {
      if (!replacements.some(r => r.en.toLowerCase() === t.en.toLowerCase())) {
        replacements.push({ en: t.en, zh: t.zh });
      }
    }
  }

  let result = text;
  for (const { en, zh } of replacements) {
    // Case-insensitive replacement
    const regex = new RegExp(`\\b${escapeRegex(en)}\\b`, 'gi');
    result = result.replace(regex, zh);
  }
  return result;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace known football keywords in text.
 */
function replaceKeywords(text) {
  if (!text) return text;
  let result = text;
  // Sort longest first
  const sorted = Object.entries(KEYWORD_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [en, zh] of sorted) {
    const regex = new RegExp(`\\b${escapeRegex(en)}\\b`, 'gi');
    result = regex.test(result) ? result.replace(regex, zh) : result;
  }
  return result;
}

/**
 * Generate a Chinese source name from URL hostname.
 */
function translateSource(url, hostname) {
  const host = (hostname || '').toLowerCase().replace(/^www\./, '');
  // Direct lookup
  for (const [domain, names] of Object.entries(SOURCE_I18N)) {
    if (host === domain || host.endsWith('.' + domain)) {
      return names;
    }
  }
  // Fallback: use hostname as-is for both
  const display = host || 'unknown';
  return { zh: display, en: display };
}

/**
 * Rule-based zh generation for a news item.
 * Returns { titleI18n, summaryI18n, contentI18n, sourceI18n, translatedBy, translatedAt }
 */
function ruleBasedTranslate(item, teamMap, homeI18n, awayI18n) {
  const now = new Date().toISOString();

  const zhTitle = replaceKeywords(replaceTeamNames(item.title, teamMap, homeI18n, awayI18n));
  const zhSummary = replaceKeywords(replaceTeamNames(item.summary, teamMap, homeI18n, awayI18n));
  const zhContent = replaceKeywords(replaceTeamNames(item.content, teamMap, homeI18n, awayI18n));
  const sourceI18n = translateSource(item.url, item.source);

  return {
    titleI18n: { zh: zhTitle, en: item.title },
    summaryI18n: { zh: zhSummary, en: item.summary },
    contentI18n: { zh: zhContent, en: item.content },
    sourceI18n,
    translatedBy: 'rule-based-template',
    translatedAt: now,
  };
}

// ── LLM translation (optional) ───────────────────────────

/**
 * Call an OpenAI-compatible API to translate news text.
 * Requires TRANSLATE_API_URL and TRANSLATE_API_KEY env vars.
 */
async function llmTranslateText(text, targetLang = 'zh', apiKey, apiUrl, model) {
  if (!text || !apiUrl || !apiKey) return null;

  try {
    const body = {
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional football/soccer news translator. Translate the following text to ${targetLang === 'zh' ? 'Simplified Chinese' : targetLang}. Preserve team names, scores, and factual accuracy. Do not add commentary. Output only the translation.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    };

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * LLM-based zh generation for a news item.
 * Falls back to rule-based if LLM fails.
 */
async function llmBasedTranslate(item, teamMap, homeI18n, awayI18n) {
  const apiUrl = process.env.TRANSLATE_API_URL || '';
  const apiKey = process.env.TRANSLATE_API_KEY || '';
  const model = process.env.TRANSLATE_MODEL || '';

  if (!apiUrl || !apiKey) {
    return ruleBasedTranslate(item, teamMap, homeI18n, awayI18n);
  }

  const now = new Date().toISOString();

  // Translate title and summary in parallel (most important)
  const [zhTitle, zhSummary] = await Promise.all([
    llmTranslateText(item.title, 'zh', apiKey, apiUrl, model),
    llmTranslateText(item.summary, 'zh', apiKey, apiUrl, model),
  ]);

  // Content is optional (expensive)
  let zhContent = null;
  if (item.content && item.content.length < 2000) {
    zhContent = await llmTranslateText(item.content, 'zh', apiKey, apiUrl, model);
  }

  const sourceI18n = translateSource(item.url, item.source);

  // If LLM failed for key fields, fall back to rule-based
  if (!zhTitle && !zhSummary) {
    return ruleBasedTranslate(item, teamMap, homeI18n, awayI18n);
  }

  return {
    titleI18n: { zh: zhTitle || replaceKeywords(replaceTeamNames(item.title, teamMap, homeI18n, awayI18n)), en: item.title },
    summaryI18n: { zh: zhSummary || replaceKeywords(replaceTeamNames(item.summary, teamMap, homeI18n, awayI18n)), en: item.summary },
    contentI18n: { zh: zhContent || replaceKeywords(replaceTeamNames(item.content, teamMap, homeI18n, awayI18n)), en: item.content },
    sourceI18n,
    translatedBy: 'llm-pipeline',
    translatedAt: now,
  };
}

// ── Public API ────────────────────────────────────────────

/**
 * Translate a batch of Tavily news items, adding i18n fields.
 *
 * @param {Array} items - Raw news items from Tavily
 * @param {Object} opts
 * @param {Object} opts.teamNamesZh - team_names_zh.json data
 * @param {Object} opts.homeI18n - {zh, en} for home team
 * @param {Object} opts.awayI18n - {zh, en} for away team
 * @param {boolean} opts.useLLM - if true, try LLM first (needs env vars)
 * @returns {Promise<Array>} - items with i18n fields merged in
 */
async function translateNewsItems(items, opts = {}) {
  if (!items?.length) return items;

  const { teamNamesZh, homeI18n, awayI18n, useLLM = false } = opts;
  const teamMap = loadTeamMap(teamNamesZh);

  const results = [];
  for (const item of items) {
    // Skip items that already have i18n (e.g. mock news)
    if (item.titleI18n) {
      results.push(item);
      continue;
    }

    let enriched;
    if (useLLM) {
      enriched = await llmBasedTranslate(item, teamMap, homeI18n, awayI18n);
    } else {
      enriched = ruleBasedTranslate(item, teamMap, homeI18n, awayI18n);
    }

    results.push({ ...item, ...enriched });
  }

  return results;
}

/**
 * Translate a single search result (for /api/news/search).
 * Lighter version — only title + summary + source.
 */
async function translateSearchResult(item, opts = {}) {
  if (item.titleI18n) return item;

  const { teamNamesZh, useLLM = false } = opts;
  const teamMap = loadTeamMap(teamNamesZh);
  const homeI18n = null;
  const awayI18n = null;

  let enriched;
  if (useLLM) {
    enriched = await llmBasedTranslate(item, teamMap, homeI18n, awayI18n);
  } else {
    enriched = ruleBasedTranslate(item, teamMap, homeI18n, awayI18n);
  }

  return { ...item, ...enriched };
}

module.exports = {
  translateNewsItems,
  translateSearchResult,
  // Exported for testing
  _replaceTeamNames: replaceTeamNames,
  _replaceKeywords: replaceKeywords,
  _translateSource: translateSource,
  _ruleBasedTranslate: ruleBasedTranslate,
};
