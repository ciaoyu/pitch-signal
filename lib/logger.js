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
  momentSync: createLogger('moment-sync'),
  liveReprice: createLogger('live-reprice'),
  push: createLogger('push'),
  jobs: createLogger('jobs'),
};

/**
 * 关键异步路径安全执行包裹器 (Try/Catch Guard with Structured Logging)
 * @param {Function} fn - 要执行的异步回调函数
 * @param {object} context - 上下文信息 (jobName, matchId, source, stage, reason, fallback等)
 * @param {object} [loggerInstance] - 自定义日志对象，默认为对应模块的 logger
 * @returns {Promise<*>}
 */
async function safeExec(fn, context = {}, loggerInstance = null) {
  const modName = context.jobName || context.module || 'safeExec';
  const log = loggerInstance || loggers[modName] || createLogger(modName);
  const start = Date.now();
  try {
    const timeoutMs = Number(context.timeoutMs || 0);
    if (timeoutMs > 0) {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`safeExec timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);
    }
    return await fn();
  } catch (error) {
    const durationMs = Date.now() - start;
    const errMessage = error?.message || String(error);
    const logMeta = {
      jobName: context.jobName || modName,
      matchId: context.matchId || null,
      source: context.source || null,
      stage: context.stage || 'exec',
      reason: context.reason || 'unhandled_exception',
      message: errMessage,
      stack: error?.stack || null,
      durationMs,
      ...context,
    };
    log.error(`[${modName}] ${context.stage || 'exec'} failed: ${errMessage}`, logMeta);
    if (context.fallback !== undefined) {
      return typeof context.fallback === 'function' ? context.fallback(error) : context.fallback;
    }
    return null;
  }
}

/**
 * 同步路径安全执行包裹器
 * @param {Function} fn - 要执行的同步回调函数
 * @param {object} context - 上下文信息 (jobName, matchId, source, stage, reason, fallback等)
 * @param {object} [loggerInstance] - 自定义日志对象，默认为对应模块的 logger
 * @returns {*}
 */
function safeExecSync(fn, context = {}, loggerInstance = null) {
  const modName = context.jobName || context.module || 'safeExec';
  const log = loggerInstance || loggers[modName] || createLogger(modName);
  const start = Date.now();
  try {
    return fn();
  } catch (error) {
    const durationMs = Date.now() - start;
    const errMessage = error?.message || String(error);
    const logMeta = {
      jobName: context.jobName || modName,
      matchId: context.matchId || null,
      source: context.source || null,
      stage: context.stage || 'exec',
      reason: context.reason || 'unhandled_exception',
      message: errMessage,
      stack: error?.stack || null,
      durationMs,
      ...context,
    };
    log.error(`[${modName}] ${context.stage || 'exec'} failed: ${errMessage}`, logMeta);
    if (context.fallback !== undefined) {
      return typeof context.fallback === 'function' ? context.fallback(error) : context.fallback;
    }
    return null;
  }
}

module.exports = {
  createLogger,
  loggers,
  LOG_LEVELS,
  safeExec,
  safeExecSync,
};
