#!/usr/bin/env node
/**
 * 从 openfootball/worldcup.json（CC0 公共领域）拉取 1930-2022 历届世界杯
 * 比赛结果，转换成 data/history/worldcup_<year>.json 的既有 schema：
 *   { tournament, year, host, matches: [{ date, home, away, homeScore, awayScore, stage, venue }] }
 *
 * 用法：
 *   node scripts/fetch-worldcup-history.js [--src <本地克隆目录>] [--force]
 *
 *   --src    使用已有的本地克隆（跳过 git clone）
 *   --force  覆盖已存在的 data/history/worldcup_<year>.json（默认跳过，
 *            保护手工校对过的 2018/2022 文件）
 *
 * 比分口径：取 et（加时赛累计），没有才取 ft；永不取 p（点球不是进球）。
 * 与现有 worldcup_2022.json 一致（2022 决赛记为 3-3）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeStage } = require('../lib/knockoutStage');

const REPO_URL = 'https://github.com/openfootball/worldcup.json';
// 2025 是世俱杯（俱乐部赛事）、2026 尚在进行中，都不进回测历史
const EXCLUDED_YEARS = new Set(['2025', '2026']);

const HOSTS = {
  1930: 'Uruguay', 1934: 'Italy', 1938: 'France', 1950: 'Brazil',
  1954: 'Switzerland', 1958: 'Sweden', 1962: 'Chile', 1966: 'England',
  1970: 'Mexico', 1974: 'West Germany', 1978: 'Argentina', 1982: 'Spain',
  1986: 'Mexico', 1990: 'Italy', 1994: 'USA', 1998: 'France',
  2002: 'South Korea & Japan', 2006: 'Germany', 2010: 'South Africa',
  2014: 'Brazil', 2018: 'Russia', 2022: 'Qatar',
};

function parseArgs(argv) {
  const args = { src: null, force: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--src') args.src = argv[++i];
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

function cloneRepo() {
  const dest = fs.mkdtempSync(path.join(require('os').tmpdir(), 'openfootball-'));
  console.log(`Cloning ${REPO_URL} (depth 1) → ${dest}`);
  execFileSync('git', ['clone', '--depth', '1', REPO_URL, dest], { stdio: 'inherit' });
  return dest;
}

/** et 优先、ft 兜底；点球比分（p）永不采用 */
function pickScore(score) {
  if (!score) return null;
  const pair = score.et || score.ft;
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  if (!Number.isInteger(pair[0]) || !Number.isInteger(pair[1])) return null;
  return pair;
}

/** "Estadio Azteca, Mexico City" → "Estadio Azteca"，与现有 venue 字段风格一致 */
function pickVenue(ground) {
  if (!ground) return '';
  return String(ground).split(',')[0].trim();
}

function convertYear(srcDir, year) {
  const srcPath = path.join(srcDir, String(year), 'worldcup.json');
  if (!fs.existsSync(srcPath)) return null;
  const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

  const matches = [];
  const skipped = [];
  const unknownRounds = new Set();

  for (const m of raw.matches || []) {
    const score = pickScore(m.score);
    if (!score) {
      skipped.push(`${m.date} ${m.team1} v ${m.team2} (no score)`);
      continue;
    }
    const stage = normalizeStage(m.round, m.group);
    // 规范词表之外、又不是小组类轮次的，提示人工检查
    const canonical = /^(Group |Round of 32|Round of 16|Quarter-finals|Semi-finals|Third place|Final|Final Round|First round|Matchday )/;
    if (!canonical.test(stage)) {
      unknownRounds.add(m.round);
    }
    matches.push({
      date: m.date,
      home: m.team1,
      away: m.team2,
      homeScore: score[0],
      awayScore: score[1],
      stage,
      venue: pickVenue(m.ground),
    });
  }

  return {
    doc: {
      tournament: `${year} FIFA World Cup`,
      year: Number(year),
      host: HOSTS[year] || '',
      source: 'openfootball/worldcup.json (CC0)',
      matches,
    },
    skipped,
    unknownRounds: [...unknownRounds],
  };
}

function main() {
  const args = parseArgs(process.argv);
  const srcDir = args.src || cloneRepo();
  const outDir = path.join(__dirname, '..', 'data', 'history');
  fs.mkdirSync(outDir, { recursive: true });

  const years = fs.readdirSync(srcDir)
    .filter(d => /^\d{4}$/.test(d) && !EXCLUDED_YEARS.has(d))
    .sort();

  let written = 0, skippedFiles = 0, totalMatches = 0;
  for (const year of years) {
    const outPath = path.join(outDir, `worldcup_${year}.json`);
    if (fs.existsSync(outPath) && !args.force) {
      console.log(`skip  ${year} (exists, use --force to overwrite)`);
      skippedFiles++;
      continue;
    }
    const result = convertYear(srcDir, year);
    if (!result) {
      console.warn(`warn  ${year}: no worldcup.json in source`);
      continue;
    }
    const { doc, skipped, unknownRounds } = result;
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
    console.log(`write ${year}: ${doc.matches.length} matches`);
    if (skipped.length) console.warn(`      skipped ${skipped.length}: ${skipped.join('; ')}`);
    if (unknownRounds.length) console.warn(`      unmapped rounds: ${unknownRounds.join(', ')}`);
    written++;
    totalMatches += doc.matches.length;
  }

  console.log(`\nDone: ${written} files written (${totalMatches} matches), ${skippedFiles} skipped.`);
}

main();
