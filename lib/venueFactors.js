const { createLogger } = require('./logger');
const logger = createLogger('venueFactors');
/**
 * Environmental factors module — Poisson λ decay for altitude/heat
 *
 * Formulas (per Agent C spec):
 *   β_alt  = 1 - 0.03 · max(0, (Δh - 1000) / 1000)      Δh unit: meters
 *   β_temp = 1 - 0.01 · max(0, T - 32)                   T unit: °C
 *   λ'     = λ · β_alt · β_temp
 *
 * Δh semantic decision (important, for review):
 *   Spec mentions "Δh between baseCamp altitude vs venue altitude". If Δh uses signed difference
 *   (baseCamp - venue), only "teams descending from highland camp to lowland venue" are penalized,
 *   while "lowland team ascending to highland" has zero decay — which contradicts sports physiology
 *   (hypoxia on highlands is the primary cause of performance drop). Thus this implementation uses
 *   absolute difference Δh = |baseCamp_alt - venue_alt|, penalizing drastic altitude shifts in both directions.
 *   max(0, (Δh-1000)) still ensures it only takes effect when difference > 1000m.
 *   If signed semantics are needed, only one line in altitudeFactor needs adjustment.
 *
 * T unit decision:
 *   32 is the heat threshold in °C, not freezing point in °F. Weather data sources are all in °C.
 *   Minimum decay limit is 0.85 to prevent a single weather signal from overwhelming the goal model.
 *
 * Missing data fallbacks (spec requires "fallback to existing logic when data is missing"):
 *   - baseCamp.altitude missing -> β_alt = 1 (applied:false, source marked fallback)
 *   - venue.altitude missing    -> β_alt = 1 (same as above)
 *   - weather.tC + climate.highC both missing -> β_temp = 1 (same as above)
 *   Any β = 1 means unchanged λ, falling back to original baseline in predict.
 *
 * Data sources (prefer $DATA_PATH/wc2026, fallback resources/seed/wc2026):
 *   climate.json  — venues[venueId].{jun,jul}.{highC,lowC}
 *   venues.json   — venues[venueId].{lat,lon,matches[],altitude?(to be persisted)}
 *   weather.json  — [matchId].{tC,feelsC,fetchedAt}
 *   teams.json    — teams[code].baseCamp.{city,lat,lon,altitude?(to be persisted)}
 *
 * baseCamp.altitude and venue.altitude are not yet persisted (pending Agent A),
 * this module automatically falls back to β_alt=1 when missing, and takes effect without code changes once data arrives.
 */
const fs = require('fs');
const path = require('path');

const { resolveDataPath } = require('./data-resolver');

// Multiple possible altitude field names (compatible with Agent A naming conventions)
const ALT_KEYS = ['altitude', 'altM', 'elevationM', 'elevation', 'elevM'];
const VENUE_ALIASES = {
  'estadio azteca': 'estadio banorte',
  'mexico city stadium': 'estadio banorte',
  'guadalajara stadium': 'estadio akron',
  'monterrey stadium': 'estadio bbva',
  'toronto stadium': 'bmo field',
  'vancouver stadium': 'bc place',
  'los angeles stadium': 'sofi stadium',
  'san francisco bay area stadium': "levi's stadium",
  'new york new jersey stadium': 'metlife stadium',
  'boston stadium': 'gillette stadium',
  'houston stadium': 'nrg stadium',
  'dallas stadium': 'at&t stadium',
  'philadelphia stadium': 'lincoln financial field',
  'atlanta stadium': 'mercedes-benz stadium',
  'seattle stadium': 'lumen field',
  'miami stadium': 'hard rock stadium',
  'kansas city stadium': 'geha field at arrowhead stadium',
};

// TTL cache mechanism (5-minute expiration)
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;
let _cacheTimestamp = 0;

/**
 * Lazy load and cache all data sources + reverse lookups.
 * Returns null for missing files without throwing (ensures predict does not crash on missing data).
 * Cache TTL: 5 minutes (CACHE_TTL_MS)
 */
