// Service Worker v26
const CACHE_NAME = 'cataleya-cache-v26';
const urlsToCache = ['./index5.html','./manifest.json','./icono192.png','./icono512.png','./cabecera.png','./alarma.mp3'];
let appointments=[];let notifiedAppointmentIds=[];let alarmInterval=null;
function checkAppointments(){
  const now=Date.now(),FIVE=5*60*1000;
  appointments.forEach(a=>{
    const t=new Date(a.dateTime).getTime(),d=t-now;
    if(d>0&&d<=FIVE&&!notifiedAppointmentIds.includes(a.id)){
      self.registration.showNotification('🔔 Cita próxima',{
        body:`Cita con ${a.name} en ${Math.ceil(d/60000)} min.`,
        icon:'./icono192.png',badge:'./icono192.png'
      });
      notifiedAppointmentIds.push(a.id);
      self.clients.matchAll({type:'window'}).then(c=>c.forEach(cl=>cl.postMessage({type:'PLAY_ALARM_SOUND'})));
    }
  });
}
function startAlarmTimer(){if(alarmInterval)clearInterval(alarmInterval);checkAppointments();alarmInterval=setInterval(checkAppointments,5*60*1000);}
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(urlsToCache)));self.skipWaiting();});
self.addEventListener('activate',e=>{const w=[CACHE_NAME];e.waitUntil(caches.keys().then(n=>Promise.all(n.map(x=>!w.includes(x)&&caches.delete(x))))).then(()=>self.clients.claim()).then(startAlarmTimer));});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='UPDATE_APPOINTMENTS'){appointments=e.data.appointments;notifiedAppointmentIds=[];checkAppointments();}});
