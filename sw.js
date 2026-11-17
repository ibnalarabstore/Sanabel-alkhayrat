const CACHE_NAME = 'sanabel-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/shop.html',
  '/admin.html',
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

// تثبيت الكاش
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// استخدام الكاش وقت ما يكون في نت
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا الملف موجود بالكاش، رجعه
        if (response) {
          return response;
        }
        // إذا لأ، جيبه من النت
        return fetch(event.request);
      })
  );
});
