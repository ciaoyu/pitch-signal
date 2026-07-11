#!/usr/bin/env node
'use strict';

/**
 * Build the auditable WC2026 team-fact layer used by styleMatchup.
 *
 * FIFA is authoritative for fixtures, formations, starting XI, substitutions,
 * goals and cards. ESPN summary is used only for possession/corners because
 * those fields are absent from the current FIFA live payload. Every field keeps
 * its source URL, sample count and rule version. Unsupported tactical ideas
 * stay explicitly not_covered; this script never infers pressing/counterplay.
 */
const fs = require('fs');
const path = require('path');
const { fetchCalendar, fetchLiveMatch, statusLabel } = require('../lib/services/fifa-api');
const { writeJsonAtomic, resolveDataPath } = require('../lib/data-resolver');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const RULE_VERSION = 'style-facts-v1';
const SOURCE_RETRIEVED_AT = new Date().toISOString();

function sourceUrl(stage, id) {
  return `https://api.fifa.com/api/v3/live/football/17/285023/${stage}/${id}?language=en`;
}
function espnUrl(id) { return `${ESPN_BASE}/summary?event=${id}`; }
function num(value) { const n = Number.parseFloat(String(value ?? '').replace('%', '')); return Number.isFinite(n) ? n : null; }
function dateKey(value) { return String(value || '').slice(0, 10); }
function parseMinute(value) { const m = String(value || '').match(/(\d+)/); return m ? Number(m[1]) : null; }

