#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateVenueImpact, analyzeStyleFit } = require('../lib/venue-impact');

const ROOT = path.join(__dirname, '..');
const venues = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'venues.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'venue_meta.json'), 'utf8'));
const dallas = venues.find(venue => venue.name === 'AT&T Stadium');

assert(dallas, 'AT&T Stadium venue exists');
assert(dallas.grass.includes('混合增强天然草'), 'Dallas World Cup surface is hybrid-reinforced natural grass');
assert(!dallas.grass.includes('人工草皮'), 'Dallas World Cup surface is not labelled artificial turf');
assert.strictEqual(dallas.capacity, 70649, 'Dallas uses FIFA-confirmed tournament capacity');
assert(meta['3'].surfaceI18n.zh.includes('混合增强天然草'), 'venue metadata matches the tournament surface');

const facts = calculateVenueImpact(dallas, { temp: 35, humidity: 80, windSpeed: 25 });
assert.strictEqual(facts.quantified, false, 'venue card does not invent quantified attack/defence effects');
assert.strictEqual(facts.attack, null, 'venue attack adjustment is unavailable');
assert(!facts.details.join(' ').includes('适合快速反击'), 'unsupported counter-attack claim removed');
assert.strictEqual(analyzeStyleFit(dallas, null, '快速反击').fit, 'unassessed', 'tactical fit is explicitly unassessed');

console.log('✅ Venue facts integrity regression passed');
