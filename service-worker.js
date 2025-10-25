// service-worker.js

// IMPORTANTE: Cambia la versión del caché a v3 para forzar al navegador a actualizar
const CACHE_NAME = 'cataleya-cache-v3'; 
const urlsToCache = [
    // La raíz de tu aplicación web (el scope)
    '/web/', 
    // Archivos principales: usa rutas relativas
    '/web/index5.html', 
    '/web/manifest.json',
    '/web/icono192.png',
    '/web/icono512.png',
    '/web/cabecera.png', // Archivo de logo
    '/web/alarma.mp3' // <-- NUEVO: Asegúrate de que este archivo exista
];

// Evento: Instalación (Guardar archivos en el caché)
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando y precacheando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Fallo al precachear archivos:', error);
      })
  );
  self.skipWaiting(); // Para que se active de inmediato
});

// Evento: Fetch (Servir archivos desde el caché)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Evento: Activación (Limpieza de cachés viejas)
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});


// =======================================================
// LÓGICA DE ALARMAS EN SEGUNDO PLANO (CADA 30 MINUTOS)
// =======================================================

/** Carga las citas solicitando los datos al cliente (index5.html) */
function loadAppointmentsFromClient() {
    return new Promise((resolve, reject) => {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clientList => {
            if (clientList.length > 0) {
                const client = clientList[0];
                const messageChannel = new MessageChannel();

                messageChannel.port1.onmessage = (event) => {
                    if (event.data.appointments) {
                        resolve(event.data.appointments);
                    } else {
                        reject('No se recibieron datos de citas.');
                    }
                };

                // Enviamos el comando de petición y el puerto para la respuesta
                client.postMessage({ command: 'GET_APPOINTMENTS' }, [messageChannel.port2]);

                // Timeout para evitar esperas infinitas si la comunicación falla
                setTimeout(() => reject('Tiempo de espera agotado para obtener citas.'), 3000);

            } else {
                // Si no hay clientes abiertos (la app está realmente cerrada), devolvemos array vacío.
                // En este escenario, la notificación NO funcionará ya que no hay forma de leer localStorage.
                // (Para que funcione, se requeriría que la app usara IndexedDB, accesible por el SW)
                console.warn('[SW Alarma] Aplicación cerrada. No se puede acceder a citas de localStorage.');
                resolve([]); 
            }
        }).catch(reject);
    });
}

/** Verifica las citas próximas y dispara una notificación flotante y sonora */
function checkAndNotifyUpcomingAppointments(appointments) {
    if (!appointments || appointments.length === 0) {
        console.log('[SW Alarma] No hay citas para verificar.');
        return;
    }
    
    const now = Date.now();
    // 30 minutos en milisegundos
    const thirtyMinutes = 30 * 60 * 1000;
    const timeWindowEnd = now + thirtyMinutes;

    const upcomingAppointments = appointments.filter(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        return aptTime > now && aptTime <= timeWindowEnd;
    });

    if (upcomingAppointments.length > 0) {
        const title = `🚨 Cita(s) Próxima(s) en 30 minutos`;
        const options = {
            body: upcomingAppointments.map(apt => {
                const aptDate = new Date(apt.dateTime);
                const timeDisplay = aptDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const minutesLeft = Math.ceil((aptDate.getTime() - now) / 60000);
                return `${apt.name} a las ${timeDisplay} (restan ${minutesLeft} min)`;
            }).join('\n'),
            icon: '/web/icono192.png', // Usamos la ruta completa del ícono
            vibrate: [200, 100, 200],
            silent: false, 
            // Usar la ruta del archivo de audio para el sonido de la notificación
            tag: 'upcoming-appointment-reminder', // Previene múltiples notificaciones si se dispara varias veces
            renotify: true,
            sound: '/web/alarma.mp3' // <-- Ruta de la alarma
        };
        
        console.log('[SW Alarma] Mostrando notificación de citas próximas.');
        self.registration.showNotification(title, options);
    }
}

// 1800000 ms = 30 minutos
const CHECK_INTERVAL = 1800000; 

// Inicialización de la alarma (se ejecutará cada 30 minutos)
setInterval(() => {
    console.log('[SW Alarma] Verificando citas próximas...');
    loadAppointmentsFromClient()
        .then(appointments => checkAndNotifyUpcomingAppointments(appointments))
        .catch(error => console.error('[SW Alarma] Error al cargar o verificar citas:', error));
}, CHECK_INTERVAL);


// Evento: Mensaje desde el cliente (index5.html)
self.addEventListener('message', event => {
    console.log('[SW] Mensaje recibido del cliente:', event.data.command);
    // Si el cliente envía 'WAKE_UP' (al abrir la app) o 'DATA_UPDATED' (al agendar/cancelar)
    if (event.data.command === 'WAKE_UP' || event.data.command === 'DATA_UPDATED') {
        // Forzamos una verificación
         loadAppointmentsFromClient()
            .then(appointments => checkAndNotifyUpcomingAppointments(appointments))
            .catch(error => console.error('[SW Alarma] Error al cargar o verificar citas:', error));
    }
});