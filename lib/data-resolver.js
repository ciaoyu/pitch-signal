const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const SEED_DATA_DIR = process.env.SEED_DATA_PATH
  ? path.resolve(process.env.SEED_DATA_PATH)
  : path.join(PROJECT_ROOT, 'resources', 'seed', 'wc2026');

function validateFilename(filename) {
  if (typeof filename !== 'string' || !filename || path.basename(filename) !== filename) {
    throw new Error(`Invalid wc2026 data filename: ${String(filename)}`);
  }
  return filename;
}

function getRuntimeDataDir() {
  const dataRoot = process.env.DATA_PATH
    ? path.resolve(process.env.DATA_PATH)
    : path.join(PROJECT_ROOT, 'data');
  return path.join(dataRoot, 'wc2026');
}

/**
 * Get path to read-only seed data
 */
function getSeedDataPath(filename) {
  return path.join(SEED_DATA_DIR, validateFilename(filename));
}

/**
 * Get path to runtime mutable data
 */
function getRuntimeDataPath(filename, options = {}) {
  const runtimeDir = getRuntimeDataDir();
  if (options.ensureDir !== false) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }
  return path.join(runtimeDir, validateFilename(filename));
}

/**
 * Resolve data file path: prefer runtime modifications, fallback to read-only seed if non-existent
 */
function resolveDataPath(filename, options = {}) {
  const runtimePath = getRuntimeDataPath(filename, { ensureDir: false });
  if (fs.existsSync(runtimePath)) {
    return runtimePath;
  }
  const seedPath = getSeedDataPath(filename);
  if (fs.existsSync(seedPath) || options.required === false) {
    return seedPath;
  }
  throw new Error(`Missing wc2026 data file in runtime and seed directories: ${filename}`);
}

function writeFileAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}

function writeJsonAtomic(filename, value) {
  const target = getRuntimeDataPath(filename);
  writeFileAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function writeTextAtomic(filename, value) {
  const target = getRuntimeDataPath(filename);
  writeFileAtomic(target, String(value));
  return target;
}

module.exports = {
  SEED_DATA_DIR,
  getRuntimeDataDir,
  getSeedDataPath,
  getRuntimeDataPath,
  resolveDataPath,
  writeJsonAtomic,
  writeTextAtomic,
};
