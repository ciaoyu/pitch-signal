#!/usr/bin/env node

/**
 * sync-fifa-data.js
 * 从 26worldcup GitHub 仓库拉取 JSON 数据文件到 $DATA_PATH/wc2026/
 * 
 * 数据源：
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

// 10 个需要下载的文件及其源路径
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
 * 下载单个 JSON 文件
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
 * 主函数
 */
async function main() {
  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ 创建目录: ${OUTPUT_DIR}`);
  }

  const results = [];
  const errors = [];

  // 逐个下载文件
  for (const file of FILES_TO_SYNC) {
    const url = `${BASE_URL}/${file.source}`;
    console.log(`📥 下载 ${file.name}...`);
    
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

  // 输出汇总
  console.log('\n' + '='.repeat(60));
  console.log(`📊 同步完成: ${results.length}/${FILES_TO_SYNC.length} 个文件成功`);
  
  if (errors.length > 0) {
    console.log(`\n❌ 失败的文件:`);
    errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
  }

  // 写入同步日志
  const log = {
    timestamp: new Date().toISOString(),
    results,
    errors,
    total: FILES_TO_SYNC.length,
    success: results.length,
    failed: errors.length
  };
  const logPath = writeJsonAtomic('sync-log.json', log);
  console.log(`\n📝 同步日志: ${logPath}`);

  // 返回成功状态
  process.exit(errors.length > 0 ? 1 : 0);
}

/**
 * 选择性同步指定文件（供 cron 调用）
 * @param {string[]} names - 要同步的文件名数组，如 ['lineups.json', 'matches.json']
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

  // 写入同步日志
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

// 导出模块接口供 cron 使用
module.exports = { syncSelected, OUTPUT_DIR, FILES_TO_SYNC, downloadJSON };

// 直接运行时执行全量同步
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 致命错误:', err.message);
    process.exit(1);
  });
}
