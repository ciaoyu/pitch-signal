#!/usr/bin/env node

/**
 * build-bracket-slot-map.js
 *
 * 一次性脚本：从 match_snapshot_schedule.json 和 bracket_2026.json
 * 自动生成 ESPN matchId → bracket slot ID 的静态映射。
 *
 * 运行: node scripts/build-bracket-slot-map.js
 * 输出: data/bracket_slot_map.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_FILE = path.join(ROOT, 'data', 'match_snapshot_schedule.json');
const BRACKET_FILE = path.join(ROOT, 'data', 'bracket_2026.json');
const OUTPUT_FILE = path.join(ROOT, 'data', 'bracket_slot_map.json');

// 加载数据
const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
const bracket = JSON.parse(fs.readFileSync(BRACKET_FILE, 'utf8'));

const knockoutMatches = schedule.matches.filter(m => m.stage === 'knockout');

/**
 * 将 bracket 的 teamA/teamB slot token 转换为 shortName 模式
 * 例如: teamA="A2", teamB="B2" → "2B @ 2A"
 * 例如: teamA="E1", teamB="3rd A/B/C/D/F" → "3RD @ 1E"
 */
function slotToShortPattern(teamA, teamB) {
  function slotToToken(slot) {
    if (!slot) return null;
    if (slot.startsWith('3rd ')) return '3RD';
    const match = slot.match(/^(\d+)([A-L])$/); // e.g., "A2" → "2A", "E1" → "1E"
    if (match) return `${match[1]}${match[2]}`;
    return null;
  }
  const tokenA = slotToToken(teamA);
  const tokenB = slotToToken(teamB);
  if (!tokenA || !tokenB) return null;
  return `${tokenB} @ ${tokenA}`; // 注意顺序：teamB 是 away，teamA 是 home
}

/**
 * 从 R16+ schedule 的 name 字段解析 feed slot
 * "Round of 32 3 Winner at Round of 32 1 Winner" → ["R32-3", "R32-1"]
 */
function parseR16Name(name) {
  const match = name.match(/Round of 32 (\d+) Winner at Round of 32 (\d+) Winner/);
  if (match) return [`R32-${match[2]}`, `R32-${match[1]}`]; // home first, away second
  return null;
}

function parseQFName(name) {
  const match = name.match(/Round of 16 (\d+) Winner at Round of 16 (\d+) Winner/);
  if (match) return [`R16-${match[2]}`, `R16-${match[1]}`];
  return null;
}

function parseSFName(name) {
  // QF winners → SF: "Quarterfinal X Winner at Quarterfinal Y Winner"
  const m1 = name.match(/Quarterfinal (\d+) Winner at Quarterfinal (\d+) Winner/);
  if (m1) return [`QF-${m1[2]}`, `QF-${m1[1]}`];
  // SF winners → FINAL: "Semifinal X Winner at Semifinal Y Winner"
  const m2 = name.match(/Semifinal (\d+) Winner at Semifinal (\d+) Winner/);
  if (m2) return [`SF-${m2[2]}`, `SF-${m2[1]}`];
  return null;
}

const slotMap = {};
let unmatched = [];

// Step 1: 匹配 R32（通过 shortName pattern）
for (const [slotId, bracketMatch] of Object.entries(bracket.matches)) {
  if (!slotId.startsWith('R32-')) continue;

  const pattern = slotToShortPattern(bracketMatch.teamA, bracketMatch.teamB);
  if (!pattern) continue;

  const scheduleMatch = knockoutMatches.find(m => m.shortName === pattern);
  if (scheduleMatch) {
    slotMap[slotId] = {
      espnMatchId: scheduleMatch.matchId,
      shortName: scheduleMatch.shortName,
      teams: `${bracketMatch.teamA} vs ${bracketMatch.teamB}`,
    };
  } else {
    unmatched.push({ slotId, pattern });
  }
}

// Step 2: 匹配 R16（通过 name 字段解析 feed）
for (const [slotId, bracketMatch] of Object.entries(bracket.matches)) {
  if (!slotId.startsWith('R16-')) continue;
  if (slotMap[slotId]) continue;

  const scheduleMatch = knockoutMatches.find(m => {
    if (m.shortName !== 'RD32 @ RD32') return false;
    const parsed = parseR16Name(m.name);
    if (!parsed) return false;
    return parsed[0] === bracketMatch.feedA && parsed[1] === bracketMatch.feedB;
  });

  if (scheduleMatch) {
    slotMap[slotId] = {
      espnMatchId: scheduleMatch.matchId,
      shortName: scheduleMatch.shortName,
      name: scheduleMatch.name,
    };
  } else {
    unmatched.push({ slotId, feedA: bracketMatch.feedA, feedB: bracketMatch.feedB });
  }
}

