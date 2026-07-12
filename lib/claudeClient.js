'use strict';

/**
 * Unified Claude client - replaces old geminiClient.
 *
 * Two use cases:
 *   1. analyzePostMatch(aiPromptContext)  post-match review attribution (batch, quality-first -> Sonnet 4.6)
 *   2. chat(messages, systemPrompt)       AI Q&A Bot (high-frequency, low-cost -> Haiku 4.5)
 *
 * Environment variable unified as ANTHROPIC_API_KEY (injected into process.env by loadEnv in lib/env.js).
 * Throws clear error when key is missing, leaving fallback decision to caller (batch fails directly / bot returns graceful copy).
 */

// Default-export compatibility handling for the SDK under CommonJS
const AnthropicPkg = require('@anthropic-ai/sdk');
const Anthropic = AnthropicPkg.default || AnthropicPkg;

// Model ID defaults to official Anthropic; overridden when switching to OpenAI/DeepSeek compatible endpoints via env vars.
// Postmortem attribution: Chain-of-Thought + structured JSON, quality-first
// If only DEEPSEEK_API_KEY is configured (no ANTHROPIC_API_KEY), automatically switch to DeepSeek model
const POSTMORTEM_MODEL = process.env.CLAUDE_POSTMORTEM_MODEL ||
  (!process.env.ANTHROPIC_API_KEY && process.env.DEEPSEEK_API_KEY ? 'deepseek-v4-pro' : 'claude-sonnet-4-6');
// Bot Q&A strictly uses DeepSeek, no fallback to other providers or models.
const CHAT_MODEL = 'deepseek-v4-flash';
const DEEPSEEK_CHAT_BASE_URL = 'https://api.deepseek.com/anthropic';

let _client = null;
let _chatClient = null;

/**
 * Lazily construct singleton client.
 *
 * Provider switching: `@anthropic-ai/sdk` accepts baseURL override, can point to any Anthropic-compatible endpoint.
 *   - Default: Official Anthropic (api.anthropic.com)
 *   - DeepSeek: ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
 *               ANTHROPIC_API_KEY=<DeepSeek key>
 *               CLAUDE_POSTMORTEM_MODEL=deepseek-v4-pro
 *   - Bot:      ANTHROPIC_API_KEY=<DeepSeek key>
 *               model fixed to deepseek-v4-flash
 *
 * @throws {Error} when ANTHROPIC_API_KEY is not set
 */
function buildClient(apiKey, baseURL) {
  const opts = { apiKey };
  if (baseURL) opts.baseURL = baseURL;
  return new Anthropic(opts);
}

function getClient() {
  if (_client) return _client;
  // Prefer ANTHROPIC_API_KEY (official Anthropic); if unset, try DEEPSEEK_API_KEY (requires ANTHROPIC_BASE_URL to be set)
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
  // DeepSeek endpoint uses dedicated key; falls back to ANTHROPIC_API_KEY for legacy compatibility
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY (or ANTHROPIC_API_KEY) environment variable is not set');
  }
  _chatClient = buildClient(apiKey, DEEPSEEK_CHAT_BASE_URL);
  return _chatClient;
}

/**
 * DeepSeek's Anthropic-compatible endpoint supports thinking / output_config; official Anthropic
 * has different constraints for these fields, so never send them to non-DeepSeek endpoints.
 * Determine by baseURL to support using different providers for postmortem / Q&A.
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
 * DeepSeek deprecated deepseek-chat / deepseek-reasoner model aliases on 2026-07-24.
 * Thinking state for v4 models is controlled by request parameters. Postmortem defaults to high-effort thinking, Bot defaults disabled,
 * maintaining original quality/cost separation; only add these proprietary fields when endpoint is confirmed as DeepSeek.
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
 * Extract text from the first text block in Claude response.
 * When thinking is enabled, content may start with a thinking block; only extract text here.
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
 * Robust JSON parsing: strip ```json code fences, extract content between first { and last } before parsing.
 * @returns {object|null}
 */
