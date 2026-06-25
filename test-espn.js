const https = require('https');
const dateKey = '20260612';
https.get('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=' + dateKey, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(JSON.parse(data).events?.length || 0));
});
