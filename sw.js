// sw.js - Service Worker robusto para Offline PWA (compatible con iOS WebKit / Safari)
const CACHE_NAME = 'offline-pwa-v2';

// Recursos esenciales para la app shell offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon.svg'
];

// 1. Instalación: Precacheo de la app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versión:', CACHE_NAME);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Precacheando recursos esenciales...');
      await cache.addAll(ASSETS_TO_CACHE);

      // Asegurar coincidencia para "/" y "/index.html"
      const indexRes = await cache.match('./index.html');
      if (indexRes) {
        await cache.put('./', indexRes.clone());
      }
      console.log('[SW] Precacheo exitoso completado.');
    }).catch((error) => {
      console.error('[SW] Error en precacheo:', error);
    })
  );
});

// 2. Activación: Limpieza de versiones viejas de caché y toma de control inmediata
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando nueva versión...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando caché previa:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Clientes reclamados.');
      return self.clients.claim();
    })
  );
});

// 3. Fetch: Estrategia robusta Offline First para navegación y Cache First con Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Filtrar peticiones no soportadas
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Manejo de Navegación (HTML de la app)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Primero buscar en caché si existe coincidencia exacta
          const cachedExact = await caches.match(request);
          if (cachedExact) {
            // Actualizar en segundo plano si hay red disponible
            fetch(request).then(async (netRes) => {
              if (netRes && netRes.ok) {
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, netRes);
              }
            }).catch(() => {});
            return cachedExact;
          }

          // Si hay red, intentar obtener de la red
          const netRes = await fetch(request);
          if (netRes && netRes.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, netRes.clone());
            return netRes;
          }

          // Si la red no devuelve OK, fallback al index en caché
          const cachedFallback = await caches.match('./index.html') || await caches.match('./');
          if (cachedFallback) return cachedFallback;

          return netRes;
        } catch (error) {
          // Modo Offline (sin conexión a internet): entregar siempre index.html
          console.log('[SW] Modo offline: entregando index.html precacheado');
          const fallback = await caches.match('./index.html') || await caches.match('./');
          if (fallback) {
            return fallback;
          }
          throw error;
        }
      })()
    );
    return;
  }

  // Manejo de Recursos estáticos (imágenes, json, scripts, css)
  event.respondWith(
    (async () => {
      // 1. Intentar desde caché
      const cached = await caches.match(request);
      if (cached) {
        // Revalidar en segundo plano
        fetch(request).then(async (netRes) => {
          if (netRes && netRes.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, netRes);
          }
        }).catch(() => {});
        return cached;
      }

      // 2. Si no está en caché, buscar en red y guardar
      try {
        const netRes = await fetch(request);
        if (netRes && netRes.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, netRes.clone());
        }
        return netRes;
      } catch (err) {
        // En caso de fallo total, si era una imagen o icono, devolver lo que haya
        return cached;
      }
    })()
  );
});
