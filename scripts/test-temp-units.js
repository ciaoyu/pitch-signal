#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = new Map();
const context = {
  window: { WorldCup: { State: { uiLang: 'en' }, Utils: {}, ApiClient: {} } },
  localStorage: {
    getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  },
  document: { querySelectorAll: () => [] },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/js/utils.js'), 'utf8'), context);
const u = context.window.WorldCup.Utils;

assert.strictEqual(Math.round(u.normalizeCelsius(86)), 30);
assert.strictEqual(Math.round(u.normalizeCelsius(30)), 30);
assert.strictEqual(u.formatTemperature(30, 'C', 'F'), '86°F');
assert.strictEqual(u.formatTemperature(86, 'F', 'C'), '30°C');
u.setWeatherUnit('F');
assert.strictEqual(u.getWeatherUnit(), 'F');
console.log('5 passed, 0 failed');