function parseJsonLoose(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();

  // Strip markdown code fences
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();

  // Parse directly
  try {
    return JSON.parse(s);
  } catch {
    // Extract from first { to last } and retry (strip surrounding explanation text from model)
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

const POSTMORTEM_TOOL_NAME = 'submit_postmatch_review';
const BILINGUAL_TEXT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['zh', 'en'],
  properties: {
    zh: { type: 'string' },
    en: { type: 'string' },
  },
};
const BILINGUAL_LIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['zh', 'en'],
  properties: {
    zh: { type: 'array', items: { type: 'string' } },
    en: { type: 'array', items: { type: 'string' } },
  },
};
const POSTMORTEM_TOOL = {
  name: POSTMORTEM_TOOL_NAME,
  description: 'Submit the completed bilingual football post-match assessment.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'failureCategory',
      'lessonsLearned',
      'headlineI18n',
      'whyRightI18n',
      'whyWrongI18n',
      'processNotesI18n',
      'expertCommentaryNotes',
    ],
    properties: {
      failureCategory: {
        anyOf: [
          {
            type: 'string',
            enum: [
              'Tactical Mismatch',
              'Missing Injury',
              'Missing Weather',
              'Missing Referee Effect',
              'Missing Tactical Deception',
              'Black Swan',
              'Statistical Variance',
            ],
          },
          { type: 'null' },
        ],
      },
      lessonsLearned: {
        type: 'object',
        additionalProperties: false,
        required: ['teamSpecific', 'globalModel'],
        properties: {
          teamSpecific: {
            type: 'object',
            additionalProperties: BILINGUAL_TEXT_SCHEMA,
          },
          globalModel: BILINGUAL_TEXT_SCHEMA,
        },
      },
      headlineI18n: BILINGUAL_TEXT_SCHEMA,
      whyRightI18n: BILINGUAL_LIST_SCHEMA,
      whyWrongI18n: BILINGUAL_LIST_SCHEMA,
      processNotesI18n: BILINGUAL_LIST_SCHEMA,
      expertCommentaryNotes: { type: 'array', items: { type: 'string' } },
    },
  },
};

function extractPostmortemResult(message) {
  if (!message || !Array.isArray(message.content)) return null;
  const toolBlock = message.content.find(block =>
    block && block.type === 'tool_use' && block.name === POSTMORTEM_TOOL_NAME
  );
  if (toolBlock?.input && typeof toolBlock.input === 'object' && !Array.isArray(toolBlock.input)) {
    return toolBlock.input;
  }
  return parseJsonLoose(extractText(message));
}

function isValidPostmortemResult(result) {
  const bilingualText = value => value
    && typeof value.zh === 'string' && value.zh.trim()
    && typeof value.en === 'string' && value.en.trim();
  const bilingualList = value => value
    && Array.isArray(value.zh)
    && Array.isArray(value.en);
  return Boolean(
    result && typeof result === 'object' && !Array.isArray(result)
    && bilingualText(result.headlineI18n)
    && bilingualList(result.whyRightI18n)
    && bilingualList(result.whyWrongI18n)
    && bilingualList(result.processNotesI18n)
    && result.lessonsLearned && typeof result.lessonsLearned === 'object'
    && result.lessonsLearned.teamSpecific && typeof result.lessonsLearned.teamSpecific === 'object'
    && bilingualText(result.lessonsLearned.globalModel)
    && Array.isArray(result.expertCommentaryNotes)
  );
}

function postmortemResponseMeta(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  return {
    stopReason: message?.stop_reason || null,
    inputTokens: message?.usage?.input_tokens ?? null,
    outputTokens: message?.usage?.output_tokens ?? null,
    blockTypes: content.map(block => block?.type || 'unknown'),
    textChars: extractText(message).length,
    hasPostmortemTool: content.some(block =>
      block && block.type === 'tool_use' && block.name === POSTMORTEM_TOOL_NAME
    ),
  };
}

function postmortemErrorMeta(error) {
  return {
    name: error?.name || null,
    status: error?.status ?? null,
    code: error?.error?.error?.code || error?.error?.code || null,
  };
}

/**
 * Construct prompt from aiPromptContext produced by postMatchReview.buildPostMatchReview().
 * aiPromptContext contains: instruction / match / prediction / evidence / requiredOutputFormat
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

LIVE TIMELINE (structural moments and probability drift):
${JSON.stringify(ctx.liveTimelineI18n || [], null, 2)}

OUTPUT FORMAT:
You must return a single valid JSON object that exactly matches this schema. Do NOT wrap it in markdown code fences (no \`\`\`json). Output ONLY the raw JSON object, nothing before or after it.
Schema:
${JSON.stringify(outputFormat, null, 2)}`;
}

/**
 * Post-match review attribution. Receives aiPromptContext built by postMatchReview, returns parsed JSON.
 * @param {object} aiPromptContext - contains instruction/match/prediction/evidence/requiredOutputFormat
 * @returns {Promise<object>} AI-generated postmortem object (including failureCategory / lessonsLearned, etc.)
 * @throws {Error} key unset, API failure, or failed to parse as JSON after retry
 */
