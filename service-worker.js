/// service-worker.js

const CACHE_NAME = 'cataleya-cache-v6'; // Versi�n 6 para forzar la actualizaci�n
const urlsToCache = [
    // La ruta debe ser relativa desde la ra�z del Service Worker
    './', // Ruta ra�z para el Service Worker
    'index5.html', 
    'manifest.json',
    'icono192.png',
    'icono512.png',
    'cabecera.png',
    'alarma.mp3' 
];

// ?? Nueva variable para almacenar las citas recibidas del cliente
let storedAppointments = [];
// ?? Nueva lista para rastrear qu� citas ya fueron notificadas
let notifiedAppointmentIds = []; 
let alarmInterval = null;

// =======================================================
// L�GICA DE ALARMA EN SEGUNDO PLANO
// =======================================================

/**
 * Chequea si alguna cita est� entre 0 y 30 minutos a partir de ahora.
 * Dispara la notificaci�n del sistema operativo.
 */
function checkAppointments() {
    console.log('[Service Worker v6] Chequeando citas...');
    const now = Date.now();
    // Ventana: entre 0 y 30 minutos (1.8 millones de milisegundos)
    const thirtyMinutes = 30 * 60 * 1000;
    const timeWindowEnd = now + thirtyMinutes;

    storedAppointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        
        // 1. Verificar si la cita est� dentro de la ventana (0 a 30 minutos)
        if (aptTime > now && aptTime <= timeWindowEnd) {
            
            // 2. Verificar si ya fue notificada en esta sesi�n del Service Worker
            if (!notifiedAppointmentIds.includes(apt.id)) {
                
                const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const minutesLeft = Math.ceil((aptTime - now) / 60000);

                const options = {
                    body: `La cita con ${apt.name} es a las ${timeDisplay}. Quedan ${minutesLeft} minutos.`,
                    icon: 'icono192.png', // Ajustado a ruta relativa al SW
                    tag: `cita-proxima-${apt.id}`, 
                    sound: 'alarma.mp3', // Ajustado a ruta relativa al SW
                    vibrate: [200, 100, 200]
                };

                // Mostrar la notificaci�n
                self.registration.showNotification('?? ALARMA DE CITA PR�XIMA ??', options)
                    .then(() => console.log(`[Service Worker v6] Notificaci�n mostrada para ${apt.name}`))
                    .catch(e => console.error("[Service Worker v6] Error al mostrar notificaci�n:", e));
                
                // Marcar como notificada
                notifiedAppointmentIds.push(apt.id);
            }
        }
    });
}

/**
 * Inicia el chequeo de citas cada 30 segundos.
 */
function startAlarmTimer() {
    if (alarmInterval) { clearInterval(alarmInterval); } 
    
    checkAppointments(); 
    alarmInterval = setInterval(checkAppointments, 30000); 
    console.log('[Service Worker v6] Temporizador de alarma iniciado (cada 30s).');
}

// =======================================================
// MANEJO DE EVENTOS EST�NDAR DEL SW
// =======================================================

// Evento: Instalaci�n
self.addEventListener('install', event => {
  console.log('[Service Worker v6] Instalando y precacheando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(error => console.error('Fallo al precachear archivos:', error))
  );
  self.skipWaiting(); 
});

// Evento: Activaci�n
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheWhitelist.indexOf(cacheName) === -1) {
                    return caches.delete(cacheName);
                }
            })
        )).then(() => self.clients.claim())
        .then(startAlarmTimer) 
    );
});

// Evento: Fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Evento: Message (Recibir citas del cliente)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_APPOINTMENTS') {
        storedAppointments = event.data.appointments;
        
        // Al recibir nuevas citas, reseteamos la lista de notificados
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker] Citas actualizadas. Total: ${storedAppointments.length}`);
        
        checkAppointments();
    }
});