// Step 3: 匹配 QF
for (const [slotId, bracketMatch] of Object.entries(bracket.matches)) {
  if (!slotId.startsWith('QF-')) continue;
  if (slotMap[slotId]) continue;

  const scheduleMatch = knockoutMatches.find(m => {
    const parsed = parseQFName(m.name);
    if (!parsed) return false;
    return parsed[0] === bracketMatch.feedA && parsed[1] === bracketMatch.feedB;
  });

  if (scheduleMatch) {
    slotMap[slotId] = {
      espnMatchId: scheduleMatch.matchId,
      shortName: scheduleMatch.shortName,
      name: scheduleMatch.name,
    };
  } else {
    unmatched.push({ slotId, feedA: bracketMatch.feedA, feedB: bracketMatch.feedB });
  }
}

// Step 4: 匹配 SF
for (const [slotId, bracketMatch] of Object.entries(bracket.matches)) {
  if (!slotId.startsWith('SF-')) continue;
  if (slotMap[slotId]) continue;

  const scheduleMatch = knockoutMatches.find(m => {
    const parsed = parseSFName(m.name);
    if (!parsed) return false;
    return parsed[0] === bracketMatch.feedA && parsed[1] === bracketMatch.feedB;
  });

  if (scheduleMatch) {
    slotMap[slotId] = {
      espnMatchId: scheduleMatch.matchId,
      shortName: scheduleMatch.shortName,
      name: scheduleMatch.name,
    };
  } else {
    unmatched.push({ slotId, feedA: bracketMatch.feedA, feedB: bracketMatch.feedB });
  }
}

// Step 5: 匹配 FINAL
for (const [slotId, bracketMatch] of Object.entries(bracket.matches)) {
  if (slotId !== 'FINAL') continue;
  if (slotMap[slotId]) continue;

  const scheduleMatch = knockoutMatches.find(m => {
    const parsed = parseSFName(m.name);
    if (!parsed) return false;
    return parsed[0] === bracketMatch.feedA && parsed[1] === bracketMatch.feedB;
  });

  if (scheduleMatch) {
    slotMap[slotId] = {
      espnMatchId: scheduleMatch.matchId,
      shortName: scheduleMatch.shortName,
      name: scheduleMatch.name,
    };
  } else {
    // FINAL 可能用不同的命名
    const finalMatch = knockoutMatches.find(m =>
      m.name.includes('Semifinal') && m.name.includes('Final') && m.shortName.includes('SF')
    );
    if (finalMatch) {
      slotMap[slotId] = {
        espnMatchId: finalMatch.matchId,
        shortName: finalMatch.shortName,
        name: finalMatch.name,
      };
    } else {
      unmatched.push({ slotId, feedA: bracketMatch.feedA, feedB: bracketMatch.feedB });
    }
  }
}

// Step 6: 处理季军赛（3rd place match）- 不在 bracket 结构中，单独记录
const thirdPlaceMatch = knockoutMatches.find(m =>
  m.shortName.includes('SF L') || m.name.includes('Loser')
);
if (thirdPlaceMatch && !Object.values(slotMap).find(s => s.espnMatchId === thirdPlaceMatch.matchId)) {
  slotMap['3RD-PLACE'] = {
    espnMatchId: thirdPlaceMatch.matchId,
    shortName: thirdPlaceMatch.shortName,
    name: thirdPlaceMatch.name,
    note: 'Third-place match (not in bracket structure)',
  };
}

// 输出
const result = {
  generatedAt: new Date().toISOString(),
  totalSlots: Object.keys(slotMap).length,
  knockoutMatchesInSchedule: knockoutMatches.length,
  matched: Object.keys(slotMap).length,
  unmatched: unmatched.length,
  matches: slotMap,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n');

console.log(`✅ Generated bracket_slot_map.json`);
console.log(`   Matched: ${Object.keys(slotMap).length}/${bracket.matches.length + 1} bracket slots`);
console.log(`   Unmatched: ${unmatched.length}`);
if (unmatched.length > 0) {
  console.log(`   Unmatched slots:`, unmatched.map(u => u.slotId).join(', '));
}
