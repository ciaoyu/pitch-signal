#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed += 1; console.log('  ✅', label); }
  else { failed += 1; console.error('  ❌', label); }
}

process.env.TEST_MODE = '1';
const dbModule = require('../lib/db');
const { db } = dbModule;
const pushService = require('../lib/services/push-service');
const createPushRoutes = require('../lib/routes/push');
const { selectPushableGoals, buildGoalPayload } = require('../lib/jobs/moment-sync');

const logger = { info() {}, warn() {}, error() {}, log() {} };

(async () => {
  console.log('━━━ test-pwa-push ━━━');

  assert(pushService.validateSubscription({
    endpoint: 'https://push.example/sub/1',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
  }), 'valid browser subscription accepted');
  assert(!pushService.validateSubscription({ endpoint: 'http://insecure.example' }), 'invalid subscription rejected');

  db.prepare('DELETE FROM push_subscriptions').run();
  const subscription = {
    endpoint: 'https://push.example/sub/1',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
  };
  const registered = await pushService.registerSubscription('device-1', subscription, { db, logger });
  assert(registered.success, 'subscription persisted');
  assert(db.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').get().count === 1, 'one subscription row created');

  await pushService.registerSubscription('device-2', {
    endpoint: subscription.endpoint,
    keys: { p256dh: 'new-p256dh', auth: 'new-auth' },
  }, { db, logger });
  const updated = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint);
  assert(updated.user_id === 'device-2' && updated.p256dh === 'new-p256dh', 'endpoint upsert refreshes keys and device');

  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES ('expired-device', 'https://push.example/expired', 'p', 'a')
  `).run();
  const deliveredPayloads = [];
  const webPushMock = {
    setVapidDetails(subject, publicKey, privateKey) {
      assert(subject === 'mailto:test@example.com' && publicKey === 'public' && privateKey === 'private', 'VAPID details configured');
    },
    async sendNotification(sub, payload) {
      deliveredPayloads.push(JSON.parse(payload));
      if (sub.endpoint.endsWith('/expired')) {
        const error = new Error('gone');
        error.statusCode = 410;
        throw error;
      }
    },
  };
  const sent = await pushService.sendPushNotification('401', {
    title: 'Goal',
    body: 'Brazil 1-0',
    matchId: '401',
    minute: 23,
  }, {
    db,
    logger,
    webPush: webPushMock,
    vapidPublicKey: 'public',
    vapidPrivateKey: 'private',
    vapidSubject: 'mailto:test@example.com',
  });
  assert(sent.sent === 1 && sent.expired === 1 && sent.failed === 0, 'delivery counts success and expired endpoint');
  assert(deliveredPayloads.every(payload => payload.matchId === '401' && payload.url === '/#match/401'), 'payload includes match deep link');
  assert(db.prepare("SELECT active FROM push_subscriptions WHERE endpoint LIKE '%/expired'").get().active === 0, 'HTTP 410 endpoint deactivated');

  const routes = createPushRoutes({ db });
  const badRoute = await routes['POST /api/push/subscribe']({}, { subscription: {} });
  assert(badRoute.code === 400, 'subscribe route rejects malformed body');
  const routeResult = await routes['POST /api/push/subscribe']({}, {
    deviceId: 'route-device',
    subscription: {
      endpoint: 'https://push.example/sub/route',
      keys: { p256dh: 'route-p', auth: 'route-a' },
    },
  });
  assert(routeResult.success, 'subscribe route persists valid subscription');

  const fakeDb = {
    prepare() {
      return { get: (_matchId, minute) => minute === 18 ? { 1: 1 } : undefined };
    },
  };
  const goals = selectPushableGoals([
    { type: 'goal', minute: 18, minuteAdded: 0 },
    { type: 'goal', minute: 22, minuteAdded: 0, source: 'fifa' },
    { type: 'goal', minute: 22, minuteAdded: 0, source: 'espn' },
    { type: 'goal', minute: 9, minuteAdded: 0 },
    { type: 'yellow_card', minute: 22 },
  ], '401', 23, fakeDb);
  assert(goals.length === 1 && goals[0].minute === 22, 'only fresh, new, deduplicated goal selected');

  const goalPayload = buildGoalPayload({
    espnId: '401',
    homeName: 'Brazil',
    awayName: 'Morocco',
    homeScore: 2,
    awayScore: 1,
  }, { minute: 67 });
  assert(goalPayload.url === '/#match/401' && goalPayload.title.includes('2–1'), 'moment payload targets corresponding match and score');

  const sw = fs.readFileSync(path.join(__dirname, '..', 'static', 'sw.js'), 'utf8');
  assert(sw.includes("addEventListener('push'") && sw.includes('showNotification'), 'service worker renders push notification');
  assert(sw.includes("addEventListener('notificationclick'") && sw.includes('OPEN_MATCH'), 'service worker click opens match');

  console.log(`\n✅ ${passed} passed  ❌ ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
