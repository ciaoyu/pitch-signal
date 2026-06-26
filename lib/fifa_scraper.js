const fs = require('fs');
const path = require('path');
const https = require('https');

const MAPPINGS_FILE = path.join(__dirname, '../data/match_mappings.json');
const EVENTS_DIR = path.join(__dirname, '../data');

// Utility to fetch HTTP with timeout
function fetchUrl(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return resolve(null);
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => resolve(null));

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Fetch and extract substitutions.
 * Priority 1: ESPN summary -> keyEvents (if available)
 * Priority 2: ESPN playbyplay (if available)
 * Priority 3: FotMob (via mappings file)
 */
async function scrapeSubstitutionsAsync(espnMatchId) {
  const cacheFile = path.join(EVENTS_DIR, `events_${espnMatchId}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {}
  }

  let substitutions = [];

  // 1. Try ESPN Summary
  const summary = await fetchUrl(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnMatchId}`);
  if (summary && summary.keyEvents) {
    for (const ev of summary.keyEvents) {
      if (ev.type?.text === 'Substitution' && ev.participants?.length >= 2) {
        substitutions.push({
          minute: ev.clock?.displayValue || '',
          playerIn: ev.participants[0]?.athlete?.displayName || '',
          playerOut: ev.participants[1]?.athlete?.displayName || '',
          team: ev.team?.displayName || '',
          source: 'espn_summary'
        });
      }
    }
  }

  // 2. Try FotMob Fallback if ESPN is empty
  if (substitutions.length === 0) {
    let fotmobId = null;
    try {
      if (fs.existsSync(MAPPINGS_FILE)) {
        const mappings = JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
        if (mappings[espnMatchId] && mappings[espnMatchId].fotmob) {
          fotmobId = mappings[espnMatchId].fotmob;
        }
      }
    } catch (e) {}

    if (fotmobId) {
      const fotmobData = await fetchUrl(`https://www.fotmob.com/api/matchDetails?matchId=${fotmobId}`);
      if (fotmobData && fotmobData.content && fotmobData.content.matchFacts) {
        const events = fotmobData.content.matchFacts.events?.events || [];
        for (const ev of events) {
          if (ev.type === 'Substitution') {
            substitutions.push({
              minute: `${ev.time}'`,
              playerIn: ev.swap?.[0]?.name || ev.player?.name || '',
              playerOut: ev.swap?.[1]?.name || '',
              team: ev.isHome ? 'home' : 'away',
              source: 'fotmob'
            });
          }
        }
      }
    }
  }

  if (substitutions.length > 0) {
    fs.writeFileSync(cacheFile, JSON.stringify({ matchId: espnMatchId, substitutions, scrapedAt: new Date().toISOString() }, null, 2));
    return { substitutions };
  }

  return { substitutions: [] };
}

module.exports = { scrapeSubstitutionsAsync };