function loadData() {
  const now = Date.now();
  if (_cache && (now - _cacheTimestamp) < CACHE_TTL_MS) return _cache;
  
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(resolveDataPath(file), 'utf8'));
    } catch { logger.debug('venueFactors: metadata fetch failed');
      return null;
    }
  };

  const climate = readJson('climate.json');
  const venues = readJson('venues.json');
  const weather = readJson('weather.json');
  const teams = readJson('teams.json');
  const schedule = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'match_snapshot_schedule.json'), 'utf8'));
    } catch {
      return null;
    }
  })();
  // id_bridge is canonical bridge (47 teams, CPV excluded); CPV falls back to teams.json
  const idBridge = readJson('id_bridge.json');
  // match_id_bridge: bidirectional bridge between ESPN matchId <-> FIFA matchId
  const matchIdBridge = readJson('match_id_bridge.json');

  // matchId -> venueId reverse lookup index (FIFA match ID)
  const matchToVenue = {};
  const venueByName = {};
  if (venues?.venues) {
    for (const [vid, v] of Object.entries(venues.venues)) {
      for (const mid of (v.matches || [])) matchToVenue[mid] = vid;
      const names = [
        v.realName,
        v.city,
        ...Object.values(v.fifaName || {}),
        ...Object.values(v.cityName || {}),
      ];
      for (const name of names) {
        const key = normalizeVenueName(name);
        if (key) venueByName[key] = vid;
      }
    }
  }
  for (const [alias, canonical] of Object.entries(VENUE_ALIASES)) {
    const venueId = venueByName[normalizeVenueName(canonical)];
    if (venueId) venueByName[normalizeVenueName(alias)] = venueId;
  }

  // ESPN matchId -> FIFA matchId -> venueId three-level index
  // Frontend / API passes ESPN ID, venues.json uses FIFA ID
  const espnToFifaMatchId = {};
  const fifaToEspnMatchId = {};
  if (matchIdBridge?.bridge) {
    for (const [, entry] of Object.entries(matchIdBridge.bridge)) {
      if (entry.espn_match_id && entry.fifa_match_id) {
        espnToFifaMatchId[entry.espn_match_id] = entry.fifa_match_id;
        fifaToEspnMatchId[entry.fifa_match_id] = entry.espn_match_id;
      }
    }
  }
  // Also map ESPN ID directly to venueId
  for (const [espnId, fifaId] of Object.entries(espnToFifaMatchId)) {
    if (matchToVenue[fifaId]) matchToVenue[espnId] = matchToVenue[fifaId];
  }
  // Offline schedule venue names provide a deterministic fallback when an ID bridge is absent.
  for (const match of (schedule?.matches || [])) {
    if (matchToVenue[match.matchId]) continue;
    const venueId = resolveVenueIdByName(match.venue, venueByName);
    if (venueId) matchToVenue[match.matchId] = venueId;
  }

  // Team multi-path index (teams.json, 48 teams including CPV)
  const teamByCode = {};
  const teamByNameEn = {};
  const teamByNameZh = {};
  const teamByIso2 = {};
  if (teams?.teams) {
    for (const [code, t] of Object.entries(teams.teams)) {
      teamByCode[code] = t;
      if (t.name?.en) teamByNameEn[t.name.en.toLowerCase()] = code;
      if (t.name?.zh) teamByNameZh[t.name.zh] = code;
      if (t.iso2) teamByIso2[t.iso2] = code;
    }
  }

  // id_bridge reverse index (47 teams, canonical name -> code)
  // ratings.json keys are country names, bridged via id_bridge[code].name_official
  const bridgeByCode = {};
  const bridgeByNameOfficial = {};
  const bridgeByNameEn = {};
  const bridgeByNameZh = {};
  const bridgeByEspnId = {};
  const bridgeByFifaId = {};
  if (idBridge) {
    for (const [code, e] of Object.entries(idBridge)) {
      bridgeByCode[code] = e;
      if (e.name_official) bridgeByNameOfficial[e.name_official.toLowerCase()] = code;
      if (e.name_en) bridgeByNameEn[e.name_en.toLowerCase()] = code;
      if (e.name_zh) bridgeByNameZh[e.name_zh] = code;
      if (e.espn_id != null) bridgeByEspnId[String(e.espn_id)] = code;
      if (e.fifa_id != null) bridgeByFifaId[String(e.fifa_id)] = code;
    }
  }

  _cache = {
    climate, venues, weather, teams, schedule, idBridge, matchIdBridge,
    venueByName,
    matchToVenue, teamByCode, teamByNameEn, teamByNameZh, teamByIso2,
    bridgeByCode, bridgeByNameOfficial, bridgeByNameEn, bridgeByNameZh,
    bridgeByEspnId, bridgeByFifaId,
    espnToFifaMatchId, fifaToEspnMatchId,
  };
  _cacheTimestamp = now;
  return _cache;
}

/** Reset cache for unit testing only */
function _resetCache() { _cache = null; _cacheTimestamp = 0; }

function normalizeVenueName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(stadium|stadium at|field|park)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveVenueIdByName(name, index = loadData().venueByName) {
  const normalized = normalizeVenueName(name);
  if (!normalized) return null;
  if (index[normalized]) return index[normalized];

  const candidates = Object.entries(index).filter(([key]) =>
    key.length >= 5 && (key.includes(normalized) || normalized.includes(key))
  );
  const ids = [...new Set(candidates.map(([, id]) => id))];
  return ids.length === 1 ? ids[0] : null;
}

