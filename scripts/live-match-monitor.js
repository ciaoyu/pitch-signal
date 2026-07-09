#!/usr/bin/env node
/**
 * Live Match Monitor — in-match real-time data collection + prediction + qualification scenario
 * 
 * Standalone script; does not affect the main server.js.
 * Usage: node scripts/live-match-monitor.js [--once] [--dry-run]
 * 
 * Features:
 *   1. Poll ESPN /scoreboard every 5 minutes, detect matches in progress
 *   2. Record snapshots at key moments: goal / water break (27-33', 72-78') / half-time (45') / full-time
 *   3. Call buildLiveAnalysis for in-match real-time probability adjustment
 *   4. Parallel same-group scores -> qualification.js qualification-probability change
 *   5. On goal -> compute immediate impact on parallel matches' qualification
 *
 * Output: data/live-snapshots/YYYY-MM-DD/matchId-MMDDHHmm.json
 * 
 * --once    run only once (for testing)
 * --dry-run do not write files, only print to stdout
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Load .env
require('../lib/env').loadEnv();

const { espn } = require('../services/espn');
const PredictionService = require('../lib/services/PredictionService');
const teamResolver = require('../lib/team_resolver');
const { buildPostMatchReview, savePostMatchReview, getSavedPostMatchReview } = require('../lib/postMatchReview');
const teamContext = require('../lib/teamContext');

const DATA_DIR = path.join(__dirname, '..', 'data', 'live-snapshots');
const TODAY = new Date().toISOString().slice(0, 10);
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Pre-match prediction cache (matchId -> prediction result), avoid recomputing on every poll
let predictionService = null;
const basePredictionCache = {};

function getPredictionService() {
  if (predictionService) return predictionService;
  let ratings = {};
  try { ratings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ratings.json'), 'utf8')).teams || {}; } catch {}
  const cache = {};
  const deps = { espn, getCached: (k) => cache[k], setCache: (k, v) => { cache[k] = v; }, TEAM_FLAGS: {}, RATINGS: { teams: ratings }, getTeamNameZh: (id) => id, getTeamNameI18n: () => null };
  predictionService = new PredictionService(deps);
  return predictionService;
}

async function getBasePrediction(matchId) {
  if (basePredictionCache[matchId]) return basePredictionCache[matchId];
  const ps = getPredictionService();
  try {
    const pred = await ps.predictMatch(matchId, { persist: false, bypassCache: true });
    if (!pred?.error) {
      basePredictionCache[matchId] = pred;
      return pred;
    }
  } catch {}
  return { homeWin: 0.46, draw: 0.247, awayWin: 0.293, goals: { homeExpected: 2.7, awayExpected: 2.3 } };
}

// Key time points (minutes)
const HYDRATION_WINDOWS = [
  { start: 27, end: 33, label: 'first_half_hydration' },
  { start: 72, end: 78, label: 'second_half_hydration' },
];
const HALFTIME_MINUTE = 45;
const EXTRA_TIME_FIRST_HALF_MINUTE = 105;
const EXTRA_TIME_SECOND_HALF_MINUTE = 120;

// CLI arguments
const args = process.argv.slice(2);
const ONCE = args.includes('--once');
const DRY_RUN = args.includes('--dry-run');

// State tracking (compare across poll rounds)
const matchState = {};  // matchId → { score, minute, lastTrigger, lastGoalMinute }
const liveTimelineState = {}; // matchId → array of snapshot summaries

// ============================================================
// buildLiveAnalysis (extracted from prediction.js, self-contained)
// ============================================================

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function normalizeThreeWay(h, d, a) {
  const t = h + d + a;
  return t > 0
    ? { homeWin: h / t, draw: d / t, awayWin: a / t }
    : { homeWin: 0.333, draw: 0.334, awayWin: 0.333 };
}

function safeTeamName(name) {
  return String(name || '').trim().toLowerCase();
}

async function fetchMatchOdds(match) {
  const apiKey = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY || '';
  if (!apiKey) return { source: 'api_key_not_configured' };

  const url = new URL('https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'uk,eu');
  url.searchParams.set('markets', 'h2h,spreads,totals');
  url.searchParams.set('oddsFormat', 'decimal');

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) return { source: 'odds_fetch_failed', error: `HTTP ${res.status}` };
  const games = await res.json();
  if (!Array.isArray(games)) return { source: 'odds_invalid_payload' };

  const homeName = safeTeamName(match.home.name);
  const awayName = safeTeamName(match.away.name);
  const homeResolved = teamResolver.resolve(match.home.name)?.official_name || match.home.name;
  const awayResolved = teamResolver.resolve(match.away.name)?.official_name || match.away.name;

  let game = games.find((g) => {
    const gh = safeTeamName(g.home_team);
    const ga = safeTeamName(g.away_team);
    return (gh === homeName && ga === awayName) || (gh === safeTeamName(homeResolved) && ga === safeTeamName(awayResolved));
  });

  if (!game) {
    game = games.find((g) => {
      const gh = safeTeamName(g.home_team);
      const ga = safeTeamName(g.away_team);
      return gh.includes(homeName.split(' ').slice(-1)[0]) && ga.includes(awayName.split(' ').slice(-1)[0]);
    }) || null;
  }

  if (!game) return { source: 'no_match_found' };

  const h2h = game.bookmakers?.[0]?.markets?.find((m) => m.key === 'h2h');
  const outcomes = h2h?.outcomes || [];
  const h = outcomes.find((o) => safeTeamName(o.name) === safeTeamName(game.home_team));
  const d = outcomes.find((o) => safeTeamName(o.name) === 'draw');
  const a = outcomes.find((o) => safeTeamName(o.name) === safeTeamName(game.away_team));

  const total = (h?.price ? 1 / h.price : 0) + (d?.price ? 1 / d.price : 0) + (a?.price ? 1 / a.price : 0);
  const implied = total > 0 && h?.price && d?.price && a?.price ? {
    home: `${((1 / h.price) / total * 100).toFixed(1)}%`,
    draw: `${((1 / d.price) / total * 100).toFixed(1)}%`,
    away: `${((1 / a.price) / total * 100).toFixed(1)}%`,
    vig: `${((total - 1) * 100).toFixed(1)}%`,
  } : null;

  return {
    source: 'the-odds-api',
    lastUpdated: new Date().toISOString(),
    homeWin: h?.price ?? null,
    draw: d?.price ?? null,
    awayWin: a?.price ?? null,
    impliedProb: implied,
    bookmakers: (game.bookmakers || []).map((bm) => bm.title || bm.key || '?').slice(0, 5),
    overUnder: (() => {
      const totals = game.bookmakers?.[0]?.markets?.find((m) => m.key === 'totals');
      const over = totals?.outcomes?.find((o) => safeTeamName(o.name) === 'over');
      const under = totals?.outcomes?.find((o) => safeTeamName(o.name) === 'under');
      const line = totals?.outcomes?.find((o) => o.point != null)?.point ?? 2.5;
      return { line, over: over?.price ?? null, under: under?.price ?? null };
    })(),
  };
}

function buildLiveAnalysis(basePrediction, matchMeta, liveStats = {}) {
  const minute = clamp(toNumber(liveStats.minute) ?? 0, 0, 120);
  const homeScore = toNumber(liveStats.homeScore) ?? 0;
  const awayScore = toNumber(liveStats.awayScore) ?? 0;
  const homeShots = toNumber(liveStats.homeShots) ?? 0;
  const awayShots = toNumber(liveStats.awayShots) ?? 0;
  const homeSot = toNumber(liveStats.homeShotsOnTarget) ?? 0;
  const awaySot = toNumber(liveStats.awayShotsOnTarget) ?? 0;
  const homePoss = toNumber(liveStats.homePossession);
  const awayPoss = toNumber(liveStats.awayPossession);
  const homeReds = toNumber(liveStats.homeRedCards) ?? 0;
  const awayReds = toNumber(liveStats.awayRedCards) ?? 0;
  const homeYellows = toNumber(liveStats.homeYellowCards) ?? 0;
  const awayYellows = toNumber(liveStats.awayYellowCards) ?? 0;

  const baseH = Number(basePrediction.homeWin || 0.333);
  const baseD = Number(basePrediction.draw || 0.334);
  const baseA = Number(basePrediction.awayWin || 0.333);
  const scoreDiff = homeScore - awayScore;
  const timeFactor = minute / 90;

  let edge = 0;
  edge += scoreDiff * (0.16 + 0.20 * timeFactor);
  edge += clamp(homeShots - awayShots, -8, 8) * 0.008;
  edge += clamp(homeSot - awaySot, -5, 5) * 0.03;
  edge += (homePoss != null && awayPoss != null) ? clamp((homePoss - awayPoss) / 100, -0.7, 0.7) * 0.10 : 0;
  edge += clamp(awayYellows - homeYellows, -3, 3) * 0.01;
  edge += clamp(awayReds - homeReds, -1, 1) * 0.18;

  let aH = baseH + edge, aA = baseA - edge * 0.82, aD = baseD - Math.abs(edge) * 0.45;
  if (scoreDiff >= 2 && minute >= 15) aD -= 0.04;
  if (scoreDiff <= -2 && minute >= 15) aD -= 0.04;
  if (scoreDiff === 0 && minute < 25) aD += 0.02;
  aH = clamp(aH, 0.01, 0.985); aA = clamp(aA, 0.01, 0.985); aD = clamp(aD, 0.01, 0.60);
  const n = normalizeThreeWay(aH, aD, aA);

  return {
    minute, score: { home: homeScore, away: awayScore },
    probabilities: n,
    expectedGoals: {
      home: Math.round(Math.max(homeScore, Number(basePrediction.goals?.homeExpected || 0) + Math.max(0, homeShots - awayShots) * 0.08) * 10) / 10,
      away: Math.round(Math.max(awayScore, Number(basePrediction.goals?.awayExpected || 0) + Math.max(0, awayShots - homeShots) * 0.06) * 10) / 10,
    },
    signals: { scoreDiff, shotDiff: homeShots - awayShots },
    stateShift: scoreDiff >= 2 ? 'reinforced' : (scoreDiff !== 0 ? 'lean_reinforced' : 'still_live'),
  };
}

// ============================================================
// ESPN data fetching
// ============================================================

async function fetchLiveMatches() {
  const sb = await espn('/scoreboard', `live_${Date.now()}`, 30000);
  const events = sb.events || [];
  const live = [];
  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const status = comp.status?.type;
    if (status?.state !== 'in') continue;  // only in-progress

    const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away');

    // Extract minutes from status.detail: "35'" -> 35
    const minuteStr = String(status?.detail || '').replace(/[^0-9]/g, '');
    const minute = Number(minuteStr) || 0;

    // Extract stats from competitors (available both post- and in-match)
    const homeStats = {};
    const awayStats = {};
    for (const s of (homeComp?.statistics || [])) homeStats[s.name] = s.displayValue || s.value;
    for (const s of (awayComp?.statistics || [])) awayStats[s.name] = s.displayValue || s.value;

    // Extract goal / red-yellow card events from comp.details
    const details = (comp.details || []).map(d => ({
      type: d.type?.text || String(d.type || ''),
      minute: d.clock?.displayValue || '',
      team: d.team?.displayName || '',
      player: d.athletesInvolved?.[0]?.displayName || '',
      text: d.text || '',
    }));

    live.push({
      matchId: e.id,
      home: {
        id: homeComp?.team?.id,
        name: homeComp?.team?.displayName,
        score: Number(homeComp?.score || 0),
        stats: homeStats,
      },
      away: {
        id: awayComp?.team?.id,
        name: awayComp?.team?.displayName,
        score: Number(awayComp?.score || 0),
        stats: awayStats,
      },
      minute,
      statusDetail: status?.detail || '',
      venue: comp.venue?.fullName || '',
      details,
      group: comp.group?.displayName || null,
    });
  }
  return live;
}

// ============================================================
// Trigger determination (vs previous snapshot)
// ============================================================

function classifyTrigger(matchId, current) {
  const prev = matchState[matchId];
  if (!prev) return 'first_sight';  // first sighting

  const prevScore = prev.score?.home ?? 0 + '' + prev.score?.away ?? 0;
  const curScore = current.home.score + '' + current.away.score;

  // Goal
  if (curScore !== prevScore) return 'goal';

  // Half-time
  if (current.minute >= HALFTIME_MINUTE && (prev.minute || 0) < HALFTIME_MINUTE) return 'halftime';

  // Water break window
  for (const w of HYDRATION_WINDOWS) {
    if (current.minute >= w.start && current.minute <= w.end &&
        !((prev.minute || 0) >= w.start && (prev.minute || 0) <= w.end)) {
      return w.label;
    }
  }

  // Full-time
  if (current.minute >= 90 && (prev.minute || 0) < 90) return 'fulltime';

  // Extra-time nodes (knockout only)
  if (current.minute >= EXTRA_TIME_FIRST_HALF_MINUTE && (prev.minute || 0) < EXTRA_TIME_FIRST_HALF_MINUTE) return 'extra_time_first_half';
  if (current.minute >= EXTRA_TIME_SECOND_HALF_MINUTE && (prev.minute || 0) < EXTRA_TIME_SECOND_HALF_MINUTE) return 'extra_time_second_half';

  // Every 5 minutes (periodic)
  const minuteDiff = current.minute - (prev.minute || 0);
  if (minuteDiff >= 5) return 'periodic';

  return null;  // no snapshot needed
}

// ============================================================
// Qualification scenario calculation (lightweight)
// ============================================================

async function computeGroupImpact(matchData, allLive) {
  try {
    const sim = new QualificationSimulator({ simulations: 5000 });
    const groups = sim.loadGroups();  // load real groups from DB
    const impact = {};
    for (const group of groups) {
      const result = sim.simulateGroup(group);
      const homeTeam = matchData.home.name;
      const awayTeam = matchData.away.name;
      for (const [teamId, stats] of Object.entries(result)) {
        if (teamId.includes(homeTeam) || teamId.includes(awayTeam)) {
          impact[teamId] = {
            qualifyPct: Math.round((stats.qualifyProb || 0) * 100),
            runnerUpPct: Math.round((stats.runnerUpProb || 0) * 100),
          };
        }
      }
    }
    return Object.keys(impact).length ? impact : null;
  } catch (e) {
    return { error: e.message };
  }
}

// ============================================================
// Snapshot writing
// ============================================================

function saveSnapshot(snapshot) {
  if (DRY_RUN) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  const dir = path.join(DATA_DIR, TODAY, snapshot.matchId);
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const filename = `${ts}_${snapshot.trigger}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(snapshot, null, 2));
  console.log(`  💾 saved: ${dir}/${filename}`);
}

function appendLiveTimeline(matchId, snapshot) {
  if (!liveTimelineState[matchId]) liveTimelineState[matchId] = [];
  liveTimelineState[matchId].push({
    minute: snapshot.minute,
    trigger: snapshot.trigger,
    score: `${snapshot.home.score}-${snapshot.away.score}`,
    home: { name: snapshot.home.name, score: snapshot.home.score },
    away: { name: snapshot.away.name, score: snapshot.away.score },
    summary: snapshot.summary,
    analysis: snapshot.summary,
    odds: snapshot.odds || null,
  });
  if (liveTimelineState[matchId].length > 20) liveTimelineState[matchId] = liveTimelineState[matchId].slice(-20);
  return liveTimelineState[matchId];
}

async function buildKickoffContext(match, basePrediction) {
  const [homeNews, awayNews] = await Promise.allSettled([
    teamContext.requestTeamNews(match.home.id || match.home.name),
    teamContext.requestTeamNews(match.away.id || match.away.name),
  ]);
  const homeItems = homeNews.status === 'fulfilled' ? homeNews.value : [];
  const awayItems = awayNews.status === 'fulfilled' ? awayNews.value : [];
  const newsText = [...homeItems, ...awayItems].slice(0, 3).join('；');
  return {
    labelI18n: { zh: '开场预测', en: 'Kickoff forecast' },
    summaryI18n: {
      zh: `赛前基线：主胜 ${Math.round((basePrediction.homeWin || 0) * 100)}%，平 ${Math.round((basePrediction.draw || 0) * 100)}%，客胜 ${Math.round((basePrediction.awayWin || 0) * 100)}%。最新消息：${newsText || '暂无可用新闻。'}`,
      en: `Pre-match baseline: home ${Math.round((basePrediction.homeWin || 0) * 100)}%, draw ${Math.round((basePrediction.draw || 0) * 100)}%, away ${Math.round((basePrediction.awayWin || 0) * 100)}%. Latest news: ${newsText || 'No usable news available.'}`,
    },
    news: { home: homeItems.slice(0, 3), away: awayItems.slice(0, 3) },
  };
}

function persistLiveReview(snapshot, basePrediction, timeline) {
  const existing = getSavedPostMatchReview(snapshot.matchId) || {};
  const review = buildPostMatchReview({
    matchId: snapshot.matchId,
    match: {
      homeId: existing.match?.home?.id || snapshot.home.id || null,
      awayId: existing.match?.away?.id || snapshot.away.id || null,
      homeName: snapshot.home.name,
      awayName: snapshot.away.name,
      homeScore: snapshot.home.score,
      awayScore: snapshot.away.score,
      status: 'STATUS_IN_PROGRESS',
      date: snapshot.timestamp,
      venue: snapshot.venue || '',
      completed: false,
    },
    snapshot: {
      matchId: snapshot.matchId,
      homeWin: basePrediction.homeWin,
      draw: basePrediction.draw,
      awayWin: basePrediction.awayWin,
      predictedScore: basePrediction.likelyScore || null,
      homeExpectedGoals: basePrediction.goals?.homeExpected ?? null,
      awayExpectedGoals: basePrediction.goals?.awayExpected ?? null,
      createdAt: new Date().toISOString(),
      source: 'live-monitor',
    },
    evidence: {
      liveSnapshots: timeline,
      timeline,
      events: snapshot.details || [],
    },
    generatedBy: 'live-monitor',
  });
  review.status = 'live_tracking';
  review.liveTimelineI18n = timeline;
  review.liveSnapshots = timeline;
  if (!DRY_RUN) savePostMatchReview(snapshot.matchId, review);
}

// ============================================================
// Main loop
// ============================================================

async function pollOnce() {
  const now = new Date();
  console.log(`\n🔍 [${now.toISOString().slice(11, 19)}] Polling ESPN scoreboard...`);

  let live;
  try {
    live = await fetchLiveMatches();
  } catch (e) {
    console.error('  ❌ ESPN fetch failed:', e.message);
    return;
  }

  if (live.length === 0) {
    console.log('  ⏸  No live matches');
    return;
  }

  console.log(`  ⚽ ${live.length} live match(es)`);

  for (const m of live) {
    const trigger = classifyTrigger(m.matchId, m);
    if (!trigger) {
      // console.log(`  ${m.matchId} ${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name} @ ${m.minute}' — no trigger`);
      continue;
    }

    console.log(`  📍 ${m.matchId} ${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name} @ ${m.minute}' — trigger: ${trigger}`);

    // Read real pre-match prediction from PredictionService (cached after first call)
    let basePrediction;
    try {
      basePrediction = await getBasePrediction(m.matchId);
    } catch (e) {
      basePrediction = { homeWin: 0.46, draw: 0.247, awayWin: 0.293, goals: { homeExpected: 2.7, awayExpected: 2.3 } };
    }

    const liveAnalysis = buildLiveAnalysis(basePrediction, {
      homeName: m.home.name,
      awayName: m.away.name,
    }, {
      minute: m.minute,
      homeScore: m.home.score,
      awayScore: m.away.score,
      homeShots: Number(m.home.stats.totalShots || 0),
      awayShots: Number(m.away.stats.totalShots || 0),
      homeShotsOnTarget: Number(m.home.stats.shotsOnTarget || 0),
      awayShotsOnTarget: Number(m.away.stats.shotsOnTarget || 0),
      homePossession: Number(m.home.stats.possessionPct || null),
      awayPossession: Number(m.away.stats.possessionPct || null),
    });

    // Qualification scenario (only valid for final round)
    let groupImpact = null;
    try {
      groupImpact = await computeGroupImpact(m, live);
    } catch {}

    // Assemble snapshot
    const snapshot = {
      timestamp: now.toISOString(),
      matchId: m.matchId,
      trigger,
      minute: m.minute,
      home: { name: m.home.name, score: m.home.score, stats: m.home.stats },
      away: { name: m.away.name, score: m.away.score, stats: m.away.stats },
      odds: null,
      livePrediction: liveAnalysis,
      groupImpact,
      details: m.details,
      venue: m.venue,
    };

    if (trigger === 'first_sight') {
      snapshot.kickoffContext = await buildKickoffContext(m, basePrediction);
    }

    try {
      snapshot.odds = await fetchMatchOdds(m);
    } catch (e) {
      snapshot.odds = { source: 'odds_fetch_error', error: e.message };
    }

    // Generate real-time text analysis
    snapshot.summary = generateSummary(snapshot, basePrediction, live);
    const timeline = appendLiveTimeline(m.matchId, snapshot);
    saveSnapshot(snapshot);
    persistLiveReview(snapshot, basePrediction, timeline);

    // Print to console
    console.log('');
    console.log(snapshot.summary);
    console.log('');

    if (trigger === 'fulltime' && !DRY_RUN) {
      const finalSummary = buildFinalMatchSummary(m.matchId);
      if (finalSummary) {
        const dir = path.join(DATA_DIR, TODAY, m.matchId);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'final-summary.json'), JSON.stringify(finalSummary, null, 2));
        console.log(`  🧾 final summary saved: ${dir}/final-summary.json`);
      }
    }

    // Update state
    matchState[m.matchId] = {
      score: { home: m.home.score, away: m.away.score },
      minute: m.minute,
      lastTrigger: trigger,
      lastGoalMinute: trigger === 'goal' ? m.minute : (matchState[m.matchId]?.lastGoalMinute || 0),
    };
  }
}

// ============================================================
// Real-time text analysis generation
// ============================================================

const GROUP_TAG = {
  '760462': 'E', '760463': 'E', '760464': 'E', '760465': 'E',
  '760466': 'F', '760467': 'F',
  '760468': 'G', '760473': 'G', '760471': 'G', '760472': 'G',
  '760469': 'H', '760470': 'H',
};

// Historical snapshot queue (last 5 of same match, for trend analysis)
const recentSnapshots = {};
function pushRecent(matchId, snap) {
  if (!recentSnapshots[matchId]) recentSnapshots[matchId] = [];
  recentSnapshots[matchId].push(snap);
  if (recentSnapshots[matchId].length > 5) recentSnapshots[matchId].shift();
}
function getRecent(matchId) { return recentSnapshots[matchId] || []; }

function pct(v) { return Math.round(v * 1000) / 10 + '%'; }

// Simple Monte-Carlo full-time score simulation with Poisson (200 runs)
function poissonSample(lambda) {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function simulateFinalScores(homeXG, awayXG, runs = 200) {
  let hw = 0, d = 0, aw = 0;
  for (let i = 0; i < runs; i++) {
    const h = poissonSample(homeXG), a = poissonSample(awayXG);
    if (h > a) hw++; else if (h < a) aw++; else d++;
  }
  return { homeWin: hw / runs, draw: d / runs, awayWin: aw / runs };
}

function generateSummary(snapshot, basePrediction, allLive) {
  const { matchId, trigger, minute } = snapshot;
  const hs = snapshot.home.score, as = snapshot.away.score;
  const hn = snapshot.home.name, an = snapshot.away.name;
  const p = snapshot.livePrediction.probabilities;
  const base = { h: basePrediction.homeWin, d: basePrediction.draw, a: basePrediction.awayWin };
  const group = GROUP_TAG[matchId] || '?';
  const diff = hs - as;
  const remaining = Math.max(0, 90 - minute);
  const prevSnap = getRecent(matchId).slice(-1)[0];
  pushRecent(matchId, snapshot);

  // Trigger labels (zh)
  const triggerLabel = {
    first_sight: '🔍 开球',
    goal: '⚽ 进球',
    halftime: '⏱ 半场',
    first_half_hydration: '💧 上半场补水',
    second_half_hydration: '💧 下半场补水',
    extra_time_first_half: '➕ 加时上半场',
    extra_time_second_half: '➕ 加时下半场',
    fulltime: '🏁 终场',
    periodic: '📊 ' + minute + "'",
  }[trigger] || trigger;

  let lines = [];
  lines.push(`【${triggerLabel}】${hn} ${hs}-${as} ${an}（${minute}'）`);

  // Probability
  const hShift = p.homeWin - base.h;
  lines.push(`  胜平负: 主胜${pct(p.homeWin)}（${hShift >= 0 ? '+' : ''}${pct(hShift)}）平局${pct(p.draw)} 客胜${pct(p.awayWin)}`);

  // ---- Trend (vs previous snapshot) ----
  if (prevSnap && prevSnap.livePrediction) {
    const pp = prevSnap.livePrediction.probabilities;
    const dp = p.homeWin - pp.homeWin;
    if (Math.abs(dp) > 0.01) {
      lines.push(`  📈 趋势（vs ${prevSnap.minute}'）: 主胜${dp > 0 ? '↑' : '↓'}${pct(Math.abs(dp))}`);
    }
  }

  // ---- Match performance analysis ----
  const shots = Number(snapshot.home.stats?.totalShots || 0) + Number(snapshot.away.stats?.totalShots || 0);
  const sot  = Number(snapshot.home.stats?.shotsOnTarget || 0) + Number(snapshot.away.stats?.shotsOnTarget || 0);
  const poss = Number(snapshot.home.stats?.possessionPct || 0);
  if (shots > 0) {
    const hShots = Number(snapshot.home.stats?.totalShots || 0);
    const aShots = Number(snapshot.away.stats?.totalShots || 0);
    const hSot   = Number(snapshot.home.stats?.shotsOnTarget || 0);
    const aSot   = Number(snapshot.away.stats?.shotsOnTarget || 0);
    const possDesc = poss > 55 ? `${hn} 掌控球权（${Math.round(poss)}%）` : poss < 45 ? `${an} 掌控球权（${Math.round(100 - poss)}%）` : '球权均势';
    const shotDesc = hShots > aShots + 3 ? `${hn} 射门压制（${hShots}-${aShots}）` : aShots > hShots + 3 ? `${an} 射门压制（${aShots}-${hShots}）` : `射门接近（${hShots}-${aShots}）`;
    const effH = hShots > 0 ? Math.round(hs / hShots * 100) : 0;
    const effA = aShots > 0 ? Math.round(as / aShots * 100) : 0;
    const effDesc = hs > 0 && effH > 25 ? `${hn} 转化率极高（${effH}%）` : as > 0 && effA > 25 ? `${an} 转化率极高（${effA}%）` : '';
    lines.push(`  📊 场面: ${possDesc}，${shotDesc}${effDesc ? '，' + effDesc : ''}`);
  }

  // ---- Goal timing analysis ----
  if (trigger === 'goal') {
    const prevScore = prevSnap ? `${prevSnap.home.score}-${prevSnap.away.score}` : '?-?';
    if (diff > 0) {
      lines.push(`  ⚡ ${hn} 进球！比分从 ${prevScore} 变为 ${hs}-${as}`);
      if (minute <= 15) lines.push(`  📌 早早进球，${an} 需要立即反扑，比赛节奏将被改变`);
      else if (minute >= 75) lines.push(`  📌 绝杀时刻！${an} 所剩时间极少，翻盘概率极低`);
      else lines.push(`  📌 ${hn} 占据主动，${an} 需要至少追回一球`);
    } else if (diff < 0) {
      lines.push(`  ⚡ ${an} 进球！比分从 ${prevScore} 变为 ${hs}-${as}`);
      if (minute >= 75) lines.push(`  📌 晚段进球！${hn} 主场落后，形势严峻`);
      else lines.push(`  📌 ${an} 反客为主，${hn} 需要回应`);
    } else {
      lines.push(`  ⚡ 扳平！比分从 ${prevScore} 回到 ${hs}-${as}`);
      lines.push(`  📌 平局重开悬念，双方回到同一起跑线`);
    }
  }

  // ---- Half-time summary ----
  if (trigger === 'halftime') {
    if (diff > 0) {
      lines.push(`  📌 半场结束，${hn} 领先。下半场${an}必须加强进攻，阵型可能前压，留出反击空间`);
      lines.push(`  📌 预计下半场: ${an} 博命式进攻 vs ${hn} 防守反击，比赛节奏将明显加快`);
    } else if (diff < 0) {
      lines.push(`  📌 半场结束，${an} 客场领先。${hn} 主场压力巨大，下半场必然全力反扑`);
    } else {
      lines.push(`  📌 半场平局，${remaining} 分钟剩余。双方教练都可能在下半场做出关键换人`);
      lines.push(`  📌 预计下半场: 体能下降+换人增兵，进球窗口在 60-80'`);
    }
  }

  // ---- Water break window analysis ----
  if (trigger === 'first_half_hydration' || trigger === 'second_half_hydration') {
    const half = trigger === 'first_half_hydration' ? '上半场' : '下半场';
    const minLeft = trigger === 'first_half_hydration' ? 45 - minute : 90 - minute;
    lines.push(`  💧 ${half}补水（${minLeft}' 剩余），教练组抓紧时间调整`);
    if (diff === 0) lines.push(`  📌 僵局阶段，补水后往往是打破平衡的关键时刻（历史上30%进球在补水后10分钟内出现）`);
    else if (Math.abs(diff) === 1) lines.push(`  📌 一球差距，补水后落后方大概率加码进攻`);
  }

  // ---- Full-time summary ----
  if (trigger === 'fulltime') {
    if (diff > 0) {
      lines.push(`  🏆 ${hn} 主场全取三分！赛前预测主胜${pct(base.h)}，最终兑现`);
    } else if (diff < 0) {
      lines.push(`  🏆 ${an} 客场逆转！赛前客胜仅${pct(base.a)}，重大冷门`);
    } else {
      lines.push(`  🤝 握手言和，各取一分。赛前预测平局${pct(base.d)}`);
    }
    lines.push(`  📌 最终概率 vs 赛前: 主胜${pct(base.h)}→${pct(p.homeWin)} | 客胜${pct(base.a)}→${pct(p.awayWin)}`);
  }

  if (snapshot.odds && snapshot.odds.source && snapshot.odds.source !== 'api_key_not_configured') {
    const odds = snapshot.odds;
    const priceDesc = odds.homeWin && odds.draw && odds.awayWin
      ? `  📈 赔率: 主胜${odds.homeWin} 平${odds.draw} 客胜${odds.awayWin}`
      : `  📈 赔率: ${odds.source}`;
    lines.push(priceDesc);
    if (odds.impliedProb) {
      lines.push(`  📉 隐含概率: 主${odds.impliedProb.home} 平${odds.impliedProb.draw} 客${odds.impliedProb.away}${odds.impliedProb.vig ? ` | 水位${odds.impliedProb.vig}` : ''}`);
    }
  }

  if (trigger === 'extra_time_first_half') {
    lines.push(`  ➕ 进入加时赛上半场，常规时间无法分出胜负。体能、换人深度和定位球质量开始放大作用。`);
    if (diff === 0) lines.push(`  📌 平局被延长，任何一次失误都可能直接决定胜负。`);
  }

  if (trigger === 'extra_time_second_half') {
    lines.push(`  ➕ 进入加时赛下半场，比赛接近终局。若仍平局，点球大战概率上升。`);
    if (diff === 0) lines.push(`  📌 双方都已接近极限，下一次有效射门的价值被放大。`);
  }

  // ---- Predict full-time trajectory (remaining-time simulation) ----
  if (trigger !== 'fulltime' && minute >= 60 && remaining > 0) {
    const xgH = Math.max(hs, (basePrediction.goals?.homeExpected || 2.0) * (minute / 90));
    const xgA = Math.max(as, (basePrediction.goals?.awayExpected || 1.5) * (minute / 90));
    const sim = simulateFinalScores(xgH * (90 / Math.max(minute, 1)), xgA * (90 / Math.max(minute, 1)), 300);
    lines.push(`  🔮 剩余 ${remaining}' 推演: 维持现状${pct(sim.homeWin)} | 翻盘${pct(sim.awayWin)} | 平局${pct(sim.draw)}`);
  }

  // ---- Parallel same-group matches ----
  const parallelMatch = allLive.find(l => l.matchId !== matchId && GROUP_TAG[l.matchId] === group);
  if (parallelMatch) {
    const ph = parallelMatch.home.name, pa = parallelMatch.away.name;
    const pScore = parallelMatch.home.score, pScoreA = parallelMatch.away.score;
    lines.push('');
    lines.push(`  🔗 同组平行场: ${ph} ${pScore}-${pScoreA} ${pa}（${parallelMatch.minute}'）`);

    // Impact of parallel-match goals on this match
    const pParallelPrev = getRecent(parallelMatch.matchId).slice(-1)[0];
    if (pParallelPrev && (pScore !== pParallelPrev.home.score || pScoreA !== pParallelPrev.away.score)) {
      lines.push(`  ⚠️ 平行场刚刚进球！这对本场两队的出线形势产生了直接影响`);
    }

    // Current points simulation for the four teams
    lines.push(`  📊 当前比分组合下四队出线推演:`);
    // Example with Group E (actual calc uses qualification.js)
    if (snapshot.groupImpact && !snapshot.groupImpact.error) {
      for (const [team, info] of Object.entries(snapshot.groupImpact)) {
        const status = info.qualifyPct >= 75 ? '🟢 晋级在望' : info.qualifyPct >= 40 ? '🟡 形势胶着' : '🔴 危险';
        lines.push(`    → ${team}: ${status}（${info.qualifyPct}%）`);
      }
    } else {
      lines.push(`    → （蒙特卡洛出线计算未就绪，仅基于当前比分直推）`);
      // Simplified judgment
      if (diff > 0 && hs - as >= 2) lines.push(`    → ${hn} 大胜概率高，大概率锁定出线`);
      if (diff === 0 && pScore === pScoreA) lines.push(`    → 两场均平局，四队形势极度紧张，净胜球成关键`);
      if (diff > 0 && pScore > pScoreA) lines.push(`    → 两场主队均领先，主队出线组合非常有利`);
      if (diff > 0 && pScore < pScoreA) lines.push(`    → ${hn} 领先但平行场${pa}也在赢，出线仍存变数`);
    }
  } else {
    lines.push(`  🔗 本组无同时进行的平行场`);
  }

  // ---- Special impact on parallel-match situation (when this match scores) ----
  if (parallelMatch && trigger === 'goal') {
    const pg = GROUP_TAG[parallelMatch.matchId];
    const pDiff = parallelMatch.home.score - parallelMatch.away.score;
    lines.push('');
    if (diff > 0 && hs >= 2) {
      lines.push(`  💥 ${hn} 大比分领先！平行场 ${parallelMatch.home.name} 的出线形势被动——除非他们自己也大比分领先`);
    }
    if (diff === 0 && hs >= 1) {
      lines.push(`  💥 本场追平！平行场两队压力倍增——平局组合下四队命运交织`);
    }
    lines.push(`  ⏳ 距离本组最终排名确定还有 ${remaining}'，任何进球都可能彻底改变出线格局`);
  }

  return lines.join('\n');
}

function buildFinalMatchSummary(matchId) {
  const snaps = getRecent(matchId);
  if (!snaps.length) return null;
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  return {
    matchId,
    startedAt: first.timestamp,
    endedAt: last.timestamp,
    finalScore: `${last.home.score}-${last.away.score}`,
    finalMinute: last.minute,
    snapshotCount: snaps.length,
    keyTriggers: snaps.map(s => ({
      minute: s.minute,
      trigger: s.trigger,
      score: `${s.home.score}-${s.away.score}`,
    })),
    goals: snaps
      .filter(s => s.trigger === 'goal')
      .map(s => ({
        minute: s.minute,
        score: `${s.home.score}-${s.away.score}`,
        home: s.home.name,
        away: s.away.name,
      })),
    finalSummary: last.summary,
  };
}

// ============================================================
// Startup
// ============================================================

async function main() {
  console.log('🏟️  Live Match Monitor started');
  console.log(`   mode: ${ONCE ? 'single run' : 'continuous (5min interval)'}`);
  console.log(`   dry-run: ${DRY_RUN}`);
  console.log(`   output: ${DRY_RUN ? 'stdout' : path.join(DATA_DIR, TODAY)}`);
  console.log('');

  if (ONCE) {
    await pollOnce();
    console.log('\n✅ Single run complete');
    return;
  }

  // Continuous mode
  await pollOnce();
  const timer = setInterval(pollOnce, POLL_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    clearInterval(timer);
    // Write final summary
    const summary = { endedAt: new Date().toISOString(), trackedMatches: Object.keys(matchState), finalState: matchState };
    if (!DRY_RUN) {
      const dir = path.join(DATA_DIR, TODAY);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'session-summary.json'), JSON.stringify(summary, null, 2));
      console.log('📊 Session summary saved');
    }
    process.exit(0);
  });
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
