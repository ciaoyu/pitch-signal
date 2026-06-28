/**
 * 结构化日志模块 - PitchSignal
 * 
 * 提供统一的日志格式，支持：
 * - 日志级别（debug, info, warn, error）
 * - 结构化元数据
 * - 时间戳
 * - 请求追踪（可选）
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || LOG_LEVELS.info;

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {object} meta - 附加元数据
 * @returns {string} 格式化后的日志字符串
 */
function formatLog(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

/**
 * 创建日志记录器
 * @param {string} module - 模块名称
 * @returns {object} 日志记录器对象
 */
function createLogger(module) {
  return {
    debug(message, meta = {}) {
      if (currentLevel <= LOG_LEVELS.debug) {
        console.debug(formatLog('debug', message, { module, ...meta }));
      }
    },
    
    info(message, meta = {}) {
      if (currentLevel <= LOG_LEVELS.info) {
        console.log(formatLog('info', message, { module, ...meta }));
      }
    },
    
    warn(message, meta = {}) {
      if (currentLevel <= LOG_LEVELS.warn) {
        console.warn(formatLog('warn', message, { module, ...meta }));
      }
    },
    
    error(message, meta = {}) {
      if (currentLevel <= LOG_LEVELS.error) {
        console.error(formatLog('error', message, { module, ...meta }));
      }
    },
    
    /**
     * 记录函数执行时间
     * @param {string} fnName - 函数名称
     * @param {Function} fn - 要执行的函数
     * @returns {*} 函数返回值
     */
    async timed(fnName, fn) {
      const start = Date.now();
      try {
        const result = await fn();
        const duration = Date.now() - start;
        this.debug(`${fnName} completed`, { durationMs: duration });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        this.error(`${fnName} failed`, { 
          durationMs: duration, 
          error: error.message,
          stack: error.stack 
        });
        throw error;
      }
    },
    
    /**
     * 创建子日志记录器（用于请求追踪）
     * @param {string} requestId - 请求 ID
     * @returns {object} 子日志记录器
     */
    child(requestId) {
      return {
        debug: (message, meta = {}) => this.debug(message, { requestId, ...meta }),
        info: (message, meta = {}) => this.info(message, { requestId, ...meta }),
        warn: (message, meta = {}) => this.warn(message, { requestId, ...meta }),
        error: (message, meta = {}) => this.error(message, { requestId, ...meta }),
        timed: this.timed.bind(this),
      };
    },
  };
}

// 预定义的日志记录器
const loggers = {
  server: createLogger('server'),
  db: createLogger('db'),
  api: createLogger('api'),
  prediction: createLogger('prediction'),
  venue: createLogger('venue'),
  team: createLogger('team'),
  cache: createLogger('cache'),
};

module.exports = {
  createLogger,
  loggers,
  LOG_LEVELS,
};