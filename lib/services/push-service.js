'use strict';

/**
 * Web Push delivery and subscription persistence.
 */

const webPush = require('web-push');
const { safeExec, loggers } = require('../logger');

let configuredKey = '';

function getDb(opts = {}) {
  return opts.db || require('../db').db;
}

function configureWebPush(opts = {}) {
  const client = opts.webPush || webPush;
  const publicKey = opts.vapidPublicKey || process.env.VAPID_PUBLIC_KEY;
  const privateKey = opts.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY;
  const subject = opts.vapidSubject || process.env.VAPID_SUBJECT || 'mailto:ops@pitchsignal.app';

  if (!publicKey || !privateKey) {
    return { ok: false, error: 'vapid_unconfigured', client };
  }

  const key = `${subject}:${publicKey}:${privateKey}`;
  if (configuredKey !== key || opts.webPush) {
    client.setVapidDetails(subject, publicKey, privateKey);
    if (!opts.webPush) configuredKey = key;
  }
  return { ok: true, client };
}

function validateSubscription(subscription) {
  return !!(
    subscription
    && typeof subscription.endpoint === 'string'
    && subscription.endpoint.startsWith('https://')
    && typeof subscription.keys?.p256dh === 'string'
    && subscription.keys.p256dh
    && typeof subscription.keys?.auth === 'string'
    && subscription.keys.auth
  );
}

async function registerSubscription(userId, subscription, opts = {}) {
  const log = opts.logger || loggers.push;
  return safeExec(async () => {
    if (opts.dryRun) {
      return { success: true, dryRun: true };
    }
    if (!validateSubscription(subscription)) {
      return { success: false, error: 'invalid_subscription' };
    }

    const db = getDb(opts);
    db.prepare(`
      INSERT INTO push_subscriptions
        (user_id, endpoint, p256dh, auth, active, failure_count, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 0, NULL, datetime('now'), datetime('now'))
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        active = 1,
        failure_count = 0,
        last_error = NULL,
        updated_at = datetime('now')
    `).run(String(userId || 'anonymous'), subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);

    log.info('[push] Subscription registered', {
      jobName: 'push',
      source: 'client_subscription',
      stage: 'register_subscription',
      userId: String(userId || 'anonymous'),
    });
    return { success: true };
  }, {
    jobName: 'push',
    source: 'client_subscription',
    stage: 'register_subscription',
    reason: 'subscription_registration_error',
    fallback: { success: false, error: 'subscription_registration_failed' },
  }, log);
}

async function sendPushNotification(matchId, payload, opts = {}) {
  const log = opts.logger || loggers.push;
  return safeExec(async () => {
    if (opts.dryRun) {
      return { success: true, matchId, dryRun: true, sent: 0, failed: 0, expired: 0 };
    }

    const configured = configureWebPush(opts);
    if (!configured.ok) {
      log.warn('[push] VAPID keys are not configured; notification skipped', {
        jobName: 'push',
        matchId: String(matchId),
        source: opts.source || 'moment_sync',
        stage: 'send_notification',
        reason: configured.error,
      });
      return { success: false, matchId: String(matchId), error: configured.error, sent: 0, failed: 0, expired: 0 };
    }

    const db = getDb(opts);
    const rows = db.prepare(`
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE active = 1
      ORDER BY id
    `).all();

    if (!rows.length) {
      return { success: true, matchId: String(matchId), sent: 0, failed: 0, expired: 0 };
    }

    const notification = {
      title: payload?.title || 'PitchSignal',
      body: payload?.body || '比赛有新动态',
      icon: payload?.icon || '/static/icon-192-v3.png',
      badge: payload?.badge || '/static/icon-192-v3.png',
      matchId: String(matchId),
      url: payload?.url || `/#match/${encodeURIComponent(String(matchId))}`,
      tag: payload?.tag || `goal-${matchId}-${payload?.minute ?? Date.now()}`,
      minute: payload?.minute ?? null,
      score: payload?.score ?? null,
    };

    let sent = 0;
    let failed = 0;
    let expired = 0;
    for (const row of rows) {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await configured.client.sendNotification(subscription, JSON.stringify(notification), {
          TTL: Number(opts.ttl ?? 300),
          urgency: 'high',
        });
        db.prepare(`
          UPDATE push_subscriptions
          SET failure_count = 0, last_error = NULL, last_success_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(row.id);
        sent += 1;
      } catch (error) {
        const statusCode = Number(error?.statusCode || error?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          db.prepare(`
            UPDATE push_subscriptions
            SET active = 0, last_error = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(`expired_${statusCode}`, row.id);
          expired += 1;
        } else {
          db.prepare(`
            UPDATE push_subscriptions
            SET failure_count = failure_count + 1, last_error = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(String(error?.message || 'delivery_failed').slice(0, 500), row.id);
          failed += 1;
        }
      }
    }

    log.info('[push] Notification dispatch completed', {
      jobName: 'push',
      matchId: String(matchId),
      source: opts.source || 'moment_sync',
      stage: 'send_notification',
      sent,
      failed,
      expired,
    });
    return { success: failed === 0, matchId: String(matchId), sent, failed, expired };
  }, {
    jobName: 'push',
    matchId: String(matchId),
    source: opts.source || 'moment_sync',
    stage: 'send_notification',
    reason: 'push_delivery_error',
    fallback: { success: false, matchId: String(matchId), error: 'push_failed', sent: 0, failed: 0, expired: 0 },
  }, log);
}

module.exports = {
  configureWebPush,
  validateSubscription,
  sendPushNotification,
  registerSubscription,
};
