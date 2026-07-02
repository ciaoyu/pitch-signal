#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const venueFactors = require('../lib/venueFactors');

const ROOT = path.join(__dirname, '..');
const SCHEDULE_FILE = path.join(ROOT, 'data', 'match_snapshot_schedule.json');
const JSON_OUTPUT = process.argv.includes('--json');

function isPlaceholder(value) {
  return !value
    || /^\d[A-L]$/i.test(value)
    || /^3RD$/i.test(value)
    || /^(TBD|RD|R\d|QF|QW|SF|[WLP]\s)/i.test(value);
}

function unique(values) {
  return [...new Set(values)];
}

function diagnoseMatch(match) {
  const matchId = String(match.matchId || match.id || '');
  const home = match.teams?.home?.abbreviation || match.teams?.home?.name;
  const away = match.teams?.away?.abbreviation || match.teams?.away?.name;
  const result = venueFactors.computeForMatch(matchId, home, away);
  const reasons = [];
  const warnings = [];

  if (!matchId) reasons.push('missing_match_id');
  if (!result.home.venueId || !result.away.venueId) reasons.push('venue_unmatched');
  if (!result.home.teamCode) {
    (isPlaceholder(home) ? warnings : reasons).push(
      isPlaceholder(home) ? 'home_team_not_yet_determined' : 'home_team_unmatched'
    );
  }
  if (!result.away.teamCode) {
    (isPlaceholder(away) ? warnings : reasons).push(
      isPlaceholder(away) ? 'away_team_not_yet_determined' : 'away_team_unmatched'
    );
  }

  for (const [side, factor] of [['home', result.home], ['away', result.away]]) {
    if (factor.teamCode && factor.baseCampAltM == null) warnings.push(`${side}_altitude_missing`);
    if (factor.tempC == null) warnings.push(`${side}_temperature_missing`);
  }

  let status = 'no_effect';
  if (reasons.length) status = 'mismatch';
  else if (warnings.length) status = 'unverifiable';
  else if (result.home.applied || result.away.applied) status = 'applied';

  return {
    matchId,
    stage: match.stage || null,
    kickoffUtc: match.kickoffUtc || null,
    venue: match.venue || null,
    teams: { home: home || null, away: away || null },
    status,
    applied: result.home.applied || result.away.applied,
    reasons: unique(reasons),
    warnings: unique(warnings),
    factors: {
      home: result.home,
      away: result.away,
    },
    lambdaExample: {
      before: { home: 1, away: 1 },
      after: { home: result.home.beta, away: result.away.beta },
    },
  };
}

function buildReport(schedule) {
  const matches = (schedule.matches || []).map(diagnoseMatch);
  const counts = matches.reduce((acc, match) => {
    acc[match.status] = (acc[match.status] || 0) + 1;
    return acc;
  }, { applied: 0, no_effect: 0, unverifiable: 0, mismatch: 0 });

  return {
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, SCHEDULE_FILE),
    total: matches.length,
    counts,
    coverage: matches.length ? Number(((counts.applied + counts.no_effect) / matches.length).toFixed(4)) : 0,
    matches,
  };
}

function printText(report) {
  console.log('matchId  status        venue                         home  away  beta(home/away)  reason');
  for (const match of report.matches) {
    const reason = [...match.reasons, ...match.warnings].join(',') || '-';
    console.log([
      match.matchId.padEnd(8),
      match.status.padEnd(13),
      String(match.venue || '-').slice(0, 29).padEnd(29),
      String(match.teams.home || '-').padEnd(5),
      String(match.teams.away || '-').padEnd(5),
      `${match.factors.home.beta.toFixed(4)}/${match.factors.away.beta.toFixed(4)}`.padEnd(16),
      reason,
    ].join(' '));
  }

  console.log('\n=== venueFactor diagnosis ===');
  console.log(`matches: ${report.total}`);
  console.log(`applied: ${report.counts.applied}`);
  console.log(`mapped_no_effect: ${report.counts.no_effect}`);
  console.log(`unverifiable: ${report.counts.unverifiable}`);
  console.log(`mismatched: ${report.counts.mismatch}`);
  console.log(`verifiable_coverage: ${(report.coverage * 100).toFixed(1)}%`);

  const evidence = report.matches.find(match => match.status === 'applied');
  if (evidence) {
    console.log(
      `lambda evidence: ${evidence.matchId} 1.0000/1.0000 -> `
      + `${evidence.lambdaExample.after.home.toFixed(4)}/${evidence.lambdaExample.after.away.toFixed(4)}`
    );
  }
}

function main() {
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  const report = buildReport(schedule);
  if (JSON_OUTPUT) console.log(JSON.stringify(report, null, 2));
  else printText(report);
  if (report.counts.mismatch > 0) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { buildReport, diagnoseMatch, isPlaceholder };
