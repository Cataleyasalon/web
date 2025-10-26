// service-worker.js

const CACHE_NAME = 'cataleya-cache-v10'; // Versión 10 para forzar la actualización y corregir el bug
const urlsToCache = [
    // Usamos rutas relativas (se asume que SW está en el mismo directorio que index5.html)
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
    console.log('[Service Worker v10] Chequeando citas...');
    const now = Date.now();
    
    // ?? VENTANA DE ACTIVACIÓN DE LA ALARMA (CRÍTICO):
    // La alarma solo se dispara si la cita está entre 5 minutos y 30 segundos de distancia.
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const THIRTY_SECONDS_MS = 30 * 1000;

    // Define los límites de la ventana de tiempo para la notificación
    const timeWindowStart = now + THIRTY_SECONDS_MS; // Alarma si faltan > 30s
    const timeWindowEnd = now + FIVE_MINUTES_MS;    // Alarma si faltan < 5 min

    storedAppointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        
        // 1. Verificar si la cita cae dentro del rango [30s a 5 min]
        if (aptTime >= timeWindowStart && aptTime <= timeWindowEnd) {
            
            // 2. Verificar si ya fue notificada
            if (!notifiedAppointmentIds.includes(apt.id)) {
                
                const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                
                // Calcular los minutos restantes (usado en el mensaje)
                const timeDifference = aptTime - now;
                const minutesLeft = Math.max(1, Math.floor(timeDifference / 60000)); // Asegura que el mínimo sea 1
                
                const options = {
                    body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan aproximadamente ${minutesLeft} minutos.`,
                    icon: 'icono192.png', 
                    tag: `cita-proxima-${apt.id}`, 
                    sound: 'alarma.mp3', 
                    vibrate: [200, 100, 200]
                };

                // Mostrar la notificación
                self.registration.showNotification('?? ALARMA DE CITA PRÓXIMA ??', options)
                    .then(() => console.log(`[Service Worker v10] Notificación mostrada para ${apt.name}`))
                    .catch(e => console.error("[Service Worker v10] Error al mostrar notificación:", e));
                
                // Marcar como notificada
                notifiedAppointmentIds.push(apt.id);
            }
        }
        // Opcional: Limpiar ID de notificaciones para citas que ya pasaron
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
    // Intervalo de chequeo de 30 segundos
    alarmInterval = setInterval(checkAppointments, 30000); 
    console.log('[Service Worker v10] Temporizador de alarma iniciado (cada 30 segundos).');
}

// =======================================================
// MANEJO DE EVENTOS ESTÁNDAR DEL SW 
// =======================================================

// Evento: Instalación
self.addEventListener('install', event => {
  console.log('[Service Worker v10] Instalando y precacheando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(error => console.error('Fallo al precachear archivos:', error))
  );
  self.skipWaiting(); 
});

// Evento: Activación
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
        
        // Al recibir nuevas citas, se resetea la lista de notificados
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker] Citas actualizadas. Total: ${storedAppointments.length}`);
        
        // Se chequea inmediatamente por si la cita es en menos de 5 minutos.
        checkAppointments();
    }
});