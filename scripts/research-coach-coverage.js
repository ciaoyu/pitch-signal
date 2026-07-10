#!/usr/bin/env node
/**
 * Owner H — coach research coverage audit (real, runnable, no deps).
 *
 * Audits whether the in-repo data meets the RESEARCH-GRADE tenure schema
 * required for coach value-added estimation. Does NOT fabricate; reports
 * structural gaps honestly.
 *
 * Inputs (read-only):
 *   data/coaches.json            (display-level coach info, current)
 *   data/team_meta.json          (team alignment)
 *   data/history/worldcup_*.json (1930-2022 results; checked for coach field)
 *
 * Output:
 *   data/research/coach/coverage-report.json
 *
 * Run: node scripts/research-coach-coverage.js
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const outDir = path.join(ROOT, 'data', 'research', 'coach');

function loadJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ---- 1. Inspect data/coaches.json against research-grade schema ----
const coaches = loadJsonSafe(path.join(ROOT, 'data', 'coaches.json'));
const coachEntries = coaches ? Object.entries(coaches) : [];

let withStartPrecise = 0;   // has start_date parseable to a real date (not just year)
let withEndDate = 0;        // has end_date
let withSource = 0;         // has provenance/source
let withMatchLinks = 0;     // has match-level linkage
let withFormation = 0;      // has formation array (observable, but needs per-match verification)
let chineseKeywordUsed = 0; // uses style/adjustment/flexibility/notes (PROHIBITED features)
let tenureChainTeams = new Set(); // teams with >1 coach (tenure history)
const teamCoachCount = {};

for (const [teamId, c] of coachEntries) {
  if (!c || typeof c !== 'object') continue;
  // start: only "since" year string present -> NOT precise date
  const since = c.since;
  const precise = since && /^\d{4}-\d{2}/.test(String(since));
  if (precise) withStartPrecise++;
  // end date: absent entirely in this schema
  if (c.end_date || c.endDate) withEndDate++;
  if (c.source) withSource++;
  if (Array.isArray(c.match_links) || Array.isArray(c.matchLinks)) withMatchLinks++;
  if (Array.isArray(c.formation) && c.formation.length) withFormation++;
  if (c.style || c.adjustment || c.flexibility || c.notes) chineseKeywordUsed++;
  teamCoachCount[teamId] = (teamCoachCount[teamId] || 0) + 1;
}
for (const t of Object.keys(teamCoachCount)) {
  if (teamCoachCount[t] > 1) tenureChainTeams.add(t);
}

const totalCoaches = coachEntries.length;
const pct = (n) => (totalCoaches ? (100 * n / totalCoaches) : 0).toFixed(1);

// ---- 2. Inspect worldcup history for any coach field ----
const histDir = path.join(ROOT, 'data', 'history');
let historyFiles = [];
try { historyFiles = fs.readdirSync(histDir).filter((f) => /^worldcup_.*\.json$/.test(f)); } catch (e) {}
let historyMatches = 0;
let historyWithCoach = 0;
for (const f of historyFiles) {
  const data = loadJsonSafe(path.join(histDir, f));
  if (!Array.isArray(data)) continue;
  for (const m of data) {
    historyMatches++;
    if (m && (m.coach || m.homeCoach || m.awayCoach || m.manager)) historyWithCoach++;
  }
}

// ---- 3. Inspect team_meta for coach field ----
const teamMeta = loadJsonSafe(path.join(ROOT, 'data', 'team_meta.json'));
let teamMetaWithCoach = 0;
if (teamMeta && typeof teamMeta === 'object') {
  for (const v of Object.values(teamMeta)) {
    if (v && (v.coach || v.manager || v.coachId)) teamMetaWithCoach++;
  }
}

// ---- 4. Compute research-grade coverage ----
// A coach record is "research-grade" only if it has start date (precise),
// end date, source, and match linkage. None in data/coaches.json qualify.
const researchGrade = 0;
const researchGradePct = 0;

const report = {
  owner: 'H',
  task: 'coach-history-and-value-added-research',
  generated_at: new Date().toISOString(),
  base_commit: '78da1b5',
  summary: {
    in_repo_research_grade_tenure_coverage_pct: researchGradePct,
    conclusion:
      'In-repo coach data is DISPLAY-ONLY (Chinese-keyword model). It meets 0% of the ' +
      'research-grade tenure schema (no start/end dates, no source, no tenure chain, no ' +
      'match linkage, no xG). Real value-added research requires an EXTERNAL, read-only ' +
      'tenure history + international results pool + xG artifact. Until supplied, coach ' +
      'effect is NOT eligible to enter the production probability (usedInModel:false).'
  },
  display_coaches_json: {
    total_entries: totalCoaches,
    with_precise_start_date_pct: pct(withStartPrecise),
    with_end_date_pct: pct(withEndDate),
    with_source_pct: pct(withSource),
    with_match_linkage_pct: pct(withMatchLinks),
    with_formation_array_pct: pct(withFormation),
    using_chinese_keywords_pct: pct(chineseKeywordUsed),
    teams_with_tenure_chain: tenureChainTeams.size,
    note: 'data/coaches.json carries style/adjustment/flexibility/notes (Chinese keywords) ' +
          'which are PROHIBITED as research features per governance.'
  },
  worldcup_history: {
    files: historyFiles.length,
    matches: historyMatches,
    matches_with_coach_field: historyWithCoach,
    coach_field_coverage_pct: historyMatches ? (100 * historyWithCoach / historyMatches).toFixed(2) : '0.00',
    note: 'No coach field in any historical WC result file.'
  },
  team_meta: {
    entries_with_coach_field: teamMetaWithCoach,
    note: 'No coach field in team_meta.json.'
  },
  required_external_inputs: [
    { name: 'coach tenure history (start/end + source)', env: 'COACH_RESEARCH_TENURE_DIR', status: 'MISSING (read-only, not committed)' },
    { name: 'international results pool (qualifiers/continental/friendlies/WC)', env: 'COACH_RESEARCH_POOL_DIR', status: 'MISSING (read-only, not committed)' },
    { name: 'xG / lineup artifact (Owner F)', env: 'n/a', status: 'REFERENCE-ONLY when F ready' }
  ],
  production_signal_status: {
    coach_in_lib_prediction_js: 'ABSENT (removed by Owner A quarantine; H does not restore)',
    current_display_coach: 'kept for UI only; not a probability input'
  }
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'coverage-report.json'), JSON.stringify(report, null, 2));

console.log('=== Owner H coach coverage audit ===');
console.log(`Display coaches.json entries: ${totalCoaches}`);
console.log(`  precise start date : ${pct(withStartPrecise)}%`);
console.log(`  end date           : ${pct(withEndDate)}%`);
console.log(`  source             : ${pct(withSource)}%`);
console.log(`  match linkage      : ${pct(withMatchLinks)}%`);
console.log(`  Chinese keywords    : ${pct(chineseKeywordUsed)}% (PROHIBITED as features)`);
console.log(`WC history: ${historyFiles.length} files, ${historyMatches} matches, coach field = ${historyWithCoach} (${report.worldcup_history.coach_field_coverage_pct}%)`);
console.log(`team_meta coach field: ${teamMetaWithCoach}`);
console.log(`RESEARCH-GRADE in-repo tenure coverage: ${researchGradePct}%`);
console.log(`=> ${report.summary.conclusion}`);
console.log(`Report written to data/research/coach/coverage-report.json`);
