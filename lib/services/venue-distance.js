'use strict';

/**
 * Venue distance service (KO-1 shared infra, consumed by KO-5 fatigue signal)
 *
 * - Haversine great-circle distance between two venues' coordinates.
 * - Venue name resolution: exact (case-insensitive) match against
 *   data/venues.json, with a fuzzy fallback using lib/fuzzy-match's
 *   levenshteinDistance + normalizeString (ESPN venue names drift from the
 *   curated list).
 *
 * Pure / synchronous / idempotent. No network. The venues array is loaded once
 * and cached on first use.
 */

const fs = require('fs');
const path = require('path');
const { levenshteinDistance } = require('../fuzzy-match');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const EARTH_RADIUS_KM = 6371;
const FUZZY_NAME_THRESHOLD = 0.85;

function normalizeName(str) {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

let _venuesCache = null;
function loadVenues() {
  if (_venuesCache) return _venuesCache;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'venues.json'), 'utf8'));
    _venuesCache = Array.isArray(raw) ? raw : Object.values(raw);
  } catch (_) {
    _venuesCache = [];
  }
  return _venuesCache;
}

function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))));
}

// Accept a venue in any of the shapes we see: a name string, a venues.json
// entry ({ name, coordinates:{lat,lng} }), or a bare {lat,lng}/{coordinates}.
function toCoords(venue) {
  if (!venue) return null;
  if (typeof venue === 'string') {
    const resolved = resolveVenue(venue);
    return resolved ? toCoords(resolved) : null;
  }
  if (venue.coordinates) return { lat: venue.coordinates.lat, lng: venue.coordinates.lng };
  if (venue.lat != null && venue.lng != null) return { lat: venue.lat, lng: venue.lng };
  return null;
}

/**
 * Resolve a (possibly ESPN-shaped) venue name to a venues.json entry.
 * Exact case-insensitive match first; fuzzy fallback (Levenshtein similarity)
 * only when no exact hit.
 * @param {string} name
 * @returns {object|null} venues.json entry or null
 */
function resolveVenue(name) {
  if (!name) return null;
  const venues = loadVenues();
  const norm = normalizeName(name);
  if (!norm) return null;

  // 1. Exact (normalized) match.
  let exact = venues.find((v) => normalizeName(v.name) === norm);
  if (exact) return exact;

  // 2. Fuzzy fallback: highest normalized-Levenshtein similarity above threshold.
  let best = null;
  let bestScore = 0;
  for (const v of venues) {
    const t = normalizeName(v.name);
    if (!t) continue;
    const maxLen = Math.max(norm.length, t.length);
    if (!maxLen) continue;
    const sim = 1 - levenshteinDistance(norm, t) / maxLen;
    if (sim > bestScore) {
      bestScore = sim;
      best = v;
    }
  }
  return bestScore >= FUZZY_NAME_THRESHOLD ? best : null;
}

/**
 * Great-circle distance (km) between two venues.
 * @param {string|object} a venue name or coordinate-bearing object
 * @param {string|object} b venue name or coordinate-bearing object
 * @returns {number|null} km, or null if either venue cannot be resolved
 */
function distanceKm(a, b) {
  const ca = toCoords(a);
  const cb = toCoords(b);
  return haversineKm(ca, cb);
}

module.exports = { haversineKm, resolveVenue, distanceKm, loadVenues };
