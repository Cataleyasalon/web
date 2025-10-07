const CACHE_NAME = 'cataleya-cache-v1';
const urlsToCache = [
    'https://cataleyasalon.github.io/web/',
    'https://cataleyasalon.github.io/web/index5.html',
    'https://cataleyasalon.github.io/web/manifest.json',
    'https://cataleyasalon.github.io/web/icono192x192.png',
    'https://cataleyasalon.github.io/web/icono512x512.png',
    // Archivo de logo si lo tienes en la misma carpeta
    'https://cataleyasalon.github.io/web/cabecera.png' 
    // Si usas un CDN de Tailwind, el Service Worker NO lo puede guardar
];

// Evento: Instalación (Guardar archivos en el caché)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento: Fetch (Servir archivos desde el caché)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el archivo si está en caché
        if (response) {
          return response;
        }
        // Si no está, lo busca en la red
        return fetch(event.request);
      })
  );
});