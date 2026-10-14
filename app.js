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
const VER = '33';
const NEED = 33;   // нужная версия Code.gs на сервере
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
const nz = v => { const x = typeof v == 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : 0 };   // число для вывода и расчётов: всё, что числом не является, становится 0 и в разметку не попадает
const cleanCart = c => { const o = {}; if (c && typeof c == 'object' && !Array.isArray(c)) Object.keys(c).forEach(k => { const x = c[k]; if (x && typeof x == 'object' && nz(x.q) > 0) { o[k] = { q: nz(x.q) }; if (x.p != null) o[k].p = nz(x.p) } }); return o };
function safeO(x) { // заявка из хранилища, файла или с сервера: числа — числами, строки — строками. Данным не доверяем, откуда бы они ни пришли
  if (!x || typeof x != 'object' || Array.isArray(x)) return null;
  const t = v => v == null ? '' : String(v), h = x.h && typeof x.h == 'object' ? x.h : {}, rc = x.rc && typeof x.rc == 'object' ? x.rc : null;
  const o = { ...x, id: t(x.id), ts: nz(x.ts), ed: nz(x.ed), del: nz(x.del), trader: t(x.trader), sum: nz(x.sum), disc: nz(x.disc), m: x.m == 'vat' || x.m == 'net' ? x.m : '', text: t(x.text),
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
// Дата поставки: по умолчанию ближайшая пятница (фирма возит по пятницам); если сегодня пятница — следующая. Прошлые даты запрещены.
const nextFri = () => { const k = (5 - new Date().getDay() + 7) % 7 || 7; return new Date(Date.now() + k * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) };
const fixDate = () => { if (!H.d || H.d < today() || !H.dm) { H.d = nextFri(); H.dm = 0 } };   // dm=1 — дату выбрали вручную
let P = [], cart = LS('cart') || {}, disc = LS('disc') || 0, H = LS('hdr') || { d: today() },
    S = LS('set') || { op: CFG.OPERATOR, cities: CFG.CITIES }, cat = 'Все', Q = '', view = '', editId = '';
S.mode = S.mode || CFG.PRICE_MODE;
if (!Array.isArray(S.cities) || !S.cities.length) S.cities = CFG.CITIES; S.op = S.op || CFG.OPERATOR;   // защита от данных старых версий
if (typeof H != 'object' || Array.isArray(H)) H = { d: today() }; fixDate(); if (typeof cart != 'object' || Array.isArray(cart)) cart = {};
let hfC = !!H.s;   // v33: магазин выбран — шапка заявки свёрнута в карточку «Магазин · адрес · поставка» с кнопкой «Сменить»
let me = String(LS('me') || ''), trs = LS('trs') || [], rcp = LS('rcp') || [], fav = LS('fav') || [], eo = LS('eo') || '', visq = LS('visq') || [], base = LS('base') || [], shist = LS('shist') || [], outbox = LS('outbox') || [], drafts = LS('drafts') || [], msw = LS('msw'), shopq = LS('shopq') || [], delq = LS('delq') || [], delok = LS('delok') || [];   // delok — удаления, принятые сервером, но ещё не подтверждённые выгрузкой
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
// Выбор дня в истории: histDay — начало выбранного дня (0 — все дни); dayC — старые дни, подгруженные по запросу (только в памяти)
const dayMs = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() };
const isoDay = ms => { const d = new Date(ms), z = k => String(k).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) };
let histDay = dayMs(Date.now()), dayC = {}, dayBusy = 0, dayErr = 0;
const winFrom = mine => dayMs(Date.now() - (mine ? 29 : 6) * 864e5);   // с какого дня заявки уже загружены: свои — 30 дней, чужие — 7 дней
const needDay = (d, mine) => !!(CFG.API_URL && d && d < winFrom(mine) && !(dayC[d] && Date.now() - dayC[d].t < 12e4));
async function loadDay(d) { const r = await call({ q: 'range', from: d, to: d + 864e5, undo: CFG.UNDO_HOURS }); dayC[d] = { t: Date.now(), hist: safeL(r.hist) } }
const pl3 = (n, a, b, c) => n % 10 == 1 && n % 100 != 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;   // 1 точка / 2 точки / 5 точек
const plZ = n => n % 10 == 1 && n % 100 != 11 ? 'заявка' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'заявки' : 'заявок';
const setDel = (id, ts) => Object.values(dayC).forEach(c => c.hist.forEach(x => { if (x.id == id) x.del = ts }));   // пометка удаления и в подгруженных днях
// История = серверная + локальная (ещё не синхронизированная), без дублей
const allHist = () => { // история = серверная + локальная; у каждой заявки есть del (время удаления, 0 — не удалена)
  const sm = new Map(shist.map(x => [x.id, x])), m = new Map();
  [...shist, ...Object.values(dayC).flatMap(c => c.hist), ...safeL(LS('hist'))].forEach(x => m.set(x.id || x.sum + x.h.s + x.h.d, x));
  return [...m.values()].map(x => { const q = [...delq].reverse().find(o => o.id == x.id) || delok.find(o => o.id == x.id), sv = sm.get(x.id);
    return { ...x, del: q ? q.del : sv ? (sv.del || 0) : (x.del || 0) } }).sort((a, b) => (b.ts || 0) - (a.ts || 0));
};
let hTr = '';   // фильтр «Все заявки» по торговому ('' — все)
const canEdit = x => !x.del && (CFG.API_URL && role == 'admin' ? !!x.trader : isMine(x) && Date.now() - (x.rg || x.ts || 0) < CFG.EDIT_HOURS * 36e5);   // свою заявку — в течение суток после записи (rg; дату оформления ts можно менять); администратор — любую заявку с торговым, без срока
let histTab = LS('htab') || 'mine';   // вкладка истории: 'mine' — мои, 'all' — все торговые
const isMine = x => CFG.API_URL ? !!me && x.trader == me : !x.trader || x.trader == me;   // заявка без торгового (из старых версий) — ничья: её можно посмотреть и повторить, но не изменить
const histById = id => allHist().find(x => x.id == id);
function delOrder(id, ts) { // ts — время удаления; 0 — вернуть заявку
  const h = LS('hist') || []; h.forEach(x => { if (x.id == id) x.del = ts }); LS('hist', h); setDel(id, ts);
  if (CFG.API_URL) { delq = delq.filter(o => o.id != id); delq.push({ id, del: ts, trader: me, at: Date.now() }); LS('delq', delq); sync() }   // at — когда нажали: по нему сервер считает срок возврата, даже если запрос дойдёт позже
}
// Позиция в корзине: cart[id] = { q: количество, p: ручная цена (необязательно) }
const pid = p => p.n + '|' + p.g + '|' + p.u;
const step = p => p.u == 'кг' ? .5 : 1;
const qty = p => cart[pid(p)]?.q || 0;
const price = p => cart[pid(p)]?.p ?? p.pr;
const find = id => P.find(p => pid(p) == id);
const lines = () => P.filter(p => qty(p) > 0);
const total = () => Math.round(lines().reduce((s, p) => s + price(p) * qty(p), 0));
const final = () => Math.round(total() * (1 - disc / 100));
const save = () => { if (!Object.keys(cart).length) msw = ''; LS('cart', cart); LS('disc', disc); LS('hdr', H); LS('eo', eo); LS('msw', msw) };   // корзина пуста — отметка «режим переключали» больше не нужна

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
  if (CFG.SHEET_CSV) {
    try {
      const r = await fetch(CFG.SHEET_CSV, { cache: 'no-store' }), t = await r.text();
      if (!r.ok || /<html|<!doctype/i.test(t.slice(0, 300))) throw new Error('ссылка ведёт не на CSV. Нужна ссылка из «Опубликовать в интернете» → формат CSV');
      rows = parseCSV(t);
      if (!toProducts(rows).length) throw new Error('в таблице нет строк с названием и ценой (проверьте порядок колонок и заголовок в 1-й строке)');
      LS('prod2', rows);
    } catch (e) { err = e.message == 'Failed to fetch' ? (location.protocol == 'file:' ? 'страница открыта как файл (file://) — браузер блокирует запросы к Google. Откройте сайт по ссылке с хостинга (https://)' : 'браузер не смог загрузить таблицу (адрес страницы: ' + location.origin + '). Возможна блокировка расширением, VPN или встроенным браузером мессенджера — откройте ссылку в Chrome') : e.message; rows = LS('prod2'); }
  }
  P = toProducts(rows || LS('prod2') || [[], ...DEMO]); applyMode(); applyFlags(); drawChips(); drawList(); bar(); note(err, !CFG.SHEET_CSV, P.filter(p => !p.pn || !p.pv).map(p => p.n));
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
  el.innerHTML = l.map((p, i) => `<article class="pc" style="--i:${Math.min(i, 8)}"><button class="fv${isFav(p) ? ' on' : ''}" data-a="fav" data-id="${esc(pid(p))}" aria-label="В избранное">${ico('star', 18)}</button><button class="ph" data-a="zoom" data-src="${esc(p.f || 'logo.jpg')}" aria-label="Увеличить фото"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" loading="lazy" alt="">${p.g ? `<span class="tag">${esc(p.g)}</span>` : ''}${bdg(p)}</button><div class="pb"><b>${esc(p.n)}</b>${p.g || p.hot || p.pm ? `<span class="gl">${esc([p.g, p.pm ? 'Продвигаем' : '', p.hot ? 'Ходовой' : ''].filter(Boolean).join(' · '))}</span>` : ''}<span class="pr">${p.pr ? tg(p.pr) : '—'} <small>/ ${esc(p.u)}</small></span>${pvl(p)}<div class="ctl" data-c="${esc(pid(p))}">${ctl(p)}</div></div></article>`).join('') || `<p class="empty">${cat == FAV ? 'Нажмите ★ на карточке товара — он появится здесь' : 'Ничего не найдено'}</p>`;
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
  let t = `Заявка на ${fd(H.d)} (${H.c || ''}) магазин ${H.s || ''}, ${H.a || ''}\n`;
  lines().forEach(p => { const n = price(p);
    t += `${p.n}${p.g ? `(${p.g})` : ''} - ${qf(qty(p))}${p.u}${n != p.pr ? ` по ${n} (было ${p.pr})` : ''};\n`; });
  const label = CFG.SHOW_VAT_LABEL ? (S.mode == 'vat' ? ' (с НДС)' : ' (без НДС)') : '';
  return t + (disc > 0 ? `Сумма.${total()}\nИтого со скидкой.${final()}${label}` : `Итого.${total()}${label}`);
}

/* ============ 5б. ОТМЕНА ПОСЛЕДНЕГО ДЕЙСТВИЯ (всплывающее «Изменено» + «Отменить») ============ */
let toastT = 0, toastFn = null, leaving = false, lastBack = 0;   // leaving — намеренный уход (WhatsApp, перезагрузка): защиту не включаем
function toast(msg, undo) { // обратимые действия не переспрашиваем, а даём несколько секунд на отмену
  let el = document.getElementById('toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el) }
  toastFn = undo || null; el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-a="undo">Отменить</button><span class="tp" style="animation-duration:7s"></span>' : ''}`; el.className = 'on';
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; toastFn = null }, undo ? 7000 : 3000);
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
const snap = () => ({ cart: JSON.stringify(cart), disc, eo, msw, H: JSON.stringify(H) });   // снимок заявки для отмены
function unsnap(z) { cart = JSON.parse(z.cart); disc = z.disc; eo = z.eo; msw = z.msw || ''; H = JSON.parse(z.H); save(); fill(); bar(); drawList(); if (view == 'cart') cartView() }

/* ============ 6. ШТОРКА: корзина, история, настройки ============ */
/* Разделы (нижняя панель): Маршрут / Заявка / История / Профиль (v33: бывшее «Ещё»). Страница раздела открывается поверх каталога; кнопка «Назад» ведёт на уровень выше */
const TAB = { shops: 'route', rplan: 'route', shopc: 'route', shop: 'route', shopn: 'route', hist: 'hist', hd: 'hist', more: 'more', set: 'more', who: 'more', adm: 'more', dr: 'more', cart: 'main', promo: 'more' };
const BACK = { shopc: () => shopsView(), shop: () => shopCard(skey(eSh)), shopn: () => shopsView(), rplan: () => { rtAdd = false; shopsView() }, hd: () => histView(),
  set: () => moreView(), who: () => moreView(), promo: () => moreView(), dr: () => moreView(), adm: () => whoView(), cart: () => { closeSheet(); drawList() } };
function navSync() { const t = view ? TAB[view] || '' : 'main';
  document.querySelectorAll('.bn button').forEach(b => b.classList.toggle('on', b.dataset.t == t));
  document.body.classList.toggle('lock', (view == 'auth' && needLogin()) || view == 'pend') }   // вход и вопрос «Отправлено?» — без панели разделов
function openSheet(v, title) { view = v; $('#st').textContent = title; const sh0 = document.getElementById('sheet'); if (sh0) { sh0.classList.remove('hero'); sh0.classList.remove('tl0') } const k = $('#sbk'); k.hidden = !BACK[v]; k.innerHTML = ico('back', 20) + '<span>' + (v == 'cart' ? 'К каталогу' : 'Назад') + '</span>';
  document.body.classList.add('sh'); const sh = document.getElementById('sheet'); if (sh) sh.scrollTop = 0; navSync(); bar() }
function goHome() { if (needLogin()) return authView(); shMode = 'route'; rtDay = -1; rtAdd = false; rvK = ''; shopsView() }   // стартовая страница — маршрут на сегодня
function todayInfo() { // v33: «Сегодня» в профиле — точки маршрута и свои заявки за сегодня
  try { const cur = base.filter(b => inToday(b)), t0 = dayMs(Date.now()), L = allHist().filter(x => !x.del && isMine(x) && dayMs(x.ts || 0) == t0);
    return { done: cur.filter(b => doneToday(b)).length, all: cur.length, n: L.length, sum: L.reduce((a, x) => a + nz(x.sum), 0) } } catch (e) { return null } }
