#!/usr/bin/env node

/**
 * build-player-id-bridge.js
  * Build player_id_bridge.json, linking local slug IDs ↔ ESPN athlete IDs
 *
  * Matching strategy: by name + number + position, use fuzzy-match.js to match the players in lineups
  * to the players in squads, building a bidirectional bridge.
 *
  * Inputs:
  * - runtime or resources/seed/wc2026/lineups.json (ESPN athlete ID + name + number + fieldPos)
  * - runtime or resources/seed/wc2026/squads.json  (local slug ID + name + no + pos)
  * - runtime or resources/seed/wc2026/matches.json (home.code / away.code)
 *
  * Outputs:
 * - $DATA_PATH/wc2026/player_id_bridge.json
 * - $DATA_PATH/wc2026/player_id_bridge_report.txt
 */

const fs = require('fs');
const path = require('path');
const { fuzzyMatchPlayer } = require('../lib/fuzzy-match');
const { resolveDataPath, writeJsonAtomic, writeTextAtomic } = require('../lib/data-resolver');

const LINEUPS_PATH = resolveDataPath('lineups.json');
const SQUADS_PATH = resolveDataPath('squads.json');
const MATCHES_PATH = resolveDataPath('matches.json');

/** fieldPos → squad pos mapping */
const FIELDPOS_TO_POS = { 0: 'GK', 1: 'DF', 2: 'MF', 3: 'FW' };

/**
  * Extract the player array from a squad team object
 */
function getSquadPlayers(teamSquad) {
  if (!teamSquad) return [];
  if (Array.isArray(teamSquad.players)) return teamSquad.players;
  // Support flat structure
  return Object.values(teamSquad).filter(p => typeof p === 'object' && p.name && p.id);
}

/**
  * Normalize names for matching (same as fuzzy-match.js's normalizeString)
 */
function normalizeName(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
  * ESPN avatar URL construction (standard CDN direct link, no API call needed)
 */
function espnPhotoUrl(espnAthleteId) {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${espnAthleteId}.png`;
}

function main() {
  console.log('🔧 Building Player ID Bridge...\n');

  // ─── Load data ───
  const lineups = JSON.parse(fs.readFileSync(LINEUPS_PATH, 'utf8'));
  const squads = JSON.parse(fs.readFileSync(SQUADS_PATH, 'utf8'));
  const matchesData = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));

  // Build fast lookup from FIFA match ID → match info
  const matchMap = new Map();
  for (const m of matchesData.matches) {
    matchMap.set(String(m.id), m);
  }

  // ─── Bridge results ───
  const bySlug = {};   // slug → { espnId, ... }
  const byEspnId = {}; // espnId → { slug, ... }
  const unmatched = [];
  const triedFailed = new Set(); // avoid recording the same espnId failure repeatedly

  const fifaMatchIds = Object.keys(lineups);
  console.log(`📋 Total ${fifaMatchIds.length} matches have lineups data\n`);

  for (const fifaMatchId of fifaMatchIds) {
    const matchLineup = lineups[fifaMatchId];
    const matchInfo = matchMap.get(fifaMatchId);

    if (!matchInfo) {
      console.log(`⚠️  ${fifaMatchId}: not found in matches.json, skipping`);
      continue;
    }

    const homeCode = matchInfo.home?.code;
    const awayCode = matchInfo.away?.code;

    if (!homeCode || !awayCode) {
      console.log(`⚠️  ${fifaMatchId}: missing team code, skipping`);
      continue;
    }

    // ─── Process home team ───
    const homeSquadPlayers = getSquadPlayers(squads[homeCode]);
    if (homeSquadPlayers.length === 0) {
      console.log(`⚠️  ${homeCode}: no player data in squads.json`);
    }

    const homePlayers = [
      ...(matchLineup.home?.xi || []),
      ...(matchLineup.home?.subs || []),
    ];

    for (const lineupPlayer of homePlayers) {
      const espnId = String(lineupPlayer.id);
      const lineupPos = FIELDPOS_TO_POS[lineupPlayer.fieldPos] || 'MF';

      // Skip already-matched or already-failed espnIds (same player appearing multiple times)
      if (byEspnId[espnId] || triedFailed.has(espnId)) continue;

      const target = {
        name: normalizeName(lineupPlayer.name),
        num: lineupPlayer.number,
        pos: lineupPos,
      };

      const best = fuzzyMatchPlayer(target, homeSquadPlayers, 0.65);

      if (best) {
        byEspnId[espnId] = { slug: best.id, teamCode: homeCode };

        // Dedupe: the same slug may match different espnIds (rare; take the first)
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

    // ─── Process away team ───
    const awaySquadPlayers = getSquadPlayers(squads[awayCode]);
    if (awaySquadPlayers.length === 0) {
      console.log(`⚠️  ${awayCode}: no player data in squads.json`);
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

  // ─── Statistics ───
  const uniqueSlugs = Object.keys(bySlug).length;
  const uniqueEspnIds = Object.keys(byEspnId).length;
  const uniqueUnmatched = unmatched.length;
  const totalUnique = uniqueEspnIds + uniqueUnmatched;
  const matchRate = totalUnique > 0 ? (uniqueEspnIds / totalUnique * 100).toFixed(1) : '0.0';

  // ─── Write bridge.json ───
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

  const BRIDGE_PATH = writeJsonAtomic('player_id_bridge.json', bridge);
  console.log(`\n✅ Written: ${BRIDGE_PATH}`);

  // ─── Report ───
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

  // Statistics at the XI level
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

  // Statistics by position group
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
    // Group by team
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
  const REPORT_PATH = writeTextAtomic('player_id_bridge_report.txt', report);
  console.log(`✅ Report written: ${REPORT_PATH}`);

  // Terminal summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Player ID Bridge build complete');
  console.log(`   Unique players: ${totalUnique}`);
  console.log(`   Matched: ${uniqueEspnIds} (${matchRate}%)`);
  console.log(`   XI match rate: ${xiMatched}/${xiAttempted} (${xiRate}%)`);
  console.log(`   Unmatched:   ${uniqueUnmatched}`);
  console.log(`   Unique slug: ${uniqueSlugs} / unique espnId: ${uniqueEspnIds}`);
}

main();
