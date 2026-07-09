#!/usr/bin/env node

/**
 * sync-fifa-data.js
  * Pull JSON data files from the 26worldcup GitHub repo into $DATA_PATH/wc2026/
 * 
  * Data sources:
 * - public/data/: teams, squads, lineups, probs, venues, weather, wc-history
 * - scripts/curated/: climate, fifa-ranking
 */

const fs = require('fs');
const https = require('https');
const {
  getRuntimeDataDir,
  writeJsonAtomic,
} = require('../lib/data-resolver');

const BASE_URL = 'https://raw.githubusercontent.com/26worldcup/26worldcup.github.io/main';
const OUTPUT_DIR = getRuntimeDataDir();

// The 10 files to download and their source paths
const FILES_TO_SYNC = [
  { name: 'teams.json', source: 'public/data/teams.json' },
  { name: 'squads.json', source: 'public/data/squads.json' },
  { name: 'lineups.json', source: 'public/data/lineups.json' },
  { name: 'matches.json', source: 'public/data/matches.json' },
  { name: 'probs.json', source: 'public/data/probs.json' },
  { name: 'venues.json', source: 'public/data/venues.json' },
  { name: 'weather.json', source: 'public/data/weather.json' },
  { name: 'wc-history.json', source: 'public/data/wc-history.json' },
  { name: 'climate.json', source: 'scripts/curated/climate.json' },
  { name: 'fifa-ranking.json', source: 'scripts/curated/fifa-ranking.json' },
];

/**
  * Download a single JSON file
 */
function downloadJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'pitch-signal-sync/1.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error for ${url}: ${e.message}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
  * Main function
 */
async function main() {
  // Ensure the output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created directory: ${OUTPUT_DIR}`);
  }

  const results = [];
  const errors = [];

  // Download files one by one
  for (const file of FILES_TO_SYNC) {
    const url = `${BASE_URL}/${file.source}`;
    console.log(`📥 Downloading ${file.name}...`);
    
    try {
      const data = await downloadJSON(url);
      const outputPath = writeJsonAtomic(file.name, data);
      
      const stats = fs.statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      results.push({
        name: file.name,
        source: file.source,
        size: `${sizeKB} KB`,
        success: true
      });
      
      console.log(`   ✅ ${file.name} (${sizeKB} KB)`);
    } catch (err) {
      errors.push({
        name: file.name,
        source: file.source,
        error: err.message
      });
      console.error(`   ❌ ${file.name}: ${err.message}`);
    }
  }

  // Output summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Sync complete: ${results.length}/${FILES_TO_SYNC.length} files succeeded`);
  
  if (errors.length > 0) {
    console.log(`\n❌ Failed files:`);
    errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
  }

  // Write sync log
  const log = {
    timestamp: new Date().toISOString(),
    results,
    errors,
    total: FILES_TO_SYNC.length,
    success: results.length,
    failed: errors.length
  };
  const logPath = writeJsonAtomic('sync-log.json', log);
  console.log(`\n📝 Sync log: ${logPath}`);

  // Return success status
  process.exit(errors.length > 0 ? 1 : 0);
}

/**
  * Selectively sync specified files (for cron invocation)
  * @param {string[]} names - array of filenames to sync, e.g. ['lineups.json', 'matches.json']
 * @returns {Promise<{results: object[], errors: object[]}>}
 */
async function syncSelected(names) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const nameSet = new Set(names);
  const selected = FILES_TO_SYNC.filter(f => nameSet.has(f.name));
  const results = [];
  const errors = [];

  for (const file of selected) {
    const url = `${BASE_URL}/${file.source}`;
    try {
      const data = await downloadJSON(url);
      const outputPath = writeJsonAtomic(file.name, data);
      const stats = fs.statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      results.push({ name: file.name, source: file.source, size: `${sizeKB} KB`, success: true });
    } catch (err) {
      errors.push({ name: file.name, source: file.source, error: err.message });
    }
  }

  // Write sync log
  const log = {
    timestamp: new Date().toISOString(),
    results,
    errors,
    total: selected.length,
    success: results.length,
    failed: errors.length,
  };
  writeJsonAtomic('sync-log.json', log);

  return { results, errors };
}

// Export module interface for cron use
module.exports = { syncSelected, OUTPUT_DIR, FILES_TO_SYNC, downloadJSON };

// Run a full sync when executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
