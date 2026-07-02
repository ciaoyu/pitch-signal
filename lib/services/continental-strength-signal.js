'use strict';

const DEFAULT_ADJUSTMENTS = Object.freeze({
  UEFA: 117,
  CONMEBOL: 104,
  AFC: 18,
  CONCACAF: -27,
  CAF: -40,
  OFC: -171,
});

const TEAM_CONFEDERATION = Object.freeze({
  Algeria: 'CAF',
  Angola: 'CAF',
  Argentina: 'CONMEBOL',
  Australia: 'AFC',
  Austria: 'UEFA',
  Belgium: 'UEFA',
  Bolivia: 'CONMEBOL',
  'Bosnia-Herzegovina': 'UEFA',
  'Bosnia and Herzegovina': 'UEFA',
  Brazil: 'CONMEBOL',
  Bulgaria: 'UEFA',
  Cameroon: 'CAF',
  Canada: 'CONCACAF',
  Chile: 'CONMEBOL',
  China: 'AFC',
  Colombia: 'CONMEBOL',
  'Costa Rica': 'CONCACAF',
  Croatia: 'UEFA',
  Cuba: 'CONCACAF',
  'Czech Republic': 'UEFA',
  Czechia: 'UEFA',
  Czechoslovakia: 'UEFA',
  "Côte d'Ivoire": 'CAF',
  'Ivory Coast': 'CAF',
  Denmark: 'UEFA',
  'Dutch East Indies': 'AFC',
  'East Germany': 'UEFA',
  Ecuador: 'CONMEBOL',
  Egypt: 'CAF',
  'El Salvador': 'CONCACAF',
  England: 'UEFA',
  France: 'UEFA',
  Germany: 'UEFA',
  Ghana: 'CAF',
  Greece: 'UEFA',
  Haiti: 'CONCACAF',
  Honduras: 'CONCACAF',
  Hungary: 'UEFA',
  Iceland: 'UEFA',
  Iran: 'AFC',
  Iraq: 'AFC',
  Ireland: 'UEFA',
  'Republic of Ireland': 'UEFA',
  Israel: 'UEFA',
  Italy: 'UEFA',
  Jamaica: 'CONCACAF',
  Japan: 'AFC',
  Kuwait: 'AFC',
  Mexico: 'CONCACAF',
  Morocco: 'CAF',
  Netherlands: 'UEFA',
  'New Zealand': 'OFC',
  Nigeria: 'CAF',
  'North Korea': 'AFC',
  'Northern Ireland': 'UEFA',
  Norway: 'UEFA',
  Panama: 'CONCACAF',
  Paraguay: 'CONMEBOL',
  Peru: 'CONMEBOL',
  Poland: 'UEFA',
  Portugal: 'UEFA',
  Qatar: 'AFC',
  Romania: 'UEFA',
  Russia: 'UEFA',
  'Saudi Arabia': 'AFC',
  Scotland: 'UEFA',
  Senegal: 'CAF',
  Serbia: 'UEFA',
  'Serbia and Montenegro': 'UEFA',
  Slovakia: 'UEFA',
  Slovenia: 'UEFA',
  'South Africa': 'CAF',
  'South Korea': 'AFC',
  'Soviet Union': 'UEFA',
  Spain: 'UEFA',
  Sweden: 'UEFA',
  Switzerland: 'UEFA',
  Togo: 'CAF',
  'Trinidad and Tobago': 'CONCACAF',
  Tunisia: 'CAF',
  Turkey: 'UEFA',
  Türkiye: 'UEFA',
  USA: 'CONCACAF',
  'United States': 'CONCACAF',
  Ukraine: 'UEFA',
  'United Arab Emirates': 'AFC',
  Uruguay: 'CONMEBOL',
  Wales: 'UEFA',
  'West Germany': 'UEFA',
  Yugoslavia: 'UEFA',
  Zaire: 'CAF',
  'DR Congo': 'CAF',
});

function confederationForTeam(team) {
  return TEAM_CONFEDERATION[team] || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function probsFromEloDelta(eloDelta) {
  const homeNoDraw = 1 / (1 + Math.pow(10, -eloDelta / 400));
  const draw = clamp(0.28 - Math.abs(eloDelta) / 2800, 0.18, 0.30);
  const decisive = 1 - draw;
  return {
    home: homeNoDraw * decisive,
    draw,
    away: (1 - homeNoDraw) * decisive,
  };
}

function buildSignal(homeTeam, awayTeam, options = {}) {
  const homeConfed = confederationForTeam(homeTeam);
  const awayConfed = confederationForTeam(awayTeam);
  if (!homeConfed || !awayConfed || homeConfed === awayConfed) return null;

  const adjustments = options.adjustments || DEFAULT_ADJUSTMENTS;
  const homeAdjustment = Number(adjustments[homeConfed] || 0);
  const awayAdjustment = Number(adjustments[awayConfed] || 0);
  const eloDelta = homeAdjustment - awayAdjustment;
  const probs = probsFromEloDelta(eloDelta);
  const confidence = clamp(0.52 + Math.abs(eloDelta) / 1200, 0.45, 0.72);

  return {
    home: Math.round(probs.home * 10000) / 10000,
    draw: Math.round(probs.draw * 10000) / 10000,
    away: Math.round(probs.away * 10000) / 10000,
    confidence: Math.round(confidence * 1000) / 1000,
    homeConfed,
    awayConfed,
    homeAdjustment,
    awayAdjustment,
    eloDelta,
    source: 'continental-strength/reference-elo-head',
  };
}

module.exports = {
  DEFAULT_ADJUSTMENTS,
  TEAM_CONFEDERATION,
  confederationForTeam,
  buildSignal,
};
