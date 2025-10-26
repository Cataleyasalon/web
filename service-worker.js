// service-worker.js

// ?? CR�TICO: Nueva versi�n para forzar la actualizaci�n y limpieza total del cach�
const CACHE_NAME = 'cataleya-cache-v25'; 
const urlsToCache = [
    // Usamos rutas relativas (ajuste la ruta si su carpeta 'web' es el inicio)
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
// L�GICA DE ALARMA EN SEGUNDO PLANO
// =======================================================

/**
 * Chequea si alguna cita es en menos de 5 minutos y dispara la notificaci�n.
 */
function checkAppointments() {
    console.log('[Service Worker v25] Chequeando citas...');
    const now = Date.now();
    
    // Ventana de activaci�n de la alarma (Hasta 5 minutos en el futuro)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    appointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        const timeDifference = aptTime - now;
        
        // 1. Verificar si la cita es futura y est� dentro de 5 minutos
        if (timeDifference > 0 && timeDifference <= FIVE_MINUTES_MS && !notifiedAppointmentIds.includes(apt.id)) {
            
            const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const minutesLeft = Math.max(1, Math.ceil(timeDifference / 60000)); 
            
            const options = {
                body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan ${minutesLeft} minutos.`,
                icon: './icono192.png', // Usar rutas relativas al SW
                badge: './icono192.png', 
                sound: './alarma.mp3', 
                vibrate: [200, 100, 200],
                tag: `cita-proxima-${apt.id}`
            };

            // Mostrar la notificaci�n
            self.registration.showNotification('?? ALARMA DE CITA PR�XIMA ??', options)
                .then(() => console.log(`[Service Worker v25] Notificaci�n mostrada para ${apt.name}`))
                .catch(e => console.error("[Service Worker v25] Error al mostrar notificaci�n:", e));
            
            // Marcar como notificada
            notifiedAppointmentIds.push(apt.id);
            
            // Avisar a la app si est� abierta para que reproduzca el sonido
            self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => client.postMessage({ type: 'PLAY_ALARM_SOUND' }));
            });
        }
        // Limpiar IDs de notificaciones pasadas
        else if (timeDifference < 0 && notifiedAppointmentIds.includes(apt.id)) {
             notifiedAppointmentIds = notifiedAppointmentIds.filter(id => id !== apt.id);
        }
    });
}

/**
 * Inicia el chequeo de citas cada 30 segundos (30000 ms)
 */
function startAlarmTimer() {
    if (alarmInterval) { clearInterval(alarmInterval); } 
    
    checkAppointments(); 
    alarmInterval = setInterval(checkAppointments, 30000); 
    console.log('[Service Worker v25] Temporizador de alarma iniciado (cada 30 segundos).');
}

// =======================================================
// MANEJO DE EVENTOS EST�NDAR DEL SW (Cacheo)
// =======================================================

// Evento: Instalaci�n (Precacheo)
self.addEventListener('install', event => {
  console.log('[Service Worker v25] Instalando y precacheando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(error => console.error('Fallo al precachear archivos:', error))
  );
  self.skipWaiting(); 
});

// Evento: Activaci�n (Limpieza de cach�s viejas e inicio de alarma)
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                // Elimina todos los cach�s que no sean v25
                if (cacheWhitelist.indexOf(cacheName) === -1) {
                    console.log(`[Service Worker v25] Eliminando cach� antigua: ${cacheName}`);
                    return caches.delete(cacheName);
                }
            })
        )).then(() => self.clients.claim())
        .then(startAlarmTimer) // Iniciar alarma al activar
    );
});

// Evento: Fetch (Servir desde cach� o red)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Evento: Message (Recibir citas del cliente)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_APPOINTMENTS') {
        appointments = event.data.appointments;
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker v25] Citas actualizadas. Total: ${appointments.length}`);
        checkAppointments();
    }
});