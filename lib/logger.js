/**
 * Structured Logging Module - PitchSignal
 * 
 * Provides unified logging format, supporting:
 * - Log levels (debug, info, warn, error)
 * - Structured metadata
 * - Timestamps
 * - Request tracing (optional)
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || LOG_LEVELS.info;

/**
 * Format log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {string} Formatted log string
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
 * Create logger
 * @param {string} module - Module name
 * @returns {object} Logger object
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
     * Log function execution time
     * @param {string} fnName - Function name
     * @param {Function} fn - Function to execute
     * @returns {*} Function return value
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
     * Create child logger (for request tracing)
     * @param {string} requestId - Request ID
     * @returns {object} Child logger
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

// Pre-defined loggers
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
 * Async path safe execution wrapper (Try/Catch Guard with Structured Logging)
 * @param {Function} fn - Async callback function to execute
 * @param {object} context - Context info (jobName, matchId, source, stage, reason, fallback, etc.)
 * @param {object} [loggerInstance] - Custom logger object, defaults to corresponding module logger
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
 * Sync path safe execution wrapper
 * @param {Function} fn - Sync callback function to execute
 * @param {object} context - Context info (jobName, matchId, source, stage, reason, fallback, etc.)
 * @param {object} [loggerInstance] - Custom logger object, defaults to corresponding module logger
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
