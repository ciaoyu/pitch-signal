'use strict';

/**
 * PWA Push Notification Service (Reserved Path for P2-4)
 *
 * 为 PWA 推送预留的安全异步操作路径，支持安全重试与日志上下文记录。
 * 在此预留标准化的 push 执行函数，接入 logger-trycatch 与 safeExec。
 */

const { safeExec, loggers } = require('../logger');

/**
 * 发送推送通知（预留路径）
 * @param {string|number} matchId - 关联的比赛 ID
 * @param {object} payload - 推送内容载荷 (title, body, url 等)
 * @param {object} [opts] - 选项
 * @returns {Promise<{success: boolean, matchId?: string|number, error?: string}>}
 */
async function sendPushNotification(matchId, payload, opts = {}) {
  const log = opts.logger || loggers.push;
  return await safeExec(async () => {
    // 预留的 PWA Push 发送逻辑。真正接入 web-push 前不得返回“已发送”。
    if (opts.dryRun) {
      log.info(`[push] Dry run. Skipped dispatch for match ${matchId}`, {
        jobName: 'push',
        matchId: String(matchId),
        source: opts.source || 'pwa_push',
        stage: 'send_notification',
        reason: 'dry_run',
        payload,
      });
      return { success: true, matchId, dryRun: true };
    }

    log.warn(`[push] Push dispatch is not implemented yet for match ${matchId}`, {
      jobName: 'push',
      matchId: String(matchId),
      source: opts.source || 'pwa_push',
      stage: 'send_notification',
      reason: process.env.VAPID_PUBLIC_KEY ? 'web_push_not_implemented' : 'vapid_unconfigured',
      payload,
    });
    return {
      success: false,
      matchId,
      error: process.env.VAPID_PUBLIC_KEY ? 'web_push_not_implemented' : 'vapid_unconfigured',
    };
  }, {
    jobName: 'push',
    matchId: String(matchId),
    source: opts.source || 'pwa_push',
    stage: 'send_notification',
    reason: 'push_delivery_error',
    fallback: { success: false, error: 'push_failed' }
  }, log);
}

/**
 * 注册推送订阅（预留路径）
 * @param {string} userId - 用户/设备 ID
 * @param {object} subscription - web-push 订阅对象
 * @returns {Promise<{success: boolean}>}
 */
async function registerSubscription(userId, subscription, opts = {}) {
  const log = opts.logger || loggers.push;
  return await safeExec(async () => {
    if (opts.dryRun) {
      log.info(`[push] Subscription dry run for user ${userId}`, {
        jobName: 'push',
        source: 'client_subscription',
        stage: 'register_subscription',
        reason: 'dry_run',
        userId,
      });
      return { success: true, dryRun: true };
    }

    log.warn(`[push] Subscription persistence is not implemented yet for user ${userId}`, {
      jobName: 'push',
      source: 'client_subscription',
      stage: 'register_subscription',
      reason: 'subscription_persistence_not_implemented',
      userId,
    });
    return { success: false, error: 'subscription_persistence_not_implemented' };
  }, {
    jobName: 'push',
    source: 'client_subscription',
    stage: 'register_subscription',
    reason: 'subscription_registration_error',
    fallback: { success: false }
  }, log);
}

module.exports = {
  sendPushNotification,
  registerSubscription,
};
