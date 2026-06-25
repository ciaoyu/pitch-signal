const fs = require('fs');
const path = require('path');

const SCHEDULE_FILE = path.join(__dirname, '../data/match_snapshot_schedule.json');
const MAPPING_FILE = path.join(__dirname, '../data/match_mappings.json');

async function main() {
  if (!fs.existsSync(SCHEDULE_FILE)) {
    console.error('Schedule file not found:', SCHEDULE_FILE);
    return;
  }

  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  let mappings = {};
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing mapping file, starting fresh.');
    }
  }

  const matches = schedule.matches || [];
  let added = 0;

  for (const match of matches) {
    const espnId = String(match.matchId);
    if (!mappings[espnId]) {
      mappings[espnId] = {
        fotmob: '',
        note: `${match.name} (${match.kickoffUtc.split('T')[0]})`
      };
      added++;
    }
  }

  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mappings, null, 2));
  console.log(`✅ Updated match_mappings.json. Added ${added} new entries for manual/semi-auto mapping.`);
  console.log('💡 TIP: You can manually add FotMob match IDs (e.g., "3610148") to the "fotmob" field in data/match_mappings.json for the specific matches you care about.');
}

main().catch(console.error);
