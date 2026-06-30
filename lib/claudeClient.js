'use strict';

/**
 * Claude 统一客户端 — 替代旧的 geminiClient。
 *
 * 两个用途:
 *   1. analyzePostMatch(aiPromptContext)  赛后复盘归因(批处理,质量优先 → Sonnet 4.6)
 *   2. chat(messages, systemPrompt)        AI 问答 Bot(高频,低成本 → Haiku 4.5)
 *
 * 环境变量统一为 ANTHROPIC_API_KEY(由 lib/env.js 的 loadEnv 注入 process.env)。
 * 无 key 时抛出清晰错误,由调用方决定兜底(批处理直接失败 / bot 返回体验文案)。
 */

// SDK 在 CommonJS 下的默认导出兼容处理
const AnthropicPkg = require('@anthropic-ai/sdk');
const Anthropic = AnthropicPkg.default || AnthropicPkg;

// 模型 ID 默认 Anthropic 官方;通过环境变量切换到 OpenAI/DeepSeek 兼容端点时一并覆盖。
// 复盘归因:Chain-of-Thought + 结构化 JSON,质量优先
// 若只配置了 DEEPSEEK_API_KEY（无 ANTHROPIC_API_KEY），自动切换到 DeepSeek 模型
const POSTMORTEM_MODEL = process.env.CLAUDE_POSTMORTEM_MODEL ||
  (!process.env.ANTHROPIC_API_KEY && process.env.DEEPSEEK_API_KEY ? 'deepseek-v4-pro' : 'claude-sonnet-4-6');
// Bot 问答固定使用 DeepSeek，不走其他 provider 或模型 fallback。
const CHAT_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_CHAT_BASE_URL = 'https://api.deepseek.com/anthropic';

let _client = null;
let _chatClient = null;

/**
 * 惰性构造单例客户端。
 *
 * Provider 切换:`@anthropic-ai/sdk` 接受 baseURL 覆盖,可指向任何 Anthropic 兼容端点。
 *   - 默认:Anthropic 官方(api.anthropic.com)
 *   - DeepSeek:ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
 *               ANTHROPIC_API_KEY=<DeepSeek key>
 *               CLAUDE_POSTMORTEM_MODEL=deepseek-v4-pro
 *   - Bot:      ANTHROPIC_API_KEY=<DeepSeek key>
 *               model 固定为 deepseek-v4-flash
 *
 * @throws {Error} 当 ANTHROPIC_API_KEY 未设置
 */
function buildClient(apiKey, baseURL) {
  const opts = { apiKey };
  if (baseURL) opts.baseURL = baseURL;
  return new Anthropic(opts);
}

function getClient() {
  if (_client) return _client;
  // 优先 ANTHROPIC_API_KEY（Anthropic 官方）；若未设则尝试 DEEPSEEK_API_KEY（需同时设 ANTHROPIC_BASE_URL）
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or DEEPSEEK_API_KEY environment variable is not set');
  }
  const baseURL = process.env.ANTHROPIC_BASE_URL ||
    (process.env.DEEPSEEK_API_KEY && !process.env.ANTHROPIC_API_KEY ? DEEPSEEK_CHAT_BASE_URL : undefined);
  _client = buildClient(apiKey, baseURL);
  return _client;
}

function getChatClient() {
  if (_chatClient) return _chatClient;
  // DeepSeek 端点用专属 key；回退到 ANTHROPIC_API_KEY 以兼容旧配置
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY (or ANTHROPIC_API_KEY) environment variable is not set');
  }
  _chatClient = buildClient(apiKey, DEEPSEEK_CHAT_BASE_URL);
  return _chatClient;
}

/**
 * DeepSeek 的 Anthropic 兼容端点支持 thinking / output_config；官方 Anthropic
 * 对这两个字段的约束不同，因此绝不能把它们发到非 DeepSeek 端点。
 * 按 baseURL 判断,以支持复盘/问答使用不同 provider。
 */
function isDeepSeekBase(baseURL) {
  if (!baseURL) return false;
  try {
    return new URL(baseURL).hostname === 'api.deepseek.com';
  } catch { console.debug('claudeClient: JSON parse failed, attempting loose extraction'); console.debug('claudeClient: invalid baseURL for DeepSeek check');
    return false;
  }
}

/**
 * DeepSeek 在 2026-07-24 弃用 deepseek-chat / deepseek-reasoner 两个模型别名。
 * v4 模型的思考状态改由请求参数控制。复盘默认启用高强度思考，Bot 默认关闭，
 * 以保持原来的质量/成本分工；仅当端点确认为 DeepSeek 时添加这些专有字段。
 */
function deepSeekThinkingOptions(enabled, baseURL, effort = 'high') {
  if (!isDeepSeekBase(baseURL)) return {};
  if (!enabled) return { thinking: { type: 'disabled' } };
  return {
    thinking: { type: 'enabled' },
    output_config: { effort },
  };
}

