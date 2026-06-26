#!/usr/bin/env node

/**
 * build-player-id-bridge.js
 * 构建 player_id_bridge.json，连接本地 slug ID ↔ ESPN athlete ID
 *
 * 匹配策略：按 姓名+号码+位置 使用 fuzzy-match.js 把 lineups 中的球员
 * 匹配到 squads 中的球员，构建双向桥接。
 *
 * 输入：
 * - data/wc2026/lineups.json  (ESPN athlete ID + name + number + fieldPos)
 * - data/wc2026/squads.json   (本地 slug ID + name + no + pos)
 * - data/wc2026/matches.json  (home.code / away.code)
 *
 * 输出：
 * - data/wc2026/player_id_bridge.json
 * - data/wc2026/player_id_bridge_report.txt
 */

const fs = require('fs');
const path = require('path');
const { fuzzyMatchPlayer } = require('../lib/fuzzy-match');

const DATA_DIR = path.join(__dirname, '..', 'data', 'wc2026');
const LINEUPS_PATH = path.join(DATA_DIR, 'lineups.json');
const SQUADS_PATH = path.join(DATA_DIR, 'squads.json');
const MATCHES_PATH = path.join(DATA_DIR, 'matches.json');
const BRIDGE_PATH = path.join(DATA_DIR, 'player_id_bridge.json');
const REPORT_PATH = path.join(DATA_DIR, 'player_id_bridge_report.txt');

/** fieldPos → squad pos 映射 */
const FIELDPOS_TO_POS = { 0: 'GK', 1: 'DF', 2: 'MF', 3: 'FW' };

/**
 * 从 squad 团队对象中提取球员数组
 */
function getSquadPlayers(teamSquad) {
  if (!teamSquad) return [];
  if (Array.isArray(teamSquad.players)) return teamSquad.players;
  // 兼容扁平结构
  return Object.values(teamSquad).filter(p => typeof p === 'object' && p.name && p.id);
}

/**
 * 标准化姓名用于匹配（同 fuzzy-match.js 的 normalizeString）
 */
