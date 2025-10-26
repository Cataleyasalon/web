// service-worker.js

const CACHE_NAME = 'cataleya-cache-v22'; // Versión 22 para forzar la actualización
const urlsToCache = [
    // Usamos rutas relativas (asume que SW está en el mismo directorio que los demás archivos)
    './', 
    'index5.html', 
    'manifest.json',
    'icono192.png',
    'icono512.png',
    // cabecera.png ya no es necesario en el caché si se elimina del HTML, pero lo dejamos por si acaso
    'cabecera.png', 
    'alarma.mp3' 
];

let appointments = [];
let notifiedAppointmentIds = []; 
let alarmInterval = null;

// =======================================================
// LÓGICA DE ALARMA EN SEGUNDO PLANO
// =======================================================

/**
 * Chequea si alguna cita es en menos de 5 minutos y dispara la notificación.
 */
function checkAppointments() {
    console.log('[Service Worker v22] Chequeando citas...');
    const now = Date.now();
    
    // Ventana de activación de la alarma (Hasta 5 minutos en el futuro)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    appointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        const timeDifference = aptTime - now;
        
        // 1. Verificar si la cita es futura y está dentro de 5 minutos
        if (timeDifference > 0 && timeDifference <= FIVE_MINUTES_MS && !notifiedAppointmentIds.includes(apt.id)) {
            
            const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            // Calcular minutos restantes, redondeando al siguiente minuto para no decir 0 min.
            const minutesLeft = Math.max(1, Math.ceil(timeDifference / 60000)); 
            
            const options = {
                body: `La cita con ${apt.name} es a las ${timeDisplay}. Faltan ${minutesLeft} minutos.`,
                icon: 'icono192.png', 
                badge: 'icono192.png', 
                sound: 'alarma.mp3', 
                vibrate: [200, 100, 200],
                tag: `cita-proxima-${apt.id}`
            };

            // Mostrar la notificación
            self.registration.showNotification('🚨 ALARMA DE CITA PRÓXIMA 🚨', options)
                .then(() => console.log(`[Service Worker v22] Notificación mostrada para ${apt.name}`))
                .catch(e => console.error("[Service Worker v22] Error al mostrar notificación:", e));
            
            // Marcar como notificada
            notifiedAppointmentIds.push(apt.id);
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
    // Comprueba cada 30 segundos para mayor precisión
    alarmInterval = setInterval(checkAppointments, 30000); 
    console.log('[Service Worker v22] Temporizador de alarma iniciado (cada 30 segundos).');
}

// =======================================================
// MANEJO DE EVENTOS ESTÁNDAR DEL SW (Cacheo)
// =======================================================

// Evento: Instalación (Precacheo)
self.addEventListener('install', event => {
  console.log('[Service Worker v22] Instalando y precacheando...');
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
        appointments = event.data.appointments;
        notifiedAppointmentIds = []; // Resetear para re-evaluar citas
        console.log(`[Service Worker v22] Citas actualizadas. Total: ${appointments.length}`);
        checkAppointments();
    }
});