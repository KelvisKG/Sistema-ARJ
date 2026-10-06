// =====================================================================
// Sistema ARJ - Service Worker Offline (PWA)
// Permite que la app cargue y funcione sin conexión a internet
// =====================================================================

const CACHE_NAME = 'arj-pwa-v2'; // subir al cambiar la estrategia: borra cachés viejas

// Recursos críticos a precachear inmediatamente
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/pwa-icon.svg',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.40.0/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// Instalación: Guardar archivos iniciales en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ARJ SW] Precacheando recursos iniciales de la app...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ARJ SW] Algunos recursos remotos no pudieron ser precacheados:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpiar cachés antiguas y tomar control de clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ARJ SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch:
// 1. Navegación (HTML): Network first, fallback a caché
// 2. Assets estáticos (JS, CSS, imágenes, fuentes): Stale-While-Revalidate / Cache First
// 3. Peticiones a Supabase: Directas a red
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar peticiones que no sean GET o que sean de extensiones / supabase / websockets
  if (req.method !== 'GET') return;
  if (url.origin.includes('supabase.co')) return; // Las llamadas a la BD van directo a red
  if (url.protocol === 'chrome-extension:') return;

  // Para navegación a páginas HTML: Network First con fallback a index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Caché primero SOLO para archivos inmutables: los de /assets/ llevan hash en el
  // nombre y las fuentes/iconos externos no cambian. Todo lo demás va a la red
  // primero, para no servir código viejo después de un despliegue.
  const inmutable = url.pathname.startsWith('/assets/') || url.origin !== self.location.origin;
  if (!inmutable) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        // En segundo plano actualizamos la caché si hay red
        fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
            }
          })
          .catch(() => {});
        return cachedRes;
      }

      // Si no está en caché, buscar en red y guardar
      return fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type !== 'opaque') {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          // Si falló y es una imagen/icono, retornar favicon si existe
          if (req.destination === 'image') {
            return caches.match('/favicon.svg');
          }
        });
    })
  );
});
