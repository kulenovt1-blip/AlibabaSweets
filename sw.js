/* Service Worker: офлайн-режим. Сначала сеть, при её отсутствии — кэш. */
const C = 'ab-v17';
const A = ['./', 'index.html', 'styles.css', 'app.js', 'logo.jpg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(A.map(u => new Request(u, { cache: 'reload' }))))) });
self.addEventListener('activate', e => e.waitUntil(   // удаляем кэши старых версий
  caches.keys().then(ks => Promise.all(ks.filter(k => k != C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method != 'GET' || new URL(r.url).origin != location.origin) return;     // чужие домены (Google) не трогаем
  e.respondWith(fetch(new Request(r, { cache: 'no-cache' })).then(x => {
    if (x.ok) { const k = x.clone(); e.waitUntil(caches.open(C).then(c => c.put(r, k))) }   // кэшируем только успешные ответы
    return x;
  }).catch(() => caches.match(r).then(m => m || (r.mode == 'navigate' ? caches.match('index.html') : Response.error()))));
});
