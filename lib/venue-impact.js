'use strict';

// The previous implementation converted surface/weather labels into invented
// attack, defence and tactical-fit percentages. No calibrated model supports
// those coefficients, so this module now returns facts without causal scores.

function surfaceFact(grass = '') {
  if (grass.includes('混合')) return '世界杯比赛采用混合增强天然草坪';
  if (grass.includes('天然')) return '比赛场地采用天然草坪';
  if (grass.includes('人工')) return '场地资料标记为人工草坪，需核对具体赛事铺设方案';
  return '草坪类型暂无可信资料';
}

function calculateVenueImpact(venue = {}) {
  return {
    quantified: false,
    overall: null,
    attack: null,
    defense: null,
    possession: null,
    physical: null,
    details: [surfaceFact(venue.grass || '')],
    status: 'facts_only',
    disclaimerI18n: {
      zh: '仅展示场地事实；没有经过验证的场地攻防加成。',
      en: 'Venue facts only; no validated attack or defence adjustment is applied.',
    },
  };
}

function unvalidatedFactor() {
  return { assessed: false, attack: null, defense: null, possession: null, physical: null };
}

function analyzeGrassImpact() { return unvalidatedFactor(); }
function analyzeAltitudeImpact() { return unvalidatedFactor(); }
function analyzeTemperatureImpact() { return unvalidatedFactor(); }
function analyzeHumidityImpact() { return unvalidatedFactor(); }
function analyzeWindImpact() { return unvalidatedFactor(); }

function analyzeStyleFit() {
  return {
    fit: 'unassessed',
    assessed: false,
    reasonI18n: {
      zh: '暂无经过验证的场地—战术适配模型',
      en: 'No validated venue-to-tactics fit model is available',
    },
  };
}

module.exports = {
  calculateVenueImpact,
  analyzeGrassImpact,
  analyzeAltitudeImpact,
  analyzeTemperatureImpact,
  analyzeHumidityImpact,
  analyzeWindImpact,
  analyzeStyleFit,
};
