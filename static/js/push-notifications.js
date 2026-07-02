// ========== push-notifications.js — P2-2 goal notification opt-in ==========
(function () {
    'use strict';

    const button = () => document.getElementById('push-notification-btn');

    function setState(state, zh, en) {
        const el = button();
        if (!el) return;
        el.dataset.pushState = state;
        el.title = window.WorldCup?.State?.uiLang === 'en' ? en : zh;
        const label = el.querySelector('[data-push-label]');
        if (label) label.textContent = state === 'enabled' ? '✓' : '🔔';
        el.setAttribute('aria-label', el.title);
        el.style.color = state === 'enabled' ? '#34d399' : 'rgba(248,250,252,.45)';
    }

    function base64UrlToUint8Array(value) {
        const padding = '='.repeat((4 - value.length % 4) % 4);
        const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        return Uint8Array.from(raw, char => char.charCodeAt(0));
    }

    function getDeviceId() {
        const key = 'pitchsignal_push_device_id';
        let id = localStorage.getItem(key);
        if (!id) {
            id = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(key, id);
        }
        return id;
    }

    async function registerSubscription(subscription) {
        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId: getDeviceId(),
                subscription: subscription.toJSON(),
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Subscription registration failed');
    }

    async function enablePushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            setState('unsupported', '当前浏览器不支持推送通知', 'Push notifications are not supported');
            return;
        }

        const el = button();
        if (el) el.disabled = true;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setState('denied', '通知权限未开启', 'Notification permission was not granted');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' });
                const keyData = await keyResponse.json().catch(() => ({}));
                if (!keyResponse.ok || !keyData.publicKey) {
                    throw new Error(keyData.error || 'Push service is not configured');
                }
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: base64UrlToUint8Array(keyData.publicKey),
                });
            }

            await registerSubscription(subscription);
            setState('enabled', '进球推送已开启', 'Goal notifications enabled');
        } catch (error) {
            console.error('push-notifications: enable failed', error);
            setState('error', '进球推送开启失败，请稍后重试', 'Could not enable goal notifications');
        } finally {
            if (el) el.disabled = false;
        }
    }

    async function refreshPushState() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            setState('unsupported', '当前浏览器不支持推送通知', 'Push notifications are not supported');
            return;
        }
        if (Notification.permission === 'denied') {
            setState('denied', '通知权限已被浏览器阻止', 'Notifications are blocked by the browser');
            return;
        }
        if (Notification.permission !== 'granted') {
            setState('idle', '开启进球推送', 'Enable goal notifications');
            return;
        }
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await registerSubscription(subscription);
                setState('enabled', '进球推送已开启', 'Goal notifications enabled');
            } else {
                setState('idle', '开启进球推送', 'Enable goal notifications');
            }
        } catch {
            setState('error', '进球推送状态检查失败', 'Could not check notification status');
        }
    }

    window.PitchSignalPush = { enable: enablePushNotifications, refresh: refreshPushState };
})();
