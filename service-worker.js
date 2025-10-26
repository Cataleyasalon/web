// service-worker v35 - robust background notifications and timer (best-effort)
// It receives appointments via postMessage and will check every 5 minutes
const CACHE_NAME = 'cataleya-v35-cache';
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
      // reset notified list if provided
      notified = [];
    }catch(e){ appointments = []; }
  } else if(data.type === 'SHOW_NOTIFICATION'){
    const title = data.title || 'Notificación';
    const options = data.options || {};
    self.registration.showNotification(title, options);
  } else if(data.type === 'PLAY_ALARM_SOUND'){
    // tell clients to play sound
    self.clients.matchAll({type:'window'}).then(clients=>clients.forEach(c=>c.postMessage({type:'PLAY_ALARM_SOUND'})));
  }
});

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
          const title = `🔔 Cita con ${a.name}`;
          const dateStr = new Date(a.dateTime).toLocaleString('es-ES',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
          const body = `💜 Recuerda tu cita el ${dateStr}`;
          const options = { body, icon: '/icono192.png', badge: '/icono192.png', data:{ id: a.id }, requireInteraction: true };
          self.registration.showNotification(title, options);
          notified.push(a.id);
          // ask clients to play sound if they exist
          self.clients.matchAll({type:'window'}).then(clients=>clients.forEach(c=>c.postMessage({type:'PLAY_ALARM_SOUND'})));
        }
      }catch(e){ console.error('check err', e); }
    });
  };
  check();
  timer = setInterval(check, 5*60*1000);
}

self.addEventListener('notificationclick', event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then( cList => {
    for(const c of cList){ if('focus' in c) return c.focus(); }
    return clients.openWindow('/index5.html');
  }));
});