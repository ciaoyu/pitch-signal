#!/usr/bin/env node

/**
 * build-match-id-bridge.js
  * Build the match ID bridge: ESPN match ID ↔ FIFA match ID
 *
  * Input:
  * - runtime or resources/seed/wc2026/matches.json (FIFA match ID + home/away code + date)
 * - data/match_snapshot_schedule.json (ESPN scoreboard，ESPN match ID + home/away abbreviation + kickoffUtc)
 *
  * Output:
 * - $DATA_PATH/wc2026/match_id_bridge.json
 *
  * Matching strategy: join by home code + away code + date (±1 day tolerance)
 */

const fs = require('fs');
const path = require('path');
const { resolveDataPath, writeJsonAtomic, writeTextAtomic } = require('../lib/data-resolver');

const ROOT = path.join(__dirname, '..');
const MATCHES_PATH = resolveDataPath('matches.json');
const SCHEDULE_PATH = path.join(ROOT, 'data', 'match_snapshot_schedule.json');

/**
  * Load JSON file
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
  * Normalize date string to YYYY-MM-DD
 */
function dateKey(isoStr) {
  if (!isoStr) return null;
  return isoStr.slice(0, 10); // "2026-06-11"
}

/**
  * Normalize team code (strip spaces, unify case)
 */
function normCode(code) {
  return (code || '').trim().toUpperCase();
}

/**
  * Compare whether two dates are within tolerance (default ±1 day)
 */
function withinDays(d1, d2, tolerance = 1) {
  if (!d1 || !d2) return false;
  const t1 = Date.parse(d1);
  const t2 = Date.parse(d2);
  if (isNaN(t1) || isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= tolerance * 24 * 60 * 60 * 1000;
}

function main() {
  console.log('🔧 Building Match ID Bridge...\n');

    // 1. load data
  const fifaData = loadJSON(MATCHES_PATH);
  const espnData = loadJSON(SCHEDULE_PATH);

  const fifaMatches = fifaData.matches || [];
  const espnMatches = espnData.matches || [];

  console.log(`   FIFA matches.json: ${fifaMatches.length} matches`);
  console.log(`   ESPN schedule:     ${espnMatches.length} matches\n`);

    // 2. build ESPN-side fast lookup index: { homeCode_awayCode_dateKey → [...espnMatches] }
  const espnIndex = new Map();
  for (const em of espnMatches) {
    const homeCode = normCode(em.teams?.home?.abbreviation || em.teams?.home?.name || '');
    const awayCode = normCode(em.teams?.away?.abbreviation || em.teams?.away?.name || '');
    const dk = dateKey(em.kickoffUtc);
    if (!homeCode || !awayCode || !dk) continue;

        // bidirectional index (both home-away and away-home may be the correct mapping direction)
    const keyFwd = `${homeCode}_${awayCode}_${dk}`;
    const keyRev = `${awayCode}_${homeCode}_${dk}`;

    if (!espnIndex.has(keyFwd)) espnIndex.set(keyFwd, []);
    espnIndex.get(keyFwd).push(em);

    if (!espnIndex.has(keyRev)) espnIndex.set(keyRev, []);
    espnIndex.get(keyRev).push(em);
  }

    // 3. match
  const bridge = {};       // { espnMatchId → fifaMatchId }
  const reverseBridge = {}; // { fifaMatchId → espnMatchId }
  const unmatched = [];
  let matched = 0;

  for (const fm of fifaMatches) {
    const fifaId = String(fm.id);
    const homeCode = normCode(fm.home?.code || '');
    const awayCode = normCode(fm.away?.code || '');
    const dk = dateKey(fm.date);

        // 1. for knockout matches, match directly by kickoff time (within 1 minute error), because the team codes may be placeholders (2A, 2B, etc.) or not yet determined
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

        // 2. group stage or fallback logic: match by team code + date
    if (!homeCode || !awayCode) {
      unmatched.push({ fifaId, reason: 'missing_team_codes' });
      continue;
    }

        // exact date lookup
    let candidates = espnIndex.get(`${homeCode}_${awayCode}_${dk}`) || [];

        // if exact date is not found, relax to ±1 day
    if (candidates.length === 0 && dk) {
      const targetMs = Date.parse(fm.date);
      for (const [key, ems] of espnIndex) {
        const parts = key.split('_');
        if (key.endsWith(`_${dk}`)) continue; // already processed
        const emDate = ems[0]?.kickoffUtc;
        if (emDate && withinDays(fm.date, emDate, 1)) {
                    // check whether the team matches
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
            // take the first match (usually only one)
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

    // 4. write bridge.json
  const output = {
    generatedAt: new Date().toISOString(),
    source: {
      fifa: `${MATCHES_PATH} (26worldcup)`,
      espn: 'data/match_snapshot_schedule.json (ESPN scoreboard)',
    },
    totalFifa: fifaMatches.length,
    totalEspn: espnMatches.length,
    matched,
    unmatched: unmatched.length,
    bridge,
    reverseBridge, // fifaId → espnId reverse lookup
  };

  const BRIDGE_PATH = writeJsonAtomic('match_id_bridge.json', output);
  console.log(`✅ Written: ${BRIDGE_PATH}`);
  console.log(`   Matched: ${matched}/${fifaMatches.length}`);

    // 5. write report
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

    // coverage (for matches where lineups already exist)
  try {
    const lineups = loadJSON(resolveDataPath('lineups.json'));
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
  } catch { /* lineups.json does not exist */ }

  const report = reportLines.join('\n');
  const REPORT_PATH = writeTextAtomic('match_id_bridge_report.txt', report);
  console.log(`📝 Report written: ${REPORT_PATH}`);

    // 6. summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Match ID Bridge build complete');
  console.log(`   FIFA matches: ${fifaMatches.length}`);
  console.log(`   ESPN matches: ${espnMatches.length}`);
  console.log(`   Matched: ${matched}`);
  console.log(`   Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n⚠️  Unmatched details:');
    unmatched.slice(0, 5).forEach(u => {
      console.log(`   - FIFA ${u.fifaId}: ${u.home || '?'} vs ${u.away || '?'} (${u.date || '?'})`);
    });
    if (unmatched.length > 5) console.log(`   ... and ${unmatched.length - 5} more`);
  }
}

main();
