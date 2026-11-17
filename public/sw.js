self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    let safePath = '/';
    if (typeof data.url === 'string' && /^\/(?!\/|\\)/.test(data.url)) {
      try {
        const parsed = new URL(data.url, self.location.origin);
        if (parsed.origin === self.location.origin) {
          safePath = parsed.pathname + parsed.search + parsed.hash;
        }
      } catch {}
    }
    const options = {
      body: data.body,
      icon: data.icon || '/cycle.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: safePath
      },
      actions: data.actions || []
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || '/';
  let urlToOpen = '/';
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin === self.location.origin) {
      urlToOpen = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {}

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
