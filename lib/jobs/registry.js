'use strict';

/**
 * Job Registry & Health Monitor
 * 
 * Tracks lastSyncAt timestamps, execution status, and last errors
 * for all scheduled background jobs.
 */

const _jobs = {};

const DEFAULT_JOBS = [
  'moment-sync',
  'xg-collector',
  'odds-collector',
  'lineups-sync',
  'match-snapshot',
  'ai-postmortem',
];

function registerJob(name) {
  if (!_jobs[name]) {
    _jobs[name] = {
      name,
      lastSyncAt: null,
      lastErrorAt: null,
      lastError: null,
      status: 'idle', // 'idle' | 'running' | 'error' | 'ok' | 'stopped'
    };
  }
  return _jobs[name];
}

// Pre-register default jobs so they always appear in /health
DEFAULT_JOBS.forEach(registerJob);

function recordStart(name) {
  const job = registerJob(name);
  job.status = 'running';
}

function recordSuccess(name) {
  const job = registerJob(name);
  job.lastSyncAt = new Date().toISOString();
  job.status = 'ok';
  job.lastError = null;
}

function recordError(name, err) {
  const job = registerJob(name);
  job.lastErrorAt = new Date().toISOString();
  job.lastError = err && err.message ? err.message : String(err);
  job.status = 'error';
}

function recordStop(name) {
  const job = registerJob(name);
  job.status = 'stopped';
}

function getJobStatuses() {
  const res = {};
  for (const [name, info] of Object.entries(_jobs)) {
    res[name] = {
      lastSyncAt: info.lastSyncAt,
      status: info.status,
      lastError: info.lastError,
    };
  }
  return res;
}

function _resetForTest() {
  for (const k of Object.keys(_jobs)) {
    delete _jobs[k];
  }
  DEFAULT_JOBS.forEach(registerJob);
}

module.exports = {
  registerJob,
  recordStart,
  recordSuccess,
  recordError,
  recordStop,
  getJobStatuses,
  _resetForTest,
};
