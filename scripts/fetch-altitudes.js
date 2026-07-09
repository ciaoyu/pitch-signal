#!/usr/bin/env node
/**
 * fetch-altitudes.js
  * Fetch altitude data from the Open-Elevation API and augment teams.json and venues.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { resolveDataPath, writeJsonAtomic } = require('../lib/data-resolver');

const TEAMS_READ_PATH = resolveDataPath('teams.json');
const VENUES_READ_PATH = resolveDataPath('venues.json');

const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';

async function fetchElevations(locations) {
  const batchSize = 50; // API limit
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
            // Fill with null
      for (const loc of batch) {
        results.push({ ...loc, altitude: null });
      }
    }
    
        // Avoid rate limiting
    if (i + batchSize < locations.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return results;
}

async function main() {
  console.log('🏔️  Fetching altitude data...\n');
  
    // Load data
  const teams = JSON.parse(fs.readFileSync(TEAMS_READ_PATH, 'utf8'));
  const venues = JSON.parse(fs.readFileSync(VENUES_READ_PATH, 'utf8'));
  
    // Collect locations to query
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
  
  console.log(`📊 Team base camps: ${teamLocations.length}`);
  console.log(`📊 Match venues: ${venueLocations.length}`);
  
    // Batch query
  console.log('\n⏳ Querying team base camp altitudes...');
  const teamResults = await fetchElevations(teamLocations);
  
  console.log('⏳ Querying match venue altitudes...');
  const venueResults = await fetchElevations(venueLocations);
  
    // Update teams.json
  for (const result of teamResults) {
    if (result.altitude !== null) {
      teams.teams[result.code].baseCamp.altitude = result.altitude;
    }
  }
  
    // Update venues.json
  for (const result of venueResults) {
    if (result.altitude !== null) {
      venues.venues[result.id].altitude = result.altitude;
    }
  }
  
    // Write files
  const TEAMS_WRITE_PATH = writeJsonAtomic('teams.json', teams);
  const VENUES_WRITE_PATH = writeJsonAtomic('venues.json', venues);
  
    // Statistics
  const teamsWithAlt = Object.values(teams.teams).filter(t => t.baseCamp?.altitude != null).length;
  const venuesWithAlt = Object.values(venues.venues).filter(v => v.altitude != null).length;
  
  console.log('\n✅ Done!');
  console.log(`   Team base camps: ${teamsWithAlt}/${teamLocations.length} have altitude data`);
  console.log(`   Match venues: ${venuesWithAlt}/${venueLocations.length} have altitude data`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
