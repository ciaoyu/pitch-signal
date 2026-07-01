#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const slots = JSON.parse(fs.readFileSync(path.join(root, 'data/bracket_slot_map.json'), 'utf8')).matches || {};
const scheduleDoc = JSON.parse(fs.readFileSync(path.join(root, 'data/match_snapshot_schedule.json'), 'utf8'));
const schedule = scheduleDoc.matches || [];
const scheduleById = new Map(schedule.map(match => [String(match.matchId || match.id), match]));
const missing = [];

for (const [slot, entry] of Object.entries(slots)) {
  const id = String(entry.espnMatchId || '');
  if (!id || !scheduleById.has(id)) missing.push({ slot, matchId: id || null });
}

console.log(JSON.stringify({
  slots: Object.keys(slots).length,
  scheduleMatches: schedule.length,
  matched: Object.keys(slots).length - missing.length,
  missing,
}, null, 2));
if (missing.length) process.exit(1);
