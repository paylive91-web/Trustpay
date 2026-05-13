self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));

self.addEventListener('push', (e) => {
  let data = { title: 'TrustPay', body: '', url: '/' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  const title = data.title || '';
  const isPaymentAlert =
    title.includes('Confirm') ||
    title.includes('🚨') ||
    title.includes('ACTION REQUIRED');

  e.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: isPaymentAlert ? [400, 100, 400, 100, 400] : [200, 100, 200],
        data: { url: data.url },
        requireInteraction: isPaymentAlert,
      }),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        list.forEach((client) => {
          client.postMessage({ type: 'PUSH_RECEIVED', isPaymentAlert, title: data.title });
        });
      }),
    ])
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
