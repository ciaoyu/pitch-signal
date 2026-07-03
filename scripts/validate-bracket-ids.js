#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildResolvedBracket } = require('../lib/bracket-updater');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const JSON_OUTPUT = process.argv.includes('--json');

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
}

function expectedRound(slotId) {
  if (slotId.startsWith('R32-')) return 'round of 32';
  if (slotId.startsWith('R16-')) return 'round of 16';
  if (slotId.startsWith('QF-')) return 'quarterfinal';
  if (slotId.startsWith('SF-')) return 'semifinal';
  if (slotId === 'FINAL') return 'final';
  if (slotId === '3RD-PLACE') return 'third-place';
  return null;
}

function scheduleRound(match) {
  const text = `${match.name || ''} ${match.shortName || ''}`.toLowerCase();
  if (text.includes('semifinal') && text.includes('loser')) return 'third-place';
  if (text.includes('semifinal') && !text.includes('winner at')) return 'semifinal';
  if (text.includes('semifinal') && text.includes('winner at')) return 'final';
  if (text.includes('quarterfinal') && !text.includes('winner at')) return 'quarterfinal';
  if (text.includes('quarterfinal') && text.includes('winner at')) return 'semifinal';
  if (text.includes('round of 16') && !text.includes('winner at')) return 'round of 16';
  if (text.includes('round of 16') && text.includes('winner at')) return 'quarterfinal';
  // Any mention of "round of 32" in a fixture name is a forward-reference to an R32 winner
  // (e.g. "Spain at Round of 32 11 Winner" once one side has already qualified, or
  // "Round of 32 16 Winner at Round of 32 14 Winner" while both sides are still open) —
  // an actual round-of-32 match never describes itself this way, it just uses real team names.
  if (text.includes('round of 32')) return 'round of 16';
  if (/\b(group [a-l] (winner|2nd place)|third place group)\b/.test(text)) return 'round of 32';
  return null;
}

function validate() {
  const bracket = readJson('bracket_2026.json');
  const schedule = readJson('match_snapshot_schedule.json');
  const resolved = buildResolvedBracket({
    bracket,
    schedule,
    posMap: {},
    posMapI18n: {},
    thirdPlaceData: {},
  });
  const scheduleById = new Map(
    (schedule.matches || []).map(match => [String(match.matchId || match.id), match])
  );
  const slots = {
    ...resolved.matches,
    ...(resolved.thirdPlaceMatch ? { '3RD-PLACE': resolved.thirdPlaceMatch } : {}),
  };
  const seen = new Map();
  const rows = [];

  for (const [slotId, slot] of Object.entries(slots)) {
    const matchId = String(slot.espnMatchId || slot.matchId || '');
    const scheduleMatch = scheduleById.get(matchId);
    const errors = [];
    const warnings = [];

    if (!matchId) errors.push('missing_match_id');
    else if (!scheduleMatch) errors.push('match_id_not_in_schedule');

    if (matchId) {
      if (seen.has(matchId)) errors.push(`duplicate_match_id:${seen.get(matchId)}`);
      else seen.set(matchId, slotId);
    }

    if (scheduleMatch) {
      if (scheduleMatch.stage !== 'knockout') errors.push(`wrong_stage:${scheduleMatch.stage || 'missing'}`);
      const expected = expectedRound(slotId);
      const actual = scheduleRound(scheduleMatch);
      if (actual && expected !== actual) errors.push(`round_mismatch:${expected}->${actual}`);
      if (!actual) warnings.push('round_not_inferable');
      if (slot.kickoff && scheduleMatch.kickoffUtc && slot.kickoff !== scheduleMatch.kickoffUtc) {
        errors.push('kickoff_mismatch');
      }
    }

    rows.push({
      slotId,
      matchId: matchId || null,
      expectedRound: expectedRound(slotId),
      scheduleRound: scheduleMatch ? scheduleRound(scheduleMatch) : null,
      scheduleName: scheduleMatch?.name || null,
      errors,
      warnings,
    });
  }

  const expectedSlots = Object.keys(bracket.matches || {}).length + 1;
  const missingSlots = expectedSlots - rows.length;
  if (missingSlots > 0) {
    rows.push({
      slotId: '__bracket__',
      matchId: null,
      expectedRound: null,
      scheduleRound: null,
      scheduleName: null,
      errors: [`missing_slots:${missingSlots}`],
      warnings: [],
    });
  }

  const failures = rows.filter(row => row.errors.length);
  return {
    generatedAt: new Date().toISOString(),
    bracketSlots: expectedSlots,
    scheduleMatches: schedule.matches?.length || 0,
    checked: rows.filter(row => row.slotId !== '__bracket__').length,
    matched: rows.filter(row => row.matchId && !row.errors.length).length,
    failures: failures.length,
    warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0),
    rows,
  };
}

function printText(report) {
  for (const row of report.rows) {
    const status = row.errors.length ? 'FAIL' : 'OK';
    const detail = [...row.errors, ...row.warnings].join(',') || row.scheduleName || '-';
    console.log(`${status.padEnd(4)} ${row.slotId.padEnd(11)} ${String(row.matchId || '-').padEnd(8)} ${detail}`);
  }
  console.log('\n=== bracket matchId validation ===');
  console.log(`checked: ${report.checked}/${report.bracketSlots}`);
  console.log(`matched: ${report.matched}`);
  console.log(`failures: ${report.failures}`);
  console.log(`warnings: ${report.warnings}`);
}

function main() {
  const report = validate();
  if (JSON_OUTPUT) console.log(JSON.stringify(report, null, 2));
  else printText(report);
  if (report.failures > 0) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { expectedRound, scheduleRound, validate };
