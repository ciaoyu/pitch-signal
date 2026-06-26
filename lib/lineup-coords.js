// ========== Lineup Coordinates ==========
// Extracted from server.js (2026-06-26 refactor)
// Pure data + pure function — zero external dependencies

// Position matchup mapping (who marks whom)
const POS_MATCHUP = {
  'GK':'GK','CB':'ST','LB':'RW','RB':'LW',
  'CM':'CM','CDM':'CAM','CAM':'CDM',
  'LW':'RB','RW':'LB','ST':'CB',
  'LWB':'RWB','RWB':'LWB','LM':'RM','RM':'LM',
};

// Formation coordinates
const FORM_COORDS = {
  '4-3-3': [{pos:'GK',x:50,y:8},{pos:'LB',x:18,y:22},{pos:'CB',x:38,y:20},{pos:'CB',x:62,y:20},{pos:'RB',x:82,y:22},{pos:'CM',x:25,y:38},{pos:'CM',x:50,y:35},{pos:'CM',x:75,y:38},{pos:'LW',x:20,y:48},{pos:'ST',x:50,y:46},{pos:'RW',x:80,y:48}],
  '4-4-2': [{pos:'GK',x:50,y:8},{pos:'LB',x:18,y:22},{pos:'CB',x:38,y:20},{pos:'CB',x:62,y:20},{pos:'RB',x:82,y:22},{pos:'LM',x:18,y:38},{pos:'CM',x:38,y:36},{pos:'CM',x:62,y:36},{pos:'RM',x:82,y:38},{pos:'ST',x:35,y:47},{pos:'ST',x:65,y:47}],
  '3-5-2': [{pos:'GK',x:50,y:8},{pos:'CB',x:25,y:20},{pos:'CB',x:50,y:18},{pos:'CB',x:75,y:20},{pos:'LWB',x:10,y:35},{pos:'CM',x:35,y:33},{pos:'CM',x:50,y:30},{pos:'CM',x:65,y:33},{pos:'RWB',x:90,y:35},{pos:'ST',x:35,y:47},{pos:'ST',x:65,y:47}],
  '3-4-2-1': [{pos:'GK',x:50,y:8},{pos:'CB',x:25,y:20},{pos:'CB',x:50,y:18},{pos:'CB',x:75,y:20},{pos:'LWB',x:12,y:35},{pos:'CM',x:38,y:33},{pos:'CM',x:62,y:33},{pos:'RWB',x:88,y:35},{pos:'CAM',x:35,y:44},{pos:'CAM',x:65,y:44},{pos:'ST',x:50,y:48}],
  '4-1-2-3': [{pos:'GK',x:50,y:8},{pos:'LB',x:18,y:22},{pos:'CB',x:38,y:20},{pos:'CB',x:62,y:20},{pos:'RB',x:82,y:22},{pos:'CDM',x:50,y:32},{pos:'CM',x:32,y:40},{pos:'CM',x:68,y:40},{pos:'RW',x:20,y:48},{pos:'ST',x:50,y:46},{pos:'LW',x:80,y:48}],
};

const POS_COORD_ALIASES = {
  GK: ['GK'],
  RB: ['RB', 'RWB', 'CB'],
  RCB: ['CB', 'RB'],
  CB: ['CB'],
  LCB: ['CB', 'LB'],
  LB: ['LB', 'LWB', 'CB'],
  RWB: ['RWB', 'RB', 'RM'],
  LWB: ['LWB', 'LB', 'LM'],
  CDM: ['CDM', 'CM'],
  RCM: ['CM', 'RM', 'CDM'],
  LCM: ['CM', 'LM', 'CDM'],
  CM: ['CM', 'CDM', 'CAM'],
  CAM: ['CAM', 'CM'],
  RM: ['RM', 'RW', 'CM'],
  LM: ['LM', 'LW', 'CM'],
  RW: ['RW', 'RM', 'ST'],
  LW: ['LW', 'LM', 'ST'],
  ST: ['ST', 'CF', 'F'],
  CF: ['ST', 'CF', 'F'],
  F: ['ST', 'RW', 'LW'],
  M: ['CM', 'CDM', 'CAM', 'LM', 'RM'],
  D: ['CB', 'LB', 'RB'],
};

function assignLineupCoords(players, formation) {
  const template = (FORM_COORDS[formation] || FORM_COORDS['4-3-3']).map((coord, index) => ({ ...coord, index }));
  const usedPlayers = new Set();
  const assigned = [];

  for (const coord of template) {
    let index = players.findIndex((player, playerIndex) => !usedPlayers.has(playerIndex) && player.pos === coord.pos);
    if (index < 0) {
      index = players.findIndex((player, playerIndex) => {
        if (usedPlayers.has(playerIndex)) return false;
        const aliases = POS_COORD_ALIASES[player.pos] || [player.pos];
        return aliases.includes(coord.pos);
      });
    }
    if (index < 0) continue;
    usedPlayers.add(index);
    assigned.push({ ...players[index], coords: { pos: coord.pos, x: coord.x, y: coord.y } });
  }

  for (let i = 0; i < players.length; i++) {
    if (!usedPlayers.has(i)) assigned.push({ ...players[i], bench: true, coords: { x: 50, y: 50 } });
  }
  return assigned;
}

module.exports = { POS_MATCHUP, FORM_COORDS, POS_COORD_ALIASES, assignLineupCoords };
