/**
 * sw.js — Service Worker v3 — TamalitosAPP
 *
 * Estrategia: Cache-First para el app shell + Stale-While-Revalidate
 * para mantener los assets actualizados en segundo plano.
 *
 * Cambios respecto a versiones anteriores:
 *  - Nombre de caché actualizado a 'tamalitos-v3'
 *  - ASSETS_TO_CACHE actualizado con la nueva estructura SPA
 *  - Módulos ES6 incluidos en el precacheo
 */

const CACHE_NAME = 'tamalitos-v4';

// Recursos del app shell que se precachean en la instalación.
// El SW debe poder servir la app completa sin ninguna petición a la red.
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',

  // CSS Design System
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/views.css',

  // JS — Core
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/db.js',
  './js/utils.js',
  './js/gestures.js',

  // JS — Components
  './js/components/toast.js',
  './js/components/modal.js',
  './js/components/swipe-item.js',

  // JS — Views
  './js/views/home.js',
  './js/views/pos.js',
  './js/views/historial.js',
  './js/views/insumos-hub.js',
  './js/views/insumos.js',
  './js/views/costos.js',
  './js/views/config.js',
  './js/views/productos.js',

  // Iconos
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

// ══════════════════════════════════════════════════════════
// INSTALL — Precacheo del App Shell
// ══════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
  console.log('[SW v3] Instalando y precacheando app shell...');
  self.skipWaiting(); // No esperar a que se cierren pestañas anteriores

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Agregar recursos uno por uno para identificar fallos específicos
      const resultados = await Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW v3] No se pudo cachear: ${url}`, err.message);
          })
        )
      );

      const ok     = resultados.filter(r => r.status === 'fulfilled').length;
      const fallos = resultados.filter(r => r.status === 'rejected').length;
      console.log(`[SW v3] Precacheo: ${ok} ok, ${fallos} fallos.`);
    })
  );
});

// ══════════════════════════════════════════════════════════
// ACTIVATE — Limpieza de versiones anteriores
// ══════════════════════════════════════════════════════════

self.addEventListener('activate', (event) => {
  console.log('[SW v3] Activando y limpiando cachés antiguas...');

  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.map((nombre) => {
          if (nombre !== CACHE_NAME) {
            console.log('[SW v3] Eliminando caché obsoleta:', nombre);
            return caches.delete(nombre);
          }
        })
      )
    ).then(() => {
      console.log('[SW v3] Reclamando control de clientes activos.');
      return self.clients.claim();
    })
  );
});

// ══════════════════════════════════════════════════════════
// FETCH — Cache-First + Stale-While-Revalidate
// ══════════════════════════════════════════════════════════

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptar GET y URLs http(s) — ignorar chrome-extension, etc.
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  // Ignorar peticiones a otros orígenes (APIs externas, analytics, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {

      // ── Cache-First: si existe en caché, devolver inmediatamente ──
      if (cachedResponse) {
        // Stale-While-Revalidate: actualizar en segundo plano si hay red
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse?.ok) {
              caches.open(CACHE_NAME).then(cache =>
                cache.put(request, networkResponse)
              );
            }
          })
          .catch(() => { /* sin red — no pasa nada, ya devolvimos la caché */ });

        return cachedResponse;
      }

      // ── Network-First: recurso no cacheado, intentar la red ──
      return fetch(request)
        .then((networkResponse) => {
          // Guardar en caché solo respuestas válidas del mismo origen
          if (networkResponse?.ok && networkResponse.type === 'basic') {
            const toCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, toCache)
            );
          }
          return networkResponse;
        })
        .catch(() => {
          // ── Offline Fallback ──
          // Si es una petición de navegación, servir index.html del caché
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          // Para otros recursos, no hay fallback disponible
        });
    })
  );
});

