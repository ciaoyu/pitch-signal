const fs = require('fs');
const path = require('path');
const { derivePlayerRating } = require('../lib/fuzzy-match');
const { resolveDataPath, writeJsonAtomic } = require('../lib/data-resolver');

const squadsFile = resolveDataPath('squads.json');
const idBridgeFile = resolveDataPath('id_bridge.json');

const squads = JSON.parse(fs.readFileSync(squadsFile, 'utf8'));
const id_bridge = JSON.parse(fs.readFileSync(idBridgeFile, 'utf8'));

const eliteClubs = new Set([
  'Real Madrid', 'Manchester City', 'Barcelona', 'Bayern Munich', 'Arsenal',
  'Liverpool', 'Paris Saint-Germain', 'Inter Milan', 'Juventus', 'Bayer Leverkusen',
  'Atletico Madrid'
]);
const top5Leagues = new Set(['ENG', 'ESP', 'ITA', 'GER', 'FRA']);

function getClubTier(clubName, clubNat) {
  if (eliteClubs.has(clubName)) return 1;
  if (top5Leagues.has(clubNat)) return 2;
  return 3;
}

const outData = { data: {} };

for (const [code, squad] of Object.entries(squads)) {
  const bridge = id_bridge[code] || {};
  
  const nameOfficial = bridge.name_official || (squad.wiki && squad.wiki.title ? squad.wiki.title.replace(' national football team', '') : code);
  const espnId = bridge.espn_id || ('Est_' + code);

  const playersObj = {};
  if (squad.players) {
    squad.players.forEach(p => {
      const tier = getClubTier(p.club, p.clubNat);
      const rating = derivePlayerRating(p.caps, p.wcApps || 0, tier);
      playersObj[p.id] = {
        name: p.name,
        pos: p.pos,
        jersey: p.no,
        rating: rating
      };
    });
  }

  const teamObj = {
    formation: '4-3-3', // Default formation, overriden during matchup
    players: playersObj,
    name: nameOfficial,
    espnId: espnId
  };

  outData.data[espnId] = teamObj;
  outData.data[nameOfficial] = teamObj;
  outData.data[code] = teamObj;
}

const outFile = writeJsonAtomic('player-ratings.json', outData);
console.log(`Wrote player ratings with fallback to ${outFile}`);
