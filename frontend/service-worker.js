'use strict';

// Resolve notification destinations against the origin that actually serves this worker.
// Retain known historical hosts only as accepted input; never navigate back to them.
const CURRENT_PUBLIC_ORIGIN = self.location.origin;
const LEGACY_PUBLIC_HOSTS = new Set([
  'www.hamzawy-sat.dynv6.net',
  'hamzawy-backend-v2-production.up.railway.app',
  'hamzawy-sat.vercel.app'
]);

function notificationTarget(value) {
  try {
    const url = new URL(String(value || '/'), CURRENT_PUBLIC_ORIGIN);
    if (url.protocol === 'https:' && (url.origin === CURRENT_PUBLIC_ORIGIN || LEGACY_PUBLIC_HOSTS.has(url.hostname.toLowerCase()))) {
      return CURRENT_PUBLIC_ORIGIN + (url.pathname || '/') + url.search + url.hash;
    }
  } catch (_) {}
  return CURRENT_PUBLIC_ORIGIN + '/';
}

// Recover a browser subscription when the push service rotates its endpoint.
// The service worker has no access to the admin JWT; the page re-registers the
// renewed subscription with the authenticated API when it next becomes active.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const response = await fetch('/api/notifications/web-push-public-key', { cache: 'no-store' });
      if (!response.ok) throw new Error('Web Push public key unavailable');
      const data = await response.json();
      if (!data.publicKey) throw new Error('Web Push public key unavailable');
      const padding = '='.repeat((4 - data.publicKey.length % 4) % 4);
      const raw = atob((data.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/'));
      const applicationServerKey = Uint8Array.from(raw, char => char.charCodeAt(0));
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: 'WEB_PUSH_SUBSCRIPTION_CHANGED' });
      return subscription;
    } catch (error) {
      console.error('Web Push subscription recovery failed:', error);
      throw error;
    }
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const target = notificationTarget(data.url || payload.link || '/');
  event.waitUntil(self.registration.showNotification(String(payload.title || 'إشعار من حمزاوي سات'), {
    body: String(payload.body || ''),
    dir: 'rtl',
    lang: 'ar',
    data: { url: target, notificationId: String(data.notificationId || '') },
    tag: data.notificationId ? 'hamzawy-' + String(data.notificationId) : 'hamzawy-' + Date.now()
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = notificationTarget(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(CURRENT_PUBLIC_ORIGIN) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
