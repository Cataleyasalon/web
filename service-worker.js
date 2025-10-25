// service-worker.js

const CACHE_NAME = 'cataleya-cache-v5'; // Versión 5 para forzar la actualización
const urlsToCache = [
    // La ruta debe ser relativa desde la raíz del Service Worker
    '/web/', 
    '/web/index5.html', 
    '/web/manifest.json',
    '/web/icono192.png',
    '/web/icono512.png',
    '/web/cabecera.png',
    '/web/alarma.mp3' // Se agrega el sonido a la caché
];

// ?? Nueva variable para almacenar las citas recibidas del cliente
let storedAppointments = [];
// ?? Nueva lista para rastrear qué citas ya fueron notificadas en esta sesión del SW
let notifiedAppointmentIds = []; 
let alarmInterval = null;

// =======================================================
// LÓGICA DE ALARMA EN SEGUNDO PLANO
// =======================================================

/**
 * Chequea si alguna cita está entre 0 y 30 minutos a partir de ahora.
 * Dispara la notificación del sistema operativo.
 */
function checkAppointments() {
    const now = Date.now();
    // Ventana: entre 0 y 30 minutos (1.8 millones de milisegundos)
    const thirtyMinutes = 30 * 60 * 1000;
    const timeWindowEnd = now + thirtyMinutes;

    storedAppointments.forEach(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        
        // 1. Verificar si la cita está dentro de la ventana (0 a 30 minutos)
        if (aptTime > now && aptTime <= timeWindowEnd) {
            
            // 2. Verificar si ya fue notificada en esta sesión del Service Worker
            if (!notifiedAppointmentIds.includes(apt.id)) {
                
                const timeDisplay = new Date(apt.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const minutesLeft = Math.ceil((aptTime - now) / 60000);

                const options = {
                    body: `La cita con ${apt.name} es a las ${timeDisplay}. Quedan ${minutesLeft} minutos.`,
                    icon: '/web/icono192.png', // Icono de la PWA
                    tag: `cita-proxima-${apt.id}`, // Evita que se muestren múltiples notificaciones por la misma cita
                    // El parámetro 'sound' solo funciona en algunos sistemas operativos (Android, Firefox).
                    // Para Chrome de escritorio, el sonido dependerá de la configuración del sistema.
                    sound: '/web/alarma.mp3', 
                    vibrate: [200, 100, 200]
                };

                // Mostrar la notificación
                self.registration.showNotification('?? ALARMA DE CITA PRÓXIMA ??', options);
                
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
    // Si ya hay un temporizador activo, lo limpiamos para evitar duplicados
    if (alarmInterval) { clearInterval(alarmInterval); } 
    
    // Ejecutar inmediatamente y luego cada 30 segundos (30000ms)
    checkAppointments(); 
    alarmInterval = setInterval(checkAppointments, 30000); 
    console.log('[Service Worker v5] Temporizador de alarma iniciado (cada 30s).');
}

// =======================================================
// MANEJO DE EVENTOS ESTÁNDAR DEL SW
// =======================================================

// Evento: Instalación
self.addEventListener('install', event => {
  console.log('[Service Worker v5] Instalando y precacheando...');
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
        // CRÍTICO: Iniciar el temporizador al activar el SW.
        .then(startAlarmTimer) 
    );
});

// Evento: Fetch (Servir archivos desde el caché)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// NUEVO Evento: Message (Recibir citas del cliente)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'UPDATE_APPOINTMENTS') {
        storedAppointments = event.data.appointments;
        
        // Reiniciamos la lista de IDs notificados para que la alarma se active si la cita
        // fue agendada justo para los próximos 30 minutos.
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker] Citas actualizadas. Total: ${storedAppointments.length}`);
        
        // Ejecutar chequeo inmediatamente después de la actualización
        checkAppointments();
    }
});