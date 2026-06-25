#!/usr/bin/env node
/**
 * 历史世界杯数据导入脚本
 * 读取 data/history/*.json，写入 SQLite，训练 Poisson 模型
 */
const fs = require('fs');
const path = require('path');
const { db, run, get, all, count } = require('../lib/db');
const PoissonModel = require('../lib/poisson');

const HISTORY_DIR = path.join(__dirname, '..', 'data', 'history');

console.log('📥 开始导入历史世界杯数据...\n');

// 1. 读取数据文件
const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
console.log(`📁 找到 ${files.length} 个数据文件`);

let totalImported = 0;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
  const matches = data.matches || [];
  console.log(`\n📊 ${data.tournament}: ${matches.length} 场比赛`);

  // 2. 写入 historical_matches 表
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO historical_matches (match_date, home_team, away_team, home_score, away_score, tournament, stage, venue, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((matches) => {
    let count = 0;
    for (const m of matches) {
      stmt.run(m.date, m.home, m.away, m.homeScore, m.awayScore, data.tournament, m.stage, m.venue, 'imported');
      count++;
    }
    return count;
  });

  const imported = insertAll(matches);
  totalImported += imported;
  console.log(`  ✅ 导入 ${imported} 场比赛`);
}

// 3. 训练 Poisson 模型
console.log('\n🧠 训练 Poisson 模型...');
const allMatches = all('SELECT home_team, away_team, home_score, away_score FROM historical_matches');
const model = new PoissonModel();
const strengths = model.trainFromMatches(allMatches);

console.log(`  全局场均进球: ${model.globalAvgGoals.toFixed(2)}`);

// 4. 更新 team_features 表
const updateStmt = db.prepare(`
  INSERT OR REPLACE INTO team_features (team_id, team_name, attack_strength, defense_strength, last_updated)
  VALUES (?, ?, ?, ?, ?)
`);

let updated = 0;
for (const [team, s] of Object.entries(strengths)) {
  updateStmt.run(team, team, s.attack_strength, s.defense_strength, new Date().toISOString());
  updated++;
}
console.log(`  ✅ 更新 ${updated} 支球队攻防强度`);

// 5. 显示 Top 10 攻防排名
console.log('\n📊 攻击强度 Top 10:');
Object.entries(strengths)
  .sort((a, b) => b[1].attack_strength - a[1].attack_strength)
  .slice(0, 10)
  .forEach(([team, s], i) => {
    console.log(`  ${i + 1}. ${team}: 攻=${s.attack_strength.toFixed(3)} 守=${s.defense_strength.toFixed(3)} (${s.matches}场)`);
  });

console.log('\n📊 防守强度 Top 10 (值越小越好):');
Object.entries(strengths)
  .sort((a, b) => a[1].defense_strength - b[1].defense_strength)
  .slice(0, 10)
  .forEach(([team, s], i) => {
    console.log(`  ${i + 1}. ${team}: 守=${s.defense_strength.toFixed(3)} (${s.matches}场)`);
  });

console.log(`\n🎉 导入完成！共 ${totalImported} 场比赛，${updated} 支球队`);
