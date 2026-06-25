#!/usr/bin/env node
'use strict';

/**
 * 赛后参考预测回填脚本
 *
 * 为所有 kickoff_passed 比赛生成当前模型的回溯模拟预测,
 * 存入 retrospective_predictions 表 (而非 prediction_snapshots)。
 *
 * 用法:
 *   node scripts/backfill-retrospective-predictions.js           # 回填全部
 *   node scripts/backfill-retrospective-predictions.js --dry-run # 预览
 *   node scripts/backfill-retrospective-predictions.js --clear   # 清空后重填
 *   node scripts/backfill-retrospective-predictions.js --match 760414  # 单场
 */

const path = require('path');
const { loadEnv } = require('../lib/env');
loadEnv();

const { db, saveRetrospectivePrediction, getRetrospectivePrediction, clearRetrospectivePredictions } = require('../lib/db');
const PredictionEngine = require('../lib/prediction');
const teamResolver = require('../lib/team_resolver');

// Load ratings
let RATINGS = {};
try {
  const loader = require('../data/loader');
  loader.init();
  RATINGS = loader.getRatings();
} catch {
  try {
    RATINGS = JSON.parse(require('fs').readFileSync(path.join(__dirname, '..', 'data', 'ratings.json'), 'utf8'));
  } catch {}
}

// Load team name map from DB
function getTeamNameFromDB(espnId) {
  try {
    const row = db.prepare('SELECT full_name, short_name FROM team_name_map WHERE espn_id = ?').get(String(espnId));
    return row?.full_name || row?.short_name || null;
  } catch {
    return null;
  }
}

function getTeamNameZh(teamId) {
  const resolved = teamResolver.resolve(teamId);
  const id = resolved?.ratings_id || String(teamId);
  const team = RATINGS.teams?.[id];
  if (team?.name) return team.name;
  const dbName = getTeamNameFromDB(teamId);
  if (dbName) return dbName;
  return String(teamId);
}

function getRatingTeam(input) {
  const ratingsId = teamResolver.resolve(input)?.ratings_id || String(input || '');
  return { ratingsId, team: RATINGS.teams?.[ratingsId] || RATINGS.teams?.[String(input || '')] };
}

function calcAvg(team) {
  if (team?.rating) {
    return {
      rating: team.rating,
      attack_strength: team.attack_strength || 1.0,
      defense_strength: team.defense_strength || 1.0,
    };
  }
  const players = team?.players || [];
  if (!players.length) return { rating: 1500, attack_strength: 1.0, defense_strength: 1.0 };
  const avg = players.reduce((s, p) => s + (p.rating || 70), 0) / players.length;
  const atk = players.filter(p => ['LW','RW','ST','CF','F','AM','CAM'].includes(p.pos));
  const def = players.filter(p => ['GK','CB','LB','RB','LWB','RWB','D'].includes(p.pos));
  const atkAvg = atk.length ? atk.reduce((s, p) => s + (p.rating || 70), 0) / atk.length : avg;
  const defAvg = def.length ? def.reduce((s, p) => s + (p.rating || 70), 0) / def.length : avg;
  return {
    rating: Math.round(avg * 10) + 1000,
    attack_strength: Math.round((atkAvg / 75) * 1000) / 1000,
    defense_strength: Math.round((defAvg / 75) * 1000) / 1000,
  };
}

function parseArgs(argv) {
  const args = { dryRun: false, clear: false, match: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--clear') args.clear = true;
    else if (a === '--match') args.match = String(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Load schedule
  const schedulePath = path.join(__dirname, '..', 'data', 'match_snapshot_schedule.json');
  const schedule = JSON.parse(require('fs').readFileSync(schedulePath, 'utf8'));

  // Load runs to identify kickoff_passed matches
  const runsPath = path.join(__dirname, '..', 'data', 'match_snapshot_runs.json');
  let runs = {};
  try { runs = JSON.parse(require('fs').readFileSync(runsPath, 'utf8')); } catch {}

  // Get kickoff_passed match IDs
  let targetMatches;
  if (args.match) {
    targetMatches = schedule.matches.filter(m => String(m.matchId) === args.match);
  } else {
    targetMatches = schedule.matches.filter(m => {
      const state = runs.matches?.[m.matchId];
      return state?.preMissReason === 'kickoff_passed' || state?.preMissedAt;
    });
  }

  console.log(`⚽ Retrospective Prediction Backfill — ${targetMatches.length} matches`);

  if (args.clear && !args.dryRun) {
    clearRetrospectivePredictions();
    console.log('🗑  Cleared all existing retrospective predictions');
  }

  if (args.dryRun) {
    console.log('[dry-run] Would generate predictions for:', targetMatches.map(m => m.matchId).join(', '));
    return;
  }

  const engine = new PredictionEngine();
  let ok = 0;
  let failed = 0;

  for (const match of targetMatches) {
    const matchId = match.matchId;
    const tag = `[${ok + failed + 1}/${targetMatches.length}] match ${matchId}`;

    try {
      const homeId = match.teams.home.id;
      const awayId = match.teams.away.id;

      // Resolve ratings
      const homeLookup = getRatingTeam(homeId);
      const awayLookup = getRatingTeam(awayId);
      const homeRating = calcAvg(homeLookup.team);
      const awayRating = calcAvg(awayLookup.team);

      // Run prediction
      const result = await engine.predictWithMarket({
        homeId: homeLookup.ratingsId,
        awayId: awayLookup.ratingsId,
        homeRating,
        awayRating,
        odds: null,
      });

      // Enrich with match metadata
      result.match = {
        homeId,
        awayId,
        homeName: getTeamNameZh(homeId),
        awayName: getTeamNameZh(awayId),
        status: 'STATUS_FULL_TIME',
      };
      result.predictionSource = 'retrospective';

      // Save to retrospective_predictions (NOT prediction_snapshots)
      saveRetrospectivePrediction(matchId, result);

      console.log(`${tag} — ✅ ${result.match.homeName} ${result.likelyScore || '?'} ${result.match.awayName} (H:${(result.homeWin * 100).toFixed(1)}% D:${(result.draw * 100).toFixed(1)}% A:${(result.awayWin * 100).toFixed(1)}%)`);
      ok++;
    } catch (e) {
      console.error(`${tag} — ❌ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n完成: 成功 ${ok} 场, 失败 ${failed} 场。`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});
