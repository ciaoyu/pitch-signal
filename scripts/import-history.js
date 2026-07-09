#!/usr/bin/env node
/**
 * Historical World Cup data import script
 * Read data/history/*.json, write to SQLite, train Poisson model
 */
const fs = require('fs');
const path = require('path');
const { db, run, get, all, count } = require('../lib/db');
const PoissonModel = require('../lib/poisson');

const HISTORY_DIR = path.join(__dirname, '..', 'data', 'history');

console.log('📥 Importing historical World Cup data...\n');

// 1. Read data files
const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
console.log(`📁 Found ${files.length} data files`);

let totalImported = 0;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
  const matches = data.matches || [];
  console.log(`\n📊 ${data.tournament}: ${matches.length} matches`);

    // 2. Write to historical_matches table
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
  console.log(`  ✅ Imported ${imported} matches`);
}

// 3. Train Poisson model
console.log('\n🧠 Training Poisson model...');
const allMatches = all('SELECT home_team, away_team, home_score, away_score FROM historical_matches');
const model = new PoissonModel();
const strengths = model.trainFromMatches(allMatches);

console.log(`  Global avg goals per match: ${model.globalAvgGoals.toFixed(2)}`);

// 4. Update team_features table
const updateStmt = db.prepare(`
  INSERT OR REPLACE INTO team_features (team_id, team_name, attack_strength, defense_strength, last_updated)
  VALUES (?, ?, ?, ?, ?)
`);

let updated = 0;
for (const [team, s] of Object.entries(strengths)) {
  updateStmt.run(team, team, s.attack_strength, s.defense_strength, new Date().toISOString());
  updated++;
}
console.log(`  ✅ Updated ${updated} teams attack/defense strength`);

// 5. Show Top 10 attack/defense rankings
console.log('\n📊 Top 10 attack strength:');
Object.entries(strengths)
  .sort((a, b) => b[1].attack_strength - a[1].attack_strength)
  .slice(0, 10)
  .forEach(([team, s], i) => {
    console.log(`  ${i + 1}. ${team}: atk=${s.attack_strength.toFixed(3)} def=${s.defense_strength.toFixed(3)} (${s.matches} matches)`);
  });

console.log('\n📊 Top 10 defense strength (lower is better):');
Object.entries(strengths)
  .sort((a, b) => a[1].defense_strength - b[1].defense_strength)
  .slice(0, 10)
  .forEach(([team, s], i) => {
    console.log(`  ${i + 1}. ${team}: def=${s.defense_strength.toFixed(3)} (${s.matches} matches)`);
  });

console.log(`\n🎉 Import complete! Total ${totalImported} matches, ${updated} teams`);
