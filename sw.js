const VERSION = 'v3';
const STATIC_CACHE = `sanabel-static-${VERSION}`;
const RUNTIME_CACHE = `sanabel-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/shop.html',
  '/admin.html',
  OFFLINE_URL,
  '/css/global.css',
  '/css/login.css',
  '/css/shop.css',
  '/css/admin.css',
  '/js/auth.js',
  '/js/shop.js',
  '/js/admin.js',
  '/js/firebase-config.js',
  '/manifest.json'
];

const MAX_RUNTIME_ENTRIES = 60;

// ---------- Install ----------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------- Activate: حذف الكاشات القديمة ----------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ---------- Helpers ----------
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxEntries);
  }
}

// الشبكة أولاً، ثم الكاش (للصفحات)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

// الكاش أولاً مع تحديث بالخلفية (للـ CSS/JS)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// الكاش أولاً (للصور والخطوط)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
    }
    return response;
  } catch (err) {
    return Response.error();
  }
}

// ---------- Fetch ----------
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات غير GET
  if (request.method !== 'GET') return;

  // تجاهل طلبات Firebase/Firestore والـ APIs الخارجية (لازم تكون حية دايماً)
  if (url.origin !== self.location.origin) return;

  // صفحات HTML
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // CSS / JS
  if (['style', 'script'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // صور / خطوط
  if (['image', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // أي شي ثاني
  event.respondWith(networkFirst(request));
});

// ---------- تحديث فوري عند الطلب ----------
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
