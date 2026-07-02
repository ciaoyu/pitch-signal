'use strict';

const crypto = require('crypto');
const pushService = require('../services/push-service');

function createPushRoutes(deps) {
  return {
    'GET /api/push/public-key': () => {
      const publicKey = process.env.VAPID_PUBLIC_KEY || '';
      if (!publicKey) return { error: 'Push notifications are not configured', code: 503 };
      return { publicKey };
    },

    'POST /api/push/subscribe': async (_params, body) => {
      const subscription = body?.subscription;
      if (!pushService.validateSubscription(subscription)) {
        return { error: 'A valid push subscription is required', code: 400 };
      }

      const deviceId = String(body?.deviceId || '').trim()
        || `device_${crypto.createHash('sha256').update(subscription.endpoint).digest('hex').slice(0, 24)}`;
      const result = await pushService.registerSubscription(deviceId.slice(0, 128), subscription, {
        db: deps.db,
      });
      if (!result.success) {
        return {
          error: result.error === 'invalid_subscription' ? 'Invalid push subscription' : 'Failed to save push subscription',
          code: result.error === 'invalid_subscription' ? 400 : 500,
        };
      }
      return { success: true };
    },
  };
}

module.exports = createPushRoutes;
