#!/usr/bin/env node

/**
 * build-id-bridge.js
 * 构建 id_bridge.json，连接 FIFA code/id ↔ ESPN id ↔ 国家名
 * 
 * 输入：
 * - data/sources/seed/wc2026/teams.json (FIFA 数据)
 * - data/id_map_center.json (ESPN 数据)
 * 
 * 输出：
 * - data/sources/seed/wc2026/id_bridge.json
 * - data/sources/seed/wc2026/unmatched.txt (无法匹配的球队)
 */

const fs = require('fs');
const path = require('path');

const TEAMS_PATH = path.join(__dirname, '..', 'data', 'wc2026', 'teams.json');
const ID_MAP_PATH = path.join(__dirname, '..', 'data', 'id_map_center.json');
const BRIDGE_PATH = path.join(__dirname, '..', 'data', 'sources', 'seed', 'wc2026', 'id_bridge.json');
const UNMATCHED_PATH = path.join(__dirname, '..', 'data', 'wc2026', 'unmatched.txt');

/**
 * 加载 JSON 文件
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ 无法加载 ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

/**
 * 标准化名称用于匹配
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // 移除特殊字符
    .replace(/\s+/g, ' '); // 合并多个空格
}

/**
 * 构建名称匹配映射
 */
function buildNameMapping(idMap) {
  const mapping = new Map();
  
  for (const [name, data] of Object.entries(idMap)) {
    // 主名称
    const normalizedName = normalizeName(name);
    mapping.set(normalizedName, { name, ...data });
    
    // 别名
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
 * 主函数
 */
function main() {
  console.log('🔧 构建 ID Bridge...\n');
  
  // 加载数据
  const teamsData = loadJSON(TEAMS_PATH);
  const idMap = loadJSON(ID_MAP_PATH);
  
  // 构建名称映射
  const nameMapping = buildNameMapping(idMap);
  
  // 结果容器
  const bridge = {};
  const unmatched = [];
  
  // 遍历 FIFA teams
  const teams = teamsData.teams || teamsData;
  
  for (const [fifaCode, teamData] of Object.entries(teams)) {
    const fifaId = teamData.fifaId;
    const englishName = teamData.name?.en || teamData.name?.official || fifaCode;
    const zhName = teamData.name?.zh || '';
    const iso2 = teamData.iso2 || '';
    
    // 尝试匹配
    const normalizedName = normalizeName(englishName);
    const match = nameMapping.get(normalizedName);
    
    if (match && match.espn_id) {
      // 匹配成功
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
      // 无法匹配
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
      
      console.log(`⚠️  ${fifaCode} (${englishName}) → 无法匹配`);
    }
  }
  
  // 写入 bridge.json
  fs.writeFileSync(BRIDGE_PATH, JSON.stringify(bridge, null, 2), 'utf8');
  console.log(`\n✅ 已写入: ${BRIDGE_PATH}`);
  console.log(`   匹配成功: ${Object.keys(bridge).length} 支球队`);
  
  // 写入 unmatched.txt
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
    
    fs.writeFileSync(UNMATCHED_PATH, unmatchedContent, 'utf8');
    console.log(`\n⚠️  未匹配球队: ${UNMATCHED_PATH}`);
    console.log(`   未匹配: ${unmatched.length} 支球队`);
  } else {
    console.log('\n🎉 所有球队都已匹配！');
  }
  
  // 输出汇总
  console.log('\n' + '='.repeat(60));
  console.log('📊 ID Bridge 构建完成');
  console.log(`   FIFA 球队总数: ${Object.keys(teams).length}`);
  console.log(`   匹配成功: ${Object.keys(bridge).length}`);
  console.log(`   未匹配: ${unmatched.length}`);
}

// 运行
main();
