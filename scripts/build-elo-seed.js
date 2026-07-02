#!/usr/bin/env node
/**
 * 用 martj42/international_results（CC0，49k 场，1872 至今）按时间全量回放，
 * 生成各届世界杯开赛前的 Elo 快照，写入 data/elo-seed.json。
 *
 * 解决回测冷启动问题：lib/backtest.js 原先所有队从 1500 起步，首轮预测
 * 零信息；生产环境却用 ratings.json 种子分，两边口径不一致。
 *
 * 用法：
 *   node scripts/build-elo-seed.js --csv <results.csv 路径>
 *
 * 设计要点：
 *   - K 值复用 lib/elo.js 的 kFactorByType（世界杯60/洲际正赛50/预选赛45/友谊赛30/其他40）
 *   - 中立场比赛不给主场 +100（用第二个 homeAdvantage=0 的引擎实例）
 *   - 快照口径：严格早于该届世界杯首场比赛日的所有比赛（无未来信息泄漏）
 *   - 队名别名：martj42 用现名回溯（Russia/Germany/DR Congo），openfootball
 *     历史文件用当时名（Soviet Union/West Germany/Zaire），快照里两套名字都写入
 */
const fs = require('fs');
const path = require('path');
const EloRating = require('../lib/elo');

// openfootball 当时名 → martj42 现名
const ALIASES = {
  'USA': 'United States',
  'West Germany': 'Germany',
  'Soviet Union': 'Russia',
  'Zaire': 'DR Congo',
  'Dutch East Indies': 'Indonesia',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Ireland': 'Republic of Ireland',
  'China': 'China PR',
  'Serbia and Montenegro': 'Serbia',
  'East Germany': 'German DR',
  "Côte d'Ivoire": 'Ivory Coast',
};

const CONTINENTAL_FINALS = /^(UEFA Euro|Copa América|African Cup of Nations|AFC Asian Cup|CONCACAF Championship|Gold Cup|CONCACAF Gold Cup|Oceania Nations Cup|OFC Nations Cup)$/;

function matchType(tournament) {
  if (tournament === 'FIFA World Cup') return 'world_cup';
  if (/qualification/i.test(tournament)) return 'qualifier';
  if (CONTINENTAL_FINALS.test(tournament)) return 'continental';
  if (tournament === 'Friendly') return 'friendly';
  return 'default';
}

/** 最小 CSV 解析（处理带引号字段） */
function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

function loadWorldCupStartDates() {
  const dir = path.join(__dirname, '..', 'data', 'history');
  const cutoffs = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^worldcup_(\d{4})\.json$/);
    if (!m) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const dates = (doc.matches || []).map(x => x.date).filter(Boolean).sort();
    if (dates.length) cutoffs[m[1]] = dates[0];
  }
  // 2026 届（进行中，不在 history 目录）：官方揭幕战日期
  if (!cutoffs['2026']) cutoffs['2026'] = '2026-06-11';
  return cutoffs;
}

function snapshot(ratings) {
  const out = {};
  for (const [team, r] of Object.entries(ratings)) {
    out[team] = Math.round(r * 10) / 10;
  }
  // 写入 openfootball 当时名的别名条目
  for (const [oldName, newName] of Object.entries(ALIASES)) {
    if (out[newName] !== undefined) out[oldName] = out[newName];
  }
  return out;
}

function main() {
  const csvIdx = process.argv.indexOf('--csv');
  if (csvIdx === -1 || !process.argv[csvIdx + 1]) {
    console.error('Usage: node scripts/build-elo-seed.js --csv <results.csv>');
    process.exit(1);
  }
  const csvPath = process.argv[csvIdx + 1];

  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const hs = f[col.home_score], as = f[col.away_score];
    if (hs === 'NA' || as === 'NA' || hs === '' || as === '') continue; // 未赛
    rows.push({
      date: f[col.date],
      home: f[col.home_team],
      away: f[col.away_team],
      homeScore: parseInt(hs, 10),
      awayScore: parseInt(as, 10),
      type: matchType(f[col.tournament]),
      neutral: f[col.neutral] === 'TRUE',
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`Replaying ${rows.length} completed matches...`);

  const eloHome = new EloRating();               // 真主场：+100
  const eloNeutral = new EloRating({ homeAdvantage: 0.0001 }); // 中立场：无主场加成
  const ratings = {};
  const get = (t) => ratings[t] !== undefined ? ratings[t] : 1500;

  const cutoffs = loadWorldCupStartDates();
  const cutoffList = Object.entries(cutoffs).sort((a, b) => a[1].localeCompare(b[1]));
  const snapshots = {};
  let cutoffPtr = 0;

  for (const m of rows) {
    // 跨过 cutoff 时先落快照（严格早于开赛日的状态）
    while (cutoffPtr < cutoffList.length && m.date >= cutoffList[cutoffPtr][1]) {
      const [year, asOf] = cutoffList[cutoffPtr];
      snapshots[year] = { asOf, teams: snapshot(ratings) };
      cutoffPtr++;
    }
    const engine = m.neutral ? eloNeutral : eloHome;
    const upd = engine.updateRatings(get(m.home), get(m.away), m.homeScore, m.awayScore, { matchType: m.type });
    ratings[m.home] = upd.homeRating;
    ratings[m.away] = upd.awayRating;
  }
  // 未跨过的 cutoff（未来赛事）与最终状态
  while (cutoffPtr < cutoffList.length) {
    const [year, asOf] = cutoffList[cutoffPtr];
    snapshots[year] = { asOf, teams: snapshot(ratings) };
    cutoffPtr++;
  }
  snapshots.current = { asOf: rows[rows.length - 1].date, teams: snapshot(ratings) };

  const out = {
    source: 'martj42/international_results (CC0)',
    generatedAt: new Date().toISOString().slice(0, 10),
    method: 'full-history chronological Elo replay, kFactorByType from lib/elo.js, neutral-venue aware',
    aliases: ALIASES,
    snapshots,
  };
  const outPath = path.join(__dirname, '..', 'data', 'elo-seed.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote ${outPath} (${Object.keys(snapshots).length} snapshots)`);

  // 覆盖率检查：每届 history 文件里的队名必须能在对应快照里查到
  const dir = path.join(__dirname, '..', 'data', 'history');
  const misses = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^worldcup_(\d{4})\.json$/);
    if (!m || !snapshots[m[1]]) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const teams = snapshots[m[1]].teams;
    for (const match of doc.matches || []) {
      for (const t of [match.home, match.away]) {
        if (teams[t] === undefined) (misses[m[1]] = misses[m[1]] || new Set()).add(t);
      }
    }
  }
  if (Object.keys(misses).length) {
    console.warn('\nCoverage misses (will fall back to 1500 in backtest):');
    for (const [y, set] of Object.entries(misses)) console.warn(`  ${y}: ${[...set].join(', ')}`);
  } else {
    console.log('Coverage check: all history team names resolve in their snapshots.');
  }

  // 快照抽查：2026 开赛前 Top 10
  const top = Object.entries(snapshots['2026'].teams).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\nTop 10 (pre-2026):');
  for (const [t, r] of top) console.log(`  ${t}: ${r}`);
}

main();