const uiSeg = (lbl, L, k, a) => `<b>${lbl}</b><div class="seg sg3">${L.map(([v, t]) => `<button data-a="${a}" data-v="${v}" class="${UI[k] == v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
function moreView() { openSheet('more', 'Профиль');   // v33: макет «Профиль» — карточка с именем и «Сегодня», плитки, вид, блок администратора, «Выйти»
  const tile = (a, ic, t, sub, cls) => `<button class="mtl${cls ? ' ' + cls : ''}" data-a="${a}"><span class="mti">${ico(ic, 22)}</span><span class="mtt"><b>${t}</b><span class="m">${sub}</span></span></button>`;
  const d = todayInfo(), adm2 = CFG.API_URL && tok && role == 'admin';
  const card = !CFG.API_URL ? '' : tok && me ? `<button class="pfc" data-a="who" aria-label="Профиль: ${esc(me)}"><span class="pfh"><span class="pfa">${esc(me.slice(0, 1).toUpperCase())}</span><span class="pft"><b>${esc(me)}</b><span>${role == 'admin' ? 'Администратор' : 'Торговый'}</span></span>${ico('chev', 22)}</span>${d ? `<span class="pfd">Сегодня: <b>${d.done} из ${d.all}</b> ${pl3(d.all, 'точки', 'точек', 'точек')} · <b>${d.n}</b> ${plZ(d.n)} · <em>${tg(d.sum)}</em></span>` : ''}</button>`
    : `<div class="pfc"><span class="pfh"><span class="pfa">${ico('user', 22)}</span><span class="pft"><b>Вход не выполнен</b><span>${qN() ? 'ждут отправки: ' + qN() : 'войдите, чтобы отправлять заявки'}</span></span></span><button class="send acc" data-a="auth">Войти</button></div>`;
  $('#sb').innerHTML = card + `<div class="mtg">${tile('drafts', 'folder', 'Черновики', drafts.length ? 'сохранено: ' + drafts.length : 'пока пусто', 'acc')}${tile('set', 'sliders', 'Настройки', 'города, прайс, данные')}</div>`
    + `<div class="sum pfv">${uiSeg('Тема', TH, 'th', 'uith')}${uiSeg('Размер текста', FS, 'fs', 'uifs')}</div>`
    + (adm2 ? `<div class="pfs"><span>АДМИНИСТРАТОР</span></div><div class="mtg">${tile('adm', 'user', 'Доступ и профили', 'приглашения, роли, проверка', 'adm')}${srvV >= 31 ? tile('promo', 'star', 'Продвигать товары', promoL.length ? 'отмечено: ' + promoL.length : 'ничего не отмечено', 'adm') : ''}</div>` : '')
    + (standalone ? '' : `<button class="pfi" data-a="inst">${ico('plus', 20)}<span class="mtt"><b>Установить на главный экран</b><span class="m">значок приложения на телефоне</span></span></button>`)
    + `<div class="pff"><span class="pfl"><img src="logo.jpg" alt="Логотип Али-Баба"></span><span class="m">Али-Баба · версия ${VER}</span>${CFG.API_URL && tok ? '<button class="pfo" data-a="out">Выйти</button>' : ''}</div>`;
}
const needLogin = () => !!CFG.API_URL && !tok && !LS('pending');   // входа нет (не входили, вышли или сервер отозвал доступ); неотвеченный вопрос «Отправлено?» важнее экрана входа
function closeSheet() { if (view == 'auth' && needLogin()) return;   // экран входа нельзя смахнуть: без входа приложением не пользуются
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
function commitNp(t) { // новая цена позиции: из поля ввода (по «Готово» или при уходе из поля)
  const n = num(t.value), id = t.dataset.np; if (editId != id) return; if (n > 0 && cart[id] && find(id)) { n == find(id).pr ? delete cart[id].p : cart[id].p = n; save() } editId = ''; bar(); cartView() }
function vatBar() { // v33: режим цен — переключатель на всю ширину; под ним — откуда взята норма точки или предупреждение, что режим не совпадает
  const nm = vatNorm(curShop(), eo), m = S.mode;
  const hint = nm && nm.m != m ? `<div class="sw q">${nm.set ? 'В карточке магазина выбрано: ' + ML[nm.m] : 'Последняя заявка в этот магазин была ' + ML[nm.m]}</div>` : nm ? `<p class="m vth">${nm.set ? 'Как выбрано в карточке магазина' : 'Как в прошлой заявке в эту точку'}</p>` : '';
  return `<div class="vatb"><div class="seg">${['vat', 'net'].map(k => `<button data-a="mode" data-v="${k}" class="${m == k ? 'on' : ''}">${k == 'vat' ? 'Цены с НДС' : 'без НДС'}</button>`).join('')}</div>${hint}</div>`;
}
function cartView() { // v30: оформление по порядку — режим цен, магазин и дата, позиции, скидка и итог, время заявки, отправка. v33: вид — макет «Оформление заявки»
  if (view != 'cart') openSheet('cart', 'Ваша заявка'); const sh = document.getElementById('sheet'); if (sh) sh.classList.add('tl0');   // v33: заголовок крупно в странице, сверху только «К каталогу»
  const L = lines();
  if (!L.length) { $('#sb').innerHTML = `<div class="empt">${ico('bag', 40)}<b>Заявка пуста</b><p class="m">Добавьте товары из каталога.</p></div><button class="send" data-a="nmain">К каталогу</button>`; return }
  const eoo = eo && histById(eo), banner = eo ? `<div class="sw q ckeo"><b>Правка заявки «${esc(eoo ? eoo.h.s : '')}»${eoo ? ' от ' + ft(eoo.ts) : ''}</b><span>Старая версия будет заменена.</span><button class="ghost" data-a="eoc">Отменить правку</button></div>` : '';
  const who = H.s ? `<div class="ckh"><div class="ckt"><small>МАГАЗИН</small><b>${esc(H.s)}</b>${H.a || H.c ? `<span class="m">${esc(H.a || H.c)}</span>` : ''}</div><button class="ocb" data-a="ochg">Сменить</button></div>`
    : `<div class="ckt"><small>МАГАЗИН</small><div class="sw bad">Магазин не указан</div><button class="ghost" data-a="ochg">Указать магазин</button></div>`;
  const dBlock = `<div class="sum ck">${who}<label class="ckd"><b class="ckl">Дата поставки</b><span class="ckdv"><span>${esc(fdw(H.d))}</span>${ico('cal', 20)}<input type="date" id="cd" min="${today()}" value="${esc(H.d || '')}" aria-label="Дата поставки"></span></label></div>`;
  const items = L.map(p => { const id = esc(pid(p)), n = price(p), ch = n != p.pr, ed = editId == pid(p);
    const pr = ed ? `<div class="npr"><input class="np" data-np="${id}" inputmode="decimal" value="${n}" aria-label="Новая цена"><button class="ib2 ok" data-a="pdone" data-id="${id}">Готово</button></div>`
      : ch ? `<span class="ipc"><s>${fm(p.pr)}</s><b>${tg(n)} / ${esc(p.u)}</b></span><small class="m">цена изменена</small>`
      : `<span class="m">${p.g ? esc(p.g) + ' · ' : ''}${tg(n)} / ${esc(p.u)}</span>`;
    return `<div class="it"><div class="ckr"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" alt=""><div class="in"><b>${esc(p.n)}</b>${pr}</div><b class="ls">${tg(Math.round(n * qty(p)))}</b></div>
    <div class="cka"><div class="st"><button data-a="m" data-id="${id}" aria-label="Меньше">−</button><input data-q="${id}" inputmode="decimal" value="${qf(qty(p))}" aria-label="Количество"><button data-a="p" data-id="${id}" aria-label="Больше">+</button></div><span class="sp"></span>${ed ? '' : `<button class="lnk" data-a="edit" data-id="${id}" aria-label="Изменить цену">Цена</button>`}${ch && !ed ? `<button class="lnk" data-a="reset" data-id="${id}">Вернуть цену</button>` : ''}<button class="lnk bad" data-a="rm" data-id="${id}">Убрать</button></div></div>`; }).join('');
  const sum = `<div class="sum cks"><b>Скидка на весь чек</b><div class="dc">${[0, 3, 5, 10].map(x => `<button data-a="disc" data-v="${x}" class="${disc == x ? 'on' : ''}">${x ? x + '%' : 'Нет'}</button>`).join('')}<input id="dc" inputmode="decimal" placeholder="свой" value="${[0, 3, 5, 10].includes(disc) ? '' : disc}" aria-label="Своя скидка, %"></div>
  <div class="ckt2"><div class="r"><span class="m">Сумма</span><b>${tg(total())}</b></div>${disc > 0 ? `<div class="r"><span class="m">Скидка ${disc}%</span><b>−${tg(total() - final())}</b></div>` : ''}</div><div class="r t"><span>Итого</span><span>${tg(final())}</span></div><div class="m ckm">цены ${ML[S.mode]}</div></div>`;
  const tBlock = `<details class="sc ck"${H.t > 0 ? ' open' : ''}><summary>${ico('clock', 22)}<span class="cst">Время заявки<small class="m">${H.t > 0 ? 'указано вручную: ' + ft(H.t) : 'сейчас · менять, если приняли раньше'}</small></span></summary><input type="datetime-local" id="ots" max="${dtl(Date.now())}" value="${dtl(H.t > 0 ? H.t : Date.now())}"><p class="m" style="margin:6px 0 10px">Меняйте, только если заявку приняли раньше, а вносите сейчас.</p></details>`;
  $('#sb').innerHTML = `<h3 class="ckhd">Ваша заявка</h3><p class="m ckc">${L.length} ${pl3(L.length, 'позиция', 'позиции', 'позиций')}</p>` + vatBar() + banner + dBlock + `<div class="cki">${items}</div>` + sum + tBlock +
    `${rcBlock()}${eo ? `<button class="send" data-a="esave">${ico('check', 20)} Сохранить изменение</button>` : `<button class="send" data-a="send">${ico('send', 22)} Отправить в WhatsApp</button>`}<button class="ghost" data-a="dsave">Сохранить как черновик</button><button class="lnk bad clr2" data-a="new">${ico('trash', 18)} Очистить заявку</button>`;
  const np = document.querySelector('[data-np]'); if (np) np.select();
}
const dtl = t => { const d = new Date(t); return new Date(t - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) };   // местное время в формате поля datetime-local
const ft = ts => ts ? new Date(ts).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
/* v31. Итоги в «Истории»: неделя (с понедельника) / месяц / год, календарные, и прошлый такой же период целиком. Одной суммой (оборот).
   Границы периодов считает приложение в местном времени и отправляет на сервер; торговый видит свои, администратор — всех с разбивкой */
let stP = ['w', 'm', 'y'].includes(LS('stp')) ? LS('stp') : 'w', stC = null, stBusy = false, stErr = '';
function periods() { const d = new Date(Date.now()); d.setHours(0, 0, 0, 0); const y = d.getFullYear(), m = d.getMonth(), t = x => x.getTime();
  const w0 = new Date(d); w0.setDate(d.getDate() - (d.getDay() + 6) % 7); const w1 = new Date(w0); w1.setDate(w0.getDate() + 7); const pw = new Date(w0); pw.setDate(w0.getDate() - 7);
  return { w: [t(w0), t(w1)], pw: [t(pw), t(w0)], m: [t(new Date(y, m, 1)), t(new Date(y, m + 1, 1))], pm: [t(new Date(y, m - 1, 1)), t(new Date(y, m, 1))], y: [t(new Date(y, 0, 1)), t(new Date(y + 1, 0, 1))], py: [t(new Date(y - 1, 0, 1)), t(new Date(y, 0, 1))] } }
async function loadStats(force) {
  if (stBusy || !CFG.API_URL || !tok || srvV < 31 || (!force && stC && Date.now() - stC.at < 6e4)) return;
  if (!navigator.onLine) { stErr = 'нет связи'; return }
  stBusy = true; try { const r = await call({ q: 'stats', b: periods() }); if (r && r.ok && r.w) { stC = { at: Date.now(), d: r }; stErr = '' } else stErr = 'сервер не отдал итоги' } catch (e) { stErr = e && e.message || 'ошибка' } finally { stBusy = false }
  if (view == 'hist') histView() }
function statsBlock() { // v33: «Итоги» — тёмной плашкой (макет «История и итоги»)
  if (!CFG.API_URL || !tok || srvV < 31) return ''; loadStats();
  const L = { w: ['Неделя', 'Прошлая неделя'], m: ['Месяц', 'Прошлый месяц'], y: ['Год', 'Прошлый год'] }, SN = { w: 'с понедельника', m: 'с 1-го числа', y: 'с 1 января' }, d = stC && stC.d, cur = d && d[stP], prv = d && d['p' + stP], nn = z => nz(z.n) + ' ' + plZ(nz(z.n));
  const body = !cur || !prv ? `<div class="m">${stErr ? 'Итоги не загрузились: ' + esc(stErr) : 'Загружаю итоги…'}</div>`
    : `<div><div class="stn">${tg(cur.sum)}</div><div class="m">${nn(cur)}<span> · ${SN[stP]}</span></div></div><div class="stpv"><span><span>${L[stP][1]} целиком</span><small>${nn(prv)}</small></span><b>${tg(prv.sum)}</b></div>`
      + (d.all && cur.by ? `<div class="stb">${Object.keys(cur.by).sort((a, b) => nz(cur.by[b].sum) - nz(cur.by[a].sum)).map(n => `<div class="r"><span>${esc(n)}</span><b>${tg(cur.by[n].sum)} <small class="m">· ${nn(cur.by[n])}</small></b></div>`).join('') || '<div class="m">Заявок нет</div>'}</div>` : '');
  return `<div class="sts"><div class="sth"><b class="stt">Итоги</b><span>${d && d.all ? 'все торговые' : 'мои заявки'}</span></div><div class="seg sg3">${Object.keys(L).map(k => `<button data-a="stp" data-v="${k}" class="${stP == k ? 'on' : ''}">${L[k][0]}</button>`).join('')}</div>${body}</div>` }
function histView() { // вкладки «Мои» / «Все заявки»; ниже — «Недавно удалённые» (только свои)
  openSheet('hist', 'История'); const now = Date.now(), win = CFG.UNDO_HOURS * 36e5, mine = histTab == 'mine';
  if (needDay(histDay, mine) && !dayBusy && dayErr != histDay) { const d = histDay; dayBusy = d;   // выбранный день старше загруженного окна — запрашиваем его у сервера
    loadDay(d).then(() => { if (dayErr == d) dayErr = 0 }).catch(() => { dayErr = d }).finally(() => { dayBusy = 0; if (view == 'hist') histView() }) }
  const all = allHist(), inDay = x => !histDay || dayMs(x.ts || 0) == histDay, loading = needDay(histDay, mine) && dayErr != histDay, failed = needDay(histDay, mine) && dayErr == histDay;
  const inT = x => mine || !hTr || x.trader == hTr, act = all.filter(x => !x.del && (!mine || isMine(x)) && inDay(x) && inT(x)), trash = mine ? all.filter(x => x.del && now - x.del < win && isMine(x)) : [];
  const left = x => { const m = Math.max(1, Math.round((win - (now - x.del)) / 6e4)); return m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин' : m + ' мин' };
  const nMine = all.filter(x => !x.del && isMine(x) && inDay(x)).length, nAll = all.filter(x => !x.del && inDay(x) && (!hTr || x.trader == hTr)).length;
  const names = [...new Set([...trs, ...all.map(x => x.trader)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), trSel = CFG.API_URL && !mine ? `<select id="htr" class="htrs"><option value="">Все торговые</option>${names.map(n => `<option ${n == hTr ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';
  const tabs = CFG.API_URL ? `<div class="seg htab">${[['mine', 'Мои (' + nMine + ')'], ['all', 'Все заявки (' + nAll + ')']].map(([k, t]) => `<button data-a="htab" data-v="${k}" class="${histTab == k ? 'on' : ''}">${t}</button>`).join('')}</div>` : '';
  const sumAll = act.reduce((a, x) => a + (+x.sum || 0), 0), stats = loading ? 'Загружаю…' : failed ? '—' : act.length + ' ' + plZ(act.length) + ' · ' + tg(sumAll), t0 = dayMs(Date.now());
  const lbl = d => { const ds = new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', ''); return d == t0 ? 'Сегодня · ' + ds : d == dayMs(Date.now() - 864e5) ? 'Вчера · ' + ds : new Date(d).toLocaleDateString('ru', { weekday: 'short' }) + ', ' + ds };
  const tm = ts => histDay ? new Date(ts || 0).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : ft(ts);   // выбран день — только время
  const plate = histDay   // v33: выбор дня — белой карточкой, итоги дня под датой
    ? `<div class="day"><button class="dnb" data-a="dprev" aria-label="Предыдущий день">${ico('back', 22)}</button><label class="dl"><span>${lbl(histDay)}</span><small>${stats}</small><input type="date" id="dp" value="${isoDay(histDay)}" max="${isoDay(t0)}" aria-label="Выбрать день"></label><button class="dnb" data-a="dnext" ${histDay >= t0 ? 'disabled' : ''} aria-label="Следующий день">${ico('chev', 22)}</button></div><div class="dsw">${histDay != t0 ? '<button class="lnk dall dtd" data-a="dtoday">К сегодняшнему дню</button>' : '<button class="lnk dall" data-a="dall">Показать все дни</button>'}</div>`
    : `<div class="day"><div class="dl"><span>Все дни</span><small>${stats}</small></div><button class="ocb dall" data-a="dtoday">Выбрать день</button></div>${CFG.API_URL ? `<p class="m dsw">Показаны заявки за последние ${mine ? 30 : 7} дн. Более ранние — через «Выбрать день».</p>` : ''}`;
  const emptyMsg = loading ? '<p class="empty">Загружаю заявки за этот день…</p>' : failed ? '<p class="empty">Нет связи: этот день не загружен.<br><button class="ocb" data-a="dretry" style="margin-top:12px">Повторить</button></p>' : histDay ? '<p class="empty">За этот день заявок нет</p>' : '<p class="empty">Заявок пока нет</p>';
  const card = x => `<div class="hc"><button class="hch" data-a="hd" data-v="${esc(x.id)}"><span class="hct"><b>${esc(x.h.s || '—')} ›</b>${!mine || !isMine(x) ? `<span class="m who">${ico('user', 14)} ${esc(x.trader || 'без торгового')}</span>` : ''}<span class="m">Создана ${tm(x.ts)}${x.ed ? ' · изменена ' + ft(x.ed) : ''} · поставка ${fd(x.h.d)}${!mine && x.h.c ? ' · ' + esc(x.h.c) : ''}</span></span><b class="amt">${tg(x.sum)}</b></button>${CFG.API_URL && outbox.some(y => y.id == x.id) ? `<div class="hcp">${pendChip()}${syncErr ? '<button data-a="sretry" class="rtry">Отправить ещё раз</button>' : ''}</div>` : ''}
    <div class="hcb"><button class="hrep" data-a="rep" data-v="${esc(x.id)}">Повторить</button>${canEdit(x) ? `<button class="hed" data-a="hedit" data-v="${esc(x.id)}" aria-label="Изменить заявку">${ico('edit', 16)} Изменить</button>` : ''}${isMine(x) ? `<button class="x" data-a="hdel" data-v="${esc(x.id)}" aria-label="Удалить заявку">${ico('trash', 18)}</button>` : ''}</div></div>`;
  const tLeft = trash.length ? trash.reduce((a, x) => x.del > a.del ? x : a) : null;   // «вернуть можно ещё …» — по последней удалённой
  $('#sb').innerHTML = statsBlock() + tabs + trSel + plate + `<div class="hcl">${act.map(card).join('') || emptyMsg}</div>`
  + (trash.length ? `<details class="htr"><summary>${ico('trash', 20)}<span><b>Недавно удалённые: ${trash.length}</b> · вернуть можно ещё ${left(tLeft)}</span></summary>` + trash.map(x => `<div class="hc hcd"><div class="hch"><span class="hct"><b>${esc(x.h.s || '—')}</b><span class="m">${ft(x.ts)} · ${tg(x.sum)}</span><span class="m">Можно вернуть ещё ${left(x)}</span>${delq.some(o => o.id == x.id) ? '<span class="m">' + pendChip() + ' (удаление)</span>' : ''}</span><button class="ocb" data-a="hres" data-v="${esc(x.id)}">Вернуть</button></div></div>`).join('') + '</details>' : '');
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
  <div class="sum hdm">${R('Поставка на', fd(x.h.d) || '—')}${R('Торговый', esc(x.trader || 'без торгового'))}${x.rc && x.rc.n ? R('Получатель', esc(x.rc.n)) : ''}${R('Создана', ft(x.ts))}${x.ed ? R('Изменена', ft(x.ed)) : ''}</div>
  <div class="sum hdl"><b class="hdh">Товары${x.items ? ' · ' + x.items.length : ''}</b>${rows}<div class="r t"><span>Итого</span><span>${tg(x.sum)}</span></div></div>
  ${canEdit(x) ? `<button class="send" data-a="hedit" data-v="${esc(x.id)}">${ico('edit', 20)} Изменить заявку <small class="hdlft">ещё ${Math.max(1, Math.round((CFG.EDIT_HOURS * 36e5 - (Date.now() - x.ts)) / 36e5))} ч</small></button>` : ''}<button class="${canEdit(x) ? 'ghost' : 'send'}" data-a="rep" data-v="${esc(x.id)}">${ico('undo', 18)} Повторить заявку</button><button class="ghost" data-a="hcopy" data-v="${esc(x.id)}">Скопировать текст</button>${isMine(x) ? `<button class="lnk bad clr2" data-a="hdel" data-v="${esc(x.id)}">${ico('trash', 18)} Удалить заявку</button>` : ''}`;
}
/* ============ 6а. ВИД: тема и размер текста (только на этом устройстве, ключ ui; применяется сразу, без «Сохранить») ============ */
const TH = [['light', 'Светлая'], ['dark', 'Тёмная'], ['sys', 'Как в телефоне']], FS = [[0, 'Обычный'], [1, 'Крупный'], [2, 'Очень крупный']], CV = [['grid', 'Плиткой'], ['list', 'Списком']];
let UI = LS('ui'); if (!UI || typeof UI != 'object' || Array.isArray(UI)) UI = {};
UI.th = TH.some(t => t[0] == UI.th) ? UI.th : 'light'; UI.fs = [0, 1, 2].includes(UI.fs) ? UI.fs : 0; UI.cv = UI.cv == 'list' ? 'list' : 'grid';   // cv — вид каталога (по умолчанию плитка)   // по умолчанию светлая: на улице днём тёмная читается хуже
const darkMq = typeof matchMedia == 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
function applyUI() {
  const r = document.documentElement, dark = UI.th == 'dark' || (UI.th == 'sys' && !!(darkMq && darkMq.matches));
  if (r && r.setAttribute) { r.setAttribute('data-theme', dark ? 'dark' : 'light'); r.setAttribute('data-fs', String(UI.fs)) }
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.setAttribute('content', dark ? '#0E100E' : '#F3F3EE'));
}
if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', () => { if (UI.th == 'sys') applyUI() });   // «как в телефоне»: тема меняется вслед за системой
const uiBlock = () => `<b>Тема</b><div class="seg sg3" style="margin:6px 0 14px">${TH.map(([k, t]) => `<button data-a="uith" data-v="${k}" class="${UI.th == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <b>Размер текста</b><div class="seg sg3" style="margin:6px 0 14px">${FS.map(([k, t]) => `<button data-a="uifs" data-v="${k}" class="${UI.fs == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <b>Каталог товаров</b><div class="seg sg3" style="margin:6px 0 8px">${CV.map(([k, t]) => `<button data-a="uicv" data-v="${k}" class="${UI.cv == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <p class="m" style="margin:0 0 4px">Меняется сразу и только на этом телефоне.</p>`;
function setUI(k, v) { UI[k] = v; LS('ui', UI); applyUI(); if (k == 'cv') { drawCv(); drawList() } if (view == 'set') setView(); if (view == 'more') moreView() }
applyUI();
function setView() {
  openSheet('set', 'Настройки');
  const rl = rcp.length ? rcp.map(r => esc(r.n) + (r.c.length ? ' (' + esc(r.c.join(', ')) + ')' : '') + (r.d ? ' ★' : '') + ' · ' + esc(r.p)).join('<br>') + '<br><span class="m">Список ведётся на листе «Получатели» таблицы и общий для всех. Выбирается получатель на главном экране.</span>' : CFG.API_URL ? 'Список пуст: заполните лист «Получатели» (имя, телефон, города, по умолчанию). Пока заявки уходят на запасной номер.' : 'Общая база не подключена — заявки уходят на запасной номер.';
  $('#sb').innerHTML = `
  <details class="sc" open><summary>Вид</summary>${uiBlock()}</details>
  <details class="sc"><summary>Города и прайс</summary><b>Города (через запятую)</b><input id="ct" value="${esc(S.cities.join(', '))}"><button class="ghost" data-a="rl">Обновить прайс</button>${standalone ? '' : `<button class="ghost" data-a="inst">${ico('plus', 18)} Установить на главный экран</button>`}</details>
  <details class="sc"><summary>Заявки</summary><p class="m" style="margin:0 0 4px">Свою заявку можно изменить в течение ${CFG.EDIT_HOURS} ч (администратор — любую и без срока) и удалить с возможностью вернуть в течение ${CFG.UNDO_HOURS} ч — в «Истории».</p><button class="ghost" data-a="csv">${ico('save', 18)} Экспорт истории (CSV)</button></details>
  <details class="sc"><summary>Получатели</summary><p class="m" style="margin:0 0 8px;line-height:1.5">${rl}</p>
    <details class="mini"><summary>Запасной номер WhatsApp</summary><input id="op" inputmode="tel" value="${esc(S.op)}" placeholder="77001234567"><p class="m" style="margin:0">Используется, только если лист «Получатели» пуст. Код страны и номер, без + и пробелов.</p></details></details>
  <details class="sc"><summary>Данные</summary><p class="m" style="margin:0 0 4px">Черновики, избранное и неотправленное хранятся на этом устройстве. Файл поможет перенести их на новый телефон или на другой адрес сайта.</p><button class="ghost" data-a="bak">${ico('down', 18)} Сохранить данные устройства (файл)</button><button class="ghost" data-a="imp">${ico('up', 18)} Загрузить данные из файла</button><input type="file" id="impf" accept=".json,application/json" hidden></details>
  <details class="sc"><summary>Служебная информация</summary><div class="m" style="font-size:13px;line-height:1.5">Версия: ${VER}${CFG.API_URL ? ' · Code.gs: ' + (srvV || 'не определена') + (srvV && srvV < NEED ? ' (устарел!)' : '') : ''} · адрес: ${esc(location.origin)}<br>Товаров: ${P.length} (с ценой с НДС: ${P.filter(p => p.pv).length}, без НДС: ${P.filter(p => p.pn).length})<br>Режим цен: ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}<br>${CFG.API_URL ? `База: ${syncErr ? 'ошибка: ' + esc(lastErr) : 'подключена'} · торговых в списке: ${trs.length} · профиль: ${esc(me || 'не выбран')}<br>Ждут отправки: заявок ${outbox.length}, правок магазинов ${shopq.length}, визитов ${visq.length}` : 'База заявок не подключена (API_URL пуст)'}</div></details>
  <button class="send" data-a="ss">Сохранить</button>`;
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
function fill() { fixDate(); $('#d').min = today(); $('#d').value = H.d; $('#s').value = H.s || ''; $('#a').value = H.a || ''; cities(); shopWarn(); if (H.s) hfC = true; drawHf(); if (P.length) { drawChips(); drawList() } }
function drawHf() { const c = !!(H.s && hfC), f = $('#hf'); f.classList.toggle('cmp', c); $('#ocs').hidden = !c; $('#hfok').hidden = c || !H.s;   // v33: свёрнутая шапка — карточка магазина; развёрнутая — поля и «Готово»
  $('#ocs').innerHTML = c ? `<div class="ocst"><b>${esc(H.s)}</b><span class="m">${esc([H.a || H.c, H.d ? 'поставка ' + fd(H.d) : ''].filter(Boolean).join(' · '))}</span></div><button class="ocb" data-a="hfch">Сменить</button>` : '' }   // v31: сменился магазин — вкладка «Брал раньше» и подписи «в прошлый раз»
const clrShop = () => { H.s = ''; H.a = ''; H.sid = ''; H.r = ''; H.t = 0; hfC = false };   // после заявки/черновика: магазин и получатель выбираются заново
const curShop = () => (H.sid && base.find(b => b.id == H.sid)) || (H.s && (base.find(b => norm(b.n) == norm(H.s) && (!H.c || !b.c || norm(b.c) == norm(H.c))) || null)) || null;
function shopWarn() { // плашка под полем магазина: статус, причина, кто и когда отметил (предупреждение, а не запрет)
  const x = curShop(), el = $('#sw'); if (!x || !x.st || !ST[x.st] || (x.st != 'no' && x.st != 'closed')) { el.hidden = true; return }   // v33: на экране заявки — только предупреждение «Не заходить» / «Закрыт»; остальные статусы — в маршруте и карточке
  const bad = x.st == 'no' || x.st == 'closed'; el.hidden = false; el.className = 'sw full ' + (bad ? 'bad' : 'ok');
  el.textContent = (bad ? '⚠ ' : '') + ST[x.st][0] + (x.nt ? ': ' + x.nt : '') + (x.sb ? ' · ' + x.sb + (x.sa ? ', ' + fd(isoDay(x.sa)) : '') : '');
}

/* ============ 7б. СИНХРОНИЗАЦИЯ, ПОДТВЕРЖДЕНИЕ, ЧЕРНОВИКИ, ПРОФИЛЬ ============ */
const vfail = [];
let syncWarn = false, syncing = false, again = false, syncErr = false, syncAt = '', lastErr = '', srvV = nz(LS('srv'));   // srvV — версия Code.gs на сервере
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
  tok = ''; me = ''; role = 'trader'; LS('tok', ''); LS('me', ''); LS('role', ''); trs = []; LS('trs', trs); shist = []; LS('shist', shist); dayC = {}; adm = null; admCode = null; admOw = null;
  authNeed = true; syncStatus(); authView('login');
}
function syncStatus() { // строка статуса под названием в шапке
  const n = outbox.length + shopq.length + delq.length + visq.length, el = $('#sy'); if (!CFG.API_URL) { el.hidden = true; return }
  el.textContent = !tok ? 'Требуется вход' + (n ? ' · ждут отправки: ' + n : '') + ' (нажмите)' : srvV && srvV < NEED ? 'Обновите Code.gs до версии ' + NEED + ' (нажмите)' : syncWarn ? 'Сервер не сохранил удаление — обновите Code.gs (нажмите)' : syncing ? 'Синхронизация…' : syncErr ? 'Нет связи с базой' + (n ? ' · ждут: ' + n : '') + ' (нажмите)' : n ? 'Ждут отправки: ' + n : 'Всё сохранено · ' + syncAt;   // v33: как в макете; имя — в «Профиле»
  const st = !tok || syncErr || syncWarn || (srvV && srvV < NEED) ? 'bad' : syncing || n ? 'wait' : 'ok'; el.hidden = st == 'ok';   // v33: на экране заявки строка видна, только когда есть что сказать (как в макете «Каталог»)
  const e2 = document.getElementById('sy2'); if (e2) { e2.textContent = el.textContent; const p = e2.parentNode; if (p && p.setAttribute) p.setAttribute('data-st', st) }   // v33: та же строка в шапке маршрута
}
const ORDFAIL = { invalid: 'данные не прошли проверку на сервере', trader_mismatch: 'она записана под другим профилем', not_owner: 'это заявка другого торгового', no_owner: 'у заявки нет торгового — изменить её может только администратор', too_late: 'прошло больше ' + CFG.EDIT_HOURS + ' ч', stale: 'на сервере уже есть более новая правка' };
const DELFAIL = { not_owner: 'это заявка другого торгового', no_owner: 'у заявки нет торгового — изменить её может только администратор', trader_mismatch: 'операция записана под другим профилем', expired: 'срок возврата (' + CFG.UNDO_HOURS + ' ч) истёк, заявка осталась удалённой', future: 'часы на устройстве спешат', invalid: 'данные не прошли проверку на сервере' };
function orderRefused(o, r) { // сервер не принял заявку или правку. История приводится к состоянию сервера, а введённое не теряется — уходит в черновики
  LS('hist', (LS('hist') || []).filter(x => x && x.id != o.id));
  const h = o.h || {}; drafts.unshift({ H: { d: h.d, c: h.c, s: h.s, a: h.a, sid: h.sid || '', dm: 1, r: o.rc && o.rc.n || '' }, cart: cleanCart(o.cart), disc: nz(o.disc), m: o.m, n: Object.keys(cleanCart(o.cart)).length, sum: nz(o.sum), t: Date.now() }); LS('drafts', drafts); draftBadge();
  vfail.push((o.ed ? 'Правка заявки' : 'Заявка') + ' «' + (h.s || '') + '» не принята сервером: ' + (ORDFAIL[r.reason] || r.reason || 'причина не указана') + (r.f ? ' (' + r.f + ')' : '') + '. Она сохранена в черновиках' + (o.ed ? '; в истории осталась прежняя версия.' : '.'));
}
function delRefused(o, r) { // отказ подтверждён ответом сервера: только теперь локальная пометка удаления приводится к серверной
  if (r.del != null) { const sv = nz(r.del), h = LS('hist') || []; h.forEach(x => { if (x && x.id == o.id) x.del = sv }); LS('hist', h); setDel(o.id, sv); shist.forEach(x => { if (x.id == o.id) x.del = sv }) }
  if (r.reason != 'not_found') vfail.push((o.del ? 'Удаление' : 'Возврат') + ' заявки не выполнен: ' + (DELFAIL[r.reason] || r.reason || 'причина не указана') + (r.reason == 'not_owner' && r.owner ? ' («' + r.owner + '»)' : '') + '.');
}
async function sync() { // отправляет накопленные заявки и правки магазинов, затем подтягивает торговых, магазины и историю
  if (!CFG.API_URL) return;
  if (!tok) { authNeed = true; again = false; syncStatus(); return }   // без входа ничего не отправляем: очереди ждут того же профиля
  if (syncing) { again = true; return }                 // уже идёт — повторим после
  if (!navigator.onLine) { syncErr = true; syncStatus(); return }
  syncing = true; syncStatus(); const n0 = qN();
  // Правило для всех очередей: операция убирается из очереди только после ответа сервера. Сетевая ошибка или отказ в авторизации прерывают цикл, очередь остаётся как была
  try {
    const new23 = x => ['status', 'info', 'meta', 'days', 'owner', 'vat', 'geo', 'geodel'].includes(x.op);   // эти операции понимает только новый Code.gs (days / owner / vat / geo — с v31, geodel — с v32)
    for (const x of [...shopq]) { // правки магазинов — строго по порядку; при ошибке останавливаемся
      if (new23(x) && srvV < NEED) continue;
      const r = await call({ shop: x });
      if (!r.ok) throw new Error('скрипт не принял правку магазина'); shopq = shopq.filter(y => y !== x); LS('shopq', shopq);
      if (r.applied === false) vfail.push('Правка магазина «' + (x.n || x.old || '') + '» не принята сервером: ' + (FAILR[r.reason] || r.reason || '—') + '.');
    }
    for (const v of [...visq]) { // визиты и операции над ними (правка / отмена / восстановление — по ID события); порядок сохраняется
      if (srvV < NEED) break;
      v.tried = 1; LS('visq', visq);                          // с этого момента запрос мог дойти до сервера, даже если ответ потерялся
      const r = await call(v.cancel ? { visitCancel: v } : v.act ? { visitOp: v } : { visit: v });
      if (!r.ok) throw new Error('скрипт не принял визит'); visq = visq.filter(y => y !== v); LS('visq', visq);
      if (r.applied === false && !(v.act && r.reason == 'not_found')) vfail.push(visitFail(v, r.reason)) }
    for (const o of [...outbox]) {
      const r = await call({ order: o });
      if (!r.ok) throw new Error('скрипт не принял заявку'); outbox = outbox.filter(x => x.id != o.id); LS('outbox', outbox); stC = null;   // v32: итоги пересчитать при следующем показе
      if (r.applied === false) orderRefused(o, r);
    }
    for (const o of [...delq]) { // удаления и возвраты заявок — после самих заявок
      const r = await call({ orderOp: o });
      if (!r.ok) throw new Error('скрипт не принял удаление заявки'); delq = delq.filter(x => x !== o); LS('delq', delq); stC = null;
      if (r.applied === false) delRefused(o, r);
      else { delok.push({ id: o.id, del: o.del, t: Date.now() }); LS('delok', delok) }   // запоминаем, пока выгрузка не подтвердит
    }
    const d = await call({ q: 'init', undo: CFG.UNDO_HOURS }), sh = safeL(d.hist); let bf = false;   // bf — база магазинов обновлена с сервера в этом проходе
    if (d.me) { role = d.me.role == 'admin' ? 'admin' : 'trader'; LS('role', role) }   // роль — только для показа кнопок; права проверяет сервер
    trs = (Array.isArray(d.traders) ? d.traders : []).map(String); srvV = nz(d.srv); LS('srv', srvV); if (Array.isArray(d.rcp)) { rcp = d.rcp; LS('rcp', rcp); drawRc() }
    if (Array.isArray(d.hot)) { hotL = d.hot.filter(x => x && typeof x.k == 'string'); LS('hot', hotL) } if (Array.isArray(d.promo)) { promoL = d.promo.map(String); LS('promo', promoL) }   // v31: «Ходовые» и «Продвигать» — с сервера
    if (Array.isArray(d.reasons)) { RSN = d.reasons.map(String).slice(0, 12); LS('rsn', RSN) } if (Array.isArray(d.hot) || Array.isArray(d.promo)) { applyFlags(); drawChips(); if (!view) drawList() }
    if (!shopq.length && !visq.length && Array.isArray(d.shops)) { const m = new Map(base.map(b => [b.id, b])); base = d.shops.map(x => { const o = m.get(x.id); return o ? Object.assign(o, x) : x }); bf = true }   // объекты магазинов сохраняем (на них ссылаются открытая карточка и кнопки «Отменить»)   // пока есть неотправленные правки, локальную базу не затираем
    if (srvV >= NEED && (shopq.some(new23) || visq.length)) again = true;   // версия сервера стала известна — досылаем отметки
    if (srvV >= 31 && bf && migrate31()) again = true;                                // v31: дни маршрута и режимы цен, заданные на телефоне, — один раз на сервер
    syncWarn = false; delok = delok.filter(o => { const sv = sh.find(x => x.id == o.id); if (!sv) return false;   // подтверждение удаления / возврата выгрузкой
      if (!!sv.del == !!o.del) return false; syncWarn = true; return Date.now() - o.t < 6e5 });                      // не совпало: сервер не применил — предупреждаем, пока не истёк срок
    LS('delok', delok); shist = sh; LS('trs', trs); LS('base', base); LS('shist', shist); shops();
    syncErr = false; lastErr = ''; authNeed = false; syncAt = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    if (n0 && !qN() && !vfail.length && !toastFn) toast('Сохранено на сервере');   // не перебиваем кнопку «Отменить»   // «Сохранено» — только после ответа сервера
  } catch (e) { if (e && e.auth) lastErr = 'нужен вход'; else { syncErr = true; lastErr = e && e.message || 'неизвестная ошибка' } }
  if (vfail.length) { const m = vfail.splice(0).join('\n'); setTimeout(() => say(m), 0) }
  syncing = false; syncStatus(); if (view == 'who') whoView(); if (view == 'hist') histView(); if ((view == 'shops' || view == 'rplan') && !rvK) drawShops();   // маршрут перерисовывается, когда пришли магазины (кроме момента, когда открыта отметка визита)
  if (view == 'shopc' && cSh) { drawFeed(cSh); loadLog(cSh) }   // открытая карточка магазина подтягивает ленту с сервера (v30: раньше эта строка была внутри комментария и не выполнялась)
  if (again) { again = false; if (tok) return sync() }
}

function commitOrder(o) { // заявка или правка подтверждена: в историю устройства и в очередь на сервер
  if (o.h && o.h.sid) delete prevC[o.h.sid];   // v31: «Брал раньше» для этой точки устарело
  const h = (LS('hist') || []).filter(x => x.id != o.id); h.unshift(o); LS('hist', h.slice(0, 50)); outbox = outbox.filter(x => x.id != o.id); outbox.push(o); LS('outbox', outbox);
  const sh = upShop(o.h.s, o.h.c, o.h.a, o.h.sid); if (sh && !o.ed) { sh.lo = Math.max(sh.lo || 0, o.ts); planAfter(sh, '', o.ts); LS('base', base) }   // заявка сегодня закрывает точку и её план на сегодня   // новый магазин сразу попадает в список; «посл. заказ» обновляется
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
function whoView() { // профиль: кто вошёл, выход; администратору — управление доступом
  openSheet('who', 'Профиль'); const n = qN();
  $('#sb').innerHTML = tok ? `<div class="pfc"><span class="pfh"><span class="pfa">${esc(me.slice(0, 1).toUpperCase())}</span><span class="pft"><b>${esc(me)}</b><span>${role == 'admin' ? 'Администратор' : 'Торговый'}</span></span></span></div>
    ${role == 'admin' ? `<button class="send" data-a="adm">${ico('user', 20)} Доступ и профили</button>` : ''}
    ${n ? `<div class="sw q whq">Ждут отправки: ${n}. Пока они не ушли на сервер, выйти или сменить профиль нельзя: эти операции записаны от имени «${esc(me)}», и под другим профилем сервер их не примет.</div>` : ''}
    <button class="ghost pfo2" data-a="out">Выйти из профиля</button>`
    : `<div class="empt">${ico('user', 40)}<b>Вход не выполнен</b>${n ? '<p class="m">Ждут отправки: ' + n + '.</p>' : ''}</div><button class="send" data-a="auth">Войти</button>`;
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
const STN = { active: 'пароль задан', invited: 'приглашение выдано', invite_expired: 'приглашение истекло', none: 'доступа ещё нет', revoked: 'доступ отозван' };
const ADMR = { self: 'свой профиль удалить нельзя', revoked: 'доступ отозван — сначала выдайте приглашение', not_found: 'профиль не найден', last_admin: 'это единственный действующий администратор', exists: 'такой профиль уже есть', invalid: 'недопустимое значение', changed: 'данные изменились после пробного прогона — запустите его ещё раз', confirm: 'нет подтверждения', backup: 'не удалось сделать копию листа — ничего не изменено' };
const RECN = { link_fix: 'старые заявки и визиты привязываются к карточкам магазинов', ts_fix: 'заявки получают дату оформления (сейчас она не записана)', sum_diff: 'магазины получают верные «последний заказ» и «последний визит»', no_id: 'магазины получают постоянный номер',
  ambiguous: 'записи подходят сразу к нескольким магазинам с одним названием — остаются как есть', unmatched: 'записи о магазинах, которых нет в списке, — остаются как есть', orphan: 'записи об удалённых магазинах — остаются как есть', conflict: 'записи с противоречивыми данными о магазине — остаются как есть' };
const recLine = c => { c = safeO(c) || {}; return Object.keys(RECN).filter(k => nz(c[k])).map(k => `<div class="m">${RECN[k]}: ${nz(c[k])}</div>`).join('') };
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
  + adm.map(p => `<div class="acd"><div class="act"><b>${esc(p.n)}</b><span class="m">${p.role == 'admin' ? 'Администратор' : 'Торговый'} · ${STN[p.state] || esc(p.state)}${nz(p.until) ? ' до ' + ft(nz(p.until)) : ''}</span>${nz(p.last) ? `<span class="m">Последний вход: ${ft(nz(p.last))}</span>` : ''}</div>
    <div class="acb"><button data-a="ainv" data-v="${esc(p.n)}" data-s="${esc(p.state)}">${p.state == 'active' ? 'Сбросить пароль' : 'Приглашение'}</button>${p.state == 'active' || p.state == 'invited' ? `<button data-a="arev" data-v="${esc(p.n)}">Отозвать доступ</button>` : ''}<button data-a="arole" data-v="${esc(p.n)}" data-r="${p.role == 'admin' ? 'trader' : 'admin'}">${p.role == 'admin' ? 'Сделать торговым' : 'Сделать администратором'}</button>${norm(p.n) != norm(me) ? `<button class="bad" data-a="adel" data-v="${esc(p.n)}">Удалить профиль</button>` : ''}</div></div>`).join('')
  + `<div class="sum" style="margin-top:12px"><b>Новый профиль</b><input id="adn" maxlength="40" placeholder="Имя торгового" style="margin:8px 0"><div class="pr2"><button data-a="aadd">Добавить</button></div><p class="m" style="margin:8px 0 0">После добавления выдайте приглашение. Удалённый профиль исчезает из списка, а его заявки остаются в таблице под прежним именем. Если человек не работает временно — лучше отозвать доступ.</p></div>
  <div class="sum" style="margin-top:12px"><b>Проверка и исправление данных</b><p class="m" style="margin:6px 0">Для записей, оставшихся от старых версий: привязывает заявки и визиты к карточкам магазинов, пересчитывает «последний заказ» и «последний визит», находит заявки без торгового. Проверка только считает и ничего не меняет.</p><div class="pr2"><button data-a="afix">Проверить данные</button></div>
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
const STT = { reg: 'ok', good: 'ok', prom: 'wait' };   // v33: тон метки — зелёная (работаем), жёлтая (перспективный), серая (остальные)
const pill = c => c && ST[c] ? `<span class="pl ${STT[c] || 'nt'}">${ST[c][0]}</span>` : '';
const pillOf = b => b.st ? pill(b.st) : lastC(b) ? '' : '<span class="pl nt">Не были</span>';   // нет статуса и ни визитов, ни заказов — «Не были»
const byId = id => id && base.find(b => b.id == id);
const sameCity = (b, c) => !c || !b.c || norm(b.c) == norm(c);
const findBase = (n, c) => base.find(b => norm(b.n) == norm(n) && sameCity(b, c)) || null;
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
let cMine = 0, cTot = 0, evF = 'all', evEd = '', cErr = '', cKey = '', ddL = [], eSh = null, cSh = null, cLog = null, shMode = 'route', shSt = '', shCity = null, shQ = '', cSt = '';
function shopEditView(x) { // правка названия, города, адреса / удаление магазина в общей базе
  eSh = x; $('#sl').hidden = true; openSheet('shop', 'Магазин');
  $('#sb').innerHTML = `<div class="sum"><b>Название</b><input id="en" maxlength="120" value="${esc(x.n)}"><b>Город</b><select id="ec">${[...new Set([...S.cities, x.c].filter(Boolean))].map(c => `<option ${c == x.c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><b>Адрес</b><input id="ea" maxlength="300" value="${esc(x.a)}"><b>Тип точки</b><select id="ety">${tyOpts(x.ty)}</select></div><button class="send" data-a="ssave">Сохранить</button><button class="ghost" style="color:var(--danger);border-color:var(--danger)" data-a="sdel">Удалить магазин</button>`;
}
function shopList() { // база без дублей (по ID, иначе название + город); магазины текущего города — выше
  const m = new Map(); base.forEach(b => { const k = b.id || norm(b.n) + '|' + norm(b.c); if (!m.has(k)) m.set(k, b) });
  return [...m.values()].sort((x, y) => (norm(y.c) == norm(H.c)) - (norm(x.c) == norm(H.c)) || x.n.localeCompare(y.n, 'ru'));
}
function upShop(n, c, a, id) { if (!n) return null; let o = (id && byId(id)) || findBase(n, c);
  if (o) { o.c = o.c || c || ''; o.a = o.a || a || ''; if (!o.id && id) o.id = id } else { o = { id: id || newSid(), n, c: c || '', a: a || '' }; base.push(o) }
  LS('base', base); return o }
function addShop(n) { const o = upShop(n, H.c, H.a); H.sid = o.id; if (CFG.API_URL) { shopq.push({ n, c: H.c || '', a: H.a || '', id: o.id }); LS('shopq', shopq); sync() } }
function drawDD() {
  const raw = $('#s').value.trim(), v = norm(raw); ddL = shopList().filter(x => norm(x.n).includes(v));
  $('#sl').innerHTML = ddL.map((x, i) => `<div class="dr"><button class="di" data-a="pick" data-v="${i}"><b>${esc(x.n)}</b><span class="m">${esc([x.ty, x.c, x.a].filter(Boolean).join(' · '))}</span>${x.st && x.st != 'neu' ? pill(x.st) : ''}</button><button class="ed" data-a="sedit" data-v="${i}" aria-label="Карточка магазина">${ico('edit', 18)}</button></div>`).join('')
    + (v && !ddL.some(x => norm(x.n) == v && sameCity(x, H.c)) ? `<button class="di add2" data-a="padd">＋ Добавить «${esc(raw)}»</button>` : '')
    || '<p class="m" style="padding:10px">Магазинов пока нет — впишите название</p>';
  $('#sl').hidden = false;
}
function selShop(x) { if (x.id && prevC[x.id] && !prevC[x.id].items.length) delete prevC[x.id];   // пустое «Брал раньше» перезапрашиваем при выборе магазина
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
function shopsView() { // раздел «Маршрут»: лист на сегодня или справочник «Все магазины»
  const route = shMode == 'route'; if (route) { rtDay = -1 } if (shCity === null) shCity = H.c || '';
  openSheet('shops', route ? 'Маршрут' : 'Магазины');
  if (route) { const sh = document.getElementById('sheet'); if (sh) sh.classList.add('hero');   // v33: у маршрута своя крупная шапка (DECISIONS п. 52)
    $('#sb').innerHTML = `<div id="shl"></div><div id="shaw" class="shaw" hidden><input id="shq" type="search" placeholder="Найти магазин для добавления" value="${esc(shQ)}"><div id="sha"></div></div><div id="shx"></div>`; return drawShops() }
  const cs = [...new Set([...S.cities, ...base.map(b => b.c)].filter(Boolean))];   // v33: «Все магазины» — вариант Б (DECISIONS п. 49, 53)
  const cityF = cs.length > 1 ? `<select id="shc" aria-label="Город"><option value="">Все города</option>${cs.map(c => `<option ${c == shCity ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : '';
  $('#sb').innerHTML = `<div class="seg" style="margin-bottom:12px">${[['route', 'На сегодня'], ['all', 'Все магазины']].map(([k, t]) => `<button data-a="shm" data-v="${k}" class="${shMode == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <div class="shsr"><div class="sf"><span class="si">${ico('search', 18)}</span><input id="shq" type="search" placeholder="Найти магазин" value="${esc(shQ)}"></div><button class="ghost shnew" data-a="shn">${ico('plus', 18)} Новый</button></div>
  <div id="shf"></div>
  <div class="sfl">${cityF}<select id="sht" aria-label="Тип точки"><option value="">Любой тип</option>${TY.map(t => `<option ${t == shT ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
  <div id="shl"></div>`;
  drawShops();
}
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
const daysDeny = b => say('Точка «' + b.n + '» закреплена за «' + b.ow + '»: дни маршрута меняет он или администратор.\nДобавить её себе на сегодня можно кнопкой «В маршрут на сегодня».');
function inToday(b) { const d = rdToday(), k = skey(b); return !d.rm.includes(k) && (d.add.includes(k) || (inWeek(b, wdNow()) && myPt(b))) }
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
function setToday(b, on) { const d = rdToday(), k = skey(b), auto = inWeek(b, wdNow()) && myPt(b); d.add = d.add.filter(x => x != k); d.rm = d.rm.filter(x => x != k); if (on && !auto) d.add.push(k); if (!on && auto) d.rm.push(k); saveRoute() }   // auto — точка и так в маршруте сегодня (по дням и своя/свободная)
function setWeek(b, i, on) { const a = wdays(b).filter(x => x != i); if (on) a.push(i); a.sort();
  if (CFG.API_URL && srvV >= 31 && b.id) { b.rw = a; LS('base', base); shopq.push({ op: 'days', id: b.id, n: b.n, c: b.c || '', a: b.a || '', days: a }); LS('shopq', shopq); sync(); return }   // v31: в таблицу, через очередь
  const k = skey(b); if (a.length) RW[k] = a; else delete RW[k]; saveRoute() }
function migrate31() { // один раз после перехода на v31: дни маршрута и режимы цен, заданные на телефоне, — на сервер, только туда, где в таблице пусто
  if (LS('mig31')) return false; let n = 0; const ok = x => x && x.id && base.includes(x), q = (x, o) => { shopq.push(Object.assign({ id: x.id, n: x.n, c: x.c || '', a: x.a || '' }, o)); n++ };
  Object.keys(RW).forEach(k => { const x = shopById(k), d = RW[k]; if (ok(x) && Array.isArray(d) && d.length && !(Array.isArray(x.rw) && x.rw.length)) { x.rw = d.filter(i => Number.isInteger(i) && i >= 0 && i <= 6).sort(); q(x, { op: 'days', days: x.rw }) } });
  Object.keys(VATP).forEach(k => { const x = shopById(k), m = VATP[k]; if (ok(x) && (m == 'vat' || m == 'net') && !x.vm) { x.vm = m; q(x, { op: 'vat', m }) } });
  RW = {}; VATP = {}; LS('rw', RW); LS('vatp', VATP); LS('mig31', 1); if (n) { LS('shopq', shopq); LS('base', base) } return n > 0 }
function quickVisit(x, val, nt) { // отметка визита прямо из маршрута: время — сейчас; «Отменить» в подсказке снимает отметку
  const ts = Date.now(), vid = 'v' + ts.toString(36) + Math.random().toString(36).slice(2, 6), prev = { lv: x.lv, lb: x.lb, lw: x.lw, pl: x.pl }; if (x.pl && x.pl <= ts) x.pl = 0;
  if (CFG.API_URL) { visq.push({ id: vid, shop: x.n, sid: x.id || '', c: x.c, a: x.a, trader: me, ts, val, note: nt }); LS('visq', visq) }
  if (ts >= (x.lv || 0)) { x.lv = ts; x.lb = val; x.lw = me } const pc = planAfter(x, val, ts); LS('base', base); if (CFG.API_URL) sync(); setTimeout(() => geoOffer(x), 0);
  toast((DEFER.includes(val) ? 'Отложено: ' : 'Визит отмечен: ') + val, () => { if (CFG.API_URL) visOp(x, 'cancel', { id: vid, ts, val, nt }, {}); Object.assign(x, prev); if (pc) saveMeta(x); LS('base', base); if (view == 'shops' || view == 'rplan') drawShops(); else if (view == 'shopc') shopCard(skey(x)) });
}
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
  const rest = todo.filter(b => b !== gb), live = rest.filter(b => !deferred(b)), pct = cur.length ? Math.round(done.length / cur.length * 100) : 0;
  const addr = b => esc([b.a, b.c].filter(Boolean).join(' · ') || 'без адреса'), who = b => b.lw && norm(b.lw) != norm(me) ? ' · ' + esc(b.lw) : '';
  const lc = t => t ? t[0].toLowerCase() + t.slice(1) : '', psub = b => visDone(b) ? 'Визит ' + hhmm(b.lv) + ' · ' + esc(lc(b.lb)) + who(b) : 'Заявка ' + hhmm(b.lo);   // v33: как в макете — «Заявка 11:40», «Визит 10:20 · взяли заказ»
  const dfs = b => `Отложено в ${hhmm(b.lv)} · ${esc(lc(b.lb))}${b.lw && b.lw != me ? ' (' + esc(b.lw) + ')' : ''}`;
  const tl = (node, body, cls = '') => `<div class="tl${cls}">${node}${body}</div>`;
  const dl = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  let h = `<div class="rhd"><div class="rhr"><div><div class="rdt">${esc(dl)}</div><div class="rtt">Маршрут</div></div>
    <div class="rcn" aria-label="пройдено ${done.length} из ${cur.length}${ext.length ? ' · вне маршрута: ' + ext.length : ''}"><b>${done.length}<span>/${cur.length}</span></b><small>пройдено${ext.length ? ' · +' + ext.length + ' вне маршрута' : ''}</small></div></div>
    <div class="pbar"><span style="width:${pct}%"></span></div>${CFG.API_URL ? '<button class="rsy" data-a="syn"><span class="sd"></span><span id="sy2"></span></button>' : ''}</div><div class="tline">`;
  h += done.concat(ext).map(b => tl(`<span class="tn ok">${ico('check', 16)}</span>`, `<button class="tlp" data-a="scard" data-v="${esc(skey(b))}"><b>${esc(b.n)}</b><span class="m">${psub(b)}${ext.includes(b) ? ' · вне маршрута' : ''}</span></button>`)).join('');
  if (gb) { const k = esc(skey(gb));
    h += tl(`<span class="tn go">${ico('nav', 16)}</span>`, `<div class="gocard"><div class="gor"><span class="bdgl">ЕДУ СЮДА</span><span class="m">выбрано в ${hhmm(GO.t || Date.now())}</span></div>
      <div><b class="gon">${esc(gb.n)}</b><div class="gom">${addr(gb)}</div><div class="gom">${gb.lo ? 'Последняя заявка ' + ago(gb.lo) : 'Заявок ещё не было'}</div></div>
      ${deferred(gb) ? `<span class="dfl">${ico('clock', 15)} ${dfs(gb)}</span>` : ''}${gb.fq ? `<div class="goq"><span>ВОПРОС · </span>${esc(gb.fq)}</div>` : ''}
      <div class="gob"><button class="send" data-a="rvis" data-v="${k}">${ico('check', 22)}<span>Визит</span></button><button class="send acc" data-a="rord" data-v="${k}">${ico('bag', 22)}<span>Заявка</span></button></div>
      ${rvK == skey(gb) ? `<div class="sum rv"><b>Результат визита</b><p class="m" style="margin:4px 0 8px">Нажмите результат — визит запишется. Комментарий — по желанию.</p><input id="rvn" maxlength="500" placeholder="Комментарий (для «Другое» — обязательно)" style="margin:0 0 10px"><div class="vg vg2">${VO.map((t, i) => `<button data-a="rres" data-v="${i}">${t}</button>`).join('')}</div></div>` : ''}
      ${gq(gb) ? `<a class="ghost gonav" href="${esc(geoUrl(gb))}" target="_blank" rel="noopener">${ico('nav', 18)} Как проехать</a>` : ''}
      <div class="gol"><button class="lnk" data-a="scard" data-v="${k}">Карточка точки</button><button class="lnk" data-a="rgox">Другая точка</button></div></div>`, ' now') }
  else if (cur.length && !live.length && !gb) { const od = allHist().filter(x => !x.del && isMine(x) && isToday(x.ts)), sm = od.reduce((a, x) => a + (+x.sum || 0), 0), np = done.length + ext.length;
    h += tl(`<span class="tn ok">${ico('check', 18)}</span>`, `<div class="rsum"><small>НА СЕГОДНЯ</small><b>Маршрут пройден</b><span>${np} ${pl3(np, 'точка', 'точки', 'точек')} · ${od.length ? `${od.length} ${pl3(od.length, 'заявка', 'заявки', 'заявок')} · <em>${tg(sm)}</em>` : 'заявок нет'}</span>${rest.length ? `<span>${rest.length == 1 ? 'Осталась отложенная точка' : 'Остались отложенные точки'} — зайдите, если успеете.</span>` : ''}</div>`, ' now') }
  else if (cur.length) h += tl('<span class="tn q">?</span>', `<div class="ask">${lastDone ? `<div class="askok">${ico('check', 18)}<span>${esc(lastDone.n)} — ${doneToday(lastDone) ? (visDone(lastDone) ? 'визит отмечен, ' + esc(lc(lastDone.lb)) : 'заявка оформлена') : 'отложено, ' + esc(lc(lastDone.lb))}</span></div>` : ''}<b>${lastDone ? 'Куда дальше?' : 'Куда едете?'}</b><p>Нажмите точку ниже — она встанет сюда с кнопками «Визит» и «Заявка».</p></div>`, ' now');
  else h += tl('<span class="tn q">?</span>', '<div class="ask"><b>На сегодня точек нет</b><p>Добавьте точку кнопкой ниже или настройте маршрут по дням недели.</p></div>', ' now');
  h += rest.map(b => { const k = esc(skey(b)), df = deferred(b);
    return tl(`<span class="tn ${df ? 'df' : 'nx'}"></span>`, `<div class="tlb"><button class="rrow${df ? ' df' : ''}" data-a="rgo" data-v="${k}"><span class="rrt"><b>${esc(b.n)}</b><span class="m">${df ? dfs(b) : esc(b.a || b.c || 'без адреса') + (b.fq ? ' · есть вопрос' : '')}</span></span><span class="rgo">Еду сюда${ico('chev', 20)}</span></button>${df ? `<button class="ghost rno" data-a="rrm" data-v="${k}"><span>Не зайду сегодня</span></button>` : ''}</div>`) }).join('');
  h += `</div><button class="ghost radd" data-a="radd">${ico(rtAdd ? 'x' : 'plus', 18)} ${rtAdd ? 'Скрыть список для добавления' : 'Добавить точку на сегодня'}</button>`;
  $('#shl').innerHTML = h;
  const w = document.getElementById('shaw'); if (w) w.hidden = !rtAdd;
  const pick = (b, tags) => `<button class="shi" data-a="rpick" data-v="${esc(skey(b))}"><div style="flex:1;min-width:0"><b>${esc(b.n)}</b><div class="m">${addr(b)}</div>${tags ? `<div class="tg">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div><span class="pl add">+ добавить</span></button>`;
  if (rtAdd) { const q = norm(shQ), ad = L.filter(b => !cur.includes(b) && norm(b.n).includes(q)).sort(byName);
    $('#sha').innerHTML = ad.slice(0, 40).map(b => pick(b)).join('') + (ad.length > 40 ? `<p class="m" style="margin:0 2px 8px">Показаны первые 40 из ${ad.length}. Уточните поиском.</p>` : '') || '<p class="empty">Подходящих магазинов нет: все уже в списке или не подходят под поиск.</p>' }
  const tips = L.filter(b => !inToday(b) && myPt(b)).map(b => ({ b, d: dueInfo(b) })).filter(x => x.d).sort((x, y) => y.d.sc - x.d.sc).slice(0, 20);
  $('#shx').innerHTML = (tips.length ? `<details class="rt rtip"><summary><span>Стоит заехать · ${tips.length}</span><small class="m">не в маршруте, но давно не были или есть вопрос</small></summary>${tips.map(({ b, d }) => pick(b, d.tags)).join('')}</details>` : '')
    + `<div class="rnav"><button class="ghost" data-a="shm" data-v="all">Все магазины</button><button class="ghost" data-a="rplan">Маршрут по дням</button></div>`;
  syncStatus();
}
function drawShops() {
  const route = shMode == 'route', q = norm(shQ);
  if (route && rtDay < 0) return drawToday(base);
  if (route) return drawWeek(base);   // v33: «Маршрут по дням» — вся неделя; лента на сегодня — все точки дня, поиск — только в списке для добавления
  let L = base.filter(b => (!shCity || norm(b.c) == norm(shCity)) && (!shT || b.ty == shT) && norm(b.n).includes(q));
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
      <div class="wka"><button class="ghost radd" data-a="radd">${ico(rtAdd ? 'x' : 'plus', 18)} ${rtAdd ? 'Скрыть список' : 'Добавить магазин в ' + WDV[i]}</button>${rtAdd ? `<input id="shq" type="search" placeholder="Найти магазин" value="${esc(shQ)}"><div id="sha"></div>` : ''}</div></div>` }).join('');
  $('#shl').innerHTML = h; if (rtAdd) drawWeekAdd(L);
}
function drawWeekAdd(L = base) { const i = rtDay, q = norm(shQ), cur = L.filter(b => inWeek(b, i));
  const rest = L.filter(b => !cur.includes(b) && canDays(b) && norm(b.n).includes(q)).sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  $('#sha').innerHTML = rest.slice(0, 40).map(b => `<button class="shi" data-a="rpick" data-v="${esc(skey(b))}"><div style="flex:1;min-width:0"><b>${esc(b.n)}</b><div class="m">${esc([b.a, b.c].filter(Boolean).join(' · ') || 'без адреса')}</div></div><span class="pl add">+ добавить</span></button>`).join('')
    + (rest.length > 40 ? `<p class="m" style="margin:0 2px 8px">Показаны первые 40 из ${rest.length}. Уточните поиском.</p>` : '') || '<p class="empty">Подходящих магазинов нет: все уже в этом дне или не подходят под поиск.</p>' }
/* v33. «Все магазины» — вкладки по смыслу и срочность (DECISIONS п. 49). Только на устройстве, по данным, которые уже есть; пороги — те же, что у подсказок (RT.vd, RT.od) */
let shF = 'all';
const SHF = [['all', 'Все'], ['far', 'Давно не были'], ['noord', 'Без заказов'], ['mine', 'Мои'], ['ref', 'Отказались']];
const dAgo = ms => ms ? Math.max(0, Math.floor((dayMs(Date.now()) - dayMs(ms)) / 864e5)) : null;   // дней с даты; null — не было
const shOut = b => b.st == 'ref' || b.st == 'no' || b.st == 'closed';   // не работаем: в общем списке — свёрнуто внизу
function shClass(b) { const dc = dAgo(lastC(b)), dor = dAgo(b.lo), out = shOut(b);
  return { dc, out, far: !out && (dc === null || dc >= RT.vd), noord: !out && (dor === null || dor >= RT.od), mine: !!b.ow && norm(b.ow) == norm(me), ref: b.st == 'ref' } }
const shUrg = (a, b) => { const x = shClass(a).dc, y = shClass(b).dc; return (x === null ? 1e9 : x) == (y === null ? 1e9 : y) ? a.n.localeCompare(b.n, 'ru') : (y === null ? 1e9 : y) - (x === null ? 1e9 : x) };   // сначала без контактов, потом — дольше всего не были
function shRow(b) { const k = shClass(b), urg = k.dc === null || k.dc >= RT.vd;
  const own = b.ow ? (k.mine ? 'вы' : esc(b.ow)) : (CFG.API_URL && srvV >= 31 ? 'свободная' : '');
  const sub = !b.lv && !b.lo ? 'Ни визитов, ни заказов' : [b.lv ? 'Визит ' + ago(b.lv) : '', b.lo ? 'заказ ' + ago(b.lo) : 'заказов не было'].filter(Boolean).join(' · ');
  const tile = k.dc === null ? '<b>нет</b><small>визитов</small>' : k.dc == 0 ? '<b class="sm">сегодня</b>' : `<b>${k.dc}</b><small>дн.</small>`;
  return `<button class="shrow" data-a="scard" data-v="${esc(skey(b))}"><span class="srt"><b>${esc(b.n)}</b><span class="srp">${pillOf(b) || '<span class="pl nt">Без статуса</span>'}${own ? `<span class="m">· ${own}</span>` : ''}</span><span class="m">${[b.ty, b.a].filter(Boolean).map(esc).join(' · ') || esc(b.c || '')}</span><span class="m">${sub}</span></span><span class="sdt${urg ? ' urg' : ''}" aria-label="${k.dc === null ? 'контактов не было' : 'дней с последнего контакта: ' + k.dc}">${tile}</span></button>` }
function drawAll(L) {
  const cnt = {}; SHF.forEach(([f]) => { cnt[f] = f == 'all' ? L.length : L.filter(b => shClass(b)[f]).length });
  if (shF != 'all' && !SHF.some(([f]) => f == shF)) shF = 'all'; if (shF == 'mine' && !cnt.mine) shF = 'all';
  $('#shf').innerHTML = `<div class="chips shfc">${SHF.filter(([f]) => f != 'mine' || cnt.mine).map(([f, t]) => `<button class="chip${shF == f ? ' on' : ''}" data-a="shf" data-v="${f}" aria-pressed="${shF == f}">${t} <em>${cnt[f]}</em></button>`).join('')}</div>
    <div class="shsort m">${ico('down', 16)} По срочности: сначала те, где давно не были</div>`;
  const grp = (t, list) => list.length ? `<h3 class="sub">${t} · ${list.length}</h3><div class="shls">${list.map(shRow).join('')}</div>` : '';
  let h;
  if (shF == 'all') { const live = L.filter(b => !shOut(b)), out = L.filter(shOut).sort(shUrg);
    h = grp('Давно не были', live.filter(b => shClass(b).far).sort(shUrg)) + grp('Были недавно', live.filter(b => !shClass(b).far).sort(shUrg))
      + (out.length ? `<details class="rt shout"><summary>Отказались, не заходить, закрыты · ${out.length}</summary><div class="shls">${out.map(shRow).join('')}</div></details>` : '') }
  else h = grp(SHF.find(([f]) => f == shF)[1], L.filter(b => shClass(b)[shF]).sort(shUrg));
  $('#shl').innerHTML = h || '<p class="empty">Магазинов не найдено</p>';
}
const shopById = v => String(v).startsWith('n:') ? base.find(b => b.n == v.slice(2)) : byId(v);
let cVO = false, cOpen = new Set((Array.isArray(LS('copen')) ? LS('copen') : []).map(String));   // cVO — открыта отметка визита; cOpen — какие разделы карточки раскрыты (запоминается)
const feedSub = x => { const ev = feed(x); return ev === null ? (cLog === false ? 'не загрузилась' : 'загружается…') : ev.length ? 'последнее: ' + ft(ev[0].ts) : 'событий пока нет' };
function shopCard(v) {
  const x = shopById(v) || cSh; if (!x) return shopsView();
  if (cKey != (x.id || x.n)) { cKey = x.id || x.n; cLog = null; cMine = 0; cTot = 0; evF = 'all'; evEd = ''; cErr = ''; cSt = x.st || '-'; cVO = false; loadLog(x) } cSh = x;
  openSheet('shopc', ''); const tdy = inToday(x), wk = WD.filter((d, i) => inWeek(x, i));
  const sec = (id, title, sub, body, ic) => `<details class="sc cs" data-s="${id}"${cOpen.has(id) ? ' open' : ''}><summary>${ic ? ico(ic, 22) : ''}<span class="cst">${title}<small class="m"${id == 'feed' ? ' id="fsub"' : ''}>${sub}</small></span></summary>${body}</details>`;
  const visit = cVO ? `<div class="sum rv" style="margin-top:10px"><b>Результат визита</b><p class="m" style="margin:4px 0 8px">Нажмите результат — визит запишется. Комментарий — по желанию.</p><input id="vn" maxlength="500" placeholder="Комментарий (для «Другое» — обязательно)" style="margin:0 0 10px"><div class="vg vg2">${VO.map((t, i) => `<button data-a="vis" data-v="${i}">${t}</button>`).join('')}</div>
    <details class="mini" style="margin-top:10px"><summary>Визит был раньше — указать дату и время</summary><div class="vdt"><input type="date" id="vd" max="${today()}" value="${today()}" aria-label="Дата визита"><input type="time" id="vt" value="${hhmm(Date.now())}" data-t0="${hhmm(Date.now())}" aria-label="Время визита"></div></details>
    <div class="m" id="myl" style="margin-top:8px">${myLast(x) ? 'Ваш последний визит сюда: ' + ft(myLast(x)) : 'Вы здесь ещё не отмечались'}</div></div>` : '';
  const stBody = `<div class="sg"><button data-a="sst" data-v="-" class="${cSt == '-' ? 'on' : ''}" style="grid-column:1/3">Не были (без статуса)</button>${Object.keys(ST).map(k => `<button data-a="sst" data-v="${k}" class="${cSt == k ? 'on' : ''}">${ST[k][0]}</button>`).join('')}</div>
    <div id="stw" ${cSt == '-' ? 'hidden' : ''}><input id="stn" maxlength="500" placeholder="${stPh(cSt)}" value="${esc(x.nt || '')}" style="margin:10px 0 0"><div class="rsn"${cSt == 'ref' ? '' : ' hidden'}><p class="m" style="margin:8px 0 6px">Причина — по желанию. Частые:</p>${RSN.map(r => `<button data-a="rsn" data-v="${esc(r)}">${esc(r)}</button>`).join('')}<button data-a="rsn" data-v="">Без причины</button></div></div><div class="m" style="margin-top:10px">Действует с (необязательно — если статус был установлен раньше)</div><input type="date" id="sef" max="${today()}" style="margin-top:4px"><button class="send" style="margin-top:10px" data-a="sstsave">Сохранить статус</button>`;
  const plBody = `<div class="pr2"><input type="date" id="pld" min="${today()}" value="${x.pl ? isoDay(x.pl) : today()}" aria-label="Дата визита по плану"><button data-a="plan">${x.pl ? 'Перенести' : 'Запланировать'}</button>${x.pl ? '<button class="ghost2" data-a="planx">Убрать</button>' : ''}</div>
    <input id="fqi" maxlength="500" placeholder="Открытый вопрос / что не забыть" value="${esc(x.fq || '')}" style="margin:10px 0 0"><div class="pr2"><button data-a="fqs">Сохранить вопрос</button>${x.fq ? '<button class="ghost2" data-a="fqx">Решён</button>' : ''}</div>`;
  const ctBody = `<input id="ict" maxlength="100" placeholder="Имя, должность" value="${esc(x.ct || '')}" style="margin:4px 0 8px"><input id="itl" maxlength="40" inputmode="tel" placeholder="Телефон" value="${esc(x.tl || '')}" style="margin:0 0 8px"><input id="irg" maxlength="100" placeholder="Район / ориентир" value="${esc(x.rg || '')}" style="margin:0 0 8px"><input id="iul" maxlength="120" placeholder="Юрлицо: ИП или ТОО (как в документах)" value="${esc(x.ul || '')}" style="margin:0 0 8px"><button class="ghost" style="margin-top:0" data-a="sinfo">${ico('save', 18)} Сохранить контакт</button>`;
  const own0 = CFG.API_URL && srvV >= 31 ? `<span class="pl nt">${x.ow ? (norm(x.ow) == norm(me) ? 'Ваша точка' : 'Ответственный: ' + esc(x.ow)) : 'Точка свободна'}</span>` : '';
  $('#sb').innerHTML = `<div class="shh"><div class="shr"><div class="shk">${esc([x.ty || 'точка', x.c].filter(Boolean).join(' · ').toUpperCase())}</div><button class="ghost shed" data-a="sedit2">${ico('edit', 18)} Изменить</button></div>
    <div class="shn">${esc(x.n)}</div><div class="gom">${esc(x.a || 'без адреса')}</div>${x.ul ? `<div class="shul">${esc(x.ul)}</div>` : ''}
    <div class="shp">${pillOf(x) || '<span class="pl nt">Без статуса</span>'}${own0}${x.pl ? `<span class="pl wait">Визит по плану: ${fd(isoDay(x.pl))}</span>` : ''}</div>
    ${x.sb ? `<div class="m">Статус поставил ${esc(x.sb)}, ${fd(isoDay(x.sa))}</div>` : ''}${x.nt ? `<div class="shnt">${esc(x.nt)}</div>` : ''}</div>
  <div class="sht3" id="sml">${sumTiles(x)}</div>
  ${x.fq ? `<div class="shq"><small>ОТКРЫТЫЙ ВОПРОС</small><b>${esc(x.fq)}</b></div>` : ''}
  <div class="cta"><button class="send alt${cVO ? ' on' : ''}" data-a="cvis">${ico(cVO ? 'x' : 'check', 22)} ${cVO ? 'Закрыть' : 'Визит'}</button><button class="send" data-a="sord" data-v="${esc(x.id || '')}">${ico('bag', 22)} Заявка</button></div>
  ${visit}
  ${x.tl || gq(x) ? `<div class="cta2">${x.tl ? `<a class="ghost" href="tel:${esc(x.tl.replace(/[^\d+]/g, ''))}">${ico('phone', 18)} Позвонить</a>` : ''}${gq(x) ? `<a class="ghost" href="${esc(geoUrl(x))}" target="_blank" rel="noopener">${ico('nav', 18)} Как проехать</a>` : ''}</div>` : ''}
  <div class="scs">
  ${sec('days', 'Дни маршрута', wk.length ? wk.join(', ') : 'не заданы', `<div class="m">${canDays(x) ? 'В эти дни магазин сам попадает в маршрут на сегодня' + (x.ow ? '' : ' (у всех торговых, пока точка свободна)') : 'Точка закреплена за «' + esc(x.ow) + '»: дни меняет он или администратор'}</div><div class="wk" style="margin:8px 0 0">${WD.map((d, i) => `<button data-a="rwd" data-v="${i}" class="${inWeek(x, i) ? 'on' : ''}"${canDays(x) ? '' : ' disabled'}>${d}</button>`).join('')}</div>`, 'cal')}
  ${CFG.API_URL && srvV >= 31 ? sec('own', 'Ответственный', x.ow ? esc(x.ow) + (norm(x.ow) == norm(me) ? ' (вы)' : '') : 'свободная точка', ownBody(x), 'user') : ''}
  ${sec('vat', 'Цены для магазина', vatSub(x), vatBody(x), 'tag')}
  ${sec('ct', 'Контакт и юрлицо', esc([x.ct, x.tl, x.ul].filter(Boolean).join(' · ')) || 'не указаны', ctBody, 'phone')}
  ${sec('geo', 'Место точки', geoTxt(x), geoBody(x), 'pin')}
  ${sec('plan', 'План и вопрос', [x.pl ? 'визит ' + fd(isoDay(x.pl)) : '', x.fq ? 'есть вопрос' : ''].filter(Boolean).join(' · ') || 'не заданы', plBody, 'clock')}
  ${sec('feed', 'Лента событий', feedSub(x), `<div class="m">Заказы, визиты и статусы. Время события и время внесения показаны отдельно, если различаются.</div><div id="feed">${feedHtml(x)}</div>`, 'list')}
  ${sec('st', 'Статус', x.st && ST[x.st] ? ST[x.st][0] : 'не задан', stBody, 'check')}
  </div>
  <button class="ghost" data-a="rtd">${tdy ? ico('x', 18) + ' Не сегодня' : ico('plus', 18) + ' В маршрут на сегодня'}</button>
  <p class="m shc">${tdy ? 'Уберёт точку из маршрута до завтра' : 'Добавит точку в маршрут только на сегодня'}</p>`;
}
const vatSub = x => { const vp = vmOf(x), nm = vatNorm(x); return vp ? ML[vp] + ' (выбрано)' : 'по последней заявке: ' + (nm ? ML[nm.m] : 'заявок пока нет') };
const vatBody = x => { const vp = vmOf(x); return `<div class="seg sg3" style="margin:4px 0 8px">${[['vat', 'С НДС'], ['net', 'Без НДС'], ['', 'По последней заявке']].map(([k, t]) => `<button data-a="svat" data-v="${k}" class="${vp == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  <p class="m" style="margin:0">Если режим заявки будет другим, приложение спросит при отправке. ${CFG.API_URL && srvV >= 31 ? 'Выбор общий для всех торговых.' : 'Выбор хранится только на этом телефоне.'}</p>` };
function ownBody(x) { // v31: ответственный за точку. Свободную берёт любой, свою отдаёт сам, чужую передаёт администратор
  const o = x.ow, mine = !!o && norm(o) == norm(me), adm = role == 'admin';
  let h = `<p class="m" style="margin:0 0 8px">${!o ? 'Свободная точка: в дни маршрута она у всех торговых, дни может менять любой.' : mine ? 'Точка закреплена за вами: она только в вашем маршруте, дни меняете вы (и администратор).' : 'Точка закреплена за «' + esc(o) + '»: она в его маршруте, дни меняет он или администратор. Разово добавить её себе можно кнопкой «В маршрут на сегодня».'}</p>`;
  if (!o) h += `<button class="send" style="margin-top:0" data-a="own" data-v="take">${ico('user', 20)} Беру точку</button>`;
  else if (mine || adm) h += `<button class="ghost" data-a="own" data-v="release">Освободить точку</button>`;
  if (adm) { const t = trs.filter(n => !o || norm(n) != norm(o)); if (t.length) h += `<p class="m" style="margin:12px 0 6px">Передать точку торговому:</p><div class="vg vg2">${t.map(n => `<button data-a="own" data-v="set" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>` }
  return h }
/* v31. Место точки (GPS): только по кнопке или по предложению после визита «прямо сейчас». До 10 секунд уточнения, без отказа; хуже 100 м — вопрос.
   Хранится в таблице: широта, долгота, точность, кто и когда. «Нет» на предложение — запоминается на этом телефоне для этой точки */
let GEO_MS = 1e4, geoNo = new Set((Array.isArray(LS('geono')) ? LS('geono') : []).map(String)), geoBusy = false;
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
  const cur = e.cur, nowS = cur ? (cur.del ? 'сейчас удалена' : '') : '', lab = { order_create: 'Заказ создан', order_edit: 'Заказ изменён', order_cancel: 'Заказ удалён', order_restore: 'Заказ восстановлен' }[e.k] || esc(e.k), can = !!histById(e.oid);
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
function shopNew() {
  openSheet('shopn', 'Новый магазин');
  $('#sb').innerHTML = `<p class="m" style="margin:0 2px 12px">Точка сразу появится у всех торговых. Дни маршрута, контакт и место можно задать потом в её карточке.</p>
  <div class="sum frm"><label><b>Название</b><input id="nn" maxlength="120" placeholder="Например: Магнум №3"></label><label><b>Город</b><select id="nc">${S.cities.map(c => `<option ${c == (shCity || H.c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
  <label><b>Адрес</b><input id="na" maxlength="300" placeholder="Улица, дом"></label><label><b>Тип точки</b><select id="nty">${tyOpts('')}</select></label><label><b>Юрлицо <span class="m">— необязательно</span></b><input id="nul" maxlength="120" placeholder="ИП или ТОО, как в документах"></label></div>
  <button class="send" data-a="shns">${ico('plus', 22)} Создать точку</button>`;
}

/* ============ 8. СОБЫТИЯ ============ */
document.addEventListener('click', async e => {   // async: вопросы (ask) ждут ответа в своём окне
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, p = id && find(id), v = b.dataset.v;
  if (a == 'dlg') { if (dlgDone) dlgDone(+v); return }
  if (/^(nroute|nmain|nmore|hopen)$/.test(a) && view == 'auth' && needLogin()) return;   // без входа разделы не открываются
  if (a == 'nroute') return goHome(); if (a == 'nmain') { closeSheet(); drawList(); return } if (a == 'nmore') return moreView();
  if (a == 'back') { const f = BACK[view]; if (f) f(); else { closeSheet(); drawList() } return }
  if (a == 'rplan') { rtDay = -1; rtAdd = false; rvK = ''; return planView() }
  if (a == 'cvis') { cVO = !cVO; return shopCard(skey(cSh)) }
  if (a == 'cat') { cat = v; drawChips(); drawList() }
  else if (a == 'fav') { fav = isFav(p) ? fav.filter(k => k != id) : [...fav, id]; LS('fav', fav); drawChips(); if (cat == FAV) drawList(); else b.classList.toggle('on', isFav(p)) }
  else if (a == 'm') setQ(p, qty(p) - step(p)); else if (a == 'p') setQ(p, qty(p) + step(p));
  else if (a == 'rm') { const prev = cart[id]; delete cart[id]; save(); bar(); cartView(); drawList(); toast('Изменено: «' + (p ? p.n : 'товар') + '» убран', () => { cart[id] = prev; save(); bar(); drawList(); if (view == 'cart') cartView() }) }
  else if (a == 'splr') { prodP = load(); splash() }   // загрузочный экран: «Повторить» при первом запуске без интернета
  else if (a == 'undo') { const f = toastFn; toastFn = null; $('#toast').className = ''; if (f) f() }
  else if (a == 'mode') setMode(v); else if (a == 'cart') cartView(); else if (a == 'hist') histView(); else if (a == 'set') setView();
  else if (a == 'x') { if (e.target == b || b.classList.contains('grab')) { closeSheet(); drawList() } }
  else if (a == 'zoom') { $('#lb img').src = b.dataset.src; $('#lb').classList.add('on') }
  else if (a == 'lbx') $('#lb').classList.remove('on');
  else if (a == 'edit') { editId = id; cartView() }
  else if (a == 'pdone') { const t = document.querySelector('[data-np]'); if (t && editId) commitNp(t); else { editId = ''; cartView() } }
  else if (a == 'reset') { delete cart[id].p; save(); bar(); cartView() }
  else if (a == 'disc') { disc = +v; save(); bar(); cartView() }
  else if (a == 'new') { const z = snap(); cart = {}; disc = 0; eo = ''; H.t = 0; save(); closeSheet(); drawList(); toast('Изменено: заявка очищена', () => unsnap(z)) }
  else if (a == 'send' || a == 'esave') {                  // правка заявки сохраняется сразу, в WhatsApp не отправляется
    if (CFG.API_URL && (!me || !tok)) { authView('login'); return say('Сначала войдите в свой профиль: заявка записывается от вашего имени.') }
    if (a == 'esave' && !eo) return;
    if (!H.s || !lines().length) return say('Укажите магазин и добавьте товары');
    if (!H.d || H.d < today()) { H.dm = 0; fixDate(); fill(); return say('Дата поставки не может быть в прошлом. Поставлена ближайшая пятница — проверьте и отправьте снова.') }
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
    if (eo) { o.ed = Date.now(); if (old.rg) o.rg = old.rg } else o.rg = Date.now();   // rg — когда заявка записана: от него считается срок правки (сервер это поле не принимает и считает сам)
    if (eo) { commitOrder(o); return toast('Изменение сохранено') }
    LS('pending', o); waOpen(num2, o.text); }
  else if (a == 'eoc') { const z = snap(); eo = ''; cart = {}; disc = 0; clrShop(); save(); fill(); closeSheet(); drawList(); toast('Правка отменена, заявка осталась как была', () => unsnap(z)) }
  else if (a == 'hedit') { const x = histById(v); if (!x || !canEdit(x)) return say('Изменить можно свою заявку в течение ' + CFG.EDIT_HOURS + ' ч после создания. Более старые и чужие заявки правит администратор.');
    if (lines().length && !await ask('Текущая заявка в корзине будет заменена. Продолжить?', 'Заменить')) return;
    if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = JSON.parse(JSON.stringify(x.cart || {})); disc = x.disc || 0; H = { ...x.h, dm: 1, r: x.rc && x.rc.n || '', t: nz(x.ts) }; eo = x.id; msw = ''; save(); fill(); closeSheet(); drawList(); cartView() }
  else if (a == 'clr') { const z = snap(); cart = {}; disc = 0; eo = ''; save(); bar(); drawList(); toast('Изменено: корзина очищена', () => unsnap(z)) }
  else if (a == 'hd') histDetail(v);
  else if (a == 'htab') { histTab = v; LS('htab', v); histView() }
  else if (a == 'hdel') { const x = histById(v); if (x && isMine(x) && await ask('Удалить заявку «' + (x.h.s || '—') + '» на ' + tg(x.sum) + '?\nЕё можно будет вернуть в течение ' + CFG.UNDO_HOURS + ' ч.', 'Удалить', '', true)) { delOrder(v, Date.now()); histView() } }
  else if (a == 'hres') { delOrder(v, 0); histView() }
  else if (a == 'hcopy') { try { navigator.clipboard.writeText(histById(v).text || '').then(() => say('Текст скопирован')) } catch (e) { say('Не удалось скопировать') } }
  else if (a == 'hopen') { histDay = dayMs(Date.now()); histView() }
  else if (a == 'dprev') { histDay = dayMs(histDay - 12 * 36e5); histView() }
  else if (a == 'dnext') { histDay = Math.min(dayMs(histDay + 36 * 36e5), dayMs(Date.now())); histView() }
  else if (a == 'dall') { histDay = 0; histView() } else if (a == 'dtoday') { histDay = dayMs(Date.now()); histView() }
  else if (a == 'dretry') { dayErr = 0; histView() }
  else if (a == 'inst') { if (instEv) { instEv.prompt(); instEv.userChoice.finally(() => { instEv = null; hideInst() }) } else say('Android (Chrome): меню ⋮ → «Установить приложение» или «Добавить на главный экран».\niPhone (Safari): «Поделиться» → «На экран Домой».') }
  else if (a == 'instx') { LS('instx', 1); hideInst() }
  else if (a == 'csv') exportCsv();
  else if (a == 'sedit') { cKey = ''; shopCard(ddL[+v].id || 'n:' + ddL[+v].n); $('#sl').hidden = true }
  else if (a == 'shops') shopsView(); else if (a == 'shm') { shMode = v; shopsView() }
  else if (a == 'scard') { cKey = ''; shopCard(v) } else if (a == 'sedit2') shopEditView(cSh)
  else if (a == 'shn') shopNew()
  else if (a == 'rday') { if (+v == -2) { rtDay = 7; rtAdd = false; return drawShops() } rtDay = +v; rvK = ''; rtAdd = false; if (rtDay >= 0) planView(); else shopsView() }
  else if (a == 'radd') { rtAdd = !rtAdd; drawShops() }
  else if (a == 'rvis') { rvK = rvK == v ? '' : v; if (rtDay < 0) setGo(v); drawShops() }   // v33: отметка визита из ленты — это и есть «еду сюда»
  else if (a == 'rgo') { setGo(v); rvK = ''; rtAdd = false; drawShops(); const sh = document.getElementById('sheet'); if (sh) sh.scrollTop = 0 }   // v33: «Еду сюда»
  else if (a == 'shf') { shF = v; drawShops() }   // v33: вкладки «Все магазины»
  else if (a == 'rgox') { setGo(''); rvK = ''; drawShops() }
  else if (a == 'syn') { CFG.API_URL && !tok ? authView() : sync() }
  else if (a == 'rres') { const x = shopById(rvK), nt = $('#rvn').value.trim(), val = VO[+v]; if (!x || !val) return; if (val == 'Другое' && !nt) return say('Для результата «Другое» напишите комментарий'); rvK = ''; quickVisit(x, val, nt); if (rtDay < 0 && DEFER.includes(val)) setGo(skey(x), true); drawShops() }   // отложили — точка уходит вниз, снова «Куда дальше?»
  else if (a == 'rord') { const x = shopById(v); if (!x) return; selShop(x); closeSheet(); drawList() }
  else if (a == 'rrm') { const x = shopById(v); if (!x) return; setToday(x, false); drawShops(); toast('Изменено: «' + x.n + '» убран из листа на сегодня', () => { setToday(x, true); if (view == 'shops') drawShops() }) }   // убрать из листа на сегодня (v30: кнопка «Не зайду» у отложенной точки; план остаётся — завтра точка в подсказках)
  else if (a == 'rwrm') { const x = shopById(v), i = rtDay; if (!x || i < 0) return; if (!canDays(x)) return daysDeny(x); setWeek(x, i, false); drawShops(); toast('Изменено: «' + x.n + '» убран из маршрута (' + WDF[i] + ')', () => { setWeek(x, i, true); if (view == 'shops') drawShops() }) }
  else if (a == 'rpick') { const x = shopById(v); if (!x) return; if (rtDay >= 0 && !canDays(x)) return daysDeny(x); if (rtDay < 0) setToday(x, true); else setWeek(x, rtDay, true); drawShops() }
  else if (a == 'rwd') { const x = cSh; if (!x) return; if (!canDays(x)) return daysDeny(x); setWeek(x, +v, !inWeek(x, +v)); shopCard(skey(x)) }
  else if (a == 'own') { const x = cSh; if (!x || !x.id || !CFG.API_URL || srvV < 31) return; const act = v == 'take' || v == 'release' || v == 'set' ? v : '', nm = act == 'set' ? String(b.dataset.n || '') : ''; if (!act) return;   // v31: ответственный
    if (act == 'set' && !await ask('Передать точку «' + x.n + '» торговому «' + nm + '»?', 'Передать')) return;
    if (act == 'release' && x.ow && norm(x.ow) != norm(me) && !await ask('Освободить точку «' + x.n + '»? Сейчас она закреплена за «' + x.ow + '».', 'Освободить')) return;
    const prev = x.ow || ''; x.ow = act == 'take' ? me : act == 'release' ? '' : nm; LS('base', base);
    shopq.push({ op: 'owner', id: x.id, n: x.n, c: x.c || '', a: x.a || '', act, name: nm, rid: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); LS('shopq', shopq); sync(); shopCard(skey(x));
    toast(act == 'take' ? 'Точка закреплена за вами' : act == 'release' ? 'Точка свободна' : 'Точка передана: ' + nm); void prev }
  else if (a == 'geo') geoSave(cSh)
  else if (a == 'geodel') geoDel(cSh)
  else if (a == 'stp') { if (['w', 'm', 'y'].includes(v)) { stP = v; LS('stp', v); histView() } }
  else if (a == 'promo') promoView()
  else if (a == 'prm') { if (prBusy || role != 'admin' || !id) return; prBusy = true;
    try { const r = await call({ admin: { op: 'promo', key: id, on: v == '1' } }); if (r && Array.isArray(r.promo)) { promoL = r.promo.map(String); LS('promo', promoL); applyFlags(); drawChips(); toast(v == '1' ? 'Товар продвигается' : 'Отметка снята') } else say('Не сохранилось: ' + (FAILR[r && r.reason] || (r && r.reason) || 'ошибка')) }
    catch (e) { say(e && e.auth ? 'Нужно войти заново.' : 'Нет связи: отметка не сохранена. Попробуйте ещё раз.') } finally { prBusy = false }
    if (view == 'promo') $('#prl').innerHTML = promoList() }
  else if (a == 'rsn') { const e = $('#stn'); e.value = v || ''; document.querySelectorAll('.rsn button').forEach(q => q.classList.toggle('on', q.dataset.v == (v || ''))) }   // v31: причина «Отказались» одним нажатием
  else if (a == 'rtd') { const x = cSh; if (!x) return; const on = !inToday(x); setToday(x, on); shopCard(skey(x)); if (!on) toast('«' + x.n + '» убран из маршрута на сегодня', () => { setToday(x, true); if (view == 'shopc') shopCard(skey(x)) }) }
  else if (a == 'shns') { const n = $('#nn').value.trim().replace(/\s+/g, ' '), c = $('#nc').value, ad = $('#na').value.trim(), ty = $('#nty').value; if (!n) return;
    if (findBase(n, c)) return say('Такой магазин в этом городе уже есть');
    const ul = String($('#nul').value || '').trim().slice(0, 120), o = upShop(n, c, ad); o.ty = ty; if (ul) o.ul = ul; LS('base', base);
    if (CFG.API_URL) { shopq.push({ n, c, a: ad, id: o.id, ty }); if (ul) shopq.push({ op: 'info', id: o.id, n, c, a: ad, ct: '', tl: '', rg: '', ul }); LS('shopq', shopq); sync() } cKey = ''; shopCard(o.id) }   // v33: юрлицо — отдельной операцией после создания
  else if (a == 'sord') { selShop(cSh); closeSheet(); drawList() }
  else if (a == 'sst') { cSt = v; document.querySelectorAll('.sg button').forEach(e => e.classList.toggle('on', e.dataset.v == v)); $('#stw').hidden = v == '-'; $('#stn').placeholder = stPh(v); document.querySelectorAll('.rsn').forEach(e => { e.hidden = v != 'ref' }) }
  else if (a == 'sstsave') { const x = cSh, none = cSt == '-', st = none ? '' : cSt, nt = none ? '' : $('#stn').value.trim(); if (!cSt) return say('Выберите статус');
    if (st == 'no' && !nt) return say('Для статуса «Не заходить» укажите причину в заметке');
    const sef = $('#sef').value, at = !sef || sef == today() ? 0 : tsOf(sef, '12:00'); if (at > Date.now()) return say('Дата «действует с» не может быть в будущем');
    const prev = { st: x.st || '', nt: x.nt || '' }, old = at && at < (x.sa || 0); setShopStatus(x, st, nt, at);
    toast(old ? 'Записано в историю с датой ' + fd(isoDay(at)) + '; текущий статус новее и не изменён' : 'Статус ' + (st ? '«' + ST[st][0] + '»' : 'снят') + (CFG.API_URL ? ' · ожидает отправки' : ''), old ? undefined : () => { setShopStatus(x, prev.st, prev.nt); if (view == 'shopc' && cKey == (x.id || x.n)) { cSt = prev.st || '-'; shopCard(x.id || 'n:' + x.n) } });
    shopCard(x.id || 'n:' + x.n) }
  else if (a == 'sinfo') { const x = cSh; x.ct = $('#ict').value.trim(); x.tl = $('#itl').value.trim(); x.rg = $('#irg').value.trim(); x.ul = String($('#iul').value || '').trim().slice(0, 120); LS('base', base);
    if (CFG.API_URL) { shopq.push({ op: 'info', id: x.id || '', n: x.n, c: x.c, a: x.a, ct: x.ct, tl: x.tl, rg: x.rg, ul: x.ul }); LS('shopq', shopq); sync() } shopCard(x.id || 'n:' + x.n) }
  else if (a == 'vis') { cVO = false; const x = cSh, nt = $('#vn').value.trim(), val = VO[+v], vt = $('#vt'), fresh = $('#vd').value == today() && vt.value == vt.dataset.t0, ts = fresh ? Date.now() : tsOf($('#vd').value, vt.value), my = myLast(x);   // время не трогали — берём момент нажатия
    const er = tsErr(ts); if (er) return say(er); if (val == 'Другое' && !nt) return say('Для результата «Другое» напишите комментарий');
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
  else if (a == 'plan' || a == 'planx' || a == 'fqs' || a == 'fqx') { const x = cSh;
    if (a == 'plan') { const v2 = $('#pld').value; if (!v2 || v2 < today()) return say('Выберите сегодняшнюю или будущую дату'); const [y, m, d] = v2.split('-').map(Number); x.pl = new Date(y, m - 1, d).getTime() }
    else if (a == 'planx') x.pl = 0; else if (a == 'fqs') x.fq = $('#fqi').value.trim(); else x.fq = '';
    saveMeta(x); shopCard(x.id || 'n:' + x.n) }
  else if (a == 'slog') { cLog = null; cErr = ''; shopCard(cSh.id || 'n:' + cSh.n); loadLog(cSh) }
  else if (a == 'ssave') { const n = $('#en').value.trim().replace(/\s+/g, ' '), c = $('#ec').value, ad = $('#ea').value.trim(), ty = $('#ety').value; if (!n) return;
    if (base.some(b => b !== eSh && norm(b.n) == norm(n) && norm(b.c) == norm(c))) return say('Магазин с таким названием в этом городе уже есть');
    const old = eSh.n; eSh.n = n; eSh.c = c; eSh.a = ad; eSh.ty = ty; LS('base', base);
    if (curShop() === eSh || (H.sid && H.sid == eSh.id)) { H.s = n; H.a = ad; H.c = c; cities(); $('#s').value = n; $('#a').value = ad; save() }
    if (CFG.API_URL) { shopq.push({ op: 'edit', id: eSh.id || '', old, n, c, a: ad, ty }); LS('shopq', shopq); sync() } cKey = ''; shopCard(eSh.id || 'n:' + n) }
  else if (a == 'sdel') { if (!await ask('Удалить магазин «' + eSh.n + '» из общей базы? Старые заявки и журнал сохранятся.', 'Удалить', '', true)) return;
    const x = eSh; base = base.filter(b => b !== x); LS('base', base);
    if (H.sid && H.sid == x.id || norm(H.s) == norm(x.n)) { clrShop(); $('#s').value = ''; $('#a').value = ''; save(); shopWarn() }
    if (CFG.API_URL) { shopq.push({ op: 'del', id: x.id || '', old: x.n }); LS('shopq', shopq); sync() } cSh = null; cKey = ''; shopsView() }
  else if (a == 'pick') { selShop(ddL[v]); $('#sl').hidden = true }
  else if (a == 'hfch' || a == 'ochg') { if (view) { closeSheet(); drawList() } hfC = false; drawHf(); if (typeof scrollTo == 'function') scrollTo(0, 0); const s = document.getElementById('s'); if (s && s.focus) try { s.focus() } catch (_) {} }   // v33: «Сменить» — на главном экране и в оформлении
  else if (a == 'hfok') { hfC = true; $('#sl').hidden = true; drawHf() }
  else if (a == 'padd') { const n = $('#s').value.trim().replace(/\s+/g, ' '); if (!n) return; H.s = n; $('#s').value = n; addShop(n); save(); shopWarn(); $('#sl').hidden = true }
  else if (a == 'pyes') { const o = LS('pending'); localStorage.removeItem('pending'); if (!o) return; commitOrder(o); goHome() }   // заявка ушла — обратно к маршруту, к следующей точке
  else if (a == 'pno') { localStorage.removeItem('pending'); closeSheet() }
  else if (a == 'drafts') draftView(); else if (a == 'dsave') draftSave();
  else if (a == 'dopen') { if (lines().length && !await ask('Текущая заявка будет заменена. Продолжить?', 'Заменить')) return;
    const x = drafts.splice(v, 1)[0]; LS('drafts', drafts); if (x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = cleanCart(x.cart); disc = Math.min(100, Math.max(0, nz(x.disc))); eo = ''; msw = ''; H = { ...x.H }; save(); fill(); closeSheet(); drawList(); bar(); draftBadge() }
  else if (a == 'ddel') { drafts.splice(v, 1); LS('drafts', drafts); draftBadge(); draftView() }
  else if (a == 'who') whoView(); else if (a == 'auth') authView('login'); else if (a == 'amode') authView(v == 'invite' ? 'invite' : 'login'); else if (a == 'lgn' || a == 'rdm') doAuth()
  else if (a == 'pwsee') { const show = $('#aup').type == 'password'; ['#aup', '#aup2'].forEach(q => { const el = $(q); if (el) el.type = show ? 'text' : 'password' }); b.innerHTML = ico(show ? 'eyeoff' : 'eye', 22); if (b.setAttribute) b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль') }
  else if (a == 'out') { const n = qN(); if (LS('pending')) return say('Сначала ответьте, отправлена ли последняя заявка: она записана от имени «' + me + '».'); if (n) return say('Выйти пока нельзя: ждут отправки ' + n + ' операц. Они записаны от имени «' + me + '», и под другим профилем сервер их не примет.\nПодключитесь к интернету и дождитесь строки «Синхронизировано» вверху экрана.');
    if (await ask('Выйти из профиля «' + me + '»? Черновики и корзина останутся на устройстве.', 'Выйти')) logout() }
  else if (a == 'adm') { admOw = null; admView(true) }
  else if (a == 'ainv') { if (!await ask('Выдать приглашение для «' + v + '»?' + (b.dataset.s == 'active' ? '\nНынешний пароль этого профиля и все его входы перестанут действовать.' : ''))) return;
    admDo({ op: 'invite', profile: v }).then(r => { if (r) admCode = { profile: String(r.profile), code: String(r.code), until: r.until }; if (view == 'adm') { admView(true).then(() => { document.getElementById('sheet').scrollTop = 0 }) } }) }
  else if (a == 'arev') { if (await ask('Отозвать доступ у «' + v + '»? Войти он не сможет, пока вы не выдадите новое приглашение.', 'Отозвать', '', true)) admDo({ op: 'revoke', profile: v }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'arole') { const r = b.dataset.r == 'admin' ? 'admin' : 'trader'; if (await ask((r == 'admin' ? 'Сделать администратором' : 'Сделать торговым') + ' профиль «' + v + '»? Ему придётся войти заново.')) admDo({ op: 'role', profile: v, role: r }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'aadd') { const n = $('#adn').value.trim().replace(/\s+/g, ' '); if (!n) return; admDo({ op: 'add', name: n }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'adel') { if (await ask('Удалить профиль «' + v + '»?\nВойти под ним больше будет нельзя. Его заявки останутся в таблице под этим именем.', 'Удалить', '', true)) admDo({ op: 'delete', profile: v }).then(() => { if (view == 'adm') admView(true) }) }
  else if (a == 'afix' || a == 'aodry' || a == 'arec') (async () => { const r = await admDo({ op: 'recDry' }), w = r && await admDo({ op: 'ownersDry' });   // одна проверка: связи с магазинами, сводки и заявки без торгового
    if (r) admRec = { apply: false, changes: r.changes, counts: r.counts }; if (w) admOw = w; if (view == 'adm') admView(false) })()
  else if (a == 'arecapply') { if (!await ask('Исправить данные?\nИзменятся листы «Заявки», «Визиты» и «Магазины». Записи, с которыми не всё однозначно, останутся как есть. Отчёт — на листе «Сверка».')) return;
    admDo({ op: 'recApply', confirm: true }).then(r => { if (r) admRec = { apply: true, changes: r.changes, counts: r.counts }; if (view == 'adm') admView(false); if (r) sync() }) }
  else if (a == 'aoapply') { const w = admOw, own = $('#aow').value; if (!w || !nz(w.count)) return; if (!own) return say('Выберите торгового'); if (!$('#aoc').checked) return say('Отметьте, что вы проверили список');
    if (!await ask('Назначить «' + own + '» владельцем ' + nz(w.count) + ' заявок без торгового?\nЭто изменит лист «Заявки». Копия листа будет создана автоматически.')) return;
    admDo({ op: 'ownersApply', owner: own, expect: nz(w.count), confirm: 'НАЗНАЧИТЬ' }).then(r => { if (!r) return; admOw = null; say('Готово. Назначено заявок: ' + nz(r.updated) + '.' + (r.backup ? '\nКопия прежнего состояния: лист «' + r.backup + '».' : '')); if (view == 'adm') admView(false); sync() }) }
  else if (a == 'rep') { const x = histById(v); if (!x) return; if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() } cart = JSON.parse(JSON.stringify(x.cart || {})); disc = x.disc; eo = ''; msw = ''; H = { ...x.h, dm: 0, r: '' }; save(); fill(); closeSheet(); drawList() }
  else if (a == 'uith') { if (TH.some(t => t[0] == v)) setUI('th', v) }
  else if (a == 'uifs') { const n = +v; if ([0, 1, 2].includes(n)) setUI('fs', n) }
  else if (a == 'svat') { if (!cSh) return; const x = cSh, k = skey(x), m = v == 'vat' || v == 'net' ? v : '';
    if (CFG.API_URL && srvV >= 31 && x.id) { x.vm = m; delete VATP[k]; LS('vatp', VATP); LS('base', base); shopq.push({ op: 'vat', id: x.id, n: x.n, c: x.c || '', a: x.a || '', m }); LS('shopq', shopq); sync() }   // v31: в таблицу
    else { if (m) VATP[k] = m; else delete VATP[k]; LS('vatp', VATP) } shopCard(k) }
  else if (a == 'uicv') { if (CV.some(t => t[0] == v)) setUI('cv', v) }
  else if (a == 'cv') setUI('cv', UI.cv == 'list' ? 'grid' : 'list')
  else if (a == 'ss') { S.op = $('#op').value.trim() || CFG.OPERATOR; S.cities = $('#ct').value.split(',').map(s => s.trim()).filter(Boolean); LS('set', S); cities(); closeSheet() }
  else if (a == 'rl') { load(); closeSheet() }
  else if (a == 'bak') exportBackup(); else if (a == 'imp') $('#impf').click()
});
document.addEventListener('change', e => { const t = e.target;
  if (t.dataset.q !== undefined) setQ(find(t.dataset.q), num(t.value));
  else if (t.dataset.np !== undefined) commitNp(t)
  else if (t.id == 'dc') { disc = Math.min(100, num(t.value)); save(); bar(); cartView() }
  else if (t.id == 'rch') { H.r = t.value; save() }
  else if (t.id == 'ots') { const v = t.value ? new Date(t.value).getTime() : 0, o = eo && histById(eo);   // когда заявка сделана: не в будущем и не старше года
    if (!v) H.t = o ? nz(o.ts) : 0; else if (v > Date.now() + 6e4) say('Дату заявки нельзя поставить в будущее.'); else if (v < Date.now() - 365 * 864e5) say('Слишком давняя дата.'); else H.t = v; save(); cartView() }
  else if (t.id == 'cd') { if (!t.value || t.value < today()) { H.dm = 0; fixDate(); say('Прошедшую дату выбрать нельзя. Поставлена ближайшая пятница.') } else { H.d = t.value; H.dm = 1 } save(); fill(); cartView() }
  else if (t.id == 'htr') { hTr = t.value; histView() }
  else if (t.id == 'tys') { cSh.ty = t.value; saveMeta(cSh) }
  else if (t.id == 'sht') { shT = t.value; shopsView() }
  else if (/^rt(p|v|o|q|vd|od)$/.test(t.id)) { const k = { rtp: 'plan', rtv: 'visit', rto: 'order', rtq: 'q', rtvd: 'vd', rtod: 'od' }[t.id]; RT[k] = t.type == 'checkbox' ? t.checked : Math.max(1, Math.min(365, +t.value || RT0[k])); LS('rt', RT); drawShops() }
  else if (t.id == 'shc') { shCity = t.value; shopsView() } else if (t.id == 'shs') { shSt = t.value; shopsView() }
  else if (t.id == 'impf') importBackup(t.files[0]); });
document.addEventListener('toggle', e => { const d = e.target; if (!d || !d.matches || !d.matches('details.cs') || !d.dataset || !d.dataset.s) return;   // v30: раскрытые разделы карточки запоминаются (раньше сворачивались при любом нажатии внутри)
  if (d.open) cOpen.add(d.dataset.s); else cOpen.delete(d.dataset.s); LS('copen', [...cOpen]) }, true);
document.addEventListener('input', e => { if (e.target.id == 'shq') { shQ = e.target.value; if (view == 'rplan') drawWeekAdd(); else drawShops() } else if (e.target.id == 'prq') { prQ = e.target.value; $('#prl').innerHTML = promoList() } });
$('#q').oninput = e => { Q = e.target.value.toLowerCase(); drawList() };
['d', 's', 'a'].forEach(k => $('#' + k).addEventListener('change', e => { H[k] = e.target.value;
  if (k == 'd') { if (!H.d || H.d < today()) { H.dm = 0; fixDate(); $('#d').value = H.d; say('Прошедшую дату выбрать нельзя. Поставлена ближайшая пятница.') } else H.dm = 1 }
  if (k == 's') { // название магазина приводим к записи из общей базы (сначала тот же город), подставляем город, адрес и ID
    const v = H.s.trim().replace(/\s+/g, ' '), b = findBase(v, H.c) || base.find(x => norm(x.n) == norm(v)); H.s = b ? b.n : v; $('#s').value = H.s; H.sid = b ? b.id || '' : ''; if (P.length) { drawChips(); drawList() }
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
function splHide() { const el = $('#splash'); if (el.hidden) return; setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true }, 260) }, Math.max(0, 800 - (Date.now() - SPL0))) }
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
