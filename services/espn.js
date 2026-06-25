/**
 * ESPN API service — PitchSignal
 * JSON fetcher + ESPN endpoint wrapper with built-in caching.
 */
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { getCached, setCache } = require('../middleware/cache');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_ATHLETE_BASE = 'https://site.api.espn.com/apis/common/v3/sports/soccer';

/**
 * Generic JSON HTTP GET with timeout.
 * @param {string} fullUrl - The URL to fetch.
 * @param {object} [options] - Optional settings.
 * @param {object} [options.headers] - Extra request headers (merged with defaults).
 */
function fetchJSON(fullUrl, options) {
  return new Promise((resolve, reject) => {
    const mod = fullUrl.startsWith('https') ? https : http;
    const extraHeaders = (options && options.headers) || {};
    mod.get(fullUrl, {
      timeout: 10000,
      headers: { 'Accept-Encoding': 'gzip, deflate, br', ...extraHeaders },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        const finish = (err, body) => {
          if (err) {
            reject(err);
            return;
          }
          try {
            const parsed = JSON.parse(body.toString('utf8'));
            if (res.statusCode >= 400) {
              const error = new Error(parsed.message || parsed.error || `HTTP ${res.statusCode}`);
              error.statusCode = res.statusCode;
              error.payload = parsed;
              reject(error);
              return;
            }
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        };

        if (encoding === 'gzip') return zlib.gunzip(raw, finish);
        if (encoding === 'deflate') return zlib.inflate(raw, finish);
        if (encoding === 'br') return zlib.brotliDecompress(raw, finish);
        return finish(null, raw);
      });
    }).on('error', reject);
  });
}

/**
 * ESPN API wrapper with caching.
 * @param {string} apiPath - e.g. '/scoreboard'
 * @param {string} cacheKey - cache lookup key
 * @param {number} ttl - cache TTL in ms (default 2 min)
 */
function espn(apiPath, cacheKey, ttl = 120000) {
  const cached = cacheKey ? getCached(cacheKey, ttl) : null;
  if (cached) return Promise.resolve(cached);
  return fetchJSON(`${ESPN_BASE}${apiPath}`).then(data => {
    if (cacheKey) setCache(cacheKey, data);
    return data;
  });
}

/**
 * ESPN player API — uses the common/v3 endpoint which works for all soccer athletes.
 * Returns the `athlete` object directly (unwrapped from the response).
 */
function espnAthlete(playerId, cacheKey, ttl = 600000) {
  const cached = cacheKey ? getCached(cacheKey, ttl) : null;
  if (cached) return Promise.resolve(cached);
  return fetchJSON(`${ESPN_ATHLETE_BASE}/athletes/${playerId}`).then(data => {
    const athlete = data.athlete || data;
    if (cacheKey) setCache(cacheKey, athlete);
    return athlete;
  });
}

/**
 * ESPN player gamelog — uses the common/v3 endpoint.
 */
function espnAthleteGamelog(playerId, cacheKey, ttl = 300000) {
  const cached = cacheKey ? getCached(cacheKey, ttl) : null;
  if (cached) return Promise.resolve(cached);
  return fetchJSON(`${ESPN_ATHLETE_BASE}/athletes/${playerId}/gamelog`).then(data => {
    if (cacheKey) setCache(cacheKey, data);
    return data;
  });
}

module.exports = { fetchJSON, espn, espnAthlete, espnAthleteGamelog, ESPN_BASE };
