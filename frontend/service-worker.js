'use strict';

const CURRENT_PUBLIC_ORIGIN = 'https://www.hamzawy-sat.dynv6.net';
const LEGACY_PUBLIC_HOSTS = new Set(['hamzawy-backend-v2-production.up.railway.app', 'hamzawy-sat.vercel.app']);

function notificationTarget(value) {
  try {
    const url = new URL(String(value || '/'), CURRENT_PUBLIC_ORIGIN);
    if (url.protocol === 'https:' && (url.origin === CURRENT_PUBLIC_ORIGIN || LEGACY_PUBLIC_HOSTS.has(url.hostname.toLowerCase()))) {
      return CURRENT_PUBLIC_ORIGIN + (url.pathname || '/') + url.search + url.hash;
    }
  } catch (_) {}
  return CURRENT_PUBLIC_ORIGIN + '/';
}

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) {}
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const target = notificationTarget(data.url || payload.link || '/');
  event.waitUntil(self.registration.showNotification(String(payload.title || 'إشعار من حمزاوي سات'), {
    body: String(payload.body || ''),
    dir: 'rtl',
    lang: 'ar',
    data: { url: target },
    tag: 'hamzawy-' + Date.now()
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
