#!/usr/bin/env node
/**
  * Fetch 1930–2022 World Cup editions from openfootball/worldcup.json (CC0 public domain)
  * match results, and convert them into the existing schema of data/history/worldcup_<year>.json:
 *   { tournament, year, host, matches: [{ date, home, away, homeScore, awayScore, stage, venue }] }
 *
  * Usage:
  *   node scripts/fetch-worldcup-history.js [--src <local clone dir>] [--force]
 *
  *   --src    use an existing local clone (skip git clone)
  *   --force  overwrite existing data/history/worldcup_<year>.json (skip by default;
  *            protects the manually-proofread 2018/2022 files)
 *
  * Score convention: prefer et (extra-time aggregate), fall back to ft if absent; never use p (penalties are not goals).
  * Consistent with the existing worldcup_2022.json (2022 final recorded as 3-3).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeStage } = require('../lib/knockoutStage');

const REPO_URL = 'https://github.com/openfootball/worldcup.json';
// 2025 is the Club World Cup (club competition), 2026 is still ongoing — neither enters backtest history
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

/** Prefer et, fall back to ft; never use penalty score (p) */
function pickScore(score) {
  if (!score) return null;
  const pair = score.et || score.ft;
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  if (!Number.isInteger(pair[0]) || !Number.isInteger(pair[1])) return null;
  return pair;
}

/** "Estadio Azteca, Mexico City" → "Estadio Azteca", matching the style of the existing venue field */
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
    // Outside the canonical vocabulary and not a group-stage round; flag for manual review
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
