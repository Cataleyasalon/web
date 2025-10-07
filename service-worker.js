// service-worker.js

const CACHE_NAME = 'cataleya-cache-v2'; // Cambiado a v2 para forzar la actualización
const urlsToCache = [
    // La raíz de tu aplicación web (el scope)
    './', 
    // Archivos principales: usa rutas relativas
    'index5.html', 
    'manifest.json',
    'icono192x192.png',
    'icono512x512.png',
    'cabecera.png' // Archivo de logo
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
        })
    );
    self.clients.claim();
});