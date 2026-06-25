/**
 * In-memory LRU cache — PitchSignal
 * Time-to-live (TTL) based cache with Map backend and LRU eviction.
 */
const MAX_ENTRIES = 1000;
const cache = new Map();

function getCached(key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts < ttl) {
    // LRU: move to end (most recently used)
    cache.delete(key);
    cache.set(key, entry);
    return entry.data;
  }
  // Expired — remove
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  // LRU eviction: delete oldest entry (first key in insertion/MRU order)
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), data });
}

function clearCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}

function cacheStats() {
  return { entries: cache.size, max: MAX_ENTRIES };
}

module.exports = { getCached, setCache, clearCache, cache, cacheStats };
