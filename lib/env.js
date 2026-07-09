const fs = require('fs');
const path = require('path');

/**
 * T08: Unified environment variable loading priority
 * Platform environment variables always take precedence; .env serves only as default values for local development
 * @param {string} cwd - working directory
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
            // T08: Only use .env value if platform environment variable is not set
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
