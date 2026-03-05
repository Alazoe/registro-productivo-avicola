// sw.js — Service Worker para Registro Productivo Avícola
const CACHE_NAME = 'avicola-v1';
const ASSETS = [
  '/registro/',
  '/registro/index.html',
  '/registro/manifest.json',
  '/registro/icons/icon-192.png',
  '/registro/icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Instalación: cachear todos los assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación: limpiar cachés viejos
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first para assets, network-first para API
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Llamadas al backend de Apps Script: siempre red, sin cachear
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(JSON.stringify({ exito: false, mensaje: 'Sin conexión' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Assets locales: cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        // Cachear respuestas exitosas
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
