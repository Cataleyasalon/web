// service-worker v34 - attempts to keep appointments and show notifications even if page closed.
// Note: Background execution depends on browser & whether PWA is installed. Install PWA for best results.

const CACHE_NAME = 'cataleya-v34-cache';
const ASSETS = ['index5.html','manifest.json','icono192.png','icono512.png','cabecera.png','alarma.mp3'];

let appointments = [];
let notified = [];
let timer = null;

function ensureArray(v){ return Array.isArray(v) ? v : []; }

self.addEventListener('install', evt=>{
  evt.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', evt=>{
  evt.waitUntil(self.clients.claim());
  startTimer();
});

self.addEventListener('fetch', evt=>{
  evt.respondWith(caches.match(evt.request).then(r=> r || fetch(evt.request)));
});

self.addEventListener('message', evt=>{
  const data = evt.data || {};
  if(data.type === 'UPDATE_APPOINTMENTS'){
    try{
      appointments = ensureArray(data.appointments);
      // reset notified to avoid stuck state
      notified = [];
    }catch(e){ appointments = []; }
  } else if(data.type === 'SHOW_NOTIFICATION'){
    // allow page to ask SW to show a notification
    const title = data.title || 'Notificación';
    const options = data.options || {};
    self.registration.showNotification(title, options);
  }
});

function startTimer(){
  if(timer) return;
  // check immediately and every 5 minutes
  const check = ()=>{
    const now = Date.now();
    appointments = ensureArray(appointments);
    appointments.forEach(a=>{
      try{
        const t = new Date(a.dateTime).getTime();
        const diff = t - now;
        // if appointment within next 5 minutes and not yet notified
        if(diff > 0 && diff <= 5*60*1000 && !notified.includes(a.id)){
          // show notification
          const title = `🔔 Cita con ${a.name}`;
          const body = `Tu cita es a las ${new Date(a.dateTime).toLocaleTimeString()}`;
          const options = { body, icon: 'icono192.png', badge: 'icono192.png', data: { id: a.id } };
          self.registration.showNotification(title, options);
          notified.push(a.id);
          // inform clients to play sound if they exist
          self.clients.matchAll({type:'window'}).then(clients=>clients.forEach(c=>c.postMessage({type:'PLAY_ALARM_SOUND'})));
        }
      }catch(e){ console.error('check err', e); }
    });
  };
  check();
  timer = setInterval(check, 5*60*1000);
}

// notification click behavior
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then( cList => {
    for(const c of cList){ if('focus' in c) return c.focus(); }
    return clients.openWindow('/index5.html');
  }));
});