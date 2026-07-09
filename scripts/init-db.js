#!/usr/bin/env node
/**
  * Database initialization script - creates tables and validates
 */
const path = require('path');
const { db, tables, count, run, get, all } = require('../lib/db');

console.log('✅ Database initialized at:', path.join(__dirname, '..', 'data', 'predictions.db'));

// List tables
const tableNames = tables();
console.log('\n📋 Tables created:');
tableNames.forEach(t => console.log(`  - ${t} (${count(t)} rows)`));

// Show schema for each table
for (const t of tableNames) {
  const info = db.prepare(`PRAGMA table_info(${t})`).all();
  console.log(`\n📊 ${t}:`);
  info.forEach(col => console.log(`  ${col.name} (${col.type})${col.pk ? ' PK' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`));
}

// Insert default poisson params
const existing = get('SELECT * FROM poisson_params WHERE id = 1');
if (!existing) {
  run('INSERT INTO poisson_params (global_avg_goals, home_advantage, tournament_factor, last_updated) VALUES (?, ?, ?, ?)',
    2.5, 1.2, 1.0, new Date().toISOString());
  console.log('\n✅ Default Poisson params inserted');
}

// Verify
const params = all('SELECT * FROM poisson_params');
console.log('\n📊 Poisson params:', JSON.stringify(params, null, 2));

console.log('\n🎉 Database setup complete!');
