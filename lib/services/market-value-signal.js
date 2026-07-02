'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', '..', 'data', 'market-values.json');

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseEur(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value == null) return null;
  const text = String(value).trim().toLowerCase().replace(/,/g, '');
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  if (text.includes('bn') || text.includes('billion') || text.includes('亿')) return n * 1_000_000_000;
  if (text.includes('m') || text.includes('million') || text.includes('百万')) return n * 1_000_000;
  if (text.includes('k') || text.includes('thousand') || text.includes('千')) return n * 1_000;
  return n;
}

function loadDataset(filePath = process.env.MARKET_VALUES_PATH || DEFAULT_PATH) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function collectTeamEntries(dataset) {
  if (!dataset) return [];
  const teams = dataset.teams || dataset.nationalTeams || dataset;
  if (Array.isArray(teams)) {
    return teams.map((entry) => [entry.id || entry.team || entry.name, entry]);
  }
  if (teams && typeof teams === 'object') return Object.entries(teams);
  return [];
}

function teamValue(entry) {
  if (!entry) return null;
  const direct = parseEur(
    entry.squadValueEur
    ?? entry.marketValueEur
    ?? entry.market_value_in_eur
    ?? entry.marketValue
    ?? entry.value
  );
  if (direct) return direct;
  const players = Array.isArray(entry.players) ? entry.players : Object.values(entry.players || {});
  if (!players.length) return null;
  const total = players.reduce((sum, player) => sum + (parseEur(
    player.marketValueEur
    ?? player.market_value_in_eur
    ?? player.marketValue
    ?? player.value
  ) || 0), 0);
  return total > 0 ? total : null;
}

function buildIndex(dataset) {
  const index = new Map();
  for (const [key, entry] of collectTeamEntries(dataset)) {
    const value = teamValue(entry);
    if (!value) continue;
    const names = [
      key,
      entry.id,
      entry.team,
      entry.name,
      entry.nameOfficial,
      entry.name_official,
      entry.country,
      entry.country_name,
      entry.fifaCode,
      entry.fifa_code,
    ].filter(Boolean);
    const record = {
      value,
      raw: entry,
      source: entry.source || dataset.source || 'market-values',
      updatedAt: entry.updatedAt || entry.updated_at || dataset.updatedAt || dataset.updated_at || null,
    };
    for (const name of names) {
      index.set(normalizeKey(name), record);
    }
  }
  return index;
}

function lookup(index, teamId) {
  if (!index || !teamId) return null;
  return index.get(normalizeKey(teamId)) || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildSignal(homeId, awayId, options = {}) {
  const dataset = options.dataset || loadDataset(options.filePath);
  const index = options.index || buildIndex(dataset);
  const home = lookup(index, homeId);
  const away = lookup(index, awayId);
  if (!home || !away) return null;

  const homeValue = home.value;
  const awayValue = away.value;
  if (!homeValue || !awayValue) return null;

  // Market value is heavy-tailed.  Log ratio is a stable way to express squad
  // strength difference without letting one superstar dominate the whole team.
  const logRatio = Math.log(homeValue / awayValue);
  const eloEquivalent = clamp(logRatio * 220, -350, 350);
  const homeNoDraw = 1 / (1 + Math.pow(10, -eloEquivalent / 400));
  const draw = clamp(0.29 - Math.abs(eloEquivalent) / 2500, 0.17, 0.31);
  const decisive = 1 - draw;
  const homeProb = homeNoDraw * decisive;
  const awayProb = (1 - homeNoDraw) * decisive;

  const recencyConfidence = home.updatedAt || away.updatedAt ? 0.08 : 0;
  const gapConfidence = clamp(Math.abs(logRatio) / Math.log(8), 0, 1) * 0.12;
  const confidence = clamp(0.55 + recencyConfidence + gapConfidence, 0.40, 0.78);

  return {
    home: Math.round(homeProb * 10000) / 10000,
    draw: Math.round(draw * 10000) / 10000,
    away: Math.round(awayProb * 10000) / 10000,
    confidence: Math.round(confidence * 1000) / 1000,
    homeValueEur: Math.round(homeValue),
    awayValueEur: Math.round(awayValue),
    ratio: Math.round((homeValue / awayValue) * 1000) / 1000,
    eloEquivalent: Math.round(eloEquivalent),
    source: home.source || away.source || 'market-values',
    updatedAt: home.updatedAt || away.updatedAt || null,
  };
}

module.exports = {
  DEFAULT_PATH,
  normalizeKey,
  parseEur,
  loadDataset,
  buildIndex,
  buildSignal,
};
