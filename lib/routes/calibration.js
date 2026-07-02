'use strict';

const { buildCalibrationReport } = require('../backtest-calibration');

module.exports = function createCalibrationRoutes() {
  return {
    'GET /api/calibration-report': async () => buildCalibrationReport(),
  };
};
