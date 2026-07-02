#!/usr/bin/env node
'use strict';

/**
 * Import national-team market values from dcaribou/transfermarkt-datasets.
 *
 * Source table:
 *   https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/national_teams.csv.gz
 *
 * Output:
 *   data/market-values.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const SOURCE_URL = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/national_teams.csv.gz';
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'market-values.json');

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() || [];
  return rows
    .filter(r => r.length && r.some(Boolean))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function loadIdMap() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'id_map_center.json'), 'utf8'));
  } catch (_) {
    return {};
  }
}

function buildNameMap(idMap) {
  const map = new Map();
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const [ratingsId, entry] of Object.entries(idMap || {})) {
    [
      ratingsId,
      entry.name_official,
      entry.the_odds_name,
      entry.espn_name,
      entry.fifa_code,
      entry.iso2,
    ].filter(Boolean).forEach(name => map.set(norm(name), ratingsId));
  }
  return {
    resolve(name) {
      return map.get(norm(name)) || name;
    },
  };
}

async function main() {
  const gz = await fetchBuffer(SOURCE_URL);
  const csv = zlib.gunzipSync(gz).toString('utf8');
  const rows = parseCsv(csv);
  const nameMap = buildNameMap(loadIdMap());
  const teams = {};

  for (const row of rows) {
    const value = Number(row.total_market_value || 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    const ratingsId = nameMap.resolve(row.name || row.country_name);
    teams[ratingsId] = {
      name: row.name,
      country: row.country_name,
      fifaCode: row.country_code,
      squadValueEur: value,
      squadSize: Number(row.squad_size || 0) || null,
      averageAge: Number(row.average_age || 0) || null,
      fifaRanking: Number(row.fifa_ranking || 0) || null,
      source: 'dcaribou/transfermarkt-datasets:national_teams',
      sourceUrl: SOURCE_URL,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  }

  const output = {
    source: 'dcaribou/transfermarkt-datasets',
    sourceUrl: SOURCE_URL,
    license: 'CC0-1.0',
    updatedAt: new Date().toISOString(),
    teams,
  };
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`wrote ${OUT_PATH}`);
  console.log(`teams: ${Object.keys(teams).length}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { parseCsv, buildNameMap };
