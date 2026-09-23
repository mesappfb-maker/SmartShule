// SmartShule — Service Worker PWA (version safe — n'interfère pas avec la navigation)
// ============================================================
// NE PAS intercepter les requêtes de navigation (pages)
// Uniquement cacher les assets statiques (_next/static, images, fonts)

const CACHE_VERSION = 'smartshule-v2'
const STATIC_CACHE = `${CACHE_VERSION}-static`

const PRECACHE_URLS = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('smartshule-') && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// IMPORTANT : Ne JAMAIS intercepter les requêtes de navigation
// Laisser le navigateur gérer les pages directement
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Ignorer TOUTES les requêtes de navigation (pages HTML)
  if (request.mode === 'navigate') {
    return
  }

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return
  }

  // Ignorer les API (sessions, login, etc.)
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Cache-first UNIQUEMENT pour les assets statiques
  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone))
          }
          return response
        })
      })
    )
  }
})

// Nettoyer les anciens SW enregistrés
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