/**
 * Run postmortem once with specified client (including one corrective JSON retry). Throws error on failure for caller to handle fallback.
 */
async function runPostmortem(client, model, baseURL, prompt) {
  const system =
    'You are an AI Postmortem Assessor for football (soccer) match predictions. ' +
    'You reason carefully and submit the completed assessment using the required tool.';
  const messages = [{ role: 'user', content: prompt }];

  const request = (thinkingEnabled) => client.messages.create({
    model,
    max_tokens: 16384,
    system,
    messages,
    tools: [POSTMORTEM_TOOL],
    // DeepSeek's Anthropic endpoint rejects thinking + forced tool_choice.
    // Let the thinking pass choose the required tool, then force it only on
    // the non-thinking reliability retry.
    tool_choice: thinkingEnabled
      ? { type: 'auto' }
      : { type: 'tool', name: POSTMORTEM_TOOL_NAME },
    ...deepSeekThinkingOptions(thinkingEnabled, baseURL),
  });

  let first = null;
  try {
    first = await request(true);
    const parsed = extractPostmortemResult(first);
    if (isValidPostmortemResult(parsed)) return parsed;
    console.warn('claudeClient: postmortem structured output missing; retrying without thinking',
      postmortemResponseMeta(first));
  } catch (error) {
    console.warn('claudeClient: postmortem thinking request failed; retrying without thinking',
      postmortemErrorMeta(error));
  }

  // Retry once without thinking. This preserves the full output budget for the
  // structured answer and avoids feeding a potentially truncated response back.
  const retry = await request(false);
  const parsed = extractPostmortemResult(retry);
  if (isValidPostmortemResult(parsed)) return parsed;

  console.warn('claudeClient: postmortem structured retry failed', postmortemResponseMeta(retry));

  // Last provider attempt: DeepSeek's Anthropic tool bridge can occasionally
  // return an empty tool input even with a required schema. Use a non-thinking,
  // text-only JSON pass and validate the complete bilingual contract locally.
  const final = await client.messages.create({
    model,
    max_tokens: 16384,
    system: 'Return one complete raw JSON object only. Do not use markdown.',
    messages: [{ role: 'user', content: prompt }],
    ...deepSeekThinkingOptions(false, baseURL),
  });
  const finalParsed = parseJsonLoose(extractText(final));
  if (isValidPostmortemResult(finalParsed)) return finalParsed;

  console.warn('claudeClient: postmortem final JSON retry failed', postmortemResponseMeta(final));
  throw new Error('postmortem response failed the structured bilingual contract after retries');
}

async function analyzePostMatch(aiPromptContext) {
  if (!aiPromptContext || !aiPromptContext.requiredOutputFormat) {
    throw new Error('analyzePostMatch: invalid aiPromptContext (missing requiredOutputFormat)');
  }
  const prompt = buildPostmortemPrompt(aiPromptContext);

  // Postmortem and Bot share the same DeepSeek key/provider, no provider switching.
  return runPostmortem(getClient(), POSTMORTEM_MODEL, process.env.ANTHROPIC_BASE_URL, prompt);
}

/**
 * AI Q&A conversation. For bot route usage.
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @param {string} [systemPrompt]
 * @returns {Promise<string>} model response text
 * @throws {Error} key unset or API failure (handled by caller)
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
 * Whether API key is configured (allows caller to check fallback without throwing exceptions).
 */
function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY);
}

function isChatConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY);
}

const publicApi = {
  analyzePostMatch,
  chat,
  isConfigured,
  isChatConfigured,
  POSTMORTEM_MODEL,
  CHAT_MODEL,
};

Object.defineProperty(publicApi, '__test__', {
  value: {
    extractPostmortemResult,
    isValidPostmortemResult,
    postmortemResponseMeta,
    postmortemErrorMeta,
    runPostmortem,
    buildPostmortemPrompt,
    POSTMORTEM_TOOL,
    POSTMORTEM_TOOL_NAME,
  },
  enumerable: false,
});

module.exports = publicApi;
