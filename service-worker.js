// Service Worker v29
const CACHE_NAME='cataleya-cache-v29';
const urlsToCache=['./index5.html','./manifest.json','./icono192.png','./icono512.png','./cabecera.png','./alarma.mp3'];
let appointments=[];let notified=[];let timer=null;

function check(){
 const now=Date.now(),FIVE=5*60*1000;
 appointments.forEach(a=>{
  const t=new Date(a.dateTime).getTime(),d=t-now;
  if(d>0&&d<=FIVE&&!notified.includes(a.id)){
    self.registration.showNotification('🔔 Cita próxima',{
      body:`Cita con ${a.name} en ${Math.ceil(d/60000)} min.`,
      icon:'./icono192.png',badge:'./icono192.png'
    });
    notified.push(a.id);
    self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({type:'PLAY_ALARM_SOUND'})));
  }
 });
}
function startTimer(){if(timer)clearInterval(timer);check();timer=setInterval(check,5*60*1000);}

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(urlsToCache)));self.skipWaiting();});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(n=>Promise.all(n.map(x=>!x.includes(CACHE_NAME)&&caches.delete(x)))));
 e.waitUntil(self.clients.claim());startTimer();
});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data?.type==='UPDATE_APPOINTMENTS'){appointments=e.data.appointments;notified=[];check();}});
