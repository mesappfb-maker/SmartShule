// SmartShule — Service Worker PWA
// Cache offline pour les assets statiques + pages principales
const CACHE_VERSION = 'smartshule-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

// Assets à mettre en cache au démarrage
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Install : précache des ressources essentielles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Erreur precache:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('smartshule-') && name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch : stratégie cache-first pour statique, network-first pour dynamique
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return

  // Ignorer les requêtes d'authentification (sessions, etc.)
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/seed') || url.pathname.startsWith('/api/reset-passwords')) {
    return
  }

  // Cache-first pour les assets statiques
  if (url.origin === location.origin && (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/))) {
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
    return
  }

  // Network-first pour les pages et API
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Si réponse OK, mettre en cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone))
        }
        return response
      })
      .catch(() => {
        // En cas d'échec réseau, essayer le cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Page offline personnalisée pour les navigations
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
      })
  )
})

// Sync en arrière-plan (pour les incidents offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-incidents') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_INCIDENTS' })
        })
      })
    )
  }
})

// Notifications push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'SmartShule'
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
