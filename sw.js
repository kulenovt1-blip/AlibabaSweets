/* Service Worker: офлайн-режим. Файлы сайта — сначала сеть, при её отсутствии — кэш.
   v36.3: фото товаров (папка img/) — в отдельном кэше IMG без версии в имени: выпуск его не стирает, и торговые не качают фото заново
   по мобильному интернету. Фото отдаётся из кэша сразу, а в фоне обновляется (если файл заменили — новое будет при следующем показе).
   v36.4: страница (index.html) ждёт сеть не дольше NET_MS — при слабом сигнале открывается из кэша, а свежая версия догружается в фоне и будет при следующем запуске.
   Остальные файлы сайта в этот же запуск берутся оттуда же, откуда страница (иначе версии index.html и app.js смешались бы и вышла красная плашка).
   v36.6: логика не менялась — новое имя кэша, чтобы телефоны взяли новые app.js и index.html (каталог из сохранённого прайса сразу, «Сохранено» без ожидания обновления данных).
   v37: клиент и сервер получили пачки операций (batch) и автовизит «Взяли заказ» — новое имя кэша, чтобы телефоны взяли новый app.js.
   v37.1: исправление — новое имя кэша (число точек в маршруте при быстрых нажатиях).
   Кэш фото при выпуске чистится от полноразмерных оригиналов: показываются лёгкие копии img/t/ и img/z/ (WebP). */
const C = 'ab-v37-1', IMG = 'ab-img', NET_MS = 4000;
const A = ['./', 'index.html', 'styles.css', 'app.js', 'logo.jpg', 'favicon.ico', 'favicon-32.png', 'manifest.webmanifest'];   // иконки установки (icon-*.png) в кэш не кладём: нужны только при установке на экран, их берёт сам браузер
let stale = false;   // страница этого запуска открыта из кэша: сеть не ответила вовремя
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(A.map(u => new Request(u, { cache: 'reload' }))))) });
self.addEventListener('activate', e => e.waitUntil(   // удаляем кэши старых версий сайта; кэш фото оставляем, но убираем из него старые полноразмерные оригиналы
  caches.keys().then(ks => Promise.all(ks.filter(k => k != C && k != IMG).map(k => caches.delete(k))))
    .then(() => caches.open(IMG).then(c => c.keys().then(rs => Promise.all(rs.filter(r => /\/img\/[^/]+\.(jpe?g|png)$/i.test(new URL(r.url).pathname)).map(r => c.delete(r))))))
    .catch(() => {}).then(() => self.clients.claim())));
function shell(e, r) {   // файл сайта: сеть (всегда сверяясь с сервером), при обрыве или долгом ожидании страницы — кэш
  const nav = r.mode == 'navigate';
  const net = fetch(new Request(r, { cache: 'no-cache' })).then(x => {
    if (x.ok) { const k = x.clone(); e.waitUntil(caches.open(C).then(c => c.put(r, k))) }   // кэшируем только успешные ответы
    return x;
  });
  e.waitUntil(net.catch(() => {}));   // не дать worker'у уснуть, пока в фоне обновляется кэш
  const cached = () => caches.match(r).then(m => m || (nav ? caches.match('index.html') : null));
  const last = () => cached().then(m => m || net).catch(() => Response.error());   // кэша нет — ждём сеть сколько потребуется
  if (!nav && stale) return last();
  const first = nav ? Promise.race([net.catch(() => null), new Promise(res => setTimeout(() => res(null), NET_MS))]) : net.catch(() => null);
  return first.then(x => { if (nav) stale = !x; return x || last() });
}
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
  e.respondWith(shell(e, r));
});