/** Celsius -> Fahrenheit */
function cToF(c) {
  if (c == null || !Number.isFinite(c)) return null;
  return c * 9 / 5 + 32;
}

/** Extract altitude field from object (compatible with multiple key names) */
function _pickAltitude(obj) {
  if (!obj) return null;
  for (const k of ALT_KEYS) {
    const v = obj[k];
    if (v != null && Number.isFinite(v)) return Number(v);
  }
  return null;
}

const _round4 = (x) => Math.round(x * 10000) / 10000;

/**
 * Altitude decay factor β_alt
 * @param {number|null} baseCampAltM Base camp altitude (meters)
 * @param {number|null} venueAltM    Venue altitude (meters)
 * @returns {{beta, applied, deltaH, source}}
 */
function altitudeFactor(baseCampAltM, venueAltM) {
  if (baseCampAltM == null || venueAltM == null) {
    return { beta: 1, applied: false, deltaH: null, source: 'fallback:missing_altitude' };
  }
  // Absolute difference: penalizes drastic altitude shifts in either direction (see header decisions)
  const deltaH = Math.abs(baseCampAltM - venueAltM);
  const beta = 1 - 0.03 * Math.max(0, (deltaH - 1000) / 1000);
  const b = _round4(Math.max(0, beta));
  return {
    beta: b,
    applied: b < 1,
    deltaH: Math.round(deltaH * 10) / 10,
    source: deltaH > 1000 ? 'altitude_delta' : 'no_altitude_effect',
  };
}

/**
 * Temperature decay factor β_temp (input in Fahrenheit, converted to Celsius)
 * @param {number|null} tempF Fahrenheit
 */
function temperatureFactorF(tempF) {
  if (tempF == null || !Number.isFinite(tempF)) {
    return { beta: 1, applied: false, tempF: null, source: 'fallback:missing_temp' };
  }
  const tempC = (tempF - 32) * 5 / 9;
  const result = temperatureFactor(tempC);
  return { ...result, tempF: Math.round(tempF * 100) / 100 };
}

/** Temperature decay factor (input in Celsius) */
function temperatureFactor(tempC) {
  if (tempC == null || !Number.isFinite(tempC)) {
    return { beta: 1, applied: false, tempC: null, source: 'fallback:missing_temp' };
  }
  const beta = 1 - 0.01 * Math.max(0, tempC - 32);
  const b = _round4(Math.max(0.85, beta));
  return {
    beta: b,
    applied: b < 1,
    tempC: Math.round(tempC * 100) / 100,
    source: tempC > 32 ? 'heat_decay' : 'no_heat_effect',
  };
}

/**
 * Retrieve real-time match temperature (°C).
 * Priority: weather.json[matchId].tC -> climate[venueId].{jun|jul}.highC -> null
 * @param {string} matchId
 * @param {'jun'|'jul'} [monthHint] Month used for climate fallback; derived from weather.fetchedAt or defaults to 'jun'
 * @returns {{tempC, source}}
 */
function getMatchTempC(matchId, monthHint) {
  const d = loadData();
  // Attempt direct match first, then FIFA ID mapping
  const fifaId = d.espnToFifaMatchId[matchId] || matchId;
  const espnId = d.fifaToEspnMatchId[matchId] || matchId;
  const w = d.weather?.[matchId] || d.weather?.[fifaId] || d.weather?.[espnId];
  if (w && w.tC != null && Number.isFinite(w.tC)) {
    return { tempC: w.tC, source: 'weather.live' };
  }
  // Fallback to climate
  const venueId = d.matchToVenue[matchId];
  if (venueId) {
    const clim = d.climate?.venues?.[venueId] || d.venues?.venues?.[venueId]?.climate;
    if (clim) {
      let m = monthHint;
      if (!m) {
        // Derive month from weather.fetchedAt (even if tC is missing, fetchedAt may exist)
        const fa = w?.fetchedAt;
        if (fa) {
          const mm = new Date(fa).getMonth() + 1; // 1-12
          if (mm === 7) m = 'jul'; else if (mm === 6) m = 'jun';
        }
        if (!m) m = 'jun'; // Tournament starts June 11, default to June
      }
      const monthClim = clim[m] || clim.jun;
      if (monthClim && monthClim.highC != null) {
        return { tempC: monthClim.highC, source: `climate.${m}_high` };
      }
    }
  }
  return { tempC: null, source: 'fallback:no_temp' };
}

