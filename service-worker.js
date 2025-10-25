// service-worker.js

const CACHE_NAME = 'cataleya-cache-v8'; // Versi�n 8 para forzar la actualizaci�n
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

let storedAppointments = [];
let notifiedAppointmentIds = []; 
let alarmInterval = null;

// =======================================================
// L�GICA DE ALARMA EN SEGUNDO PLANO
// =======================================================

/**
 * Chequea si alguna cita est� entre 1 y 3 minutos a partir de ahora.
 * Dispara la notificaci�n del sistema operativo.
 */
function checkAppointments() {
    console.log('[Service Worker v8] Chequeando citas...');
    const now = Date.now();
    
    // ?? VENTANA DE ACTIVACI�N DE LA ALARMA: [3 minutos antes, 1 minuto antes)
    const THREE_MINUTES_MS = 3 * 60 * 1000;
    const ONE_MINUTE_MS = 1 * 60 * 1000;

    storedAppointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        
        // Calcule el inicio y fin de la ventana de activaci�n de la alarma
        // Si 'now' cae en este rango, se dispara la notificaci�n.
        const notificationStartTime = aptTime - THREE_MINUTES_MS; // 3 minutos antes
        const notificationEndTime = aptTime - ONE_MINUTE_MS;     // 1 minuto antes (Excluido)

        // 1. Verificar si el tiempo actual (now) est� dentro de la ventana de activaci�n.
        if (aptTime > now && now >= notificationStartTime && now < notificationEndTime) {
            
            // 2. Verificar si ya fue notificada
            if (!notifiedAppointmentIds.includes(apt.id)) {
                
                const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                
                // Calcular los minutos restantes para el mensaje (deber�a ser 2 o 3)
                const timeDifference = aptTime - now;
                const minutesLeft = Math.ceil(timeDifference / 60000); 
                
                const options = {
                    body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan ${minutesLeft} minutos.`,
                    icon: 'icono192.png', 
                    tag: `cita-proxima-${apt.id}`, 
                    sound: 'alarma.mp3', 
                    vibrate: [200, 100, 200]
                };

                // Mostrar la notificaci�n
                self.registration.showNotification('?? ALARMA DE CITA PR�XIMA ??', options)
                    .then(() => console.log(`[Service Worker v8] Notificaci�n mostrada para ${apt.name}`))
                    .catch(e => console.error("[Service Worker v8] Error al mostrar notificaci�n:", e));
                
                // Marcar como notificada
                notifiedAppointmentIds.push(apt.id);
            }
        }
    });
}

/**
 * Inicia el chequeo de citas cada 2 minutos (120,000 ms).
 */
function startAlarmTimer() {
    if (alarmInterval) { clearInterval(alarmInterval); } 
    
    checkAppointments(); 
    // Mantenemos el chequeo cada 2 minutos (120000 ms)
    alarmInterval = setInterval(checkAppointments, 120000); 
    console.log('[Service Worker v8] Temporizador de alarma iniciado (cada 2 minutos).');
}

// =======================================================
// MANEJO DE EVENTOS EST�NDAR DEL SW (Sin Cambios)
// =======================================================

// Evento: Instalaci�n
self.addEventListener('install', event => {
  console.log('[Service Worker v8] Instalando y precacheando...');
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
        
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker] Citas actualizadas. Total: ${storedAppointments.length}`);
        
        checkAppointments();
    }
});