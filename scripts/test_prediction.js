try {
  const r = require('./lib/routes/prediction');
  console.log('prediction.js loaded OK, type:', typeof r);
} catch(e) {
  console.log('ERROR:', e.message);
  console.log(e.stack);
}
