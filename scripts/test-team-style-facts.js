#!/usr/bin/env node
'use strict';
const assert = require('assert');
const facts = require('../data/wc2026/team_style_facts.json');
assert.strictEqual(facts.season, '2026');
assert.strictEqual(Object.keys(facts.teams).length, 48, 'all 48 World Cup teams have a fact record');
assert(facts.teams.ESP.sampleMatches >= 3, 'Spain has enough finished matches for descriptive facts');
assert(facts.teams.ESP.sources.fifa.length >= 3, 'Spain fact record keeps FIFA source URLs');
assert.strictEqual(facts.teams.ESP.facts.unsupported.pressing.status, 'not_covered', 'pressing is not guessed');
assert.strictEqual(facts.teams.ESP.coverage.qualifiesForRule, false, 'descriptive facts do not qualify for matchup rules by default');
assert(facts.teams.ESP.fieldEvidence.possession.sourceUrls.length >= 3, 'possession fallback keeps per-field source URLs');
assert(facts.teams.ESP.tagEvidence.every(tag => tag.season && tag.sampleMatches >= 3 && tag.calculationRule && tag.sourceUrls.length && tag.retrievedAt), 'every final tag carries audit metadata');
assert.strictEqual(facts.teams.ESP.coverage.oosValidation.status, 'not_run', 'style tags remain outside OOS-validated model scope');
console.log('✅ team-style fact coverage regression passed');
