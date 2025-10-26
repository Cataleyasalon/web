// Cataleya Service Worker v36.5 (cleanup + notifications)
const CACHE_NAME = 'cataleya-v36.5';
const APP_SHELL = [
  '/web/',
  '/web/index5.html',
  '/web/manifest.json',
  '/web/icono192.png',
  '/web/icono512.png',
  '/web/cabecera.png',
  '/web/alarma.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => {
      if(k !== CACHE_NAME) return caches.delete(k);
    }))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request).then(r => { caches.open(CACHE_NAME).then(c=>c.put(event.request, r.clone())); return r; }).catch(()=>caches.match('/web/index5.html'))));
});

let appointments = [];
self.addEventListener('message', event => {
  const d = event.data;
  if(!d) return;
  if(d.type === 'UPDATE_APPOINTMENTS') appointments = d.appointments || [];
  if(d.type === 'SHOW_NOTIFICATION'){
    const t = d.title || 'Notificación'; const options = d.options || {}; self.registration.showNotification(t, options);
  }
  if(d.type === 'PLAY_ALARM_SOUND'){
    self.clients.matchAll({type:'window'}).then(clients => clients.forEach(c => c.postMessage({type:'PLAY_ALARM_SOUND'})));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    if(list.length) { list[0].focus(); list[0].postMessage({type:'NAVIGATE_TO_VIEW'}); return; }
    return clients.openWindow('/web/index5.html#view');
  }));
});
