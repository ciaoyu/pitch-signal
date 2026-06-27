#!/usr/bin/env node

/**
 * build-match-id-bridge.js
 * 构建比赛 ID 桥：ESPN match ID ↔ FIFA match ID
 *
 * 输入：
 * - data/wc2026/matches.json (26worldcup，FIFA match ID + home/away code + date)
 * - data/match_snapshot_schedule.json (ESPN scoreboard，ESPN match ID + home/away abbreviation + kickoffUtc)
 *
 * 输出：
 * - data/wc2026/match_id_bridge.json
 *
 * 匹配策略：按 home code + away code + 日期(±1天容差) join
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MATCHES_PATH = path.join(ROOT, 'data', 'wc2026', 'matches.json');
const SCHEDULE_PATH = path.join(ROOT, 'data', 'match_snapshot_schedule.json');
const BRIDGE_PATH = path.join(ROOT, 'data', 'wc2026', 'match_id_bridge.json');
const REPORT_PATH = path.join(ROOT, 'data', 'wc2026', 'match_id_bridge_report.txt');

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
 * 将日期字符串归一化到 YYYY-MM-DD
 */
function dateKey(isoStr) {
  if (!isoStr) return null;
  return isoStr.slice(0, 10); // "2026-06-11"
}

/**
 * 标准化球队代码（去除空格、统一大小写）
 */
function normCode(code) {
  return (code || '').trim().toUpperCase();
}

/**
 * 比较两个日期是否在容差范围内（默认 ±1 天）
 */
function withinDays(d1, d2, tolerance = 1) {
  if (!d1 || !d2) return false;
  const t1 = Date.parse(d1);
  const t2 = Date.parse(d2);
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= tolerance * 24 * 60 * 60 * 1000;
}

