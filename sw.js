/* Service Worker: офлайн-режим. Файлы сайта — сначала сеть, при её отсутствии — кэш.
   v36.3: фото товаров (папка img/) — в отдельном кэше IMG без версии в имени: выпуск его не стирает, и торговые не качают фото заново
   по мобильному интернету. Фото отдаётся из кэша сразу, а в фоне обновляется (если файл заменили — новое будет при следующем показе). */
const C = 'ab-v36-3', IMG = 'ab-img';
const A = ['./', 'index.html', 'styles.css', 'app.js', 'logo.jpg', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'favicon.ico', 'favicon-32.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(A.map(u => new Request(u, { cache: 'reload' }))))) });
self.addEventListener('activate', e => e.waitUntil(   // удаляем кэши старых версий сайта; кэш фото оставляем
  caches.keys().then(ks => Promise.all(ks.filter(k => k != C && k != IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method != 'GET' || u.origin != location.origin) return;     // чужие домены (Google) не трогаем
  if (/\/img\//.test(u.pathname)) {                                  // фото: из кэша сразу, обновление в фоне
    e.respondWith(caches.open(IMG).then(c => c.match(r).then(m => {
      const net = fetch(r).then(x => { if (x.ok) { const k = x.clone(); e.waitUntil(c.put(r, k)) } return x });
      if (m) { e.waitUntil(net.catch(() => {})); return m }
      return net.catch(() => Response.error());
    })));
    return;
  }
  e.respondWith(fetch(new Request(r, { cache: 'no-cache' })).then(x => {
    if (x.ok) { const k = x.clone(); e.waitUntil(caches.open(C).then(c => c.put(r, k))) }   // кэшируем только успешные ответы
    return x;
  }).catch(() => caches.match(r).then(m => m || (r.mode == 'navigate' ? caches.match('index.html') : Response.error()))));
});
