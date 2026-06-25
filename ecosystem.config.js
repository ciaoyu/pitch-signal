const fs = require('fs');
const path = require('path');

function readEnvFile() {
  const envFile = path.join(__dirname, '.env');
  const result = {};
  try {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) result[key] = val;
    });
  } catch {}
  return result;
}

const envVars = readEnvFile();

module.exports = {
  apps: [{
    name: 'wc-dashboard',
    script: 'server.js',
    cwd: __dirname,
    env: {
      PORT: 5099,
      NODE_ENV: 'production',
      ANTHROPIC_API_KEY: envVars.ANTHROPIC_API_KEY || '',
      ANTHROPIC_BASE_URL: envVars.ANTHROPIC_BASE_URL || '',
      CLAUDE_POSTMORTEM_MODEL: envVars.CLAUDE_POSTMORTEM_MODEL || 'deepseek-v4-pro',
      CLAUDE_CHAT_MODEL: envVars.CLAUDE_CHAT_MODEL || 'deepseek-v4-flash',
      AI_POSTMORTEM_ENABLED: envVars.AI_POSTMORTEM_ENABLED || 'false',
    },
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
    log_file: '/tmp/wc-dashboard.log',
    error_file: '/tmp/wc-dashboard-error.log',
    merge_logs: true,
    time: true,
  }],
};
