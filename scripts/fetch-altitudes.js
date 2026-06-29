#!/usr/bin/env node
/**
 * fetch-altitudes.js
 * 从 Open-Elevation API 获取海拔数据，补充到 teams.json 和 venues.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { resolveDataPath, writeJsonAtomic } = require('../lib/data-resolver');

const TEAMS_READ_PATH = resolveDataPath('teams.json');
const VENUES_READ_PATH = resolveDataPath('venues.json');

const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';

async function fetchElevations(locations) {
  const batchSize = 50; // API 限制
  const results = [];
  
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    const locationsStr = batch.map(l => `${l.lat},${l.lon}`).join('|');
    
    const url = `${OPEN_ELEVATION_URL}?locations=${locationsStr}`;
    
    try {
      const response = await new Promise((resolve, reject) => {
        https.get(url, {
          headers: { 'User-Agent': 'pitch-signal/1.0' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`JSON parse error: ${e.message}`));
            }
          });
          res.on('error', reject);
        }).on('error', reject);
      });
      
      if (response.results) {
        for (let j = 0; j < batch.length; j++) {
          results.push({
            ...batch[j],
            altitude: response.results[j]?.elevation || null
          });
        }
      }
    } catch (err) {
      console.error(`Batch ${i}-${i + batchSize} failed:`, err.message);
      // 填充 null
      for (const loc of batch) {
        results.push({ ...loc, altitude: null });
      }
    }
    
    // 避免速率限制
    if (i + batchSize < locations.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return results;
}

async function main() {
  console.log('🏔️  获取海拔数据...\n');
  
  // 加载数据
  const teams = JSON.parse(fs.readFileSync(TEAMS_READ_PATH, 'utf8'));
  const venues = JSON.parse(fs.readFileSync(VENUES_READ_PATH, 'utf8'));
  
  // 收集需要查询的位置
  const teamLocations = [];
  const venueLocations = [];
  
  for (const [code, team] of Object.entries(teams.teams)) {
    if (team.baseCamp && team.baseCamp.lat && team.baseCamp.lon) {
      teamLocations.push({
        code,
        lat: team.baseCamp.lat,
        lon: team.baseCamp.lon,
        type: 'team'
      });
    }
  }
  
  for (const [id, venue] of Object.entries(venues.venues)) {
    if (venue.lat && venue.lon) {
      venueLocations.push({
        id,
        lat: venue.lat,
        lon: venue.lon,
        type: 'venue'
      });
    }
  }
  
  console.log(`📊 球队大本营: ${teamLocations.length}`);
  console.log(`📊 比赛场馆: ${venueLocations.length}`);
  
  // 批量查询
  console.log('\n⏳ 查询球队大本营海拔...');
  const teamResults = await fetchElevations(teamLocations);
  
  console.log('⏳ 查询比赛场馆海拔...');
  const venueResults = await fetchElevations(venueLocations);
  
  // 更新 teams.json
  for (const result of teamResults) {
    if (result.altitude !== null) {
      teams.teams[result.code].baseCamp.altitude = result.altitude;
    }
  }
  
  // 更新 venues.json
  for (const result of venueResults) {
    if (result.altitude !== null) {
      venues.venues[result.id].altitude = result.altitude;
    }
  }
  
  // 写入文件
  const TEAMS_WRITE_PATH = writeJsonAtomic('teams.json', teams);
  const VENUES_WRITE_PATH = writeJsonAtomic('venues.json', venues);
  
  // 统计
  const teamsWithAlt = Object.values(teams.teams).filter(t => t.baseCamp?.altitude != null).length;
  const venuesWithAlt = Object.values(venues.venues).filter(v => v.altitude != null).length;
  
  console.log('\n✅ 完成！');
  console.log(`   球队大本营: ${teamsWithAlt}/${teamLocations.length} 有海拔数据`);
  console.log(`   比赛场馆: ${venuesWithAlt}/${venueLocations.length} 有海拔数据`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
