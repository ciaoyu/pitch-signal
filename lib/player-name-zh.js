'use strict';

/**
 * player-name-zh.js
 * 服务端球员中文名查找模块
 *
 * 从 data/player_name_zh.json 加载字典，提供大小写不敏感的查找。
 * 用于在 lineup/bench API 响应中注入 nameZh 字段。
 */

const fs = require('fs');
const path = require('path');

let _dict = null;
let _lowerMap = null; // lowercase -> { original, zh }

function load() {
  if (_dict) return _dict;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'player_name_zh.json'), 'utf8');
    _dict = JSON.parse(raw);
    // Build lowercase lookup for fuzzy matching
    _lowerMap = new Map();
    for (const [name, zh] of Object.entries(_dict)) {
      _lowerMap.set(name.toLowerCase(), { original: name, zh });
    }
  } catch (e) {
    console.warn('[player-name-zh] Failed to load dictionary:', e.message);
    _dict = {};
    _lowerMap = new Map();
  }
  return _dict;
}

/**
 * 查找球员中文名
 * @param {string} name - 英文名（大小写不敏感）
 * @returns {string|null} - 中文名或 null
 */
function lookup(name) {
  if (!name) return null;
  const dict = load();
  // 1. Exact match
  if (dict[name]) return dict[name];
  // 2. Case-insensitive match
  const entry = _lowerMap.get(name.toLowerCase());
  return entry ? entry.zh : null;
}

/**
 * 为球员对象注入 nameZh 字段
 * @param {object} player - 球员对象，需有 name 字段
 * @returns {object} - 带有 nameZh 的球员对象（不修改原对象）
 */
function enrich(player) {
  if (!player) return player;
  if (player.nameZh) return player; // 已有 nameZh，不覆盖
  const zh = lookup(player.name);
  return zh ? { ...player, nameZh: zh } : player;
}

/**
 * 批量为球员数组注入 nameZh
 * @param {object[]} players
 * @returns {object[]}
 */
function enrichAll(players) {
  if (!Array.isArray(players)) return players;
  return players.map(enrich);
}

module.exports = { lookup, enrich, enrichAll, load };