function normalizeName(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * ESPN 头像 URL 构造（标准 CDN 直链，无需 API 调用）
 */
function espnPhotoUrl(espnAthleteId) {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${espnAthleteId}.png`;
}

function main() {
  console.log('🔧 构建 Player ID Bridge...\n');

  // ─── 加载数据 ───
  const lineups = JSON.parse(fs.readFileSync(LINEUPS_PATH, 'utf8'));
  const squads = JSON.parse(fs.readFileSync(SQUADS_PATH, 'utf8'));
  const matchesData = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));

  // 构建 FIFA match ID → match info 的快速查找
  const matchMap = new Map();
  for (const m of matchesData.matches) {
    matchMap.set(String(m.id), m);
  }

  // ─── 桥接结果 ───
  const bySlug = {};   // slug → { espnId, ... }
  const byEspnId = {}; // espnId → { slug, ... }
  const unmatched = [];
  const triedFailed = new Set(); // 避免重复记录同一 espnId 的失败

  const fifaMatchIds = Object.keys(lineups);
  console.log(`📋 共 ${fifaMatchIds.length} 场比赛有 lineups 数据\n`);

  for (const fifaMatchId of fifaMatchIds) {
    const matchLineup = lineups[fifaMatchId];
    const matchInfo = matchMap.get(fifaMatchId);

    if (!matchInfo) {
      console.log(`⚠️  ${fifaMatchId}: 在 matches.json 中未找到，跳过`);
      continue;
    }

    const homeCode = matchInfo.home?.code;
    const awayCode = matchInfo.away?.code;

    if (!homeCode || !awayCode) {
      console.log(`⚠️  ${fifaMatchId}: 缺少球队代码，跳过`);
      continue;
    }

    // ─── 处理主队 ───
    const homeSquadPlayers = getSquadPlayers(squads[homeCode]);
    if (homeSquadPlayers.length === 0) {
      console.log(`⚠️  ${homeCode}: squads.json 中无球员数据`);
    }

    const homePlayers = [
      ...(matchLineup.home?.xi || []),
      ...(matchLineup.home?.subs || []),
    ];

    for (const lineupPlayer of homePlayers) {
      const espnId = String(lineupPlayer.id);
      const lineupPos = FIELDPOS_TO_POS[lineupPlayer.fieldPos] || 'MF';

      // 跳过已匹配或已尝试失败的 espnId（同一球员多次出场）
      if (byEspnId[espnId] || triedFailed.has(espnId)) continue;

      const target = {
        name: normalizeName(lineupPlayer.name),
        num: lineupPlayer.number,
        pos: lineupPos,
      };

      const best = fuzzyMatchPlayer(target, homeSquadPlayers, 0.65);

      if (best) {
        byEspnId[espnId] = { slug: best.id, teamCode: homeCode };

        // 去重：同一个 slug 可能匹配到不同 espnId（极少见，取第一个）
        if (!bySlug[best.id]) {
          bySlug[best.id] = {
            espnId,
            teamCode: homeCode,
            nameLineup: lineupPlayer.name,
            nameSquad: best.name,
            number: lineupPlayer.number,
            pos: lineupPos,
          };
        }
      } else {
        triedFailed.add(espnId);
        unmatched.push({
          espnId,
          name: lineupPlayer.name,
          number: lineupPlayer.number,
          pos: lineupPos,
          teamCode: homeCode,
          fifaMatchId,
          side: 'home',
          reason: 'fuzzy match score < 0.65',
        });
      }
    }

    // ─── 处理客队 ───
    const awaySquadPlayers = getSquadPlayers(squads[awayCode]);
    if (awaySquadPlayers.length === 0) {
      console.log(`⚠️  ${awayCode}: squads.json 中无球员数据`);
    }

    const awayPlayers = [
      ...(matchLineup.away?.xi || []),
      ...(matchLineup.away?.subs || []),
    ];

    for (const lineupPlayer of awayPlayers) {
      const espnId = String(lineupPlayer.id);
      const lineupPos = FIELDPOS_TO_POS[lineupPlayer.fieldPos] || 'MF';

      if (byEspnId[espnId] || triedFailed.has(espnId)) continue;

      const target = {
        name: normalizeName(lineupPlayer.name),
        num: lineupPlayer.number,
        pos: lineupPos,
      };

      const best = fuzzyMatchPlayer(target, awaySquadPlayers, 0.65);

      if (best) {
        byEspnId[espnId] = { slug: best.id, teamCode: awayCode };

        if (!bySlug[best.id]) {
          bySlug[best.id] = {
            espnId,
            teamCode: awayCode,
            nameLineup: lineupPlayer.name,
            nameSquad: best.name,
            number: lineupPlayer.number,
            pos: lineupPos,
          };
        }
      } else {
        triedFailed.add(espnId);
        unmatched.push({
          espnId,
          name: lineupPlayer.name,
          number: lineupPlayer.number,
          pos: lineupPos,
          teamCode: awayCode,
          fifaMatchId,
          side: 'away',
          reason: 'fuzzy match score < 0.65',
        });
      }
    }
  }

  // ─── 统计 ───
  const uniqueSlugs = Object.keys(bySlug).length;
  const uniqueEspnIds = Object.keys(byEspnId).length;
  const uniqueUnmatched = unmatched.length;
  const totalUnique = uniqueEspnIds + uniqueUnmatched;
  const matchRate = totalUnique > 0 ? (uniqueEspnIds / totalUnique * 100).toFixed(1) : '0.0';

  // ─── 写出 bridge.json ───
  const bridge = {
    generatedAt: new Date().toISOString(),
    bySlug,
    byEspnId,
    stats: {
      totalUniquePlayers: totalUnique,
      matched: uniqueEspnIds,
      unmatched: uniqueUnmatched,
      uniqueSlugs,
      uniqueEspnIds,
      matchRate: parseFloat(matchRate),
    },
    unmatched,
  };

  fs.writeFileSync(BRIDGE_PATH, JSON.stringify(bridge, null, 2), 'utf8');
  console.log(`\n✅ 已写入: ${BRIDGE_PATH}`);

  // ─── 报告 ───
  const lines = [];
  lines.push('Player ID Bridge 构建报告');
  lines.push('='.repeat(60));
  lines.push(`生成时间: ${bridge.generatedAt}`);
  lines.push(`比赛场次: ${fifaMatchIds.length}`);
  lines.push('');
  lines.push('匹配统计');
  lines.push('-'.repeat(40));
  lines.push(`  唯一球员总计: ${totalUnique}`);
  lines.push(`  匹配成功: ${uniqueEspnIds} (${matchRate}%)`);
  lines.push(`  未匹配:   ${uniqueUnmatched}`);
  lines.push(`  唯一 slug: ${uniqueSlugs}`);
  lines.push(`  唯一 espnId: ${uniqueEspnIds}`);
  lines.push('');
  lines.push('首发 XI 匹配率');
  lines.push('-'.repeat(40));

  // 统计 XI 层面
  let xiAttempted = 0, xiMatched = 0;
  for (const fifaMatchId of fifaMatchIds) {
    const matchLineup = lineups[fifaMatchId];
    for (const side of ['home', 'away']) {
      const xi = matchLineup[side]?.xi || [];
      for (const p of xi) {
        xiAttempted++;
        if (byEspnId[String(p.id)]) xiMatched++;
      }
    }
  }
  const xiRate = xiAttempted > 0 ? (xiMatched / xiAttempted * 100).toFixed(1) : '0.0';
  lines.push(`  XI 球员: ${xiMatched}/${xiAttempted} (${xiRate}%)`);

  // 三分档统计
  const posCounts = {};
  for (const fifaMatchId of fifaMatchIds) {
    const matchLineup = lineups[fifaMatchId];
    for (const side of ['home', 'away']) {
      const xi = matchLineup[side]?.xi || [];
      for (const p of xi) {
        const pos = FIELDPOS_TO_POS[p.fieldPos] || '??';
        if (!posCounts[pos]) posCounts[pos] = { total: 0, matched: 0 };
        posCounts[pos].total++;
        if (byEspnId[String(p.id)]) posCounts[pos].matched++;
      }
    }
  }
  lines.push('');
  lines.push('分位置 XI 匹配率');
  lines.push('-'.repeat(40));
  for (const [pos, c] of Object.entries(posCounts)) {
    const rate = c.total > 0 ? (c.matched / c.total * 100).toFixed(1) : '0.0';
    lines.push(`  ${pos}: ${c.matched}/${c.total} (${rate}%)`);
  }

  if (unmatched.length > 0) {
    lines.push('');
    lines.push('未匹配球员清单');
    lines.push('-'.repeat(40));
    // 按球队分组
    const byTeam = {};
    for (const u of unmatched) {
      if (!byTeam[u.teamCode]) byTeam[u.teamCode] = [];
      byTeam[u.teamCode].push(u);
    }
    for (const [teamCode, players] of Object.entries(byTeam)) {
      lines.push(`  ${teamCode} (${players.length}):`);
      for (const p of players.slice(0, 5)) {
        lines.push(`    #${p.number} ${p.name} (${p.pos}) ${p.side === 'home' ? '主' : '客'} ${p.fifaMatchId}`);
      }
      if (players.length > 5) lines.push(`    ... 还有 ${players.length - 5} 人`);
    }
  }

  const report = lines.join('\n');
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`✅ 已写入报告: ${REPORT_PATH}`);

  // 终端汇总
  console.log('\n' + '='.repeat(60));
  console.log('📊 Player ID Bridge 构建完成');
  console.log(`   唯一球员: ${totalUnique}`);
  console.log(`   匹配成功: ${uniqueEspnIds} (${matchRate}%)`);
  console.log(`   XI 匹配率: ${xiMatched}/${xiAttempted} (${xiRate}%)`);
  console.log(`   未匹配:   ${uniqueUnmatched}`);
  console.log(`   唯一 slug: ${uniqueSlugs} / 唯一 espnId: ${uniqueEspnIds}`);
}

main();
