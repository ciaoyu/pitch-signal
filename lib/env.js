const fs = require('fs');
const path = require('path');

/**
 * T08: 统一环境变量加载优先级
 * 平台环境变量总是优先，.env 只作为本地开发的默认值
 * @param {string} cwd - 工作目录
 */
function loadEnv(cwd = process.cwd()) {
  try {
    const envFile = path.join(cwd, '.env');
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const splitIndex = trimmed.indexOf('=');
        if (splitIndex !== -1) {
          const key = trimmed.slice(0, splitIndex).trim();
          let val = trimmed.slice(splitIndex + 1).trim();
          
          // Remove surrounding quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          
          if (key) {
            // T08: 只有当平台环境变量未设置时，才使用 .env 的值
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load .env file:', e.message);
  }
}

module.exports = { loadEnv };