function findStats(root, out = {}) {
  if (!root || typeof root !== 'object') return out;
  if (Array.isArray(root)) { root.forEach(item => findStats(item, out)); return out; }
  if (typeof root.name === 'string' && (root.displayValue !== undefined || root.value !== undefined)) {
    const value = root.displayValue ?? root.value;
    if (out[root.name] === undefined) out[root.name] = value;
  }
  for (const value of Object.values(root)) findStats(value, out);
  return out;
}
function findTeamStats(summary, side) {
  const rows = summary?.boxScore?.teams || summary?.boxscore?.teams || [];
  const row = rows[side === 'home' ? 0 : 1];
  const out = {};
  for (const stat of (row?.statistics || [])) out[stat.name] = stat.displayValue ?? stat.value;
  return out;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'pitch-signal-style-facts/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.json();
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = await fn(items[index], index); }
      catch (error) { results[index] = { error: error.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function emptyTeam(code, name) {
  return {
    teamCode: code,
    teamName: name || code,
    season: 'FIFA World Cup 2026',
    sampleMatches: 0,
    sources: { fifa: [], espn: [] },
    facts: {
      formations: {}, startingXIChanges: 0,
      substitutions: { total: 0, minutes: [] },
      possession: { status: 'not_covered', sampleMatches: 0, average: null },
      setPieces: {
        status: 'not_covered', sampleMatches: 0, cornersFor: null, cornersAgainst: null,
        penalties: { status: 'not_covered', sampleMatches: 0, for: null, against: null },
      },
      discipline: { sampleMatches: 0, yellow: 0, red: 0 },
      unsupported: {
        pressing: { status: 'not_covered', reason: 'FIFA feed has no pressure/PPDA field' },
        counterplay: { status: 'not_covered', reason: 'FIFA feed has no counter-attack classification' },
        progression: { status: 'not_covered', reason: 'FIFA feed has no progressive-carry/progressive-pass field' },
      },
    },
    derivedTags: [],
    tagEvidence: [],
    coverage: {
      qualifiesForRule: false,
      minimumSampleMatches: 3,
      ruleVersion: RULE_VERSION,
      oosValidation: { status: 'not_run', usedInModel: false },
    },
    retrievedAt: SOURCE_RETRIEVED_AT,
  };
}

function addTeamMatch(team, side, fixture, live, summary) {
  const stats = findTeamStats(summary, side);
  const home = side === 'home';
  const possession = num(stats.possessionPct);
  const corners = num(stats.wonCorners);
  const opponentStats = findTeamStats(summary, home ? 'away' : 'home');
  const teamStats = {
    possessionPct: possession,
    corners: corners,
    opponentPossessionPct: num(opponentStats.possessionPct),
    opponentCorners: num(opponentStats.wonCorners),
  };
  const formation = home ? live?.homeTactics : live?.awayTactics;
  const players = home ? live?.homePlayers : live?.awayPlayers;
  const bookings = home ? (live?.homeBookings || []) : (live?.awayBookings || []);
  const substitutions = home ? (live?.homeSubstitutions || []) : (live?.awaySubstitutions || []);
  const opponent = home ? fixture.Away : fixture.Home;
  const opponentCode = opponent?.IdCountry || null;
  const prior = team._lastXI || [];
  const xi = (players || []).filter(player => player.status === 1).map(player => String(player.id)).sort();
  if (prior.length && JSON.stringify(prior) !== JSON.stringify(xi)) team.facts.startingXIChanges += 1;
  team._lastXI = xi;
  team.sampleMatches += 1;
  if (formation) team.facts.formations[formation] = (team.facts.formations[formation] || 0) + 1;
  team.facts.substitutions.total += substitutions.length;
  team.facts.substitutions.minutes.push(...substitutions.map(sub => parseMinute(sub.minute)).filter(Number.isFinite));
  team.facts.discipline.sampleMatches += 1;
  team.facts.discipline.yellow += bookings.filter(card => Number(card.card) === 1).length;
  team.facts.discipline.red += bookings.filter(card => Number(card.card) === 2 || Number(card.card) === 3).length;
  if (possession != null) {
    const p = team.facts.possession;
    p.sampleMatches += 1;
    p._sum = (p._sum || 0) + possession;
  }
  if (corners != null) {
    const c = team.facts.setPieces;
    c.sampleMatches += 1;
    c._cornersFor = (c._cornersFor || 0) + corners;
    if (teamStats.opponentCorners != null) c._cornersAgainst = (c._cornersAgainst || 0) + teamStats.opponentCorners;
  }
  team._matchSources.push({ matchId: fixture.IdMatch, opponent: opponentCode, date: fixture.Date || null, fifa: sourceUrl(fixture.IdStage, fixture.IdMatch), espn: summary ? espnUrl(team._espnMatchId) : null, stats: teamStats });
}

async function main() {
  const calendar = await fetchCalendar();
  const bridge = JSON.parse(fs.readFileSync(resolveDataPath('match_id_bridge.json'), 'utf8'));
  const byFifa = new Map(Object.values(bridge.bridge || {}).map(entry => [String(entry.fifa_match_id), String(entry.espn_match_id || entry.espn_id || '')]));
  const finished = calendar.filter(match => Number(match.MatchStatus) === 0 && match.IdMatch && match.IdStage);
  const teams = new Map();
  for (const fixture of finished) {
    for (const side of ['Home', 'Away']) {
      const team = fixture[side];
      if (team?.IdCountry && !teams.has(team.IdCountry)) {
        const name = team.TeamName?.find(x => x.Locale === 'en-GB')?.Description || team.IdCountry;
        const record = emptyTeam(team.IdCountry, name);
        record._matchSources = [];
        record._espnMatchId = byFifa.get(String(fixture.IdMatch)) || '';
        teams.set(team.IdCountry, record);
      }
    }
  }
  const fetched = await mapLimit(finished, 8, async fixture => {
    const live = await fetchLiveMatch(fixture.IdStage, fixture.IdMatch);
    const espnId = byFifa.get(String(fixture.IdMatch));
    let summary = null;
    if (espnId) { try { summary = await fetchJson(espnUrl(espnId)); } catch (_) {} }
    return { fixture, live, summary, espnId };
  });
  for (const item of fetched) {
    if (!item || item.error || !item.live) continue;
    for (const side of ['Home', 'Away']) {
      const code = item.fixture[side]?.IdCountry;
      const team = teams.get(code);
      if (!team) continue;
      team._espnMatchId = item.espnId || '';
      team.sources.fifa.push(sourceUrl(item.fixture.IdStage, item.fixture.IdMatch));
      if (item.summary) team.sources.espn.push(espnUrl(item.espnId));
      addTeamMatch(team, side === 'Home' ? 'home' : 'away', item.fixture, item.live, item.summary);
    }
  }

  const result = {};
  for (const [code, team] of teams) {
    const p = team.facts.possession;
    if (p.sampleMatches) { p.average = Number((p._sum / p.sampleMatches).toFixed(1)); p.status = p.sampleMatches >= 3 ? 'covered' : 'insufficient_sample'; }
    delete p._sum;
    const c = team.facts.setPieces;
    if (c.sampleMatches) { c.cornersFor = Number((c._cornersFor / c.sampleMatches).toFixed(1)); c.cornersAgainst = c._cornersAgainst == null ? null : Number((c._cornersAgainst / c.sampleMatches).toFixed(1)); c.status = c.sampleMatches >= 3 ? 'covered' : 'insufficient_sample'; }
    delete c._cornersFor; delete c._cornersAgainst;
    const qualifies = p.status === 'covered';
    // This is an observed possession descriptor, not a counter/pressing claim.
    if (qualifies && p.average >= 55) team.derivedTags.push('observed_possession_high');
    if (qualifies && p.average <= 45) team.derivedTags.push('observed_possession_low');
    const sourceUrls = [...new Set([...team.sources.fifa, ...team.sources.espn])];
    team.fieldEvidence = {
      formations: { source: 'fifa_official_live', sampleMatches: team.sampleMatches, sourceUrls: team.sources.fifa, ruleVersion: RULE_VERSION, retrievedAt: SOURCE_RETRIEVED_AT },
      startingXIChanges: { source: 'fifa_official_live', sampleMatches: team.sampleMatches, sourceUrls: team.sources.fifa, ruleVersion: RULE_VERSION, retrievedAt: SOURCE_RETRIEVED_AT },
      substitutions: { source: 'fifa_official_live', sampleMatches: team.sampleMatches, sourceUrls: team.sources.fifa, ruleVersion: RULE_VERSION, retrievedAt: SOURCE_RETRIEVED_AT },
      possession: { source: team.sources.espn.length ? 'espn_summary_fallback' : 'not_covered', sampleMatches: p.sampleMatches, sourceUrls: team.sources.espn, ruleVersion: RULE_VERSION, retrievedAt: SOURCE_RETRIEVED_AT },
      setPieces: { source: team.sources.espn.length ? 'espn_summary_fallback_corners_only' : 'not_covered', sampleMatches: c.sampleMatches, sourceUrls: team.sources.espn, ruleVersion: RULE_VERSION, retrievedAt: SOURCE_RETRIEVED_AT },
      discipline: { source: 'fifa_official_live', sampleMatches: team.facts.discipline.sampleMatches, sourceUrls: team.sources.fifa, ruleVersion: RULE_VERSION, retrievedAt: SOURCE_RETRIEVED_AT },
    };
    team.derivedTags.forEach(tag => team.tagEvidence.push({
      tag,
      season: team.season,
      sampleMatches: team.sampleMatches,
      calculationRule: tag === 'observed_possession_high' ? 'possession.sampleMatches >= 3 && possession.average >= 55' : 'possession.sampleMatches >= 3 && possession.average <= 45',
      ruleVersion: RULE_VERSION,
      sourceUrls,
      retrievedAt: SOURCE_RETRIEVED_AT,
      usedInModel: false,
      oosValidation: 'not_run',
    }));
    team.coverage.qualifiesForRule = false;
    team.sources.fifa = [...new Set(team.sources.fifa)];
    team.sources.espn = [...new Set(team.sources.espn)];
    team._matchSources = team._matchSources.slice(0, 100);
    team.matchSources = team._matchSources;
    delete team._matchSources;
    delete team._lastXI;
    delete team._espnMatchId;
    result[code] = team;
  }
  const output = { schemaVersion: 1, ruleVersion: RULE_VERSION, season: '2026', generatedAt: SOURCE_RETRIEVED_AT, sourcePolicy: 'FIFA official per-match feed; ESPN summary only for fields FIFA does not return', teams: result };
  const target = writeJsonAtomic('team_style_facts.json', output);
  console.log(`✅ wrote ${Object.keys(result).length} team fact records to ${target}`);
}

main().catch(error => { console.error(error); process.exit(1); });
