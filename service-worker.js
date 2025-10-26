// service-worker.js

const CACHE_NAME = 'cataleya-cache-v12'; // Nueva versión para refrescar cache
const urlsToCache = [
    './',
    'index5.html',
    'manifest.json',
    'icono192.png',
    'icono512.png',
    'cabecera.png',
    'alarma.mp3'
];

let storedAppointments = [];
let notifiedAppointmentIds = [];
let alarmInterval = null;

// =======================================================
// LÓGICA DE ALARMA EN SEGUNDO PLANO
// =======================================================
function checkAppointments() {
    console.log('[Service Worker v12] Chequeando citas...');
    const now = Date.now();

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const THIRTY_SECONDS_MS = 30 * 1000;
    const timeWindowStart = now + THIRTY_SECONDS_MS;
    const timeWindowEnd = now + FIVE_MINUTES_MS;

    storedAppointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();

        if (aptTime >= timeWindowStart && aptTime <= timeWindowEnd) {
            if (!notifiedAppointmentIds.includes(apt.id)) {
                const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const minutesLeft = Math.max(1, Math.floor((aptTime - now) / 60000));

                const options = {
                    body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan ${minutesLeft} minutos.`,
                    icon: 'icono192.png',
                    tag: `cita-proxima-${apt.id}`,
                    vibrate: [200, 100, 200]
                };

                self.registration.showNotification('?? ALARMA DE CITA PRÓXIMA ??', options)
                    .then(() => console.log(`[Service Worker v12] Notificación mostrada para ${apt.name}`))
                    .catch(e => console.error("[Service Worker v12] Error al mostrar notificación:", e));

                // Reproducir sonido local (en la app activa)
                self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
                    for (const client of clients) {
                        client.postMessage({ type: 'PLAY_ALARM_SOUND' });
                    }
                });

                notifiedAppointmentIds.push(apt.id);
            }
        } else if (aptTime < now && notifiedAppointmentIds.includes(apt.id)) {
            notifiedAppointmentIds = notifiedAppointmentIds.filter(id => id !== apt.id);
        }
    });
}

function startAlarmTimer() {
    if (alarmInterval) clearInterval(alarmInterval);
    checkAppointments();
    alarmInterval = setInterval(checkAppointments, 30000);
    console.log('[Service Worker v12] Temporizador de alarma iniciado (cada 30 segundos).');
}

// =======================================================
// EVENTOS ESTÁNDAR DEL SERVICE WORKER
// =======================================================
self.addEventListener('install', event => {
    console.log('[Service Worker v12] Instalando y precacheando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (!cacheWhitelist.includes(cacheName)) {
                    return caches.delete(cacheName);
                }
            })
        )).then(() => self.clients.claim())
        .then(startAlarmTimer)
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_APPOINTMENTS') {
        storedAppointments = event.data.appointments || [];
        notifiedAppointmentIds = [];
        console.log(`[Service Worker] Citas actualizadas. Total: ${storedAppointments.length}`);
        checkAppointments();
    }
});