/**
 * 从 Claude 响应中提取首个 text 块的文本。
 * 启用思考时 content 里可能先有 thinking 块,这里只取 text。
 */
function extractText(message) {
  if (!message || !Array.isArray(message.content)) return '';
  for (const block of message.content) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      return block.text;
    }
  }
  return '';
}

/**
 * 健壮 JSON 解析:剥离 ```json 代码围栏,截取首个 { 到末尾 } 之间的内容再解析。
 * @returns {object|null}
 */
function parseJsonLoose(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();

  // 剥离 markdown 代码围栏
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();

  // 直接解析
  try {
    return JSON.parse(s);
  } catch {
    // 截取首个 { 到最后一个 } 再试一次(去掉模型可能附带的前后说明文字)
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch { console.debug('claudeClient: loose JSON extraction also failed');
        return null;
      }
    }
    return null;
  }
}

/**
 * 由 postMatchReview.buildPostMatchReview() 产出的 aiPromptContext 构造 prompt。
 * aiPromptContext 含:instruction / match / prediction / evidence / requiredOutputFormat
 */
function buildPostmortemPrompt(ctx) {
  const outputFormat = ctx.requiredOutputFormat;
  return `${ctx.instruction}

MATCH DETAILS:
${JSON.stringify(ctx.match, null, 2)}

PREDICTION:
${JSON.stringify(ctx.prediction, null, 2)}

EVIDENCE (Events, News, Commentary):
${JSON.stringify(ctx.evidence, null, 2)}

OUTPUT FORMAT:
You must return a single valid JSON object that exactly matches this schema. Do NOT wrap it in markdown code fences (no \`\`\`json). Output ONLY the raw JSON object, nothing before or after it.
Schema:
${JSON.stringify(outputFormat, null, 2)}`;
}

/**
 * 赛后复盘归因。接收 postMatchReview 已构建的 aiPromptContext,返回解析后的 JSON。
 * @param {object} aiPromptContext - 含 instruction/match/prediction/evidence/requiredOutputFormat
 * @returns {Promise<object>} AI 生成的复盘对象(含 failureCategory / lessonsLearned 等)
 * @throws {Error} key 未设置、API 失败、或两次都无法解析为 JSON
 */
/**
 * 用指定客户端跑一次复盘(含一次纠正性 JSON 重试)。失败抛错由上层决定回落。
 */
async function runPostmortem(client, model, baseURL, prompt) {
  const system =
    'You are an AI Postmortem Assessor for football (soccer) match predictions. ' +
    'You reason carefully and return strictly valid JSON.';
  const messages = [{ role: 'user', content: prompt }];

  const first = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages,
    ...deepSeekThinkingOptions(true, baseURL),
  });
  const firstText = extractText(first);
  let parsed = parseJsonLoose(firstText);
  if (parsed) return parsed;

  // 一次纠正性重试:把上一次输出回传,要求只输出 JSON
  const retry = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    ...deepSeekThinkingOptions(true, baseURL),
    messages: [
      ...messages,
      { role: 'assistant', content: firstText || '(no output)' },
      {
        role: 'user',
        content:
          'Your previous response was not valid JSON. Return ONLY the raw JSON object that matches the required schema — no explanation, no markdown fences.',
      },
    ],
  });
  parsed = parseJsonLoose(extractText(retry));
  if (parsed) return parsed;

  throw new Error('postmortem response was not valid JSON after one retry');
}

async function analyzePostMatch(aiPromptContext) {
  if (!aiPromptContext || !aiPromptContext.requiredOutputFormat) {
    throw new Error('analyzePostMatch: invalid aiPromptContext (missing requiredOutputFormat)');
  }
  const prompt = buildPostmortemPrompt(aiPromptContext);

  // 复盘与 Bot 共用同一个 DeepSeek key/provider，不切换 provider。
  return runPostmortem(getClient(), POSTMORTEM_MODEL, process.env.ANTHROPIC_BASE_URL, prompt);
}

/**
 * AI 问答对话。供 bot 路由使用。
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @param {string} [systemPrompt]
 * @returns {Promise<string>} 模型回复文本
 * @throws {Error} key 未设置或 API 失败(由调用方兜底)
 */
async function chat(messages, systemPrompt) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('chat: messages must be a non-empty array');
  }
  const client = getChatClient();
  const res = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...deepSeekThinkingOptions(false, DEEPSEEK_CHAT_BASE_URL),
    messages,
  });
  return extractText(res);
}

/**
 * 是否已配置 API key(供调用方在不触发异常的情况下判断是否降级)。
 */
function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY);
}

function isChatConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY);
}

module.exports = {
  analyzePostMatch,
  chat,
  isConfigured,
  isChatConfigured,
  POSTMORTEM_MODEL,
  CHAT_MODEL,
};
