// ========== SERVICE WORKER ==========
// Enables offline support and smart caching

const CACHE_VERSION = 'v1';
const CORE_CACHE = `bioweb3-core-${CACHE_VERSION}`;
const FEATURE_CACHE = `bioweb3-features-${CACHE_VERSION}`;
const API_CACHE = `bioweb3-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `bioweb3-images-${CACHE_VERSION}`;

// Assets to precache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/bio-flags.js',
  './js/bio-utils.js',
  './js/bio-config.js',
  './js/bio-state.js',
  './js/bio-wallet.js',
  './js/bio-profile.js',
  './js/bio-chatbot.js',
  './js/bio-loader.js',
  './features.json',
  './manifest.json',
];

// Install: Precache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => {
      console.log('[SW] Precaching core assets:', PRECACHE_URLS.length, 'files');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed (may not all be available):', err);
        // Don't fail on individual missing files
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith('bioweb3-') &&
              !name.includes(CACHE_VERSION)
            );
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and external sources
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // API calls: Network first, fallback to cache
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // Feature modules: Cache first, fallback to network
  if (url.pathname.includes('/js/bio-') && url.pathname.endsWith('.js')) {
    event.respondWith(cacheFirst(request, FEATURE_CACHE));
    return;
  }

  // Images: Cache first, stale while revalidate
  if (isImage(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // HTML/CSS/Core JS: Stale while revalidate
  if (isCore(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CORE_CACHE));
    return;
  }

  // Default: Network first
  event.respondWith(networkFirst(request, CORE_CACHE, 5000));
});

// ========== CACHING STRATEGIES ==========

async function networkFirst(request, cacheName, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`[SW] Network failed for ${request.url}, trying cache...`);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return errorResponse(err.message);
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.log(`[SW] Cache miss for ${request.url}`);
    return errorResponse(err.message);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || fetchPromise.catch(() => errorResponse('Offline'));
}

// ========== HELPERS ==========

function isCore(pathname) {
  return (
    pathname.endsWith('.html') ||
    pathname.endsWith('.css') ||
    pathname.includes('/lib/') ||
    pathname === '/' ||
    pathname === '/index.html'
  );
}

function isImage(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(pathname);
}

function errorResponse(message) {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: message || 'Service temporarily unavailable',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// ========== MESSAGE HANDLING ==========

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name.startsWith('bioweb3-')) {
            return caches.delete(name);
          }
        })
      );
    });
    console.log('[SW] Cache cleared');
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    cacheSize().then((size) => {
      event.ports[0].postMessage({ size });
    });
  }
});

async function cacheSize() {
  let size = 0;
  for (const cache of await caches.keys()) {
    for (const request of await caches.keys(cache)) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        size += blob.size;
      }
    }
  }
  return size;
}

// ========== SYNC (Background Sync) ==========

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-ledger') {
    event.waitUntil(syncLedger());
  }
});

async function syncLedger() {
  // Sync blockchain ledger when back online
  try {
    const db = await openIndexedDB();
    const pending = await getPendingTransactions(db);
    for (const tx of pending) {
      await submitTransaction(tx);
    }
    console.log('[SW] Ledger synced:', pending.length, 'transactions');
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bioweb3', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

console.log('[SW] Service Worker loaded successfully');
