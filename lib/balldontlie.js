/**
 * BALLDONTLIE FIFA World Cup API integration
 * Documentation: https://fifa.balldontlie.io
 * Coverage: 2018/2022/2026 World Cups
 */
const https = require('https');

const BASE_URL = 'https://api.balldontlie.io/fifa/worldcup/v1';

class BallDontLieAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.cache = new Map();
  }

  async fetch(endpoint, params = {}) {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 300000) return cached.data; // 5 min cache

    const query = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${endpoint}${query ? '?' + query : ''}`;

    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { 'Authorization': this.apiKey }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode === 200) {
              this.cache.set(cacheKey, { data: json, ts: Date.now() });
              resolve(json);
            } else if (res.statusCode === 429) {
              resolve({ error: 'rate_limited', retry_after: res.headers['retry-after'] });
            } else {
              resolve({ error: json.error || 'unknown', status: res.statusCode });
            }
          } catch (e) {
            resolve({ error: 'parse_error', message: e.message });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // ========== Teams ==========
  async getTeams() {
    const result = await this.fetch('/teams');
    return result.data || [];
  }

  async getTeam(teamId) {
    const teams = await this.getTeams();
    return teams.find(t => t.id === teamId) || null;
  }

  // ========== Matches ==========
  async getMatches(season = 2026, options = {}) {
    const params = { 'seasons[]': season, per_page: options.per_page || 100, ...options };
    const result = await this.fetch('/matches', params);
    return result.data || [];
  }

  async getMatch(matchId) {
    const params = { 'match_ids[]': matchId };
    const result = await this.fetch('/matches', params);
    return result.data?.[0] || null;
  }

  // ========== Odds ==========
  async getOdds(season = 2026, options = {}) {
    const params = { 'seasons[]': season, per_page: options.per_page || 100 };
    const result = await this.fetch('/odds', params);
    return result.data || [];
  }

  async getMatchOdds(matchId) {
    const params = { 'match_ids[]': matchId };
    const result = await this.fetch('/odds', params);
    return result.data || [];
  }

  // ========== Standings ==========
  async getStandings(season = 2026) {
    const params = { 'seasons[]': season };
    const result = await this.fetch('/standings', params);
    return result.data || [];
  }

  // ========== Players ==========
  async getPlayers(options = {}) {
    const result = await this.fetch('/players', options);
    return result.data || [];
  }

  // ========== Roster ==========
  async getRoster(teamId, season = 2026) {
    const params = { team_id: teamId, 'seasons[]': season };
    const result = await this.fetch('/roster', params);
    return result.data || [];
  }

  // ========== Convert odds format to Dashboard format ==========
  convertOdds(balldontlieOdds) {
    if (!balldontlieOdds || !balldontlieOdds.length) return null;

    // Take DraftKings or first available odds
    const odds = balldontlieOdds.find(o => o.vendor === 'draftkings') || balldontlieOdds[0];
    if (!odds) return null;

    // Convert American odds to decimal odds
    const americanToDecimal = (american) => {
      if (!american || american === 0) return null;
      return american > 0 ? (american / 100 + 1).toFixed(2) : (100 / Math.abs(american) + 1).toFixed(2);
    };

    return {
      homeWin: americanToDecimal(odds.moneyline_home_odds),
      draw: americanToDecimal(odds.moneyline_draw_odds),
      awayWin: americanToDecimal(odds.moneyline_away_odds),
      overUnder: {
        line: odds.total_value,
        over: americanToDecimal(odds.total_over_odds),
        under: americanToDecimal(odds.total_under_odds),
      },
      asianHandicap: {
        line: odds.spread_home_value,
        home: americanToDecimal(odds.spread_home_odds),
        away: americanToDecimal(odds.spread_away_odds),
      },
      source: `balldontlie/${odds.vendor}`,
      vendor: odds.vendor,
      updatedAt: odds.updated_at,
    };
  }
}

module.exports = BallDontLieAPI;
