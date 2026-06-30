'use strict';

/**
 * xG 数据服务
 *
 * 职责：
 * 1. 从 API-Football 拉取已结束比赛的 xG 统计（免费 100次/天，定时任务调用）
 * 2. 把 xG 存入 SQLite team_xg_stats 表
 * 3. 暴露 getTeamXgProfile(teamId) 供 Poisson λ 融合
 *
 * API-Football 免费 tier: 100 req/day，禁止前端直接调用，只在 cron 里用。
 * key 来自 env: API_FOOTBALL_KEY
 */

const https = require('https');
const { db } = require('../db');

const API_BASE = 'https://v3.football.api-sports.io';
// FIFA World Cup 2026 league_id — API-Football 编号待确认后可在 .env 覆盖
const WC_LEAGUE_ID = process.env.API_FOOTBALL_WC_LEAGUE ?? '1';
const WC_SEASON    = process.env.API_FOOTBALL_WC_SEASON ?? '2026';

function fetchApiFootball(path) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return Promise.resolve(null);

  return new Promise((resolve) => {
    const url = `${API_BASE}${path}`;
    const req = https.get(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 ? JSON.parse(raw) : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

/**
 * 查询 API-Football 中 WC2026 所有已完赛事
 * 返回 fixture 列表，每个有 fixture.id 可用于拉取统计
 */
async function fetchFinishedFixtures() {
  const data = await fetchApiFootball(
    `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&status=FT`
  );
  return data?.response ?? [];
}

/**
 * 拉取单场比赛统计，返回含 xG 的数据
 * @param {number} fixtureId
 */
async function fetchFixtureStats(fixtureId) {
  const data = await fetchApiFootball(`/fixtures/statistics?fixture=${fixtureId}`);
  return data?.response ?? [];
}

/**
 * 把一批 fixture 的 xG 写入 DB
 * 每次 cron 调用，处理还没有 xG 记录的已结束比赛
 * 返回处理场数
 */
async function syncXgFromApiFootball() {
  if (!process.env.API_FOOTBALL_KEY) {
    console.log('[xg-service] API_FOOTBALL_KEY not set, skipping xG sync');
    return 0;
  }

  const fixtures = await fetchFinishedFixtures();
  if (!fixtures.length) return 0;

  let processed = 0;

  for (const fix of fixtures) {
    const fixtureId = fix.fixture?.id;
    const matchDate = (fix.fixture?.date ?? '').slice(0, 10);
    const homeTeam  = fix.teams?.home?.name ?? '';
    const awayTeam  = fix.teams?.away?.name ?? '';
    const homeId    = String(fix.teams?.home?.id ?? '');
    const awayId    = String(fix.teams?.away?.id ?? '');

    if (!fixtureId) continue;

    // 已有记录则跳过（幂等）
    const existing = db.prepare(
      `SELECT id FROM team_xg_stats WHERE fixture_id = ? LIMIT 1`
    ).get(fixtureId);
    if (existing) continue;

    const stats = await fetchFixtureStats(fixtureId);
    if (!stats.length) continue;

    for (const teamStats of stats) {
      const teamId   = String(teamStats.team?.id ?? '');
      const teamName = teamStats.team?.name ?? '';
      const isHome   = teamId === homeId;
      const oppId    = isHome ? awayId : homeId;
      const oppName  = isHome ? awayTeam : homeTeam;

      const xg = extractXg(teamStats.statistics ?? []);
      if (xg === null) continue;

      db.prepare(`
        INSERT OR IGNORE INTO team_xg_stats
          (fixture_id, match_date, team_id, team_name, opp_id, opp_name, xg, is_home)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fixtureId, matchDate, teamId, teamName, oppId, oppName, xg, isHome ? 1 : 0);
    }

    processed++;
    // 小延迟，避免短时间内打满 100 次/天配额
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[xg-service] Synced xG for ${processed} fixtures`);
  return processed;
}

function extractXg(statistics) {
  const stat = statistics.find(s =>
    s.type === 'Expected Goals' || s.type === 'xG' || s.type === 'expected_goals'
  );
  if (!stat) return null;
  const val = parseFloat(stat.value);
  return Number.isFinite(val) ? val : null;
}

/**
 * 给 Poisson 引擎用：返回某支球队在本届赛事中的 xG 攻防档案
 * 数据不足（<2场）时返回 null，由调用方决定是否回退到纯数学 λ
 *
 * @param {string} teamId  API-Football team id 或 ESPN id（需要映射表）
 * @returns {{ avgXgFor, avgXgAgainst, matches } | null}
 */
function getTeamXgProfile(teamId) {
  if (!teamId) return null;
  const id = String(teamId);

  const rows = db.prepare(`
    SELECT xg, is_home FROM team_xg_stats WHERE team_id = ? ORDER BY match_date DESC LIMIT 10
  `).all(id);

  if (rows.length < 2) return null;

  const avgXgFor = rows.reduce((s, r) => s + r.xg, 0) / rows.length;

  // xG against：取对手视角的同场记录
  const against = db.prepare(`
    SELECT s.xg FROM team_xg_stats s
    WHERE s.opp_id = ?
    ORDER BY s.match_date DESC LIMIT 10
  `).all(id);

  const avgXgAgainst = against.length
    ? against.reduce((s, r) => s + r.xg, 0) / against.length
    : null;

  return { avgXgFor, avgXgAgainst, matches: rows.length };
}

module.exports = { syncXgFromApiFootball, getTeamXgProfile, fetchFinishedFixtures };
