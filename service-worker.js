// service-worker.js

const CACHE_NAME = 'cataleya-cache-v13'; // Versión 13 para forzar la actualización y el arreglo de notificaciones
const urlsToCache = [
    // Usamos rutas relativas
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

/**
 * Chequea si alguna cita está entre 30 segundos y 5 minutos a partir de ahora.
 * Dispara la notificación del sistema operativo.
 */
function checkAppointments() {
    console.log('[Service Worker v13] Chequeando citas...');
    const now = Date.now();
    
    // Ventana de activación de la alarma
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const THIRTY_SECONDS_MS = 30 * 1000;

    const timeWindowStart = now + THIRTY_SECONDS_MS; // 30 segundos en el futuro
    const timeWindowEnd = now + FIVE_MINUTES_MS;    // 5 minutos en el futuro

    storedAppointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        
        // 1. Verificar si la cita cae dentro del rango [30s a 5 min]
        if (aptTime >= timeWindowStart && aptTime <= timeWindowEnd) {
            
            // 2. Verificar si ya fue notificada
            if (!notifiedAppointmentIds.includes(apt.id)) {
                
                const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                
                const timeDifference = aptTime - now;
                const minutesLeft = Math.max(1, Math.floor(timeDifference / 60000)); 
                
                const options = {
                    body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan aproximadamente ${minutesLeft} minutos.`,
                    icon: 'icono192.png', 
                    tag: `cita-proxima-${apt.id}`, 
                    sound: 'alarma.mp3', // Este sonido solo funciona en ciertas plataformas (Android/Desktop)
                    vibrate: [200, 100, 200]
                };

                // Mostrar la notificación
                self.registration.showNotification('🚨 ALARMA DE CITA PRÓXIMA 🚨', options)
                    .then(() => console.log(`[Service Worker v13] Notificación mostrada para ${apt.name}`))
                    .catch(e => console.error("[Service Worker v13] Error al mostrar notificación:", e));
                
                // Marcar como notificada
                notifiedAppointmentIds.push(apt.id);
            }
        }
        // Limpiar ID de notificaciones para citas que ya pasaron
        else if (aptTime < now && notifiedAppointmentIds.includes(apt.id)) {
             notifiedAppointmentIds = notifiedAppointmentIds.filter(id => id !== apt.id);
        }
    });
}

/**
 * Inicia el chequeo de citas cada 30 segundos (30000 ms) para mayor fiabilidad.
 */
function startAlarmTimer() {
    if (alarmInterval) { clearInterval(alarmInterval); } 
    
    checkAppointments(); 
    alarmInterval = setInterval(checkAppointments, 30000); 
    console.log('[Service Worker v13] Temporizador de alarma iniciado (cada 30 segundos).');
}

// =======================================================
// MANEJO DE EVENTOS ESTÁNDAR DEL SW 
// =======================================================

// Evento: Instalación (Precacheo)
self.addEventListener('install', event => {
  console.log('[Service Worker v13] Instalando y precacheando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(error => console.error('Fallo al precachear archivos:', error))
  );
  self.skipWaiting(); 
});

// Evento: Activación (Limpieza de cachés viejas e inicio de alarma)
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
        .then(startAlarmTimer) // Iniciar alarma al activar
    );
});

// Evento: Fetch (Servir desde caché o red)
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
        
        // Resetear la lista de notificados para re-evaluar si la cita se modificó
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker v13] Citas actualizadas. Total: ${storedAppointments.length}`);
        
        // Chequear inmediatamente
        checkAppointments();
    }
});