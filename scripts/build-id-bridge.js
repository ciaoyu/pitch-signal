#!/usr/bin/env node

/**
 * build-id-bridge.js
  * Build id_bridge.json, linking FIFA code/id ↔ ESPN id ↔ country name
 * 
  * Inputs:
  * - runtime or resources/seed/wc2026/teams.json (FIFA data)
  * - data/id_map_center.json (ESPN data)
 * 
  * Outputs:
 * - $DATA_PATH/wc2026/id_bridge.json
  * - $DATA_PATH/wc2026/unmatched.txt (teams that cannot be matched)
 */

const fs = require('fs');
const path = require('path');
const { resolveDataPath, writeJsonAtomic, writeTextAtomic } = require('../lib/data-resolver');

const TEAMS_PATH = resolveDataPath('teams.json');
const ID_MAP_PATH = path.join(__dirname, '..', 'data', 'id_map_center.json');

/**
  * Load JSON files
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ Failed to load ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

/**
  * Normalize names for matching
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // remove special characters
    .replace(/\s+/g, ' '); // merge multiple spaces
}

/**
  * Build name-matching map
 */
function buildNameMapping(idMap) {
  const mapping = new Map();
  
  for (const [name, data] of Object.entries(idMap)) {
    // Primary name
    const normalizedName = normalizeName(name);
    mapping.set(normalizedName, { name, ...data });
    
    // Aliases
    if (data.aliases) {
      for (const alias of data.aliases) {
        const normalizedAlias = normalizeName(alias);
        mapping.set(normalizedAlias, { name, ...data });
      }
    }
  }
  
  return mapping;
}

/**
  * Main function
 */
function main() {
  console.log('🔧 Building ID Bridge...\n');
  
  // Load data
  const teamsData = loadJSON(TEAMS_PATH);
  const idMap = loadJSON(ID_MAP_PATH);
  
  // Build name map
  const nameMapping = buildNameMapping(idMap);
  
  // Result container
  const bridge = {};
  const unmatched = [];
  
  // Iterate over FIFA teams
  const teams = teamsData.teams || teamsData;
  
  for (const [fifaCode, teamData] of Object.entries(teams)) {
    const fifaId = teamData.fifaId;
    const englishName = teamData.name?.en || teamData.name?.official || fifaCode;
    const zhName = teamData.name?.zh || '';
    const iso2 = teamData.iso2 || '';
    
    // Attempt match
    const normalizedName = normalizeName(englishName);
    const match = nameMapping.get(normalizedName);
    
    if (match && match.espn_id) {
      // Match succeeded
      bridge[fifaCode] = {
        fifa_code: fifaCode,
        fifa_id: fifaId,
        espn_id: match.espn_id,
        iso2: iso2,
        name_en: englishName,
        name_zh: zhName,
        name_official: match.official_name || englishName,
        group: teamData.group || null,
        ranking: teamData.ranking || null
      };
      
      console.log(`✅ ${fifaCode} (${englishName}) → ESPN: ${match.espn_id}`);
    } else {
      // No match
      unmatched.push({
        fifa_code: fifaCode,
        fifa_id: fifaId,
        iso2: iso2,
        name_en: englishName,
        name_zh: zhName,
        group: teamData.group || null,
        ranking: teamData.ranking || null,
        reason: match ? 'ESPN ID 为空' : '名称无法匹配'
      });
      
      console.log(`⚠️  ${fifaCode} (${englishName}) → no match`);
    }
  }
  
  // Write bridge.json
  const BRIDGE_PATH = writeJsonAtomic('id_bridge.json', bridge);
  console.log(`\n✅ Written: ${BRIDGE_PATH}`);
  console.log(`   Matched: ${Object.keys(bridge).length} teams`);
  
  // Write unmatched.txt
  if (unmatched.length > 0) {
    const unmatchedContent = unmatched.map(team => {
      return [
        `FIFA Code: ${team.fifa_code}`,
        `FIFA ID: ${team.fifa_id}`,
        `ISO2: ${team.iso2}`,
        `English Name: ${team.name_en}`,
        `Chinese Name: ${team.name_zh}`,
        `Group: ${team.group || 'N/A'}`,
        `Ranking: ${team.ranking || 'N/A'}`,
        `Reason: ${team.reason}`,
        '---'
      ].join('\n');
    }).join('\n');
    
    const UNMATCHED_PATH = writeTextAtomic('unmatched.txt', unmatchedContent);
    console.log(`\n⚠️  Unmatched teams: ${UNMATCHED_PATH}`);
    console.log(`   Unmatched: ${unmatched.length} teams`);
  } else {
    console.log('\n🎉 All teams matched!');
  }
  
  // Output summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 ID Bridge build complete');
  console.log(`   FIFA total teams: ${Object.keys(teams).length}`);
  console.log(`   Matched: ${Object.keys(bridge).length}`);
  console.log(`   Unmatched: ${unmatched.length}`);
}

// Run
main();