/**
 * Any team identifier -> 3-letter FIFA code
 * Resolution priority (first hit returns):
 *   1. Direct hit in teamByCode (including CPV, 48 teams)
 *   2. id_bridge reverse index: name_official / name_en / name_zh / espn_id / fifa_id (47 teams)
 *   3. teams.json reverse index: name_en / name_zh / iso2 (fallback including CPV)
 *
 * CPV is not in id_bridge (no espn_id), but can still be resolved to 'CPV' via teams.json,
 * falling back to prediction's 1500 baseline when absent in ratings.
 *
 * @param {string} identifier fifa code / ratingsId (country name) / espnId / English name / Chinese name / iso2
 * @returns {string|null}
 */
function resolveTeamCode(identifier) {
  if (!identifier) return null;
  const d = loadData();
  const id = String(identifier);

  // 1. Direct code hit (including CPV)
  if (d.teamByCode[id]) return id;
  // 1b. id_bridge direct code hit
  if (d.bridgeByCode[id]) return id;

  // 2. id_bridge reverse index (canonical bridge)
  const lid = id.toLowerCase();
  if (d.bridgeByNameOfficial[lid]) return d.bridgeByNameOfficial[lid];
  if (d.bridgeByNameEn[lid]) return d.bridgeByNameEn[lid];
  if (d.bridgeByNameZh[id]) return d.bridgeByNameZh[id];
  if (d.bridgeByEspnId[id]) return d.bridgeByEspnId[id];
  if (d.bridgeByFifaId[id]) return d.bridgeByFifaId[id];

  // 3. teams.json reverse index fallback (including CPV)
  if (d.teamByNameEn[lid]) return d.teamByNameEn[lid];
  if (d.teamByNameZh[id]) return d.teamByNameZh[id];
  if (d.teamByIso2[id]) return d.teamByIso2[id];
  return null;
}

/** Retrieve team base camp object (including future altitude) */
function getTeamBaseCamp(teamIdentifier) {
  const code = resolveTeamCode(teamIdentifier);
  if (!code) return null;
  return loadData().teamByCode[code]?.baseCamp || null;
}

/** Retrieve match venue object */
function getMatchVenue(matchId) {
  const d = loadData();
  const vid = d.matchToVenue[matchId];
  if (!vid) return null;
  return d.venues?.venues?.[vid] || null;
}

/**
 * Compute environmental factors for a team in a match (β_alt · β_temp)
 * @param {string} matchId        ESPN matchId (e.g. "400021440")
 * @param {string} teamIdentifier ratingsId / espnId / fifa code / team name
 * @param {'jun'|'jul'} [monthHint]
 * @returns {object} {betaAlt, betaTemp, beta, applied, deltaH, baseCampAltM, venueAltM, tempC, tempSource, source, teamCode, venueId}
 */
function computeForTeam(matchId, teamIdentifier, monthHint) {
  const d = loadData();
  const code = resolveTeamCode(teamIdentifier);
  const baseCamp = code ? (d.teamByCode[code]?.baseCamp || null) : null;
  const venue = getMatchVenue(matchId);
  const tempInfo = getMatchTempC(matchId, monthHint);

  const baseCampAltM = _pickAltitude(baseCamp);
  const venueAltM = _pickAltitude(venue);

  const alt = altitudeFactor(baseCampAltM, venueAltM);
  const temp = temperatureFactor(tempInfo.tempC);

  const beta = _round4(alt.beta * temp.beta);
  const applied = alt.applied || temp.applied;

  // Format readable source string
  const parts = [];
  if (alt.applied) parts.push(`alt:${alt.source}(Δh=${alt.deltaH}m)`);
  else if (alt.source.startsWith('fallback')) parts.push(alt.source);
  if (temp.applied) parts.push(`temp:${temp.source}(${tempInfo.tempC}°C)`);
  else if (temp.source.startsWith('fallback')) parts.push(temp.source);
  if (!parts.length) parts.push('no_env_effect');

  return {
    betaAlt: alt.beta,
    betaTemp: temp.beta,
    beta,
    applied,
    deltaH: alt.deltaH,
    baseCampAltM,
    venueAltM,
    tempC: tempInfo.tempC,
    tempSource: tempInfo.source,
    source: parts.join(' | '),
    teamCode: code,
    venueId: venue?.id || null,
  };
}

/**
 * Compute environmental factors for both home and away teams in a match
 * @returns {{home: object, away: object}}
 */
function computeForMatch(matchId, homeIdentifier, awayIdentifier, monthHint) {
  return {
    home: computeForTeam(matchId, homeIdentifier, monthHint),
    away: computeForTeam(matchId, awayIdentifier, monthHint),
  };
}

module.exports = {
  cToF,
  altitudeFactor,
  temperatureFactor,
  temperatureFactorF,
  getMatchTempC,
  resolveTeamCode,
  getTeamBaseCamp,
  getMatchVenue,
  normalizeVenueName,
  resolveVenueIdByName,
  computeForTeam,
  computeForMatch,
  loadData,
  _resetCache,
};
