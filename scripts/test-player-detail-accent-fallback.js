#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'player-detail.js'), 'utf8');

assert.match(source, /const normalizePlayerName = \(name\)/, 'shared player-name normalizer exists');
assert.match(source, /normalize\('NFD'\)/, 'normalizer decomposes Unicode accents');
assert.match(source, /replace\(\/\[\\u0300-\\u036f\]\/g, ''\)/, 'normalizer removes combining marks');
assert.match(source, /const targetName = normalizePlayerName\(inlineData\.name\)/, 'fallback target name is normalized');
assert.match(source, /const rosterName = normalizePlayerName\(x\.name\)/, 'fallback roster name is normalized');

const normalize = name => String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
assert.equal(normalize('Kylian Mbappe'), normalize('Kylian Mbappé'));
assert.equal(normalize('Julian Quinones'), normalize('Julián Quiñones'));

console.log('player detail accent fallback: all assertions passed');
