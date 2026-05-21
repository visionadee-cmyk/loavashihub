const CACHE_NAME = 'loavashi-hub-cache-v1';
const ASSETS = ['/', '/index.html', '/manifest.json', '/logo.jpeg', '/icon.svg', '/favicon.svg'];

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

  try {
    await cache.put(request, response);
  } catch (error) {
    console.warn('Service worker cache.put failed:', error);
  }
}

self.addEventListener('install', (event) => {
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
            } else {
              console.warn('Service worker cache skipped non-ok asset:', asset, response.status);
            }
          } catch (error) {
            console.warn('Service worker cache failed for asset:', asset, error);
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      try {
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
        return caches.match('/');
      }
    })(),
  );
});
