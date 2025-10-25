// service-worker.js

const CACHE_NAME = 'cataleya-cache-v5'; // Versi�n 5 para forzar la actualizaci�n
const urlsToCache = [
    // La ruta debe ser relativa desde la ra�z del Service Worker
    '/web/', 
    '/web/index5.html', 
    '/web/manifest.json',
    '/web/icono192.png',
    '/web/icono512.png',
    '/web/cabecera.png',
    '/web/alarma.mp3' // Se agrega el sonido a la cach�
];

// ?? Nueva variable para almacenar las citas recibidas del cliente
let storedAppointments = [];
// ?? Nueva lista para rastrear qu� citas ya fueron notificadas en esta sesi�n del SW
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
                    icon: '/web/icono192.png', // Icono de la PWA
                    tag: `cita-proxima-${apt.id}`, // Evita que se muestren m�ltiples notificaciones por la misma cita
                    // El par�metro 'sound' solo funciona en algunos sistemas operativos (Android, Firefox).
                    // Para Chrome de escritorio, el sonido depender� de la configuraci�n del sistema.
                    sound: '/web/alarma.mp3', 
                    vibrate: [200, 100, 200]
                };

                // Mostrar la notificaci�n
                self.registration.showNotification('?? ALARMA DE CITA PR�XIMA ??', options);
                
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
// MANEJO DE EVENTOS EST�NDAR DEL SW
// =======================================================

// Evento: Instalaci�n
self.addEventListener('install', event => {
  console.log('[Service Worker v5] Instalando y precacheando...');
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
        // CR�TICO: Iniciar el temporizador al activar el SW.
        .then(startAlarmTimer) 
    );
});

// Evento: Fetch (Servir archivos desde el cach�)
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
        // fue agendada justo para los pr�ximos 30 minutos.
        notifiedAppointmentIds = []; 
        console.log(`[Service Worker] Citas actualizadas. Total: ${storedAppointments.length}`);
        
        // Ejecutar chequeo inmediatamente despu�s de la actualizaci�n
        checkAppointments();
    }
});