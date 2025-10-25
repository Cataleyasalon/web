// service-worker.js

// FORZAR ACTUALIZACI�N
const CACHE_NAME = 'cataleya-cache-v4'; 
const urlsToCache = [
    // La ruta debe ser relativa desde la ra�z del Service Worker
    '/web/', 
    '/web/index5.html', 
    '/web/manifest.json',
    '/web/icono192.png',
    '/web/icono512.png',
    '/web/cabecera.png',
    '/web/alarma.mp3' // Aseg�rate de que este archivo exista
];

// Evento: Instalaci�n (Guardar archivos en el cach�)
self.addEventListener('install', event => {
  console.log('[Service Worker v4] Instalando y precacheando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Fallo al precachear archivos:', error);
      })
  );
  self.skipWaiting(); 
});

// Evento: Fetch (Servir archivos desde el cach�)
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

// Evento: Activaci�n (Limpieza de cach�s viejas)
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
// L�GICA DE ALARMAS EN SEGUNDO PLANO (CADA 30 MINUTOS)
// =======================================================

/** Carga las citas solicitando los datos al cliente (index5.html) */
function loadAppointmentsFromClient() {
    return new Promise((resolve, reject) => {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clientList => {
            
            // Si la p�gina est� completamente cerrada (no hay clientes), devolvemos array vac�o.
            if (clientList.length === 0) {
                console.warn('[SW Alarma] Aplicaci�n cerrada. Saltando verificaci�n.');
                return resolve([]); 
            }
            
            const client = clientList[0];
            const messageChannel = new MessageChannel();
            let timeoutId;

            messageChannel.port1.onmessage = (event) => {
                clearTimeout(timeoutId); // Limpiar timeout al recibir respuesta
                if (event.data.appointments) {
                    resolve(event.data.appointments);
                } else {
                    reject('No se recibieron datos de citas en la respuesta del cliente.');
                }
            };

            // Timeout de 3 segundos para la respuesta del cliente
            timeoutId = setTimeout(() => {
                console.error('[SW Alarma] Tiempo de espera agotado. El cliente no respondi�.');
                // Resolve con array vac�o para que el intervalo contin�e
                resolve([]); 
            }, 3000);

            // Enviamos el comando de petici�n al cliente
            client.postMessage({ command: 'GET_APPOINTMENTS' }, [messageChannel.port2]);
            
        }).catch(reject);
    });
}

/** Verifica las citas pr�ximas y dispara una notificaci�n flotante y sonora */
function checkAndNotifyUpcomingAppointments(appointments) {
    if (!appointments || appointments.length === 0) {
        // No hay citas o no se pudo cargar la data.
        return;
    }
    
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;
    const timeWindowEnd = now + thirtyMinutes;

    const upcomingAppointments = appointments.filter(apt => {
        const aptTime = new Date(apt.dateTime).getTime();
        return aptTime > now && aptTime <= timeWindowEnd;
    }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

    if (upcomingAppointments.length > 0) {
        const title = `?? Cita(s) Pr�xima(s) en 30 minutos`;
        const bodyText = upcomingAppointments.map(apt => {
                const aptDate = new Date(apt.dateTime);
                const timeDisplay = aptDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const minutesLeft = Math.ceil((aptDate.getTime() - now) / 60000);
                return `${apt.name} a las ${timeDisplay} (restan ${minutesLeft} min)`;
            }).join('\n');
            
        const options = {
            body: bodyText,
            icon: '/web/icono192.png', 
            vibrate: [200, 100, 200],
            silent: false, 
            tag: 'upcoming-appointment-reminder', 
            renotify: true,
            // RUTA ABSOLUTA NECESARIA para el sonido en la notificaci�n
            sound: '/web/alarma.mp3' 
        };
        
        console.log('[SW Alarma] Mostrando notificaci�n de citas pr�ximas.');
        self.registration.showNotification(title, options);
    }
}

// 1800000 ms = 30 minutos
const CHECK_INTERVAL = 1800000; 

// Inicializaci�n de la alarma (se ejecutar� cada 30 minutos)
setInterval(() => {
    console.log('[SW Alarma] Ejecutando verificaci�n programada...');
    loadAppointmentsFromClient()
        .then(appointments => checkAndNotifyUpcomingAppointments(appointments))
        .catch(error => console.error('[SW Alarma] Fallo en el chequeo:', error));
}, CHECK_INTERVAL);


// Evento: Mensaje desde el cliente (index5.html)
self.addEventListener('message', event => {
    console.log('[SW] Mensaje recibido del cliente:', event.data.command);
    if (event.data.command === 'WAKE_UP' || event.data.command === 'DATA_UPDATED') {
        // Forzamos una verificaci�n inmediatamente
         loadAppointmentsFromClient()
            .then(appointments => checkAndNotifyUpcomingAppointments(appointments))
            .catch(error => console.error('[SW Alarma] Fallo en el chequeo forzado:', error));
    }
});