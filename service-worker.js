// === Cataleya Citas Service Worker v36.4 ===
const CACHE_NAME = 'cataleya-v36.4';
const APP_SHELL = [
  './',
  './index5.html',
  './manifest.json',
  './icono192.png',
  './icono512.png',
  './cabecera.png',
  './alarma.mp3'
];

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Eliminando caché antiguo:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v36.4...');
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(response =>
      response ||
      fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchRes.clone());
          return fetchRes;
        });
      }).catch(() => caches.match('./index5.html'))
    )
  );
});

let appointments = [];
self.addEventListener('message', event => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'UPDATE_APPOINTMENTS') {
    appointments = data.appointments || [];
    console.log('[SW] Citas sincronizadas:', appointments.length);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      if (clientsArr.length > 0) clientsArr[0].focus();
      else clients.openWindow('./');
    })
  );
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-cataleya-citas') {
    console.log('[SW] Sincronización periódica activada.');
  }
});

console.log('[SW] Cataleya Citas Service Worker v36.4 listo.');
