/* =============================================================
 * کارنما — Service Worker (اجرای اپ روی گوشی / حالت آفلاین)
 * استراتژی: شبکه-اول، کش به‌عنوان جایگزین — کد همیشه تازه است
 * و اگر سرور در دسترس نبود، برنامه از کش باز می‌شود.
 * نکته: مسیرهای /api/ (داده‌ها) هرگز کش نمی‌شوند.
 * ============================================================= */
'use strict';

const CACHE_NAME = 'karnama-v8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/dashboard.css',
  './css/forms.css',
  './css/responsive.css',
  './js/lib/chart.umd.js',
  './js/lib/xlsx.bundle.js',
  './js/jalali.js',
  './js/calculations.js',
  './js/db.js',
  './js/disk-sync.js',
  './js/settings.js',
  './js/calendar.js',
  './js/worklog.js',
  './js/dashboard.js',
  './js/reports.js',
  './js/export-excel.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/fonts/Vazirmatn-Regular.woff2',
  './assets/fonts/Vazirmatn-Medium.woff2',
  './assets/fonts/Vazirmatn-SemiBold.woff2',
  './assets/fonts/Vazirmatn-Bold.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        /* addAll همه‌یا-هیچ است؛ فونت‌ها را جدا اضافه می‌کنیم که خطای یکی همه را نشکند */
        return Promise.all(APP_SHELL.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* نادیده */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* داده‌ها و API هرگز کش نمی‌شوند */
  if (url.pathname.indexOf('/api/') !== -1) return; /* مستثنی از کش — حتی در نصب زیرپوشه‌ای */
  /* فقط هم‌مبدأ */
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy).catch(function () { /* نادیده */ });
          }).catch(function () { /* نادیده */ });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          /* مسیرهای صفحه → index.html */
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return Response.error();
        });
      })
  );
});