function main() {
  console.log('🔧 构建 Match ID Bridge...\n');

  // 1. 加载数据
  const fifaData = loadJSON(MATCHES_PATH);
  const espnData = loadJSON(SCHEDULE_PATH);

  const fifaMatches = fifaData.matches || [];
  const espnMatches = espnData.matches || [];

  console.log(`   FIFA matches.json: ${fifaMatches.length} 场比赛`);
  console.log(`   ESPN schedule:     ${espnMatches.length} 场比赛\n`);

  // 2. 构建 ESPN 端的快速查找索引：{ homeCode_awayCode_dateKey → [...espnMatches] }
  const espnIndex = new Map();
  for (const em of espnMatches) {
    const homeCode = normCode(em.teams?.home?.abbreviation || em.teams?.home?.name || '');
    const awayCode = normCode(em.teams?.away?.abbreviation || em.teams?.away?.name || '');
    const dk = dateKey(em.kickoffUtc);
    if (!homeCode || !awayCode || !dk) continue;

    // 双向索引（home-away 和 away-home 都可能是正确的映射方向）
    const keyFwd = `${homeCode}_${awayCode}_${dk}`;
    const keyRev = `${awayCode}_${homeCode}_${dk}`;

    if (!espnIndex.has(keyFwd)) espnIndex.set(keyFwd, []);
    espnIndex.get(keyFwd).push(em);

    if (!espnIndex.has(keyRev)) espnIndex.set(keyRev, []);
    espnIndex.get(keyRev).push(em);
  }

  // 3. 匹配
  const bridge = {};       // { espnMatchId → fifaMatchId }
  const reverseBridge = {}; // { fifaMatchId → espnMatchId }
  const unmatched = [];
  let matched = 0;

  for (const fm of fifaMatches) {
    const fifaId = String(fm.id);
    const homeCode = normCode(fm.home?.code || '');
    const awayCode = normCode(fm.away?.code || '');
    const dk = dateKey(fm.date);

    // 1. 对于淘汰赛，直接通过 kickoff 时间进行匹配（误差 1 分钟以内），因为此时队伍代码可能是占位符（2A, 2B等）或尚未确定
    if (fm.stage && fm.stage !== 'group') {
      const fTime = new Date(fm.date).getTime();
      const match = espnMatches.find(em => {
        if (em.stage !== 'knockout') return false;
        const eTime = new Date(em.kickoffUtc).getTime();
        return Math.abs(fTime - eTime) < 60000;
      });

      if (match) {
        const espnId = String(match.matchId);
        bridge[espnId] = {
          espn_match_id: espnId,
          fifa_match_id: fifaId,
          home: homeCode || normCode(fm.phA || ''),
          away: awayCode || normCode(fm.phB || ''),
          date: fm.date,
          fifa_stage: fm.stage || null,
          fifa_group: fm.group || null,
          fifa_status: fm.status || null,
          espn_name: match.name || '',
        };
        reverseBridge[fifaId] = espnId;
        matched++;
        continue;
      }
    }

    // 2. 小组赛或兜底逻辑：按队伍代码 + 日期匹配
    if (!homeCode || !awayCode) {
      unmatched.push({ fifaId, reason: 'missing_team_codes' });
      continue;
    }

    // 精确日期查找
    let candidates = espnIndex.get(`${homeCode}_${awayCode}_${dk}`) || [];

    // 如果精确日期找不到，放宽到 ±1 天
    if (candidates.length === 0 && dk) {
      const targetMs = Date.parse(fm.date);
      for (const [key, ems] of espnIndex) {
        const parts = key.split('_');
        if (key.endsWith(`_${dk}`)) continue; // 已处理
        const emDate = ems[0]?.kickoffUtc;
        if (emDate && withinDays(fm.date, emDate, 1)) {
          // 检查球队是否匹配
          const emHome = normCode(ems[0].teams?.home?.abbreviation || '');
          const emAway = normCode(ems[0].teams?.away?.abbreviation || '');
          if ((emHome === homeCode && emAway === awayCode) ||
              (emHome === awayCode && emAway === homeCode)) {
            candidates = ems;
            break;
          }
        }
      }
    }

    if (candidates.length > 0) {
      // 取第一个匹配（通常只有一个）
      const espnMatch = candidates[0];
      const espnId = String(espnMatch.matchId);

      bridge[espnId] = {
        espn_match_id: espnId,
        fifa_match_id: fifaId,
        home: homeCode,
        away: awayCode,
        date: fm.date,
        fifa_stage: fm.stage || null,
        fifa_group: fm.group || null,
        fifa_status: fm.status || null,
        espn_name: espnMatch.name || '',
      };
      reverseBridge[fifaId] = espnId;
      matched++;
    } else {
      unmatched.push({
        fifaId,
        home: homeCode,
        away: awayCode,
        date: fm.date,
        reason: 'no_espn_match_found',
      });
    }
  }

  // 4. 写入 bridge.json
  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      fifa: 'data/wc2026/matches.json (26worldcup)',
      espn: 'data/match_snapshot_schedule.json (ESPN scoreboard)',
    },
    totalFifa: fifaMatches.length,
    totalEspn: espnMatches.length,
    matched,
    unmatched: unmatched.length,
    bridge,
    reverseBridge, // fifaId → espnId 反向查询
  };

  fs.writeFileSync(BRIDGE_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✅ 已写入: ${BRIDGE_PATH}`);
  console.log(`   匹配成功: ${matched}/${fifaMatches.length}`);

  // 5. 写入报告
  const reportLines = [
    `Match ID Bridge 构建报告`,
    `生成时间: ${output.generatedAt}`,
    ``,
    `FIFA matches: ${fifaMatches.length}`,
    `ESPN matches: ${espnMatches.length}`,
    `匹配成功: ${matched}`,
    `未匹配: ${unmatched.length}`,
    ``,
  ];

  if (unmatched.length > 0) {
    reportLines.push('--- 未匹配比赛 ---');
    for (const u of unmatched) {
      reportLines.push(`  FIFA ${u.fifaId}: ${u.home || '?'} vs ${u.away || '?'} (${u.date || '?'}) — ${u.reason}`);
    }
    reportLines.push('');
  }

  // 覆盖率（对于 lineups 已存在的场次）
  try {
    const lineups = loadJSON(path.join(ROOT, 'data', 'wc2026', 'lineups.json'));
    const lineupIds = Object.keys(lineups);
    const bridgedLineups = lineupIds.filter(fid => reverseBridge[fid]);
    reportLines.push('--- Lineups 覆盖率 ---');
    reportLines.push(`  总 lineups: ${lineupIds.length}`);
    reportLines.push(`  已桥接: ${bridgedLineups.length}`);
    reportLines.push(`  未桥接: ${lineupIds.length - bridgedLineups.length}`);
    if (lineupIds.length - bridgedLineups.length > 0) {
      reportLines.push('  未桥接的 lineups 场次:');
      lineupIds.filter(fid => !reverseBridge[fid]).forEach(fid => {
        reportLines.push(`    FIFA ${fid}`);
      });
    }
  } catch { /* lineups.json 不存在 */ }

  const report = reportLines.join('\n');
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(`📝 报告已写入: ${REPORT_PATH}`);

  // 6. 汇总
  console.log('\n' + '='.repeat(60));
  console.log('📊 Match ID Bridge 构建完成');
  console.log(`   FIFA 比赛: ${fifaMatches.length}`);
  console.log(`   ESPN 比赛: ${espnMatches.length}`);
  console.log(`   匹配成功: ${matched}`);
  console.log(`   未匹配: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n⚠️  未匹配详情:');
    unmatched.slice(0, 5).forEach(u => {
      console.log(`   - FIFA ${u.fifaId}: ${u.home || '?'} vs ${u.away || '?'} (${u.date || '?'})`);
    });
    if (unmatched.length > 5) console.log(`   ... 还有 ${unmatched.length - 5} 条`);
  }
}

main();
