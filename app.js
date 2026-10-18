/* ============ 1. НАСТРОЙКИ (меняйте только здесь) ============ */
const CFG = {
  SHEET_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGyNVUyAyeZVoafaazZmZEQbtmmcyqXV5AJBYxhq1_4SELUbFuujtEr9XHfp9XCLktXud9Sc2Czmf_/pub?gid=928244906&single=true&output=csv',                 // ← ссылка на опубликованный CSV Google Таблицы (см. README.md)
  OPERATOR: '77474331973',       // запасной номер WhatsApp (если лист «Получатели» пуст): код страны + номер, без + и пробелов
  CITIES: ['Петропавловск', 'Астана', 'Костанай'],
  PRICE_MODE: 'vat',             // режим цен по умолчанию: 'vat' — с НДС, 'net' — без НДС
  SHOW_VAT_LABEL: true,          // пометка «(с НДС)» / «(без НДС)» в последней строке заявки; false — убрать
  API_URL: 'https://script.google.com/macros/s/AKfycbzXofkvdmGY2lXE5ZeBuU0GLGrXcBDRx1L_UPLA3VAFO5o1qG2cy3WwjEQQQGGm49OV/exec',                   // ссылка на веб-приложение Apps Script (см. README); пусто = без общей базы
  UNDO_HOURS: 24,                // сколько часов удалённую заявку можно вернуть
  EDIT_HOURS: 24                 // сколько часов после создания заявку можно изменить
};   // общего ключа здесь больше нет: доступ к базе — по личному входу (профиль и пароль), см. README.md
// Тестовая среда. Если приложение открыто с этого же компьютера (localhost), оно работает с КОПИЕЙ таблицы и отдельным развёртыванием Apps Script,
// а не с рабочими. На опубликованном сайте действуют только адреса из CFG выше.
const TEST_ENV = /^(localhost|127\.0\.0\.1)$/.test(String(location.hostname || '')) ? { SHEET_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTIyYRGjBceUKexFyQT_w4lRQh1VfavdDR1pkNM0HMyZSqWTDxdufYS6lVdHodTf3f6QFgqNQMojm2O/pub?gid=928244906&single=true&output=csv', API_URL: 'https://script.google.com/macros/s/AKfycbwjrrtzTb9DpRo7fTGUmvLigV3tGj8RTU2ufwtJ3DhxV74xZQmGNRQOJ_5dC_qRKV9Y/exec' } : null;
if (TEST_ENV) Object.assign(CFG, TEST_ENV);
// Колонки таблицы: категория | название | граммовка | цена без НДС | цена с НДС | единица (шт/кг/кор) | фото
const DEMO = [['Финики','Финики FINDI caramel','150г','1704','1976','шт',''],['Мармелад','Кубик Манго','200г','500','600','шт',''],
  ['Орехи','Грецкий орех','1кг','4200','4872','кг','']];

/* ============ 2. ХЕЛПЕРЫ И СОСТОЯНИЕ ============ */
/* Версия сборки: должна совпадать с <meta name="ver"> в index.html. Если файлы на хостинге разных версий — покажем красную плашку. */
const VER = '37.4';
const NEED = 36;   // нужная версия Code.gs на сервере
{ const m = document.querySelector('meta[name=ver]');
  if (!m || m.content != VER) document.body.insertAdjacentHTML('afterbegin', '<div style="background:#C82B27;color:#fff;padding:12px;font-weight:800">Файлы сайта разных версий. Загрузите ВСЕ файлы из архива заново (index.html, styles.css, app.js, sw.js) и обновите страницу дважды.</div>') }
const IC = { folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>', send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 6l-6 6 6 6"/>', chev: '<path d="M9 6l6 6-6 6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', lock: '<path d="M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>', down2: '<path d="M6 9l6 6 6-6"/>', up2: '<path d="M6 15l6-6 6 6"/>', nav: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>', cal: '<path d="M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M8 3v4M16 3v4"/>', tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', plus: '<path d="M12 5v14M5 12h14"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M9.5 20v-5h5v5"/>', star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>', phone: '<path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-3z"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>' };
const ico = (n, s = 18) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;   // линейные иконки вместо эмодзи
{ const q = (k, h) => { const e = document.querySelector(k); if (e) e.innerHTML = h };
  q('#ic-route', ico('pin', 24)); q('#ic-main', ico('bag', 24)); q('#ic-hist', ico('clock', 24)); q('#drbi', ico('user', 24)); q('#clr', ico('trash', 20)); q('.si', ico('search', 18)) }
const ghost = new Proxy(function () {}, { get: (t, k) => k == Symbol.toPrimitive ? () => '' : ghost, set: () => true, apply: () => ghost });   // заглушка вместо отсутствующего элемента — страница не падает целиком
const $ = s => document.querySelector(s) || ghost;
const LS = (k, v) => { if (v !== undefined) return localStorage.setItem(k, JSON.stringify(v)); try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } };   // битые сохранённые данные не должны ронять приложение
const esc = s => String(s == null ? '' : s).replace(/[&<>"'`]/g, c => '&#' + c.charCodeAt(0) + ';');   // для текста и для значений атрибутов в кавычках (включая одинарные)
const mk = n => { try { if (!performance.getEntriesByName(n).length) performance.mark(n) } catch (_) {} };   // v36.5: метки времени запуска для диагностики (первая отметка каждого имени; почти бесплатно)
const nz = v => { const x = typeof v == 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : 0 };   // число для вывода и расчётов: всё, что числом не является, становится 0 и в разметку не попадает
const cleanCart = c => { const o = {}; if (c && typeof c == 'object' && !Array.isArray(c)) Object.keys(c).forEach(k => { const x = c[k]; if (x && typeof x == 'object' && nz(x.q) > 0) { o[k] = { q: nz(x.q) }; if (x.p != null) o[k].p = nz(x.p) } }); return o };
function safeO(x) { // заявка из хранилища, файла или с сервера: числа — числами, строки — строками. Данным не доверяем, откуда бы они ни пришли
  if (!x || typeof x != 'object' || Array.isArray(x)) return null;
  const t = v => v == null ? '' : String(v), h = x.h && typeof x.h == 'object' ? x.h : {}, rc = x.rc && typeof x.rc == 'object' ? x.rc : null;
  const o = { ...x, id: t(x.id), ts: nz(x.ts), ed: nz(x.ed), del: nz(x.del), dby: t(x.dby), trader: t(x.trader), sum: nz(x.sum), disc: nz(x.disc), m: x.m == 'vat' || x.m == 'net' ? x.m : '', text: t(x.text),
    h: { d: t(h.d), c: t(h.c), s: t(h.s), a: t(h.a), sid: t(h.sid) }, cart: cleanCart(x.cart), rc: rc ? { n: t(rc.n), p: t(rc.p) } : null };
  if (Array.isArray(x.items)) o.items = x.items.filter(i => i && typeof i == 'object').map(i => ({ n: t(i.n), g: t(i.g), u: t(i.u), q: nz(i.q), p: nz(i.p), o: nz(i.o == null ? i.p : i.o) })); else delete o.items;
  return o;
}
const safeL = l => (Array.isArray(l) ? l : []).map(safeO).filter(Boolean);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const num = v => parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0; // «1 500 ₸» → 1500
const qf = n => String(+nz(n).toFixed(2));
// Суммы на экране — с разделителем разрядов (48 210 ₸). Только для показа: текст заявки в WhatsApp и CSV остаются без разделителей (строгий формат для оператора)
const fm = n => { const x = nz(n), [i, d] = String(Math.abs(x)).split('.'); return (x < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + (d ? ',' + d : '') };
const tg = n => fm(n) + '\u00A0₸';
const fd = d => d ? +d.slice(8) + '.' + +d.slice(5, 7) : '';
const wdOf = (d, f) => d ? new Date(d + 'T12:00:00').toLocaleDateString('ru', { weekday: f || 'short' }) : '';   // день недели даты «2026-10-16»
const fdw = d => d ? d.split('-').reverse().join('.') + ', ' + wdOf(d, 'long') : '';   // 2026-10-15 → 15.10.2026, четверг           // 2026-10-09 → 9.10
// Дата поставки: по умолчанию ближайшая пятница ПОСЛЕ времени заявки (фирма возит по пятницам; заявка в пятницу — на следующую). v34: от времени заявки, а не от сегодня
const locIso = t => { const d = new Date(t), z = k => String(k).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) };   // местная дата «2026-10-16»
const nextFri = (t = Date.now()) => { const d = new Date(t); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return locIso(d.getTime()) };   // вт 06.10 → пт 09.10; пт 09.10 → пт 16.10
const ordT = () => H.t > 0 && H.t <= Date.now() ? H.t : Date.now();   // время заявки: указанное вручную («Время заявки») или «сейчас»
const minD = () => locIso(Date.now() - 60 * 864e5);                     // вручную дату поставки можно выбрать не раньше 60 дней назад
const fixDate = () => { if (!H.d || !H.dm) { H.d = nextFri(ordT()); H.dm = 0 } };   // dm=1 — дату выбрали вручную (её не трогаем, даже если прошла: спросим при отправке)
function pickD(v) { // v34: ручной выбор даты поставки. Пусто — снова автоматически; раньше 60 дней или раньше дня заявки — не принимаем, прежняя дата остаётся
  if (!v) { H.dm = 0; fixDate(); return }
  if (v < minD() && !eo) return say('Дату поставки можно выбрать не раньше чем за 60 дней до сегодня.');
  if (v < locIso(ordT())) return say('Поставка не может быть раньше дня заявки (' + fd(locIso(ordT())) + '). Если заявку приняли раньше — сначала укажите «Время заявки».');
  H.d = v; H.dm = 1 }
let P = [], cart = LS('cart') || {}, disc = LS('disc') || 0, H = LS('hdr') || { d: today() },
    S = LS('set') || { op: CFG.OPERATOR, cities: CFG.CITIES }, cat = 'Все', Q = '', view = '', editId = '';
S.mode = S.mode || CFG.PRICE_MODE;
if (!Array.isArray(S.cities) || !S.cities.length) S.cities = CFG.CITIES; S.op = S.op || CFG.OPERATOR;   // защита от данных старых версий
if (typeof H != 'object' || Array.isArray(H)) H = { d: today() }; fixDate(); if (typeof cart != 'object' || Array.isArray(cart)) cart = {};
let hfC = !!H.s;   // v33: магазин выбран — шапка заявки свёрнута в карточку «Магазин · адрес · поставка» с кнопкой «Сменить»
let me = String(LS('me') || ''), trs = LS('trs') || [], rcp = LS('rcp') || [], fav = LS('fav') || [], eo = LS('eo') || '', eob = typeof LS('eob') == 'number' ? LS('eob') : null, visq = LS('visq') || [], base = LS('base') || [], shist = LS('shist') || [], outbox = LS('outbox') || [], drafts = LS('drafts') || [], msw = LS('msw'), shopq = LS('shopq') || [], delq = LS('delq') || [], delok = LS('delok') || [];   // delok — удаления, принятые сервером, но ещё не подтверждённые выгрузкой
if (msw != 'vat' && msw != 'net') msw = '';   // msw — режим цен, который был, когда его переключили при товарах в корзине ('' — не переключали или вернули как было)
cart = cleanCart(cart); disc = Math.min(100, Math.max(0, nz(disc))); shist = safeL(shist); drafts = (Array.isArray(drafts) ? drafts : []).filter(x => x && typeof x == 'object' && x.H && typeof x.H == 'object');
[outbox, shopq, visq, delq, delok] = [outbox, shopq, visq, delq, delok].map(q => Array.isArray(q) ? q.filter(x => x && typeof x == 'object') : []);
// Вход: tok — токен, выданный сервером после входа по паролю. Хранится только на этом устройстве; в адрес запроса, резервную копию и экспорт не попадает
let tok = LS('tok'), role = LS('role') == 'admin' ? 'admin' : 'trader', authNeed = false, auMode = 'login', auBusy = false, adm = null, admCode = null, admOw = null, admRec = null;
if (typeof tok != 'string') tok = '';
const qN = () => outbox.length + shopq.length + delq.length + visq.length;   // сколько операций ждут отправки (все они записаны от имени профиля me)
// Миграция: заявки из старых версий без номера (id) получают его, иначе их нельзя удалить или повторить
(() => { const h = LS('hist'); if (!Array.isArray(h)) return; let ch = false;
  h.forEach((x, i) => { if (x && !x.id) { x.id = 'old' + (x.ts || 0).toString(36) + i + Math.random().toString(36).slice(2, 5); ch = true } }); if (ch) LS('hist', h) })();
// История: histDay — начало выбранного периода (0 — текущий); dayC — заявки за периоды старше загруженного окна, подгруженные по запросу (только в памяти)
const dayMs = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() };
const isoDay = ms => { const d = new Date(ms), z = k => String(k).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) };
let histDay = dayMs(Date.now()), dayC = {}, dayBusy = 0, dayErr = 0;
const winFrom = mine => dayMs(Date.now() - (mine ? 29 : 6) * 864e5);   // с какого дня заявки уже загружены: свои — 30 дней, чужие — 7 дней
// v35: needDay / loadDay заменены на needP / loadRange (период целиком) — в блоке «История»
const pl3 = (n, a, b, c) => n % 10 == 1 && n % 100 != 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;   // 1 точка / 2 точки / 5 точек
const plZ = n => n % 10 == 1 && n % 100 != 11 ? 'заявка' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'заявки' : 'заявок';
const setDel = (id, ts) => Object.values(dayC).forEach(c => c.hist.forEach(x => { if (x.id == id) x.del = ts }));   // пометка удаления и в подгруженных днях
// История: серверная версия главнее копии на устройстве (v34). Копия показывается, пока заявка не отправлена (outbox) или если её нет в загруженном с сервера
const allHist = () => { // у каждой заявки есть del (время удаления, 0 — не удалена)
  const sm = new Map(shist.map(x => [x.id, x])), key = x => x.id || x.sum + x.h.s + x.h.d, pend = new Set(outbox.map(o => o.id)), sv = new Map(), m = new Map();
  [...Object.values(dayC).flatMap(c => c.hist), ...shist].forEach(x => sv.set(key(x), x));   // серверные: подгруженные дни и окно init (оно свежее — побеждает)
  safeL(LS('hist')).forEach(x => { const k = key(x);
    if (pend.has(x.id)) return m.set(k, x);                                          // ещё не отправлена — показываем то, что ввели
    if (CFG.API_URL && x.trader && x.trader != me) return;                            // копия другого профиля на этом устройстве (после смены профиля) — не показываем
    if (!sv.has(k)) m.set(k, x) });                                                  // на сервере в загруженном окне её нет — показываем копию
  sv.forEach((x, k) => { if (!m.has(k)) m.set(k, x) });
  return [...m.values()].map(x => { const q = [...delq].reverse().find(o => o.id == x.id) || delok.find(o => o.id == x.id), v = sm.get(x.id);
    return { ...x, del: q ? q.del : v ? (v.del || 0) : (x.del || 0) } }).sort((a, b) => (b.ts || 0) - (a.ts || 0));
};
let hTr = '';   // фильтр «Все заявки» по торговому ('' — все)
const canEdit = x => !x.del && (CFG.API_URL && role == 'admin' ? !!x.trader : isMine(x) && Date.now() - (x.rg || x.ts || 0) < CFG.EDIT_HOURS * 36e5);   // свою заявку — в течение суток после записи (rg; дату оформления ts можно менять); администратор — любую заявку с торговым, без срока
let histTab = LS('htab') || 'mine';   // вкладка истории: 'mine' — мои, 'all' — все торговые
const trOf = x => x.as || x.trader, trLbl = x => esc(trOf(x) || 'без торгового') + (x.as ? ' (оформил ' + esc(me) + ')' : x.by && x.by != trOf(x) ? ' (оформил ' + esc(x.by) + ')' : '');   // v36: администратор оформил «от имени»: as — пока не отправлена, by — с сервера
const isMine = x => CFG.API_URL ? !!me && trOf(x) == me : !x.trader || x.trader == me;   // заявка без торгового (из старых версий) — ничья: её можно посмотреть и повторить, но не изменить
const canDel = x => isMine(x) || !!(CFG.API_URL && role == 'admin' && x.trader);   // v34: администратор удаляет и возвращает любую заявку с торговым (владелец не меняется)
const delByMe = x => x.dby == me || delq.some(o => o.id == x.id && o.del) || delok.some(o => o.id == x.id && o.del);   // удаление сделано этим профилем (сервер отдаёт dby) или ещё в пути с этого устройства
const histById = id => allHist().find(x => x.id == id);
function delOrder(id, ts) { // ts — время удаления; 0 — вернуть заявку
  const h = LS('hist') || []; h.forEach(x => { if (x.id == id) x.del = ts }); LS('hist', h); setDel(id, ts);
  if (CFG.API_URL) { delq = delq.filter(o => o.id != id); delq.push({ id, del: ts, trader: me, at: Date.now() }); LS('delq', delq); sync() }   // at — когда нажали: по нему сервер считает срок возврата, даже если запрос дойдёт позже
}
// Позиция в корзине: cart[id] = { q: количество, p: ручная цена (необязательно) }
const pid = p => p.n + '|' + p.g + '|' + p.u;
const step = p => p.u == 'кг' ? .5 : 1;
const frac = p => /^(кг|г|гр|л)$/i.test(String(p.u || '').trim());   // v36.3: дробное количество — только весовые единицы; «шт» и прочие — целые
const QMAX = 1e5, DMAX = 50, DASK = 20;   // v36.3: границы как у сервера (количество ≤ 100 000); скидка до 50 %, выше 20 % — переспросить при отправке
const qty = p => cart[pid(p)]?.q || 0;
const price = p => cart[pid(p)]?.p ?? p.pr;
const find = id => P.find(p => pid(p) == id);
const lines = () => P.filter(p => qty(p) > 0);
const total = () => Math.round(lines().reduce((s, p) => s + price(p) * qty(p), 0));
const final = () => Math.round(total() * (1 - disc / 100));
const save = () => { if (!Object.keys(cart).length) msw = ''; if (!eo) eob = null; LS('cart', cart); LS('disc', disc); LS('hdr', H); LS('eo', eo); LS('eob', eob); LS('msw', msw) };   // корзина пуста — отметка «режим переключали» больше не нужна

/* ============ 3. ПРАЙС ИЗ GOOGLE ТАБЛИЦЫ ============ */
function parseCSV(t) { // разбор CSV с кавычками
  const rows = []; let w = [], c = '', q = 0;
  for (let i = 0; i < t.length; i++) { const h = t[i];
    if (q) { if (h == '"') { if (t[i+1] == '"') { c += '"'; i++ } else q = 0 } else c += h }
    else if (h == '"') q = 1; else if (h == ',') { w.push(c); c = '' }
    else if (h == '\n') { w.push(c); rows.push(w); w = []; c = '' } else if (h != '\r') c += h }
  w.push(c); rows.push(w); return rows;
}
function photo(u) { // ссылка Google Drive → прямая картинка
  u = (u || '').trim(); if (!u) return '';
  if (!/^https?:/i.test(u)) return 'img/' + u.replace(/^\/+/, '');   // просто имя файла (например, finiki1.jpg) → папка img/ на сайте; работает офлайн
  const m = u.match(/\/d\/([\w-]+)|[?&]id=([\w-]+)/);
  return u.includes('drive.google') && m ? `https://drive.google.com/thumbnail?id=${m[1] || m[2]}&sz=w600` : u;
}
// v36.4: лёгкие копии фото в WebP — плитка img/t/ (400 px) и просмотр img/z/ (1100 px). Оригинал (img/имя.jpeg) остаётся: на него ссылается прайс и он — запасной вариант
function picU(u, k) { const m = /^img\/([^/?#]+)\.(?:jpe?g|png)$/i.exec(String(u || '')); return m ? 'img/' + k + '/' + m[1] + '.webp' : u }
function imgFb(i) { if (!i.dataset.f && i.dataset.o && i.getAttribute('src') != i.dataset.o) { i.dataset.f = '1'; i.src = i.dataset.o } else { i.onerror = null; i.src = 'logo.jpg' } }   // не открылась лёгкая копия — оригинал, не открылся и он — логотип
// Колонки ищутся по заголовкам первой строки: Категория, Название, Граммовка, Цена (без НДС) / Цена, Цена (с НДС), Единица, Фото.
// Порядок колонок не важен. Если заголовки не распознаны — берётся порядок: категория, название, граммовка, цена без НДС, цена с НДС, единица, фото.
let hasVat = true;
function colMap(rows) {
  const h = (rows[0] || []).map(x => String(x).toLowerCase()), f = re => h.findIndex(x => re.test(x));
  const m = { c: f(/катег/), n: f(/назв/), g: f(/грам|фасов/), u: f(/един/), f: f(/фото/), h: f(/продвиг|ходов/), pn: -1, pv: -1 };   // v31: колонка «Продвигать» (старое название «Ходовой» тоже принимается)
  h.forEach((x, i) => { if (/ндс/.test(x)) { if (/без/.test(x)) m.pn = i; else m.pv = i } else if (/^цена/.test(x) && m.pn < 0) m.pn = i });
  return m.n < 0 || (m.pn < 0 && m.pv < 0) ? { c: 0, n: 1, g: 2, pn: 3, pv: 4, u: 5, f: 6 } : m;
}
const toProducts = rows => { const m = colMap(rows), v = (r, i) => i >= 0 ? String(r[i] || '') : ''; hasVat = m.pv >= 0;
  return rows.slice(1).filter(r => v(r, m.n).trim() && (num(v(r, m.pn)) > 0 || num(v(r, m.pv)) > 0)).map(r =>
    ({ c: v(r, m.c).trim() || 'Прочее', n: v(r, m.n).trim(), g: v(r, m.g).trim(), pn: num(v(r, m.pn)), pv: num(v(r, m.pv)), pr: 0, u: v(r, m.u).trim() || 'шт', f: photo(v(r, m.f)), pc: /^(да|yes|y|1|\+|x|true)$/i.test(v(r, m.h).trim()), hot: false, pm: false })) };
const applyMode = () => P.forEach(p => p.pr = S.mode == 'vat' ? p.pv : p.pn);   // pr — актуальная цена в выбранном режиме (0 = не указана)
async function load() {
  let rows, err = '';
  const cached = LS('prod2'); let early = false;
  if (CFG.SHEET_CSV && !P.length && Array.isArray(cached)) { const e0 = toProducts(cached); if (e0.length) { P = e0; applyMode(); applyFlags(); drawChips(); drawList(); mk('ab-list'); bar(); early = true } }   // v36.6: прайс уже сохранён на телефоне — каталог показываем сразу, не дожидаясь сети; свежий прайс догрузится ниже
  if (CFG.SHEET_CSV) {
    try {
      mk('ab-csv0'); const r = await fetch(CFG.SHEET_CSV, { cache: 'no-store' }), t = await r.text(); mk('ab-csv1');
      if (!r.ok || /<html|<!doctype/i.test(t.slice(0, 300))) throw new Error('ссылка ведёт не на CSV. Нужна ссылка из «Опубликовать в интернете» → формат CSV');
      rows = parseCSV(t);
      if (!toProducts(rows).length) throw new Error('в таблице нет строк с названием и ценой (проверьте порядок колонок и заголовок в 1-й строке)');
      LS('prod2', rows);
    } catch (e) { err = e.message == 'Failed to fetch' ? (location.protocol == 'file:' ? 'страница открыта как файл (file://) — браузер блокирует запросы к Google. Откройте сайт по ссылке с хостинга (https://)' : 'браузер не смог загрузить таблицу (адрес страницы: ' + location.origin + '). Возможна блокировка расширением, VPN или встроенным браузером мессенджера — откройте ссылку в Chrome') : e.message; rows = LS('prod2'); }
  }
  if (!(early && JSON.stringify(rows) === JSON.stringify(cached))) { P = toProducts(rows || LS('prod2') || [[], ...DEMO]); applyMode(); applyFlags(); drawChips(); drawList(); mk('ab-list'); bar() }   // v36.6: прайс не изменился — список не перерисовываем (не сбиваем прокрутку и ввод количества)
  note(err, !CFG.SHEET_CSV, P.filter(p => !p.pn || !p.pv).map(p => p.n));
  return err;   // v33: загрузочный экран узнаёт, загрузился ли прайс
}
function note(err, demo, miss = []) { // плашка статуса прайса
  let n = $('#note'); if (!n) { n = document.createElement('div'); n.id = 'note'; $('#list').before(n) }
  const msg = err ? 'Прайс не загружен: ' + err : demo ? 'Показаны демо-товары: в app.js не указана ссылка на таблицу'
    : !hasVat ? 'В таблице нет колонки «Цена (с НДС)»: режим «С НДС» не работает. Добавьте колонку и нажмите «Настройки» → «Обновить прайс»'
    : miss.length ? `Не заполнена цена (с НДС или без) у ${miss.length} тов.: ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}` : '';
  n.hidden = !msg; n.className = 'note ' + (err ? 'er' : 'wa'); n.textContent = msg;   // цвета — в styles.css (светлая и тёмная тема)
}

/* ============ 4. КАТАЛОГ ============ */
const FAV = '★ Мои', HOT = 'Ходовые', PRV = 'Брал раньше', PRM = 'Продвигать', isFav = p => fav.includes(pid(p));
/* v31. «Ходовые» — с сервера (чаще всего в заявках за 60 дней); «Продвигать» — отметки администратора (лист «Продвигать») или колонка прайса;
   «Брал раньше» — товары из последних заявок выбранного магазина, с прошлым количеством и датой. Вкладка видна, только если в ней что-то есть */
let hotL = Array.isArray(LS('hot')) ? LS('hot').filter(x => x && typeof x.k == 'string') : [], promoL = Array.isArray(LS('promo')) ? LS('promo').map(String) : [], RSN = Array.isArray(LS('rsn')) ? LS('rsn').map(String) : [], prevC = {}, prevBusy = '';
function applyFlags() { const h = new Set(hotL.map(x => x.k)), pr = new Set(promoL); P.forEach(p => { p.hot = h.has(pid(p)); p.pm = !!p.pc || pr.has(pid(p)) }) }
const prevMap = () => { const c = H.sid && prevC[H.sid]; return new Map(c ? c.items.map(x => [x.k, x]) : []) };
async function loadPrev(sid) { // «Брал раньше» для магазина: с сервера, запоминается на 10 минут
  const c = prevC[sid]; if (!sid || prevBusy == sid || (c && Date.now() - c.at < 6e5) || !CFG.API_URL || !tok || !navigator.onLine || srvV < 31) return;
  prevBusy = sid; try { const r = await call({ q: 'prev', sid }); prevC[sid] = { at: Date.now(), items: (Array.isArray(r.items) ? r.items : []).filter(x => x && typeof x.k == 'string').map(x => ({ k: x.k, q: nz(x.q), ts: nz(x.ts), c: nz(x.c) })) } } catch (e) { prevC[sid] = { at: Date.now() - 54e4, items: [] } } finally { prevBusy = '' }   // v33: ошибка — повтор не раньше чем через минуту (раньше перерисовка сразу запрашивала снова — запросы и мигание каталога по кругу)
  if (H.sid == sid) { drawChips(); if (!view) drawList() } }
function drawChips() {
  if (H.sid) loadPrev(H.sid);
  const sp = [FAV, ...(prevMap().size ? [PRV] : []), ...(P.some(p => p.hot) ? [HOT] : []), ...(P.some(p => p.pm) ? [PRM] : [])];   // особые вкладки — первыми; пустые не показываются
  if ([PRV, HOT, PRM].includes(cat) && !sp.includes(cat)) cat = 'Все';
  $('#chips').innerHTML = ['Все', ...sp, ...new Set(P.map(p => p.c))].map(c =>
    `<button class="chip${c == cat ? ' on' : ''}${sp.includes(c) ? ' sp' : ''}" data-a="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('');
}
const ctl = p => { const id = esc(pid(p)), q = qty(p); if (!p.pr) return `<button class="add" disabled>Нет цены ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}</button>`;   // кнопка «В заявку» или степпер
  return q ? `<div class="st"><button data-a="m" data-id="${id}">−</button><input data-q="${id}" inputmode="decimal" value="${qf(q)}"><button data-a="p" data-id="${id}">+</button></div>`
           : `<button class="add" data-a="p" data-id="${id}">${ico('plus', 18)} В заявку</button>`; };
function drawCv() { const b = $('#cvb'), l = UI.cv == 'list'; b.innerHTML = ico(l ? 'grid' : 'menu', 20) + '<span>' + (l ? 'Плитка' : 'Список') + '</span>'; if (b.setAttribute) b.setAttribute('aria-label', l ? 'Показать каталог плиткой' : 'Показать каталог списком') }   // кнопка показывает, на что переключит
function drawList() {
  const pv = prevMap(), l = P.filter(p => (cat == 'Все' || (cat == FAV ? isFav(p) : cat == HOT ? p.hot : cat == PRM ? p.pm : cat == PRV ? pv.has(pid(p)) : p.c == cat)) && p.n.toLowerCase().includes(Q)), el = $('#list');
  if (cat == PRV) l.sort((a, b) => pv.get(pid(b)).ts - pv.get(pid(a)).ts);   // «Брал раньше» — сначала то, что брали последним
  const bdg = p => p.hot || p.pm ? `<span class="pbg">${p.pm ? '<span class="pmb">Продвигаем</span>' : ''}${p.hot ? '<span class="hb">Ходовой</span>' : ''}</span>` : '';
  const pvl = p => { const x = pv.get(pid(p)); return x ? `<span class="pvl">в прошлый раз: ${qf(x.q)} ${esc(p.u)}, ${fd(isoDay(x.ts))}</span>` : '' };
  el.className = UI.cv == 'list' ? 'lst' : 'grid';   // v30: каталог плиткой (2 в ряд, крупное фото) или списком (одна строка на товар, кнопки 56 px)
  el.innerHTML = l.map((p, i) => `<article class="pc" style="--i:${Math.min(i, 8)}"><button class="fv${isFav(p) ? ' on' : ''}" data-a="fav" data-id="${esc(pid(p))}" aria-label="В избранное">${ico('star', 18)}</button><button class="ph" data-a="zoom" data-src="${esc(picU(p.f, 'z') || 'logo.jpg')}" data-o="${esc(p.f || 'logo.jpg')}" aria-label="Увеличить фото"><img src="${esc(picU(p.f, 't') || 'logo.jpg')}" data-o="${esc(p.f || 'logo.jpg')}" onerror="imgFb(this)" loading="lazy" decoding="async" alt="">${p.g ? `<span class="tag">${esc(p.g)}</span>` : ''}${bdg(p)}</button><div class="pb"><b>${esc(p.n)}</b>${p.g || p.hot || p.pm ? `<span class="gl">${esc([p.g, p.pm ? 'Продвигаем' : '', p.hot ? 'Ходовой' : ''].filter(Boolean).join(' · '))}</span>` : ''}<span class="pr">${p.pr ? tg(p.pr) : '—'} <small>/ ${esc(p.u)}</small></span>${pvl(p)}<div class="ctl" data-c="${esc(pid(p))}">${ctl(p)}</div></div></article>`).join('') || `<p class="empty">${cat == FAV ? 'Нажмите ★ на карточке товара — он появится здесь' : 'Ничего не найдено'}</p>`;
  el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); // перезапуск анимации
}
function setQ(p, v) {
  const k = pid(p), old = qty(p), prev = cart[k]; v = Math.max(0, Math.round(v * 100) / 100) || 0;
  if (!v) delete cart[k]; else cart[k] = { ...cart[k], q: v };
  if (!v && old) toast('Изменено: «' + p.n + '» убран', () => { cart[k] = prev; save(); bar(); drawList(); if (view == 'cart') cartView() });
  save(); bar(v > old);
  document.querySelectorAll(`[data-c="${CSS.escape(k)}"]`).forEach(e => { e.innerHTML = ctl(p); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop') });
  if (view == 'cart') cartView();
}
function bar(bump) {
  const n = lines().length; $('#clr').hidden = !n; $('#bar').classList.toggle('off', !n || view != '' && view != undefined && document.body.classList.contains('sh'));
  $('#bn').innerHTML = ico('bag', 24) + `<span class="bt"><small>${n} ${pl3(n, 'позиция', 'позиции', 'позиций')}</small><b>${tg(final())}</b></span>`; $('#bs').innerHTML = '<span>' + (eo ? 'К правке' : 'Оформить') + '</span>' + ico('chev', 18);   // v33: полоса заявки — сумма крупно, «Оформить» жёлтой кнопкой
  if (bump) { const b = $('#bar'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump') }
}

/* ============ 5. ТЕКСТ ЗАЯВКИ (строгий формат) ============ */
function text() {
  let t = `Заявка на ${fd(H.d)}${H.c ? ` (${H.c})` : ''} магазин ${H.s || ''}${H.a ? `, ${H.a}` : ''}\n`;   // v36.3: без «()» и висящей запятой, когда города или адреса нет
  lines().forEach(p => { const n = price(p);
    t += `${p.n}${p.g ? `(${p.g})` : ''} - ${qf(qty(p))}${p.u}${n != p.pr ? ` по ${n} (было ${p.pr})` : ''};\n`; });
  const label = CFG.SHOW_VAT_LABEL ? (S.mode == 'vat' ? ' (с НДС)' : ' (без НДС)') : '';
  return t + (disc > 0 ? `Сумма.${total()}\nИтого со скидкой.${final()}${label}` : `Итого.${total()}${label}`);
}

/* ============ 5б. ОТМЕНА ПОСЛЕДНЕГО ДЕЙСТВИЯ (всплывающее «Изменено» + «Отменить») ============ */
let selMode = false, selSet = new Set(), selSup = 0, toastGen = 0;   // v37: selMode — выбор точек в маршруте (долгое нажатие); selSup — до какого момента гасим нажатие после долгого; toastGen — номер показа плашки
let toastT = 0, toastFn = null, toastM = '', toastS = 0, leaving = false, lastBack = 0; const TOAST_U = 5;   // v37: «Отменить» в сообщении висит 5 с (v36.5 — 10, раньше — 7); плашку можно смахнуть в сторону   // leaving — намеренный уход (WhatsApp, перезагрузка): защиту не включаем
function toast(msg, undo) { // обратимые действия не переспрашиваем, а даём несколько секунд на отмену
  toastGen++; { const e0 = document.getElementById('toast'); if (e0 && e0.style) { e0.style.transition = ''; e0.style.transform = ''; e0.style.opacity = '' } }   // v37: после смахивания следующая плашка показывается как обычно
  let el = document.getElementById('toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; swipeToast(el); document.body.appendChild(el) }
  if (!undo && toastFn) { el.innerHTML = `<span>${esc(toastM)}<small class="t2">${esc(msg)}</small></span><button data-a="undo">Отменить</button><span class="tp" style="animation-duration:${TOAST_U}s;animation-delay:-${((Date.now() - toastS) / 1000).toFixed(2)}s"></span>`; return }   // v36.5: другое сообщение не стирает «Отменить»: оно идёт второй строкой, а время на отмену не продлевается и не сбрасывается
  toastFn = undo || null; toastM = undo ? msg : ''; toastS = Date.now(); el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button data-a="undo">Отменить</button><span class="tp" style="animation-duration:${TOAST_U}s"></span>` : ''}`; el.className = 'on';
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; toastFn = null; toastM = '' }, undo ? TOAST_U * 1000 : 3000);
}
function swipeToast(el) { // v37: плашку можно смахнуть в сторону — она исчезает, действие остаётся, «Отменить» пропадает
  let sx = 0, sy = 0, dx = 0, id = -1, mv = false;
  const reset = () => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; id = -1; mv = false };
  el.addEventListener('pointerdown', e => { if (!el.classList.contains('on') || (e.target && e.target.closest && e.target.closest('button'))) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; mv = false });
  el.addEventListener('pointermove', e => { if (e.pointerId !== id) return; dx = e.clientX - sx; const dy = e.clientY - sy;
    if (!mv) { if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { reset(); return } if (Math.abs(dx) < 8) return; mv = true; try { el.setPointerCapture(id) } catch (_) {} el.style.transition = 'none' }
    el.style.transform = 'translateX(' + dx + 'px)'; el.style.opacity = String(Math.max(.25, 1 - Math.abs(dx) / (el.offsetWidth || 320))) });
  const end = e => { if (e.pointerId !== id) return; const w = el.offsetWidth || 320;
    if (mv && Math.abs(dx) > Math.min(90, w * .3)) { const g = toastGen; el.style.transition = 'transform .18s,opacity .18s'; el.style.transform = 'translateX(' + (dx > 0 ? w : -w) + 'px)'; el.style.opacity = '0'; clearTimeout(toastT); toastFn = null; toastM = ''; id = -1; mv = false;
      setTimeout(() => { if (g === toastGen) { el.className = ''; reset() } }, 190) }
    else reset() };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', e => { if (e.pointerId === id) reset() });
}
/* ============ 5в. ОКНА: сообщение и вопрос в стиле приложения (вместо системных alert / confirm / prompt) ============
   say(текст) — сообщение с кнопкой «Понятно»; ask(текст, «Да»-надпись, «Нет»-надпись, опасно) — вопрос, ответ true/false; askText(вопрос) — строка или ''.
   Окна идут по очереди: второе появится, когда закроют первое. «Назад» на телефоне закрывает окно как «Отмена» */
let dlgQ = Promise.resolve(), dlgDone = null, dlgBk = 0;   // dlgBk — что вернуть на «назад» телефона (обычно 0 = «Отмена»)
function dlgShow(msg, btns, input, bk) {
  const run = () => new Promise(res => { const el = $('#dlg'); dlgBk = bk == null ? 0 : bk;
    dlgDone = i => { dlgDone = null; const t = input ? String(($('#dlgi').value || '')).trim() : ''; el.hidden = true; el.innerHTML = ''; document.body.classList.remove('dlgon'); res(input ? (i > 0 ? t : '') : i) };
    const nl = msg.indexOf('\n'), t1 = nl < 0 ? msg : msg.slice(0, nl), t2 = nl < 0 ? '' : msg.slice(nl + 1).trim();   // v33: первая строка — заголовок, остальные — подписью ниже
    el.innerHTML = `<div class="dlb" role="alertdialog" aria-modal="true" aria-labelledby="dlgt"><p id="dlgt">${esc(t1)}</p>${t2 ? `<p class="dls">${esc(t2)}</p>` : ''}${input ? `<input id="dlgi" maxlength="60" placeholder="${esc(input)}">` : ''}<div class="dla">${btns.map((b, i) => `<button data-a="dlg" data-v="${i}" class="${b.c || ''}">${b.i ? ico(b.i, 20) : ''}${esc(b.t)}</button>`).join('')}</div></div>`;
    el.hidden = false; document.body.classList.add('dlgon'); const f = document.getElementById(input ? 'dlgi' : 'dlgt'); if (f && f.focus) try { f.focus() } catch (_) {} });
  const p = dlgQ.then(run); dlgQ = p.catch(() => {}); return p;
}
function say(m) { return dlgShow(String(m), [{ t: 'Понятно', c: 'ok' }]) }
function ask(m, yes, no, danger) { return dlgShow(String(m), [{ t: no || 'Отмена', c: 'no' }, { t: yes || 'Да', c: danger ? 'ok bad' : 'ok' }]).then(i => i == 1) }
function askVat(m, send, sw) { return dlgShow(String(m), [{ t: sw, c: 'no' }, { t: send, c: 'ok acc', i: 'send' }, { t: 'Вернуться к заявке', c: 'q' }], '', -1).then(i => i == 1 ? 'send' : i == 0 ? 'switch' : 'back') }   // вопрос о режиме цен: «Отправить …» / «Переключить на …» / «Вернуться к заявке» (v33, DECISIONS п. 50; то же, что «назад» телефона) — ничего не меняя
function askText(m, ph) { return dlgShow(String(m), [{ t: 'Отмена', c: 'no' }, { t: 'Добавить', c: 'ok' }], ph || ' ') }
const snap = () => ({ cart: JSON.stringify(cart), disc, eo, eob, msw, H: JSON.stringify(H) });   // снимок заявки для отмены
function unsnap(z) { cart = JSON.parse(z.cart); disc = z.disc; eo = z.eo; eob = z.eob == null ? null : z.eob; msw = z.msw || ''; H = JSON.parse(z.H); save(); fill(); bar(); drawList(); if (view == 'cart') cartView() }

/* ============ 6. ШТОРКА: корзина, история, настройки ============ */
/* Разделы (нижняя панель): Маршрут / Заявка / История / Профиль (v33: бывшее «Ещё»). Страница раздела открывается поверх каталога; кнопка «Назад» ведёт на уровень выше */
const TAB = { shops: 'route', rplan: 'route', rall: 'route', shopc: 'route', shop: 'route', shopn: 'route', hist: 'hist', hd: 'hist', more: 'more', set: 'more', adm: 'more', dr: 'more', cart: 'main', promo: 'more' };
const BACK = { shopc: () => shopsView(), shop: () => shopCard(skey(eSh)), shopn: () => shopsView(), rplan: () => { rtAdd = false; shopsView() }, rall: () => shopsView(), pick: () => pkBack(), hd: () => histView(),
  set: () => moreView(), promo: () => moreView(), dr: () => moreView(), adm: () => moreView(), cart: () => { closeSheet(); drawList() } };
function navSync() { const t = view ? TAB[view] || '' : 'main';
  document.querySelectorAll('.bn button').forEach(b => b.classList.toggle('on', b.dataset.t == t));
  document.body.classList.toggle('lock', (view == 'auth' && needLogin()) || view == 'pend') }   // вход и вопрос «Отправлено?» — без панели разделов
function openSheet(v, title) { view = v; selMode = false; selSet = new Set(); $('#st').textContent = title; const sh0 = document.getElementById('sheet'); if (sh0) { sh0.classList.remove('hero'); sh0.classList.remove('tl0'); sh0.classList.remove('pfsh') } const k = $('#sbk'); k.hidden = !BACK[v]; k.innerHTML = ico('back', 20) + '<span>' + (v == 'cart' ? 'К каталогу' : 'Назад') + '</span>';
  document.body.classList.add('sh'); const sh = document.getElementById('sheet'); if (sh) sh.scrollTop = 0; navSync(); bar() }
function goHome() { if (needLogin()) return authView(); shMode = 'route'; rtDay = -1; rtAdd = false; rvK = ''; shopsView() }   // стартовая страница — маршрут на сегодня
function todayInfo() { // v33: «Сегодня» в профиле — точки маршрута и свои заявки за сегодня
  try { const cur = base.filter(b => inToday(b)), t0 = dayMs(Date.now()), L = allHist().filter(x => !x.del && isMine(x) && dayMs(x.ts || 0) == t0);
    return { done: cur.filter(b => doneToday(b)).length, all: cur.length, n: L.length, sum: L.reduce((a, x) => a + nz(x.sum), 0) } } catch (e) { return null } }
function moreView() { openSheet('more', 'Профиль'); const shp = document.getElementById('sheet'); if (shp) shp.classList.add('pfsh');   // v37.3: логотип и версия — внизу окна   // v33: макет «Профиль» — карточка с именем и «Сегодня», плитки, вид, блок администратора, «Выйти»
  const tile = (a, ic, t, sub, cls) => `<button class="mtl${cls ? ' ' + cls : ''}" data-a="${a}"><span class="mti">${ico(ic, 22)}</span><span class="mtt"><b>${t}</b><span class="m">${sub}</span></span></button>`;
  const d = todayInfo(), adm2 = CFG.API_URL && tok && role == 'admin';
  const nq = qN(), card = !CFG.API_URL ? '' : tok && me ? `<div class="pfc"><span class="pfh"><span class="pfa">${esc(me.slice(0, 1).toUpperCase())}</span><span class="pft"><b>${esc(me)}</b><span>${role == 'admin' ? 'Администратор' : 'Торговый'}</span></span><button class="pfx" data-a="out">Выйти</button></span>${d ? `<span class="pfd">Сегодня: <b>${d.done} из ${d.all}</b> ${pl3(d.all, 'точки', 'точек', 'точек')} · <b>${d.n}</b> ${plZ(d.n)} · <em>${tg(d.sum)}</em></span>` : ''}${nq ? `<span class="pfd pfq">Ждут отправки: <b>${nq}</b>. Выйти можно после отправки: эти данные записаны от имени «${esc(me)}».</span>` : ''}</div>`   // v36: «Выйти» — в карточке; отдельного экрана «Профиль» больше нет
    : `<div class="pfc"><span class="pfh"><span class="pfa">${ico('user', 22)}</span><span class="pft"><b>Вход не выполнен</b><span>${qN() ? 'ждут отправки: ' + qN() : 'войдите, чтобы отправлять заявки'}</span></span></span><button class="send acc" data-a="auth">Войти</button></div>`;
  $('#sb').innerHTML = card + `<div class="mtg">${tile('drafts', 'folder', 'Черновики', drafts.length ? 'сохранено: ' + drafts.length : 'пока пусто', 'acc')}${tile('set', 'sliders', 'Настройки', 'города, прайс, данные')}</div>`
    + (adm2 ? `<div class="pfs"><span>АДМИНИСТРАТОР</span></div><div class="mtg">${tile('adm', 'user', 'Доступ и профили', 'приглашения, роли, проверка', 'adm')}${srvV >= 31 ? tile('promo', 'star', 'Продвигать товары', promoL.length ? 'отмечено: ' + promoL.length : 'ничего не отмечено', 'adm') : ''}</div>` : '')
    + (standalone ? '' : `<button class="pfi" data-a="inst">${ico('plus', 20)}<span class="mtt"><b>Установить на главный экран</b><span class="m">значок приложения на телефоне</span></span></button>`)
    + `<div class="pff"><span class="pfl"><img src="logo.jpg" alt="Логотип Али-Баба"></span><span class="m">Али-Баба · версия ${VER}</span></div>`;
}
const needLogin = () => !!CFG.API_URL && !tok && !LS('pending');   // входа нет (не входили, вышли или сервер отозвал доступ); неотвеченный вопрос «Отправлено?» важнее экрана входа
function closeSheet() { if (view == 'auth' && needLogin()) return; saveSet(); selMode = false; selSet = new Set();   // экран входа нельзя смахнуть: без входа приложением не пользуются
  view = ''; editId = ''; admCode = null; document.body.classList.remove('sh'); navSync(); bar(); if (needLogin()) authView() }   // приглашение, показанное администратору, не переживает закрытия окна
function drawRc() { // выбор получателя в шапке — такой же селектор, как город; автоподбор по городу, можно сменить
  const el = $('#rch'); if (!rcp.length) { el.hidden = true; return } const c = rcPick(); el.hidden = false;
  el.innerHTML = rcp.map(r => `<option value="${esc(r.n)}">Кому: ${esc(r.n)}</option>`).join(''); el.value = c.n }
function rcPick() { // получатель: выбранный вручную, иначе подходящий по городу (приоритет: город указан → по умолчанию), иначе запасной номер из настроек
  if (!rcp.length) return { n: '', p: S.op, c: [] };
  const x = H.r && rcp.find(r => r.n == H.r); if (x) return x;
  const c = norm(H.c), sc = r => (r.c.length ? (r.c.some(k => norm(k) == c) ? 2 : -9) : 0) + (r.d ? 1 : 0), L = rcp.map(r => [sc(r), r]).sort((a, b) => b[0] - a[0]);
  return L[0][1];
}
const rcBlock = () => rcp.length < 2 ? '' : `<p class="m rcb">Получатель: <b>${esc(rcPick().n || 'запасной номер')}</b> · меняется на главном экране, под адресом</p>`;
let npAt = 0;   // v34: когда цену сохранили по касанию «Готово» / Enter
document.addEventListener('pointerdown', e => { const b = e.target && e.target.closest ? e.target.closest('[data-a="pdone"]') : null, t = b && document.querySelector('[data-np]'); if (!t || !editId) return;
  e.preventDefault(); npAt = Date.now(); commitNp(t) });   // касание «Готово»: сохраняем сразу, поле не теряет фокус — нет «change» с перерисовкой, из-за которой нажатие попадало в новую разметку («Цена») и поле открывалось снова
document.addEventListener('click', e => { if (!editId) return; const t = document.querySelector('[data-np]'), x = e.target; if (!t || (x && x.closest && x.closest('.npr'))) return; commitNp(t) }, true);   // v36.2: касание мимо поля цены — сохранить (если меняли) и закрыть. На click, а не pointerdown: перерисовка до click уводила нажатие на другую кнопку (v34)
document.addEventListener('keydown', e => { const t = e.target; if (e.key == 'Enter' && t && t.dataset && t.dataset.np !== undefined) { e.preventDefault(); npAt = Date.now(); commitNp(t) } });
function commitNp(t) { // новая цена позиции: из поля ввода (по «Готово» или при уходе из поля)
  const n = num(t.value), id = t.dataset.np; if (editId != id) return; if (!(n > 0) && String(t.value).trim() !== '') toast('Цена должна быть больше 0 — оставлена прежняя');   // v36.3: раньше молча
  if (n > 0 && cart[id] && find(id)) { n == find(id).pr ? delete cart[id].p : cart[id].p = n; save() } editId = ''; bar(); cartView() }
function vatBar() { // v33: режим цен — переключатель на всю ширину; под ним — откуда взята норма точки или предупреждение, что режим не совпадает
  const nm = vatNorm(curShop(), eo), m = S.mode;
  const hint = nm && nm.m != m ? `<div class="sw q">${nm.set ? 'В карточке магазина выбрано: ' + ML[nm.m] : 'Последняя заявка в этот магазин была ' + ML[nm.m]}</div>` : nm ? `<p class="m vth">${nm.set ? 'Как выбрано в карточке магазина' : 'Как в прошлой заявке в эту точку'}</p>` : '';
  return `<div class="vatb"><div class="seg">${['vat', 'net'].map(k => `<button data-a="mode" data-v="${k}" class="${m == k ? 'on' : ''}">${k == 'vat' ? 'Цены с НДС' : 'без НДС'}</button>`).join('')}</div>${hint}</div>`;
}
let tOpen = false;   // v34: раскрыть «Время заявки» один раз (после вопроса о прошедшей поставке)
function cartView() { // v30: оформление по порядку — режим цен, магазин и дата, позиции, скидка и итог, время заявки, отправка. v33: вид — макет «Оформление заявки»
  if (view != 'cart') openSheet('cart', 'Ваша заявка'); const sh = document.getElementById('sheet'); if (sh) sh.classList.add('tl0');   // v33: заголовок крупно в странице, сверху только «К каталогу»
  const L = lines();
  if (!L.length) { $('#sb').innerHTML = `<div class="empt">${ico('bag', 40)}<b>Заявка пуста</b><p class="m">Добавьте товары из каталога.</p></div><button class="send" data-a="nmain">К каталогу</button>`; return }
  const eoo = eo && histById(eo), banner = eo ? `<div class="sw q ckeo"><b>Правка заявки «${esc(eoo ? eoo.h.s : '')}»${eoo ? ' от ' + ft(eoo.ts) : ''}</b><span>Старая версия будет заменена.</span><button class="ghost" data-a="eoc">Отменить правку</button></div>` : '';
  const who = H.s ? `<div class="ckh"><div class="ckt"><small>МАГАЗИН</small><b>${esc(H.s)}</b>${H.a || H.c ? `<span class="m">${esc(H.a || H.c)}</span>` : ''}</div><button class="ocb" data-a="ochg">Сменить</button></div>`
    : `<div class="ckt"><small>МАГАЗИН</small><div class="sw bad">Магазин не указан</div><button class="ghost" data-a="ochg">Указать магазин</button></div>`;
  const dBlock = `<div class="sum ck">${who}<label class="ckd"><b class="ckl">Дата поставки</b><span class="ckdv"><span>${esc(fdw(H.d))}</span>${ico('cal', 20)}<input type="date" id="cd" min="${eo ? '' : minD()}" value="${esc(H.d || '')}" aria-label="Дата поставки"></span></label>${!H.dm && H.t > 0 ? '<p class="m ckdh">Поставка пересчитана от даты заявки</p>' : ''}</div>`;
  const items = L.map(p => { const id = esc(pid(p)), n = price(p), ch = n != p.pr, ed = editId == pid(p);
    const npr = ed ? `<div class="npr"><input class="np" data-np="${id}" inputmode="decimal" value="${n}" aria-label="Новая цена"><button class="ib2 ok" data-a="pdone" data-id="${id}">Готово</button></div>` : '';   // v36.2: поле цены — отдельной строкой во всю ширину (в колонке с названием на 320 px оставалось 32 px)
    const pr = ed ? `<span class="m">${p.g ? esc(p.g) + ' · ' : ''}новая цена за ${esc(p.u)}:</span>`
      : ch ? `<span class="ipc"><s>${fm(p.pr)}</s><b>${tg(n)} / ${esc(p.u)}</b></span><small class="m">цена изменена</small>`
      : `<span class="m">${p.g ? esc(p.g) + ' · ' : ''}${tg(n)} / ${esc(p.u)}</span>`;
    return `<div class="it"><div class="ckr"><img src="${esc(picU(p.f, 't') || 'logo.jpg')}" data-o="${esc(p.f || 'logo.jpg')}" onerror="imgFb(this)" decoding="async" alt=""><div class="in"><b>${esc(p.n)}</b>${pr}</div><b class="ls">${tg(Math.round(n * qty(p)))}</b></div>${npr}
    <div class="cka"><div class="st"><button data-a="m" data-id="${id}" aria-label="Меньше">−</button><input data-q="${id}" inputmode="decimal" value="${qf(qty(p))}" aria-label="Количество"><button data-a="p" data-id="${id}" aria-label="Больше">+</button></div><span class="sp"></span>${ed ? '' : `<button class="lnk" data-a="edit" data-id="${id}" aria-label="Изменить цену">Цена</button>`}${ch && !ed ? `<button class="lnk" data-a="reset" data-id="${id}">Вернуть цену</button>` : ''}<button class="lnk bad" data-a="rm" data-id="${id}">Убрать</button></div></div>`; }).join('');
  const sum = `<div class="sum cks"><b>Скидка на весь чек</b><div class="dc">${[0, 3, 5, 10].map(x => `<button data-a="disc" data-v="${x}" class="${disc == x ? 'on' : ''}">${x ? x + '%' : 'Нет'}</button>`).join('')}<input id="dc" inputmode="decimal" placeholder="свой" value="${[0, 3, 5, 10].includes(disc) ? '' : disc}" aria-label="Своя скидка, %"></div>
  <div class="ckt2"><div class="r"><span class="m">Сумма</span><b>${tg(total())}</b></div>${disc > 0 ? `<div class="r"><span class="m">Скидка ${disc}%</span><b>−${tg(total() - final())}</b></div>` : ''}</div><div class="r t"><span>Итого</span><span>${tg(final())}</span></div><div class="m ckm">цены ${ML[S.mode]}</div></div>`;
  const asB = asOn() ? (() => { const cur = asSel(eo && histById(eo)), names = [...new Set([me, ...trs, cur].filter(Boolean))].sort((x, y) => x == me ? -1 : y == me ? 1 : x.localeCompare(y, 'ru'));   // v36: администратор оформляет или переназначает заявку от имени торгового
    if (!asOpen && norm(cur) == norm(me)) return `<div class="asl"><span class="m">От имени: <b>${esc(cur)} (я)</b></span><button class="lnk" data-a="asop">изменить</button></div>`;
    return `<div class="sum ck cas"><label class="ckd"><b class="ckl">От имени</b><select id="cas" aria-label="От имени торгового">${names.map(n => `<option value="${esc(n)}" ${n == cur ? 'selected' : ''}>${esc(n)}${n == me ? ' (я)' : ''}</option>`).join('')}</select></label>${norm(cur) != norm(me) ? `<p class="m ckdh">Заявка засчитается торговому «${esc(cur)}»; в журнале будет видно, что оформили вы</p>` : ''}</div>` })() : '';
  const tBlock = `<details class="sc ck"${H.t > 0 || tOpen ? ' open' : ''}><summary>${ico('clock', 22)}<span class="cst">Время заявки<small class="m">${H.t > 0 ? 'указано вручную: ' + ft(H.t) : 'сейчас · менять, если приняли раньше'}</small></span></summary><input type="datetime-local" id="ots" max="${dtl(Date.now())}" value="${dtl(H.t > 0 ? H.t : Date.now())}"><p class="m" style="margin:6px 0 10px">Меняйте, только если заявку приняли раньше, а вносите сейчас.</p></details>`;
  $('#sb').innerHTML = `<h3 class="ckhd">Ваша заявка</h3><p class="m ckc">${L.length} ${pl3(L.length, 'позиция', 'позиции', 'позиций')}</p>` + vatBar() + banner + dBlock + asB + tBlock + `<div class="cki">${items}</div>` + sum +
    `${rcBlock()}${eo ? `<button class="send" data-a="esave">${ico('check', 20)} Сохранить изменение</button>` : `<button class="send" data-a="send">${ico('send', 22)} Отправить в WhatsApp</button>`}<button class="ghost" data-a="dsave">Сохранить как черновик</button>${eo ? '<button class="lnk clr2" data-a="eoc">Отменить правку</button>' : `<button class="lnk bad clr2" data-a="new">${ico('trash', 18)} Очистить заявку</button>`}`;   // v34: в правке «Очистить» только выходила из правки — путали с удалением
  tOpen = false; const np = document.querySelector('[data-np]'); if (np) np.select();
}
let asOpen = false;
const asOn = () => !!(CFG.API_URL && tok && role == 'admin' && srvV >= 36);   // v36: выбор «От имени» — только администратору и только при Code.gs 36
const asSel = old => asOn() ? (H.as || (eo && old ? trOf(old) || me : me)) : '';
const dtl = t => { const d = new Date(t); return new Date(t - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) };   // местное время в формате поля datetime-local
const ft = ts => ts ? new Date(ts).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
/* v35. «История» — история и итоги одним блоком (по образцу «Финансов»): период — день / неделя (с понедельника) / месяц / год, листается ‹ ›.
   Итоги за этот же период считает сервер (q: 'per'; торговый — свои, администратор — все или выбранного торгового) — те же заявки, что в списке, поэтому числа сходятся.
   Список — из загруженного окна (свои 30 дн., чужие 7 дн.) или с сервера за период (q: 'range'); год — по месяцам, нажатие открывает месяц */
const HP = [['d', 'День'], ['w', 'Неделя'], ['m', 'Месяц'], ['y', 'Год']], MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
let hP = HP.some(x => x[0] == LS('hp')) ? LS('hp') : 'd', stC = null, stBusy = '', stErr = '';   // stC — итоги по ключу «кто|период|начало» (сбрасывается, когда сервер принял заявку или удаление)
function pRange(p, t) { const d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0);   // [начало, конец) периода, в который попадает момент t, в местном времени
  if (p == 'w') d.setDate(d.getDate() - (d.getDay() + 6) % 7); else if (p == 'm') d.setDate(1); else if (p == 'y') d.setMonth(0, 1);
  const e = new Date(d); if (p == 'd') e.setDate(e.getDate() + 1); else if (p == 'w') e.setDate(e.getDate() + 7); else if (p == 'm') e.setMonth(e.getMonth() + 1); else e.setFullYear(e.getFullYear() + 1);
  return [d.getTime(), e.getTime()] }
const pShift = (p, a, k) => { const d = new Date(a); if (p == 'd') d.setDate(d.getDate() + k); else if (p == 'w') d.setDate(d.getDate() + 7 * k); else if (p == 'm') d.setMonth(d.getMonth() + k); else d.setFullYear(d.getFullYear() + k); return pRange(p, d.getTime() + 6 * 36e5)[0] };
const dMon = t => new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '');   // «16 окт»
function lblDay(d) { const t0 = dayMs(Date.now()); return d == t0 ? 'Сегодня · ' + dMon(d) : d == dayMs(Date.now() - 864e5) ? 'Вчера · ' + dMon(d) : new Date(d).toLocaleDateString('ru', { weekday: 'short' }) + ', ' + dMon(d) }
function pLabel(p, a) { const d = new Date(a), cur = pRange(p, Date.now())[0];
  if (p == 'd') return lblDay(a);
  if (p == 'w') { const e = new Date(a); e.setDate(e.getDate() + 6); const r = d.getMonth() == e.getMonth() ? d.getDate() + '–' + dMon(e.getTime()) : dMon(a) + ' – ' + dMon(e.getTime());
    return (a == cur ? 'Эта неделя · ' : a == pShift('w', cur, -1) ? 'Прошлая неделя · ' : '') + r }
  if (p == 'm') return MN[d.getMonth()] + ' ' + d.getFullYear();
  return String(d.getFullYear()) }
const TOD = { d: 'К сегодняшнему дню', w: 'К этой неделе', m: 'К этому месяцу', y: 'К этому году' };
async function loadPer(key, body) { // итоги периода с сервера; повтор — не чаще раза в минуту, ошибка не повторяется по кругу из перерисовки
  if (stBusy || !CFG.API_URL || !tok || srvV < 35) return; stC = stC || {}; const c = stC[key]; if (c && Date.now() - c.at < 6e4) return;
  if (!navigator.onLine) { stErr = 'нет связи'; return } if (c && c.err && Date.now() - c.at < 15e3) return;
  stBusy = key; try { const r = await call(Object.assign({ q: 'per' }, body)); (stC = stC || {})[key] = r && r.ok && r.cur ? { at: Date.now(), d: r } : { at: Date.now(), err: 'сервер не отдал итоги' }; stErr = '' }
  catch (e) { (stC = stC || {})[key] = { at: Date.now(), err: e && e.message || 'ошибка' } } finally { stBusy = '' }
  if (view == 'hist') histView() }
const needP = (k, a, mine) => !!(CFG.API_URL && a < winFrom(mine) && !(dayC[k] && Date.now() - dayC[k].t < 12e4));   // период начинается раньше загруженного окна — нужен запрос
async function loadRange(k, a, e) { const r = await call({ q: 'range', from: a, to: e, undo: CFG.UNDO_HOURS }); dayC[k] = { t: Date.now(), hist: safeL(r.hist) } }
function histView() { // вкладки «Мои» / «Все заявки»; период и листание; итоги периода; заявки периода; ниже — «Недавно удалённые» (свои; у администратора — и чужие, удалённые им)
  openSheet('hist', 'История'); const now = Date.now(), win = CFG.UNDO_HOURS * 36e5, mine = histTab == 'mine', p = hP;
  histDay = pRange(p, histDay || now)[0]; const a = histDay, e = pRange(p, a)[1], cur0 = pRange(p, now)[0], k = 'p:' + a + ':' + e, yr = p == 'y';
  if (!yr && needP(k, a, mine) && !dayBusy && dayErr != k) { dayBusy = k;   // период старше загруженного окна — заявки за него с сервера
    loadRange(k, a, e).then(() => { if (dayErr == k) dayErr = 0 }).catch(() => { dayErr = k }).finally(() => { dayBusy = 0; if (view == 'hist') histView() }) }
  const all = allHist(), inP = x => (x.ts || 0) >= a && (x.ts || 0) < e, loading = !yr && needP(k, a, mine) && dayErr != k, failed = !yr && needP(k, a, mine) && dayErr == k;
  const inT = x => mine || !hTr || trOf(x) == hTr, act = yr ? [] : all.filter(x => !x.del && (!mine || isMine(x)) && inP(x) && inT(x)), trash = mine ? all.filter(x => x.del && now - x.del < win && (isMine(x) || (canDel(x) && delByMe(x)))) : [];   // v34: у администратора — и чужие, удалённые им
  const left = x => { const m = Math.max(1, Math.round((win - (now - x.del)) / 6e4)); return m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин' : m + ' мин' };
  const nMine = all.filter(x => !x.del && isMine(x) && inP(x)).length, nAll = all.filter(x => !x.del && inP(x) && (!hTr || trOf(x) == hTr)).length;
  const names = [...new Set([...trs, ...all.map(x => x.trader)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), trSel = CFG.API_URL && !mine ? `<select id="htr" class="htrs"><option value="">Все торговые</option>${names.map(n => `<option ${n == hTr ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';
  const tabs = CFG.API_URL ? `<div class="seg htab">${[['mine', 'Мои' + (yr ? '' : ' (' + nMine + ')')], ['all', 'Все заявки' + (yr ? '' : ' (' + nAll + ')')]].map(([k, t]) => `<button data-a="htab" data-v="${k}" class="${histTab == k ? 'on' : ''}">${t}</button>`).join('')}</div>` : '';
  const sumAll = act.reduce((s, x) => s + (+x.sum || 0), 0), stats = yr ? '' : loading ? 'Загружаю…' : failed ? '—' : act.length + ' ' + plZ(act.length) + ' · ' + tg(sumAll);
  const tm = ts => p == 'd' ? new Date(ts || 0).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : ft(ts);   // день — только время
  const seg = `<div class="seg sg4 hps">${HP.map(([q, t]) => `<button data-a="hp" data-v="${q}" class="${p == q ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const plate = `<div class="day"><button class="dnb" data-a="dprev" aria-label="Назад">${ico('back', 22)}</button><label class="dl"><span>${esc(pLabel(p, a))}</span><small>${stats}</small><input type="date" id="dp" value="${isoDay(a)}" max="${isoDay(dayMs(now))}" aria-label="Выбрать дату"></label><button class="dnb" data-a="dnext" ${a >= cur0 ? 'disabled' : ''} aria-label="Вперёд">${ico('chev', 22)}</button></div><div class="dsw">${a != cur0 ? `<button class="lnk dall dtd" data-a="dtoday">${TOD[p]}</button>` : ''}</div>`;
  // итоги периода — с сервера; без сервера (или старый Code.gs) — по списку на устройстве
  const who = mine ? 'me' : hTr || '*', pv = pShift(p, a, -1), bks = yr ? MN.map((x, i) => [new Date(new Date(a).getFullYear(), i, 1).getTime(), new Date(new Date(a).getFullYear(), i + 1, 1).getTime()]) : [], sk = who + '|' + p + '|' + a;
  if (CFG.API_URL && tok && srvV >= 35) loadPer(sk, { cur: [a, e], prev: [pv, a], bk: bks, who });
  const sc = stC && stC[sk], d = sc && sc.d, nn = z => nz(z.n) + ' ' + plZ(nz(z.n)), whoL = mine ? 'мои заявки' : hTr ? esc(hTr) : 'все торговые';   // v36: итоги всех видны всем
  const tot = !CFG.API_URL || !tok || srvV < 35 ? (yr ? '' : `<div><div class="stn">${tg(sumAll)}</div><div class="m">${nn({ n: act.length })} · по заявкам на устройстве</div></div>`)
    : !d ? `<div class="m">${sc && sc.err ? 'Итоги не загрузились: ' + esc(sc.err) : stErr ? 'Итоги не загрузились: ' + esc(stErr) : 'Загружаю итоги…'}</div>`
    : `<div><div class="stn">${tg(d.cur.sum)}</div><div class="m">${nn(d.cur)}</div></div><div class="stpv"><span><span>${esc(pLabel(p, pv))}</span><small>${nn(d.prev)}</small></span><b>${tg(d.prev.sum)}</b></div>`   // прошлый такой же период — его же подписью («Прошлая неделя · 5–11 окт», «Сентябрь 2026»)
      + (d.all && d.cur.by ? `<div class="stb">${Object.keys(d.cur.by).sort((x, y) => nz(d.cur.by[y].sum) - nz(d.cur.by[x].sum)).map(n => `<div class="r"><span>${esc(n)}</span><b>${tg(d.cur.by[n].sum)} <small class="m">· ${nn(d.cur.by[n])}</small></b></div>`).join('') || '<div class="m">Заявок нет</div>'}</div>` : '');
  const sts = tot ? `<div class="sts"><div class="sth"><b class="stt">Итоги</b><span>${whoL}</span></div>${tot}</div>` : '';
  const emptyMsg = loading ? '<p class="empty">Загружаю заявки за этот период…</p>' : failed ? '<p class="empty">Нет связи: заявки за этот период не загружены.<br><button class="ocb" data-a="dretry" style="margin-top:12px">Повторить</button></p>' : '<p class="empty">' + (p == 'd' ? 'За этот день заявок нет' : 'За этот период заявок нет') + '</p>';
  const card = x => `<div class="hc"><button class="hch" data-a="hd" data-v="${esc(x.id)}"><span class="hct"><b>${esc(x.h.s || '—')}${x.h.a && sameName(x.h.s, x.h.c).length > 1 ? ' · ' + esc(x.h.a) : ''} ›</b>${!mine || !isMine(x) || x.by || x.as ? `<span class="m who">${ico('user', 14)} ${trLbl(x)}</span>` : ''}<span class="m">Создана ${tm(x.ts)}${x.ed ? ' · изменена ' + ft(x.ed) : ''} · поставка ${fd(x.h.d)}${!mine && x.h.c ? ' · ' + esc(x.h.c) : ''}</span></span><b class="amt">${tg(x.sum)}</b></button>${CFG.API_URL && outbox.some(y => y.id == x.id) ? `<div class="hcp">${pendChip()}${syncErr ? '<button data-a="sretry" class="rtry">Отправить ещё раз</button>' : ''}</div>` : ''}
    <div class="hcb"><button class="hrep" data-a="rep" data-v="${esc(x.id)}">Заказать снова</button>${canEdit(x) ? `<button class="hed" data-a="hedit" data-v="${esc(x.id)}" aria-label="Изменить заявку">${ico('edit', 16)} Изменить</button>` : ''}${canDel(x) ? `<button class="x" data-a="hdel" data-v="${esc(x.id)}" aria-label="Удалить заявку">${ico('trash', 18)}</button>` : ''}</div></div>`;
  const tLeft = trash.length ? trash.reduce((a, x) => x.del > a.del ? x : a) : null;   // «вернуть можно ещё …» — по последней удалённой
  let list = '';
  if (yr) { const y = new Date(a).getFullYear(), bk = d && Array.isArray(d.bk) ? d.bk : null;   // год — по месяцам: сумма и число заявок, нажатие открывает месяц
    list = `<div class="hmy">${MN.map((m, i) => { const t = new Date(y, i, 1).getTime(); if (t > now) return ''; const z = bk && bk[i]; return `<button class="hmr" data-a="hpm" data-v="${t}"><span>${m}</span><small class="m">${z ? nn(z) : ''}</small><b>${z ? tg(z.sum) : '…'}</b></button>` }).reverse().join('')}</div>` }
  else { let last = -1; list = act.map(x => { const dd = dayMs(x.ts || 0), h = p != 'd' && dd != last ? (last = dd, (() => { const z = act.filter(y => dayMs(y.ts || 0) == dd); return `<h3 class="sub hdd">${esc(lblDay(dd))} · ${z.length} · ${tg(z.reduce((s, y) => s + (+y.sum || 0), 0))}</h3>` })()) : ''; return h + card(x) }).join('') || emptyMsg }   // неделя и месяц — по дням
  $('#sb').innerHTML = tabs + trSel + seg + plate + sts + `<div class="hcl">${list}</div>`
  + (trash.length ? `<details class="htr"><summary>${ico('trash', 20)}<span><b>Недавно удалённые: ${trash.length}</b> · вернуть можно ещё ${left(tLeft)}</span></summary>` + trash.map(x => `<div class="hc hcd"><div class="hch"><span class="hct"><b>${esc(x.h.s || '—')}</b><span class="m">${ft(x.ts)} · ${tg(x.sum)}${isMine(x) ? '' : ' · ' + esc(x.trader)}</span><span class="m">Можно вернуть ещё ${left(x)}</span>${delq.some(o => o.id == x.id) ? '<span class="m">' + pendChip() + ' (удаление)</span>' : ''}</span><button class="ocb" data-a="hres" data-v="${esc(x.id)}">Вернуть</button></div></div>`).join('') + '</details>' : '');
}
/* v31. «Продвигать товары» (только администратор): отметка хранится на листе «Продвигать» и сразу видна торговым после синхронизации */
let prQ = '', prBusy = false;
function promoList() {
  const pr = new Set(promoL), q = norm(prQ), keys = new Set(P.map(pid)), L = P.filter(p => norm(p.n).includes(q)).sort((a, b) => (pr.has(pid(b)) - pr.has(pid(a))) || a.n.localeCompare(b.n, 'ru')).slice(0, 80), lost = promoL.filter(k => !keys.has(k));
  const row = (k, name, sub, on) => `<div class="rr prr"><div class="rn"><b>${esc(name)}</b>${sub ? `<span class="m">${sub}</span>` : ''}</div><div class="rbs"><button class="rb2 ${on ? 'no' : 'v'}" data-a="prm" data-id="${esc(k)}" data-v="${on ? 0 : 1}">${on ? ico('x', 18) + '<span>Убрать</span>' : ico('star', 18) + '<span>Продвигать</span>'}</button></div></div>`;
  return (L.map(p => row(pid(p), p.n, esc([p.g, p.u].filter(Boolean).join(' · ')) + (p.pc ? ' · отмечен в прайсе' : ''), pr.has(pid(p)))).join('') || '<p class="empty">Ничего не найдено</p>')
    + (lost.length ? '<h3 class="sub">Нет в прайсе (переименован или убран)</h3>' + lost.map(k => row(k, k.split('|')[0], esc(k.split('|').slice(1).join(' · ')), true)).join('') : '') }
function promoView() { openSheet('promo', 'Продвигать товары');
  $('#sb').innerHTML = `<p class="m" style="margin:0 2px 10px">Отмеченные товары видны всем торговым во вкладке «Продвигать» и с меткой «Продвигаем». Отмечать можно и в колонке «Продвигать» прайса.</p><input id="prq" type="search" placeholder="Найти товар" value="${esc(prQ)}" style="margin-bottom:12px"><div id="prl">${promoList()}</div>` }
function histDetail(id) { // полная карточка заявки. v33: шапка как у карточки магазина, позиции и итог — как в оформлении
  const x = histById(id); if (!x) return; openSheet('hd', 'Заявка'); const R = (k, v) => `<div class="r"><span class="m">${k}</span><b>${v}</b></div>`, pend = CFG.API_URL && outbox.some(y => y.id == x.id);
  const rows = x.items ? x.items.map(t => `<div class="hdi"><span class="hdt"><b>${esc(t.n)}${t.g ? ' (' + esc(t.g) + ')' : ''}</b><span class="m">${qf(t.q)} ${esc(t.u)} × ${t.o != t.p ? `<s>${fm(t.o)}</s> ` : ''}${tg(t.p)}</span></span><b>${tg(Math.round(t.p * t.q))}</b></div>`).join('')
    : `<pre class="hdx">${esc(x.text || '')}</pre>`;
  $('#sb').innerHTML = `<div class="shh"><span class="shk">ЗАЯВКА · ${esc(ft(x.ts))}</span><h3 class="shn">${esc(x.h.s || '—')}</h3>${x.h.a || x.h.c ? `<span class="m shnt">${esc([x.h.a, x.h.c].filter(Boolean).join(' · '))}</span>` : ''}<div class="shp"><span class="pl">${x.m == 'vat' ? 'с НДС' : 'без НДС'}</span>${x.disc ? `<span class="pl">скидка ${nz(x.disc)}%</span>` : ''}${pend ? pendChip() : ''}</div></div>
  <div class="sum hdm">${R('Поставка на', fd(x.h.d) || '—')}${R('Торговый', trLbl(x))}${x.rc && x.rc.n ? R('Получатель', esc(x.rc.n)) : ''}${R('Создана', ft(x.ts))}${x.ed ? R('Изменена', ft(x.ed)) : ''}</div>
  <div class="sum hdl"><b class="hdh">Товары${x.items ? ' · ' + x.items.length : ''}</b>${rows}<div class="r t"><span>Итого</span><span>${tg(x.sum)}</span></div></div>
  ${canEdit(x) ? `<button class="send" data-a="hedit" data-v="${esc(x.id)}">${ico('edit', 20)} Изменить заявку${CFG.API_URL && role == 'admin' ? '' : ` <small class="hdlft">ещё ${Math.max(1, Math.round((CFG.EDIT_HOURS * 36e5 - (Date.now() - (x.rg || x.ts || 0))) / 36e5))} ч</small>`}</button>` : ''}<button class="${canEdit(x) ? 'ghost' : 'send'}" data-a="rep" data-v="${esc(x.id)}">${ico('undo', 18)} Заказать снова</button><button class="ghost" data-a="hcopy" data-v="${esc(x.id)}">Скопировать текст</button>${canDel(x) ? `<button class="lnk bad clr2" data-a="hdel" data-v="${esc(x.id)}">${ico('trash', 18)} Удалить заявку</button>` : ''}`;
}
/* ============ 6а. ВИД: тема и размер текста (только на этом устройстве, ключ ui; применяется сразу, без «Сохранить») ============ */
const TH = [['light', 'Светлая'], ['dark', 'Тёмная'], ['sys', 'Авто']], FS = [[0, 'Обычный'], [1, 'Крупный'], [2, 'Очень крупный']], CV = [['grid', 'Плиткой'], ['list', 'Списком']];
let UI = LS('ui'); if (!UI || typeof UI != 'object' || Array.isArray(UI)) UI = {};
UI.th = TH.some(t => t[0] == UI.th) ? UI.th : 'light'; UI.fs = [0, 1, 2].includes(UI.fs) ? UI.fs : 0; UI.cv = UI.cv == 'list' ? 'list' : 'grid';   // cv — вид каталога (по умолчанию плитка)   // по умолчанию светлая: на улице днём тёмная читается хуже
const darkMq = typeof matchMedia == 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyUI() {
  const r = document.documentElement, dark = UI.th == 'dark' || (UI.th == 'sys' && !!(darkMq && darkMq.matches));
  if (r && r.setAttribute) { r.setAttribute('data-theme', dark ? 'dark' : 'light'); r.setAttribute('data-fs', String(UI.fs)) }
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.setAttribute('content', dark ? '#0E100E' : '#F3F3EE'));
}
if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', () => { if (UI.th == 'sys') applyUI() });   // «Авто»: тема меняется вслед за системой
const uiBlock = () => `<b>Тема</b><div class="seg sg3" style="margin:6px 0 4px">${TH.map(([k, t]) => `<button data-a="uith" data-v="${k}" class="${UI.th == k ? 'on' : ''}">${t}</button>`).join('')}</div><p class="m thh" style="margin:0 0 14px">«Авто» — светлая или тёмная, как в настройках телефона</p>
  <b>Размер текста</b><div class="seg sg3" style="margin:6px 0 14px">${FS.map(([k, t]) => `<button data-a="uifs" data-v="${k}" class="${UI.fs == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <b>Каталог товаров</b><div class="seg sg3" style="margin:6px 0 8px">${CV.map(([k, t]) => `<button data-a="uicv" data-v="${k}" class="${UI.cv == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <p class="m" style="margin:0 0 4px">Меняется сразу и только на этом телефоне.</p>`;
function saveSet() { // v37.2: города и запасной номер сохраняются при выходе из поля и при закрытии окна; пустой список городов не принимаем
  const op = $('#op'), ct = $('#ct'); if (!op || !ct || view != 'set') return; let ch = false;
  const o = op.value.trim() || CFG.OPERATOR, c = ct.value.split(',').map(x => x.trim()).filter(Boolean);
  if (o != S.op) { S.op = o; ch = true }
  if (c.length && c.join('|') != S.cities.join('|')) { S.cities = c; ch = true }
  if (ch) { LS('set', S); cities() }   // cities() сама добавляет город текущей заявки, если его убрали из списка
  op.value = S.op; ct.value = S.cities.join(', '); if (ch) toast('Сохранено') }
function setUI(k, v) { UI[k] = v; LS('ui', UI); applyUI(); if (k == 'cv') { drawCv(); drawList() } if (view == 'set') setView(); if (view == 'more') moreView() }
applyUI();
function setView() {
  openSheet('set', 'Настройки');
  const rl = rcp.length ? rcp.map(r => esc(r.n) + (r.c.length ? ' (' + esc(r.c.join(', ')) + ')' : '') + (r.d ? ' ★' : '') + ' · ' + esc(r.p)).join('<br>') + '<br><span class="m">Список ведётся на листе «Получатели» таблицы и общий для всех. Выбирается получатель на главном экране.</span>' : CFG.API_URL ? 'Список пуст: заполните лист «Получатели» (имя, телефон, города, по умолчанию). Пока заявки уходят на запасной номер.' : 'Общая база не подключена — заявки уходят на запасной номер.';
  $('#sb').innerHTML = `
  <details class="sc" open><summary>Вид</summary>${uiBlock()}</details>
  ${role == 'admin' && rdSrv() ? `<details class="sc" open><summary>Общий маршрут</summary><p class="m" style="margin:0 0 8px">Маршруты всех торговых на ближайшие 2 недели: «Маршрут» → «Другой день» → «Все». Вам он виден всегда.</p><div class="seg">${[[1, 'Виден торговым'], [0, 'Только администраторам']].map(([k, t]) => `<button data-a="shrt" data-v="${k}" class="${+cfgShare == k ? 'on' : ''}">${t}</button>`).join('')}</div></details>` : ''}
  <details class="sc"><summary>Города и прайс</summary><b>Города (через запятую)</b><input id="ct" value="${esc(S.cities.join(', '))}"><button class="ghost" data-a="rl">Обновить прайс</button>${standalone ? '' : `<button class="ghost" data-a="inst">${ico('plus', 18)} Установить на главный экран</button>`}</details>
  <details class="sc"><summary>Получатели</summary><p class="m" style="margin:0 0 8px;line-height:1.5">${rl}</p>
    <details class="mini"><summary>Запасной номер WhatsApp</summary><input id="op" inputmode="tel" value="${esc(S.op)}" placeholder="77001234567"><p class="m" style="margin:0">Используется, только если лист «Получатели» пуст. Код страны и номер, без + и пробелов.</p></details></details>
  <details class="sc"><summary>Файлы</summary><p class="m" style="margin:0 0 8px">Таблица заявок открывается в Excel. Файл данных телефона переносит черновики, избранное и неотправленное на другой телефон или на другой адрес сайта.</p><button class="ghost" data-a="csv">${ico('save', 18)} Экспорт истории заявок (CSV)</button><button class="ghost" data-a="bak">${ico('down', 18)} Сохранить данные устройства (файл)</button><button class="ghost" data-a="imp">${ico('up', 18)} Загрузить данные из файла</button><input type="file" id="impf" accept=".json,application/json" hidden></details>
  <details class="sc"><summary>Служебная информация</summary><div class="m" style="font-size:13px;line-height:1.5">Версия: ${VER}${CFG.API_URL ? ' · Code.gs: ' + (srvV || 'не определена') + (srvV && srvV < NEED ? ' (устарел!)' : '') : ''} · адрес: ${esc(location.origin)}<br>Товаров: ${P.length} (с ценой с НДС: ${P.filter(p => p.pv).length}, без НДС: ${P.filter(p => p.pn).length})<br>Режим цен: ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}<br>${CFG.API_URL ? `База: ${syncErr ? 'ошибка: ' + esc(lastErr) : 'подключена'} · торговых в списке: ${trs.length} · профиль: ${esc(me || 'не выбран')}<br>Ждут отправки: заявок ${outbox.length}, правок магазинов ${shopq.length}, визитов ${visq.length}<br>Последняя ошибка синхронизации: ${errL ? ft(errL.t) + ' — ' + esc(errL.m) + (errL.q ? ' (в очереди было ' + errL.q + ')' : '') : 'не было'}` : 'База заявок не подключена (API_URL пуст)'}</div><button class="ghost" data-a="dgtg">Диагностика (временная): ${LS('diag') ? 'открыть отчёт' : 'включить'}</button></details>`;   // v37.2: кнопки «Сохранить» нет — города и запасной номер сохраняются сами (saveSet), как и всё остальное в настройках
}

/* ============ 6б. РЕЖИМ ЦЕН (с НДС / без НДС) ============ */
function drawSeg() { $('#seg').innerHTML = [['vat', 'с НДС'], ['net', 'без НДС']].map(([k, t]) => `<button data-a="mode" data-v="${k}" class="${S.mode == k ? 'on' : ''}">${t}</button>`).join('') }
async function setMode(m, ack) { // ack — переключили из вопроса при отправке: это осознанный выбор, отметку «переключали» снимаем
  if (m == S.mode) return;
  if (!ack && Object.values(cart).some(x => x.p != null) && !(await ask('Ручные цены в заявке будут сброшены. Переключить режим?', 'Переключить'))) return;   // из вопроса при отправке не переспрашиваем: о сбросе сказано в нём
  if (ack) msw = ''; else if (lines().length) msw = !msw ? S.mode : msw == m ? '' : msw;   // запоминаем режим, который был до переключения; вернули как было — отметки нет
  S.mode = m; LS('set', S); Object.values(cart).forEach(x => delete x.p); applyMode();
  const gone = P.filter(p => qty(p) > 0 && !p.pr); gone.forEach(p => delete cart[pid(p)]);   // позиции без цены в новом режиме убираем
  save(); drawSeg(); drawList(); bar(); if (view == 'cart') cartView();
  if (gone.length) say('Убраны из заявки (нет цены в этом режиме): ' + gone.map(p => p.n).join(', '));
}

/* ============ 7. ШАПКА ЗАЯВКИ ============ */
function cities() {
  if (H.c && !S.cities.includes(H.c)) { S.cities.push(H.c); LS('set', S) }
  $('#c').innerHTML = S.cities.map(c => `<option>${esc(c)}</option>`).join('') + '<option value="+">＋ Другой город…</option>';
  $('#c').value = H.c || S.cities[0]; H.c = $('#c').value; drawRc();
}
const shops = () => { if (!$('#sl').hidden) drawDD() };   // обновить открытый список магазинов
function drawD() { const e = document.getElementById('dv'); if (e) e.innerHTML = `<span>${esc(H.d ? wdOf(H.d) + ', ' + fd(H.d) : 'Дата поставки')}</span>${ico('cal', 18)}` }   // v34: дата в шапке — подписью со значком (как в оформлении), поле даты прозрачное поверх: раньше дата наезжала на значок календаря
function fill() { fixDate(); $('#d').min = eo ? '' : minD(); $('#d').value = H.d; drawD(); $('#s').value = H.s || ''; $('#a').value = H.a || ''; cities(); shopWarn(); if (H.s) hfC = true; drawHf(); if (P.length) { drawChips(); drawList() } }
function drawHf() { const c = !!(H.s && hfC), f = $('#hf'); f.classList.toggle('cmp', c); $('#ocs').hidden = !c; $('#hfok').hidden = c || !H.s; { const u = document.getElementById('hfun'); if (u) u.hidden = c || !canUnpick() }   // v36: «Отменить» остаётся и после «Сменить» (развёрнутая шапка) — до выбора другого магазина или отправки. v33: свёрнутая шапка — карточка магазина; развёрнутая — поля и «Готово»
  $('#ocs').innerHTML = c ? `<div class="ocst"><b>${esc(H.s)}</b><span class="m">${esc([H.a || H.c, H.d ? 'поставка ' + fd(H.d) : ''].filter(Boolean).join(' · '))}</span></div>${canUnpick() ? '<button class="ocb" data-a="hfund">Отменить</button>' : ''}<button class="ocb" data-a="hfch">Сменить</button>` : '' }   // v31: сменился магазин — вкладка «Брал раньше» и подписи «в прошлый раз»
const clrShop = () => { H.s = ''; H.a = ''; H.sid = ''; H.r = ''; H.t = 0; hfC = false; setUndo(null) };   // после заявки/черновика: магазин и получатель выбираются заново
const curShop = () => (H.sid && base.find(b => b.id == H.sid)) || (H.s && findBase(H.s, H.c, H.a)) || null;   // v35: без ID — только однозначное совпадение
function shopWarn() { // плашка под полем магазина: статус, причина, кто и когда отметил (предупреждение, а не запрет)
  const x = curShop(), el = $('#sw'); if (!x || !x.st || !ST[x.st] || (x.st != 'no' && x.st != 'closed')) { el.hidden = true; return }   // v33: на экране заявки — только предупреждение «Не заходить» / «Закрыт»; остальные статусы — в маршруте и карточке
  const bad = x.st == 'no' || x.st == 'closed'; el.hidden = false; el.className = 'sw full ' + (bad ? 'bad' : 'ok');
  el.textContent = (bad ? '⚠ ' : '') + ST[x.st][0] + (x.nt ? ': ' + x.nt : '') + (x.sb ? ' · ' + x.sb + (x.sa ? ', ' + fd(isoDay(x.sa)) : '') : '');
}

/* ============ 7б. СИНХРОНИЗАЦИЯ, ПОДТВЕРЖДЕНИЕ, ЧЕРНОВИКИ, ПРОФИЛЬ ============ */
const vfail = [];
let syncWarn = false, syncing = false, again = false, syncErr = false, syncAt = '', lastErr = '', srvV = nz(LS('srv')), errL = (o => o && typeof o == 'object' && typeof o.m == 'string' ? o : null)(LS('lerr'));   // v34: errL — последняя ошибка синхронизации {m, t}; хранится до следующей ошибки, а не до успеха   // srvV — версия Code.gs на сервере
async function api(url, opt) { // запрос к Apps Script с понятным текстом ошибки. Ответ сервера с полем error возвращается как есть — его разбирает вызывающий
  let r, t; const ac = typeof AbortController == 'function' ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), 70000) : 0;   // без предела ожидания зависший запрос блокировал бы кнопку входа и синхронизацию
  try { r = await fetch(url, ac ? { ...opt, signal: ac.signal } : opt); t = await r.text() } catch (e) { throw new Error(ac && ac.signal.aborted ? 'сервер не ответил за 70 секунд' : 'браузер не смог связаться со скриптом (интернет, VPN, блокировщик или неверный API_URL)') } finally { clearTimeout(tm) }
  try { return JSON.parse(t) } catch (e) { throw new Error('скрипт вернул не данные, а страницу (HTTP ' + r.status + '): проверьте развёртывание — доступ «Все», выполнять от имени «Я», ссылка заканчивается на /exec') }
}
async function rawPost(body) { // всё — в теле POST: токен и пароль не попадают в адрес запроса
  for (let i = 0; ; i++) { const d = await api(CFG.API_URL, { method: 'POST', body: JSON.stringify(body) });
    if (!d || d.error != 'get') return d;                // «get» — Google по дороге превратил POST в GET, до обработки запрос не дошёл: повторяем, а не выходим из профиля
    if (i >= 2) throw new Error('запрос не дошёл до сервера (Google обработал его как открытие ссылки). Повторите попытку');
    await new Promise(r => setTimeout(r, 300 * (i + 1))) }
}
const OLDSRV = 'на сервере старая версия Code.gs: обновите его до версии ' + NEED;
async function call(body) { // защищённый запрос: токен прикладывается сам. Отказ в авторизации — просьба войти заново (очереди при этом остаются на месте)
  const d = tok ? await rawPost({ tok, ...body }) : { error: 'auth' };
  if (d.error == 'auth') { lostAuth(); const e = new Error('нужен вход'); e.auth = true; throw e }
  if (d.error == 'key') throw new Error(OLDSRV);
  if (d.error == 'forbidden') throw new Error('нет прав на это действие');
  if (d.error) throw new Error('скрипт вернул ошибку: ' + d.error);
  return d;
}
function lostAuth() { // сервер не принял токен (истёк срок, доступ отозван, сменили пароль или роль). Локальные данные и очереди не трогаем
  if (tok) { tok = ''; LS('tok', '') } authNeed = true; syncStatus();
  if (view != 'auth' && !LS('pending')) authView('login');
}
function logout() { // выход возможен только при пустых очередях (проверяется там, где вызывается)
  tok = ''; me = ''; role = 'trader'; LS('tok', ''); LS('me', ''); LS('role', ''); trs = []; LS('trs', trs); shist = []; LS('shist', shist); RDS = []; LS('rds', RDS); rgC = {}; dayC = {}; adm = null; admCode = null; admOw = null;
  authNeed = true; syncStatus(); authView('login');
}
function syncStatus() { // строка статуса под названием в шапке
  const n = outbox.length + shopq.length + delq.length + visq.length, el = $('#sy'); if (!CFG.API_URL) { el.hidden = true; return }
  el.textContent = !tok ? 'Требуется вход' + (n ? ' · ждут отправки: ' + n : '') + ' (нажмите)' : srvV && srvV < NEED ? 'Обновите Code.gs до версии ' + NEED + ' (нажмите)' : syncWarn ? 'Сервер не сохранил удаление — обновите Code.gs (нажмите)' : syncing ? 'Синхронизация…' : syncErr ? 'Нет связи с базой' + (n ? ' · ждут: ' + n : '') + ' (нажмите)' : n ? 'Ждут отправки: ' + n : 'Всё сохранено · ' + syncAt;   // v33: как в макете; имя — в «Профиле»
  const st = !tok || syncErr || syncWarn || (srvV && srvV < NEED) ? 'bad' : syncing || n ? 'wait' : 'ok'; el.hidden = st == 'ok';   // v33: на экране заявки строка видна, только когда есть что сказать (как в макете «Каталог»)
  const e2 = document.getElementById('sy2'); if (e2) { e2.textContent = el.textContent; const p = e2.parentNode; if (p && p.setAttribute) p.setAttribute('data-st', st) }   // v33: та же строка в шапке маршрута
}
const ORDFAIL = { invalid: 'данные не прошли проверку на сервере', trader_mismatch: 'она записана под другим профилем', not_owner: 'это заявка другого торгового', no_owner: 'у заявки нет торгового — изменить её может только администратор', too_late: 'прошло больше ' + CFG.EDIT_HOURS + ' ч', stale: 'на сервере уже есть более новая правка', changed: 'заявку уже изменили' };
const DELFAIL = { not_owner: 'это заявка другого торгового', no_owner: 'у заявки нет торгового — изменить её может только администратор', trader_mismatch: 'операция записана под другим профилем', expired: 'срок возврата (' + CFG.UNDO_HOURS + ' ч) истёк, заявка осталась удалённой', future: 'часы на устройстве спешат', invalid: 'данные не прошли проверку на сервере' };
function orderRefused(o, r) { // сервер не принял заявку или правку. История приводится к состоянию сервера, а введённое не теряется — уходит в черновики
  LS('hist', (LS('hist') || []).filter(x => x && x.id != o.id));
  const h = o.h || {}; drafts.unshift({ H: { d: h.d, c: h.c, s: h.s, a: h.a, sid: h.sid || '', dm: 1, r: o.rc && o.rc.n || '' }, cart: cleanCart(o.cart), disc: nz(o.disc), m: o.m, n: Object.keys(cleanCart(o.cart)).length, sum: nz(o.sum), t: Date.now() }); LS('drafts', drafts); draftBadge();
  const ch = r.reason == 'changed', who_ = ch ? [r.by, r.at ? ft(+r.at) : ''].filter(Boolean).join(', ') : '';   // v34: пока правили, заявку изменил кто-то другой
  vfail.push((o.ed ? 'Правка заявки' : 'Заявка') + ' «' + (h.s || '') + '» не принята сервером: ' + (ORDFAIL[r.reason] || r.reason || 'причина не указана') + (ch ? (who_ ? ' (' + who_ + ')' : '') + '. Откройте её заново' : r.f == 'dts' ? ': дата поставки раньше дня заявки' : r.f ? ' (' + r.f + ')' : '') + '. ' + (o.ed ? 'Ваша правка' : 'Она') + ' сохранена в черновиках' + (o.ed ? (ch ? '; в истории — версия с сервера.' : '; в истории осталась прежняя версия.') : '.'));
}
function delRefused(o, r) { // отказ подтверждён ответом сервера: только теперь локальная пометка удаления приводится к серверной
  if (r.del != null) { const sv = nz(r.del), h = LS('hist') || []; h.forEach(x => { if (x && x.id == o.id) x.del = sv }); LS('hist', h); setDel(o.id, sv); shist.forEach(x => { if (x.id == o.id) x.del = sv }) }
  if (r.reason != 'not_found') vfail.push((o.del ? 'Удаление' : 'Возврат') + ' заявки не выполнен: ' + (DELFAIL[r.reason] || r.reason || 'причина не указана') + (r.reason == 'not_owner' && r.owner ? ' («' + r.owner + '»)' : '') + '.');
}
/* v37.1. Перерисовка экрана, пришедшая от сети (ответ сервера), не должна заменять кнопки, пока палец на экране: если элемент заменён между касанием и отпусканием,
   браузер не посылает нажатие — оно «теряется» (магазин не добавился). Пока касание идёт (но не дольше 1,5 с), перерисовка ждёт и выполняется сразу после отпускания */
let ptrAt = 0; const ptrQ = new Map(), held = () => !!ptrAt && Date.now() - ptrAt < 1500;
const afterTouch = (key, fn) => { if (!held()) return fn(); ptrQ.set(key, fn) };
document.addEventListener('pointerdown', () => { ptrAt = Date.now() }, true);
['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { ptrAt = 0; if (ptrQ.size) setTimeout(() => { if (held()) return; const q = [...ptrQ.values()]; ptrQ.clear(); q.forEach(f => f()) }, 80) }, true));   // 80 мс: нажатие (click) успевает дойти до кнопки раньше перерисовки
const BATCH_N = 25, BATCH_W = 16;   // v37: не больше 25 операций и «веса» 16 (точка маршрута 1, визит 3, заявка 4) в одной пачке — запрос должен уложиться в 70 секунд ожидания
async function sync() { // отправляет накопленные заявки и правки магазинов, затем подтягивает торговых, магазины и историю
  if (!CFG.API_URL) return;
  if (!tok) { authNeed = true; again = false; syncStatus(); return }   // без входа ничего не отправляем: очереди ждут того же профиля
  if (syncing) { again = true; return }                 // уже идёт — повторим после
  if (!navigator.onLine) { syncErr = true; syncStatus(); return }
  syncing = true; syncStatus(); mk('ab-sync0'); const n0 = qN();
  // Правило для всех очередей: операция убирается из очереди только после ответа сервера. Сетевая ошибка или отказ в авторизации прерывают цикл, очередь остаётся как была
  try {
    const new23 = x => ['status', 'info', 'meta', 'days', 'owner', 'vat', 'geo', 'geodel', 'note', 'rday'].includes(x.op);   // v35: note (заметки), rday (маршрут на день) — только для нового Code.gs   // эти операции понимает только новый Code.gs (days / owner / vat / geo — с v31, geodel — с v32)
    // v37. Очередь собирается в один список в прежнем порядке (правки магазинов → визиты → заявки → удаления). Операция убирается из очереди только после ответа сервера.
    // Сервер версии 37+ принимает несколько операций одним запросом (batch); старый — по одной, как раньше
    const okShop = (x, r) => { shopq = shopq.filter(y => y !== x); LS('shopq', shopq);
      if (x.op == 'rday' && r.applied !== false) { const e = { d: x.d, tr: x.tr, sid: x.id, on: !!x.on, at: Date.now(), by: me }, up = l => l.filter(q => !(q.d == x.d && q.sid == x.id && norm(q.tr) == norm(x.tr))).concat([e]); RDS = up(RDS); LS('rds', RDS); const c = rgC[x.d]; if (c && Array.isArray(c.rd)) c.rd = up(c.rd) }   // v37.1: принятая сервером правка дня сразу становится «серверной» — иначе между ответом на отправку и обновлением данных (init) точка на экране откатывалась бы назад
      if (SEC_OP[x.op] && r.applied !== false) svAt[(x.id || 'n:' + x.n) + '|' + SEC_OP[x.op]] = Date.now();   // v34: «сохранено ЧЧ:ММ» у раздела карточки
      if (r.applied === false) vfail.push('Правка магазина «' + (x.n || x.old || '') + '» не принята сервером: ' + (FAILR[r.reason] || r.reason || '—') + '.') };
    const okVisit = (v, r) => { visq = visq.filter(y => y !== v); LS('visq', visq);
      if (r.applied === false && !(v.act && r.reason == 'not_found')) vfail.push(visitFail(v, r.reason)) };
    const okOrder = (o, r) => { outbox = outbox.filter(x => x.id != o.id); LS('outbox', outbox); stC = null;   // v32: итоги пересчитать при следующем показе
      if (r.applied === false) orderRefused(o, r);
      else { const up = l => l.forEach((x, i) => { if (x.id == o.id) { const n = { ...x, ...o, h: { ...o.h, sid: o.h.sid || (x.h && x.h.sid) || '' }, trader: r.tr || x.trader, by: o.as && r.tr ? me : x.by, rg: x.rg, del: x.del, dby: x.dby }; delete n.bed; delete n.as; l[i] = n } }); up(shist); Object.values(dayC).forEach(c => up(c.hist)); LS('shist', shist);   // v36: r.tr — владелец после «от имени»
        if (o.as && r.tr) { const h = LS('hist') || []; h.forEach(x => { if (x && x.id == o.id) { x.trader = r.tr; x.by = me; delete x.as } }); LS('hist', h) } } };   // v34: сервер принял — его копия уже такая; иначе до следующей выгрузки история показала бы прежнюю версию
    const okDel = (o, r) => { delq = delq.filter(x => x !== o); LS('delq', delq); stC = null;
      if (r.applied === false) delRefused(o, r);
      else { delok.push({ id: o.id, del: o.del, t: Date.now() }); LS('delok', delok) } };   // запоминаем, пока выгрузка не подтвердит
    const work = [];
    for (const x of [...shopq]) { if (new23(x) && srvV < NEED) continue; work.push({ q: { shop: x }, w: x.op == 'rday' ? 1 : 2, er: 'правку магазина', ok: r => okShop(x, r) }) }   // w — «вес» для размера пачки: серия rday на сервере дешёвая, заявка — дорогая
    if (srvV >= NEED) for (const v of [...visq]) work.push({ q: v.cancel ? { visitCancel: v } : v.act ? { visitOp: v } : { visit: v }, w: 3, er: 'визит', pre: () => { v.tried = 1 }, ok: r => okVisit(v, r) });   // tried — с этого момента запрос мог дойти до сервера, даже если ответ потерялся
    for (const o of [...outbox]) work.push({ q: { order: o }, w: 4, er: 'заявку', ok: r => okOrder(o, r) });
    for (const o of [...delq]) work.push({ q: { orderOp: o }, w: 3, er: 'удаление заявки', ok: r => okDel(o, r) });
    if (srvV >= 37 && work.length >= 2) {
      for (let i = 0; i < work.length;) { let k = i, wt = 0; while (k < work.length && k - i < BATCH_N && (k == i || wt + work[k].w <= BATCH_W)) wt += work[k++].w;
        const ch = work.slice(i, k); i = k; ch.forEach(w => w.pre && w.pre()); LS('visq', visq);
        const d = await call({ batch: ch.map(w => w.q) });
        if (!Array.isArray(d.batch) || d.batch.length != ch.length) throw new Error('скрипт вернул неполный ответ на пачку записей');
        for (let j = 0; j < ch.length; j++) { const r = d.batch[j]; if (!r || r.error) throw new Error('скрипт вернул ошибку: ' + (r && r.error || '?')); if (!r.ok) throw new Error('скрипт не принял ' + ch[j].er); ch[j].ok(r) } }   // ошибка записи: принятое убрано из очереди, остальное остаётся и уйдёт в следующий раз
    } else for (const w of work) { if (w.pre) { w.pre(); LS('visq', visq) } const r = await call(w.q); if (!r.ok) throw new Error('скрипт не принял ' + w.er); w.ok(r) }
    if (n0 && !qN() && !vfail.length && !toastFn) toast('Сохранено на сервере');   // v36.6: очередь отправлена и сервер ответил по каждой операции — говорим сразу, не ждём обновления данных (init) ниже; не перебиваем кнопку «Отменить»
    if (!again) {   // v37: пока шла отправка, в очередь добавили ещё — обновление данных (init) сделаем в конце, когда очередь опустеет (серия нажатий не прерывается лишними обновлениями)
    const d = await call({ q: 'init', undo: CFG.UNDO_HOURS }), sh = safeL(d.hist); let bf = false;   // bf — база магазинов обновлена с сервера в этом проходе
    if (d.me) { role = d.me.role == 'admin' ? 'admin' : 'trader'; LS('role', role) }   // роль — только для показа кнопок; права проверяет сервер
    trs = (Array.isArray(d.traders) ? d.traders : []).map(String); srvV = nz(d.srv); LS('srv', srvV); if (Array.isArray(d.rcp)) { rcp = d.rcp; LS('rcp', rcp); drawRc() }
    if (Array.isArray(d.hot)) { hotL = d.hot.filter(x => x && typeof x.k == 'string'); LS('hot', hotL) } if (Array.isArray(d.promo)) { promoL = d.promo.map(String); LS('promo', promoL) }   // v31: «Ходовые» и «Продвигать» — с сервера
    if (Array.isArray(d.reasons)) { RSN = d.reasons.map(String).slice(0, 12); LS('rsn', RSN) } if (Array.isArray(d.hot) || Array.isArray(d.promo)) { applyFlags(); drawChips(); if (!view) drawList() }
    if (!shopq.length && !visq.length && Array.isArray(d.shops)) { const m = new Map(base.map(b => [b.id, b])); base = d.shops.map(x => { const o = m.get(x.id); return o ? Object.assign(o, x) : x }); bf = true }   // объекты магазинов сохраняем (на них ссылаются открытая карточка и кнопки «Отменить»)   // пока есть неотправленные правки, локальную базу не затираем
    if (srvV >= NEED && (shopq.some(new23) || visq.length)) again = true;   // версия сервера стала известна — досылаем отметки
    if (srvV >= 31 && bf && migrate31()) again = true;
    if (Array.isArray(d.rd)) { RDS = d.rd.filter(r => r && typeof r.d == 'string' && typeof r.sid == 'string' && typeof r.tr == 'string').map(r => ({ d: r.d, tr: r.tr, sid: r.sid, on: !!r.on, at: nz(r.at), by: String(r.by || '') })); LS('rds', RDS) }   // v35: маршрут на день
    if (srvV >= 35 && migRd()) again = true;
    if (d.cfg && typeof d.cfg.share == 'boolean') { cfgShare = d.cfg.share; LS('cfgsh', cfgShare) } rgC = {};   // v35: «Общий маршрут» открыт торговым; данные дней — заново                                // v31: дни маршрута и режимы цен, заданные на телефоне, — один раз на сервер
    syncWarn = false; delok = delok.filter(o => { const sv = sh.find(x => x.id == o.id); if (!sv) return false;   // подтверждение удаления / возврата выгрузкой
      if (!!sv.del == !!o.del) return false; syncWarn = true; return Date.now() - o.t < 6e5 });                      // не совпало: сервер не применил — предупреждаем, пока не истёк срок
    LS('delok', delok); shist = sh; LS('trs', trs); LS('base', base); LS('shist', shist); shops();
    }
    syncErr = false; lastErr = ''; authNeed = false; syncAt = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { if (e && e.auth) lastErr = 'нужен вход'; else { syncErr = true; lastErr = e && e.message || 'неизвестная ошибка'; errL = { m: String(lastErr).slice(0, 300), t: Date.now(), q: qN() }; LS('lerr', errL) } }
  if (vfail.length) { const m = vfail.splice(0).join('\n'); setTimeout(() => say(m), 0) }
  syncing = false; mk('ab-sync1'); syncStatus();
  afterTouch('sync', () => { if (view == 'hist') histView(); if ((view == 'shops' || view == 'rplan') && !rvK) drawShops() });   // маршрут перерисовывается, когда пришли магазины (кроме момента, когда открыта отметка визита). v37.1: не во время касания — иначе нажатие теряется
  afterTouch('syncc', () => { if (view == 'shopc' && cSh) { drawFeed(cSh); loadLog(cSh); drawMarks(cSh) } })   // открытая карточка магазина подтягивает ленту с сервера (v30: раньше эта строка была внутри комментария и не выполнялась)
  if (again) { again = false; if (tok) return sync() }
}

function commitOrder(o) { // заявка или правка подтверждена: в историю устройства и в очередь на сервер
  H.as = ''; asOpen = false;   // v36: «от имени» — только для этой заявки
  if (o.h && o.h.sid) delete prevC[o.h.sid];   // v31: «Брал раньше» для этой точки устарело
  const h = (LS('hist') || []).filter(x => x.id != o.id); h.unshift(o); LS('hist', h.slice(0, 50)); outbox = outbox.filter(x => x.id != o.id); outbox.push(o); LS('outbox', outbox);
  const sh = upShop(o.h.s, o.h.c, o.h.a, o.h.sid); if (sh && !o.ed) { sh.lo = Math.max(sh.lo || 0, o.ts); planAfter(sh, '', o.ts); if (srvAuto() && !o.as && isMine(o) && !(isToday(sh.lv) && sh.lb == VO[0] && norm(sh.lw || '') == norm(me)) && o.ts >= (isToday(sh.lv) ? sh.lv : 0)) { sh.lv = o.ts; sh.lb = VO[0]; sh.lw = me } LS('base', base) }   // v37: сервер запишет визит «Взяли заказ» вместе с заявкой — у точки он виден сразу   // заявка сегодня закрывает точку и её план на сегодня   // новый магазин сразу попадает в список; «посл. заказ» обновляется
  cart = {}; disc = 0; eo = ''; clrShop(); H.dm = 0; save(); fill(); shops(); closeSheet(); drawList(); bar(); sync();
}
/* v32. На Android WhatsApp открывается напрямую (intent), а страница остаётся на месте. Раньше страница уходила на wa.me: в плавающем окне
   (Xiaomi и др.) Chrome оставался на экране «в загрузке», и вопрос «Отправлено?» не появлялся до обновления. Нет приложения — Chrome сам откроет wa.me
   (browser_fallback_url). Если через WA_MS страница не потеряла фокус и не скрылась — WhatsApp не открылся (например, браузер не пустил): по-старому через wa.me */
let WA_MS = 2500, waT = 0, waBlur = false;
function waOpen(num, text) {
  const web = `https://wa.me/${num}?text=${encodeURIComponent(text)}`; leaving = true;
  if (!/Android/i.test(navigator.userAgent || '')) { location.href = web; return }
  waBlur = false; clearTimeout(waT);
  location.href = `intent://send/?phone=${num}&text=${encodeURIComponent(text)}#Intent;scheme=whatsapp;S.browser_fallback_url=${encodeURIComponent(web)};end`;
  waT = setTimeout(() => { waT = 0; if (!waBlur && !document.hidden) { location.href = web; return } leaving = false; checkPending() }, WA_MS);   // открылся — страница на месте: сразу вопрос «Отправлено?»
}
function checkPending() { // после возврата из WhatsApp спрашиваем, ушла ли заявка. v33: экран целиком, без нижней панели (макет «Заявка отправлена?»)
  const o = safeO(LS('pending')); if (!o || view == 'pend') return; openSheet('pend', 'Заявка отправлена?'); const sh = document.getElementById('sheet'); if (sh) sh.classList.add('hero');
  const n = o.items ? o.items.length : Object.keys(o.cart).length;
  $('#sb').innerHTML = `<div class="pdw"><div class="pdh"><span class="pdi">${ico('send', 34)}</span><small>ПОСЛЕ WHATSAPP</small><h3>Заявка отправлена?</h3><p class="m">Проверьте в WhatsApp, ушло ли сообщение оператору.</p></div>
  <div class="sum pds"><b class="pdn">${esc(o.h.s)}</b><span class="m">${esc([o.h.c, o.h.d ? 'поставка ' + wdOf(o.h.d) + ', ' + fd(o.h.d) : ''].filter(Boolean).join(' · '))}</span><div class="pdr"><span class="m">${n} ${pl3(n, 'позиция', 'позиции', 'позиций')}${o.m ? ' · ' + ML[o.m] : ''}</span><b>${tg(o.sum)}</b></div></div>
  <div class="pdb"><button class="send" data-a="pyes">${ico('check', 22)} Да, отправил</button><p class="m">Заявка запишется в историю, откроется маршрут</p><button class="ghost pdno" data-a="pno">Нет, вернуться к заявке</button><p class="m">Заявка останется в корзине — можно отправить ещё раз</p></div></div>`;
}
const draftBadge = () => $('#drbi').innerHTML = ico('user', 24) + (drafts.length ? '<em class="bdg">' + drafts.length + '</em>' : '');
const stash = () => { drafts.unshift({ H: { ...H }, cart: JSON.parse(JSON.stringify(cart)), disc, m: S.mode, n: lines().length, sum: final(), t: Date.now() }); LS('drafts', drafts); draftBadge() };   // v36.3: начатая заявка — в черновики, а не в никуда
const stashAsk = what => ask(eo ? 'Сейчас открыта правка заявки — она закроется без сохранения. Открыть ' + what + '?' : 'Начатая заявка' + (H.s ? ' для «' + H.s + '»' : '') + ' (' + lines().length + ' ' + pl3(lines().length, 'позиция', 'позиции', 'позиций') + ') уйдёт в черновики. Открыть ' + what + '?', 'Открыть');
function draftSave() { // черновик хранит всё состояние заявки; корзина очищается для следующего магазина
  if (!lines().length) return say('Заявка пуста');
  drafts.unshift({ H: { ...H }, cart: JSON.parse(JSON.stringify(cart)), disc, m: S.mode, n: lines().length, sum: final(), t: Date.now() }); LS('drafts', drafts);
  cart = {}; disc = 0; eo = ''; clrShop(); save(); fill(); closeSheet(); drawList(); bar(); draftBadge();
}
function draftView() {
  openSheet('dr', 'Черновики');
  $('#sb').innerHTML = drafts.length ? `<p class="m ckc">Черновик хранится только на этом телефоне. «Открыть» — заявка вернётся в корзину.</p><div class="hcl">${drafts.map((x, i) => `<div class="hc"><div class="hch"><span class="hct"><b>${esc(x.H.s || 'Без названия')}</b><span class="m">${nz(x.n)} ${pl3(nz(x.n), 'позиция', 'позиции', 'позиций')} · сохранён ${new Date(nz(x.t)).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span><b class="amt">${tg(x.sum)}</b></div><div class="hcb"><button class="hrep" data-a="dopen" data-v="${i}">Открыть</button><button class="x" data-a="ddel" data-v="${i}" aria-label="Удалить черновик">${ico('trash', 18)}</button></div></div>`).join('')}</div>`
    : `<div class="empt">${ico('folder', 40)}<b>Черновиков нет</b><p class="m">В оформлении заявки — «Сохранить как черновик».</p></div>`;
}
function authView(mode) { // вход по профилю и паролю или первое задание пароля по приглашению. Списка профилей здесь нет: имя вводится вручную
  auMode = mode || auMode; const inv = auMode == 'invite', n = qN(), lock = !!(n && me); openSheet('auth', inv ? 'Приглашение' : 'Вход');
  const sh = document.getElementById('sheet'); if (sh) sh.classList.add('hero');   // v33: экран входа — с логотипом крупно (DECISIONS п. 47)
  const logo = '<span class="aul"><span><img src="logo.jpg" alt="Логотип Али-Баба"></span></span>';
  $('#sb').innerHTML = `${inv ? `<div class="auh sm">${logo}<div class="aut"><small>АЛИ-БАБА</small><b>Первый вход</b><span>по приглашению администратора</span></div></div>`
    : `<div class="auh">${logo}<div class="aut"><b>Али-Баба</b><small class="auk">ПРИЁМ ЗАЯВОК</small></div></div>`}
  <div class="auc">${lock ? `<div class="aq"><small>Ждут отправки: ${n}</small><span>Они записаны от имени «${esc(me)}». Войдите под этим профилем — и они уйдут на сервер.</span></div>` : ''}
  <label class="auf"><b>Профиль</b><span class="pw">${lock ? `<span class="aulk">${ico('lock', 20)}</span>` : ''}<input id="aun" maxlength="60" autocomplete="username" placeholder="Имя, как его записал администратор" value="${esc(me)}" ${lock ? 'readonly' : ''}></span></label>
  ${inv ? '<label class="auf"><b>Приглашение</b><input id="aui" class="auinv" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX"></label>' : ''}
  <label class="auf"><b>${inv ? 'Новый пароль' : 'Пароль'}</b><span class="pw"><input id="aup" type="password" autocomplete="${inv ? 'new-password' : 'current-password'}"><button type="button" class="eye" data-a="pwsee" aria-label="Показать пароль">${ico('eye', 22)}</button></span></label>
  ${inv ? '<label class="auf"><b>Пароль ещё раз</b><input id="aup2" type="password" autocomplete="new-password"></label><p class="m aunote">Не меньше 8 знаков; лучше всего — фраза из нескольких слов. Пароль знаете только вы: администратор его не видит и может лишь выдать новое приглашение.</p>' : ''}
  <div id="aue" class="aue" role="alert" hidden></div>
  <button class="send" data-a="${inv ? 'rdm' : 'lgn'}"><span>${inv ? 'Задать пароль и войти' : 'Войти'}</span>${ico('arrow', 22)}</button>
  <button class="lnk aum" data-a="amode" data-v="${inv ? 'login' : 'invite'}">${inv ? 'У меня уже есть пароль' : 'У меня есть приглашение'}</button></div>
  ${inv ? '' : '<p class="m auhint">Нет пароля? Попросите у администратора приглашение.</p>'}`;
}
async function doAuth() {
  const err = t => { const e = $('#aue'); e.textContent = t; e.hidden = !t; e.className = 'aue' + (/^Проверяю/.test(t) ? ' wait' : /Слишком много/.test(t) ? ' lock' : '') };   // текст ошибки — через textContent; v33: «проверяю» — не ошибка, блокировка — рамкой
  if (auBusy) return err('Проверяю… Ответ сервера может идти до минуты.');       // повторное нажатие не должно выглядеть как «кнопка не работает»
  const inv = auMode == 'invite', name = String($('#aun').value || '').trim().replace(/\s+/g, ' '), pw = String($('#aup').value || ''), code = inv ? String($('#aui').value || '').trim() : '';
  if (!name || !pw) return err('Укажите профиль и пароль');
  const other = n => qN() && me && norm(n) != norm(me) ? 'На устройстве есть неотправленные данные профиля «' + me + '». Сначала войдите под ним — после отправки профиль можно будет сменить.' : '';
  if (other(name)) return err(other(name));
  if (inv) { if (!code) return err('Введите приглашение'); if (pw != String($('#aup2').value || '')) return err('Пароли не совпадают'); if (pw.length < 8) return err('Пароль слишком короткий: нужно не меньше 8 знаков') }
  if (!navigator.onLine) return err('Нет интернета. Войти можно только при подключении.');
  auBusy = true; err('Проверяю…'); let r;
  try { r = await rawPost({ auth: inv ? { op: 'redeem', name, invite: code, password: pw } : { op: 'login', name, password: pw } }) } catch (e) { auBusy = false; return err('Не удалось связаться с сервером: ' + e.message) }
  auBusy = false; if (view != 'auth') return;
  if (r.error == 'throttled') return err('Слишком много неудачных попыток. Подождите ' + Math.max(1, Math.ceil(nz(r.wait) / 60)) + ' мин и попробуйте снова.');
  if (r.error == 'weak') return err(String(r.msg || 'Пароль слишком простой'));
  if (r.error == 'login') return err(inv ? 'Не подошло. Проверьте имя профиля и приглашение: оно одноразовое и действует 48 ч. Если срок вышел — попросите новое.' : 'Неверный профиль или пароль.');
  if (r.error == 'key') return err('Войти нельзя: ' + OLDSRV + '.');
  if (r.error || typeof r.token != 'string' || !r.token) return err('Сервер не выдал вход' + (r.error ? ': ' + r.error : '') + '.');
  const nm = String(r.name || name); if (other(nm)) return err(other(nm));   // очередь остаётся за прежним профилем и к новому не привязывается
  tok = r.token; me = nm; role = r.role == 'admin' ? 'admin' : 'trader'; LS('tok', tok); LS('me', me); LS('role', role); authNeed = false; if (nz(r.srv)) { srvV = nz(r.srv); LS('srv', srvV) }
  $('#sb').innerHTML = ''; closeSheet(); drawList(); toast('Вы вошли: ' + me); sync(); if (!Object.keys(cart).length && !eo) goHome();   // поля с паролем убираем со страницы сразу
}
/* --- администратор: профили, приглашения, роли, заявки без торгового. Кнопки — только удобство: каждое действие сервер проверяет сам --- */
const STN = { active: ['Есть доступ', 'ok'], invited: ['Ждёт входа', 'wait'], invite_expired: ['Приглашение истекло', 'bad'], none: ['Нет доступа', ''], revoked: ['Отозван', ''] };   // v34: состояние профиля — цветной меткой
const ADMR = { self: 'свой профиль удалить нельзя', revoked: 'доступ отозван — сначала выдайте приглашение', not_found: 'профиль не найден', last_admin: 'это единственный действующий администратор', exists: 'такой профиль уже есть', invalid: 'недопустимое значение', changed: 'данные изменились после пробного прогона — запустите его ещё раз', confirm: 'нет подтверждения', backup: 'не удалось сделать копию листа — ничего не изменено' };
const RECN = { link_fix: 'старые заявки и визиты привязываются к карточкам магазинов', ts_fix: 'заявки получают дату оформления (сейчас она не записана)', sum_diff: 'магазины получают верные «последний заказ» и «последний визит»', no_id: 'магазины получают постоянный номер',
  ambiguous: 'записи подходят сразу к нескольким магазинам с одним названием — остаются как есть', unmatched: 'записи о магазинах, которых нет в списке, — остаются как есть', orphan: 'записи об удалённых магазинах — остаются как есть', conflict: 'записи с противоречивыми данными о магазине — остаются как есть' };
const recLine = c => { c = safeO(c) || {}; return Object.keys(RECN).filter(k => nz(c[k])).map(k => `<div class="m">${RECN[k]}: ${nz(c[k])}</div>`).join('') };
let admBusy = false;   // v36: идёт «Проверить данные»
async function admDo(body) {
  try { const r = await call({ admin: body }); if (r.applied === false) { say('Не выполнено: ' + (ADMR[r.reason] || r.reason || '—')); return null } return r }
  catch (e) { if (!e.auth) say('Не выполнено: ' + e.message); return null }
}
async function admView(reload) {
  openSheet('adm', 'Доступ и профили');
  if (reload || !adm) { $('#sb').innerHTML = '<p class="empty">Загружаю…</p>'; const r = await admDo({ op: 'list' }); if (view != 'adm') return; adm = r && Array.isArray(r.profiles) ? r.profiles : null }
  if (!adm) { $('#sb').innerHTML = '<p class="empty">Список не загрузился.</p><button class="ghost" data-a="adm">Повторить</button>'; return }
  const w = admOw, rows = w && Array.isArray(w.sample) ? w.sample : [];
  $('#sb').innerHTML = (admCode ? `<div class="sw q acode"><b>Приглашение для «${esc(admCode.profile)}»</b><div style="font:700 20px/1.7 monospace;letter-spacing:1px;user-select:all">${esc(admCode.code)}</div>Действует до ${ft(nz(admCode.until))}. Передайте лично. Код показан один раз: после закрытия окна узнать его нельзя — только выдать новый.</div>` : '')
  + adm.map(p => `<div class="acd"><div class="act"><b>${esc(p.n)}</b><span class="m">${p.role == 'admin' ? 'Администратор' : 'Торговый'}</span><span class="acs"><span class="pl ${(STN[p.state] || [])[1] || ''}">${STN[p.state] ? STN[p.state][0] : esc(p.state)}</span>${nz(p.until) ? `<span class="m">${p.state == 'invited' ? 'приглашение до' : 'было до'} ${ft(nz(p.until))}</span>` : ''}</span>${nz(p.last) ? `<span class="m">Последний вход: ${ft(nz(p.last))}</span>` : ''}</div>
    <div class="acb"><button data-a="ainv" data-v="${esc(p.n)}" data-s="${esc(p.state)}">${p.state == 'active' ? 'Сбросить пароль' : 'Приглашение'}</button>${p.state == 'active' || p.state == 'invited' ? `<button data-a="arev" data-v="${esc(p.n)}">Отозвать доступ</button>` : ''}<button data-a="arole" data-v="${esc(p.n)}" data-r="${p.role == 'admin' ? 'trader' : 'admin'}">${p.role == 'admin' ? 'Сделать торговым' : 'Сделать администратором'}</button>${norm(p.n) != norm(me) ? `<button class="bad" data-a="adel" data-v="${esc(p.n)}">Удалить профиль</button>` : ''}</div></div>`).join('')
  + `<div class="sum" style="margin-top:12px"><b>Новый профиль</b><input id="adn" maxlength="40" placeholder="Имя торгового" style="margin:8px 0"><div class="pr2"><button data-a="aadd">Добавить</button></div><p class="m" style="margin:8px 0 0">После добавления выдайте приглашение. Удалённый профиль исчезает из списка, а его заявки остаются в таблице под прежним именем. Если человек не работает временно — лучше отозвать доступ.</p></div>
  <div class="sum" style="margin-top:12px"><b>Проверка и исправление данных</b><p class="m" style="margin:6px 0">Для записей, оставшихся от старых версий: привязывает заявки и визиты к карточкам магазинов, пересчитывает «последний заказ» и «последний визит», находит заявки без торгового. Проверка только считает и ничего не меняет.</p><div class="pr2"><button data-a="afix"${admBusy ? ' disabled aria-busy="true"' : ''}>${admBusy ? 'Проверяю… это может занять до минуты' : 'Проверить данные'}</button></div>
  ${admRec ? `<div style="margin-top:10px"><b>${admRec.apply ? 'Исправлено записей' : 'Можно исправить записей'}: ${nz(admRec.changes)}</b></div>${recLine(admRec.counts)}${!admRec.apply && nz(admRec.changes) ? '<div class="pr2" style="margin-top:8px"><button data-a="arecapply">Исправить</button></div>' : ''}` : ''}
  ${w ? `<div style="margin-top:10px"><b>Заявок без торгового: ${nz(w.count)}</b>${nz(w.count) ? `<div class="m">Их нельзя изменить, пока не назначен владелец. Из них удалённых: ${nz(w.deleted)} · с ${ft(nz(w.from))} по ${ft(nz(w.to))}</div>` : ''}</div>
    ${rows.slice(0, 30).map(x => `<div class="m">${ft(nz(x.ts))} · ${esc(x.shop || '—')}${x.city ? ', ' + esc(x.city) : ''} · ${tg(x.sum)}${x.del ? ' · удалена' : ''}${x.jt ? ' · в данных заявки: ' + esc(x.jt) : ''}</div>`).join('')}${nz(w.count) > 30 ? `<div class="m">…и ещё ${nz(w.count) - 30}. Полный список — на листе «Заявки» (пустая колонка «Торговый»).</div>` : ''}
    ${nz(w.count) ? `<b style="display:block;margin-top:10px">Назначить владельцем</b><select id="aow" style="margin:6px 0"><option value="">— выберите торгового —</option>${(Array.isArray(w.traders) ? w.traders : []).map(n => `<option>${esc(n)}</option>`).join('')}</select>
    <label class="m" style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input type="checkbox" id="aoc" style="width:auto;margin:2px 0 0"><span>Я проверил список. Понимаю, что все ${nz(w.count)} заявок получат этого владельца. Перед записью сервер сам сделает копию листа «Заявки».</span></label>
    <div class="pr2"><button data-a="aoapply">Назначить владельца</button></div>` : ''}` : ''}</div>
  `;
}

/* ============ 7в. МАГАЗИНЫ: список, статусы, контакты, визиты, «кого навестить» ============ */
const norm = t => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const ST = { reg: ['Постоянный клиент', '#1E8449'], good: ['Хороший контакт', '#2E7D5B'], prom: ['Перспективный', '#A9801F'], neu: ['Нейтральный', '#7C7A69'], hard: ['Сложный', '#C0662B'], no: ['Не заходить', '#9B2C26'], closed: ['Закрыт', '#4A4A4A'], ref: ['Отказались', '#8A5A44'] };   // ref — v31: клиент отказался (причина необязательна)
const VO = ['Взяли заказ', 'Заказа нет', 'Никого не было', 'Закрыто', 'Зайти позже', 'Другое'];   // результат визита (статусы взаимоотношений — отдельно, ST). «Другое» — только с комментарием
const newSid = () => 's' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
const ago = ms => { if (!ms) return 'не было'; const d = Math.floor((dayMs(Date.now()) - dayMs(ms)) / 864e5); return d <= 0 ? 'сегодня' : d == 1 ? 'вчера' : d + ' ' + pl3(d, 'день', 'дня', 'дней') + ' назад' };   // v33: «3 дня назад», как в макете
const lastC = x => Math.max(x.lv || 0, x.lo || 0);   // последний контакт: визит или заказ
const shMatch = (b, q) => !q || norm(b.n).includes(q) || (!!b.rg && norm(b.rg).includes(q)) || (!!b.a && norm(b.a).includes(q));   // v34: поиск магазина — по названию и по району / ориентиру; v36: и по адресу (как написано в подсказке)
const streetOf = a => { const T0 = /^(?:ул|улица|пр|пр-т|проспект|мкр|мкрн|микрорайон|пер|переулок|б-р|бульвар|ш|шоссе|пл|площадь|кв-л|квартал|жк|тупик|проезд)\.?$/i;   // v34: улица без дома и квартиры: «ул. Кенесары хана, 40» → «ул. Кенесары хана», «ул. 8 Марта 15» → «ул. 8 Марта»
  let s = String(a || '').trim().replace(/[\s,]+(?:кв|оф|офис|бутик|павильон|пав)\.?\s*\d+[а-яa-z]?$/i, '').replace(/[\s,]+(?:(?:д|дом)\.?\s*)?\d+[а-яa-z]?(?:\s*[\/-]\s*\d+[а-яa-z]?)?$/i, '').replace(/[\s,]+$/, '').trim();
  return /[а-яa-z]{2}/i.test(s) && s.length >= 3 && !T0.test(s) ? s : '' };
function fillSt(c) { const m = new Map(); base.forEach(b => { const t = streetOf(b.a), k = norm(t).replace(/\.\s*/g, '. '); if (k && (!c || norm(b.c) == norm(c)) && !m.has(k)) m.set(k, t) }); const e = document.getElementById('stl'); if (e) e.innerHTML = [...m.values()].sort((a, b) => a.localeCompare(b, 'ru')).map(t => `<option value="${esc(t)}"></option>`).join('') }   // v34: подсказки улиц из адресов магазинов этого города
document.addEventListener('focusin', e => { const t = e.target, id = t && t.id; if (id == 'a') fillSt(H.c); else if (id == 'na') fillSt(($('#nc') || {}).value || H.c); else if (id == 'ea') fillSt(($('#ec') || {}).value || '') });
const rgList = c => { const m = new Map(); base.forEach(b => { const k = norm(b.rg); if (k && (!c || norm(b.c) == norm(c)) && !m.has(k)) m.set(k, String(b.rg).trim()) }); return [...m.values()].sort((a, b) => a.localeCompare(b, 'ru')) };   // v34: районы, уже введённые в базе (для подсказок и фильтра)
const STT = { reg: 'ok', good: 'ok', prom: 'wait' };   // v33: тон метки — зелёная (работаем), жёлтая (перспективный), серая (остальные)
const pill = c => c && ST[c] ? `<span class="pl ${STT[c] || 'nt'}">${ST[c][0]}</span>` : '';
const pillOf = b => b.st ? pill(b.st) : lastC(b) ? '' : '<span class="pl nt">Не были</span>';   // нет статуса и ни визитов, ни заказов — «Не были»
const byId = id => id && base.find(b => b.id == id);
const sameCity = (b, c) => !c || !b.c || norm(b.c) == norm(c);
const sameName = (n, c, except) => base.filter(b => b !== except && norm(b.n) == norm(n) && sameCity(b, c));   // v35: одноимённые магазины города («Продукты»)
const findBase = (n, c, a) => { const m = sameName(n, c); return m.length == 1 ? m[0] : m.length > 1 && a ? m.find(b => norm(b.a) == norm(a)) || null : null };   // v35: по названию — только однозначно (одно такое или совпал адрес)
async function dupAsk(n, c, a, except) { // v35: такое название в городе уже есть. Возвращает 'new' (добавить новый), найденный магазин («это он») или null (отмена)
  const m = sameName(n, c, except); if (!m.length) return 'new'; const ad = b => b.a || 'без адреса';
  if (a && m.some(b => norm(b.a) == norm(a))) { const b = m.find(x => norm(x.a) == norm(a)); return await ask('«' + b.n + '» по адресу ' + ad(b) + ' уже есть.\nОткрыть его?', 'Открыть', 'Отмена') ? b : null }
  if (!a) { say('В этом городе уже есть «' + n + '»: ' + m.map(ad).join('; ') + '.\nЕсли это другой магазин — укажите адрес: по нему их будут различать.'); return null }
  if (m.length == 1) return await ask('Уже есть «' + m[0].n + '» · ' + ad(m[0]) + '.\nЭто тот же магазин?', 'Да, это он', 'Нет, другой — добавить') ? m[0] : 'new';
  return await ask('В этом городе уже ' + m.length + ' ' + pl3(m.length, 'магазин', 'магазина', 'магазинов') + ' «' + n + '»: ' + m.map(ad).join('; ') + '.\nДобавить ещё один — по адресу ' + a + '?', 'Добавить', 'Отмена') ? 'new' : null }
/* v30. Режим цен для точки («норма»): выбор в карточке магазина (только на этом устройстве, ключ vatp) или, если не выбран, режим последней заявки в эту точку
   среди заявок, которые есть на устройстве. Заявка относится к точке по ID; по названию — только если такое название (в этом городе) в базе одно */
const ML = { vat: 'с НДС', net: 'без НДС' }, otherM = m => m == 'vat' ? 'net' : 'vat';
let VATP = LS('vatp'); if (!VATP || typeof VATP != 'object' || Array.isArray(VATP)) VATP = {};
const oShop = (o, x) => o.h.sid ? !!x.id && o.h.sid == x.id : !!o.h.s && norm(o.h.s) == norm(x.n) && sameCity(x, o.h.c) && base.filter(b => norm(b.n) == norm(x.n) && sameCity(b, o.h.c)).length <= 1;
const vmOf = x => { if (!x) return ''; if (x.vm == 'vat' || x.vm == 'net') return x.vm; const k = VATP[skey(x)]; return k == 'vat' || k == 'net' ? k : '' };   // v31: выбор — в таблице (x.vm); VATP — только до переноса
function vatNorm(x, skip) { // skip — ID заявки, которую сейчас правят: сама себе нормой не считается
  if (!x) return null; const k = vmOf(x); if (k) return { m: k, set: 1 };
  const o = allHist().find(o => !o.del && (o.m == 'vat' || o.m == 'net') && o.id != skip && oShop(o, x)); let r = o ? { m: o.m, ts: o.ts } : null;
  const sk = skip && histById(skip);   // v31: сервер знает последнюю заявку в точку по всем торговым (x.lm, x.lmt); более свежая из двух — норма
  if ((x.lm == 'vat' || x.lm == 'net') && (!r || nz(x.lmt) > r.ts) && !(sk && nz(sk.ts) == nz(x.lmt))) r = { m: x.lm, ts: nz(x.lmt) };
  return r }
const vatMsg = (x, nm, vd, vs) => [vd ? (nm.set ? `Для «${x.n}» в карточке магазина выбрано: цены ${ML[nm.m]}.` : `Последняя заявка в «${x.n}»${nm.ts ? ' (' + fd(isoDay(nm.ts)) + ')' : ''} была ${ML[nm.m]}.`) : '',
  vs ? `Режим цен переключали, пока заявка была в корзине (было ${ML[msw]}).` : '', `Эта заявка — ${ML[S.mode]}.`,
  Object.values(cart).some(c => c.p != null) ? 'При переключении ручные цены в заявке сбросятся.' : ''].filter(Boolean).join('\n');
let cMine = 0, cTot = 0, evF = 'all', evEd = '', cErr = '', cKey = '', ddL = [], eSh = null, cSh = null, cLog = null, shMode = 'route', shSt = '', shCity = null, shQ = '', cSt = '', shRg = '';   // shRg — v34: фильтр «Все магазины» по району
function shopEditView(x) { // правка названия, города, адреса / удаление магазина в общей базе
  eSh = x; $('#sl').hidden = true; openSheet('shop', 'Магазин');
  $('#sb').innerHTML = `<div class="sum"><b>Название</b><input id="en" maxlength="120" value="${esc(x.n)}"><b>Город</b><select id="ec">${[...new Set([...S.cities, x.c].filter(Boolean))].map(c => `<option ${c == x.c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><b>Адрес</b><input id="ea" maxlength="300" list="stl" autocomplete="off" value="${esc(x.a)}"><b>Тип точки</b><select id="ety">${tyOpts(x.ty)}</select></div><button class="send" data-a="ssave">Сохранить</button><button class="ghost" style="color:var(--danger);border-color:var(--danger)" data-a="sdel">Удалить магазин</button>`;
}
function shopList() { // база без дублей (по ID, иначе название + город); магазины текущего города — выше
  const m = new Map(); base.forEach(b => { const k = b.id || norm(b.n) + '|' + norm(b.c); if (!m.has(k)) m.set(k, b) });
  return [...m.values()].sort((x, y) => (norm(y.c) == norm(H.c)) - (norm(x.c) == norm(H.c)) || x.n.localeCompare(y.n, 'ru'));
}
function upShop(n, c, a, id) { if (!n) return null; let o = id ? byId(id) : findBase(n, c, a);   // v35: с ID — только по ID (новый ID — новый магазин, даже если название уже есть)
  if (o) { o.c = o.c || c || ''; o.a = o.a || a || ''; if (!o.id && id) o.id = id } else { o = { id: id || newSid(), n, c: c || '', a: a || '' }; base.push(o) }
  LS('base', base); return o }
function addShop(n) { const o = upShop(n, H.c, H.a, newSid()); H.sid = o.id; if (CFG.API_URL) { shopq.push({ n, c: H.c || '', a: H.a || '', id: o.id }); LS('shopq', shopq); sync() } }
function drawDD() {
  const raw = $('#s').value.trim(), v = norm(raw); ddL = shopList().filter(x => shMatch(x, v));
  $('#sl').innerHTML = ddL.map((x, i) => `<div class="dr"><button class="di" data-a="pick" data-v="${i}"><b>${esc(x.n)}</b><span class="m">${esc([x.ty, x.c, x.a, x.rg].filter(Boolean).join(' · '))}</span>${x.st && x.st != 'neu' ? pill(x.st) : ''}</button><button class="ed" data-a="sedit" data-v="${i}" aria-label="Карточка магазина">${ico('edit', 18)}</button></div>`).join('')
    + (v ? `<button class="di add2" data-a="padd">＋ ${ddL.some(x => norm(x.n) == v && sameCity(x, H.c)) ? 'Добавить ещё один' : 'Добавить'} «${esc(raw)}»</button>` : '')   // v35: одноимённый магазин можно добавить (с вопросом и адресом)
    || '<p class="m" style="padding:10px">Магазинов пока нет — впишите название</p>';
  $('#sl').hidden = false;
}
let shUndo = (() => { const u = LS('shundo'); return u && u.H && typeof u.H == 'object' && H.s && Date.now() - nz(u.ts) < 432e5 ? { H: u.H, hfC: !!u.hfC, v: '', k: '' } : null })();   // v36.5: переживает перезагрузку страницы (не старше 12 часов, пока выбран магазин); экран, откуда нажали «Заявка», не помним
function setUndo(u) { shUndo = u; try { LS('shundo', u ? { H: u.H, hfC: u.hfC, ts: Date.now() } : null) } catch (_) {} }
const canUnpick = () => !!shUndo || (!!H.s && !eo);   // v36.5: «Отменить» есть всегда, пока выбран магазин (кроме правки готовой заявки): вернуть прежний магазин, а если прежнего нет — снять выбор
function unpick() { // v36.5: снять выбор магазина — заявка снова как по умолчанию (дата и город остаются, товары в корзине — тоже). Вернуть можно в течение 10 секунд
  if (!H.s || eo) return drawHf(); const z = snap(), nm = H.s;
  clrShop(); const s = document.getElementById('s'), a = document.getElementById('a'), sl = document.getElementById('sl'); if (s) s.value = ''; if (a) a.value = ''; if (sl) sl.hidden = true; save(); fill();
  toast('Магазин «' + nm + '» снят', () => unsnap(z)) }
// v34: магазин и экран до «Заявка» из маршрута или карточки — для «Отменить» рядом со «Сменить»
async function orderAt(x) { // v34: «Заявка» из маршрута / карточки магазина. Товары в корзине для другого магазина — только с вопросом
  if (!x) return; const n = lines().length, same = !!H.s && (x.id && H.sid ? x.id == H.sid : norm(x.n) == norm(H.s));
  if (!same && n && H.s && !await ask('В заявке ' + n + ' ' + pl3(n, 'позиция', 'позиции', 'позиций') + ' для «' + H.s + '».\nПеренести их на «' + x.n + '»?', 'Перенести', 'Остаться в «' + H.s + '»')) return;
  const u = same ? null : { H: { s: H.s || '', a: H.a || '', sid: H.sid || '', c: H.c || '', r: H.r || '' }, hfC, v: view, k: view == 'shopc' && cSh ? skey(cSh) : '' };
  selShop(x); setUndo(u); drawHf(); closeSheet(); drawList() }
function shopBack() { // v34: «Отменить» — вернуть прежний магазин (или пустой) и экран, откуда нажали «Заявка»
  const u = shUndo; setUndo(null); if (!u) return unpick(); Object.assign(H, u.H); $('#s').value = H.s; $('#a').value = H.a; cities(); shopWarn(); hfC = !!H.s && u.hfC; save(); drawHf(); if (P.length) { drawChips(); drawList() }
  if (u.v == 'shopc' && u.k) { cKey = ''; shopCard(u.k) } else if (u.v == 'rplan') planView(); else if (u.v == 'shops') shopsView() }
function selShop(x) { setUndo(null); if (x.id && prevC[x.id] && !prevC[x.id].items.length) delete prevC[x.id];   // пустое «Брал раньше» перезапрашиваем при выборе магазина
  H.s = x.n; H.a = x.a || ''; H.sid = x.id || ''; if (x.c) { H.c = x.c; H.r = ''; cities() } $('#s').value = H.s; $('#a').value = H.a; save(); shopWarn(); hfC = true; drawHf(); if (P.length) { drawChips(); if (!view) drawList() } }   // v31: «Брал раньше» — для выбранного магазина
// --- раздел «Магазины»: «Все магазины» — справочник, «Маршрут на день» — маршрутный лист и подсказки «Стоит заехать» ---
const TY = ['магазин', 'минимаркет', 'супермаркет'];   // тип торговой точки
const RT0 = { plan: true, visit: true, vd: 14, order: true, od: 30, q: true };
let RT = { ...RT0, ...(LS('rt') || {}) }, shT = ''; RT.vd = Math.max(1, Math.min(365, Math.round(nz(RT.vd)) || RT0.vd)); RT.od = Math.max(1, Math.min(365, Math.round(nz(RT.od)) || RT0.od));
const tyOpts = cur => `<option value="">Не указан</option>${TY.map(t => `<option ${t == cur ? 'selected' : ''}>${t}</option>`).join('')}`;
function dueInfo(b) { // почему магазин попал в список визитов и насколько это срочно; null — не попадает
  const t0 = dayMs(Date.now()), D = 864e5, tags = []; let sc = 0;
  const done = visDone(b), planned = RT.plan && b.pl && b.pl <= t0 + D - 1;
  if (planned) { const d = Math.round((t0 - dayMs(b.pl)) / D); tags.push(d > 0 ? 'План: был ' + fd(isoDay(b.pl)) : 'План: сегодня'); sc += 1000 + d }
  if ((b.st == 'no' || b.st == 'closed') && !planned) return null;
  if (b.st == 'ref' && !planned && Date.now() - nz(b.sa) < 90 * D) return null;   // v31: «Отказались» — снова в подсказках через 3 месяца (мог смениться закупщик, появился новый товар)   // «не заходить» и «закрыт» не предлагаем, если визит не запланирован вручную
  if (RT.q && b.fq) { tags.push('Вопрос: ' + (b.fq.length > 40 ? b.fq.slice(0, 40) + '…' : b.fq)); sc += 500 }
  if (done && !(RT.q && b.fq)) return null;                          // визит уже отмечен сегодня
  if (!done) {
    const lc = lastC(b), dv = lc ? Math.floor((t0 - dayMs(lc)) / D) : 0;
    if (RT.visit && (!lc || dv >= RT.vd)) { tags.push(lc ? 'Не были ' + dv + ' дн.' : 'Не были'); sc += lc ? dv : 60 }
    if (RT.order && b.lo && Math.floor((t0 - dayMs(b.lo)) / D) >= RT.od) { const d = Math.floor((t0 - dayMs(b.lo)) / D); tags.push('Заказа не было ' + d + ' дн.'); sc += d / 2 }
    else if (RT.order && !b.lo && b.lv && !tags.some(x => x.startsWith('Не были'))) { tags.push('Заказов ещё не было'); sc += 20 }
  }
  return tags.length ? { tags, sc } : null;
}
function shFilt() { // v37.4: поиск, «Что с точкой», статус, город/тип/район и список — общие для «Все магазины» и выбора точек в маршрут
  const cs = [...new Set([...S.cities, ...base.map(b => b.c)].filter(Boolean))];   // v33: «Все магазины» — вариант Б (DECISIONS п. 49, 53)
  const cityF = cs.length > 1 ? `<select id="shc" aria-label="Город"><option value="">Все города</option>${cs.map(c => `<option ${c == shCity ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : '';
  return `<div class="shsr"><div class="sf"><span class="si">${ico('search', 18)}</span><input id="shq" type="search" placeholder="Имя, адрес, район" aria-label="Найти магазин: название, адрес или район" value="${esc(shQ)}"></div><button class="ghost shnew" data-a="shn">${ico('plus', 18)} Новый</button></div>
  <div id="shf"></div>
  <div class="sfl">${cityF}<select id="sht" aria-label="Тип точки"><option value="">Любой тип</option>${TY.map(t => `<option ${t == shT ? 'selected' : ''}>${t}</option>`).join('')}</select>${(() => { const r = rgList(shCity); if (shRg && !r.some(x => norm(x) == norm(shRg))) shRg = ''; return r.length ? `<select id="shr" aria-label="Район"><option value="">Все районы</option>${r.map(x => `<option ${norm(x) == norm(shRg) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : '' })()}</div>
  <div id="shl"></div>`;
}
function shopsView() { // раздел «Маршрут»: лист на сегодня или справочник «Все магазины»
  const route = shMode == 'route'; if (route) { rtDay = -1 } if (shCity === null) shCity = H.c || '';
  openSheet('shops', route ? 'Маршрут' : 'Магазины');
  if (route) { const sh = document.getElementById('sheet'); if (sh) sh.classList.add('hero');   // v33: у маршрута своя крупная шапка (DECISIONS п. 52)
    $('#sb').innerHTML = `<div id="shl"></div><div id="shx"></div>`; return drawShops() }
  $('#sb').innerHTML = `<div class="seg" style="margin-bottom:12px">${[['route', 'На сегодня'], ['all', 'Все магазины']].map(([k, t]) => `<button data-a="shm" data-v="${k}" class="${shMode == k ? 'on' : ''}">${t}</button>`).join('')}</div>` + shFilt();
  drawShops();
}
/* v35. «Общий маршрут» — маршруты всех торговых на любой день (и прошлые): по блокам торговых + «Свободные точки» (без ответственного — в маршруте у всех).
   Точки дня — по дням маршрута и ответственному (b.rw, b.ow) плюс правки дня (лист «Маршрут дня»); «пройдено» — визиты и заявки этого дня с сервера (q: 'route').
   Для прошлых дней точки считаются по ТЕКУЩИМ дням маршрута (истории дней нет). Администратор добавляет и убирает точки торговым на сегодня и вперёд. Торговым раздел виден, если администратор не выключил его в настройках */
let rgD = '', rgC = {}, rgBusy = '', rgTr = '', cfgShare = LS('cfgsh') !== false;   // v37.4: rgTr — чей маршрут: '' — мой, имя торгового, '*' — все. «Другой день»: от завтра до сегодня + PDMAX
const PDMAX = 14, addD = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return locIso(new Date(y, m - 1, dd + n, 12).getTime()) };   // rgD — выбранный день; rgC — данные дня с сервера
const rgOk = () => rdSrv();   // v36.5: раздел открыт всем: торговый планирует свои точки (вперёд), а чужие видит, только если администратор открыл общий маршрут
const rgAll = () => role == 'admin' || cfgShare;
const dayB = d => { const [y, m, dd] = d.split('-').map(Number); const a = new Date(y, m - 1, dd).getTime(); return [a, new Date(y, m - 1, dd + 1).getTime()] };
async function loadRg(d, force) { if (rgBusy || !rgOk() || !tok) return; const c = rgC[d]; if (!force && c && Date.now() - c.at < (c.err ? 15e3 : 6e4)) return;
  if (!navigator.onLine) { rgC[d] = { at: Date.now(), err: 'нет связи' }; return }
  rgBusy = d; const [from, to] = dayB(d); try { const r = await call({ q: 'route', d, from, to }); rgC[d] = r && r.ok ? { at: Date.now(), rd: safeA(r.rd), ev: safeA(r.ev) } : { at: Date.now(), err: 'сервер не отдал маршрут' } }
  catch (e) { rgC[d] = { at: Date.now(), err: e && e.message || 'ошибка' } } finally { rgBusy = '' } afterTouch('rg', () => { if (view == 'rall') rgView(); else if (view == 'pick') drawShops() }) }
const safeA = a => Array.isArray(a) ? a.filter(x => x && typeof x == 'object') : [];
function rgOn(tr, d, id) { const c = rgC[d]; let v; (c && c.rd ? c.rd : RDS.filter(r => r.d == d)).forEach(r => { if (r.sid == id && norm(r.tr) == norm(tr)) v = !!r.on });
  shopq.forEach(q => { if (q.op == 'rday' && q.d == d && q.id == id && norm(q.tr) == norm(tr)) v = !!q.on }); return v }   // правка дня: true / false / undefined (нет)
function rgView(top) {   // v37: при перерисовке на том же экране прокрутка сохраняется (раньше уходила в начало); top — новый день, начать сверху
  const sh1 = document.getElementById('sheet'), keep = !top && view == 'rall' && sh1 ? sh1.scrollTop : 0;
  openSheet('rall', 'Другой день'); const t0 = today(), dMin = rgAll() ? t0 : addD(t0, 1), dMax = addD(t0, PDMAX); if (!rgD || rgD < dMin) rgD = dMin; if (rgD > dMax) rgD = dMax;   // v37.4: «Другой день» — от завтра на 14 дней вперёд; тем, кто видит чужие маршруты (администратор и торговые при включённом «Виден торговым»), доступен ещё и сегодня — ход дня других торговых
  const d = rgD, wd = wdOfD(d), c = rgC[d]; loadRg(d);
  const adm = role == 'admin', edTr = tr => d >= t0 && (adm || (!!me && norm(tr) == norm(me))), Tall = (rgAll() ? [...new Set([...trs, me].filter(Boolean))] : [me].filter(Boolean)).sort((a, b) => a.localeCompare(b, 'ru')),
    T = rgTr == '*' && rgAll() ? Tall : rgTr && rgAll() && Tall.some(t => norm(t) == norm(rgTr)) ? Tall.filter(t => norm(t) == norm(rgTr)) : Tall.filter(t => norm(t) == norm(me)), L = base.filter(b => b.id);   // v36.5: правит свой блок каждый (на сегодня и вперёд), любой — администратор
  const ev = c && c.ev ? c.ev : [], evOf = (id, tr) => ev.filter(x => x.sid == id && (!tr || norm(x.who) == norm(tr))).sort((p, q) => p.ts - q.ts);
  const plan = tr => { const own = L.filter(b => b.ow && norm(b.ow) == norm(tr) && inWeek(b, wd)), add = L.filter(b => !own.includes(b) && rgOn(tr, d, b.id) === true);
    return { pts: own.filter(b => rgOn(tr, d, b.id) !== false).concat(add).sort((p, q) => p.n.localeCompare(q.n, 'ru')), add, out: own.filter(b => rgOn(tr, d, b.id) === false) } };
  const P = {}; Tall.forEach(t => { P[t] = plan(t) });
  const taken = new Set(Tall.flatMap(t => P[t].add.map(b => b.id))), free = L.filter(b => !b.ow && inWeek(b, wd) && !taken.has(b.id)).sort((p, q) => p.n.localeCompare(q.n, 'ru'));
  const lc = t => t ? t[0].toLowerCase() + t.slice(1) : '', pend = (b, tr) => shopq.some(q => q.op == 'rday' && q.id == b.id && q.d == d && norm(q.tr) == norm(tr)) ? ' · ждёт отправки' : '';
  const st = (b, tr) => { const e = evOf(b.id, tr), cl = e.filter(x => x.k == 'o' || !DEFER.includes(x.val)), x = cl.length ? cl[cl.length - 1] : e[e.length - 1]; return x ? { x, done: !!cl.length } : null };   // последнее закрывающее (заявка / визит), иначе — отложенное
  const sub = (x, tr) => (x.k == 'o' ? 'Заявка ' + hhmm(x.ts) : 'Визит ' + hhmm(x.ts) + ' · ' + esc(lc(x.val || ''))) + (tr ? '' : ' · ' + esc(x.who));
  const tl = (node, body) => `<div class="tl">${node}${body}</div>`, addr = b => esc(b.a || b.c || 'без адреса');
  const pt = (b, tr, note, act) => { const s0 = st(b, tr), k = esc(skey(b));   // точка — как в личном маршруте: пройдена — зелёная галочка, отложена — жёлтая пунктирная, впереди — пустой кружок
    if (s0 && s0.done) return tl(`<span class="tn ok">${ico('check', 16)}</span>`, `<button class="tlp" data-a="scard" data-v="${k}"><b>${esc(b.n)}</b><span class="m">${sub(s0.x, tr)}${note || ''}</span></button>`);
    const df = !!s0; return tl(`<span class="tn ${df ? 'df' : 'nx'}"></span>`, `<div class="tlb rgr"><button class="rrow${df ? ' df' : ''}" data-a="scard" data-v="${k}"><span class="rrt"><b>${esc(b.n)}</b><span class="m">${df ? 'Отложено в ' + hhmm(s0.x.ts) + ' · ' + esc(lc(s0.x.val || '')) + (tr ? '' : ' · ' + esc(s0.x.who)) : addr(b)}${note || ''}${tr ? pend(b, tr) : ''}</span></span>${act || `<span class="rgo">${ico('chev', 20)}</span>`}</button></div>`) };
  const rm = (b, tr) => `<span class="rgx" data-a="rgrm" data-v="${esc(b.id)}" data-t="${esc(tr)}" role="button" aria-label="Убрать «${esc(b.n)}» у ${esc(tr)}">${ico('x', 18)}</span>`;
  const blk = (tr, p) => { const edit = edTr(tr), inP = new Set(p.pts.map(b => b.id)), ext = [...new Set(ev.filter(x => norm(x.who) == norm(tr) && !inP.has(x.sid) && !free.some(b => b.id == x.sid)).map(x => x.sid))].map(byId).filter(Boolean);
    const done = p.pts.filter(b => (st(b, tr) || {}).done), todo = p.pts.filter(b => !done.includes(b)), pct = p.pts.length ? Math.round(done.length / p.pts.length * 100) : 0;
    return `<section class="rgs"><div class="rgh"><div class="rgw"><b>${esc(tr)}${norm(tr) == norm(me) ? ' <small>(вы)</small>' : ''}</b><span class="m">${p.pts.length ? p.pts.length + ' ' + pl3(p.pts.length, 'точка', 'точки', 'точек') : 'своих точек нет · свободные — внизу'}</span></div>${p.pts.length ? `<div class="rcn"><b>${done.length}<span>/${p.pts.length}</span></b><small>пройдено${ext.length ? ' · +' + ext.length + ' вне' : ''}</small></div>` : ''}</div>${p.pts.length ? `<div class="pbar"><span style="width:${pct}%"></span></div>` : ''}
      <div class="tline">${done.map(b => pt(b, tr, p.add.includes(b) ? ' · на этот день' : '')).join('')}${ext.map(b => pt(b, tr, ' · вне маршрута')).join('')}${todo.map(b => pt(b, tr, p.add.includes(b) ? ' · на этот день' : '', edit ? rm(b, tr) : '')).join('')}
      ${edit ? p.out.map(b => tl('<span class="tn nx"></span>', `<div class="tlb rgr"><div class="rrow rgo2"><span class="rrt"><b>${esc(b.n)}</b><span class="m">убрана на этот день</span></span><button class="ghost wkx" data-a="rgadd" data-v="${esc(b.id)}" data-t="${esc(tr)}">${ico('plus', 16)}<span>Вернуть</span></button></div></div>`)).join('') : ''}</div>
      ${edit ? `<button class="ghost radd" data-a="rgopen" data-t="${esc(tr)}">${ico('plus', 18)} ${T.length == 1 && norm(tr) == norm(me) ? 'Добавить точки на ' + fd(d) : 'Добавить точки · ' + esc(tr)}</button>` : ''}</section>` };   // v37.4
  const rel = relD(d),   // v37.4
    chip = ([k, t]) => `<button class="chip${(rgTr || '') == k ? ' on' : ''}" data-a="pdtr" data-v="${esc(k)}" aria-pressed="${(rgTr || '') == k}">${esc(t)}</button>`,
    chips = rgAll() && Tall.length ? `<div class="shfg"><small class="shfl">Чей маршрут</small><div class="chips shfc">${[['', 'Мой'], ...Tall.filter(t => norm(t) != norm(me)).map(t => [t, t]), ['*', 'Все']].map(chip).join('')}</div></div>` : '';
  const head = `<div class="seg pdseg"><button data-a="pdt">Сегодня</button><button class="on" aria-pressed="true">Другой день</button></div>${chips}`
    + `<div class="day"><button class="dnb" data-a="rgprev" aria-label="Предыдущий день"${d <= dMin ? ' disabled' : ''}>${ico('back', 22)}</button><div class="dl"><span>${esc(WDF[wd][0].toUpperCase() + WDF[wd].slice(1) + ', ' + fd(d))}</span><small>${c && c.err ? 'не загрузилось: ' + esc(c.err) : !c && rgBusy ? 'загружаю…' : rel}</small></div><button class="dnb" data-a="rgnext" aria-label="Следующий день"${d >= dMax ? ' disabled' : ''}>${ico('chev', 22)}</button></div>`
    + `<div class="dsw">${c && c.err ? '<button class="lnk dall" data-a="rgretry">Повторить</button>' : ''}</div>`;
  const fdone = free.filter(b => (st(b, '') || {}).done).length;
  $('#sb').innerHTML = head + '<p class="m rgn">Заявки и визиты — только в сегодняшнем маршруте.</p>'
    + T.map(t => blk(t, P[t])).join('')
    + `<section class="rgs"><div class="rgh"><div class="rgw"><b>Свободные точки</b><span class="m">без ответственного — в маршруте у всех</span></div>${free.length ? `<div class="rcn"><b>${fdone}<span>/${free.length}</span></b><small>пройдено</small></div>` : ''}</div>${free.length ? `<div class="pbar"><span style="width:${Math.round(fdone / free.length * 100)}%"></span></div>` : ''}<div class="tline">${free.map(b => pt(b, '')).join('') || '<p class="m wke">Нет.</p>'}</div></section>`;
  if (keep) { const s2 = document.getElementById('sheet'); if (s2) s2.scrollTop = keep } }
function planView() { // постоянный маршрут по дням недели и правила подсказок — отдельная страница, чтобы не мешать листу на сегодня
  if (rtDay < 0) rtDay = wdNow(); shMode = 'route'; openSheet('rplan', 'Маршрут по дням');   // v33: неделя целиком (DECISIONS п. 51)
  $('#sb').innerHTML = `<p class="m wkin" id="wki"></p><div id="shl"></div>
  <details class="rt" style="margin-top:14px"><summary>Правила подсказок «Стоит заехать»</summary>
    <label><input type="checkbox" id="rtp" ${RT.plan ? 'checked' : ''}><span>Запланированные на сегодня (и просроченные)</span></label>
    <label><input type="checkbox" id="rtv" ${RT.visit ? 'checked' : ''}><span>Давно не было визита или заказа — более <input type="number" id="rtvd" min="1" max="365" value="${RT.vd}" class="nn"> дн.</span></label>
    <label><input type="checkbox" id="rto" ${RT.order ? 'checked' : ''}><span>Давно не было заказов — более <input type="number" id="rtod" min="1" max="365" value="${RT.od}" class="nn"> дн.</span></label>
    <label><input type="checkbox" id="rtq" ${RT.q ? 'checked' : ''}><span>Есть открытый вопрос или заметка</span></label>
    <p class="m" style="margin:6px 0 0">Подсказки показываются под маршрутом на сегодня. Статусы «Не заходить» и «Закрыт» не предлагаются (кроме вручную запланированных).</p></details>`;
  drawShops();
}
/* --- Маршрутный лист: постоянные дни посещения магазина + разовые правки на сегодня. Хранится на устройстве (попадает в резервную копию) --- */
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], WDF = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const rObj = v => v && typeof v == 'object' && !Array.isArray(v) ? v : {}, skey = b => b.id || 'n:' + b.n, wdNow = () => (new Date().getDay() + 6) % 7;
let RW = rObj(LS('rw')), RD = rObj(LS('rd')), rtDay = -1, rvK = '', rtAdd = false;   // RW: магазин → дни недели (0 — Пн); RD: дата → { add, rm } — добавленные и убранные только на этот день; rtDay: −1 — сегодня, иначе день недели
const rdToday = () => { const k = today(), d = rObj(RD[k]); return RD[k] = { add: Array.isArray(d.add) ? d.add : [], rm: Array.isArray(d.rm) ? d.rm : [] } };
const saveRoute = () => { const old = isoDay(Date.now() - 14 * 864e5); Object.keys(RD).forEach(k => { if (k < old) delete RD[k] }); LS('rw', RW); LS('rd', RD) };
/* v31: дни маршрута — у точки, в таблице (b.rw), общие для всех; ответственный (b.ow) — необязателен. Точка с ответственным попадает в маршрут только к нему.
   Пока сервер старше 31 — как раньше, дни на телефоне (RW). Разовые правки на день (RD) всегда на телефоне */
const wdays = b => CFG.API_URL && srvV >= 31 && Array.isArray(b.rw) ? b.rw : Array.isArray(RW[skey(b)]) ? RW[skey(b)] : [];
const inWeek = (b, i) => wdays(b).includes(i);
const myPt = b => !b.ow || norm(b.ow) == norm(me), canDays = b => role == 'admin' || myPt(b);   // своя или свободная точка; дни чужой меняет только администратор
const daysDeny = b => say('Точка «' + b.n + '» закреплена за «' + b.ow + '»: дни маршрута меняет он или администратор.\nДобавить её себе можно в разделе «В маршрут».');
/* v35. Маршрут на день — общий, в таблице (лист «Маршрут дня»): правки дня видны торговому на любом телефоне, администратор составляет маршрут за торговых.
   RDS — правки с сервера (последняя по дате, торговому и точке), поверх — неотправленные из очереди. Пока сервер старше 35 или у точки нет ID — как раньше, на телефоне (RD) */
let RDS = Array.isArray(LS('rds')) ? LS('rds') : [];
const rdSrv = () => !!CFG.API_URL && srvV >= 35;
const rdOn = (tr, d, id) => { let v; RDS.forEach(r => { if (r.d == d && r.sid == id && norm(r.tr) == norm(tr)) v = !!r.on }); shopq.forEach(q => { if (q.op == 'rday' && q.d == d && q.id == id && norm(q.tr) == norm(tr)) v = !!q.on }); return v };
const wdOfD = d => (new Date(d + 'T12:00:00').getDay() + 6) % 7, autoIn = (b, tr, d) => inWeek(b, wdOfD(d)) && (!b.ow || norm(b.ow) == norm(tr));   // по дням маршрута: своя или свободная точка
const inPlan = (b, tr, d) => { const v = b.id ? rdOn(tr, d, b.id) : undefined; return v !== undefined ? v : autoIn(b, tr, d) };
function rdSet(b, tr, d, on) { shopq = shopq.filter(q => !(q.op == 'rday' && q.id == b.id && q.d == d && norm(q.tr) == norm(tr)));   // v37: последняя правка точки на этот день заменяет неотправленные прежние (сервер всё равно берёт последнюю)
  shopq.push({ op: 'rday', id: b.id, n: b.n, c: b.c || '', a: b.a || '', d, tr, on, rid: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); LS('shopq', shopq); sync() }
function inToday(b) { if (rdSrv() && b.id) return inPlan(b, me, today()); const d = rdToday(), k = skey(b); return !d.rm.includes(k) && (d.add.includes(k) || (inWeek(b, wdNow()) && myPt(b))) }
function migRd() { // v35: один раз — разовые правки сегодняшнего дня с телефона в таблицу (только точки с ID); после этого правки дня живут на сервере
  const k = today(), x = RD[k]; if (!x) return false; let n = 0; const go = (ids, on) => (Array.isArray(ids) ? ids : []).forEach(id => { const b = byId(id); if (b) { shopq.push({ op: 'rday', id: b.id, n: b.n, c: b.c || '', a: b.a || '', d: k, tr: me, on, rid: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); n++ } });
  go(x.add, true); go(x.rm, false); delete RD[k]; saveRoute(); if (n) LS('shopq', shopq); return n > 0 }
/* v30. «Никого не было» и «Зайти позже» откладывают точку, а не закрывают: она остаётся в списке на сегодня (внизу, с пометкой), а если у неё нет плана —
   получает план на конец сегодняшнего дня. Не дошли — завтра точка в «Стоит заехать» как просроченная. План ставится на 23:59, а не на 00:00:
   сервер снимает план при визите, если план не позже времени визита, и иначе стёр бы его тем же отложенным визитом */
const DEFER = [VO[2], VO[4]], eod = () => dayMs(Date.now()) + 864e5 - 1, isToday = ms => !!ms && dayMs(ms) == dayMs(Date.now());
const visDone = b => isToday(b.lv) && !DEFER.includes(b.lb);                        // сегодня отмечен визит, который закрывает точку
const deferred = b => isToday(b.lv) && DEFER.includes(b.lb) && !isToday(b.lo);      // сегодня отложена (и заявки сегодня не было)
function offRoute(L, cur) { // v32: точки не из сегодняшнего маршрута, где я сегодня отметил закрывающий визит или оформил заявку (по ID, иначе по названию)
  const ids = new Set(), names = new Set();
  allHist().forEach(x => { if (x.del || !isMine(x) || !isToday(x.ts) || !x.h) return; if (x.h.sid) ids.add(x.h.sid); else names.add(norm(x.h.s || '')) });
  return L.filter(b => !cur.includes(b) && ((visDone(b) && norm(b.lw || '') == norm(me)) || (b.id && ids.has(b.id)) || names.has(norm(b.n)))) }
function doneToday(b) { return visDone(b) ? (b.lb || 'Визит отмечен') : isToday(b.lo) ? 'Заявка оформлена' : '' }   // точка пройдена: закрывающий визит или заявка сегодня
function planAfter(x, val, ts) { // после визита или заявки сегодня: отложили — план на сегодня (если плана нет); закрыли — снимаем план, срок которого сегодня или раньше. true — план изменён
  if (!x || !isToday(ts)) return false;
  if (val && DEFER.includes(val)) { if (x.pl) return false; x.pl = eod() } else { if (!x.pl || x.pl > eod()) return false; x.pl = 0 }
  saveMeta(x); return true }
function setToday(b, on) { if (rdSrv() && b.id) return rdSet(b, me, today(), on); const d = rdToday(), k = skey(b), auto = inWeek(b, wdNow()) && myPt(b); d.add = d.add.filter(x => x != k); d.rm = d.rm.filter(x => x != k); if (on && !auto) d.add.push(k); if (!on && auto) d.rm.push(k); saveRoute() }   // auto — точка и так в маршруте сегодня (по дням и своя/свободная)
function setWeek(b, i, on) { const a = wdays(b).filter(x => x != i); if (on) a.push(i); a.sort();
  if (CFG.API_URL && srvV >= 31 && b.id) { b.rw = a; LS('base', base); shopq.push({ op: 'days', id: b.id, n: b.n, c: b.c || '', a: b.a || '', days: a }); LS('shopq', shopq); sync(); return }   // v31: в таблицу, через очередь
  const k = skey(b); if (a.length) RW[k] = a; else delete RW[k]; saveRoute() }
function migrate31() { // один раз после перехода на v31: дни маршрута и режимы цен, заданные на телефоне, — на сервер, только туда, где в таблице пусто
  if (LS('mig31')) return false; let n = 0; const ok = x => x && x.id && base.includes(x), q = (x, o) => { shopq.push(Object.assign({ id: x.id, n: x.n, c: x.c || '', a: x.a || '' }, o)); n++ };
  Object.keys(RW).forEach(k => { const x = shopById(k), d = RW[k]; if (ok(x) && Array.isArray(d) && d.length && !(Array.isArray(x.rw) && x.rw.length)) { x.rw = d.filter(i => Number.isInteger(i) && i >= 0 && i <= 6).sort(); q(x, { op: 'days', days: x.rw }) } });
  Object.keys(VATP).forEach(k => { const x = shopById(k), m = VATP[k]; if (ok(x) && (m == 'vat' || m == 'net') && !x.vm) { x.vm = m; q(x, { op: 'vat', m }) } });
  RW = {}; VATP = {}; LS('rw', RW); LS('vatp', VATP); LS('mig31', 1); if (n) { LS('shopq', shopq); LS('base', base) } return n > 0 }
/* v37. Мой визит в точку сегодня: подсветка результата, повторное нажатие отменяет, другой результат заменяет (DECISIONS: второй визит, вариант C).
   LV — визиты, отмеченные на этом телефоне: { ключ точки: { id, ts, val, nt, prev } }; prev — сводка точки до визита (для отмены). Визит, созданный сервером при заявке (av_<id заявки>), восстанавливается по заявке */
let LV = (o => o && typeof o == 'object' && !Array.isArray(o) ? o : {})(LS('lvt'));
const lvSave = () => { Object.keys(LV).forEach(k => { if (!LV[k] || !isToday(LV[k].ts)) delete LV[k] }); LS('lvt', LV) };
const srvAuto = () => !!CFG.API_URL && srvV >= 37;   // сервер сам записывает визит «Взяли заказ» вместе с заявкой
const todayOrder = x => allHist().find(o => !o.del && isMine(o) && isToday(o.ts) && o.h && (x.id && o.h.sid ? o.h.sid == x.id : norm(o.h.s) == norm(x.n)));
function myToday(x) { if (!x || !isToday(x.lv) || norm(x.lw || '') != norm(me)) return null;
  if (cSh === x && Array.isArray(cLog)) { const ev = (feed(x) || []).filter(y => y.k == 'visit' && !y.state && isToday(y.ts) && norm(y.who || '') == norm(me)).sort((p, q) => q.ts - p.ts)[0];   // карточка открыта: ID визитов — из ленты (и свои с других телефонов, и созданные сервером)
    if (ev) return { id: ev.id, ts: ev.ts, val: ev.val, nt: ev.nt || '', auto: /^av_/.test(String(ev.id)) ? 1 : 0 } }
  const e = LV[skey(x)]; if (e && e.ts == x.lv && e.val == x.lb) return e;
  const o = srvAuto() && x.lb == VO[0] ? todayOrder(x) : null; if (o) return { id: 'av_' + o.id, ts: x.lv, val: x.lb, nt: '', auto: 1 };
  return { id: '', ts: x.lv, val: x.lb, nt: '' } }
const cardLive = x => view == 'shopc' && cSh === x && Array.isArray(cLog);   // карточка открыта и лента загружена — сводка точки считается по ленте
const redrawVis = x => { if (view == 'shops' || view == 'rplan') drawShops(); else if (view == 'shopc') shopCard(skey(x)) };
function quickVisit(x, val, nt, rep) { // отметка визита прямо из маршрута: время — сейчас; «Отменить» в подсказке снимает отметку. rep — сегодняшний визит этой точки, который новый заменяет
  const ts = Date.now(), vid = 'v' + ts.toString(36) + Math.random().toString(36).slice(2, 6), prev = { lv: x.lv, lb: x.lb, lw: x.lw, pl: x.pl }, k = skey(x), lv0 = LV[k]; if (x.pl && x.pl <= ts) x.pl = 0;
  const rb = rep && rep.id && CFG.API_URL ? visOp(x, 'cancel', { id: rep.id, ts: rep.ts, val: rep.val, nt: rep.nt || '' }, {}) : null;   // заменяемый визит снимается тем же запуском отправки
  if (CFG.API_URL) { visq.push({ id: vid, shop: x.n, sid: x.id || '', c: x.c, a: x.a, trader: me, ts, val, note: nt }); LS('visq', visq) }
  if (ts >= (x.lv || 0)) { x.lv = ts; x.lb = val; x.lw = me } const pc = planAfter(x, val, ts); LV[k] = { id: vid, ts, val, nt: nt || '', prev: rep && lv0 && lv0.prev ? lv0.prev : prev }; lvSave(); if (cardLive(x)) recalcLocal(x); LS('base', base); if (CFG.API_URL) sync(); setTimeout(() => geoOffer(x), 0);
  toast((rep ? 'Результат заменён: ' : DEFER.includes(val) ? 'Отложено: ' : 'Визит отмечен: ') + val, () => { if (CFG.API_URL) visOp(x, 'cancel', { id: vid, ts, val, nt }, {}); if (rb) rb(); if (cardLive(x)) recalcLocal(x); else Object.assign(x, prev); if (lv0) LV[k] = lv0; else delete LV[k]; lvSave(); if (pc) saveMeta(x); LS('base', base); redrawVis(x) });
}
function visitCancelCur(x, cur) { // повторное нажатие на выбранный результат — визит отменяется («Отменить» в подсказке возвращает)
  const k = skey(x), lv0 = LV[k], pv = lv0 && lv0.prev, old = { lv: x.lv, lb: x.lb, lw: x.lw, pl: x.pl }, back = CFG.API_URL ? visOp(x, 'cancel', { id: cur.id, ts: cur.ts, val: cur.val, nt: cur.nt || '' }, {}) : null;
  if (cardLive(x)) recalcLocal(x); else if (pv) Object.assign(x, pv); else { x.lv = 0; x.lb = ''; x.lw = '' } delete LV[k]; lvSave(); LS('base', base);
  toast('Визит отменён: ' + cur.val, () => { if (back) back(); if (cardLive(x)) recalcLocal(x); else Object.assign(x, old); if (lv0) LV[k] = lv0; lvSave(); LS('base', base); redrawVis(x) }); redrawVis(x) }
async function visitSwitch(x, val, nt) { // результат визита из маршрута с учётом сегодняшнего визита этой точки. true — визит записан
  const cur = myToday(x);
  if (cur && cur.val == val) {
    if (cur.auto) { await say('Этот визит создан заявкой. Чтобы убрать его, удалите заявку в разделе «Заявки».'); return false }
    if (!cur.id) { await say('Этот визит отмечен не на этом телефоне. Отменить его можно в карточке точки, в ленте событий.'); return false }
    visitCancelCur(x, cur); return false }
  if (val == VO[0] && srvAuto()) { await orderAt(x); return false }   // «Взяли заказ» — это заявка: визит сервер запишет сам, когда заявка будет оформлена
  if (!cur || DEFER.includes(cur.val)) { quickVisit(x, val, nt); return true }   // сегодня ничего или только «отложено» — новый визит без вопросов
  if (cur.id) { if (cur.auto && !await ask('По точке «' + x.n + '» сегодня есть заявка, визит «' + cur.val + '» создан ею.\nЗаменить результат на «' + val + '»?', 'Заменить')) return false; quickVisit(x, val, nt, cur); return true }   // итоговый результат другой — заменяет прежний
  if (await ask('По точке «' + x.n + '» сегодня уже отмечено «' + cur.val + '» (не на этом телефоне).\nДобавить ещё один визит?', 'Добавить')) { quickVisit(x, val, nt); return true }
  return false }
async function visitAfterDel(o) { // v37: удалили заявку — сервер снимает с неё визит «Взяли заказ»; спрашиваем, как записать визит
  const h = o && o.h || {}, sh = h.sid ? shopById(h.sid) : base.find(b => norm(b.n) == norm(h.s));
  if (!srvAuto() || !sh || !isMine(o) || !isToday(o.ts) || !(isToday(sh.lv) && sh.lb == VO[0] && sh.lv == o.ts && norm(sh.lw || '') == norm(me))) return;
  if (allHist().some(y => y.id != o.id && !y.del && isMine(y) && isToday(y.ts) && y.h && (h.sid ? y.h.sid == h.sid : norm(y.h.s) == norm(h.s)))) return;   // осталась другая заявка — визит в силе
  const R = [VO[1], VO[4], VO[3], VO[2]], i = await dlgShow('Заявка «' + (h.s || '—') + '» удалена.\nВизит «Взяли заказ» снят вместе с ней. Как записать визит?', [...R.map(t => ({ t, c: 'ok' })), { t: 'Не записывать визит', c: 'no' }], '', R.length);
  if (i < R.length) quickVisit(sh, R[i], ''); else { sh.lv = 0; sh.lb = ''; sh.lw = ''; LS('base', base); redrawVis(sh) } }
/* ============ v33. МАРШРУТ НА СЕГОДНЯ — лента «Еду сюда» (DECISIONS п. 52) ============
   Крупная карточка — только у точки, которую торговый сам выбрал («Еду сюда»); иначе — плашка «Куда едете?». Выбор хранится на телефоне до конца дня (ключ go) */
let GO = rObj(LS('go'));
const goKey = () => GO.d == today() && !GO.df ? String(GO.k || '') : '';
function setGo(k, df) { GO = k ? { d: today(), k, t: GO.k == k && GO.d == today() ? GO.t || Date.now() : Date.now() } : {}; if (df) GO.df = 1; LS('go', GO) }
function drawToday(L) {
  const byName = (a, b) => (a.c || '').localeCompare(b.c || '', 'ru') || a.n.localeCompare(b.n, 'ru'), tcl = b => visDone(b) ? nz(b.lv) : nz(b.lo);
  const cur = L.filter(b => inToday(b)).sort(byName), done = cur.filter(b => doneToday(b)).sort((a, b) => tcl(a) - tcl(b)), ext = offRoute(L, cur).sort((a, b) => tcl(a) - tcl(b));
  const todo = cur.filter(b => !doneToday(b)).sort((a, b) => deferred(a) - deferred(b)), gk = goKey(), gb = gk ? todo.find(b => skey(b) == gk) || null : null;
  const last = GO.d == today() && GO.k ? L.find(b => skey(b) == GO.k) : null, lastDone = last && !gb && (doneToday(last) || (GO.df && deferred(last))) ? last : null;
  const rest = todo.filter(b => b !== gb); rAll = rest.map(skey);   // v37.3: выбираемые точки — для «Выбрать все»
  const live = rest.filter(b => !deferred(b)), pct = cur.length ? Math.round(done.length / cur.length * 100) : 0;
  const addr = b => esc([b.a, b.c].filter(Boolean).join(' · ') || 'без адреса'), who = b => b.lw && norm(b.lw) != norm(me) ? ' · ' + esc(b.lw) : '';
  const lc = t => t ? t[0].toLowerCase() + t.slice(1) : '', oBy = b => { const o = allHist().find(x => !x.del && isToday(x.ts) && x.h && (b.id ? x.h.sid == b.id : norm(x.h.s) == norm(b.n))); const t = o ? trOf(o) : ''; return t && norm(t) != norm(me) ? ' · ' + esc(t) : '' }, psub = b => visDone(b) && !(isToday(b.lo) && b.lo >= b.lv) ? 'Визит ' + hhmm(b.lv) + ' · ' + esc(lc(b.lb)) + who(b) : 'Заявка ' + hhmm(b.lo) + oBy(b);   // v33: как в макете — «Заявка 11:40», «Визит 10:20 · взяли заказ»; v37: автовизит «Взяли заказ» создаётся вместе с заявкой (одинаковое время) — показываем заявку
  const dfs = b => `Отложено в ${hhmm(b.lv)} · ${esc(lc(b.lb))}${b.lw && b.lw != me ? ' (' + esc(b.lw) + ')' : ''}`;
  const tl = (node, body, cls = '') => `<div class="tl${cls}">${node}${body}</div>`;
  const dl = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  let h = `<div class="rhd"><div class="rhr"><div><div class="rdt">${esc(dl)}</div><div class="rtt">Маршрут</div></div>
    <div class="rcn" aria-label="пройдено ${done.length} из ${cur.length}${ext.length ? ' · вне маршрута: ' + ext.length : ''}"><b>${done.length}<span>/${cur.length}</span></b><small>пройдено${ext.length ? ' · +' + ext.length + ' вне маршрута' : ''}</small></div></div>
    <div class="pbar"><span style="width:${pct}%"></span></div>${rgOk() ? '<div class="seg pdseg"><button class="on" aria-pressed="true">Сегодня</button><button data-a="rgall">Другой день</button></div>' : ''}${CFG.API_URL ? '<button class="rsy" data-a="syn"><span class="sd"></span><span id="sy2"></span></button>' : ''}</div><div class="tline">`;   // v37.4: переключатель «Сегодня | Другой день»
  h += done.concat(ext).map(b => tl(`<span class="tn ok">${ico('check', 16)}</span>`, `<button class="tlp" data-a="scard" data-v="${esc(skey(b))}"><b>${esc(b.n)}</b><span class="m">${psub(b)}${ext.includes(b) ? ' · вне маршрута' : ''}</span></button>`)).join('');
  if (gb) { const k = esc(skey(gb));
    h += tl(`<span class="tn go">${ico('nav', 16)}</span>`, `<div class="gocard"><div class="gor"><span class="bdgl">ЕДУ СЮДА</span><span class="m">выбрано в ${hhmm(GO.t || Date.now())}</span></div>
      <div><b class="gon">${esc(gb.n)}</b><div class="gom">${addr(gb)}</div><div class="gom">${gb.lo ? 'Последняя заявка ' + ago(gb.lo) : 'Заявок ещё не было'}</div></div>
      ${deferred(gb) ? `<span class="dfl">${ico('clock', 15)} ${dfs(gb)}</span>` : ''}${gb.fq ? `<div class="goq"><span>ВОПРОС · </span>${esc(gb.fq)}</div>` : ''}
      <div class="gob"><button class="send" data-a="rvis" data-v="${k}">${ico('check', 22)}<span>Визит</span></button><button class="send acc" data-a="rord" data-v="${k}">${ico('bag', 22)}<span>Заявка</span></button></div>
      ${rvK == skey(gb) ? (cu => `<div class="sum rv"><b>Результат визита</b><p class="m" style="margin:4px 0 8px">${cu ? 'Сегодня отмечено: «' + esc(cu.val) + '». Другой результат заменит его, повторное нажатие на выбранный — отменит.' : srvAuto() ? 'Нажмите результат — визит запишется. «Взяли заказ» откроет заявку.' : 'Нажмите результат — визит запишется. Комментарий — по желанию.'}</p><input id="rvn" maxlength="500" placeholder="Комментарий (для «Другое» — обязательно)" style="margin:0 0 10px"><div class="vg vg2">${VO.map((t, i) => `<button data-a="rres" data-v="${i}"${cu && cu.val == t ? ' class="on" aria-pressed="true"' : ''}>${t}</button>`).join('')}</div></div>`)(myToday(gb)) : ''}
      ${gq(gb) ? `<a class="ghost gonav" href="${esc(geoUrl(gb))}" target="_blank" rel="noopener">${ico('nav', 18)} Как проехать</a>` : ''}
      <div class="gol"><button class="lnk" data-a="scard" data-v="${k}">Карточка точки</button><button class="lnk" data-a="rgox">Другая точка</button></div></div>`, ' now') }
  else if (cur.length && !live.length && !gb) { const od = allHist().filter(x => !x.del && isMine(x) && isToday(x.ts)), sm = od.reduce((a, x) => a + (+x.sum || 0), 0), np = done.length + ext.length;
    h += tl(`<span class="tn ok">${ico('check', 18)}</span>`, `<div class="rsum"><small>НА СЕГОДНЯ</small><b>Маршрут пройден</b><span>${np} ${pl3(np, 'точка', 'точки', 'точек')} · ${od.length ? `${od.length} ${pl3(od.length, 'заявка', 'заявки', 'заявок')} · <em>${tg(sm)}</em>` : 'заявок нет'}</span>${rest.length ? `<span>${rest.length == 1 ? 'Осталась отложенная точка' : 'Остались отложенные точки'} — зайдите, если успеете.</span>` : ''}</div>`, ' now') }
  else if (cur.length) h += tl('<span class="tn q">?</span>', `<div class="ask">${lastDone ? `<div class="askok">${ico('check', 18)}<span>${esc(lastDone.n)} — ${doneToday(lastDone) ? (visDone(lastDone) ? 'визит отмечен, ' + esc(lc(lastDone.lb)) : 'заявка оформлена') : 'отложено, ' + esc(lc(lastDone.lb))}</span></div>` : ''}<b>${lastDone ? 'Куда дальше?' : 'Куда едете?'}</b><p>Нажмите точку ниже — она встанет сюда с кнопками «Визит» и «Заявка».</p></div>`, ' now');
  else h += tl('<span class="tn q">?</span>', '<div class="ask"><b>На сегодня точек нет</b><p>Добавьте точку кнопкой ниже или настройте маршрут по дням недели.</p></div>', ' now');
  if (selMode) { const ks = new Set(rest.map(skey)); selSet.forEach(k => { if (!ks.has(k)) selSet.delete(k) }); if (!selSet.size) selMode = false }   // v37: выбор нескольких точек — убрали/выполнили выбранную, список обновился
  if (selMode && rest.length > 1) h += tl('<span class="tn nx"></span>', `<div class="tlb"><button class="ghost rsa" data-a="rselall">${selSet.size >= rest.length ? 'Снять все' : 'Выбрать все · ' + rest.length}</button></div>`);   // v37.3
  h += rest.map(b => { const k = esc(skey(b)), df = deferred(b), sl = selMode && selSet.has(skey(b));
    if (selMode) return tl(`<span class="tn ${df ? 'df' : 'nx'}"></span>`, `<div class="tlb"><button class="rrow rsl${df ? ' df' : ''}${sl ? ' on' : ''}" data-a="rsel" data-v="${k}" role="checkbox" aria-checked="${sl}"><span class="rck">${sl ? ico('check', 18) : ''}</span><span class="rrt"><b>${esc(b.n)}</b><span class="m">${df ? dfs(b) : esc(b.a || b.c || 'без адреса') + (b.fq ? ' · есть вопрос' : '')}</span></span></button></div>`);
    return tl(`<span class="tn ${df ? 'df' : 'nx'}"></span>`, `<div class="tlb"><button class="rrow${df ? ' df' : ''}" data-a="rgo" data-v="${k}"><span class="rrt"><b>${esc(b.n)}</b><span class="m">${df ? dfs(b) : esc(b.a || b.c || 'без адреса') + (b.fq ? ' · есть вопрос' : '')}</span></span><span class="rgo">Еду сюда${ico('chev', 20)}</span></button>${df ? `<button class="ghost rno" data-a="rrm" data-v="${k}"><span>Не зайду сегодня</span></button>` : ''}</div>`) }).join('');
  h += `</div>${selMode ? `<div class="selbar" role="toolbar"><b class="selc" aria-label="Выбрано: ${selSet.size}">${selSet.size}</b><button class="ok" data-a="rselrm"${selSet.size ? '' : ' disabled'}>Убрать с сегодня</button><button class="ghost2" data-a="rselx">Отмена</button></div>` : ''}<button class="ghost radd" data-a="radd">${ico('plus', 18)} Добавить точки на сегодня</button>`;   // v37.4: выбор магазинов — отдельный экран (pickView)
  $('#shl').innerHTML = h;
  const pick = (b, tags) => `<button class="shi" data-a="rpick" data-v="${esc(skey(b))}"><div style="flex:1;min-width:0"><b>${esc(b.n)}</b><div class="m">${addr(b)}</div>${tags ? `<div class="tg">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div><span class="pl add">+ добавить</span></button>`;
  const tips = L.filter(b => !inToday(b) && myPt(b)).map(b => ({ b, d: dueInfo(b) })).filter(x => x.d).sort((x, y) => y.d.sc - x.d.sc).slice(0, 20);
  $('#shx').innerHTML = (tips.length ? `<details class="rt rtip"><summary><span>Стоит заехать · ${tips.length}</span><small class="m">не в маршруте, но давно не были или есть вопрос</small></summary>${tips.map(({ b, d }) => pick(b, d.tags)).join('')}</details>` : '')
    + `<div class="rnav"><button class="ghost" data-a="shm" data-v="all">Все магазины</button><button class="ghost" data-a="rplan">Маршрут по дням</button></div>`;   // v37.4: «Общий маршрут» / «Мой маршрут на другие дни» заменены переключателем «Другой день» (v35: общий лист — администратор ставит точки торговым)
  syncStatus();
}
function drawShops() {
  const route = shMode == 'route' && view != 'pick', q = norm(shQ);
  if (view == 'pick') return drawAll(base.filter(b => pkId(b) && (!shCity || norm(b.c) == norm(shCity)) && (!shT || b.ty == shT) && (!shRg || norm(b.rg) == norm(shRg)) && shMatch(b, q)));   // v37.4
  if (route && rtDay < 0) return drawToday(base);
  if (route) return drawWeek(base);   // v33: «Маршрут по дням» — вся неделя; лента на сегодня — все точки дня, поиск — только в списке для добавления
  let L = base.filter(b => (!shCity || norm(b.c) == norm(shCity)) && (!shT || b.ty == shT) && (!shRg || norm(b.rg) == norm(shRg)) && shMatch(b, q));   // v35: статус — рядом кнопок в drawAll (числа считаются с учётом обоих рядов)
  return drawAll(L);
}
/* v33. «Маршрут по дням» — неделя целиком: полоса нагрузки и карточка на каждый день; выбранный день раскрыт (DECISIONS п. 51) */
const WDV = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];   // «добавить в …»
function drawWeek(L) {
  const byName = (a, b) => (a.c || '').localeCompare(b.c || '', 'ru') || a.n.localeCompare(b.n, 'ru'), td = wdNow();
  const day = i => L.filter(b => inWeek(b, i) && (myPt(b) || role == 'admin')).sort(byName), D = WD.map((d, i) => day(i)), mx = Math.max(1, ...D.map(x => x.length));
  const uniq = new Set(D.flat()).size, tot = D.reduce((a, x) => a + x.length, 0);
  $('#wki').textContent = 'В эти дни точки сами попадают в маршрут на сегодня.' + (tot ? ` На неделе ${tot} ${pl3(tot, 'заезд', 'заезда', 'заездов')} в ${uniq} ${pl3(uniq, 'точку', 'точки', 'точек')}.` : '');
  let h = `<div class="wks" role="group" aria-label="Нагрузка по дням">${WD.map((d, i) => `<button class="wkc${rtDay == i ? ' on' : ''}" data-a="rday" data-v="${i}" aria-pressed="${rtDay == i}"><b>${D[i].length}</b><span class="wkb" style="height:${Math.max(4, Math.round(D[i].length / mx * 44))}px"></span><span class="wkd">${d}</span></button>`).join('')}</div>`;
  h += D.map((list, i) => { const open = i == rtDay, nm = WDF[i][0].toUpperCase() + WDF[i].slice(1), cnt = list.length ? list.length + ' ' + pl3(list.length, 'точка', 'точки', 'точек') : 'точек нет';
    const head = `<button class="wkh" data-a="rday" data-v="${open ? -2 : i}">${i == td ? '<span class="bdgl">СЕГОДНЯ</span>' : ''}<b>${nm}</b><span class="m">${cnt}</span>${ico(open ? 'up2' : 'down2', 20)}</button>`;
    if (!open) return `<div class="wkd2">${head}${list.length ? `<div class="wkt">${list.slice(0, list.length > 5 ? 4 : 5).map(b => `<span>${esc(b.n)}</span>`).join('')}${list.length > 5 ? `<span>ещё ${list.length - 4}</span>` : ''}</div>` : ''}</div>`;
    return `<div class="wkd2 on">${head}${list.map(b => `<div class="wkr"><button class="wkn" data-a="scard" data-v="${esc(skey(b))}"><b>${esc(b.n)}</b><span class="m">${esc(b.a || b.c || 'без адреса')}${b.ow ? ' · ' + esc(b.ow) : ''}</span></button><button class="ghost wkx" data-a="rwrm" data-v="${esc(skey(b))}">${ico('x', 16)}<span>Убрать</span></button></div>`).join('') || '<p class="m wke">В этот день точек нет.</p>'}
      <div class="wka"><button class="ghost radd" data-a="radd">${ico(rtAdd ? 'x' : 'plus', 18)} ${rtAdd ? 'Скрыть список' : 'Добавить магазин в ' + WDV[i]}</button>${rtAdd ? `<input id="shq" type="search" placeholder="Название, адрес или район" value="${esc(shQ)}"><div id="sha"></div>` : ''}</div></div>` }).join('');
  $('#shl').innerHTML = h; if (rtAdd) drawWeekAdd(L);
}
function drawWeekAdd(L = base) { const i = rtDay, q = norm(shQ), cur = L.filter(b => inWeek(b, i));
  const rest = L.filter(b => !cur.includes(b) && canDays(b) && shMatch(b, q)).sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  $('#sha').innerHTML = (rest.slice(0, 40).map(b => `<button class="shi" data-a="rpick" data-v="${esc(skey(b))}"><div style="flex:1;min-width:0"><b>${esc(b.n)}</b><div class="m">${esc([b.a, b.c].filter(Boolean).join(' · ') || 'без адреса')}</div></div><span class="pl add">+ добавить</span></button>`).join('')
    + (rest.length > 40 ? `<p class="m" style="margin:0 2px 8px">Показаны первые 40 из ${rest.length}. Уточните поиском.</p>` : '') || '<p class="empty">Подходящих магазинов нет: все уже в этом дне или не подходят под поиск.</p>') + nwBtn(shQ) }
/* v33. «Все магазины» — вкладки по смыслу и срочность (DECISIONS п. 49). Только на устройстве, по данным, которые уже есть; пороги — те же, что у подсказок (RT.vd, RT.od) */
let shF = 'all';
const SHF = [['all', 'Все'], ['took', 'Брали заявку'], ['far', 'Давно без визита'], ['noord', 'Без заказов'], ['mine', 'Мои'], ['ref', 'Не работаем']];   // v34: «Брали заявку» — заявка за 5 дней (сегодня и 4 дня назад); «Давно без визита» — ни визита, ни заявки (заявка — тоже посещение, как «Взяли заказ»); «Не работаем» — отказались, не заходить, закрыты
const dAgo = ms => ms ? Math.max(0, Math.floor((dayMs(Date.now()) - dayMs(ms)) / 864e5)) : null;   // дней с даты; null — не было
const shOut = b => b.st == 'ref' || b.st == 'no' || b.st == 'closed';   // не работаем: в общем списке — свёрнуто внизу
function shClass(b) { const dc = dAgo(lastC(b)), dor = dAgo(b.lo), out = shOut(b);
  return { dc, out, far: !out && (dc === null || dc >= RT.vd), noord: !out && (dor === null || dor >= RT.od), mine: !!b.ow && norm(b.ow) == norm(me), ref: out, took: dor !== null && dor <= 4 } }
const shUrg = (a, b) => { const x = shClass(a).dc, y = shClass(b).dc; return (x === null ? 1e9 : x) == (y === null ? 1e9 : y) ? a.n.localeCompare(b.n, 'ru') : (y === null ? 1e9 : y) - (x === null ? 1e9 : x) };   // сначала без контактов, потом — дольше всего не были
function shRow(b) { const k = shClass(b), urg = k.dc === null || k.dc >= RT.vd;
  const own = b.ow ? (k.mine ? 'вы' : esc(b.ow)) : (CFG.API_URL && srvV >= 31 ? 'свободная' : '');
  const sub = !b.lv && !b.lo ? 'Ни визитов, ни заказов' : [b.lv ? 'Визит ' + ago(b.lv) : '', b.lo ? 'заказ ' + ago(b.lo) : 'заказов не было'].filter(Boolean).join(' · ');
  const tile = k.dc === null ? '<b>нет</b><small>визитов</small>' : k.dc == 0 ? '<b class="sm">сегодня</b>' : `<b>${k.dc}</b><small>дн.</small>`;
  if (view == 'pick' && pk) { const key = esc(skey(b)), tail = `<span class="sdt${urg ? ' urg' : ''}" aria-label="${k.dc === null ? 'контактов не было' : 'дней с последнего контакта: ' + k.dc}">${tile}</span>`;   // v37.4: тап — добавить, удержание — выбрать несколько
    if (pkIn(b)) return `<div class="shrow off" aria-disabled="true"><span class="pkc"></span><span class="srt"><b>${esc(b.n)}</b><span class="m">Уже в этом дне</span></span><span class="sdt in">${ico('check', 18)}</span></div>`;
    const sl = pkMode && pkSel.has(skey(b));
    return `<button class="shrow${sl ? ' pks' : ''}" data-a="pkrow" data-v="${key}"${pkMode ? ` role="checkbox" aria-checked="${sl}"` : ''}>${pkMode ? `<span class="pkc${sl ? ' on' : ''}">${sl ? ico('check', 16) : ''}</span>` : ''}<span class="srt"><b>${esc(b.n)}</b><span class="srp">${pillOf(b) || '<span class="pl nt">Без статуса</span>'}${own ? `<span class="m">· ${own}</span>` : ''}</span><span class="m">${[b.ty, b.a, b.rg].filter(Boolean).map(esc).join(' · ') || esc(b.c || '')}</span><span class="m">${sub}</span></span>${tail}</button>` }
  return `<button class="shrow" data-a="scard" data-v="${esc(skey(b))}"><span class="srt"><b>${esc(b.n)}</b><span class="srp">${pillOf(b) || '<span class="pl nt">Без статуса</span>'}${own ? `<span class="m">· ${own}</span>` : ''}</span><span class="m">${[b.ty, b.a, b.rg].filter(Boolean).map(esc).join(' · ') || esc(b.c || '')}</span><span class="m">${sub}</span></span><span class="sdt${urg ? ' urg' : ''}" aria-label="${k.dc === null ? 'контактов не было' : 'дней с последнего контакта: ' + k.dc}">${tile}</span></button>` }
const STS = { reg: 'Постоянный', good: 'Хороший', prom: 'Перспективный', neu: 'Нейтральный', hard: 'Сложный', no: 'Не заходить', closed: 'Закрыт', ref: 'Отказались' };   // v35: короткие названия статусов для ряда кнопок
function drawAll(L0) { // v35: два ряда кнопок — «что с точкой» и статус; числа в каждом ряду — с учётом выбора в другом
  const stOk = b => !shSt || (shSt == '-' ? !b.st : b.st == shSt), fOk = b => shF == 'all' || shClass(b)[shF], L = L0.filter(stOk), cnt = {};
  SHF.forEach(([f]) => { cnt[f] = f == 'all' ? L.length : L.filter(b => shClass(b)[f]).length });
  if (shF != 'all' && !SHF.some(([f]) => f == shF)) shF = 'all'; if (shF == 'mine' && !cnt.mine) shF = 'all';
  const Lf = L0.filter(fOk), sc = k => Lf.filter(b => k == '-' ? !b.st : b.st == k).length, sts = [...Object.keys(ST).map(k => [k, STS[k] || ST[k][0], sc(k)]).filter(x => x[2] || x[0] == shSt), ...(sc('-') || shSt == '-' ? [['-', 'Без статуса', sc('-')]] : [])];
  $('#shf').innerHTML = `<div class="shfg"><small class="shfl">Что с точкой</small><div class="chips shfc">${SHF.filter(([f]) => f != 'mine' || cnt.mine).map(([f, t]) => `<button class="chip${shF == f ? ' on' : ''}" data-a="shf" data-v="${f}" aria-pressed="${shF == f}">${t} <em>${cnt[f]}</em></button>`).join('')}</div></div>
    ${sts.length ? `<div class="shfg"><small class="shfl">Статус</small><div class="chips shfc">${sts.map(([k, t, n]) => `<button class="chip${shSt == k ? ' on' : ''}" data-a="shst" data-v="${k}" aria-pressed="${shSt == k}">${k && k != '-' ? `<span class="sdot" style="background:${ST[k][1]}"></span>` : ''}${t} <em>${n}</em></button>`).join('')}</div></div>` : ''}
    <div class="shsort m">${ico('down', 16)} ${shF == 'took' ? 'Заявки с ' + fd(locIso(Date.now() - 4 * 864e5)) + ' по ' + fd(locIso(Date.now())) + ' (5 дней), сначала свежие' : 'По срочности: сначала те, где давно не были'}</div>`;
  const grp = (t, list) => list.length ? `<h3 class="sub">${t} · ${list.length}</h3><div class="shls">${list.map(shRow).join('')}</div>` : '';
  let h, vis = [];
  if (shF == 'all') { const live = L.filter(b => !shOut(b)), out = L.filter(shOut).sort(shUrg); vis = live;
    h = grp('Давно без визита', live.filter(b => shClass(b).far).sort(shUrg)) + grp('Были недавно', live.filter(b => !shClass(b).far).sort(shUrg))
      + (out.length ? `<details class="rt shout"><summary>Отказались, не заходить, закрыты · ${out.length}</summary><div class="shls">${out.map(shRow).join('')}</div></details>` : '') }
  else { vis = L.filter(b => shClass(b)[shF]); h = grp(SHF.find(([f]) => f == shF)[1], vis.sort(shF == 'took' ? (a, b) => (b.lo || 0) - (a.lo || 0) : shUrg)) }
  let pre = '', post = '';
  if (view == 'pick' && pk && pkMode) { pkVis = vis.filter(b => !pkIn(b)).map(skey); const all = pkVis.length && pkVis.every(k => pkSel.has(k)), n = pkSel.size;   // v37.4: «Выбрать все» — те, что видны под фильтрами и ещё не в дне
    pre = `<div class="pksa"><button class="ghost rsa" data-a="pkall">${all ? 'Снять все' : 'Выбрать все · ' + pkVis.length}</button></div>`;
    post = `<div class="selbar pkbar" role="toolbar"><b class="selc" aria-label="Выбрано: ${n}">${n}</b><button class="ok" data-a="pkgo"${n ? '' : ' disabled'}>Добавить ${n} на ${fdl(pk.d)}</button><button class="ghost2" data-a="pkx">Отмена</button></div>` }
  $('#shl').innerHTML = pre + (h || '<p class="empty">Магазинов не найдено</p>') + nwBtn(shQ) + post;
}
/* v37.4. Выбор магазинов в маршрут — один экран для сегодня и любого другого дня: те же поиск и фильтры, что во «Все магазины».
   Тап по магазину — сразу в день (с «Отменить»); удержание — выбор нескольких (фильтры остаются), «Добавить N на …» */
let pk = null, pkMode = false, pkSel = new Set(), pkVis = [];   // pk: { tr — чей маршрут, d — день, from — откуда пришли ('today' | 'day') }
const fdl = d => new Date(d + 'T12:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long' });
const relD = d => { const n = Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5); return n == 0 ? 'сегодня' : n == 1 ? 'завтра' : n == 2 ? 'послезавтра' : 'через ' + n + ' ' + pl3(n, 'день', 'дня', 'дней') };
const inDay = (b, tr, d) => norm(tr) == norm(me) && d == today() ? inToday(b) : b.id ? inPlan(b, tr, d) : false;   // точка в маршруте торгового на день (по данным на телефоне)
let cRt = { tr: '', d: '' };   // раздел «В маршрут» в карточке: чей маршрут и какой день выбран
const pkOwn = () => !!pk && norm(pk.tr) == norm(me) && pk.d == today();   // свой маршрут на сегодня — точки без ID тоже можно (как раньше)
const pkId = b => !!b.id || pkOwn();
const pkIn = b => { if (!pk) return false; if (pkOwn()) return inToday(b); if (!b.id) return false; const v = rgOn(pk.tr, pk.d, b.id); return v !== undefined ? v : autoIn(b, pk.tr, pk.d) };
const pkPut = (b, on) => { if (pkOwn()) setToday(b, on); else if (b.id) rdSet(b, pk.tr, pk.d, on) };
function pickBody() { if (!pk) return;
  $('#sb').innerHTML = `<div class="pkh"><div class="eyebrow">План · ${relD(pk.d)}${norm(pk.tr) == norm(me) ? '' : ' · ' + esc(pk.tr)}</div><div class="pkt" role="heading" aria-level="2">Добавить на ${fdl(pk.d)}</div><p class="m pkn">Нажмите на магазин — он сразу попадёт в день. Чтобы выбрать несколько, удерживайте.</p></div>` + shFilt();
  drawShops() }
function pickView(tr, d, from) { if (!tr || !d || (role != 'admin' && norm(tr) != norm(me))) return;
  pk = { tr, d, from: from || 'today' }; pkMode = false; pkSel = new Set(); pkVis = []; shQ = ''; if (shCity === null) shCity = H.c || '';
  if (!pkOwn()) loadRg(d);
  openSheet('pick', 'Выбор магазинов'); pickBody() }
function pkBack() { const f = pk && pk.from == 'day'; pk = null; pkMode = false; pkSel = new Set(); if (f) rgView(); else { shMode = 'route'; shopsView() } }
function pkStart(k) { if (pkMode || !pk || !k) return; const b = shopById(k); if (!b || pkIn(b)) return; pkMode = true; pkSel = new Set([k]); try { navigator.vibrate && navigator.vibrate(15) } catch (_) {} drawShops() }
function pkExit() { if (!pkMode && !pkSel.size) return; pkMode = false; pkSel = new Set(); if (view == 'pick') drawShops() }
function pkAdd(xs) { xs = xs.filter(b => b && !pkIn(b)); if (!xs.length) return;
  const tr = pk.tr, d = pk.d, put = on => { if (!pk || pk.tr != tr || pk.d != d) { const ps = pk; pk = { tr, d }; xs.forEach(b => pkPut(b, on)); pk = ps } else xs.forEach(b => pkPut(b, on)) };
  put(true); const where = (norm(tr) == norm(me) ? '' : tr + ', ') + fdl(d);
  cSaved(xs.length == 1 ? 'Добавлена: «' + xs[0].n + '» · ' + where : 'Добавлено ' + xs.length + ' ' + pl3(xs.length, 'точка', 'точки', 'точек') + ' · ' + where, () => { put(false); if (view == 'pick') drawShops(); else if (view == 'rall') rgView(); else if (view == 'shops') drawShops() }) }
const shopById = v => String(v).startsWith('n:') ? base.find(b => b.n == v.slice(2)) : byId(v);
let cVO = false, cOpen = new Set((Array.isArray(LS('copen')) ? LS('copen') : []).map(String));   // cVO — открыта отметка визита; cOpen — какие разделы карточки раскрыты (запоминается)
const feedSub = x => { const ev = feed(x); return ev === null ? (cLog === false ? 'не загрузилась' : 'загружается…') : ev.length ? 'последнее: ' + ft(ev[0].ts) : 'событий пока нет' };
function shopCard(v) {
  const x = shopById(v) || cSh; if (!x) return shopsView();
  if (cKey != (x.id || x.n)) { cKey = x.id || x.n; cLog = null; cMine = 0; cTot = 0; evF = 'all'; evEd = ''; cErr = ''; cSt = x.st || '-'; cVO = false; cRt = { tr: me, d: today() }; loadLog(x) } cSh = x;
  openSheet('shopc', ''); const wk = WD.filter((d, i) => inWeek(x, i));
  const sec = (id, title, sub, body, ic) => `<details class="sc cs" data-s="${id}"${(id == 'rt' ? !cOpen.has('rt0') : cOpen.has(id)) ? ' open' : ''}><summary>${ic ? ico(ic, 22) : ''}<span class="cst">${title}<small class="m"${id == 'feed' ? ' id="fsub"' : ''}>${sub}<em class="svm" id="sv-${id}">${secMark(x, id)}</em></small></span></summary>${body}</details>`;
  const visit = cVO ? `<div class="sum rv" style="margin-top:10px"><b>Результат визита</b><p class="m" style="margin:4px 0 8px">Нажмите результат — визит запишется. Комментарий — по желанию.</p><input id="vn" maxlength="500" placeholder="Комментарий (для «Другое» — обязательно)" style="margin:0 0 10px"><div class="vg vg2">${VO.map((t, i) => `<button data-a="vis" data-v="${i}"${(c0 => c0 && c0.val == t ? ' class="on" aria-pressed="true"' : '')(myToday(x))}>${t}</button>`).join('')}</div>
    <details class="mini" style="margin-top:10px"><summary>Визит был раньше — указать дату и время</summary><div class="vdt"><input type="date" id="vd" max="${today()}" value="${today()}" aria-label="Дата визита"><input type="time" id="vt" value="${hhmm(Date.now())}" data-t0="${hhmm(Date.now())}" aria-label="Время визита"></div></details>
    <div class="m" id="myl" style="margin-top:8px">${myLast(x) ? 'Ваш последний визит сюда: ' + ft(myLast(x)) : 'Вы здесь ещё не отмечались'}</div></div>` : '';
  const stBody = `<div class="sg"><button data-a="sst" data-v="-" class="${cSt == '-' ? 'on' : ''}" style="grid-column:1/3">Не были (без статуса)</button>${Object.keys(ST).map(k => `<button data-a="sst" data-v="${k}" class="${cSt == k ? 'on' : ''}">${ST[k][0]}</button>`).join('')}</div>
    <div id="stw" ${cSt == '-' ? 'hidden' : ''}><input id="stn" maxlength="500" placeholder="${stPh(cSt)}" value="${esc(x.nt || '')}" style="margin:10px 0 0"><div class="rsn"${cSt == 'ref' ? '' : ' hidden'}><p class="m" style="margin:8px 0 6px">Причина — по желанию. Частые:</p>${RSN.map(r => `<button data-a="rsn" data-v="${esc(r)}">${esc(r)}</button>`).join('')}<button data-a="rsn" data-v="">Без причины</button></div></div><div class="m" style="margin-top:10px">Действует с (необязательно — если статус был установлен раньше)</div><input type="date" id="sef" max="${today()}" style="margin-top:4px"><button class="send" style="margin-top:10px" data-a="sstsave">Сохранить статус</button>`;
  const plBody = `<div class="pr2"><input type="date" id="pld" min="${today()}" value="${x.pl ? isoDay(x.pl) : today()}" aria-label="Дата визита по плану"><button data-a="plan">${x.pl ? 'Перенести' : 'Запланировать'}</button>${x.pl ? '<button class="ghost2" data-a="planx">Убрать</button>' : ''}</div>
    <input id="fqi" maxlength="500" placeholder="Открытый вопрос / что не забыть" value="${esc(x.fq || '')}" style="margin:10px 0 0"><div class="pr2"><button data-a="fqs">Сохранить вопрос</button>${x.fq ? '<button class="ghost2" data-a="fqx">Решён</button>' : ''}</div>`;
  const ctBody = `<input id="ict" maxlength="100" placeholder="Имя, должность" value="${esc(x.ct || '')}" style="margin:4px 0 8px"><input id="itl" maxlength="40" inputmode="tel" placeholder="Телефон" value="${esc(x.tl || '')}" style="margin:0 0 8px"><input id="irg" maxlength="100" placeholder="Район / ориентир" list="rgl" autocomplete="off" value="${esc(x.rg || '')}" style="margin:0 0 8px"><datalist id="rgl">${rgList(x.c).map(r => `<option value="${esc(r)}"></option>`).join('')}</datalist><input id="iul" maxlength="120" placeholder="Юрлицо: ИП или ТОО (как в документах)" value="${esc(x.ul || '')}" style="margin:0 0 8px"><button class="ghost" style="margin-top:0" data-a="sinfo">${ico('save', 18)} Сохранить контакт</button>`;
  const own0 = CFG.API_URL && srvV >= 31 ? `<span class="pl nt">${x.ow ? (norm(x.ow) == norm(me) ? 'Ваша точка' : 'Ответственный: ' + esc(x.ow)) : 'Точка свободна'}</span>` : '';
  $('#sb').innerHTML = `<div class="shh"><div class="shr"><div class="shk">${esc([x.ty || 'точка', x.c].filter(Boolean).join(' · ').toUpperCase())}</div><button class="ghost shed" data-a="sedit2">${ico('edit', 18)} Изменить</button></div>
    <div class="shn">${esc(x.n)}</div><div class="gom">${esc(x.a || 'без адреса')}</div>${x.ul ? `<div class="shul">${esc(x.ul)}</div>` : ''}
    <div class="shp">${pillOf(x) || '<span class="pl nt">Без статуса</span>'}${own0}${x.pl ? `<span class="pl wait">Визит по плану: ${fd(isoDay(x.pl))}</span>` : ''}</div>
    ${x.sb ? `<div class="m">Статус поставил ${esc(x.sb)}, ${fd(isoDay(x.sa))}</div>` : ''}${x.nt ? `<div class="shnt">${esc(x.nt)}</div>` : ''}</div>
  <div class="sht3" id="sml">${sumTiles(x)}</div>
  ${x.fq ? `<div class="shq"><small>ОТКРЫТЫЙ ВОПРОС</small><b>${esc(x.fq)}</b></div>` : ''}${x.nb ? `<div class="shnb"><small>ЗАМЕТКИ</small><div>${esc(x.nb)}</div></div>` : ''}
  <div class="cta"><button class="send alt${cVO ? ' on' : ''}" data-a="cvis">${ico(cVO ? 'x' : 'check', 22)} ${cVO ? 'Закрыть' : 'Визит'}</button><button class="send" data-a="sord" data-v="${esc(x.id || '')}">${ico('bag', 22)} Заявка</button></div>
  ${visit}
  ${x.tl || gq(x) ? `<div class="cta2">${x.tl ? `<a class="ghost" href="tel:${esc(x.tl.replace(/[^\d+]/g, ''))}">${ico('phone', 18)} Позвонить</a>` : ''}${gq(x) ? `<a class="ghost" href="${esc(geoUrl(x))}" target="_blank" rel="noopener">${ico('nav', 18)} Как проехать</a>` : ''}</div>` : ''}
  <div class="scs">
  ${rtSec(x, sec)}
  ${sec('days', 'Дни маршрута', wk.length ? wk.join(', ') : 'не заданы', `<div class="m">${canDays(x) ? 'В эти дни магазин сам попадает в маршрут на сегодня' + (x.ow ? '' : ' (у всех торговых, пока точка свободна)') : 'Точка закреплена за «' + esc(x.ow) + '»: дни меняет он или администратор'}</div><div class="wk" style="margin:8px 0 0">${WD.map((d, i) => `<button data-a="rwd" data-v="${i}" class="${inWeek(x, i) ? 'on' : ''}"${canDays(x) ? '' : ' disabled'}>${d}</button>`).join('')}</div>`, 'cal')}
  ${CFG.API_URL && srvV >= 31 ? sec('own', 'Ответственный', x.ow ? esc(x.ow) + (norm(x.ow) == norm(me) ? ' (вы)' : '') : 'свободная точка', ownBody(x), 'user') : ''}
  ${sec('vat', 'Цены для магазина', vatSub(x), vatBody(x), 'tag')}
  ${x.id && CFG.API_URL ? sec('nb', 'Заметки', x.nb ? esc(x.nb.split('\n')[0].slice(0, 40)) + (x.nb.length > 40 || x.nb.includes('\n') ? '…' : '') : 'нет', `<textarea id="inb" maxlength="2000" rows="4" placeholder="Что важно знать о точке: как подъехать, кого спросить, когда принимают товар">${esc(x.nb || '')}</textarea><div class="pr2 nbb"><button class="ghost" data-a="snb">${ico('save', 18)} Сохранить заметку</button>${x.nb ? `<button class="ghost bad" data-a="snbc">${ico('trash', 18)} Очистить</button>` : ''}</div>`, 'edit') : ''}
  ${sec('ct', 'Контакт и юрлицо', esc([x.ct, x.tl, x.ul].filter(Boolean).join(' · ')) || 'не указаны', ctBody, 'phone')}
  ${sec('geo', 'Место точки', geoTxt(x), geoBody(x), 'pin')}
  ${sec('plan', 'План и вопрос', [x.pl ? 'визит ' + fd(isoDay(x.pl)) : '', x.fq ? 'есть вопрос' : ''].filter(Boolean).join(' · ') || 'не заданы', plBody, 'clock')}
  ${sec('feed', 'Лента событий', feedSub(x), `<div class="m">Заказы, визиты и статусы. Время события и время внесения показаны отдельно, если различаются.</div><div id="feed">${feedHtml(x)}</div>`, 'list')}
  ${sec('st', 'Статус', x.st && ST[x.st] ? ST[x.st][0] : 'не задан', stBody, 'check')}
  </div>
`;
}
/* v37.4. Карточка магазина → «В маршрут»: 7 дней (сегодня и 6 вперёд) с числом точек в дне; зелёная рамка — точка уже в дне. Администратор выбирает, в чей маршрут */
function rtSec(x, sec) {
  const adm = role == 'admin', t0 = today(); if (!adm || !cRt.tr) cRt.tr = me; if (!cRt.d || cRt.d < t0) cRt.d = t0;
  const tr = cRt.tr, d = cRt.d, ds = Array.from({ length: 7 }, (_, i) => addD(t0, i)), isMe = norm(tr) == norm(me), who = isMe ? '' : tr, can = !!x.id || (isMe && d == t0), on = inDay(x, tr, d);
  const trList = adm ? [...new Set([me, ...trs].filter(Boolean))] : [];
  const inD = ds.filter(z => inDay(x, tr, z)), sub = (isMe ? 'в вашем маршруте' : 'в маршруте «' + esc(tr) + '»') + (inD.length ? ': ' + inD.map(z => z == t0 ? 'сегодня' : fd(z)).join(', ') : ' на ближайшие 7 дней нет');
  const chips = adm && trList.length > 1 ? `<div class="eyebrow">В чей маршрут</div><div class="chips" style="margin:0 0 10px">${trList.map(t => `<button class="chip${norm(t) == norm(tr) ? ' on' : ''}" data-a="rttr" data-v="${esc(t)}" aria-pressed="${norm(t) == norm(tr)}">${norm(t) == norm(me) ? 'Мой' : esc(t)}</button>`).join('')}</div>` : '';
  const days = `<div class="wk rtw" role="group" aria-label="День маршрута">${ds.map((z, i) => { const n = base.filter(b => inDay(b, tr, z)).length, here = inDay(x, tr, z); return `<button data-a="rtdy" data-v="${z}" class="${here ? 'in' : ''}${z == d ? ' on' : ''}" aria-pressed="${z == d}" aria-label="${esc(fdl(z))}: ${n} ${pl3(n, 'точка', 'точки', 'точек')}${here ? ', магазин уже в дне' : ''}"><small>${i == 0 ? 'СЕГ' : WD[wdOfD(z)].toUpperCase()}</small>${+z.slice(8)}<em>${n}</em></button>` }).join('')}</div>`;
  const lbl = on ? (isMe ? 'Убрать ' + (d == t0 ? 'из маршрута на сегодня' : 'с ' + fdl(d)) : 'Убрать из маршрута «' + esc(tr) + '» ' + (d == t0 ? 'на сегодня' : 'с ' + fdl(d))) : (isMe ? 'Добавить на ' : 'Добавить в маршрут «' + esc(tr) + '» на ') + (d == t0 ? 'сегодня' : fdl(d));   // имена не склоняем
  return sec('rt', 'В маршрут', sub, `${chips}${days}<p class="m rth">Зелёная рамка — магазин уже в этом дне. Число — сколько точек в дне. Дни недели, по которым магазин ездит всегда, — в разделе «Дни маршрута».</p>${can ? `<button class="${on ? 'ghost' : 'send'}" data-a="rtgo" style="margin-top:0">${on ? ico('x', 18) : ico('plus', 20)} ${lbl}</button>` : '<p class="m">У точки ещё нет ID — добавить её можно только в свой маршрут на сегодня.</p>'}`, 'nav') }
const vatSub = x => { const vp = vmOf(x), nm = vatNorm(x); return vp ? ML[vp] + ' (выбрано)' : 'по последней заявке: ' + (nm ? ML[nm.m] : 'заявок пока нет') };
const vatBody = x => { const vp = vmOf(x); return `<div class="seg sg3" style="margin:4px 0 8px">${[['vat', 'С НДС'], ['net', 'Без НДС'], ['', 'По последней заявке']].map(([k, t]) => `<button data-a="svat" data-v="${k}" class="${vp == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <p class="m" style="margin:0">Если режим заявки будет другим, приложение спросит при отправке. ${CFG.API_URL && srvV >= 31 ? 'Выбор общий для всех торговых.' : 'Выбор хранится только на этом телефоне.'}</p>` };
function ownBody(x) { // v31: ответственный за точку. Свободную берёт любой, свою отдаёт сам, чужую передаёт администратор
  const o = x.ow, mine = !!o && norm(o) == norm(me), adm = role == 'admin';
  let h = `<p class="m" style="margin:0 0 8px">${!o ? 'Свободная точка: в дни маршрута она у всех торговых, дни может менять любой.' : mine ? 'Точка закреплена за вами: она только в вашем маршруте, дни меняете вы (и администратор).' : 'Точка закреплена за «' + esc(o) + '»: она в его маршруте, дни меняет он или администратор. Разово добавить её себе можно в разделе «В маршрут».'}</p>`;
  if (!o) h += `<button class="send" style="margin-top:0" data-a="own" data-v="take">${ico('user', 20)} Беру точку</button>`;
  else if (mine || adm) h += `<button class="ghost" data-a="own" data-v="release">Освободить точку</button>`;
  if (adm) { const t = trs.filter(n => !o || norm(n) != norm(o)); if (t.length) h += `<p class="m" style="margin:12px 0 6px">Передать точку торговому:</p><div class="vg vg2">${t.map(n => `<button data-a="own" data-v="set" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>` }
  return h }
/* v31. Место точки (GPS): только по кнопке или по предложению после визита «прямо сейчас». До 10 секунд уточнения, без отказа; хуже 100 м — вопрос.
   Хранится в таблице: широта, долгота, точность, кто и когда. «Нет» на предложение — запоминается на этом телефоне для этой точки */
let GEO_MS = 1e4, geoNo = new Set((Array.isArray(LS('geono')) ? LS('geono') : []).map(String)), geoBusy = false;
const geoDist = (p, q) => { const R = 6371e3, r = Math.PI / 180, dl = (q.la - p.la) * r, dn = (q.ln - p.ln) * r, h = Math.sin(dl / 2) ** 2 + Math.cos(p.la * r) * Math.cos(q.la * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) };   // метры
const gq = x => !!x && x.la != null && x.ln != null && isFinite(x.la) && isFinite(x.ln);
const geoTxt = x => gq(x) ? (nz(x.ac) <= 100 ? 'точно' : 'приблизительно') + ' (±' + nz(x.ac) + ' м)' : 'не записано';
const geoUrl = x => 'https://www.google.com/maps/dir/?api=1&destination=' + nz(x.la) + ',' + nz(x.ln);   // официальный формат ссылок Google Maps: на телефоне открывает приложение карт
const geoBody = x => `${gq(x) ? `<p class="m" style="margin:0 0 8px">Записал${x.gb ? ': ' + esc(x.gb) : 'и'}${x.ga ? ', ' + ft(x.ga) : ''}. ${nz(x.ac) > 100 ? 'Место приблизительное — уточните, когда будете на точке.' : ''}</p>` : `<p class="m" style="margin:0 0 8px">Нажмите, когда стоите у магазина: место поможет доехать по кнопке «Как проехать», а позже — строить маршрут.</p>`}
  <div class="m" id="geost" style="min-height:1.2em;margin-bottom:6px"></div><button class="ghost" style="margin-top:0" data-a="geo">${ico('pin', 18)} ${gq(x) ? 'Обновить место' : 'Записать место'}</button>${gq(x) && role == 'admin' && x.id ? `<button class="ghost" style="color:var(--danger);border-color:var(--danger)" data-a="geodel">${ico('trash', 18)} Удалить место</button>` : ''}`;   // v32: удалить место — только администратор
async function geoDel(x) { // v32: удалить записанное место. Только администратор (сервер проверяет сам); в журнал пишется, какое место было
  if (!x || !gq(x) || role != 'admin' || !x.id) return;
  if (!await ask('Удалить записанное место точки «' + x.n + '»?\nКнопка «Как проехать» пропадёт, пока место не запишут заново.', 'Удалить', 'Отмена', true)) return;
  Object.assign(x, { la: null, ln: null, ac: 0, gb: '', ga: 0 }); LS('base', base);
  if (CFG.API_URL) { shopq.push({ op: 'geodel', id: x.id, n: x.n, c: x.c || '', a: x.a || '' }); LS('shopq', shopq); sync() }
  toast('Место точки удалено'); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }
function geoProg(t) { const e = document.getElementById('geost'); if (e) e.textContent = t }
function geoGet() { // лучшее из того, что телефон определит за 10 секунд (раньше — если точность 20 м и лучше)
  return new Promise((res, rej) => { const g = navigator.geolocation; if (!g) return rej({ code: -1 }); let best = null, w = null, t = null;
    const end = e => { if (w != null) g.clearWatch(w); clearTimeout(t); best ? res(best) : rej(e || { code: 3 }) };
    w = g.watchPosition(p => { const c = p.coords, ac = Math.round(c.accuracy); if (!best || ac < best.ac) best = { la: c.latitude, ln: c.longitude, ac }; geoProg('Определяю место… ±' + best.ac + ' м'); if (best.ac <= 20) end() },
      e => { if (e && e.code == 1) end(e) }, { enableHighAccuracy: true, maximumAge: 0, timeout: GEO_MS });
    t = setTimeout(() => end(), GEO_MS) }) }
async function geoSave(x, again) {
  if (geoBusy || !x) return; if (!again && gq(x) && !await ask('Заменить записанное место точки «' + x.n + '»?', 'Заменить')) return;
  geoBusy = true; geoProg('Определяю место…'); let g;
  try { g = await geoGet() } catch (e) { geoBusy = false; geoProg(''); return say(e && e.code == 1 ? 'Нет разрешения на местоположение. Разрешите его для этого сайта в настройках браузера и нажмите ещё раз.' : e && e.code == -1 ? 'Этот телефон или браузер не умеет определять место.' : 'Не удалось определить место. Выйдите на улицу и нажмите ещё раз.') }
  geoBusy = false; geoProg('');
  if (g.ac > 100 && !await ask('Место определилось приблизительно (±' + g.ac + ' м).\nСохранить так или попробовать ещё раз на улице?', 'Сохранить так', 'Попробовать ещё раз')) return geoSave(x, true);
  { const nb = base.filter(b => b !== x && gq(b)).map(b => [b, geoDist(b, g)]).filter(z => z[1] <= Math.max(30, g.ac)).sort((p, q) => p[1] - q[1])[0];   // v35: рядом уже записана другая точка — может, это дубль
    if (nb && !await ask('Рядом (' + Math.round(nb[1]) + ' м) уже записана точка «' + nb[0].n + '»' + (nb[0].a ? ' · ' + nb[0].a : '') + '.\nЭто не один и тот же магазин? Записать место для «' + x.n + '»?', 'Записать', 'Отмена')) return }
  Object.assign(x, g, { gb: me, ga: Date.now() }); LS('base', base);
  if (CFG.API_URL && srvV >= 31 && x.id) { shopq.push({ op: 'geo', id: x.id, n: x.n, c: x.c || '', a: x.a || '', la: g.la, ln: g.ln, ac: g.ac }); LS('shopq', shopq); sync() }
  toast('Место точки записано (±' + g.ac + ' м)'); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }
function geoOffer(x) { // после визита «прямо сейчас»: один раз предложить записать место
  if (!x || gq(x) || geoNo.has(skey(x)) || !navigator.geolocation || !CFG.API_URL || srvV < 31) return;
  ask('Вы сейчас в «' + x.n + '»?\nЗапишите место точки — потом по кнопке «Как проехать» до неё сможете доехать и вы, и коллеги.', 'Записать место', 'Нет').then(y => { if (y) geoSave(x); else { geoNo.add(skey(x)); LS('geono', [...geoNo]) } }) }
async function loadLog(x) {
  const k = x.id || x.n, redraw = () => { if (cKey == k && view == 'shopc') drawFeed(x) };
  if (!CFG.API_URL) { cLog = false; cErr = 'общая база не подключена'; return }
  if (!navigator.onLine) { if (!Array.isArray(cLog)) { cLog = false; cErr = 'нет интернета'; redraw() } return }
  try { const r = await call({ q: 'timeline', sid: x.id || '', name: x.n, limit: 60 });
    if (cKey == k) { cLog = r.events || []; cTot = +r.total || cLog.length; cMine = +r.mine || 0; redraw() } }
  catch (e) { if (cKey == k && !Array.isArray(cLog)) { cLog = false; cErr = e.message || 'ошибка'; redraw() } }
}
const stPh = st => st == 'no' ? 'Причина (обязательно)' : st == 'ref' ? 'Другая причина (необязательно)' : 'Заметка';
const myLast = x => Math.max(cMine || 0, x.lw == me ? x.lv || 0 : 0);   // когда этот профиль последний раз отмечал визит в магазине
/* v34. Сохранения в карточке магазина — по одному правилу: сообщение «… · отправляется» (с «Отменить», где можно) и пометка у раздела: «ждёт отправки» → «сохранено ЧЧ:ММ» после ответа сервера */
const SEC_OP = { note: 'nb', info: 'ct', meta: 'plan', days: 'days', rday: 'rt', owner: 'own', vat: 'vat', status: 'st', geo: 'geo', geodel: 'geo' };   // операция очереди → раздел карточки
let svAt = {};   // когда сервер подтвердил сохранение раздела: { 'ID|раздел': время } (только в памяти)
const secKey = (x, sc) => (x.id || 'n:' + x.n) + '|' + sc;
const secMark = (x, sc) => !CFG.API_URL ? '' : shopq.some(q => SEC_OP[q.op] == sc && (x.id ? q.id == x.id : q.n == x.n)) ? ' · ждёт отправки' : svAt[secKey(x, sc)] ? ' · сохранено ' + hhmm(svAt[secKey(x, sc)]) : '';
function drawMarks(x) { if (!x) return; Object.values(SEC_OP).forEach(sc => { const e = document.getElementById('sv-' + sc); if (e) e.textContent = secMark(x, sc) }) }   // после ответа сервера — без перерисовки карточки (не сбивает ввод)
const cSaved = (t, undo) => toast(t + (CFG.API_URL ? ' · отправляется' : ' на этом устройстве'), undo);
function saveMeta(x) { LS('base', base); if (CFG.API_URL) { shopq.push({ op: 'meta', id: x.id || '', n: x.n, c: x.c, a: x.a, ty: x.ty || '', pl: x.pl || 0, fq: x.fq || '' }); LS('shopq', shopq); sync() } }
function setShopStatus(x, st, nt, at0) { // статус магазина: локально сразу, на сервер через очередь; прежние отметки остаются в журнале. at0 — «действует с» (необязательно)
  const reg = Date.now(), at = at0 || reg, rid = 'r' + reg.toString(36) + Math.random().toString(36).slice(2, 6);
  if (at >= (x.sa || 0)) { x.st = st; x.nt = nt; x.sb = me; x.sa = at } LS('base', base); shopWarn();   // отметка «задним числом» не затирает более новый статус (так же решает сервер)
  if (CFG.API_URL) { shopq.push({ op: 'status', id: x.id || '', n: x.n, c: x.c, a: x.a, st, nt, by: me, at, rid }); LS('shopq', shopq); sync() } }
// --- лента магазина: события с сервера + то, что ещё ждёт отправки (поверх, с пометкой) ---
const tsOf = (d, t) => { if (!d) return 0; const [y, m, dd] = d.split('-').map(Number), [h, mi] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, h || 0, mi || 0).getTime() };
const hhmm = ms => { const d = new Date(ms), z = k => String(k).padStart(2, '0'); return z(d.getHours()) + ':' + z(d.getMinutes()) };
const tsErr = ts => !ts ? 'Укажите дату и время' : ts > Date.now() + 10 * 6e4 ? 'Время визита не может быть в будущем' : ts < Date.now() - 400 * 864e5 ? 'Дата визита слишком старая (больше года назад)' : '';
const FAILR = { future: 'время в будущем', too_old: 'слишком старая дата', invalid: 'данные не прошли проверку на сервере', not_owner: 'это чужая запись', no_owner: 'у записи нет торгового', trader_mismatch: 'запись сделана под другим профилем', cancelled: 'визит уже отменён — сначала восстановите его', act: 'неизвестная операция', ambiguous: 'не удалось однозначно определить магазин' , taken: 'точку уже взял другой торговый', not_found: 'магазин ещё не дошёл до сервера или удалён', unknown_trader: 'такого торгового нет', forbidden: 'нужны права администратора'};
const visitFail = (v, r) => (v.act ? 'Изменение визита' : v.cancel ? 'Отмена визита' : 'Визит «' + (v.val || '') + '»') + ' в «' + (v.shop || '') + '» не принято сервером: ' + (FAILR[r] || r || '—') + '.';
function feed(x) { // null — лента ещё не загружена
  if (!Array.isArray(cLog)) return null;
  const sid = x.id || '', mineQ = q => (q.sid || '') == sid || (!q.sid && !sid && q.shop == x.n) || (!q.sid && q.shop == x.n), ev = cLog.map(e => ({ ...e }));
  visq.forEach(q => { if (q.cancel) return;
    if (!q.act) { if (mineQ(q) && !ev.some(e => e.id == q.id)) ev.push({ k: 'visit', id: q.id, ts: q.ts, reg: q.ts, who: q.trader, val: q.val, nt: q.note || '', state: '', pend: 1, hist: [] }); return }
    const e = ev.find(y => y.id == q.id); if (!e) return; e.pend = 1;
    if (q.act == 'cancel') e.state = 'cancelled'; else if (q.act == 'restore') e.state = ''; else { if (q.ts != null) e.ts = q.ts; if (q.val != null) e.val = q.val; if (q.nt != null) e.nt = q.nt } });
  shopq.forEach(q => { if (q.op == 'status' && mineQ(q) && !ev.some(e => e.id == q.rid)) ev.push({ k: 'status', id: q.rid, ts: q.at, reg: q.at, who: q.by, val: q.st, nt: q.nt || '', state: '', pend: 1 }) });
  outbox.forEach(o => { const h = o.h || {}; if (!o.ed && ((h.sid && h.sid == sid) || (!h.sid && norm(h.s) == norm(x.n))) && !ev.some(e => e.oid == o.id)) ev.push({ k: 'order_create', id: 'oc:' + o.id, oid: o.id, ts: o.ts, reg: o.ts, who: o.trader, val: o.sum, nt: 'на ' + h.d, state: '', pend: 1, cur: null }) });
  return ev.sort((a, b) => b.ts - a.ts || (b.reg || 0) - (a.reg || 0));
}
function recalcLocal(x) { // локальная сводка визитов из ленты (сервер потом пересчитает и подтвердит сам)
  const ev = feed(x); if (!ev) return; const v = ev.filter(e => e.k == 'visit' && !e.state), a = v.slice().sort((p, q) => q.ts - p.ts)[0], full = cTot <= cLog.length;
  if (a) { x.lv = a.ts; x.lb = a.val; x.lw = a.who } else if (full) { x.lv = 0; x.lb = ''; x.lw = '' }
  const mine = v.filter(e => e.who == me).map(e => e.ts); if (mine.length || full) cMine = Math.max(0, ...mine); LS('base', base) }
const sumTiles = x => { const vp = vmOf(x), nm = vatNorm(x), m = vp || (nm && nm.m), t = (l, v, s) => `<div class="stl"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;   // v33: три плитки сводки
  const a2 = ms => ago(ms).replace(' назад', '');   // в плитке коротко: «3 дн.»
  return t('Заявка', x.lo ? a2(x.lo) : 'не было', '') + t('Визит', x.lv ? a2(x.lv) : 'не было', x.lb ? esc(x.lb) + (x.lw && norm(x.lw) != norm(me) ? ', ' + esc(x.lw) : '') : '') + t('Цены', m ? ML[m] : '—', vp ? 'выбрано' : m ? 'по заявке' : '') };
const pendChip = () => `<span class="pnd${syncErr ? ' er' : ''}">${syncErr ? 'Не отправлено' : 'Ожидает отправки'}</span>`;
const EF = [['all', 'Все'], ['order', 'Заказы'], ['visit', 'Визиты'], ['status', 'Статусы']], efOf = k => /^order_/.test(k) ? 'order' : k;
function evHtml(e, x) {
  const my = e.who == me, tm = `${ft(e.ts)} · ${esc(e.who || '—')}${e.reg && Math.abs(e.reg - e.ts) > 10 * 6e4 ? ' · внесено ' + ft(e.reg) : ''}`, ch = e.pend ? ' ' + pendChip() : '', cx = e.state == 'cancelled';
  const dd = t => String(t || '').replace(/(\d{4})-(\d{2})-(\d{2})/, (m, y, mo, d) => +d + '.' + +mo);
  if (e.k == 'visit') {
    if (evEd == e.id) return `<div class="ev"><div class="vdt"><input type="date" id="evd" max="${today()}" value="${isoDay(e.ts)}"><input type="time" id="evt" value="${hhmm(e.ts)}"></div><select id="evr" style="margin-top:8px">${[...new Set([...VO, e.val])].map(t => `<option ${t == e.val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><input id="evn" maxlength="500" placeholder="Комментарий" value="${esc(e.nt || '')}" style="margin-top:8px"><div class="pr2"><button data-a="evsave" data-v="${esc(e.id)}">Сохранить</button><button class="ghost2" data-a="evx">Отмена</button></div></div>`
    const ed = (e.hist || []).filter(h => h.k == 'edit').length;
    return `<div class="ev${cx ? ' cx' : ''}"><div class="m">${tm}${ch}</div><div class="t">Визит: ${esc(e.val)}${e.nt ? ' — ' + esc(e.nt) : ''}</div>${cx ? '<div class="m">Отменён' + (e.by ? ' · ' + esc(e.by) + (e.at ? ', ' + ft(e.at) : '') : '') + '</div>' : ed ? '<div class="m">Исправлялся: ' + ed + ' р.</div>' : ''}${my ? `<div class="evb">${cx ? `<button data-a="evres" data-v="${esc(e.id)}">Восстановить</button>` : `<button data-a="eved" data-v="${esc(e.id)}">Изменить</button><button data-a="evcan" data-v="${esc(e.id)}">Отменить</button>`}</div>` : ''}</div>` }
  if (e.k == 'status') return `<div class="ev"><div class="m">${tm}${ch}</div><div class="t">${e.val ? 'Статус: ' + esc((ST[e.val] || [e.val])[0]) : 'Статус снят (не были)'}${e.nt ? ' — ' + esc(e.nt) : ''}</div></div>`;
  const cur = e.cur, nowS = cur ? (cur.del ? 'сейчас удалена' : '') : '', lab = ({ order_create: 'Заказ создан', order_edit: 'Заказ изменён', order_cancel: 'Заказ удалён', order_restore: 'Заказ восстановлен' }[e.k] || esc(e.k)) + (e.by && e.by != e.who && /cancel|restore/.test(e.k) ? ' (' + esc(e.by) + ')' : ''), can = !!histById(e.oid);
  const pv = e.prev ? ` · было ${tg(e.prev.sum)}, поставка ${esc(dd(e.prev.d))}` : '', mv = e.mv == 'out' ? '<div class="m">Перенесён в другой магазин</div>' : e.mv == 'in' ? '<div class="m">Перенесён из другого магазина</div>' : '';
  return `<div class="ev"><div class="m">${tm}${ch}${e.legacy ? ' · по данным заявки' : ''}</div><div class="t">${lab}${nz(e.val) ? ' · ' + tg(e.val) : ''}${e.nt ? ' · ' + esc(dd(e.nt)) : ''}${pv}</div>${mv}${nowS ? '<div class="m">' + nowS + '</div>' : ''}${can ? `<div class="evb"><button data-a="hd" data-v="${esc(e.oid)}">Открыть заявку</button></div>` : ''}</div>`;
}
function feedHtml(x) {
  const ev = feed(x);
  if (ev === null) return cLog === false ? `<div class="m" style="margin-top:6px">Лента не загрузилась: ${esc(cErr)}.${/не смог связаться/.test(cErr) ? ' Если заявки и магазины при этом работают, значит, скрипт упал именно на этом запросе. Обновите Code.gs до версии ' + NEED + '; точную причину видно в Apps Script → «Выполнения».' : /action|старая версия|не данные/.test(cErr) ? ' Скорее всего, Code.gs не обновлён до версии ' + NEED + ': в Apps Script нужно «Развернуть → Управление развёртываниями → ✏️ → Новая версия».' : ''}</div><button class="ghost" data-a="slog">Повторить</button>` : '<div class="m" style="margin-top:6px">Загружаю…</div>';
  const L = ev.filter(e => evF == 'all' || efOf(e.k) == evF), pend = ev.some(e => e.pend);
  return `<div class="seg ef">${EF.map(([k, t]) => `<button data-a="evf" data-v="${k}" class="${evF == k ? 'on' : ''}">${t}</button>`).join('')}</div>${pend && syncErr ? '<button class="ghost" style="margin:8px 0 0" data-a="sretry">Повторить отправку</button>' : ''}`
    + (L.map(e => evHtml(e, x)).join('') || '<div class="m" style="margin-top:8px">Событий пока нет</div>') + (cTot > cLog.length && evF == 'all' ? `<div class="m" style="margin-top:8px">Показаны последние ${cLog.length} из ${cTot}</div>` : '');
}
function drawFeed(x) { const f = document.getElementById('feed'); if (!f || cSh !== x) return; recalcLocal(x); f.innerHTML = feedHtml(x); const fs = document.getElementById('fsub'); if (fs) fs.textContent = feedSub(x); const m = document.getElementById('sml'); if (m) m.innerHTML = sumTiles(x); const y = document.getElementById('myl'); if (y) y.textContent = myLast(x) ? 'Ваш последний визит сюда: ' + ft(myLast(x)) : 'Вы здесь ещё не отмечались' }
function visOp(x, act, e, extra) { // правка / отмена / восстановление визита по ID события. Возвращает функцию «обратно» для кнопки «Отменить»
  const q = visq.find(y => !y.act && !y.cancel && y.id == e.id && !y.tried); let back;
  if (q && act == 'cancel') { visq = visq.filter(y => y !== q); back = () => { visq.push(q) } }                      // на сервер ещё не уходил — просто убираем
  else if (q && act == 'edit') { const o = { ts: q.ts, val: q.val, note: q.note }; q.ts = extra.ts; q.val = extra.val; q.note = extra.nt; back = () => { Object.assign(q, o) } }
  else { const op = { act, id: e.id, opId: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), by: me, at: Date.now(), shop: x.n, sid: x.id || '', ...extra }; visq.push(op);
    back = () => { const o2 = { restore: 'cancel', cancel: 'restore', edit: 'edit' }[act]; visOp(x, o2, e, act == 'edit' ? { ts: e.ts, val: e.val, nt: e.nt || '' } : {}) } }
  LS('visq', visq); if (CFG.API_URL) sync(); return back;
}
const afterVis = x => { recalcLocal(x); drawFeed(x); const m = document.getElementById('sml'); if (m) m.innerHTML = sumTiles(x) };
const nwBtn = q => { const n = String(q || '').trim().replace(/\s+/g, ' ').slice(0, 120); return n.length < 2 ? '' : `<button class="ghost nwq" data-a="shnq" data-q="${esc(n)}">${ico('plus', 18)} Создать «${esc(n)}»</button>` };   // v36.5: предложение создать точку из того, что вписали в поиск
function shopNew(nm) {
  openSheet('shopn', 'Новый магазин');
  $('#sb').innerHTML = `<p class="m" style="margin:0 2px 12px">Точка сразу появится у всех торговых. Дни маршрута, контакт и место можно задать потом в её карточке.</p>
  <div class="sum frm"><label><b>Название</b><input id="nn" maxlength="120" placeholder="Например: Магнум №3" value="${esc(nm || '')}"></label><label><b>Город</b><select id="nc">${S.cities.map(c => `<option ${c == (shCity || H.c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
  <label><b>Адрес</b><input id="na" maxlength="300" list="stl" autocomplete="off" placeholder="Улица, дом"></label><label><b>Тип точки</b><select id="nty">${tyOpts('')}</select></label><label><b>Юрлицо <span class="m">— необязательно</span></b><input id="nul" maxlength="120" placeholder="ИП или ТОО, как в документах"></label></div>
  <button class="send" data-a="shns">${ico('plus', 22)} Создать точку</button>`;
}

/* v37. Режим выбора точек в маршрутном листе: долгое нажатие на точку → галочки → «Убрать с сегодня (N)». Выход: «Отмена», «назад» телефона, закрытие страницы */
let rAll = [];
function selExit(redraw = true) { if (!selMode && !selSet.size) return; selMode = false; selSet = new Set(); if (redraw && (view == 'shops' || view == 'rplan')) drawShops() }
function selStart(k) { if (view == 'pick') return pkStart(k); if (selMode || rtDay >= 0 || !k || (view != 'shops' && view != 'rplan') || !shopById(k)) return; selMode = true; selSet = new Set([k]); try { navigator.vibrate && navigator.vibrate(15) } catch (_) {} drawShops() }
function selRemove() { const xs = [...selSet].map(shopById).filter(Boolean); if (!xs.length) return selExit(); xs.forEach(x => setToday(x, false)); selExit(false); drawShops();
  toast('Изменено: убрано из листа на сегодня — ' + xs.length + ' ' + pl3(xs.length, 'точка', 'точки', 'точек'), () => { xs.forEach(x => setToday(x, true)); if (view == 'shops') drawShops() }) }
{ let lp = 0, sx = 0, sy = 0; const stop = () => { if (lp) { clearTimeout(lp); lp = 0 } };
  document.addEventListener('pointerdown', e => { stop(); const r = !selMode && !pkMode && e.target && e.target.closest && e.target.closest('.rrow[data-a="rgo"], .shrow[data-a="pkrow"]'); if (!r || e.button > 0) return; sx = e.clientX; sy = e.clientY; const k = r.dataset.v;
    lp = setTimeout(() => { lp = 0; selSup = Infinity; selStart(k) }, 500) }, true);
  document.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop() }, true);
  ['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { stop(); if (selSup === Infinity) selSup = Date.now() + 400 }, true));   // клик, который идёт следом за долгим нажатием, гасим
  document.addEventListener('scroll', stop, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.rrow, .shrow[data-a="pkrow"]')) e.preventDefault() }) }

/* ============ 8. СОБЫТИЯ ============ */
document.addEventListener('click', async e => {   // async: вопросы (ask) ждут ответа в своём окне
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, p = id && find(id), v = b.dataset.v;
  if (selSup && (a == 'rgo' || a == 'rsel' || a == 'pkrow')) { const w = selSup > Date.now(); selSup = 0; if (w) return }   // v37: отпускание после долгого нажатия — не нажатие
  if (a == 'rsel') { if (selSet.has(v)) selSet.delete(v); else selSet.add(v); if (!selSet.size) selMode = false; return drawShops() }
  if (a == 'pkrow') { const x = shopById(v); if (!x || !pk) return; if (pkMode) { if (pkSel.has(v)) pkSel.delete(v); else pkSel.add(v); if (!pkSel.size) pkMode = false; return drawShops() } pkAdd([x]); return drawShops() }   // v37.4
  if (a == 'pkall') { pkSel = pkVis.length && pkVis.every(k => pkSel.has(k)) ? new Set() : new Set([...pkSel, ...pkVis]); if (!pkSel.size) pkMode = false; return drawShops() }
  if (a == 'pkgo') { const xs = [...pkSel].map(shopById).filter(Boolean); pkMode = false; pkSel = new Set(); pkAdd(xs); return drawShops() }
  if (a == 'pkx') return pkExit();
  if (a == 'rselx') return selExit();
  if (a == 'rselrm') return selRemove();
  if (a == 'rselall') { selSet = selSet.size >= rAll.length ? new Set() : new Set(rAll); if (!selSet.size) selMode = false; return drawShops() }   // v37.3: «Выбрать все» / «Снять все»
  if (a == 'dlg') { if (dlgDone) dlgDone(+v); return }
  if (/^(nroute|nmain|nmore|hopen)$/.test(a) && view == 'auth' && needLogin()) return;   // без входа разделы не открываются
  if (a == 'nroute') return goHome(); if (a == 'nmain') { closeSheet(); drawList(); return } if (a == 'nmore') return moreView();
  if (a == 'back') { const f = BACK[view]; if (f) f(); else { closeSheet(); drawList() } return }
  if (a == 'rplan') { rtDay = -1; rtAdd = false; rvK = ''; return planView() }
  if (a == 'shrt') { const on = v == '1'; if (on == cfgShare) return; const r = await admDo({ op: 'cfg', share: on }); if (r) { cfgShare = on; LS('cfgsh', on); toast(on ? 'Маршруты других торговых видны торговым' : 'Маршруты других торговых — только администраторам') } if (view == 'set') setView(); return }   // v35: сразу на сервер (нужна связь)
  if (a == 'shst') { shSt = v == shSt ? '' : v || ''; return drawShops() }   // v35: статус — кнопкой; v36: «Любого» нет — повторное нажатие снимает выбор
  if (a == 'rgall') { rgD = addD(today(), 1); rgTr = ''; return rgView(true) }   // v37.4: «Другой день» открывается на завтра
  if (a == 'rgprev' || a == 'rgnext') { const n = addD(rgD, a == 'rgnext' ? 1 : -1); if (n < (rgAll() ? today() : addD(today(), 1)) || n > addD(today(), PDMAX)) return; rgD = n; return rgView(true) }   // v37.4: от завтра до сегодня + 14
  if (a == 'pdt') { shMode = 'route'; return shopsView() }   // v37.4: переключатель «Сегодня»
  if (a == 'pdtr') { rgTr = v || ''; return rgView(true) }   // v37.4: чей маршрут
  if (a == 'rgretry') { delete rgC[rgD]; return rgView() }
  if (a == 'rgopen') return pickView(b.dataset.t || me, rgD, 'day')   // v37.4: общий экран выбора магазинов
  if (a == 'rgrm' || a == 'rgadd') { const x = byId(v), tr = b.dataset.t || '', d = rgD; if (!x || !tr || d < today() || (role != 'admin' && (!me || norm(tr) != norm(me)))) return; const on = a == 'rgadd'; rdSet(x, tr, d, on); rgView();   // v35: администратор ставит маршрут торговому
    return cSaved((on ? 'Добавлена' : 'Убрана') + ': «' + x.n + '» · ' + tr + ', ' + fd(d), () => { rdSet(x, tr, d, !on); if (view == 'rall') rgView() }) }
  if (a == 'cvis') { cVO = !cVO; return shopCard(skey(cSh)) }
  if (a == 'cat') { cat = v; drawChips(); drawList() }
  else if (a == 'fav') { fav = isFav(p) ? fav.filter(k => k != id) : [...fav, id]; LS('fav', fav); drawChips(); if (cat == FAV) drawList(); else b.classList.toggle('on', isFav(p)) }
  else if (a == 'm') setQ(p, qty(p) - step(p)); else if (a == 'p') setQ(p, qty(p) + step(p));
  else if (a == 'rm') { const prev = cart[id]; delete cart[id]; save(); bar(); cartView(); drawList(); toast('Изменено: «' + (p ? p.n : 'товар') + '» убран', () => { cart[id] = prev; save(); bar(); drawList(); if (view == 'cart') cartView() }) }
  else if (a == 'splr') { prodP = load(); splash() }   // загрузочный экран: «Повторить» при первом запуске без интернета
  else if (a == 'undo') { const f = toastFn; toastFn = null; toastM = ''; $('#toast').className = ''; if (f) f() }
  else if (a == 'mode') setMode(v); else if (a == 'cart') cartView(); else if (a == 'hist') histView(); else if (a == 'set') setView();
  else if (a == 'x') { if (e.target == b || b.classList.contains('grab')) { closeSheet(); drawList() } }
  else if (a == 'zoom') { const im = $('#lb img'); if (im) { im.dataset.f = ''; im.dataset.o = b.dataset.o || ''; im.onerror = () => imgFb(im); im.src = b.dataset.src } $('#lb').classList.add('on') }
  else if (a == 'lbx') $('#lb').classList.remove('on');
  else if (a == 'edit') { editId = id; cartView() }
  else if (a == 'pdone') { if (Date.now() - npAt < 800) return; const t = document.querySelector('[data-np]'); if (t && editId) commitNp(t); else { editId = ''; cartView() } }   // v34: уже сохранено по касанию «Готово» (pointerdown) — второй раз не перерисовываем
  else if (a == 'reset') { delete cart[id].p; save(); bar(); cartView() }
  else if (a == 'disc') { disc = +v; save(); bar(); cartView() }
  else if (a == 'new') { const z = snap(); cart = {}; disc = 0; eo = ''; H.t = 0; save(); closeSheet(); drawList(); toast('Изменено: заявка очищена', () => unsnap(z)) }
  else if (a == 'send' || a == 'esave') {                  // правка заявки сохраняется сразу, в WhatsApp не отправляется
    if (CFG.API_URL && (!me || !tok)) { authView('login'); return say('Сначала войдите в свой профиль: заявка записывается от вашего имени.') }
    if (a == 'esave' && !eo) return;
    if (!H.s || !lines().length) return say('Укажите магазин и добавьте товары');
    if (!H.d) { H.dm = 0; fixDate(); fill() }
    { const ot = H.t > 0 && H.t <= Date.now() ? H.t : eo ? nz((histById(eo) || {}).ts) || Date.now() : Date.now(), od = locIso(ot);   // v34: поставка — не раньше дня заявки; в прошлом — только с подтверждением
      if (!eo && !(H.t > 0) && H.d < od) { const y = await ask('Дата поставки ' + fd(H.d) + ' уже прошла, а время заявки — «сейчас».\nЕсли заявку приняли раньше — укажите «Время заявки», и эту дату поставки можно оставить.', 'Указать время заявки', 'Поставить ближайшую пятницу');
        if (y) tOpen = true; else { H.dm = 0; fixDate(); save(); fill() } return cartView() }
      if (H.d < od) return say('Дата поставки (' + fd(H.d) + ') раньше дня заявки (' + fd(od) + '). Исправьте дату поставки или «Время заявки».') }
    if (disc > DASK && !await ask('Скидка ' + disc + '% — больше обычной. Всё верно?', 'Да, ' + disc + '%')) return;   // v36.3: защита от опечатки (50 вместо 5)
    const sh = curShop(); if (sh && sh.st == 'no' && !await ask('⚠ Магазин помечен «Не заходить»' + (sh.nt ? ': ' + sh.nt : '') + '.\nВсё равно отправить заявку?', 'Отправить')) return;
    { const nm = vatNorm(sh, eo), vd = !!nm && nm.m != S.mode, vs = !!msw && msw != S.mode;   // v30: режим цен не совпадает с нормой точки или его переключали во время заявки — один вопрос
      if (vd || vs) { const o = otherM(S.mode), r = await askVat(vatMsg(sh, nm, vd, vs), (a == 'esave' ? 'Сохранить ' : 'Отправить ') + ML[S.mode], 'Переключить на ' + ML[o]);
        if (r == 'switch') { await setMode(o, 1); cartView(); const sv = document.getElementById('sheet'); if (sv) sv.scrollTop = 0; return }   // после переключения — наверх, к режиму цен и новым ценам
        if (r != 'send') return } }
    let old = eo && histById(eo);
    if (eo && (!old || old.del || !canEdit(old))) { eo = ''; save(); say('Срок правки истёк (' + CFG.EDIT_HOURS + ' ч) или заявка удалена — это будет новая заявка. Нажмите «Отправить» ещё раз.'); return cartView() }
    const dup = !eo && allHist().find(x => !x.del && isMine(x) && norm(x.h.s || '') == norm(H.s) && x.sum == final() && Date.now() - (x.ts || 0) < 10 * 6e4);   // защита от двойной отправки
    if (dup && !await ask('Похожая заявка («' + H.s + '», ' + tg(final()) + ') уже создана ' + Math.max(1, Math.round((Date.now() - dup.ts) / 6e4)) + ' мин назад.\nОтправить ещё раз?', 'Отправить ещё раз')) return;
    const rc = rcPick(), num2 = String(rc.p || S.op || '').replace(/\D/g, ''); if (!num2 && !eo) return say('Не указан номер получателя: заполните лист «Получатели» или номер в настройках');
    const tx = text();
    const o = { id: eo || Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: H.t > 0 && H.t <= Date.now() ? H.t : eo ? old.ts : Date.now(), trader: eo ? old.trader || me : me, h: { d: H.d, c: H.c, s: H.s, a: H.a, sid: H.sid || '' }, cart: JSON.parse(JSON.stringify(cart)), disc, sum: final(), m: S.mode, rc: eo && old.rc && old.rc.p ? old.rc : { n: rc.n, p: num2 }, text: tx, items: lines().map(p => ({ n: p.n, g: p.g, u: p.u, q: qty(p), p: price(p), o: p.pr })) };
    if (eo) { o.ed = Date.now(); if (old.rg) o.rg = old.rg; if (eob != null) o.bed = eob } else o.rg = Date.now();
    { const as = asSel(old); if (as && norm(as) != norm(eo ? old.trader || '' : me)) o.as = as }   // v36: администратор — «от имени» торгового (сервер проверяет права и имя)   // rg — когда заявка записана: от него считается срок правки (сервер это поле не принимает и считает сам)
    if (eo) { commitOrder(o); return toast('Изменение сохранено') }
    LS('pending', o); waOpen(num2, o.text); }
  else if (a == 'eoc') { const z = snap(); eo = ''; H.as = ''; asOpen = false; cart = {}; disc = 0; clrShop(); save(); fill(); closeSheet(); drawList(); toast('Правка отменена, заявка осталась как была', () => unsnap(z)) }
  else if (a == 'hedit') { const x = histById(v); if (!x || !canEdit(x)) return say('Изменить можно свою заявку в течение ' + CFG.EDIT_HOURS + ' ч после создания. Более старые и чужие заявки правит администратор.');
    if (lines().length) { if (!await stashAsk('правку')) return; if (!eo) stash() }
    if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = JSON.parse(JSON.stringify(x.cart || {})); disc = x.disc || 0; H = { ...x.h, dm: 1, r: x.rc && x.rc.n || '', t: nz(x.ts), as: trOf(x) || '' }; setUndo(null); eo = x.id; msw = ''; { const pe = outbox.find(y => y.id == x.id); eob = pe ? (typeof pe.bed == 'number' ? pe.bed : null) : nz(x.ed) } save(); fill(); closeSheet(); drawList(); cartView() }   // v34: eob — версия, с которой начата правка (у неотправленной правки — её исходная); сервер откажет, если заявку тем временем изменили
  else if (a == 'clr') { const z = snap(); cart = {}; disc = 0; eo = ''; save(); bar(); drawList(); toast('Изменено: корзина очищена', () => unsnap(z)) }
  else if (a == 'hd') histDetail(v);
  else if (a == 'htab') { histTab = v; LS('htab', v); histView() }
  else if (a == 'hdel') { const x = histById(v); if (x && canDel(x) && await ask('Удалить заявку «' + (x.h.s || '—') + '» на ' + tg(x.sum) + (isMine(x) ? '' : ' (торговый ' + x.trader + ')') + '?\nЕё можно будет вернуть в течение ' + CFG.UNDO_HOURS + ' ч.', 'Удалить', '', true)) { delOrder(v, Date.now()); histView(); visitAfterDel(x) } }
  else if (a == 'hres') { delOrder(v, 0); histView() }
  else if (a == 'hcopy') { try { navigator.clipboard.writeText(histById(v).text || '').then(() => say('Текст скопирован')) } catch (e) { say('Не удалось скопировать') } }
  else if (a == 'hopen') { histDay = 0; histView() }
  else if (a == 'dprev') { histDay = pShift(hP, histDay || Date.now(), -1); histView() }
  else if (a == 'dnext') { histDay = Math.min(pShift(hP, histDay || Date.now(), 1), pRange(hP, Date.now())[0]); histView() }
  else if (a == 'dtoday') { histDay = 0; histView() }
  else if (a == 'hp') { if (HP.some(x => x[0] == v)) { const cur = !histDay || histDay == pRange(hP, Date.now())[0]; hP = v; LS('hp', v); histDay = cur ? 0 : pRange(v, histDay)[0]; histView() } }   // был текущий период — остаёмся в текущем (неделя → сегодня), иначе — период с той же даты   // v35: период истории
  else if (a == 'hpm') { hP = 'm'; LS('hp', 'm'); histDay = +v; histView() }   // год → месяц
  else if (a == 'dretry') { dayErr = 0; histView() }
  else if (a == 'inst') { if (instEv) { instEv.prompt(); instEv.userChoice.finally(() => { instEv = null; hideInst() }) } else say('Android (Chrome): меню ⋮ → «Установить приложение» или «Добавить на главный экран».\niPhone (Safari): «Поделиться» → «На экран Домой».') }
  else if (a == 'instx') { LS('instx', 1); hideInst() }
  else if (a == 'csv') exportCsv();
  else if (a == 'sedit') { cKey = ''; shopCard(ddL[+v].id || 'n:' + ddL[+v].n); $('#sl').hidden = true }
  else if (a == 'shops') shopsView(); else if (a == 'shm') { shMode = v; shopsView() }
  else if (a == 'scard') { cKey = ''; shopCard(v) } else if (a == 'sedit2') shopEditView(cSh)
  else if (a == 'dgtg') { LS('diag', true); diagLoad(() => window.DIAG && DIAG.open()) }   // v36.5: временная диагностика (diag.js)
  else if (a == 'shn') shopNew()
  else if (a == 'shnq') shopNew(b.dataset.q || '')
  else if (a == 'rday') { if (+v == -2) { rtDay = 7; rtAdd = false; return drawShops() } rtDay = +v; rvK = ''; rtAdd = false; if (rtDay >= 0) planView(); else shopsView() }
  else if (a == 'radd') { if (rtDay < 0) pickView(me, today(), 'today'); else { rtAdd = !rtAdd; drawShops() } }   // v37.4: на сегодня — общий экран выбора
  else if (a == 'rvis') { rvK = rvK == v ? '' : v; if (rtDay < 0) setGo(v); drawShops() }   // v33: отметка визита из ленты — это и есть «еду сюда»
  else if (a == 'rgo') { setGo(v); rvK = ''; rtAdd = false; drawShops(); const sh = document.getElementById('sheet'); if (sh) sh.scrollTop = 0 }   // v33: «Еду сюда»
  else if (a == 'shf') { shF = v == shF ? 'all' : v; drawShops() }   // v33: вкладки «Все магазины»; v36: повторное нажатие — обратно к «Все»
  else if (a == 'rgox') { setGo(''); rvK = ''; drawShops() }
  else if (a == 'syn') { CFG.API_URL && !tok ? authView() : sync() }
  else if (a == 'rres') { const x = shopById(rvK), nt = $('#rvn').value.trim(), val = VO[+v]; if (!x || !val) return; if (val == 'Другое' && !nt) return say('Для результата «Другое» напишите комментарий'); rvK = ''; const rec = await visitSwitch(x, val, nt); if (rec && rtDay < 0 && DEFER.includes(val)) setGo(skey(x), true); if (view == 'shops' || view == 'rplan') drawShops() }   // отложили — точка уходит вниз, снова «Куда дальше?»
  else if (a == 'rord') orderAt(shopById(v))
  else if (a == 'rrm') { const x = shopById(v); if (!x) return; setToday(x, false); drawShops(); toast('Изменено: «' + x.n + '» убран из листа на сегодня', () => { setToday(x, true); if (view == 'shops') drawShops() }) }   // убрать из листа на сегодня (v30: кнопка «Не зайду» у отложенной точки; план остаётся — завтра точка в подсказках)
  else if (a == 'rwrm') { const x = shopById(v), i = rtDay; if (!x || i < 0) return; if (!canDays(x)) return daysDeny(x); setWeek(x, i, false); drawShops(); toast('Изменено: «' + x.n + '» убран из маршрута (' + WDF[i] + ')', () => { setWeek(x, i, true); if (view == 'shops') drawShops() }) }
  else if (a == 'rpick') { const x = shopById(v); if (!x) return; if (rtDay >= 0 && !canDays(x)) return daysDeny(x); if (rtDay < 0) setToday(x, true); else setWeek(x, rtDay, true); drawShops() }
  else if (a == 'rwd') { const x = cSh; if (!x) return; if (!canDays(x)) return daysDeny(x); const i = +v, was = inWeek(x, i); setWeek(x, i, !was); shopCard(skey(x));
    cSaved('Дни маршрута: ' + (WD.filter((d, k) => inWeek(x, k)).join(', ') || 'не заданы'), () => { setWeek(x, i, was); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }) }
  else if (a == 'own') { const x = cSh; if (!x || !x.id || !CFG.API_URL || srvV < 31) return; const act = v == 'take' || v == 'release' || v == 'set' ? v : '', nm = act == 'set' ? String(b.dataset.n || '') : ''; if (!act) return;   // v31: ответственный
    if (act == 'set' && !await ask('Передать точку «' + x.n + '» торговому «' + nm + '»?', 'Передать')) return;
    if (act == 'release' && x.ow && norm(x.ow) != norm(me) && !await ask('Освободить точку «' + x.n + '»? Сейчас она закреплена за «' + x.ow + '».', 'Освободить')) return;
    const prev = x.ow || ''; x.ow = act == 'take' ? me : act == 'release' ? '' : nm; LS('base', base);
    shopq.push({ op: 'owner', id: x.id, n: x.n, c: x.c || '', a: x.a || '', act, name: nm, rid: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); LS('shopq', shopq); sync(); shopCard(skey(x));
    toast(act == 'take' ? 'Точка закреплена за вами' : act == 'release' ? 'Точка свободна' : 'Точка передана: ' + nm); void prev }
  else if (a == 'geo') geoSave(cSh)
  else if (a == 'geodel') geoDel(cSh)
  else if (a == 'promo') promoView()
  else if (a == 'prm') { if (prBusy || role != 'admin' || !id) return; prBusy = true;
    try { const r = await call({ admin: { op: 'promo', key: id, on: v == '1' } }); if (r && Array.isArray(r.promo)) { promoL = r.promo.map(String); LS('promo', promoL); applyFlags(); drawChips(); toast(v == '1' ? 'Товар продвигается' : 'Отметка снята') } else say('Не сохранилось: ' + (FAILR[r && r.reason] || (r && r.reason) || 'ошибка')) }
    catch (e) { say(e && e.auth ? 'Нужно войти заново.' : 'Нет связи: отметка не сохранена. Попробуйте ещё раз.') } finally { prBusy = false }
    if (view == 'promo') $('#prl').innerHTML = promoList() }
  else if (a == 'rsn') { const e = $('#stn'); e.value = v || ''; document.querySelectorAll('.rsn button').forEach(q => q.classList.toggle('on', q.dataset.v == (v || ''))) }   // v31: причина «Отказались» одним нажатием
  else if (a == 'rtdy') { if (!v) return; cRt.d = v; shopCard(skey(cSh)) }
  else if (a == 'rttr') { if (role != 'admin') return; cRt.tr = v || me; shopCard(skey(cSh)) }
  else if (a == 'rtgo') { const x = cSh; if (!x) return; const tr = cRt.tr || me, d = cRt.d || today(); if (role != 'admin' && norm(tr) != norm(me)) return; const on = !inDay(x, tr, d); if (!x.id && !(norm(tr) == norm(me) && d == today())) return;
    const put = v2 => { if (norm(tr) == norm(me) && d == today()) setToday(x, v2); else rdSet(x, tr, d, v2) }, where = (norm(tr) == norm(me) ? '' : tr + ', ') + (d == today() ? 'сегодня' : fdl(d)); put(on); shopCard(skey(x));
    cSaved((on ? 'Добавлена: «' : 'Убрана: «') + x.n + '» · ' + where, () => { put(!on); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }) }
  else if (a == 'shns') { const n = $('#nn').value.trim().replace(/\s+/g, ' '), c = $('#nc').value, ad = $('#na').value.trim(), ty = $('#nty').value; if (!n) return;
    { const r = await dupAsk(n, c, ad); if (!r) return; if (r !== 'new') { cKey = ''; return shopCard(skey(r)) } }   // v35: одноимённый — «это он?», новый — только с адресом
    const ul = String($('#nul').value || '').trim().slice(0, 120), o = upShop(n, c, ad, newSid()); o.ty = ty; if (ul) o.ul = ul; LS('base', base);
    if (CFG.API_URL) { shopq.push({ n, c, a: ad, id: o.id, ty }); if (ul) shopq.push({ op: 'info', id: o.id, n, c, a: ad, ct: '', tl: '', rg: '', ul }); LS('shopq', shopq); sync() } cKey = ''; shopCard(o.id) }   // v33: юрлицо — отдельной операцией после создания
  else if (a == 'sord') orderAt(cSh)
  else if (a == 'sst') { cSt = v; document.querySelectorAll('.sg button').forEach(e => e.classList.toggle('on', e.dataset.v == v)); $('#stw').hidden = v == '-'; $('#stn').placeholder = stPh(v); document.querySelectorAll('.rsn').forEach(e => { e.hidden = v != 'ref' }) }
  else if (a == 'sstsave') { const x = cSh, none = cSt == '-', st = none ? '' : cSt, nt = none ? '' : $('#stn').value.trim(); if (!cSt) return say('Выберите статус');
    if (st == 'no' && !nt) return say('Для статуса «Не заходить» укажите причину в заметке');
    const sef = $('#sef').value, at = !sef || sef == today() ? 0 : tsOf(sef, '12:00'); if (at > Date.now()) return say('Дата «действует с» не может быть в будущем');
    const prev = { st: x.st || '', nt: x.nt || '' }, old = at && at < (x.sa || 0); setShopStatus(x, st, nt, at);
    toast(old ? 'Записано в историю с датой ' + fd(isoDay(at)) + '; текущий статус новее и не изменён' : 'Статус ' + (st ? '«' + ST[st][0] + '» сохранён' : 'снят') + (CFG.API_URL ? ' · отправляется' : ''), old ? undefined : () => { setShopStatus(x, prev.st, prev.nt); if (view == 'shopc' && cKey == (x.id || x.n)) { cSt = prev.st || '-'; shopCard(x.id || 'n:' + x.n) } });
    shopCard(x.id || 'n:' + x.n) }
  else if (a == 'snb' || a == 'snbc') { const x = cSh; if (!x || !x.id) return; const pv = x.nb || '', nb = a == 'snbc' ? '' : String($('#inb').value || '').trim().slice(0, 2000); if (nb == pv) return toast('Заметка не изменилась');   // v35: заметки о точке — колонка AB; v36: «Очистить» — с вопросом и «Отменить»
    if (a == 'snbc' && !await ask('Очистить заметку о «' + x.n + '»? Её увидят пустой все торговые.', 'Очистить', '', true)) return;
    const put = v => { x.nb = v; LS('base', base); shopq.push({ op: 'note', id: x.id, n: x.n, c: x.c || '', a: x.a || '', nb: v }); LS('shopq', shopq); sync() };
    put(nb); shopCard(skey(x)); cSaved(nb ? 'Заметка сохранена' : 'Заметка очищена', () => { put(pv); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }) }
  else if (a == 'sinfo') { const x = cSh, pv = { ct: x.ct || '', tl: x.tl || '', rg: x.rg || '', ul: x.ul || '' }, put = () => { if (CFG.API_URL) { shopq.push({ op: 'info', id: x.id || '', n: x.n, c: x.c, a: x.a, ct: x.ct, tl: x.tl, rg: x.rg, ul: x.ul }); LS('shopq', shopq); sync() } }; x.ct = $('#ict').value.trim(); x.tl = $('#itl').value.trim(); x.rg = $('#irg').value.trim(); x.ul = String($('#iul').value || '').trim().slice(0, 120); LS('base', base);
    if (['ct', 'tl', 'rg', 'ul'].every(k => (x[k] || '') == pv[k])) return toast('Контакт не изменился');
    put(); shopCard(x.id || 'n:' + x.n); cSaved('Контакт, район и юрлицо сохранены', () => { Object.assign(x, pv); LS('base', base); put(); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }) }
  else if (a == 'vis') { cVO = false; const x = cSh, nt = $('#vn').value.trim(), val = VO[+v], vt = $('#vt'), fresh = $('#vd').value == today() && vt.value == vt.dataset.t0, ts = fresh ? Date.now() : tsOf($('#vd').value, vt.value), my = myLast(x);   // время не трогали — берём момент нажатия
    const er = tsErr(ts); if (er) return say(er); if (val == 'Другое' && !nt) return say('Для результата «Другое» напишите комментарий');
    if (fresh && CFG.API_URL && (myToday(x) || (val == VO[0] && srvAuto()))) { await visitSwitch(x, val, nt); if (view == 'shopc') shopCard(x.id || 'n:' + x.n); return }   // v37: «Взяли заказ» — через заявку (визит сервер запишет сам); сегодня визит уже есть — заменить, отменить или добавить по правилам маршрута
    if (my && dayMs(my) == dayMs(ts) && !await ask('Вы уже отмечали визит в этот магазин в этот день (' + new Date(my).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) + ').\nОтметить ещё раз?', 'Отметить ещё раз')) return;
    const vid = 'v' + ts.toString(36) + Math.random().toString(36).slice(2, 6), pl0 = x.pl, pv0 = { lv: x.lv, lb: x.lb, lw: x.lw, m: cMine }; if (x.pl && x.pl <= ts) x.pl = 0;
    if (CFG.API_URL) { visq.push({ id: vid, shop: x.n, sid: x.id || '', c: x.c, a: x.a, trader: me, ts, val, note: nt }); LS('visq', visq); if (Array.isArray(cLog)) recalcLocal(x); else if (ts >= (x.lv || 0)) { x.lv = ts; x.lb = val; x.lw = me; cMine = Math.max(cMine, ts) } sync() }
    else { x.lv = ts; x.lb = val; x.lw = me; cMine = ts }
    const pc = planAfter(x, val, ts); LS('base', base); if (fresh) setTimeout(() => geoOffer(x), 0);   // v31: визит «прямо сейчас» — предложить записать место точки
    toast('Визит «' + val + '» ' + (CFG.API_URL ? 'записан · ожидает отправки' : 'записан на этом устройстве'), () => { const e = { id: vid, ts, val, nt }; visOp(x, 'cancel', e, {}); x.pl = pl0; if (pc) saveMeta(x); if (!Array.isArray(cLog)) { Object.assign(x, { lv: pv0.lv, lb: pv0.lb, lw: pv0.lw }); cMine = pv0.m } LS('base', base); if (view == 'shopc' && cKey == (x.id || x.n)) { afterVis(x); shopCard(x.id || 'n:' + x.n) } });   // «Отменить» — настоящая операция по ID визита
    shopCard(x.id || 'n:' + x.n) }
  else if (a == 'evf') { evF = v; drawFeed(cSh) }
  else if (a == 'sretry') sync()
  else if (a == 'eved') { evEd = v; drawFeed(cSh) } else if (a == 'evx') { evEd = ''; drawFeed(cSh) }
  else if (a == 'evsave') { const x = cSh, e = feed(x).find(y => y.id == v); if (!e) return; const ts = tsOf($('#evd').value, $('#evt').value), val = $('#evr').value, nt = $('#evn').value.trim(), er = tsErr(ts);
    if (er) return say(er); if (val == 'Другое' && !nt) return say('Для результата «Другое» напишите комментарий');
    if (ts == e.ts && val == e.val && nt == (e.nt || '')) { evEd = ''; return drawFeed(x) }
    const back = visOp(x, 'edit', e, { ts, val, nt }); evEd = ''; afterVis(x); toast('Визит изменён · ожидает отправки', () => { back(); afterVis(x) }) }
  else if (a == 'evcan' || a == 'evres') { const x = cSh, e = feed(x).find(y => y.id == v); if (!e) return; const act = a == 'evcan' ? 'cancel' : 'restore', back = visOp(x, act, e, {}); afterVis(x);
    toast(act == 'cancel' ? 'Визит отменён (запись сохраняется, можно восстановить) · ожидает отправки' : 'Визит восстановлен · ожидает отправки', () => { back(); afterVis(x) }) }
  else if (a == 'plan' || a == 'planx' || a == 'fqs' || a == 'fqx') { const x = cSh, pv = { pl: x.pl || 0, fq: x.fq || '' };
    if (a == 'plan') { const v2 = $('#pld').value; if (!v2 || v2 < today()) return say('Выберите сегодняшнюю или будущую дату'); const [y, m, d] = v2.split('-').map(Number); x.pl = new Date(y, m - 1, d).getTime() }
    else if (a == 'planx') x.pl = 0; else if (a == 'fqs') x.fq = $('#fqi').value.trim(); else x.fq = '';
    if ((x.pl || 0) == pv.pl && (x.fq || '') == pv.fq) return toast('Без изменений');
    saveMeta(x); shopCard(x.id || 'n:' + x.n); cSaved({ plan: 'Визит по плану на ' + fd(isoDay(x.pl || Date.now())) + ' сохранён', planx: 'План визита убран', fqs: 'Вопрос сохранён', fqx: 'Вопрос отмечен решённым' }[a], () => { Object.assign(x, pv); saveMeta(x); if (view == 'shopc' && cSh === x) shopCard(skey(x)) }) }
  else if (a == 'slog') { cLog = null; cErr = ''; shopCard(cSh.id || 'n:' + cSh.n); loadLog(cSh) }
  else if (a == 'ssave') { const n = $('#en').value.trim().replace(/\s+/g, ' '), c = $('#ec').value, ad = $('#ea').value.trim(), ty = $('#ety').value; if (!n) return;
    { const m = sameName(n, c, eSh); if (m.length && (!ad || m.some(b => norm(b.a) == norm(ad)))) return say(ad ? '«' + n + '» по этому адресу в этом городе уже есть' : 'В этом городе уже есть «' + n + '» — укажите адрес, чтобы их различать') }   // v35: одноимённые — только с разными адресами
    const old = eSh.n; eSh.n = n; eSh.c = c; eSh.a = ad; eSh.ty = ty; LS('base', base);
    if (curShop() === eSh || (H.sid && H.sid == eSh.id)) { H.s = n; H.a = ad; H.c = c; cities(); $('#s').value = n; $('#a').value = ad; save() }
    if (CFG.API_URL) { shopq.push({ op: 'edit', id: eSh.id || '', old, n, c, a: ad, ty }); LS('shopq', shopq); sync() } cKey = ''; shopCard(eSh.id || 'n:' + n); cSaved('Название, адрес и тип сохранены') }
  else if (a == 'sdel') { if (!await ask('Удалить магазин «' + eSh.n + '» из общей базы? Старые заявки и журнал сохранятся.', 'Удалить', '', true)) return;
    const x = eSh; base = base.filter(b => b !== x); LS('base', base);
    if (H.sid && H.sid == x.id || norm(H.s) == norm(x.n)) { clrShop(); $('#s').value = ''; $('#a').value = ''; save(); shopWarn() }
    if (CFG.API_URL) { shopq.push({ op: 'del', id: x.id || '', old: x.n }); LS('shopq', shopq); sync() } cSh = null; cKey = ''; shopsView() }
  else if (a == 'pick') { selShop(ddL[v]); $('#sl').hidden = true }
  else if (a == 'hfch' || a == 'ochg') { if (view) { closeSheet(); drawList() } hfC = false; drawHf(); if (typeof scrollTo == 'function') scrollTo(0, 0); const s = document.getElementById('s'); if (s && s.focus) try { s.focus() } catch (_) {} }   // v33: «Сменить» — на главном экране и в оформлении
  else if (a == 'hfund') shopBack()
  else if (a == 'asop') { asOpen = true; cartView() }
  else if (a == 'hfok') { hfC = true; $('#sl').hidden = true; drawHf() }
  else if (a == 'padd') { const n = $('#s').value.trim().replace(/\s+/g, ' '); if (!n) return; H.a = ($('#a').value || '').trim(); const r = await dupAsk(n, H.c, H.a); if (!r) return; $('#sl').hidden = true; if (r !== 'new') return selShop(r);   // v35: «Продукты» уже есть — спрашиваем
    H.s = n; $('#s').value = n; addShop(n); save(); shopWarn() }
  else if (a == 'pyes') { const o = LS('pending'); localStorage.removeItem('pending'); if (!o) return; commitOrder(o); goHome() }   // заявка ушла — обратно к маршруту, к следующей точке
  else if (a == 'pno') { localStorage.removeItem('pending'); closeSheet() }
  else if (a == 'drafts') draftView(); else if (a == 'dsave') draftSave();
  else if (a == 'dopen') { const st = lines().length; if (st && !await stashAsk('черновик')) return;
    const x = drafts.splice(v, 1)[0]; LS('drafts', drafts); if (st && !eo) stash(); if (x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = cleanCart(x.cart); disc = Math.min(100, Math.max(0, nz(x.disc))); eo = ''; msw = ''; H = { ...x.H }; setUndo(null); save(); fill(); closeSheet(); drawList(); bar(); draftBadge() }
  else if (a == 'ddel') { drafts.splice(v, 1); LS('drafts', drafts); draftBadge(); draftView() }
  else if (a == 'auth') authView('login'); else if (a == 'amode') authView(v == 'invite' ? 'invite' : 'login'); else if (a == 'lgn' || a == 'rdm') doAuth()
  else if (a == 'pwsee') { const show = $('#aup').type == 'password'; ['#aup', '#aup2'].forEach(q => { const el = $(q); if (el) el.type = show ? 'text' : 'password' }); b.innerHTML = ico(show ? 'eyeoff' : 'eye', 22); if (b.setAttribute) b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль') }
  else if (a == 'out') { const n = qN(); if (LS('pending')) return say('Сначала ответьте, отправлена ли последняя заявка: она записана от имени «' + me + '».'); if (n) return say('Выйти пока нельзя: ждут отправки ' + n + ' операц. Они записаны от имени «' + me + '», и под другим профилем сервер их не примет.\nПодключитесь к интернету и подождите: когда всё уйдёт, в «Служебной информации» будет «Ждут отправки: 0», и выйти можно.');
    if (await ask('Выйти из профиля «' + me + '»? Черновики и корзина останутся на устройстве.', 'Выйти')) logout() }
  else if (a == 'adm') { admOw = null; admView(true) }
  else if (a == 'ainv') { if (!await ask('Выдать приглашение для «' + v + '»?' + (b.dataset.s == 'active' ? '\nНынешний пароль этого профиля и все его входы перестанут действовать.' : ''))) return;
    admDo({ op: 'invite', profile: v }).then(r => { if (r) admCode = { profile: String(r.profile), code: String(r.code), until: r.until }; if (view == 'adm') { admView(true).then(() => { document.getElementById('sheet').scrollTop = 0 }) } }) }
  else if (a == 'arev') { if (await ask('Отозвать доступ у «' + v + '»? Войти он не сможет, пока вы не выдадите новое приглашение.', 'Отозвать', '', true)) admDo({ op: 'revoke', profile: v }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'arole') { const r = b.dataset.r == 'admin' ? 'admin' : 'trader'; if (await ask((r == 'admin' ? 'Сделать администратором' : 'Сделать торговым') + ' профиль «' + v + '»? Ему придётся войти заново.')) admDo({ op: 'role', profile: v, role: r }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'aadd') { const n = $('#adn').value.trim().replace(/\s+/g, ' '); if (!n) return; admDo({ op: 'add', name: n }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'adel') { if (await ask('Удалить профиль «' + v + '»?\nВойти под ним больше будет нельзя. Его заявки останутся в таблице под этим именем.', 'Удалить', '', true)) admDo({ op: 'delete', profile: v }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'afix') { if (admBusy) return; admBusy = true; if (view == 'adm') admView(false); (async () => { let r = null, w = null;   // одна проверка: связи с магазинами, сводки и заявки без торгового. v36: пока идёт — «Проверяю…», повторное нажатие не запускает вторую
    try { r = await admDo({ op: 'recDry' }); w = r && await admDo({ op: 'ownersDry' }) } finally { admBusy = false }
    if (r) admRec = { apply: false, changes: r.changes, counts: r.counts }; if (w) admOw = w; if (view == 'adm') admView(false); if (r && w) toast('Проверка закончена: ' + (nz(r.changes) ? 'можно исправить записей — ' + nz(r.changes) : 'исправлять нечего') + (nz(w.count) ? ' · заявок без торгового — ' + nz(w.count) : '')) })() }
  else if (a == 'arecapply') { if (!await ask('Исправить данные?\nИзменятся листы «Заявки», «Визиты» и «Магазины». Записи, с которыми не всё однозначно, останутся как есть. Отчёт — на листе «Сверка».')) return;
    admDo({ op: 'recApply', confirm: true }).then(r => { if (r) admRec = { apply: true, changes: r.changes, counts: r.counts }; if (view == 'adm') admView(false); if (r) sync() }) }
  else if (a == 'aoapply') { const w = admOw, own = $('#aow').value; if (!w || !nz(w.count)) return; if (!own) return say('Выберите торгового'); if (!$('#aoc').checked) return say('Отметьте, что вы проверили список');
    if (!await ask('Назначить «' + own + '» владельцем ' + nz(w.count) + ' заявок без торгового?\nЭто изменит лист «Заявки». Копия листа будет создана автоматически.')) return;
    admDo({ op: 'ownersApply', owner: own, expect: nz(w.count), confirm: 'НАЗНАЧИТЬ' }).then(r => { if (!r) return; admOw = null; say('Готово. Назначено заявок: ' + nz(r.updated) + '.' + (r.backup ? '\nКопия прежнего состояния: лист «' + r.backup + '».' : '')); if (view == 'adm') admView(false); sync() }) }
  else if (a == 'rep') { const x = histById(v); if (!x) return; const n = lines().length;   // v34: «Заказать снова» — не затирает корзину и правку молча
    if (n && !await ask((eo ? 'Сейчас открыта правка заявки — она закроется без сохранения.\n' : '') + 'В заявке ' + n + ' ' + pl3(n, 'позиция', 'позиции', 'позиций') + (H.s ? ' для «' + H.s + '»' : '') + '.\nЗаменить их товарами из заявки «' + (x.h.s || '—') + '»?', 'Заменить')) return;
    const z = snap(); if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() } cart = JSON.parse(JSON.stringify(x.cart || {})); disc = x.disc; eo = ''; msw = ''; H = { ...x.h, dm: 0, r: '', t: 0 }; setUndo(null); save(); fill(); closeSheet(); drawList(); bar();
    toast('Товары из заявки «' + (x.h.s || '—') + '» — в корзине', () => unsnap(z)) }
  else if (a == 'uith') { if (TH.some(t => t[0] == v)) setUI('th', v) }
  else if (a == 'uifs') { const n = +v; if ([0, 1, 2].includes(n)) setUI('fs', n) }
  else if (a == 'svat') { if (!cSh) return; const x = cSh, k = skey(x), m = v == 'vat' || v == 'net' ? v : '';
    if (CFG.API_URL && srvV >= 31 && x.id) { x.vm = m; delete VATP[k]; LS('vatp', VATP); LS('base', base); shopq.push({ op: 'vat', id: x.id, n: x.n, c: x.c || '', a: x.a || '', m }); LS('shopq', shopq); sync() }   // v31: в таблицу
    else { if (m) VATP[k] = m; else delete VATP[k]; LS('vatp', VATP) } shopCard(k); cSaved('Цены для магазина: ' + (m ? ML[m] : 'по последней заявке')) }
  else if (a == 'uicv') { if (CV.some(t => t[0] == v)) setUI('cv', v) }
  else if (a == 'cv') setUI('cv', UI.cv == 'list' ? 'grid' : 'list')
  else if (a == 'rl') { load(); closeSheet() }
  else if (a == 'bak') exportBackup(); else if (a == 'imp') $('#impf').click()
});
document.addEventListener('change', e => { const t = e.target;
  if (t.id == 'ct' || t.id == 'op') return saveSet();   // v37.2
  if (t.dataset.q !== undefined) { const p = find(t.dataset.q); if (!p) return; let v = num(t.value), m = '';   // v36.3: ввод количества — те же границы, что у сервера
    if (v < 0) { v = 0 } if (v > QMAX) { v = QMAX; m = 'Не больше 100 000 ' + p.u } else if (!frac(p) && v != Math.round(v)) { v = Math.max(1, Math.round(v)); m = 'В «' + p.u + '» — только целые: ' + v + ' ' + p.u }
    setQ(p, v); if (m) toast(m) }
  else if (t.dataset.np !== undefined) commitNp(t)
  else if (t.id == 'dc') { const v0 = num(t.value), v = Math.min(DMAX, Math.max(0, Math.round(v0 * 10) / 10)); disc = v; save(); bar(); cartView(); if (v != v0) toast(v0 < 0 ? 'Скидка не может быть меньше 0' : 'Скидка — не больше ' + DMAX + '%') }   // v36.3: было без нижней границы (−5 % увеличивало итог)
  else if (t.id == 'rch') { H.r = t.value; save() }
  else if (t.id == 'ots') { const v = t.value ? new Date(t.value).getTime() : 0, o = eo && histById(eo);   // когда заявка сделана: не в будущем и не старше года
    if (!v) H.t = o ? nz(o.ts) : 0; else if (v > Date.now() + 6e4) say('Дату заявки нельзя поставить в будущее.'); else if (v < Date.now() - 365 * 864e5) say('Слишком давняя дата.'); else { H.t = v; if (H.dm && H.d < locIso(ordT())) { H.dm = 0; toast('Поставка была раньше дня заявки — поставлена ' + fd(nextFri(ordT()))) } } fixDate(); save(); fill(); cartView() }   // v34: поставка не раньше дня заявки   // v34: автоматическая поставка пересчитывается от времени заявки
  else if (t.id == 'cd') { pickD(t.value); save(); fill(); cartView() }
  else if (t.id == 'cas') { H.as = t.value; save(); cartView() }   // v36: «От имени» (администратор)
  else if (t.id == 'htr') { hTr = t.value; histView() }
  else if (t.id == 'tys') { cSh.ty = t.value; saveMeta(cSh); cSaved('Тип точки сохранён') }
  else if (t.id == 'sht') { shT = t.value; if (view == 'pick') pickBody(); else shopsView() }
  else if (/^rt(p|v|o|q|vd|od)$/.test(t.id)) { const k = { rtp: 'plan', rtv: 'visit', rto: 'order', rtq: 'q', rtvd: 'vd', rtod: 'od' }[t.id]; RT[k] = t.type == 'checkbox' ? t.checked : Math.max(1, Math.min(365, +t.value || RT0[k])); LS('rt', RT); drawShops() }
  else if (t.id == 'shc') { shCity = t.value; if (view == 'pick') pickBody(); else shopsView() } else if (t.id == 'shr') { shRg = t.value; drawShops() } else if (t.id == 'rgdp') { if (/^\d{4}-\d\d-\d\d$/.test(t.value)) { rgD = t.value; rgView(true) } }
  else if (t.id == 'impf') importBackup(t.files[0]); });
document.addEventListener('toggle', e => { const d = e.target; if (!d || !d.matches || !d.matches('details.cs') || !d.dataset || !d.dataset.s) return;   // v30: раскрытые разделы карточки запоминаются (раньше сворачивались при любом нажатии внутри)
  const k = d.dataset.s == 'rt' ? 'rt0' : d.dataset.s, on = d.dataset.s == 'rt' ? !d.open : d.open; if (on) cOpen.add(k); else cOpen.delete(k); LS('copen', [...cOpen]) }, true);   // v37.4: «В маршрут» раскрыт, пока сам не свернёшь (запоминается как «rt0»)
document.addEventListener('input', e => { if (e.target.id == 'shq') { shQ = e.target.value; if (view == 'rplan') drawWeekAdd(); else drawShops() } else if (e.target.id == 'prq') { prQ = e.target.value; $('#prl').innerHTML = promoList() } });
$('#q').oninput = e => { Q = e.target.value.toLowerCase(); drawList() };
['d', 's', 'a'].forEach(k => $('#' + k).addEventListener('change', e => { if (k == 'd') { pickD(e.target.value); $('#d').value = H.d; drawD(); drawHf(); return save() } H[k] = e.target.value;
  if (k == 's') { // название магазина приводим к записи из общей базы (сначала тот же город), подставляем город, адрес и ID
    const v = H.s.trim().replace(/\s+/g, ' '), any = base.filter(x => norm(x.n) == norm(v)), b = findBase(v, H.c, H.a) || (any.length == 1 ? any[0] : null);   // v35: одноимённые — без угадывания; выбрать из списка H.s = b ? b.n : v; $('#s').value = H.s; H.sid = b ? b.id || '' : ''; if (P.length) { drawChips(); drawList() }
    if (b) { H.a = b.a || H.a; if (b.c) { H.c = b.c; H.r = ''; cities() } $('#a').value = H.a || '' } shopWarn() }
  save() }));
$('#c').onchange = async e => { H.r = ''; if (e.target.value == '+') { const n = (await askText('Название нового города', 'Например: Кокшетау')).slice(0, 60); if (n) { S.cities.push(n); LS('set', S); H.c = n } cities() } else H.c = e.target.value; save() };

/* ============ 9. СТАРТ ============ */
// Защита от случайного выхода: кнопка «назад» сначала закрывает шторку/фото, а при непустой корзине просит нажать ещё раз; закрытие вкладки на ноутбуке — с вопросом
history.replaceState({ ab: 0 }, '');
const arm = () => { if (!history.state || history.state.ab !== 1) history.pushState({ ab: 1 }, '') };   // запись «страж» добавляем по касанию: браузер пропускает записи истории, созданные без действий пользователя
document.addEventListener('pointerdown', arm, true);
window.addEventListener('popstate', () => {
  const keep = () => history.pushState({ ab: 1 }, '');
  if (pkMode && !dlgDone) { pkExit(); return keep() }
  if (selMode && !dlgDone) { selExit(); return keep() }                                             // v37: «назад» выходит из выбора точек
  if (dlgDone) { dlgDone(dlgBk); return keep() }                                                    // открыто окно вопроса — «назад» = «Отмена»
  if ($('#lb').classList.contains('on')) { $('#lb').classList.remove('on'); return keep() }
  if (document.body.classList.contains('sh')) { const f = BACK[view]; if (f) f(); else { closeSheet(); drawList() } return keep() }   // страница — на уровень выше
  if (lines().length && Date.now() - lastBack > 2500) { lastBack = Date.now(); keep(); return toast('Нажмите «назад» ещё раз, чтобы выйти. Корзина сохранится.') }
  leaving = true; history.back();
});
window.addEventListener('beforeunload', e => { if (!leaving && (lines().length || LS('pending'))) { e.preventDefault(); e.returnValue = '' } });
window.addEventListener('pageshow', () => { leaving = false });
$('#s').addEventListener('focus', drawDD); $('#s').addEventListener('input', e => { H.s = e.target.value; H.sid = ''; save(); drawDD(); shopWarn(); drawHf() });
// Установка на главный экран: плашка (Android Chrome) и кнопка в настройках
let instEv = null; const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const hideInst = () => { const e = document.getElementById('inst'); if (e) e.remove() };
function showInst() { if (standalone || LS('instx') || !instEv || document.getElementById('inst')) return; const d = document.createElement('div'); d.id = 'inst'; d.className = 'inst';
  d.innerHTML = `<span>Установите приложение на главный экран</span><button data-a="inst">Установить</button><button class="ix" data-a="instx" aria-label="Скрыть">${ico('x', 16)}</button>`; document.body.prepend(d) }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instEv = e; showInst() });
window.addEventListener('appinstalled', () => { instEv = null; hideInst() });
// Экспорт истории в CSV (разделитель «;», кодировка UTF-8 с BOM — открывается в Excel)
function exportCsv() {
  const q = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }, n = v => String(v == null ? '' : v).replace('.', ','),
    dt = ts => { if (!ts) return ''; const d = new Date(ts), z = k => String(k).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) },
    list = allHist().filter(x => !x.del).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (!list.length) return say('Нет заявок для выгрузки');
  const rows = [['Создана', 'Торговый', 'Магазин', 'Город', 'Адрес', 'Получатель', 'Поставка на', 'Цены', 'Скидка %', 'Сумма заявки', 'Товар', 'Граммовка', 'Ед.', 'Кол-во', 'Цена', 'Сумма позиции']];
  list.forEach(x => { const h = x.h || {}, head = [dt(x.ts), x.trader || '', h.s || '', h.c || '', h.a || '', (x.rc && x.rc.n) || '', h.d || '', x.m == 'vat' ? 'с НДС' : 'без НДС', n(x.disc || 0), n(x.sum)];
    (x.items && x.items.length ? x.items : [null]).forEach(i => rows.push(head.concat(i ? [i.n, i.g || '', i.u || '', n(i.q), n(i.p), n(Math.round(i.p * i.q))] : ['', '', '', '', '', ''])) ) });
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'zayavki-' + today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500) }
// Резервная копия данных этого устройства (черновики, избранное, очередь отправки, настройки) — для нового телефона и переезда на другой хостинг.
// Токена входа, роли и пароля в ней нет (ключей tok и role нет в списке BAK): на новом устройстве нужно войти заново
const BAK = ['cart', 'disc', 'hdr', 'set', 'me', 'fav', 'drafts', 'hist', 'outbox', 'shopq', 'visq', 'delq', 'eo', 'msw', 'rw', 'rd', 'vatp', 'geono'];   // vatp — режим цен магазинов (v30); вид приложения (ui) не переносится: он под конкретный телефон
function exportBackup() {
  const d = { app: 'alibaba', ver: VER, at: new Date().toISOString(), data: {} }; BAK.forEach(k => { const v = LS(k); if (v != null) d.data[k] = v });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'alibaba-backup-' + today() + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500) }
function importBackup(f) {
  if (!f) return; const r = new FileReader();
  r.onload = async () => { let d; try { d = JSON.parse(r.result) } catch (e) { return say('Файл повреждён: это не резервная копия') }
    if (!d || d.app != 'alibaba' || !d.data) return say('Это не файл резервной копии «Али-Баба»');
    const x = d.data, fm = typeof x.me == 'string' ? x.me : '', other = !!(fm && me && norm(fm) != norm(me));   // очередь из файла принадлежит профилю, под которым её записали
    if (!await ask('Загрузить данные из файла (копия от ' + String(d.at || '').slice(0, 10) + (fm ? ', профиль «' + fm + '»' : '') + ')?\nЧерновики, избранное, дни маршрута и режимы цен магазинов будут объединены с текущими, настройки заменены.' + (other ? '\nОчередь отправки из файла загружена НЕ будет: она записана под другим профилем.' : '\nОчередь отправки будет объединена с текущей.'))) return;
    const arr = v => Array.isArray(v) ? v : [], mg = (k, key) => { const m = new Map(); [...arr(LS(k)), ...arr(x[k])].filter(e => e != null).forEach((e, i) => m.set(key ? e[key] : JSON.stringify(e), e)); LS(k, [...m.values()]) };
    mg('fav'); mg('drafts'); mg('hist', 'id'); if (!other) { mg('shopq'); mg('visq'); mg('delq', 'id'); mg('outbox', 'id') }
    if (x.set) LS('set', x.set); if (!me && fm) LS('me', fm); if (!lines().length && x.cart) { LS('cart', x.cart); LS('disc', x.disc || 0); LS('hdr', x.hdr || H); LS('eo', x.eo || ''); LS('msw', x.msw || '') }
    const om = (k) => { const o = v => v && typeof v == 'object' && !Array.isArray(v) ? v : null, f = o(x[k]); if (f) LS(k, { ...(o(LS(k)) || {}), ...f }) };   // маршрут и режимы цен магазинов: объединяем, при совпадении — как в файле
    om('rw'); om('rd'); om('vatp');
    say('Данные загружены. Приложение перезапустится.'); leaving = true; location.reload() };
  r.readAsText(f) }
document.addEventListener('change', e => { if (e.target.id == 'dp' && e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); histDay = new Date(y, m - 1, d).getTime(); histView() } });   // выбор дня в календаре
$('#sl').addEventListener('pointerdown', e => e.preventDefault());   // не терять фокус поля при тапе по списку
document.addEventListener('click', e => { if (!e.target.closest('.cb')) $('#sl').hidden = true });
document.addEventListener('click', e => { const t = e.target; if (t.matches && t.matches('input[type=date]') && t.showPicker) { try { t.showPicker() } catch (_) {} } });   // на ноутбуке календарь открывается по клику на поле, а не только по значку
document.addEventListener('visibilitychange', () => { if (document.hidden) waBlur = true; else { checkPending(); sync() } });
window.addEventListener('blur', () => { waBlur = true });   // v32: WhatsApp в плавающем окне забрал фокус — страница при этом видна
window.addEventListener('focus', () => { if (!waT) checkPending() });   // вернулись из плавающего окна — вопрос «Отправлено?»
window.addEventListener('storage', e => { if (e.key != 'tok' && e.key != 'me') return;   // в другой вкладке вошли, вышли или сменили профиль. Память у вкладок общая, поэтому эта вкладка перечитывает состояние целиком
  const t = LS('tok'), m = String(LS('me') || ''); if ((typeof t == 'string' ? t : '') === tok && m === me) return; leaving = true; location.reload() });
window.addEventListener('online', () => sync()); window.addEventListener('offline', () => { syncErr = true; syncStatus(); if (view == 'shopc' && cSh) drawFeed(cSh) });
$('#sy').addEventListener('click', () => CFG.API_URL && !tok ? authView() : sync());
/* ============ v33. ЗАГРУЗОЧНЫЙ ЭКРАН (DECISIONS п. 46): если прайс уже сохранён — сеть не ждём; показываем не меньше 0,8 с, чтобы не мигал ============ */
const SPL0 = Date.now(), plE = n => n % 10 == 1 && n % 100 != 11 ? '' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'а' : 'ов';   // окончание: товар / товара / товаров
function splStep(n, st, txt) { const e = $('#sp' + n); e.className = st; const m = e.querySelector ? e.querySelector('em') : null; if (m) m.textContent = txt || '' }
function splHide() { const el = $('#splash'); if (el.hidden) return; mk('ab-splash'); setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true }, 260) }, Math.max(0, 800 - (Date.now() - SPL0))) }
async function splash() {
  try { window.__splOwn = true } catch (_) {}   // запасной таймер в index.html больше не нужен
  $('#spv').textContent = 'Версия ' + VER; $('#splash').classList.remove('off'); $('#spo').hidden = true;
  const ent = !CFG.API_URL || !!tok; $('#sp2').hidden = !ent; $('#sp3').hidden = !ent;   // без входа магазинов и заявок на устройстве нет
  if (ent) { splStep(2, 'ok', base.length ? base.length + ' магазин' + plE(base.length) : ''); splStep(3, 'ok') }
  if (!CFG.SHEET_CSV || Array.isArray(LS('prod2'))) { const n = toProducts(LS('prod2') || [[], ...DEMO]).length; splStep(1, 'ok', n + ' товар' + plE(n)); return splHide() }
  splStep(1, 'on', 'загружаю…'); const err = await prodP;   // первый запуск: прайса на телефоне ещё нет
  if (!err) { splStep(1, 'ok', P.length + ' товар' + plE(P.length)); return splHide() }
  const on = navigator.onLine; $('#splash').classList.add('off'); $('#spo').hidden = false;
  $('#spot').textContent = on ? 'Прайс не загрузился' : 'Нет интернета';
  $('#spom').textContent = on ? 'Причина: ' + err + '.' : 'Для первого запуска нужен интернет: прайс ещё не сохранён на этом телефоне. Дальше приложение работает и без связи.';
}
drawSeg(); drawCv(); fill(); shops(); draftBadge(); syncStatus(); let prodP = load(); splash(); checkPending();
if (CFG.API_URL && !tok) { authNeed = true; syncStatus(); if (!LS('pending')) authView('login') } else { sync(); if (!LS('pending') && !Object.keys(cart).length && !eo) goHome() }   // старт — с маршрута; если в корзине есть товары — с заявки (корзину смотрим по сохранённым позициям: прайс к этому моменту ещё грузится)   // без входа к базе не обращаемся; каталог и корзина работают и так
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
function diagLoad(then) { // v36.5: ВРЕМЕННАЯ диагностика грузится отдельным файлом и только если включена в «Настройках»; пока выключена — на работу приложения не влияет
  if (window.DIAG) return then && then(); const s = document.createElement('script'); s.src = 'diag.js?v=' + VER; s.onload = () => then && then(); s.onerror = () => toast('Диагностика не загрузилась (нужен интернет)'); document.head.appendChild(s) }
if (LS('diag')) diagLoad();
