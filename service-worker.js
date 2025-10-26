// service-worker.js

const CACHE_NAME = 'cataleya-cache-v26';
const urlsToCache = [
    './index5.html',
    './manifest.json',
    './icono192.png',
    './icono512.png',
    './cabecera.png',
    './alarma.mp3'
];

let appointments = [];
let notifiedAppointmentIds = [];
let alarmInterval = null;

// =======================================================
// LÓGICA DE ALARMA EN SEGUNDO PLANO
// =======================================================

function checkAppointments() {
    console.log('[Service Worker v26] Chequeando citas...');
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    appointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        const timeDifference = aptTime - now;

        if (timeDifference > 0 && timeDifference <= FIVE_MINUTES_MS && !notifiedAppointmentIds.includes(apt.id)) {
            const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const minutesLeft = Math.max(1, Math.ceil(timeDifference / 60000));
            
            const options = {
                body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan ${minutesLeft} minutos.`,
                icon: './icono192.png',
                badge: './icono192.png',
                vibrate: [200, 100, 200],
                tag: `cita-proxima-${apt.id}`
            };

            self.registration.showNotification('🔔 Cita próxima', options)
                .then(() => console.log(`[Service Worker v26] Notificación mostrada para ${apt.name}`))
                .catch(e => console.error("[Service Worker v26] Error al mostrar notificación:", e));

            notifiedAppointmentIds.push(apt.id);

            self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.postMessage({ type: 'PLAY_ALARM_SOUND' }));
            });
        } else if (timeDifference < 0 && notifiedAppointmentIds.includes(apt.id)) {
            notifiedAppointmentIds = notifiedAppointmentIds.filter(id => id !== apt.id);
        }
    });
}

function startAlarmTimer() {
    if (alarmInterval) clearInterval(alarmInterval);
    checkAppointments();
    alarmInterval = setInterval(checkAppointments, 5 * 60 * 1000);
    console.log('[Service Worker v26] Temporizador de alarma iniciado (cada 5 minutos).');
}

// =======================================================
// EVENTOS ESTÁNDAR DEL SERVICE WORKER
// =======================================================

self.addEventListener('install', event => {
    console.log('[Service Worker v26] Instalando y precacheando...');
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
                    console.log(`[Service Worker v26] Eliminando caché antigua: ${cacheName}`);
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
        appointments = event.data.appointments;
        notifiedAppointmentIds = [];
        console.log(`[Service Worker v26] Citas actualizadas. Total: ${appointments.length}`);
        checkAppointments();
    }
});
