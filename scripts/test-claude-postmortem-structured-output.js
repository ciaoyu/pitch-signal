#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { __test__ } = require('../lib/claudeClient');
const { refreshOutdatedReviews } = require('../lib/jobs/ai-postmortem');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}:`, error.message);
  }
}

function validResult() {
  return {
    failureCategory: null,
    lessonsLearned: {
      teamSpecific: {},
      globalModel: { zh: '中文结论', en: 'English conclusion' },
    },
    headlineI18n: { zh: '中文标题', en: 'English headline' },
    whyRightI18n: { zh: ['中文'], en: ['English'] },
    whyWrongI18n: { zh: [], en: [] },
    processNotesI18n: { zh: ['中文'], en: ['English'] },
    expertCommentaryNotes: [],
  };
}

async function run() {
  await test('extracts forced tool input without parsing text', () => {
    const expected = validResult();
    const result = __test__.extractPostmortemResult({
      content: [
        { type: 'thinking', thinking: 'hidden' },
        { type: 'tool_use', name: __test__.POSTMORTEM_TOOL_NAME, input: expected },
      ],
    });
    assert.deepStrictEqual(result, expected);
  });

  await test('keeps loose JSON compatibility for providers returning text', () => {
    const expected = validResult();
    const result = __test__.extractPostmortemResult({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(expected)}\n\`\`\`` }],
    });
    assert.deepStrictEqual(result, expected);
  });

  await test('uses auto tool output, 16384 tokens, and thinking on first attempt', async () => {
    const expected = validResult();
    const calls = [];
    const client = {
      messages: {
        create: async options => {
          calls.push(options);
          return { content: [{ type: 'tool_use', name: __test__.POSTMORTEM_TOOL_NAME, input: expected }] };
        },
      },
    };
    const result = await __test__.runPostmortem(client, 'deepseek-v4-pro', 'https://api.deepseek.com/anthropic', 'prompt');
    assert.deepStrictEqual(result, expected);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].max_tokens, 16384);
    assert.deepStrictEqual(calls[0].tool_choice, { type: 'auto' });
    assert.deepStrictEqual(calls[0].thinking, { type: 'enabled' });
    assert.strictEqual(calls[0].output_config.effort, 'high');
  });

  await test('retries once without thinking and does not replay malformed output', async () => {
    const expected = validResult();
    const calls = [];
    const client = {
      messages: {
        create: async options => {
          calls.push(options);
          if (calls.length === 1) {
            return {
              stop_reason: 'max_tokens',
              usage: { input_tokens: 8000, output_tokens: 8192 },
              content: [{ type: 'text', text: '{"truncated":' }],
            };
          }
          return { content: [{ type: 'tool_use', name: __test__.POSTMORTEM_TOOL_NAME, input: expected }] };
        },
      },
    };
    const result = await __test__.runPostmortem(client, 'deepseek-v4-pro', 'https://api.deepseek.com/anthropic', 'original prompt');
    assert.deepStrictEqual(result, expected);
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls[1].thinking, { type: 'disabled' });
    assert.deepStrictEqual(calls[1].tool_choice, { type: 'tool', name: __test__.POSTMORTEM_TOOL_NAME });
    assert.strictEqual(calls[1].messages.length, 1);
    assert.strictEqual(calls[1].messages[0].content, 'original prompt');
  });

  await test('retries without thinking when the thinking request is rejected', async () => {
    const expected = validResult();
    const calls = [];
    const client = {
      messages: {
        create: async options => {
          calls.push(options);
          if (calls.length === 1) {
            const error = new Error('provider rejected request');
            error.status = 400;
            throw error;
          }
          return { content: [{ type: 'tool_use', name: __test__.POSTMORTEM_TOOL_NAME, input: expected }] };
        },
      },
    };
    const result = await __test__.runPostmortem(client, 'deepseek-v4-pro', 'https://api.deepseek.com/anthropic', 'prompt');
    assert.deepStrictEqual(result, expected);
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls[1].thinking, { type: 'disabled' });
    assert.deepStrictEqual(calls[1].tool_choice, { type: 'tool', name: __test__.POSTMORTEM_TOOL_NAME });
  });

  await test('diagnostics contain metadata but not response text', () => {
    const meta = __test__.postmortemResponseMeta({
      stop_reason: 'max_tokens',
      usage: { input_tokens: 123, output_tokens: 456 },
      content: [{ type: 'text', text: 'sensitive match response' }],
    });
    assert.deepStrictEqual(meta, {
      stopReason: 'max_tokens',
      inputTokens: 123,
      outputTokens: 456,
      blockTypes: ['text'],
      textChars: 24,
      hasPostmortemTool: false,
    });
    assert.ok(!JSON.stringify(meta).includes('sensitive'));
  });

  await test('rejects empty tool input and accepts the validated final JSON retry', async () => {
    const expected = validResult();
    const calls = [];
    const client = {
      messages: {
        create: async options => {
          calls.push(options);
          if (calls.length <= 2) {
            return { content: [{ type: 'tool_use', name: __test__.POSTMORTEM_TOOL_NAME, input: {} }] };
          }
          return { content: [{ type: 'text', text: JSON.stringify(expected) }] };
        },
      },
    };
    const result = await __test__.runPostmortem(client, 'deepseek-v4-pro', 'https://api.deepseek.com/anthropic', 'prompt');
    assert.deepStrictEqual(result, expected);
    assert.strictEqual(calls.length, 3);
    assert.ok(!calls[2].tools, 'final retry is text-only');
    assert.deepStrictEqual(calls[2].thinking, { type: 'disabled' });
    assert.strictEqual(__test__.isValidPostmortemResult({}), false);
    assert.strictEqual(__test__.isValidPostmortemResult(expected), true);
  });

  await test('postmortem prompt includes the structural live timeline', () => {
    const prompt = __test__.buildPostmortemPrompt({
      instruction: 'Analyze',
      match: { predictionScope: '90-minute regulation time' },
      prediction: { predictedScore: '1-1' },
      evidence: { commentary: [] },
      liveTimelineI18n: [{ minute: 67, trigger: 'goal', score: '1-1' }],
      requiredOutputFormat: { headlineI18n: { zh: 'string', en: 'string' } },
    });
    assert.ok(prompt.includes('LIVE TIMELINE'));
    assert.ok(prompt.includes('"minute": 67'));
    assert.ok(prompt.includes('90-minute regulation time'));
  });

  await test('outdated completed reviews are rebuilt and current reviews are skipped', async () => {
    const rebuiltIds = [];
    const db = {
      prepare: () => ({
        all: () => [
          { match_id: 'current', review_json: JSON.stringify({ schemaVersion: 'post_match_review_v2' }) },
          { match_id: 'old-1', review_json: JSON.stringify({ schemaVersion: 'post_match_review_v1' }) },
          { match_id: 'old-2', review_json: JSON.stringify({ schemaVersion: 'post_match_review_v1' }) },
          { match_id: 'old-3', review_json: JSON.stringify({ schemaVersion: 'post_match_review_v1' }) },
        ],
      }),
    };
    const reviewService = {
      reviewMatch: async (matchId, options) => {
        rebuiltIds.push({ matchId, options });
        return { schemaVersion: 'post_match_review_v2', status: 'ready_for_ai' };
      },
    };
    const count = await refreshOutdatedReviews(db, reviewService, 'post_match_review_v2');
    assert.strictEqual(count, 2);
    assert.deepStrictEqual(rebuiltIds, [
      { matchId: 'old-1', options: { persist: true } },
      { matchId: 'old-2', options: { persist: true } },
    ]);
  });

  console.log(`${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run();
