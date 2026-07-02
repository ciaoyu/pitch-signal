#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return false;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

const hasDotEnv = loadDotEnv();

const groups = [
  {
    title: 'core data',
    vars: [
      { name: 'BALLDONTLIE_API_KEY', required: false, note: 'FIFA/team data enrichment' },
      { name: 'THE_ODDS_API_KEY', required: false, note: 'live market odds and divergence' },
      { name: 'ODDS_API_KEY', required: false, note: 'legacy alias for THE_ODDS_API_KEY' },
      { name: 'OWM_API_KEY', required: false, note: 'live venue weather' },
    ],
  },
  {
    title: 'news and translation',
    vars: [
      { name: 'TAVILY_API_KEY', required: false, note: 'live news search' },
      { name: 'TRANSLATE_API_URL', requiredWith: ['TRANSLATE_API_KEY'], note: 'OpenAI-compatible chat completions endpoint' },
      { name: 'TRANSLATE_API_KEY', requiredWith: ['TRANSLATE_API_URL'], note: 'LLM translation provider key' },
      { name: 'TRANSLATE_MODEL', requiredWith: ['TRANSLATE_API_URL', 'TRANSLATE_API_KEY'], note: 'LLM translation model' },
    ],
  },
  {
    title: 'runtime',
    vars: [
      { name: 'PORT', required: false, note: 'defaults to 5099' },
      { name: 'CORS_ORIGINS', required: false, note: 'allowed browser origins' },
      { name: 'AI_POSTMORTEM_ENABLED', required: false, note: 'background AI post-match worker; beta default false' },
    ],
  },
];

function present(name) {
  return Boolean(String(process.env[name] || '').trim());
}

function statusFor(item) {
  const isPresent = present(item.name);
  if (isPresent) return { label: 'present', ok: true };
  if (item.required) return { label: 'missing required', ok: false };
  if (item.requiredWith?.some(present)) return { label: 'missing pair', ok: false };
  return { label: 'missing optional', ok: true };
}

let ok = true;
console.log(`env file: ${hasDotEnv ? 'present' : 'missing'} (.env values are never printed)`);

for (const group of groups) {
  console.log(`\n[${group.title}]`);
  for (const item of group.vars) {
    const status = statusFor(item);
    ok = ok && status.ok;
    const marker = status.ok ? 'ok' : 'fail';
    console.log(`${marker} ${item.name}: ${status.label}${item.note ? ` - ${item.note}` : ''}`);
  }
}

if (!present('TAVILY_API_KEY')) {
  console.log('\ninfo TAVILY_API_KEY missing: news routes will use fallback/mock data.');
}
if (!present('TRANSLATE_API_URL') || !present('TRANSLATE_API_KEY')) {
  console.log('info translation LLM not fully configured: rule-based template translation will be used.');
}

if (!ok) {
  console.error('\nfail env configuration has incomplete required pairs.');
  process.exit(1);
}

console.log('\nok env configuration is usable.');
