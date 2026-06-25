const fs = require('fs');

const data = fs.readFileSync('temp_routes.js', 'utf8');

// The file starts with `const routes = {` and ends with `};` or similar.
// We can parse the top-level keys.

let lines = data.split('\n');
let currentRoute = null;
let currentBlock = [];
let routesMap = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.match(/^  '(GET|POST) \/api\/[^']+': async/)) {
    if (currentRoute) {
      routesMap[currentRoute] = currentBlock.join('\n');
    }
    const match = line.match(/^  '((?:GET|POST) \/api\/[^']+)': async/);
    currentRoute = match[1];
    currentBlock = [line];
  } else if (currentRoute) {
    currentBlock.push(line);
  }
}

if (currentRoute) {
  // removing trailing `};` if any
  let lastLines = currentBlock.join('\n');
  if (lastLines.endsWith('};')) {
    lastLines = lastLines.slice(0, -2);
  }
  routesMap[currentRoute] = lastLines;
}

// Now write the files
const mkdir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
mkdir('lib/routes');

const createModuleContent = (name, routeKeys) => {
  let content = `module.exports = function create${name}Routes(deps) {\n`;
  content += `  const { espn, fetchJSON, parseEvent, getTeamNameZh, getTeamNameI18n, TEAM_LOGOS, COACHES, TEAM_NAMES_ZH, getCached, setCache, routes, rosterCache } = deps;\n`;
  content += `  const fs = require('fs');\n`;
  content += `  const path = require('path');\n`;
  content += `  const DATA_DIR = path.join(__dirname, '..', '..', 'data');\n`;
  content += `  const ODDS_API_KEY = process.env.ODDS_API_KEY || '';\n`;
  content += `  const PLAYER_RATINGS = { data: {} };\n`; // Placeholder for globals if needed
  content += `  const RATINGS = { teams: {} };\n`;
  content += `  const TEAM_NAMES = {};\n`;
  content += `\n  return {\n`;
  
  for (const key of routeKeys) {
    if (routesMap[key]) {
      content += routesMap[key] + '\n';
    }
  }
  
  // ensure the last entry has a trailing comma or close bracket correctly
  content += `  };\n};\n`;
  return content;
};

// Map routes to files
const fileMappings = {
  Odds: [
    'GET /api/odds/:matchId',
    'GET /api/odds-history/:matchId',
    'GET /api/odds-alerts',
    'GET /api/odds-alerts-enhanced'
  ],
  Standings: [
    'GET /api/standings-computed',
    'GET /api/standings-qualified'
  ],
  Matchup: [
    'GET /api/h2h/:matchId',
    'GET /api/team/:id/lineup',
    'GET /api/match/:id/bench',
    'GET /api/matchup/:id/formation',
    'GET /api/corner-analysis/:id',
    'GET /api/matchup-spatial/:home/:away',
    'GET /api/analysis/:matchId',
    'GET /api/coach-compare/:teamA/:teamB'
  ],
  Venue: [
    'GET /api/venue/:id',
    'GET /api/venue/:id/weather'
  ],
  Bot: [
    'POST /api/ask'
  ]
};

for (const [name, keys] of Object.entries(fileMappings)) {
  const content = createModuleContent(name, keys);
  fs.writeFileSync(`lib/routes/${name.toLowerCase()}.js`, content);
  console.log(`Created lib/routes/${name.toLowerCase()}.js`);
}
