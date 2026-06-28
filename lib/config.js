/**
 * 应用配置模块 - PitchSignal
 * 
 * 集中管理所有配置项
 */

const path = require('path');

const config = {
  // 服务器配置
  server: {
    port: Number(process.env.PORT || 5099),
    host: process.env.HOST || '0.0.0.0',
  },
  
  // 数据目录
  data: {
    dir: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
    wc2026Dir: path.join(__dirname, '..', 'data', 'wc2026'),
  },
  
  // ESPN API
  espn: {
    baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world',
    timeout: 10000,
    cacheTtl: 60000, // 1 分钟
  },
  
  // 缓存配置
  cache: {
    defaultTtl: 300000, // 5 分钟
    maxSize: 1000,
  },
  
  // 限流配置
  rateLimit: {
    windowMs: 60000, // 1 分钟
    max: 240, // 每窗口最大请求数
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
  },
  
  // 预测模型配置
  prediction: {
    elo: {
      kFactor: 32,
      homeAdvantage: 100,
    },
    poisson: {
      defaultLambda: 2.5,
      maxGoals: 10,
    },
  },
  
  // 功能开关
  features: {
    polymarket: process.env.POLYMARKET_ENABLED === 'true',
    pundit: process.env.PUNDIT_ENABLED === 'true',
    autoCalibration: process.env.AUTO_CALIBRATION === 'true',
  },
  
  // 外部服务
  external: {
    owmApiKey: process.env.OWM_API_KEY || '',
    oddsApiKey: process.env.ODDS_API_KEY || '',
  },
  
  // 静态文件
  static: {
    dir: path.join(__dirname, '..', 'static'),
    maxAge: 3600, // 1 小时
  },
  
  // 模板
  templates: {
    dir: path.join(__dirname, '..', 'templates'),
  },
};

// 验证配置
function validateConfig() {
  const errors = [];
  
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid port: ${config.server.port}`);
  }
  
  if (!config.data.dir) {
    errors.push('Data directory not specified');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
  
  return true;
}

// 获取环境特定的配置
function getEnvConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  const envConfigs = {
    development: {
      logging: { level: 'debug' },
      cache: { defaultTtl: 60000 }, // 1 分钟
    },
    test: {
      logging: { level: 'warn' },
      data: { dir: ':memory:' },
    },
    production: {
      logging: { level: 'info' },
      cache: { defaultTtl: 300000 }, // 5 分钟
    },
  };
  
  return envConfigs[env] || {};
}

// 合并配置
function mergeConfig(base, override) {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = mergeConfig(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// 创建最终配置
function createConfig() {
  const envConfig = getEnvConfig();
  return mergeConfig(config, envConfig);
}

module.exports = {
  config: createConfig(),
  validateConfig,
  getEnvConfig,
  mergeConfig,
};