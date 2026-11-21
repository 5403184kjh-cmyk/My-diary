/* =========================================================
   sw.js — 오프라인에서도 열리도록 파일을 캐시합니다.
   파일을 수정했다면 CACHE 이름의 숫자를 올려 주세요.
   ========================================================= */
const CACHE = 'my-diary-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/store.js',
  './js/ui.js',
  './js/theme.js',
  './js/lock.js',
  './js/media.js',
  './js/tabs/schedule.js',
  './js/tabs/finance.js',
  './js/tabs/card.js',
  './js/tabs/memo.js',
  './js/tabs/diary.js',
  './js/tabs/dream.js',
  './js/tabs/links.js',
  './js/tabs/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // 페이지 이동은 네트워크 우선, 실패하면 캐시된 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // 나머지 파일은 캐시 우선 + 뒤에서 갱신
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
