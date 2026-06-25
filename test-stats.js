const https = require('https');
https.get('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=701625', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(JSON.parse(data).boxscore?.teams[0]?.statistics?.map(s => s.name)));
});
