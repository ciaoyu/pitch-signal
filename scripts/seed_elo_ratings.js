/**
 * Seed elo_ratings table from data/ratings.json
 * Run inside Docker container: node scripts/seed_elo_ratings.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, '..', 'data', 'predictions.db'));
const ratings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ratings.json'), 'utf8'));

const teams = ratings.teams || {};
let inserted = 0;

const stmt = db.prepare(`
  INSERT INTO elo_ratings (team_id, team_name, rating, peak_rating, matches_played, last_updated)
  VALUES (?, ?, ?, ?, 0, datetime('now'))
  ON CONFLICT(team_id) DO UPDATE SET
    rating = excluded.rating,
    peak_rating = excluded.peak_rating,
    last_updated = excluded.last_updated
`);

const tx = db.transaction(() => {
  for (const [id, team] of Object.entries(teams)) {
    const rating = team.rating || 1500;
    const name = team.name || id;
    stmt.run(id, name, rating, rating);
    inserted++;
  }
});

tx();
console.log(`✅ Seeded ${inserted} teams into elo_ratings`);

// Verify
const count = db.prepare('SELECT COUNT(*) as cnt FROM elo_ratings').get();
const top5 = db.prepare('SELECT team_id, team_name, rating FROM elo_ratings ORDER BY rating DESC LIMIT 5').all();
console.log(`📊 Total rows: ${count.cnt}`);
console.log('🏆 Top 5:');
top5.forEach((r, i) => console.log(`  ${i+1}. ${r.team_name} (${r.team_id}) — ${r.rating}`));

db.close();
