/* ВРЕМЕННАЯ ДИАГНОСТИКА (v36.5). Грузится только если включена: «Настройки → Служебная информация → Диагностика».
   Что делает: замеряет время (запуск, запросы к серверу, синхронизация, отрисовка экранов, запись в память, долгие задачи, плавность), размеры (файлы, память телефона, кэши) и собирает ошибки.
   Чего НЕ делает: не читает и не показывает содержимое (названия магазинов, заявки, пароли, токен), ничего не отправляет никуда — отчёт копируется вручную. Единственный сетевой запрос от неё — пробный «пинг» без токена: сервер отвечает «нужен вход» и ничего не читает из таблицы.
   Удалить после разбора: убрать этот файл, строки «diag» в app.js и ключи diag, diag_runs в памяти телефона (кнопка «Выключить» чистит их сама). */
(function () {
  if (window.DIAG) return;
  var PF = typeof performance != 'undefined' ? performance : null, T0 = Date.now();
  var now = function () { return PF && PF.now ? PF.now() : Date.now() - T0 }, R = Math.round, K = function (n) { return Math.round(n / 102.4) / 10 };
  var D = window.DIAG = { net: [], f: [], sync: [], vw: {}, lsw: {}, lt: [], ev: [], err: [], crawl: null, fps: null, ping: [], cur: null, lcp: 0, store: null };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms) }) };
  var of = window.fetch;
  function host(u) { try { var h = new URL(u, location.href).hostname; return /docs\.google/.test(h) ? 'Google Таблица (прайс)' : /script\.google|googleusercontent/.test(h) ? 'Apps Script' : /fonts\.g/.test(h) ? 'Google Fonts' : h == location.hostname ? 'сайт' : h } catch (e) { return '?' } }
  function opOf(b) { if (!b || typeof b != 'object') return '?'; if (b.q) return 'чтение:' + b.q; if (b.auth) return 'вход'; if (b.admin) return 'админ:' + String(b.admin.op || ''); if (b.shop) return 'магазин:' + String(b.shop.op || 'правка'); if (b.visit || b.visitOp || b.visitCancel) return 'визит'; if (b.order) return 'заявка'; if (b.orderOp) return 'заявка:' + String(b.orderOp.op || ''); return Object.keys(b).filter(function (k) { return k != 'tok' }).slice(0, 1).join() }
  function wrap(name, fn) { var o = window[name]; if (typeof o != 'function' || o.__dg) return; var w = function () { return fn.call(this, o, arguments) }; w.__dg = 1; window[name] = w }
  var push = function (a, x, n) { a.push(x); if (a.length > n) a.shift() };

  // --- запросы к серверу (имя операции, время, размер ответа; тела запросов не сохраняются) ---
  wrap('rawPost', function (o, a) {
    var t = now(), e = { op: opOf(a[0]), ms: 0, ok: true, kb: 0 }; push(D.net, e, 300); if (D.cur) D.cur.n++;
    return o.apply(this, a).then(function (r) { e.ms = R(now() - t); try { e.kb = K(JSON.stringify(r).length) } catch (x) {} e.ok = !(r && r.error); if (!e.ok) e.er = String(r.error).slice(0, 40); return r },
      function (er) { e.ms = R(now() - t); e.ok = false; e.er = String(er && er.message || er).slice(0, 70); throw er })
  });
  if (of) window.fetch = function (u) { var t = now(), h = host(typeof u == 'string' ? u : u && u.url), e = { h: h, ms: 0, st: 0 }; push(D.f, e, 200);
    return of.apply(this, arguments).then(function (r) { e.ms = R(now() - t); e.st = r.status; return r }, function (er) { e.ms = R(now() - t); e.er = 1; throw er }) };   // время до ответа (заголовков) по каждому адресу
  wrap('sync', function (o, a) {
    if (D.cur) return o.apply(this, a); var s = D.cur = { at: Date.now(), n: 0, ms: 0, ops: [] }, t = now(), i0 = D.net.length;
    return Promise.resolve(o.apply(this, a)).then(function (r) { fin(); return r }, function (er) { fin(); throw er });
    function fin() { s.ms = R(now() - t); s.ops = D.net.slice(i0).map(function (x) { return x.op + ' ' + x.ms }); D.cur = null; if (s.n) push(D.sync, s, 30) }
  });
  ['drawList', 'drawChips', 'fill', 'histView', 'cartView', 'shopsView', 'drawShops', 'planView', 'rgView', 'setView', 'shopCard', 'drawAll', 'drawToday', 'moreView'].forEach(function (n) {   // время отрисовки экранов
    wrap(n, function (o, a) { var t = now(), r = o.apply(this, a), d = now() - t, e = D.vw[n] || (D.vw[n] = { n: 0, ms: 0, max: 0 }); e.n++; e.ms += d; if (d > e.max) e.max = d; return r })
  });
  try { if (typeof Storage != 'undefined' && Storage.prototype.setItem && !Storage.prototype.setItem.__dg) { var os = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { var t = now(); os.apply(this, arguments); var d = now() - t, e = D.lsw[k] || (D.lsw[k] = { n: 0, ms: 0, max: 0, kb: 0 }); e.n++; e.ms += d; if (d > e.max) e.max = d; e.kb = K(String(v).length * 2) }; Storage.prototype.setItem.__dg = 1 } } catch (e) {}   // запись в память телефона
  function obs(type, cb, extra) { try { var o = new PerformanceObserver(function (l) { cb(l.getEntries()) }), p = { type: type, buffered: true }; for (var k in extra || {}) p[k] = extra[k]; o.observe(p) } catch (e) {} }
  obs('longtask', function (l) { l.forEach(function (e) { push(D.lt, [R(e.startTime), R(e.duration)], 200) }) });
  obs('event', function (l) { l.forEach(function (e) { if (e.duration >= 100) push(D.ev, [e.name, R(e.duration)], 100) }) }, { durationThreshold: 100 });
  obs('largest-contentful-paint', function (l) { l.forEach(function (e) { D.lcp = R(e.startTime) }) });
  var er = function (m) { push(D.err, new Date().toLocaleTimeString('ru') + ' ' + String(m).slice(0, 160), 30) };
  window.addEventListener('error', function (e) { er((e.message || 'ошибка') + (e.lineno ? ' (строка ' + e.lineno + ')' : '')) });
  window.addEventListener('unhandledrejection', function (e) { er('promise: ' + (e.reason && e.reason.message || e.reason)) });

  // --- проверки по кнопкам ---
  D.doPing = async function (n) { D.ping = []; if (!of || typeof CFG == 'undefined' || !CFG.API_URL) return; for (var i = 0; i < (n || 3); i++) { var t = now(), ok = 1; try { var r = await of(CFG.API_URL, { method: 'POST', body: JSON.stringify({ q: 'ping' }) }); await r.text() } catch (e) { ok = 0 } D.ping.push(ok ? R(now() - t) : -1); await sleep(300) } };
  D.doSync = async function () { if (typeof sync == 'function') { var n = D.sync.length; await sync(); await sleep(200); return D.sync.length > n ? D.sync[D.sync.length - 1] : null } };
  D.doFps = async function (sec) { var fr = [], last = 0, t0 = now(), y = 0, home = typeof closeSheet == 'function'; try { if (home && typeof view != 'undefined' && view) closeSheet(); window.scrollTo(0, 0) } catch (e) {}
    await new Promise(function (res) { function tick(ts) { if (last) fr.push(ts - last); last = ts; try { y += 28; window.scrollTo(0, y) } catch (e) {} if (now() - t0 < (sec || 4) * 1000) requestAnimationFrame(tick); else res() } if (typeof requestAnimationFrame == 'function') requestAnimationFrame(tick); else res() });
    var s = fr.slice().sort(function (a, b) { return a - b }), sum = fr.reduce(function (a, b) { return a + b }, 0);
    D.fps = fr.length ? { n: fr.length, avg: Math.round(sum / fr.length * 10) / 10, p95: R(s[Math.floor(s.length * .95)]), slow: fr.filter(function (x) { return x > 33 }).length, bad: fr.filter(function (x) { return x > 100 }).length, y: R(y) } : { n: 0 }; try { window.scrollTo(0, 0) } catch (e) {} };
  D.doStore = async function () { var o = { keys: [], tot: 0, parse: [] }, i, k, v;
    try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); v = localStorage.getItem(k) || ''; o.keys.push([k, K(v.length * 2)]); o.tot += v.length * 2 } o.keys.sort(function (a, b) { return b[1] - a[1] });
      o.keys.slice(0, 5).forEach(function (e) { var t = now(); try { JSON.parse(localStorage.getItem(e[0])) } catch (x) {} o.parse.push([e[0], Math.round((now() - t) * 10) / 10]) }) } catch (e) { o.er = String(e.message || e) }
    try { if (navigator.storage && navigator.storage.estimate) { var q = await navigator.storage.estimate(); o.use = Math.round((q.usage || 0) / 1048576 * 10) / 10; o.quota = Math.round((q.quota || 0) / 1048576) } } catch (e) {}
    try { if (typeof caches != 'undefined') { o.caches = []; var ks = await caches.keys(); for (i = 0; i < ks.length; i++) { var c = await caches.open(ks[i]); o.caches.push([ks[i], (await c.keys()).length]) } } } catch (e) {}
    try { if (navigator.serviceWorker) { o.ctl = !!navigator.serviceWorker.controller; var rg = await navigator.serviceWorker.getRegistration(); o.sw = rg ? (rg.active ? rg.active.state : '—') + (rg.waiting ? ' + ждёт обновление' : '') : 'нет' } } catch (e) {}
    D.store = o };
  D.doCrawl = async function (pause) { var p = pause == null ? 350 : pause, rows = [], keep = { m: typeof shMode != 'undefined' ? shMode : '', q: typeof shQ != 'undefined' ? shQ : '' }, b0 = (typeof base != 'undefined' && base.filter(function (x) { return x.id })[0]) || null;
    var steps = [['Каталог', function () { closeSheet(); drawList() }], ['Корзина', function () { cartView() }], ['История', function () { histView() }], ['Маршрут на сегодня', function () { shMode = 'route'; shopsView() }], ['Все магазины', function () { shMode = 'all'; shQ = ''; shopsView() }],
      ['Поиск «а» в магазинах', function () { shQ = 'а'; drawShops() }], ['Маршрут по дням', function () { shQ = ''; planView() }], ['Общий / мой маршрут', function () { if (typeof rgOk == 'function' && rgOk()) { rgD = ''; rgView() } else throw new Error('недоступен') }],
      ['Карточка магазина', function () { if (!b0) throw new Error('нет магазинов'); cKey = ''; shopCard(skey(b0)) }], ['Настройки', function () { setView() }], ['Ещё', function () { if (typeof moreView == 'function') moreView(); else throw new Error('нет') }]];
    for (var i = 0; i < steps.length; i++) { var e0 = D.err.length, n0 = D.net.length, t = now(), er = ''; try { steps[i][1]() } catch (x) { er = String(x && x.message || x).slice(0, 60) } var ms = now() - t; await sleep(p);
      rows.push({ n: steps[i][0], ms: R(ms), dom: document.getElementsByTagName('*').length, net: D.net.length - n0, er: er || (D.err.length > e0 ? 'ошибка в консоли' : '') }) }
    try { shMode = keep.m || shMode; shQ = keep.q; closeSheet(); drawList() } catch (x) {} D.crawl = rows };

  // --- отчёт ---
  var nm = function (u) { try { var x = new URL(u, location.href); return x.origin == location.origin ? x.pathname.replace(/^\//, '').slice(-34) || '/' : host(u) } catch (e) { return '?' } };
  var mk = function (n) { var m = PF && PF.getEntriesByName ? PF.getEntriesByName(n)[0] : null; return m ? R(m.startTime) : null };
  var fm = function (v) { return v == null ? '—' : v + ' мс' };
  D.report = function () { var L = [], H = function (t) { L.push(''); L.push('■ ' + t) }, nv = (PF && PF.getEntriesByType && PF.getEntriesByType('navigation')[0]) || null, c = navigator.connection || {}, n;
    L.push('ДИАГНОСТИКА Али-Баба · версия ' + (typeof VER != 'undefined' ? VER : '?') + ' · Code.gs ' + (typeof srvV != 'undefined' ? srvV : '?') + ' · роль ' + (typeof role != 'undefined' ? role : '?') + ' · ' + new Date().toLocaleString('ru') + ' · страница открыта ' + R((Date.now() - T0) / 1000) + ' с назад');
    H('Устройство'); L.push((navigator.userAgent.match(/\((.*?)\)/) || ['', ''])[1].slice(0, 70) + ' · экран ' + screen.width + '×' + screen.height + ' ×' + (window.devicePixelRatio || 1) + ' · ядер ' + (navigator.hardwareConcurrency || '?') + ' · память ' + (navigator.deviceMemory || '?') + ' ГБ');
    L.push('сеть: ' + (c.effectiveType || '?') + ', ' + (c.downlink || '?') + ' Мбит/с, задержка ' + (c.rtt || '?') + ' мс' + (c.saveData ? ', экономия трафика' : '') + ' · online ' + navigator.onLine + ' · режим ' + (window.matchMedia && matchMedia('(display-mode: standalone)').matches ? 'установленное приложение' : 'вкладка браузера') + ' · SW ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'управляет' : 'нет'));
    H('Запуск (эта загрузка)'); L.push('ответ сервера сайта (TTFB) ' + fm(nv && R(nv.responseStart)) + ' · DOM готов ' + fm(nv && R(nv.domContentLoadedEventEnd)) + ' · load ' + fm(nv && R(nv.loadEventEnd)) + ' · первая отрисовка ' + fm(((PF && PF.getEntriesByName && PF.getEntriesByName('first-contentful-paint')[0]) || {}).startTime && R(PF.getEntriesByName('first-contentful-paint')[0].startTime)) + ' · крупнейший элемент ' + fm(D.lcp || null));
    L.push('прайс (CSV): старт ' + fm(mk('ab-csv0')) + ' → готов ' + fm(mk('ab-csv1')) + ' · список товаров показан ' + fm(mk('ab-list')) + ' · заставка убрана ' + fm(mk('ab-splash')) + ' · первая синхронизация ' + fm(mk('ab-sync0')) + ' → ' + fm(mk('ab-sync1')));
    try { var runs = JSON.parse(localStorage.getItem('diag_runs') || '[]'); if (runs.length) { H('Прошлые запуски (старый → новый)'); runs.forEach(function (r) { L.push(r.d + ' · v' + r.v + ' · ' + r.net + ' · SW ' + (r.sw ? 'да' : 'нет') + ' · список ' + fm(r.list) + ' · заставка ' + fm(r.spl) + ' · синхр. ' + fm(r.s0) + '→' + fm(r.s1) + ' · прайс ' + fm(r.c0) + '→' + fm(r.c1) + ' · DOM ' + fm(r.dcl)) }) } } catch (e) {}
    H('Файлы, загруженные при открытии'); try { var rs = PF.getEntriesByType('resource'), tot = 0, by = {}; rs.forEach(function (r) { var k = r.initiatorType || '?', sz = r.transferSize || 0; tot += sz; (by[k] = by[k] || { n: 0, kb: 0 }).n++; by[k].kb += sz });
      L.push('всего ' + rs.length + ' шт., по сети ' + K(tot) + ' КБ (кэш = 0 КБ; чужие домены без размера) · ' + Object.keys(by).map(function (k) { return k + ' ' + by[k].n + '/' + K(by[k].kb) + ' КБ' }).join(', '));
      rs.slice().sort(function (a, b) { return b.duration - a.duration }).slice(0, 12).forEach(function (r) { L.push('  ' + nm(r.name) + ' · ' + r.initiatorType + ' · ' + (r.transferSize ? K(r.transferSize) + ' КБ' : r.decodedBodySize ? 'из кэша' : 'размер скрыт') + ' · ' + R(r.duration) + ' мс') }) } catch (e) { L.push('не получилось: ' + e.message) }
    H('Запросы к серверу приложения (по операциям)'); var by2 = {}; D.net.forEach(function (x) { var o = by2[x.op] || (by2[x.op] = { n: 0, ms: 0, max: 0, kb: 0, bad: 0 }); o.n++; o.ms += x.ms; if (x.ms > o.max) o.max = x.ms; o.kb += x.kb; if (!x.ok) o.bad++ });
    var ks = Object.keys(by2); if (!ks.length) L.push('запросов с момента включения не было — нажмите «Замерить синхронизацию»'); ks.sort(function (a, b) { return by2[b].ms - by2[a].ms }).forEach(function (k) { var o = by2[k]; L.push('  ' + k + ' · ' + o.n + ' раз · в среднем ' + R(o.ms / o.n) + ' мс · максимум ' + o.max + ' мс · ответ ' + Math.round(o.kb / o.n * 10) / 10 + ' КБ' + (o.bad ? ' · ошибок ' + o.bad : '')) });
    H('Время до ответа по адресам (fetch)'); var by3 = {}; D.f.forEach(function (x) { var o = by3[x.h] || (by3[x.h] = { n: 0, ms: 0, max: 0, er: 0 }); o.n++; o.ms += x.ms; if (x.ms > o.max) o.max = x.ms; if (x.er) o.er++ }); Object.keys(by3).forEach(function (k) { var o = by3[k]; L.push('  ' + k + ' · ' + o.n + ' раз · в среднем ' + R(o.ms / o.n) + ' мс · максимум ' + o.max + ' мс' + (o.er ? ' · обрывов ' + o.er : '')) });
    H('Синхронизации (последние)'); if (!D.sync.length) L.push('нет'); D.sync.slice(-6).forEach(function (s) { L.push('  ' + new Date(s.at).toLocaleTimeString('ru') + ' · всего ' + s.ms + ' мс · запросов ' + s.n + ' → ' + s.ops.join('; ')) });
    H('Запись в память телефона (localStorage)'); var lk = Object.keys(D.lsw).sort(function (a, b) { return D.lsw[b].ms - D.lsw[a].ms }).slice(0, 8); if (!lk.length) L.push('записей не было'); lk.forEach(function (k) { var o = D.lsw[k]; L.push('  ' + k + ' · ' + o.n + ' раз · всего ' + (Math.round(o.ms * 10) / 10) + ' мс · максимум ' + (Math.round(o.max * 10) / 10) + ' мс · ' + o.kb + ' КБ') });
    H('Память и кэши'); var s = D.store; if (!s) L.push('не снято — нажмите «Память и кэши»'); else { L.push('localStorage: ' + K(s.tot) + ' КБ (предел обычно ~5000 КБ) · ' + s.keys.slice(0, 8).map(function (k) { return k[0] + ' ' + k[1] }).join(', ')); L.push('разбор JSON крупнейших: ' + s.parse.map(function (k) { return k[0] + ' ' + k[1] + ' мс' }).join(', ')); if (s.use != null) L.push('хранилище сайта: занято ' + s.use + ' МБ из ' + s.quota + ' МБ'); (s.caches || []).forEach(function (c) { L.push('кэш ' + c[0] + ': ' + c[1] + ' файлов') }); if (s.sw) L.push('сервис-воркер: ' + s.sw + ', управляет страницей: ' + s.ctl); if (s.er) L.push('ошибка: ' + s.er) }
    H('Данные на телефоне'); try { L.push('товаров ' + P.length + ' · магазинов ' + base.length + ' · записей истории ' + shist.length + ' · в очередях: заявки ' + outbox.length + ', магазины ' + shopq.length + ', визиты ' + visq.length + ', удаления ' + delq.length) } catch (e) { L.push('не удалось') }
    H('Отрисовка экранов (время JS)'); var vk = Object.keys(D.vw); if (!vk.length) L.push('экраны не открывались'); vk.sort(function (a, b) { return D.vw[b].max - D.vw[a].max }).forEach(function (k) { var o = D.vw[k]; L.push('  ' + k + ' · ' + o.n + ' раз · в среднем ' + (Math.round(o.ms / o.n * 10) / 10) + ' мс · максимум ' + (Math.round(o.max * 10) / 10) + ' мс') });
    H('Страница сейчас'); n = document.getElementsByTagName('*').length; L.push('элементов DOM ' + n + (n > 3000 ? ' (много)' : '') + (PF && PF.memory ? ' · память JS ' + Math.round(PF.memory.usedJSHeapSize / 1048576) + ' МБ из ' + Math.round(PF.memory.jsHeapSizeLimit / 1048576) + ' МБ' : ''));
    H('Тормоза'); var lt = D.lt.slice().sort(function (a, b) { return b[1] - a[1] }); L.push('долгих задач (>50 мс): ' + D.lt.length + ', суммарно ' + D.lt.reduce(function (a, x) { return a + x[1] }, 0) + ' мс · самые долгие: ' + (lt.slice(0, 5).map(function (x) { return x[1] + ' мс (на ' + x[0] + ')' }).join(', ') || 'нет'));
    L.push('медленных нажатий (>100 мс до отклика): ' + D.ev.length + ' · ' + (D.ev.slice().sort(function (a, b) { return b[1] - a[1] }).slice(0, 5).map(function (x) { return x[0] + ' ' + x[1] + ' мс' }).join(', ') || 'нет'));
    if (D.fps) { H('Плавность прокрутки'); L.push(D.fps.n ? 'кадров ' + D.fps.n + ' · средний кадр ' + D.fps.avg + ' мс · 95% кадров быстрее ' + D.fps.p95 + ' мс · медленных (>33 мс) ' + D.fps.slow + ' · зависаний (>100 мс) ' + D.fps.bad + ' · прокручено ' + D.fps.y + ' px' : 'не удалось измерить') }
    if (D.ping.length) { H('Пинг Apps Script (пустой запрос без токена)'); L.push(D.ping.map(function (x) { return x < 0 ? 'обрыв' : x + ' мс' }).join(' · ') + ' — это время «туда-обратно» без работы с таблицей; всё, что дольше в синхронизации, — работа сервера с листами и данные') }
    if (D.crawl) { H('Автообход экранов'); D.crawl.forEach(function (r) { L.push('  ' + r.n + ' · ' + r.ms + ' мс · DOM ' + r.dom + ' · запросов ' + r.net + (r.er ? ' · ' + r.er : '')) }) }
    H('Ошибки'); L.push(D.err.length ? D.err.slice(-10).join('\n') : 'нет');
    return L.join('\n') };

  // --- запись запуска (для сравнения запусков между собой) ---
  setTimeout(function () { try { var nv = PF.getEntriesByType('navigation')[0] || {}, c = navigator.connection || {}, a = JSON.parse(localStorage.getItem('diag_runs') || '[]');
    a.push({ d: new Date().toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), v: typeof VER != 'undefined' ? VER : '?', net: (c.effectiveType || '?') + (navigator.onLine ? '' : ' офлайн'), sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), list: mk('ab-list'), spl: mk('ab-splash'), s0: mk('ab-sync0'), s1: mk('ab-sync1'), c0: mk('ab-csv0'), c1: mk('ab-csv1'), dcl: R(nv.domContentLoadedEventEnd || 0) });
    localStorage.setItem('diag_runs', JSON.stringify(a.slice(-12))) } catch (e) {} }, 20000);

  // --- окно диагностики ---
  var BTN = [['ping', 'Пинг сервера ×3'], ['sync', 'Замерить синхронизацию'], ['crawl', 'Автообход экранов'], ['fps', 'Плавность: прокрутка 4 с'], ['store', 'Память и кэши'], ['all', 'Всё сразу']];
  function paint(msg) { var pre = document.getElementById('dgr'); if (pre) pre.textContent = D.report(); var st = document.getElementById('dgs'); if (st) st.textContent = msg || '' }
  D.open = function () { openSheet('diag', 'Диагностика (временная)'); document.getElementById('sb').innerHTML = '<p class="m" style="margin:0 2px 10px">Нажмите нужные проверки, потом «Скопировать отчёт» и пришлите текст. В отчёте нет названий магазинов, заявок, паролей и токена — только время и размеры.</p>'
      + BTN.map(function (b) { return '<button class="ghost" data-dg="' + b[0] + '">' + b[1] + '</button>' }).join('') + '<div id="dgs" class="m" style="margin:8px 2px;min-height:18px"></div><button class="send" data-dg="copy">Скопировать отчёт</button><pre id="dgr" style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.35;margin:12px 0 0;user-select:text"></pre>'
      + '<button class="ghost" data-dg="clear">Сбросить замеры</button><button class="ghost" data-dg="off">Выключить диагностику</button>'; D.store || D.doStore().then(function () { paint() }); paint() };
  async function run(k) { try { if (k == 'ping' || k == 'all') { paint('Пинг…'); await D.doPing(3) } if (k == 'sync' || k == 'all') { paint('Синхронизация…'); await D.doSync() } if (k == 'store' || k == 'all') { paint('Память и кэши…'); await D.doStore() } if (k == 'crawl' || k == 'all') { paint('Обхожу экраны…'); await D.doCrawl(); D.open() } if (k == 'fps' || k == 'all') { paint('Прокрутка 4 с…'); await D.doFps(4); D.open() } paint('Готово') } catch (e) { paint('Ошибка: ' + (e && e.message || e)) } }
  function copy() { var t = D.report(); function ok() { typeof toast == 'function' && toast('Отчёт скопирован') } function fb() { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok() } catch (e) { paint('Не скопировалось: выделите текст ниже вручную') } a.remove && a.remove() }
    try { navigator.clipboard.writeText(t).then(ok, fb) } catch (e) { fb() } }
  document.addEventListener('click', function (e) { var b = e.target && e.target.closest && e.target.closest('[data-dg]'); if (!b) return; var k = b.dataset.dg;
    if (k == 'copy') copy(); else if (k == 'clear') { D.net = []; D.f = []; D.sync = []; D.vw = {}; D.lsw = {}; D.lt = []; D.ev = []; D.err = []; D.crawl = null; D.fps = null; D.ping = []; paint('Замеры сброшены') }
    else if (k == 'off') { try { localStorage.removeItem('diag'); localStorage.removeItem('diag_runs') } catch (x) {} closeSheet(); typeof toast == 'function' && toast('Диагностика выключена: заработает после обновления страницы') } else run(k) });
})();
