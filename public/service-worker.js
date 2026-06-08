// Bump cache name to force clients to install the updated service worker
const CACHE_NAME = 'loavashi-hub-cache-v3';
const ASSETS = ['/', '/index.html', '/manifest.json', '/logo.jpeg'];

console.log('🔧 Service Worker Loading...');

async function safeOpenCache(name) {
  try {
    return await caches.open(name);
  } catch (error) {
    console.warn('Service worker cache open failed:', error);
    return null;
  }
}

async function safeCachePut(cache, request, response) {
  if (!cache) {
    return;
  }

  // Only cache GET requests — cache.put does not support POST/PUT/etc.
  try {
    const method = request && request.method ? request.method.toUpperCase() : 'GET';
    if (method !== 'GET') return;
    await cache.put(request, response);
  } catch (error) {
    console.warn('Service worker cache.put failed:', error);
  }
}

self.addEventListener('install', (event) => {
  console.log('⚙️ Service Worker Installing...');
  event.waitUntil(
    (async () => {
      const cache = await safeOpenCache(CACHE_NAME);

      await Promise.all(
        ASSETS.map(async (asset) => {
          if (!cache) {
            return;
          }

          try {
            const request = new Request(asset, { cache: 'reload' });
            const response = await fetch(request);

            if (response.ok) {
              await safeCachePut(cache, request, response.clone());
              console.log('✅ Cached:', asset);
            } else {
              console.warn('Service worker cache skipped non-ok asset:', asset, response.status);
            }
          } catch (error) {
            console.warn('Service worker cache failed for asset:', asset, error);
          }
        }),
      );

      await self.skipWaiting();
      console.log('✅ Service Worker Installed');
    })(),
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker Activating...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', key);
            return caches.delete(key);
          }
          return null;
        }),
      ),
    ),
  );
  self.clients.claim();
  console.log('✅ Service Worker Activated');
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      try {
        // Try network first for API calls and dynamic content
        if (event.request.url.includes('/api') || event.request.method !== 'GET') {
          try {
            const response = await fetch(event.request);
            if (response && response.status === 200) {
              const cache = await safeOpenCache(CACHE_NAME);
              await safeCachePut(cache, event.request, response.clone());
            }
            return response;
          } catch (error) {
            // Network failed, try cache
            const cached = await caches.match(event.request);
            if (cached) {
              console.log('📦 Using cached response for:', event.request.url);
              return cached;
            }
            throw error;
          }
        }

        // Cache first for static assets
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }

        const response = await fetch(event.request);
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseClone = response.clone();
        const cache = await safeOpenCache(CACHE_NAME);
        await safeCachePut(cache, event.request, responseClone);

        return response;
      } catch (error) {
        console.warn('Service worker fetch failed:', error);
        const cached = await caches.match('/');
        return cached || new Response('Offline - App not available', { status: 503 });
      }
    })(),
  );
});

// Listen for messages from the client to skip waiting
self.addEventListener('message', (event) => {
  try {
    if (!event.data) return;
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch (err) {
    console.warn('Service worker message handler error:', err);
  }
});

