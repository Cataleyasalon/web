/* service-worker v36 (Cataleya Citas PWA) */
/* Best-effort background checker + notifications. The SW receives appointments via postMessage */
const CACHE_NAME = 'cataleya-v36-cache-v1';
const ASSETS = [
  'index5.html',
  'manifest.json',
  'cabecera.png',
  'icono192.png',
  'icono512.png',
  'alarma.mp3'
];

let appointments = [];
let notified = [];
let timer = null;

function ensureArray(v){ return Array.isArray(v) ? v : []; }

/* Install & cache assets */
self.addEventListener('install', evt=>{
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(()=>{}))
      .then(()=> self.skipWaiting())
  );
});

/* Activate and start timer */
self.addEventListener('activate', evt=>{
  evt.waitUntil(self.clients.claim());
  startTimer();
});

/* Simple cache-first fetch */
self.addEventListener('fetch', evt=>{
  evt.respondWith(
    caches.match(evt.request).then(res => res || fetch(evt.request).catch(()=>{}))
  );
});

/* Messages from client */
self.addEventListener('message', evt=>{
  const data = evt.data || {};
  if(data.type === 'UPDATE_APPOINTMENTS'){
    try{ appointments = ensureArray(data.appointments); notified = []; }catch(e){ appointments=[]; }
  } else if(data.type === 'SHOW_NOTIFICATION'){
    const title = data.title || 'Notificación';
    const options = data.options || {};
    self.registration.showNotification(title, options);
  } else if(data.type === 'PLAY_ALARM_SOUND'){
    // ask clients (open windows) to start audio loop
    self.clients.matchAll({type:'window'}).then(clients => {
      clients.forEach(c => c.postMessage({ type:'PLAY_ALARM_SOUND' }));
    });
  } else if(data.type === 'STOP_ALARM_SOUND'){
    self.clients.matchAll({type:'window'}).then(clients => {
      clients.forEach(c => c.postMessage({ type:'STOP_ALARM_SOUND' }));
    });
  }
});

/* Start a periodic timer (best-effort) */
function startTimer(){
  if(timer) return;
  const check = ()=>{
    const now = Date.now();
    appointments = ensureArray(appointments);
    appointments.forEach(a=>{
      try{
        const t = new Date(a.dateTime).getTime();
        const diff = t - now;
        if(diff > 0 && diff <= 5*60*1000 && !notified.includes(a.id)){
          // Format date string in client locale is not available in SW reliably; include basic body
          const dateStr = new Date(a.dateTime).toLocaleString('es-ES', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
          const title = `?? Cita con ${a.name}`;
          const body = `?? Recuerda tu cita el ${dateStr}`;
          const options = { body, icon: '/icono192.png', badge: '/icono192.png', data: { id: a.id }, requireInteraction: true };
          self.registration.showNotification(title, options);
          notified.push(a.id);
          // ask clients to play audio loop
          self.clients.matchAll({type:'window'}).then(clients => clients.forEach(c => c.postMessage({ type:'PLAY_ALARM_SOUND' })));
        }
      }catch(e){ console.error('sw check err', e); }
    });
  };
  // run immediately, then every 60s (5-min checks are based on appointment time)
  check();
  timer = setInterval(check, 60*1000);
}

/* When notification clicked, open app and go to #view */
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(clientList=>{
      for(const client of clientList){
        if('focus' in client) {
          client.focus();
          // navigate to view via hash
          client.postMessage({ type: 'NAVIGATE_TO_VIEW' });
          return;
        }
      }
      // no client open -> open new window to view
      return self.clients.openWindow('/index5.html#view');
    })
  );
});
