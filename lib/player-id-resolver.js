/**
 * lib/player-id-resolver.js
 *
 * 球员 ID 解析器：通过 slug 或 ESPN athlete ID 查找球员，
 * 返回 { espnId, photo } 或 { slug, photo }。
 *
 * 数据源：优先运行时 player_id_bridge.json，回退只读 seed（由 build-player-id-bridge.js 生成）
 * 头像：ESPN CDN 直链，无需 API 调用。
 */

const fs = require('fs');
const { resolveDataPath } = require('./data-resolver');

const BRIDGE_PATH = resolveDataPath('player_id_bridge.json');

let _bridge = null;

/**
 * 懒加载 bridge 数据（带缓存）
 */
function loadBridge() {
  if (_bridge) return _bridge;
  try {
    _bridge = JSON.parse(fs.readFileSync(BRIDGE_PATH, 'utf8'));
  } catch (e) {
    console.error('[player-id-resolver] 无法加载 player_id_bridge.json:', e.message);
    _bridge = { bySlug: {}, byEspnId: {}, stats: {} };
  }
  return _bridge;
}

/**
 * 清除缓存（测试用）
 */
function clearCache() {
  _bridge = null;
}

/**
 * 构造 ESPN 球员头像 URL
 * @param {string} espnAthleteId - ESPN athlete ID（6位数字字符串）
 * @returns {string} 头像 URL
 */
function espnPhotoUrl(espnAthleteId) {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${espnAthleteId}.png`;
}

/**
 * 通过本地 slug ID 查找 ESPN athlete ID 和头像
 *
 * @param {string} slug - 本地球员 slug ID（如 "matej-kovar"）
 * @returns {{ espnId: string, photo: string, name: string, teamCode: string } | null}
 */
function resolveBySlug(slug) {
  if (!slug) return null;
  const bridge = loadBridge();
  const entry = bridge.bySlug?.[slug];
  if (!entry) return null;
  return {
    espnId: entry.espnId,
    photo: espnPhotoUrl(entry.espnId),
    name: entry.nameSquad || entry.nameLineup || '',
    teamCode: entry.teamCode || '',
  };
}

/**
 * 通过 ESPN athlete ID 查找本地 slug ID 和头像
 *
 * @param {string} espnId - ESPN athlete ID（如 "484012"）
 * @returns {{ slug: string, photo: string, teamCode: string } | null}
 */
function resolveByEspnId(espnId) {
  if (!espnId) return null;
  const bridge = loadBridge();
  const entry = bridge.byEspnId?.[String(espnId)];
  if (!entry) return null;
  return {
    slug: entry.slug,
    photo: espnPhotoUrl(String(espnId)),
    teamCode: entry.teamCode || '',
  };
}

/**
 * 获取 ESPN 球员头像 URL（不需要额外元数据，仅返回头像链接）
 *
 * @param {string} espnId - ESPN athlete ID
 * @returns {string} 头像 URL
 */
function getPhotoByEspnId(espnId) {
  if (!espnId) return '';
  return espnPhotoUrl(String(espnId));
}

/**
 * 获取桥接统计信息
 * @returns {{ totalUniquePlayers: number, matched: number, unmatched: number, matchRate: number }}
 */
function getStats() {
  const bridge = loadBridge();
  return bridge.stats || { totalUniquePlayers: 0, matched: 0, unmatched: 0, matchRate: 0 };
}

/**
 * 批量通过 slug 查找（优化版，避免重复 I/O）
 *
 * @param {Object<string, string>} slugMap - { slugKey: slugValue } 映射
 * @returns {Object<string, { espnId: string, photo: string } | null>}
 */
function resolveBySlugBatch(slugMap) {
  const bridge = loadBridge();
  const result = {};
  for (const [key, slug] of Object.entries(slugMap)) {
    const entry = bridge.bySlug?.[slug];
    result[key] = entry
      ? { espnId: entry.espnId, photo: espnPhotoUrl(entry.espnId) }
      : null;
  }
  return result;
}

module.exports = {
  resolveBySlug,
  resolveByEspnId,
  getPhotoByEspnId,
  getStats,
  resolveBySlugBatch,
  clearCache,
  espnPhotoUrl,
};
