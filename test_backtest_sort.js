const BacktestRunner = require('./lib/backtest'); 
(async () => {
  const runner = new BacktestRunner();
  const { m2018, m2022 } = runner.loadHistory();
  const combinedMatches = [...m2018, ...m2022];
  
  console.log('--- 2022 Walk-Forward (Train 2018, Test 2022, Sorted + Time Decay) ---');
  const res2022 = await runner._walkForward(combinedMatches, null, match => new Date(match.date) >= new Date('2022-01-01'));
  console.log(`Evaluated 2022 Matches: ${res2022.evaluatedCount}`);
  console.log(`Accuracy: ${(res2022.accuracy * 100).toFixed(2)}%`);
  console.log(`Brier: ${res2022.meanBrier.toFixed(4)}`);
})();
