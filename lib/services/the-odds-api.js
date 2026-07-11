/**
 * The Odds API integration — https://the-odds-api.com
 * Fetches h2h (win/draw/loss) decimal odds for FIFA World Cup matches.
 * Env var: THE_ODDS_API_KEY
 */
const https = require('https');

const BASE_URL = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = 'soccer_fifa_world_cup';

// Map common The Odds API team name variants → our ratings.json keys
const NAME_ALIASES = {
  'USA': 'United States',
  'US': 'United States',
  'United States of America': 'United States',
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  'IR Iran': 'Iran',
  'Cote d\'Ivoire': 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  'DRC': 'Congo DR',
  'DR Congo': 'Congo DR',
  'Bosnia & Herzegovina': 'Bosnia',
  'Bosnia and Herzegovina': 'Bosnia',
  'Czechia': 'Czech Republic',
  'Trinidad & Tobago': 'Trinidad and Tobago',
  'Cape Verde': 'Cape Verde Islands',
};

function normalize(name) {
  if (!name) return '';
  return (NAME_ALIASES[name] || name).toLowerCase().trim();
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error('parse error: ' + data.slice(0, 100)));
        }
      });
    }).on('error', reject);
  });
}

// Last known account quota, read from the-odds-api's own response headers
// (authoritative — unlike a locally-counted budget, this survives restarts and
// separate process invocations because it reflects the provider's real state).
let lastQuota = null;
function captureQuota(headers) {
  if (!headers) return;
  const remaining = headers['x-requests-remaining'];
  const used = headers['x-requests-used'];
  if (remaining === undefined && used === undefined) return;
  lastQuota = {
    remaining: remaining !== undefined ? Number(remaining) : null,
    used: used !== undefined ? Number(used) : null,
    checkedAt: new Date().toISOString(),
  };
}
function getQuotaSnapshot() {
  return lastQuota;
}
// Hard safety margin: refuse to spend the account's last few credits automatically.
const MIN_QUOTA_REMAINING = 5;
function quotaExhausted() {
  return Boolean(lastQuota && Number.isFinite(lastQuota.remaining) && lastQuota.remaining <= MIN_QUOTA_REMAINING);
}

/**
 * Fetch World Cup h2h odds and find the match for the given home/away team names.
 * Single region + single market by design: this call costs regions × markets
 * credits regardless of how many events come back, and h2h is the only market
 * any caller reads, so requesting more than 1×1 only burns quota for nothing.
 * @param {string} homeTeamName - English team name (ratings.json key)
 * @param {string} awayTeamName - English team name
 * @param {string} apiKey
 * @returns {{ homeWin, draw, awayWin, source, vendor, updatedAt } | null}
 */
async function fetchMatchOdds(homeTeamName, awayTeamName, apiKey) {
  if (quotaExhausted()) {
    throw new Error(`the-odds-api quota near exhaustion (${lastQuota.remaining} left) — refusing further calls`);
  }
  const url = `${BASE_URL}/sports/${SPORT_KEY}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const { status, headers, body } = await fetchJSON(url);
  captureQuota(headers);

  if (status === 401) throw new Error('THE_ODDS_API_KEY invalid or quota exceeded');
  if (status === 422) throw new Error('Sport not found or out of season');
  if (status !== 200 || !Array.isArray(body)) return null;

  const homeNorm = normalize(homeTeamName);
  const awayNorm = normalize(awayTeamName);

  const event = body.find(ev => {
    const h = normalize(ev.home_team);
    const a = normalize(ev.away_team);
    return (h === homeNorm && a === awayNorm) || (h === awayNorm && a === homeNorm);
  });
  if (!event) return null;

  // Prefer DraftKings, then FanDuel, then first available bookmaker
  const bm = event.bookmakers?.find(b => b.key === 'draftkings')
    || event.bookmakers?.find(b => b.key === 'fanduel')
    || event.bookmakers?.[0];
  if (!bm) return null;

  const market = bm.markets?.find(m => m.key === 'h2h');
  if (!market?.outcomes?.length) return null;

  // Detect if home/away are swapped in this event
  const flipped = normalize(event.home_team) === awayNorm;

  const find = (name) => market.outcomes.find(o => normalize(o.name) === normalize(name));
  const homeOutcome = find(flipped ? awayTeamName : homeTeamName)
    || market.outcomes.find(o => normalize(o.name) === homeNorm);
  const awayOutcome = find(flipped ? homeTeamName : awayTeamName)
    || market.outcomes.find(o => normalize(o.name) === awayNorm);
  const drawOutcome = market.outcomes.find(o => o.name === 'Draw');

  if (!homeOutcome || !awayOutcome) return null;

  return {
    homeWin: String(homeOutcome.price),
    draw: drawOutcome ? String(drawOutcome.price) : null,
    awayWin: String(awayOutcome.price),
    source: `the-odds-api/${bm.key}`,
    vendor: bm.key,
    updatedAt: bm.last_update,
  };
}

module.exports = { fetchMatchOdds, getQuotaSnapshot };
