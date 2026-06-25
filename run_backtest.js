const BacktestRunner = require('./lib/backtest'); 
(async () => {
  await new BacktestRunner().run();
})();
