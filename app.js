/* ============ 1. НАСТРОЙКИ (меняйте только здесь) ============ */
const CFG = {
  SHEET_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGyNVUyAyeZVoafaazZmZEQbtmmcyqXV5AJBYxhq1_4SELUbFuujtEr9XHfp9XCLktXud9Sc2Czmf_/pub?gid=928244906&single=true&output=csv',                 // ← ссылка на опубликованный CSV Google Таблицы (см. README.md)
  OPERATOR: '77474331973',       // запасной номер WhatsApp (если лист «Получатели» пуст): код страны + номер, без + и пробелов
  CITIES: ['Петропавловск', 'Астана', 'Костанай'],
  PRICE_MODE: 'vat',             // режим цен по умолчанию: 'vat' — с НДС, 'net' — без НДС
  SHOW_VAT_LABEL: true,          // пометка «(с НДС)» / «(без НДС)» в последней строке заявки; false — убрать
  API_URL: 'https://script.google.com/macros/s/AKfycbzXofkvdmGY2lXE5ZeBuU0GLGrXcBDRx1L_UPLA3VAFO5o1qG2cy3WwjEQQQGGm49OV/exec',                   // ссылка на веб-приложение Apps Script (см. README); пусто = без общей базы
  UNDO_HOURS: 24,                // сколько часов удалённую заявку можно вернуть
  EDIT_HOURS: 24,                // сколько часов после создания заявку можно изменить
  API_KEY: '3puq8z64'       // тот же ключ, что KEY в Code.gs
};
// Колонки таблицы: категория | название | граммовка | цена без НДС | цена с НДС | единица (шт/кг/кор) | фото
const DEMO = [['Финики','Финики FINDI caramel','150г','1704','1976','шт',''],['Мармелад','Кубик Манго','200г','500','600','шт',''],
  ['Орехи','Грецкий орех','1кг','4200','4872','кг','']];

/* ============ 2. ХЕЛПЕРЫ И СОСТОЯНИЕ ============ */
/* Версия сборки: должна совпадать с <meta name="ver"> в index.html. Если файлы на хостинге разных версий — покажем красную плашку. */
const VER = '25';
const NEED = 25;   // нужная версия Code.gs на сервере
{ const m = document.querySelector('meta[name=ver]');
  if (!m || m.content != VER) document.body.insertAdjacentHTML('afterbegin', '<div style="background:#C82B27;color:#fff;padding:12px;font-weight:800">Файлы сайта разных версий. Загрузите ВСЕ файлы из архива заново (index.html, styles.css, app.js, sw.js) и обновите страницу дважды.</div>') }
const IC = { folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>', send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M9.5 20v-5h5v5"/>', star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>', phone: '<path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-3z"/>' };
const ico = (n, s = 18) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;   // линейные иконки вместо эмодзи
{ const q = (k, h) => { const e = document.querySelector(k); if (e) e.innerHTML = h };
  q('.top [data-a=hopen]', ico('clock', 21)); q('.top [data-a=shops]', ico('store', 21)); q('.top [data-a=set]', ico('sliders', 21)); q('#drb', ico('folder', 21)); q('#clr', ico('trash', 20)); q('.si', ico('search', 18)) }
const ghost = new Proxy(function () {}, { get: (t, k) => k == Symbol.toPrimitive ? () => '' : ghost, set: () => true, apply: () => ghost });   // заглушка вместо отсутствующего элемента — страница не падает целиком
const $ = s => document.querySelector(s) || ghost;
const LS = (k, v) => { if (v !== undefined) return localStorage.setItem(k, JSON.stringify(v)); try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } };   // битые сохранённые данные не должны ронять приложение
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const num = v => parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0; // «1 500 ₸» → 1500
const qf = n => String(+n.toFixed(2));
const fd = d => d ? +d.slice(8) + '.' + +d.slice(5, 7) : '';           // 2026-10-09 → 9.10
// Дата поставки: по умолчанию ближайшая пятница (фирма возит по пятницам); если сегодня пятница — следующая. Прошлые даты запрещены.
const nextFri = () => { const k = (5 - new Date().getDay() + 7) % 7 || 7; return new Date(Date.now() + k * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) };
const fixDate = () => { if (!H.d || H.d < today() || !H.dm) { H.d = nextFri(); H.dm = 0 } };   // dm=1 — дату выбрали вручную
let P = [], cart = LS('cart') || {}, disc = LS('disc') || 0, H = LS('hdr') || { d: today() },
    S = LS('set') || { op: CFG.OPERATOR, cities: CFG.CITIES }, cat = 'Все', Q = '', view = '', editId = '';
S.mode = S.mode || CFG.PRICE_MODE;
if (!Array.isArray(S.cities) || !S.cities.length) S.cities = CFG.CITIES; S.op = S.op || CFG.OPERATOR;   // защита от данных старых версий
if (typeof H != 'object' || Array.isArray(H)) H = { d: today() }; fixDate(); if (typeof cart != 'object' || Array.isArray(cart)) cart = {};
let me = LS('me') || '', trs = LS('trs') || [], rcp = LS('rcp') || [], fav = LS('fav') || [], eo = LS('eo') || '', visq = LS('visq') || [], base = LS('base') || [], shist = LS('shist') || [], outbox = LS('outbox') || [], drafts = LS('drafts') || [], shopq = LS('shopq') || [], delq = LS('delq') || [], delok = LS('delok') || [];   // delok — удаления, принятые сервером, но ещё не подтверждённые выгрузкой
// Миграция: заявки из старых версий без номера (id) получают его, иначе их нельзя удалить или повторить
(() => { const h = LS('hist'); if (!Array.isArray(h)) return; let ch = false;
  h.forEach((x, i) => { if (x && !x.id) { x.id = 'old' + (x.ts || 0).toString(36) + i + Math.random().toString(36).slice(2, 5); ch = true } }); if (ch) LS('hist', h) })();
// Выбор дня в истории: histDay — начало выбранного дня (0 — все дни); dayC — старые дни, подгруженные по запросу (только в памяти)
const dayMs = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() };
const isoDay = ms => { const d = new Date(ms), z = k => String(k).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) };
let histDay = dayMs(Date.now()), dayC = {}, dayBusy = 0, dayErr = 0;
const winFrom = mine => dayMs(Date.now() - (mine ? 29 : 6) * 864e5);   // с какого дня заявки уже загружены: свои — 30 дней, чужие — 7 дней
const needDay = (d, mine) => !!(CFG.API_URL && d && d < winFrom(mine) && !(dayC[d] && Date.now() - dayC[d].t < 12e4));
async function loadDay(d) { const r = await api(`${CFG.API_URL}?action=range&key=${encodeURIComponent(CFG.API_KEY)}&trader=${encodeURIComponent(me)}&from=${d}&to=${d + 864e5}&undo=${CFG.UNDO_HOURS}`); dayC[d] = { t: Date.now(), hist: r.hist || [] } }
const plZ = n => n % 10 == 1 && n % 100 != 11 ? 'заявка' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'заявки' : 'заявок';
const setDel = (id, ts) => Object.values(dayC).forEach(c => c.hist.forEach(x => { if (x.id == id) x.del = ts }));   // пометка удаления и в подгруженных днях
// История = серверная + локальная (ещё не синхронизированная), без дублей
const allHist = () => { // история = серверная + локальная; у каждой заявки есть del (время удаления, 0 — не удалена)
  const sm = new Map(shist.map(x => [x.id, x])), m = new Map();
  [...shist, ...Object.values(dayC).flatMap(c => c.hist), ...(LS('hist') || [])].forEach(x => m.set(x.id || x.sum + x.h.s + x.h.d, x));
  return [...m.values()].map(x => { const q = [...delq].reverse().find(o => o.id == x.id) || delok.find(o => o.id == x.id), sv = sm.get(x.id);
    return { ...x, del: q ? q.del : sv ? (sv.del || 0) : (x.del || 0) } }).sort((a, b) => (b.ts || 0) - (a.ts || 0));
};
let hTr = '';   // фильтр «Все заявки» по торговому ('' — все)
const canEdit = x => isMine(x) && !x.del && Date.now() - (x.ts || 0) < CFG.EDIT_HOURS * 36e5;   // править свою заявку можно в течение суток после создания
let histTab = LS('htab') || 'mine';   // вкладка истории: 'mine' — мои, 'all' — все торговые
const isMine = x => !x.trader || x.trader == me;
const histById = id => allHist().find(x => x.id == id);
function delOrder(id, ts) { // ts — время удаления; 0 — вернуть заявку
  const h = LS('hist') || []; h.forEach(x => { if (x.id == id) x.del = ts }); LS('hist', h); setDel(id, ts);
  if (CFG.API_URL) { delq = delq.filter(o => o.id != id); delq.push({ id, del: ts, trader: me }); LS('delq', delq); sync() }
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
const icon = c => { c = c.toLowerCase(); return c.includes('фин') ? '🌴' : c.includes('орех') ? '🥜' : c.includes('сух') ? '🍑' : /комп|напит/.test(c) ? '🥤' : /шоколад|драже/.test(c) ? '🍫' : c.includes('пастил') ? '🍥' : c.includes('ассорти') ? '🎁' : c.includes('чурч') ? '🍇' : '🍬' };
const save = () => { LS('cart', cart); LS('disc', disc); LS('hdr', H); LS('eo', eo) };

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
  const m = { c: f(/катег/), n: f(/назв/), g: f(/грам|фасов/), u: f(/един/), f: f(/фото/), h: f(/ходов/), pn: -1, pv: -1 };
  h.forEach((x, i) => { if (/ндс/.test(x)) { if (/без/.test(x)) m.pn = i; else m.pv = i } else if (/^цена/.test(x) && m.pn < 0) m.pn = i });
  return m.n < 0 || (m.pn < 0 && m.pv < 0) ? { c: 0, n: 1, g: 2, pn: 3, pv: 4, u: 5, f: 6 } : m;
}
const toProducts = rows => { const m = colMap(rows), v = (r, i) => i >= 0 ? String(r[i] || '') : ''; hasVat = m.pv >= 0;
  return rows.slice(1).filter(r => v(r, m.n).trim() && (num(v(r, m.pn)) > 0 || num(v(r, m.pv)) > 0)).map(r =>
    ({ c: v(r, m.c).trim() || 'Прочее', n: v(r, m.n).trim(), g: v(r, m.g).trim(), pn: num(v(r, m.pn)), pv: num(v(r, m.pv)), pr: 0, u: v(r, m.u).trim() || 'шт', f: photo(v(r, m.f)), hot: /^(да|yes|y|1|\+|x|true)$/i.test(v(r, m.h).trim()) })) };
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
  P = toProducts(rows || LS('prod2') || [[], ...DEMO]); applyMode(); drawChips(); drawList(); bar(); note(err, !CFG.SHEET_CSV, P.filter(p => !p.pn || !p.pv).map(p => p.n));
}
function note(err, demo, miss = []) { // плашка статуса прайса
  let n = $('#note'); if (!n) { n = document.createElement('div'); n.id = 'note'; n.style.cssText = 'margin:6px 12px;padding:10px 14px;border-radius:14px;font-weight:800;font-size:14px'; $('#list').before(n) }
  const msg = err ? 'Прайс не загружен: ' + err : demo ? 'Показаны демо-товары: в app.js не указана ссылка на таблицу'
    : !hasVat ? 'В таблице нет колонки «Цена (с НДС)»: режим «С НДС» не работает. Добавьте колонку и нажмите «Настройки» → «Обновить прайс»'
    : miss.length ? `Не заполнена цена (с НДС или без) у ${miss.length} тов.: ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}` : '';
  n.hidden = !msg; n.style.background = err ? '#fde0de' : '#fff3c4'; n.style.color = err ? '#C82B27' : '#6b5200'; n.textContent = msg;
}

/* ============ 4. КАТАЛОГ ============ */
const FAV = '★ Мои', HOT = 'Ходовые', isFav = p => fav.includes(pid(p));
function drawChips() {
  const sp = [FAV, ...(P.some(p => p.hot) ? [HOT] : [])];   // «★ Мои» и «Ходовые» — первыми
  $('#chips').innerHTML = ['Все', ...sp, ...new Set(P.map(p => p.c))].map(c =>
    `<button class="chip${c == cat ? ' on' : ''}${sp.includes(c) ? ' sp' : ''}" data-a="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('');
}
const ctl = p => { const id = esc(pid(p)), q = qty(p); if (!p.pr) return `<button class="add" disabled>Нет цены ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}</button>`;   // кнопка «В заявку» или степпер
  return q ? `<div class="st"><button data-a="m" data-id="${id}">−</button><input data-q="${id}" inputmode="decimal" value="${qf(q)}"><button data-a="p" data-id="${id}">+</button></div>`
           : `<button class="add" data-a="p" data-id="${id}">${ico('plus', 18)} В заявку</button>`; };
function drawList() {
  const l = P.filter(p => (cat == 'Все' || (cat == FAV ? isFav(p) : cat == HOT ? p.hot : p.c == cat)) && p.n.toLowerCase().includes(Q)), el = $('#list');
  el.innerHTML = l.map((p, i) => `<article class="pc" style="--i:${Math.min(i, 8)}"><button class="fv${isFav(p) ? ' on' : ''}" data-a="fav" data-id="${esc(pid(p))}" aria-label="В избранное">${ico('star', 18)}</button>${p.hot ? '<span class="hot">Ходовой</span>' : ''}<button class="ph" data-a="zoom" data-src="${esc(p.f || 'logo.jpg')}"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" loading="lazy" alt="">${p.g ? `<span class="tag">${esc(p.g)}</span>` : ''}</button><div class="pb"><b>${esc(p.n)}</b><span class="pr">${p.pr ? p.pr + ' ₸' : '—'} <small>/ ${p.u}</small></span><div class="ctl" data-c="${esc(pid(p))}">${ctl(p)}</div></div></article>`).join('') || `<p class="empty">${cat == FAV ? 'Нажмите ★ на карточке товара — он появится здесь' : 'Ничего не найдено'}</p>`;
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
  $('#bn').innerHTML = ico('cart', 20) + '<span>' + n + ' поз.</span>'; $('#bs').textContent = final() + ' ₸';
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
  toastFn = undo || null; el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-a="undo">Отменить</button>' : ''}`; el.className = 'on';
  clearTimeout(toastT); toastT = setTimeout(() => { el.className = ''; toastFn = null }, undo ? 7000 : 3000);
}
const snap = () => ({ cart: JSON.stringify(cart), disc, eo, H: JSON.stringify(H) });   // снимок заявки для отмены
function unsnap(z) { cart = JSON.parse(z.cart); disc = z.disc; eo = z.eo; H = JSON.parse(z.H); save(); fill(); bar(); drawList(); if (view == 'cart') cartView() }

/* ============ 6. ШТОРКА: корзина, история, настройки ============ */
function openSheet(v, title) { view = v; $('#st').textContent = title; document.body.classList.add('sh'); bar(); }
function closeSheet() { view = ''; editId = ''; document.body.classList.remove('sh'); bar(); }
function drawRc() { // выбор получателя в шапке — такой же селектор, как город; автоподбор по городу, можно сменить
  const el = $('#rch'); if (!rcp.length) { el.hidden = true; return } const c = rcPick(); el.hidden = false;
  el.innerHTML = rcp.map(r => `<option value="${esc(r.n)}">Кому: ${esc(r.n)}</option>`).join(''); el.value = c.n }
function rcPick() { // получатель: выбранный вручную, иначе подходящий по городу (приоритет: город указан → по умолчанию), иначе запасной номер из настроек
  if (!rcp.length) return { n: '', p: S.op, c: [] };
  const x = H.r && rcp.find(r => r.n == H.r); if (x) return x;
  const c = norm(H.c), sc = r => (r.c.length ? (r.c.some(k => norm(k) == c) ? 2 : -9) : 0) + (r.d ? 1 : 0), L = rcp.map(r => [sc(r), r]).sort((a, b) => b[0] - a[0]);
  return L[0][1];
}
const rcBlock = () => `<p class="m" style="margin:12px 2px 0">Получатель: <b>${esc(rcPick().n || 'запасной номер')}</b> · меняется на главном экране, под адресом</p>`;
function cartView() {
  if (view != 'cart') openSheet('cart', 'Ваша заявка');
  const L = lines();
  if (!L.length) { $('#sb').innerHTML = '<p class="empty">Корзина пуста. Добавьте товары из каталога.</p>'; return }
  const dBlock = `<div class="sum" style="margin-bottom:10px"><b>Дата поставки</b><input type="date" id="cd" min="${today()}" value="${esc(H.d || '')}" style="margin:6px 0 0"></div>`;
  const eoo = eo && histById(eo), banner = eo ? `<div class="sw bad" style="margin-bottom:10px">Правка заявки «${esc(eoo ? eoo.h.s : '')}»${eoo ? ' от ' + ft(eoo.ts) : ''}. Старая версия будет заменена.<button class="ghost" style="margin-top:8px;padding:8px" data-a="eoc">Отменить правку</button></div>` : '';
  $('#sb').innerHTML = banner + dBlock + L.map(p => { const id = esc(pid(p)), n = price(p), ch = n != p.pr;
    const pe = editId == pid(p) ? `<input class="np" data-np="${id}" inputmode="decimal" value="${n}">`
      : `<button class="pe${ch ? ' ch' : ''}" data-a="edit" data-id="${id}">${ch ? `<s>${p.pr}</s>` : ''}${n} ₸ ${ico('edit', 14)}</button>`;
    return `<div class="it"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" alt=""><div><b>${esc(p.n)}</b> <span class="m">${esc(p.g)}</span><div style="margin-top:6px">${pe}${ch ? ` <button class="pe" data-a="reset" data-id="${id}">${ico('undo', 14)}</button>` : ''}</div></div><button class="x" data-a="rm" data-id="${id}" aria-label="Убрать">${ico('x', 16)}</button><div class="st" style="grid-column:1/4">${`<button data-a="m" data-id="${id}">−</button><input data-q="${id}" inputmode="decimal" value="${qf(qty(p))}"><button data-a="p" data-id="${id}">+</button>`}<b style="margin-left:auto">${Math.round(n * qty(p))} ₸</b></div></div>`; }).join('') +
  `<div class="sum"><div class="m">Цены: ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}</div><b>Скидка на весь чек</b><div class="dc">${[0, 3, 5, 10].map(x => `<button data-a="disc" data-v="${x}" class="${disc == x ? 'on' : ''}">${x ? x + '%' : 'Нет'}</button>`).join('')}<input id="dc" inputmode="decimal" placeholder="свой %" value="${[0, 3, 5, 10].includes(disc) ? '' : disc}"></div>
  <div class="r"><span>Сумма</span><b>${total()} ₸</b></div>${disc > 0 ? `<div class="r"><span>Скидка ${disc}%</span><b>−${total() - final()} ₸</b></div>` : ''}<div class="r t"><span>Итого</span><span>${final()} ₸</span></div></div>
  ${rcBlock()}<button class="send" data-a="send">${ico('send', 20)} ${eo ? 'Отправить изменение в WhatsApp' : 'Отправить в WhatsApp'}</button><button class="ghost" data-a="dsave">${ico('save', 18)} Сохранить как черновик</button><button class="ghost" data-a="new">Новая заявка</button>`;
  const np = document.querySelector('[data-np]'); if (np) np.select();
}
const ft = ts => ts ? new Date(ts).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
function histView() { // вкладки «Мои» / «Все заявки»; ниже — «Недавно удалённые» (только свои)
  openSheet('hist', 'История заявок'); const now = Date.now(), win = CFG.UNDO_HOURS * 36e5, mine = histTab == 'mine';
  if (needDay(histDay, mine) && !dayBusy && dayErr != histDay) { const d = histDay; dayBusy = d;   // выбранный день старше загруженного окна — запрашиваем его у сервера
    loadDay(d).then(() => { if (dayErr == d) dayErr = 0 }).catch(() => { dayErr = d }).finally(() => { dayBusy = 0; if (view == 'hist') histView() }) }
  const all = allHist(), inDay = x => !histDay || dayMs(x.ts || 0) == histDay, loading = needDay(histDay, mine) && dayErr != histDay, failed = needDay(histDay, mine) && dayErr == histDay;
  const inT = x => mine || !hTr || x.trader == hTr, act = all.filter(x => !x.del && (!mine || isMine(x)) && inDay(x) && inT(x)), trash = mine ? all.filter(x => x.del && now - x.del < win && isMine(x)) : [];
  const left = x => { const m = Math.max(1, Math.round((win - (now - x.del)) / 6e4)); return m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин' : m + ' мин' };
  const nMine = all.filter(x => !x.del && isMine(x) && inDay(x)).length, nAll = all.filter(x => !x.del && inDay(x) && (!hTr || x.trader == hTr)).length;
  const names = [...new Set([...trs, ...all.map(x => x.trader)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), trSel = CFG.API_URL && !mine ? `<select id="htr" style="margin-bottom:10px"><option value="">Все торговые</option>${names.map(n => `<option ${n == hTr ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';
  const tabs = CFG.API_URL ? `<div class="seg" style="margin-bottom:12px">${[['mine', 'Мои (' + nMine + ')'], ['all', 'Все заявки (' + nAll + ')']].map(([k, t]) => `<button data-a="htab" data-v="${k}" class="${histTab == k ? 'on' : ''}">${t}</button>`).join('')}</div>` : '';
  const sumAll = act.reduce((a, x) => a + (+x.sum || 0), 0), stats = loading ? 'Загружаю…' : failed ? '—' : act.length + ' ' + plZ(act.length) + ' · ' + sumAll + ' ₸', t0 = dayMs(Date.now());
  const lbl = d => { const ds = new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', ''); return d == t0 ? 'Сегодня · ' + ds : d == dayMs(Date.now() - 864e5) ? 'Вчера · ' + ds : new Date(d).toLocaleDateString('ru', { weekday: 'short' }) + ', ' + ds };
  const plate = histDay
    ? `<div class="day"><div class="dn"><button class="dnb" data-a="dprev" aria-label="Предыдущий день">${ico('back', 18)}</button><label class="dl"><span>${lbl(histDay)}</span><input type="date" id="dp" value="${isoDay(histDay)}" max="${isoDay(t0)}" aria-label="Выбрать день"></label><button class="dnb" data-a="dnext" ${histDay >= t0 ? 'disabled' : ''} aria-label="Следующий день"><span class="fl">${ico('back', 18)}</span></button></div><div class="ds">${stats}</div><button class="dall" data-a="dall">Все дни</button></div>`
    : `<div class="day"><div class="dn"><span class="dl2">Все дни</span></div><div class="ds">${stats}</div><button class="dall" data-a="dtoday">Выбрать день</button></div>${CFG.API_URL ? `<p class="m" style="margin:-4px 2px 10px">Показаны заявки за последние ${mine ? 30 : 7} дн. Более ранние — через «Выбрать день».</p>` : ''}`;
  const emptyMsg = loading ? '<p class="empty">Загружаю заявки за этот день…</p>' : failed ? '<p class="empty">Нет связи: этот день не загружен.<br><button data-a="dretry" style="margin-top:12px;padding:12px 18px">Повторить</button></p>' : histDay ? '<p class="empty">За этот день заявок нет</p>' : '<p class="empty">Заявок пока нет</p>';
  $('#sb').innerHTML = tabs + trSel + plate + (act.map(x => `<div class="hi"><div data-a="hd" data-v="${esc(x.id)}" style="flex:1"><b>${esc(x.h.s || '—')} ›</b>${!mine || !isMine(x) ? `<div class="m who">${ico('user', 13)} ${esc(x.trader || '—')}</div>` : ''}<div class="m">Создана: ${ft(x.ts)}${x.ed ? ' · изменена ' + ft(x.ed) : ''}</div><div class="m">Поставка на: ${fd(x.h.d)} · ${esc(x.h.c || '')}</div><b style="color:var(--r)">${x.sum} ₸</b><span class="m">${CFG.API_URL && outbox.some(y => y.id == x.id) ? ' · не передано в базу' : ''}</span></div><div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end"><button data-a="rep" data-v="${esc(x.id)}" style="padding:12px 14px">Повторить</button><div style="display:flex;gap:6px">${canEdit(x) ? `<button class="x" style="color:var(--gd);border-color:var(--line)" data-a="hedit" data-v="${esc(x.id)}" aria-label="Изменить заявку">${ico('edit', 18)}</button>` : ''}${isMine(x) ? `<button class="x" data-a="hdel" data-v="${esc(x.id)}" aria-label="Удалить заявку">${ico('trash', 18)}</button>` : ''}</div></div></div>`).join('') || emptyMsg)
  + (trash.length ? `<h3 style="margin:18px 0 8px;color:var(--gd)">Недавно удалённые</h3>` + trash.map(x => `<div class="hi" style="opacity:.8"><div style="flex:1"><b>${esc(x.h.s || '—')}</b><div class="m">${ft(x.ts)} · ${x.sum} ₸</div><div class="m">Можно вернуть ещё ${left(x)}</div></div><button data-a="hres" data-v="${esc(x.id)}" style="padding:12px 14px">Вернуть</button></div>`).join('') : '');
}
function histDetail(id) { // полная карточка заявки
  const x = histById(id); if (!x) return; openSheet('hd', 'Заявка'); const R = (k, v) => `<div class="r"><span class="m">${k}</span><b>${v}</b></div>`;
  const rows = x.items ? x.items.map(t => `<div class="r"><span>${esc(t.n)}${t.g ? ' (' + esc(t.g) + ')' : ''}<br><span class="m">${qf(t.q)}${esc(t.u)} × ${t.o != t.p ? `<s>${t.o}</s> ` : ''}${t.p} ₸</span></span><b>${Math.round(t.p * t.q)} ₸</b></div>`).join('')
    : `<pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(x.text || '')}</pre>`;
  $('#sb').innerHTML = `<div class="sum">${R('Магазин', esc(x.h.s || '—'))}${R('Город', esc(x.h.c || '—'))}${R('Адрес', esc(x.h.a || '—'))}${R('Торговый', esc(x.trader || '—'))}${x.rc && x.rc.n ? R('Получатель', esc(x.rc.n)) : ''}${R('Создана', ft(x.ts))}${x.ed ? R('Изменена', ft(x.ed)) : ''}${R('Поставка на', fd(x.h.d))}${R('Цены', x.m == 'vat' ? 'с НДС' : 'без НДС')}${x.disc ? R('Скидка', x.disc + '%') : ''}</div>
  <div class="sum" style="margin-top:10px"><b>Товары</b>${rows}<div class="r t"><span>Итого</span><span>${x.sum} ₸</span></div></div>
  ${canEdit(x) ? `<button class="send" style="background:var(--g);box-shadow:none" data-a="hedit" data-v="${esc(x.id)}">${ico('edit', 20)} Изменить заявку <span class="m" style="color:#F3E3B5">(ещё ${Math.max(1, Math.round((CFG.EDIT_HOURS * 36e5 - (Date.now() - x.ts)) / 36e5))} ч)</span></button>` : ''}<button class="${canEdit(x) ? 'ghost' : 'send'}" data-a="rep" data-v="${esc(x.id)}">Повторить заявку</button><button class="ghost" data-a="hcopy" data-v="${esc(x.id)}">Скопировать текст</button><button class="ghost" data-a="hist">${ico('back', 18)} К списку</button>${isMine(x) ? `<button class="ghost" style="color:var(--r);border-color:var(--r)" data-a="hdel" data-v="${esc(x.id)}">${ico('trash', 18)} Удалить заявку</button>` : ''}`;
}
function setView() {
  openSheet('set', 'Настройки');
  const rl = rcp.length ? rcp.map(r => esc(r.n) + (r.c.length ? ' (' + esc(r.c.join(', ')) + ')' : '') + (r.d ? ' ★' : '') + ' · ' + esc(r.p)).join('<br>') + '<br><span class="m">Список ведётся на листе «Получатели» таблицы и общий для всех. Выбирается получатель на главном экране.</span>' : CFG.API_URL ? 'Список пуст: заполните лист «Получатели» (имя, телефон, города, по умолчанию). Пока заявки уходят на запасной номер.' : 'Общая база не подключена — заявки уходят на запасной номер.';
  $('#sb').innerHTML = `${CFG.API_URL ? `<button class="ghost" style="margin:0 0 10px" data-a="who">${ico('user', 18)} Профиль: ${esc(me || '—')} · сменить</button>` : ''}
  <details class="sc" open><summary>Оформление</summary><b>Города (через запятую)</b><input id="ct" value="${esc(S.cities.join(', '))}"><button class="ghost" data-a="rl">Обновить прайс</button>${standalone ? '' : `<button class="ghost" data-a="inst">${ico('plus', 18)} Установить на главный экран</button>`}</details>
  <details class="sc"><summary>Заявки</summary><p class="m" style="margin:0 0 4px">Свою заявку можно изменить в течение ${CFG.EDIT_HOURS} ч и удалить с возможностью вернуть в течение ${CFG.UNDO_HOURS} ч — в «Истории».</p><button class="ghost" data-a="csv">${ico('save', 18)} Экспорт истории (CSV)</button></details>
  <details class="sc"><summary>Получатели</summary><p class="m" style="margin:0 0 8px;line-height:1.5">${rl}</p>
    <details class="mini"><summary>Запасной номер WhatsApp</summary><input id="op" inputmode="tel" value="${esc(S.op)}" placeholder="77001234567"><p class="m" style="margin:0">Используется, только если лист «Получатели» пуст. Код страны и номер, без + и пробелов.</p></details></details>
  <details class="sc"><summary>Данные</summary><p class="m" style="margin:0 0 4px">Черновики, избранное и неотправленное хранятся на этом устройстве. Файл поможет перенести их на новый телефон или на другой адрес сайта.</p><button class="ghost" data-a="bak">${ico('down', 18)} Сохранить данные устройства (файл)</button><button class="ghost" data-a="imp">${ico('up', 18)} Загрузить данные из файла</button><input type="file" id="impf" accept=".json,application/json" hidden></details>
  <details class="sc"><summary>Служебная информация</summary><div class="m" style="font-size:13px;line-height:1.5">Версия: ${VER}${CFG.API_URL ? ' · Code.gs: ' + (srvV || 'не определена') + (srvV && srvV < NEED ? ' (устарел!)' : '') : ''} · адрес: ${esc(location.origin)}<br>Товаров: ${P.length} (с ценой с НДС: ${P.filter(p => p.pv).length}, без НДС: ${P.filter(p => p.pn).length})<br>Режим цен: ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}<br>${CFG.API_URL ? `База: ${syncErr ? 'ошибка: ' + esc(lastErr) : 'подключена'} · торговых в списке: ${trs.length} · профиль: ${esc(me || 'не выбран')}<br>Ждут отправки: заявок ${outbox.length}, правок магазинов ${shopq.length}, визитов ${visq.length}` : 'База заявок не подключена (API_URL пуст)'}</div></details>
  <button class="send" style="background:var(--g);box-shadow:none" data-a="ss">Сохранить</button>`;
}

/* ============ 6б. РЕЖИМ ЦЕН (с НДС / без НДС) ============ */
function drawSeg() { $('#seg').innerHTML = [['vat', 'С НДС'], ['net', 'Без НДС']].map(([k, t]) => `<button data-a="mode" data-v="${k}" class="${S.mode == k ? 'on' : ''}">${t}</button>`).join('') }
function setMode(m) {
  if (m == S.mode) return;
  if (Object.values(cart).some(x => x.p != null) && !confirm('Ручные цены в заявке будут сброшены. Переключить режим?')) return;
  S.mode = m; LS('set', S); Object.values(cart).forEach(x => delete x.p); applyMode();
  const gone = P.filter(p => qty(p) > 0 && !p.pr); gone.forEach(p => delete cart[pid(p)]);   // позиции без цены в новом режиме убираем
  save(); drawSeg(); drawList(); bar(); if (view == 'cart') cartView();
  if (gone.length) alert('Убраны из заявки (нет цены в этом режиме): ' + gone.map(p => p.n).join(', '));
}

/* ============ 7. ШАПКА ЗАЯВКИ ============ */
function cities() {
  if (H.c && !S.cities.includes(H.c)) { S.cities.push(H.c); LS('set', S) }
  $('#c').innerHTML = S.cities.map(c => `<option>${esc(c)}</option>`).join('') + '<option value="+">＋ Другой город…</option>';
  $('#c').value = H.c || S.cities[0]; H.c = $('#c').value; drawRc();
}
const shops = () => { if (!$('#sl').hidden) drawDD() };   // обновить открытый список магазинов
function fill() { fixDate(); $('#d').min = today(); $('#d').value = H.d; $('#s').value = H.s || ''; $('#a').value = H.a || ''; cities(); shopWarn() }
const clrShop = () => { H.s = ''; H.a = ''; H.sid = ''; H.r = '' };   // после заявки/черновика: магазин и получатель выбираются заново
const curShop = () => (H.sid && base.find(b => b.id == H.sid)) || (H.s && (base.find(b => norm(b.n) == norm(H.s) && (!H.c || !b.c || norm(b.c) == norm(H.c))) || null)) || null;
function shopWarn() { // плашка под полем магазина: статус, причина, кто и когда отметил (предупреждение, а не запрет)
  const x = curShop(), el = $('#sw'); if (!x || !x.st || !ST[x.st] || x.st == 'neu') { el.hidden = true; return }
  const bad = x.st == 'no' || x.st == 'closed'; el.hidden = false; el.className = 'sw full ' + (bad ? 'bad' : 'ok');
  el.textContent = (bad ? '⚠ ' : '') + ST[x.st][0] + (x.nt ? ': ' + x.nt : '') + (x.sb ? ' · ' + x.sb + (x.sa ? ', ' + fd(isoDay(x.sa)) : '') : '');
}

/* ============ 7б. СИНХРОНИЗАЦИЯ, ПОДТВЕРЖДЕНИЕ, ЧЕРНОВИКИ, ПРОФИЛЬ ============ */
let syncWarn = false, syncing = false, again = false, syncErr = false, syncAt = '', lastErr = '', srvV = LS('srv') || 0;   // srvV — версия Code.gs на сервере
async function api(url, opt) { // запрос к Apps Script с понятным текстом ошибки
  let r, t; try { r = await fetch(url, opt); t = await r.text() } catch (e) { throw new Error('браузер не смог связаться со скриптом (интернет, VPN, блокировщик или неверный API_URL)') }
  let d; try { d = JSON.parse(t) } catch (e) { throw new Error('скрипт вернул не данные, а страницу (HTTP ' + r.status + '): проверьте развёртывание — доступ «Все», выполнять от имени «Я», ссылка заканчивается на /exec') }
  if (d.error == 'key') throw new Error('ключ не совпадает: KEY в Code.gs и API_KEY в app.js должны быть одинаковыми');
  if (d.error) throw new Error('скрипт вернул ошибку: ' + d.error);
  return d;
}
function syncStatus() { // строка статуса под названием в шапке
  const n = outbox.length + shopq.length + delq.length + visq.length, el = $('#sy'); if (!CFG.API_URL) return;
  el.textContent = srvV && srvV < NEED ? 'Обновите Code.gs до версии ' + NEED + ' (нажмите)' : syncWarn ? 'Сервер не сохранил удаление — обновите Code.gs (нажмите)' : syncing ? 'Синхронизация…' : syncErr ? 'Нет связи с базой' + (n ? ' · ждут: ' + n : '') + ' (нажмите)' : n ? 'Ждут отправки: ' + n : 'Синхронизировано ' + syncAt + (me ? ' · ' + me : '');
}
async function sync() { // отправляет накопленные заявки и правки магазинов, затем подтягивает торговых, магазины и историю
  if (!CFG.API_URL) return;
  if (syncing) { again = true; return }                 // уже идёт — повторим после
  if (!navigator.onLine) { syncErr = true; syncStatus(); return }
  syncing = true; syncStatus();
  try {
    const new23 = x => x.op == 'status' || x.op == 'info' || x.op == 'meta';   // эти операции понимает только Code.gs v23+
    for (const x of [...shopq]) { // правки магазинов — строго по порядку; при ошибке останавливаемся
      if (new23(x) && srvV < NEED) continue;
      const r = await api(CFG.API_URL, { method: 'POST', body: JSON.stringify({ key: CFG.API_KEY, shop: x }) });
      if (!r.ok) throw new Error('скрипт не принял правку магазина'); shopq = shopq.filter(y => y !== x); LS('shopq', shopq);
    }
    for (const v of [...visq]) { // визиты
      if (srvV < NEED) break;
      const r = await api(CFG.API_URL, { method: 'POST', body: JSON.stringify(v.cancel ? { key: CFG.API_KEY, visitCancel: v } : { key: CFG.API_KEY, visit: v }) });
      if (!r.ok) throw new Error('скрипт не принял визит'); visq = visq.filter(y => y !== v); LS('visq', visq);
    }
    for (const o of [...outbox]) {
      const r = await api(CFG.API_URL, { method: 'POST', body: JSON.stringify({ key: CFG.API_KEY, order: o }) });
      if (!r.ok) throw new Error('скрипт не принял заявку'); outbox = outbox.filter(x => x.id != o.id); LS('outbox', outbox);
      if (r.applied === false) { const h = LS('hist') || []; h.forEach(x => { if (x.id == o.id && o.ed) x.ed = 0 }); LS('hist', h);   // сервер отклонил правку (срок вышел или чужая заявка)
        alert(r.reason == 'too_late' ? 'Правка заявки «' + (o.h.s || '') + '» не принята: прошло больше ' + CFG.EDIT_HOURS + ' ч.' : 'Правка заявки «' + (o.h.s || '') + '» не принята сервером (' + (r.reason || '—') + ').') }
    }
    for (const o of [...delq]) { // удаления и возвраты заявок — после самих заявок
      const r = await api(CFG.API_URL, { method: 'POST', body: JSON.stringify({ key: CFG.API_KEY, orderOp: o }) });
      if (!r.ok) throw new Error('скрипт не принял удаление заявки'); delq = delq.filter(x => x !== o); LS('delq', delq);
      if (r.applied === false && r.reason == 'not_owner') { // сервер отказал: заявка принадлежит другому профилю — возвращаем её в список и объясняем
        const h = LS('hist') || []; h.forEach(x => { if (x.id == o.id) x.del = 0 }); LS('hist', h); setDel(o.id, 0);
        alert('Эту заявку нельзя удалить: она создана профилем «' + (r.owner || '—') + '».'); if (view == 'hist') histView(); continue }
      if (r.applied !== false) { delok.push({ id: o.id, del: o.del, t: Date.now() }); LS('delok', delok) }   // запоминаем, пока выгрузка не подтвердит
    }
    const d = await api(`${CFG.API_URL}?action=init&key=${encodeURIComponent(CFG.API_KEY)}&trader=${encodeURIComponent(me)}&undo=${CFG.UNDO_HOURS}`);
    trs = d.traders; srvV = d.srv || 0; LS('srv', srvV); if (Array.isArray(d.rcp)) { rcp = d.rcp; LS('rcp', rcp); drawRc() }
    if (!shopq.length && !visq.length) { const m = new Map(base.map(b => [b.id, b])); base = d.shops.map(x => { const o = m.get(x.id); return o ? Object.assign(o, x) : x }) }   // объекты магазинов сохраняем (на них ссылаются открытая карточка и кнопки «Отменить»)   // пока есть неотправленные правки, локальную базу не затираем
    if (srvV >= NEED && (shopq.some(new23) || visq.length)) again = true;   // версия сервера стала известна — досылаем отметки
    syncWarn = false; delok = delok.filter(o => { const sv = d.hist.find(x => x.id == o.id); if (!sv) return false;   // подтверждение удаления / возврата выгрузкой
      if (!!sv.del == !!o.del) return false; syncWarn = true; return Date.now() - o.t < 6e5 });                      // не совпало: сервер не применил — предупреждаем, пока не истёк срок
    LS('delok', delok); shist = d.hist; LS('trs', trs); LS('base', base); LS('shist', shist); shops();
    syncErr = false; lastErr = ''; syncAt = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { syncErr = true; lastErr = e && e.message || 'неизвестная ошибка' }
  syncing = false; syncStatus(); if (view == 'who') whoView(); if (view == 'hist') histView();   // окно выбора профиля обновляется по готовности данных
  if (again) { again = false; return sync() }
}

function checkPending() { // после возврата из WhatsApp спрашиваем, ушла ли заявка
  const o = LS('pending'); if (!o || view == 'pend') return; openSheet('pend', 'Заявка отправлена?');
  $('#sb').innerHTML = `<div class="sum"><b>${esc(o.h.s)}</b><div class="m">${esc(o.h.c || '')} · ${o.sum} ₸</div></div><button class="send" data-a="pyes">${ico('check', 20)} Да, отправил</button><button class="ghost" data-a="pno">Нет, вернуться к заявке</button>`;
}
const draftBadge = () => $('#drb').innerHTML = ico('folder', 21) + (drafts.length ? '<em class="bdg">' + drafts.length + '</em>' : '');
function draftSave() { // черновик хранит всё состояние заявки; корзина очищается для следующего магазина
  if (!lines().length) return alert('Заявка пуста');
  drafts.unshift({ H: { ...H }, cart: JSON.parse(JSON.stringify(cart)), disc, m: S.mode, n: lines().length, sum: final(), t: Date.now() }); LS('drafts', drafts);
  cart = {}; disc = 0; eo = ''; clrShop(); save(); fill(); closeSheet(); drawList(); bar(); draftBadge();
}
function draftView() {
  openSheet('dr', 'Черновики');
  $('#sb').innerHTML = drafts.map((x, i) => `<div class="hi"><div><b>${esc(x.H.s || 'Без названия')}</b><div class="m">${x.n} поз. · ${new Date(x.t).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</div><b style="color:var(--r)">${x.sum} ₸</b></div><div><button data-a="dopen" data-v="${i}" style="padding:12px 14px">Открыть</button> <button class="x" data-a="ddel" data-v="${i}" aria-label="Удалить">${ico('x', 16)}</button></div></div>`).join('') || '<p class="empty">Черновиков нет</p>';
}
function whoView() {
  openSheet('who', 'Кто вы?');
  $('#sb').innerHTML = trs.map(n => `<button class="send" style="background:var(--g);box-shadow:none;margin:0 0 8px" data-a="me" data-v="${esc(n)}">${esc(n)}</button>`).join('') || `<p class="empty">${syncing ? 'Загрузка списка…' : syncErr ? 'Список не загрузился: ' + esc(lastErr) : 'Список пуст: впишите имена на лист «Торговые» (колонка A, под заголовком «Имя»).'}</p><button class="ghost" data-a="who2">Обновить</button>`;
}

/* ============ 7в. МАГАЗИНЫ: список, статусы, контакты, визиты, «кого навестить» ============ */
const norm = t => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const ST = { reg: ['Постоянный клиент', '#1E8449'], good: ['Хороший контакт', '#2E7D5B'], prom: ['Перспективный', '#A9801F'], neu: ['Нейтральный', '#7C7A69'], hard: ['Сложный', '#C0662B'], no: ['Не заходить', '#9B2C26'], closed: ['Закрыт', '#4A4A4A'] };
const VO = ['Взяли заказ', 'Заказа нет', 'Никого не было', 'Закрыто', 'Зайти позже'];   // итог визита
const newSid = () => 's' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
const ago = ms => { if (!ms) return 'не было'; const d = Math.floor((dayMs(Date.now()) - dayMs(ms)) / 864e5); return d <= 0 ? 'сегодня' : d == 1 ? 'вчера' : d + ' дн. назад' };
const lastC = x => Math.max(x.lv || 0, x.lo || 0);   // последний контакт: визит или заказ
const pill = c => c && ST[c] ? `<span class="pl" style="background:${ST[c][1]}">${ST[c][0]}</span>` : '';
const pillOf = b => b.st ? pill(b.st) : lastC(b) ? '' : '<span class="pl" style="background:#9a9680">Не были</span>';   // нет статуса и ни визитов, ни заказов — «Не были»
const byId = id => id && base.find(b => b.id == id);
const sameCity = (b, c) => !c || !b.c || norm(b.c) == norm(c);
const findBase = (n, c) => base.find(b => norm(b.n) == norm(n) && sameCity(b, c)) || null;
let cMine = 0, cErr = '', cKey = '', ddL = [], eSh = null, cSh = null, cLog = null, shMode = 'all', shSt = '', shCity = null, shQ = '', cSt = '';
function shopEditView(x) { // правка названия, города, адреса / удаление магазина в общей базе
  eSh = x; $('#sl').hidden = true; openSheet('shop', 'Магазин');
  $('#sb').innerHTML = `<div class="sum"><b>Название</b><input id="en" value="${esc(x.n)}"><b>Город</b><select id="ec">${[...new Set([...S.cities, x.c].filter(Boolean))].map(c => `<option ${c == x.c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><b>Адрес</b><input id="ea" value="${esc(x.a)}"><b>Тип точки</b><select id="ety">${tyOpts(x.ty)}</select></div><button class="send" style="background:var(--g);box-shadow:none" data-a="ssave">Сохранить</button><button class="ghost" data-a="scard" data-v="${esc(x.id || '')}">${ico('back', 18)} Назад</button><button class="ghost" style="color:var(--r);border-color:var(--r)" data-a="sdel">Удалить магазин</button>`;
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
function selShop(x) { H.s = x.n; H.a = x.a || ''; H.sid = x.id || ''; if (x.c) { H.c = x.c; H.r = ''; cities() } $('#s').value = H.s; $('#a').value = H.a; save(); shopWarn() }
// --- раздел «Магазины»: «Все магазины» — справочник, «Кого посетить» — рабочий список на день по управляемым правилам ---
const TY = ['магазин', 'минимаркет', 'супермаркет'];   // тип торговой точки
const RT0 = { plan: true, visit: true, vd: 14, order: true, od: 30, q: true };
let RT = { ...RT0, ...(LS('rt') || {}) }, shT = '';
const tyOpts = cur => `<option value="">Не указан</option>${TY.map(t => `<option ${t == cur ? 'selected' : ''}>${t}</option>`).join('')}`;
function dueInfo(b) { // почему магазин попал в список визитов и насколько это срочно; null — не попадает
  const t0 = dayMs(Date.now()), D = 864e5, tags = []; let sc = 0;
  const done = b.lv && dayMs(b.lv) == t0, planned = RT.plan && b.pl && b.pl <= t0 + D - 1;
  if (planned) { const d = Math.round((t0 - dayMs(b.pl)) / D); tags.push(d > 0 ? 'План: был ' + fd(isoDay(b.pl)) : 'План: сегодня'); sc += 1000 + d }
  if ((b.st == 'no' || b.st == 'closed') && !planned) return null;   // «не заходить» и «закрыт» не предлагаем, если визит не запланирован вручную
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
function shopsView() {
  openSheet('shops', 'Магазины'); if (shCity === null) shCity = H.c || '';
  const cs = [...new Set([...S.cities, ...base.map(b => b.c)].filter(Boolean))], route = shMode == 'route';
  $('#sb').innerHTML = `<div class="seg" style="margin-bottom:10px">${[['all', 'Все магазины'], ['route', 'Кого посетить']].map(([k, t]) => `<button data-a="shm" data-v="${k}" class="${shMode == k ? 'on' : ''}">${t}</button>`).join('')}</div>
  ${route ? `<p class="m" style="margin:0 2px 8px">Рабочий список на день: сюда попадают только магазины, которым нужен визит по выбранным ниже правилам. Решаете вы: правила можно менять, а любой магазин — запланировать вручную в его карточке.</p>
  <details class="rt"><summary>Что попадает в список</summary>
    <label><input type="checkbox" id="rtp" ${RT.plan ? 'checked' : ''}><span>Запланированные на сегодня (и просроченные)</span></label>
    <label><input type="checkbox" id="rtv" ${RT.visit ? 'checked' : ''}><span>Давно не было визита или заказа — более <input type="number" id="rtvd" min="1" max="365" value="${RT.vd}" class="nn"> дн.</span></label>
    <label><input type="checkbox" id="rto" ${RT.order ? 'checked' : ''}><span>Давно не было заказов — более <input type="number" id="rtod" min="1" max="365" value="${RT.od}" class="nn"> дн.</span></label>
    <label><input type="checkbox" id="rtq" ${RT.q ? 'checked' : ''}><span>Есть открытый вопрос или заметка</span></label>
    <p class="m" style="margin:6px 0 0">Статусы «Не заходить» и «Закрыт» не предлагаются (кроме вручную запланированных). Магазин с визитом, отмеченным сегодня, из списка уходит.</p></details>` : ''}
  <div class="sfl"><select id="shc"><option value="">Все города</option>${cs.map(c => `<option ${c == shCity ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><select id="sht"><option value="">Любой тип</option>${TY.map(t => `<option ${t == shT ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
  ${route ? '' : `<div class="sfl"><select id="shs"><option value="">Любой статус</option><option value="none" ${shSt == 'none' ? 'selected' : ''}>Не были / без статуса</option>${Object.keys(ST).map(k => `<option value="${k}" ${k == shSt ? 'selected' : ''}>${ST[k][0]}</option>`).join('')}</select></div>`}
  <input id="shq" placeholder="Найти магазин" value="${esc(shQ)}" style="margin-bottom:10px"><div id="shl"></div><button class="ghost" data-a="shn">${ico('plus', 18)} Новый магазин</button>`;
  drawShops();
}
function drawShops() {
  const route = shMode == 'route', q = norm(shQ); let L = base.filter(b => (!shCity || norm(b.c) == norm(shCity)) && (!shT || b.ty == shT) && norm(b.n).includes(q)), head = '';
  if (route) { const t0 = dayMs(Date.now()), doneN = L.filter(b => b.lv && dayMs(b.lv) == t0).length;
    L = L.map(b => ({ b, d: dueInfo(b) })).filter(x => x.d).sort((x, y) => y.d.sc - x.d.sc || x.b.n.localeCompare(y.b.n, 'ru'));
    head = `<div class="m" style="margin:0 2px 8px"><b>К посещению: ${L.length}</b>${doneN ? ' · сегодня отмечено визитов: ' + doneN : ''}</div>`;
    $('#shl').innerHTML = head + (L.map(({ b, d }) => `<button class="shi" data-a="scard" data-v="${esc(b.id || 'n:' + b.n)}"><div style="flex:1;min-width:0"><b>${esc(b.n)}</b><div class="m">${esc([b.ty, b.c, b.a].filter(Boolean).join(' · '))}</div><div class="tg">${d.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>${b.st ? pill(b.st) : ''}</button>`).join('') || '<p class="empty">По выбранным правилам визитов не требуется. Измените правила или запланируйте визит в карточке магазина.</p>'); return }
  if (shSt) L = L.filter(b => shSt == 'none' ? !b.st : b.st == shSt); L = L.sort((a, b) => a.n.localeCompare(b.n, 'ru'));
  $('#shl').innerHTML = L.map(b => `<button class="shi" data-a="scard" data-v="${esc(b.id || 'n:' + b.n)}"><div style="flex:1;min-width:0"><b>${esc(b.n)}</b><div class="m">${esc([b.ty, b.c, b.a].filter(Boolean).join(' · '))}</div><div class="m">Контакт: ${ago(lastC(b))}${b.lo ? ' · заказ ' + ago(b.lo) : ''}</div></div>${pillOf(b)}</button>`).join('') || '<p class="empty">Магазинов не найдено</p>';
}
const shopById = v => String(v).startsWith('n:') ? base.find(b => b.n == v.slice(2)) : byId(v);
function shopCard(v) {
  const x = shopById(v) || cSh; if (!x) return shopsView();
  if (cKey != (x.id || x.n)) { cKey = x.id || x.n; cLog = null; cMine = 0; cErr = ''; cSt = x.st || '-'; loadLog(x) } cSh = x;
  openSheet('shopc', x.n); const log = cLog;
  const ch = (k, t, cls) => `<button data-a="${k}" ${cls ? 'class="' + cls + '"' : ''}`;
  $('#sb').innerHTML = `<div class="sum"><div class="m">${esc([x.ty, x.c, x.a].filter(Boolean).join(' · ') || 'без адреса')}</div>${x.fq ? `<div class="sw bad" style="margin-top:8px">Открытый вопрос: ${esc(x.fq)}</div>` : ''}${x.pl ? `<div class="sw ok" style="margin-top:8px">Визит запланирован на ${fd(isoDay(x.pl))}</div>` : ''}
    <div style="margin-top:6px">${pillOf(x) || '<span class="m">Без статуса</span>'}${x.sb ? `<span class="m"> · ${esc(x.sb)}, ${fd(isoDay(x.sa))}</span>` : ''}</div>${x.nt ? `<div style="margin-top:6px">${esc(x.nt)}</div>` : ''}
    <div class="m" style="margin-top:6px">Последний заказ: ${ago(x.lo)} · визит: ${ago(x.lv)}${x.lb ? ' (' + esc(x.lb) + (x.lw ? ', ' + esc(x.lw) : '') + ')' : ''}</div></div>
  <button class="send" data-a="sord" data-v="${esc(x.id || '')}">${ico('cart', 20)} Создать заявку</button>
  <div class="sum" style="margin-top:12px"><b>План и вопросы</b><div class="m" style="margin-top:4px">Попадают в список «Кого посетить»</div>
    <div class="pr2"><input type="date" id="pld" min="${today()}" value="${x.pl ? isoDay(x.pl) : today()}"><button data-a="plan">${x.pl ? 'Перенести' : 'Запланировать'}</button>${x.pl ? '<button class="ghost2" data-a="planx">Убрать</button>' : ''}</div>
    <input id="fqi" placeholder="Открытый вопрос / что не забыть" value="${esc(x.fq || '')}" style="margin:10px 0 0"><div class="pr2"><button data-a="fqs">Сохранить вопрос</button>${x.fq ? '<button class="ghost2" data-a="fqx">Решён</button>' : ''}</div>
    <b style="display:block;margin-top:12px">Тип точки</b><select id="tys" style="margin:6px 0 0">${tyOpts(x.ty)}</select></div>
  <div class="sum" style="margin-top:12px"><b>Отметить визит</b><input id="vn" placeholder="Заметка к визиту (необязательно)" style="margin:8px 0"><div class="vg">${VO.map((t, i) => `<button data-a="vis" data-v="${i}">${t}</button>`).join('')}</div>
    <div class="m" style="margin-top:8px">${myLast(x) ? 'Ваш последний визит сюда: ' + ft(myLast(x)) : 'Вы здесь ещё не отмечались'}</div>${myLast(x) ? '<button class="ghost" style="margin-top:6px" data-a="vcan">Отменить мою последнюю отметку визита</button>' : ''}</div>
  <div class="sum" style="margin-top:12px"><b>Статус</b><div class="sg"><button data-a="sst" data-v="-" class="${cSt == '-' ? 'on' : ''}" style="--c:#7C7A69;grid-column:1/3">Не были (без статуса)</button>${Object.keys(ST).map(k => `<button data-a="sst" data-v="${k}" class="${cSt == k ? 'on' : ''}" style="--c:${ST[k][1]}">${ST[k][0]}</button>`).join('')}</div>
    <div id="stw" ${cSt == '-' ? 'hidden' : ''}><input id="stn" placeholder="Заметка${cSt == 'no' ? ' (причина — обязательно)' : ''}" value="${esc(x.nt || '')}" style="margin:10px 0 0"></div><button class="send" style="background:var(--g);box-shadow:none;margin-top:10px" data-a="sstsave">Сохранить статус</button></div>
  <div class="sum" style="margin-top:12px"><b>Контакт покупателя</b> <span class="m">(необязательно)</span><input id="ict" placeholder="Имя, должность" value="${esc(x.ct || '')}" style="margin:8px 0"><input id="itl" inputmode="tel" placeholder="Телефон" value="${esc(x.tl || '')}" style="margin:0 0 8px"><input id="irg" placeholder="Район / ориентир" value="${esc(x.rg || '')}" style="margin:0 0 8px">
    <button class="ghost" style="margin-top:0" data-a="sinfo">${ico('save', 18)} Сохранить контакт</button>${x.tl ? `<a class="ghost" style="text-decoration:none" href="tel:${esc(x.tl.replace(/[^\d+]/g, ''))}">${ico('phone', 18)} Позвонить</a>` : ''}</div>
  <div class="sum" style="margin-top:12px"><b>Журнал отметок</b><div class="m">Кто и когда ставил статус и отмечал визиты в этом магазине</div>${log === null ? '<div class="m" style="margin-top:6px">Загружаю…</div>' : log === false ? `<div class="m" style="margin-top:6px">Журнал не загрузился: ${esc(cErr)}.${/не смог связаться/.test(cErr) ? ' Если заявки и магазины при этом работают, значит, скрипт упал именно на этом запросе. Обновите Code.gs до версии ' + NEED + ' (после этого ошибка скрипта будет показана текстом); точную причину видно в Apps Script → «Выполнения».' : /action|key|не данные/.test(cErr) ? ' Скорее всего, Code.gs не обновлён до версии ' + NEED + ': в Apps Script нужно «Развернуть → Управление развёртываниями → ✏️ → Новая версия».' : ''}</div><button class="ghost" data-a="slog">Повторить</button>` : log.length ? log.map(l => `<div class="r" style="display:block;padding:6px 0;border-top:1px solid var(--line)"><span class="m">${ft(l.ts)} · ${esc(l.who || '—')}</span><div>${l.kind == 'status' ? (l.val ? 'Статус: ' + esc((ST[l.val] || [l.val])[0]) : 'Статус снят (не были)') : 'Визит: ' + esc(l.val)}${l.nt ? ' — ' + esc(l.nt) : ''}</div></div>`).join('') : '<div class="m" style="margin-top:6px">Отметок пока нет</div>'}</div>
  <button class="ghost" data-a="sedit2">${ico('edit', 18)} Изменить название / город / адрес</button><button class="ghost" data-a="shops">${ico('back', 18)} К списку</button>`;
}
async function loadLog(x) {
  const k = x.id || x.n, redraw = () => { if (cKey == k && view == 'shopc') shopCard(x.id || 'n:' + x.n) };
  if (!CFG.API_URL) { cLog = false; cErr = 'общая база не подключена'; return }
  if (!navigator.onLine) { cLog = false; cErr = 'нет интернета'; return }
  try { const r = await api(`${CFG.API_URL}?action=visits&key=${encodeURIComponent(CFG.API_KEY)}&sid=${encodeURIComponent(x.id || '')}&name=${encodeURIComponent(x.n)}&me=${encodeURIComponent(me)}&limit=15`); if (cKey == k) { cLog = r.log || []; cMine = +r.mine || 0; redraw() } }
  catch (e) { if (cKey == k) { cLog = false; cErr = e.message || 'ошибка'; redraw() } }
}
const myLast = x => Math.max(cMine || 0, x.lw == me ? x.lv || 0 : 0);   // когда этот профиль последний раз отмечал визит в магазине
function saveMeta(x) { LS('base', base); if (CFG.API_URL) { shopq.push({ op: 'meta', id: x.id || '', n: x.n, c: x.c, a: x.a, ty: x.ty || '', pl: x.pl || 0, fq: x.fq || '' }); LS('shopq', shopq); sync() } }
function setShopStatus(x, st, nt) { // статус магазина: локально сразу, на сервер через очередь; прежние отметки остаются в журнале
  const at = Date.now(); x.st = st; x.nt = nt; x.sb = me; x.sa = at; LS('base', base); logLocal(x, 'status', st, nt); shopWarn();
  if (CFG.API_URL) { shopq.push({ op: 'status', id: x.id || '', n: x.n, c: x.c, a: x.a, st, nt, by: me, at, rid: 'r' + at.toString(36) + Math.random().toString(36).slice(2, 6) }); LS('shopq', shopq); sync() } }
const logLocal = (x, kind, val, nt) => { if (Array.isArray(cLog)) cLog.unshift({ ts: Date.now(), who: me, kind, val, nt }) };
function shopNew() {
  openSheet('shopn', 'Новый магазин');
  $('#sb').innerHTML = `<div class="sum"><b>Название</b><input id="nn" placeholder="Например: Магнум №3"><b>Город</b><select id="nc">${S.cities.map(c => `<option ${c == (shCity || H.c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><b>Адрес</b><input id="na"><b>Тип точки</b><select id="nty">${tyOpts('')}</select></div><button class="send" style="background:var(--g);box-shadow:none" data-a="shns">Создать</button><button class="ghost" data-a="shops">${ico('back', 18)} К списку</button>`;
}

/* ============ 8. СОБЫТИЯ ============ */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, p = id && find(id), v = b.dataset.v;
  if (a == 'cat') { cat = v; drawChips(); drawList() }
  else if (a == 'fav') { fav = isFav(p) ? fav.filter(k => k != id) : [...fav, id]; LS('fav', fav); drawChips(); if (cat == FAV) drawList(); else b.classList.toggle('on', isFav(p)) }
  else if (a == 'm') setQ(p, qty(p) - step(p)); else if (a == 'p') setQ(p, qty(p) + step(p));
  else if (a == 'rm') { const prev = cart[id]; delete cart[id]; save(); bar(); cartView(); drawList(); toast('Изменено: «' + (p ? p.n : 'товар') + '» убран', () => { cart[id] = prev; save(); bar(); drawList(); if (view == 'cart') cartView() }) }
  else if (a == 'undo') { const f = toastFn; toastFn = null; $('#toast').className = ''; if (f) f() }
  else if (a == 'mode') setMode(v); else if (a == 'cart') cartView(); else if (a == 'hist') histView(); else if (a == 'set') setView();
  else if (a == 'x') { if (e.target == b || b.classList.contains('grab')) { closeSheet(); drawList() } }
  else if (a == 'zoom') { $('#lb img').src = b.dataset.src; $('#lb').classList.add('on') }
  else if (a == 'lbx') $('#lb').classList.remove('on');
  else if (a == 'edit') { editId = id; cartView() }
  else if (a == 'reset') { delete cart[id].p; save(); bar(); cartView() }
  else if (a == 'disc') { disc = +v; save(); bar(); cartView() }
  else if (a == 'new') { const z = snap(); cart = {}; disc = 0; eo = ''; save(); closeSheet(); drawList(); toast('Изменено: заявка очищена', () => unsnap(z)) }
  else if (a == 'send') {
    if (!H.s || !lines().length) return alert('Укажите магазин и добавьте товары');
    if (!H.d || H.d < today()) { H.dm = 0; fixDate(); fill(); return alert('Дата поставки не может быть в прошлом. Поставлена ближайшая пятница — проверьте и отправьте снова.') }
    const sh = curShop(); if (sh && sh.st == 'no' && !confirm('⚠ Магазин помечен «Не заходить»' + (sh.nt ? ': ' + sh.nt : '') + '.\nВсё равно отправить заявку?')) return;
    let old = eo && histById(eo);
    if (eo && (!old || old.del || !canEdit(old))) { eo = ''; save(); alert('Срок правки истёк (' + CFG.EDIT_HOURS + ' ч) или заявка удалена — это будет новая заявка. Нажмите «Отправить» ещё раз.'); return cartView() }
    const dup = !eo && allHist().find(x => !x.del && isMine(x) && norm(x.h.s || '') == norm(H.s) && x.sum == final() && Date.now() - (x.ts || 0) < 10 * 6e4);   // защита от двойной отправки
    if (dup && !confirm('Похожая заявка («' + H.s + '», ' + final() + ' ₸) уже создана ' + Math.max(1, Math.round((Date.now() - dup.ts) / 6e4)) + ' мин назад.\nОтправить ещё раз?')) return;
    const rc = rcPick(), num2 = String(rc.p || S.op || '').replace(/\D/g, ''); if (!num2) return alert('Не указан номер получателя: заполните лист «Получатели» или номер в настройках');
    const tx = (eo ? '❗ ИЗМЕНЕНИЕ заявки от ' + ft(old.ts) + '\n' : '') + text();
    const o = { id: eo || Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: eo ? old.ts : Date.now(), trader: me, h: { d: H.d, c: H.c, s: H.s, a: H.a, sid: H.sid || '' }, cart: JSON.parse(JSON.stringify(cart)), disc, sum: final(), m: S.mode, rc: { n: rc.n, p: num2 }, text: tx, items: lines().map(p => ({ n: p.n, g: p.g, u: p.u, q: qty(p), p: price(p), o: p.pr })) };
    if (eo) o.ed = Date.now();
    LS('pending', o); leaving = true; location.href = `https://wa.me/${num2}?text=${encodeURIComponent(o.text)}`; }
  else if (a == 'eoc') { const z = snap(); eo = ''; cart = {}; disc = 0; clrShop(); save(); fill(); closeSheet(); drawList(); toast('Правка отменена, заявка осталась как была', () => unsnap(z)) }
  else if (a == 'hedit') { const x = histById(v); if (!x || !canEdit(x)) return alert('Изменить можно только свою заявку в течение ' + CFG.EDIT_HOURS + ' ч после создания');
    if (lines().length && !confirm('Текущая заявка в корзине будет заменена. Продолжить?')) return;
    if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = JSON.parse(JSON.stringify(x.cart || {})); disc = x.disc || 0; H = { ...x.h, dm: 1, r: x.rc && x.rc.n || '' }; eo = x.id; save(); fill(); closeSheet(); drawList(); cartView() }
  else if (a == 'clr') { const z = snap(); cart = {}; disc = 0; eo = ''; save(); bar(); drawList(); toast('Изменено: корзина очищена', () => unsnap(z)) }
  else if (a == 'hd') histDetail(v);
  else if (a == 'htab') { histTab = v; LS('htab', v); histView() }
  else if (a == 'hdel') { const x = histById(v); if (x && isMine(x) && confirm('Удалить заявку «' + (x.h.s || '—') + '» на ' + x.sum + ' ₸?\nЕё можно будет вернуть в течение ' + CFG.UNDO_HOURS + ' ч.')) { delOrder(v, Date.now()); histView() } }
  else if (a == 'hres') { delOrder(v, 0); histView() }
  else if (a == 'hcopy') { try { navigator.clipboard.writeText(histById(v).text || '').then(() => alert('Текст скопирован')) } catch (e) { alert('Не удалось скопировать') } }
  else if (a == 'hopen') { histDay = dayMs(Date.now()); histView() }
  else if (a == 'dprev') { histDay = dayMs(histDay - 12 * 36e5); histView() }
  else if (a == 'dnext') { histDay = Math.min(dayMs(histDay + 36 * 36e5), dayMs(Date.now())); histView() }
  else if (a == 'dall') { histDay = 0; histView() } else if (a == 'dtoday') { histDay = dayMs(Date.now()); histView() }
  else if (a == 'dretry') { dayErr = 0; histView() }
  else if (a == 'inst') { if (instEv) { instEv.prompt(); instEv.userChoice.finally(() => { instEv = null; hideInst() }) } else alert('Android (Chrome): меню ⋮ → «Установить приложение» или «Добавить на главный экран».\niPhone (Safari): «Поделиться» → «На экран Домой».') }
  else if (a == 'instx') { LS('instx', 1); hideInst() }
  else if (a == 'csv') exportCsv();
  else if (a == 'sedit') { cKey = ''; shopCard(ddL[+v].id || 'n:' + ddL[+v].n); $('#sl').hidden = true }
  else if (a == 'shops') shopsView(); else if (a == 'shm') { shMode = v; shopsView() }
  else if (a == 'scard') { cKey = ''; shopCard(v) } else if (a == 'sedit2') shopEditView(cSh)
  else if (a == 'shn') shopNew()
  else if (a == 'shns') { const n = $('#nn').value.trim().replace(/\s+/g, ' '), c = $('#nc').value, ad = $('#na').value.trim(), ty = $('#nty').value; if (!n) return;
    if (findBase(n, c)) return alert('Такой магазин в этом городе уже есть');
    const o = upShop(n, c, ad); o.ty = ty; LS('base', base); if (CFG.API_URL) { shopq.push({ n, c, a: ad, id: o.id, ty }); LS('shopq', shopq); sync() } cKey = ''; shopCard(o.id) }
  else if (a == 'sord') { selShop(cSh); closeSheet(); drawList() }
  else if (a == 'sst') { cSt = v; document.querySelectorAll('.sg button').forEach(e => e.classList.toggle('on', e.dataset.v == v)); $('#stw').hidden = v == '-'; $('#stn').placeholder = 'Заметка' + (v == 'no' ? ' (причина — обязательно)' : '') }
  else if (a == 'sstsave') { const x = cSh, none = cSt == '-', st = none ? '' : cSt, nt = none ? '' : $('#stn').value.trim(); if (!cSt) return alert('Выберите статус');
    if (st == 'no' && !nt) return alert('Для статуса «Не заходить» укажите причину в заметке');
    const prev = { st: x.st || '', nt: x.nt || '' }; setShopStatus(x, st, nt);
    toast('Изменено: ' + (st ? 'статус «' + ST[st][0] + '»' : 'статус снят'), () => { setShopStatus(x, prev.st, prev.nt); if (view == 'shopc' && cKey == (x.id || x.n)) { cSt = prev.st || '-'; shopCard(x.id || 'n:' + x.n) } });
    shopCard(x.id || 'n:' + x.n) }
  else if (a == 'sinfo') { const x = cSh; x.ct = $('#ict').value.trim(); x.tl = $('#itl').value.trim(); x.rg = $('#irg').value.trim(); LS('base', base);
    if (CFG.API_URL) { shopq.push({ op: 'info', id: x.id || '', n: x.n, c: x.c, a: x.a, ct: x.ct, tl: x.tl, rg: x.rg }); LS('shopq', shopq); sync() } shopCard(x.id || 'n:' + x.n) }
  else if (a == 'vis') { const x = cSh, nt = $('#vn').value.trim(), val = VO[+v], ts = Date.now(), my = myLast(x);
    if (my && dayMs(my) == dayMs(ts) && !confirm('Вы уже отмечали визит в этот магазин сегодня (' + new Date(my).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) + ').\nОтметить ещё раз?')) return;
    const prev = { lv: x.lv, lb: x.lb, lw: x.lw }, pm = cMine, vid = 'v' + ts.toString(36) + Math.random().toString(36).slice(2, 6);
    if (x.pl && x.pl <= ts) x.pl = 0; x.lv = ts; x.lb = val; x.lw = me; cMine = ts; LS('base', base); logLocal(x, 'visit', val, nt);
    if (CFG.API_URL) { visq.push({ id: vid, shop: x.n, sid: x.id || '', c: x.c, a: x.a, trader: me, ts, val, note: nt }); LS('visq', visq); sync() }
    toast('Изменено: визит «' + val + '»', () => { const i = visq.findIndex(y => y.id == vid);
      if (i >= 0) { visq.splice(i, 1); LS('visq', visq) } else if (CFG.API_URL) { visq.push({ cancel: 1, id: 'c' + Date.now().toString(36), shop: x.n, sid: x.id || '', trader: me }); LS('visq', visq); sync() }
      x.lv = prev.lv; x.lb = prev.lb; x.lw = prev.lw; cMine = pm; LS('base', base); if (Array.isArray(cLog)) { const k = cLog.findIndex(l => l.kind == 'visit' && l.ts == ts); if (k >= 0) cLog.splice(k, 1) } if (view == 'shopc' && cKey == (x.id || x.n)) shopCard(x.id || 'n:' + x.n) });
    shopCard(x.id || 'n:' + x.n) }
  else if (a == 'vcan') { const x = cSh; if (!confirm('Отменить вашу последнюю отметку визита в «' + x.n + '»?')) return;
    const mi = visq.map((y, i) => y.cancel || y.sid != (x.id || '') || y.shop != x.n || y.trader != me ? -1 : i).filter(i => i >= 0).pop();   // ещё не ушла на сервер — просто убираем из очереди
    if (mi != null) { visq.splice(mi, 1); LS('visq', visq) } else if (CFG.API_URL) { visq.push({ cancel: 1, id: 'c' + Date.now().toString(36), shop: x.n, sid: x.id || '', trader: me }); LS('visq', visq); sync() }
    if (Array.isArray(cLog)) { const k = cLog.findIndex(l => l.kind == 'visit' && l.who == me); if (k >= 0) cLog.splice(k, 1); const rest = cLog.find(l => l.kind == 'visit'), mine2 = cLog.find(l => l.kind == 'visit' && l.who == me);
      x.lv = rest ? rest.ts : 0; x.lb = rest ? rest.val : ''; x.lw = rest ? rest.who : ''; cMine = mine2 ? mine2.ts : 0 } else { x.lv = 0; x.lb = ''; x.lw = ''; cMine = 0 }
    LS('base', base); toast('Отметка визита отменена'); shopCard(x.id || 'n:' + x.n) }
  else if (a == 'plan' || a == 'planx' || a == 'fqs' || a == 'fqx') { const x = cSh;
    if (a == 'plan') { const v2 = $('#pld').value; if (!v2 || v2 < today()) return alert('Выберите сегодняшнюю или будущую дату'); const [y, m, d] = v2.split('-').map(Number); x.pl = new Date(y, m - 1, d).getTime() }
    else if (a == 'planx') x.pl = 0; else if (a == 'fqs') x.fq = $('#fqi').value.trim(); else x.fq = '';
    saveMeta(x); shopCard(x.id || 'n:' + x.n) }
  else if (a == 'slog') { cLog = null; cErr = ''; shopCard(cSh.id || 'n:' + cSh.n); loadLog(cSh) }
  else if (a == 'ssave') { const n = $('#en').value.trim().replace(/\s+/g, ' '), c = $('#ec').value, ad = $('#ea').value.trim(), ty = $('#ety').value; if (!n) return;
    if (base.some(b => b !== eSh && norm(b.n) == norm(n) && norm(b.c) == norm(c))) return alert('Магазин с таким названием в этом городе уже есть');
    const old = eSh.n; eSh.n = n; eSh.c = c; eSh.a = ad; eSh.ty = ty; LS('base', base);
    if (curShop() === eSh || (H.sid && H.sid == eSh.id)) { H.s = n; H.a = ad; H.c = c; cities(); $('#s').value = n; $('#a').value = ad; save() }
    if (CFG.API_URL) { shopq.push({ op: 'edit', id: eSh.id || '', old, n, c, a: ad, ty }); LS('shopq', shopq); sync() } cKey = ''; shopCard(eSh.id || 'n:' + n) }
  else if (a == 'sdel') { if (!confirm('Удалить магазин «' + eSh.n + '» из общей базы? Старые заявки и журнал сохранятся.')) return;
    const x = eSh; base = base.filter(b => b !== x); LS('base', base);
    if (H.sid && H.sid == x.id || norm(H.s) == norm(x.n)) { clrShop(); $('#s').value = ''; $('#a').value = ''; save(); shopWarn() }
    if (CFG.API_URL) { shopq.push({ op: 'del', id: x.id || '', old: x.n }); LS('shopq', shopq); sync() } cSh = null; cKey = ''; shopsView() }
  else if (a == 'pick') { selShop(ddL[v]); $('#sl').hidden = true }
  else if (a == 'padd') { const n = $('#s').value.trim().replace(/\s+/g, ' '); if (!n) return; H.s = n; $('#s').value = n; addShop(n); save(); shopWarn(); $('#sl').hidden = true }
  else if (a == 'pyes') { const o = LS('pending'); localStorage.removeItem('pending'); if (!o) return;
    const h = (LS('hist') || []).filter(x => x.id != o.id); h.unshift(o); LS('hist', h.slice(0, 50)); outbox = outbox.filter(x => x.id != o.id); outbox.push(o); LS('outbox', outbox);
    const sh = upShop(o.h.s, o.h.c, o.h.a, o.h.sid); if (sh && !o.ed) { sh.lo = Math.max(sh.lo || 0, o.ts); LS('base', base) }   // новый магазин сразу попадает в список; «посл. заказ» обновляется
    cart = {}; disc = 0; eo = ''; clrShop(); H.dm = 0; save(); fill(); shops(); closeSheet(); drawList(); bar(); sync() }
  else if (a == 'pno') { localStorage.removeItem('pending'); closeSheet() }
  else if (a == 'drafts') draftView(); else if (a == 'dsave') draftSave();
  else if (a == 'dopen') { if (lines().length && !confirm('Текущая заявка будет заменена. Продолжить?')) return;
    const x = drafts.splice(v, 1)[0]; LS('drafts', drafts); if (x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = x.cart; disc = x.disc; eo = ''; H = { ...x.H }; save(); fill(); closeSheet(); drawList(); bar(); draftBadge() }
  else if (a == 'ddel') { drafts.splice(v, 1); LS('drafts', drafts); draftBadge(); draftView() }
  else if (a == 'who2') sync().then(whoView); else if (a == 'who') whoView(); else if (a == 'me') { me = v; LS('me', me); closeSheet(); sync() }
  else if (a == 'rep') { const x = histById(v); if (!x) return; if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() } cart = x.cart; disc = x.disc; eo = ''; H = { ...x.h, dm: 0, r: '' }; save(); fill(); closeSheet(); drawList() }
  else if (a == 'ss') { S.op = $('#op').value.trim() || CFG.OPERATOR; S.cities = $('#ct').value.split(',').map(s => s.trim()).filter(Boolean); LS('set', S); cities(); closeSheet() }
  else if (a == 'rl') { load(); closeSheet() }
  else if (a == 'bak') exportBackup(); else if (a == 'imp') $('#impf').click()
});
document.addEventListener('change', e => { const t = e.target;
  if (t.dataset.q !== undefined) setQ(find(t.dataset.q), num(t.value));
  else if (t.dataset.np !== undefined) { const n = num(t.value), id = t.dataset.np; if (n > 0) { n == find(id).pr ? delete cart[id].p : cart[id].p = n; save() } editId = ''; bar(); cartView() }
  else if (t.id == 'dc') { disc = Math.min(100, num(t.value)); save(); bar(); cartView() }
  else if (t.id == 'rch') { H.r = t.value; save() }
  else if (t.id == 'cd') { if (!t.value || t.value < today()) { H.dm = 0; fixDate(); alert('Прошедшую дату выбрать нельзя. Поставлена ближайшая пятница.') } else { H.d = t.value; H.dm = 1 } save(); fill(); cartView() }
  else if (t.id == 'htr') { hTr = t.value; histView() }
  else if (t.id == 'tys') { cSh.ty = t.value; saveMeta(cSh) }
  else if (t.id == 'sht') { shT = t.value; shopsView() }
  else if (/^rt(p|v|o|q|vd|od)$/.test(t.id)) { const k = { rtp: 'plan', rtv: 'visit', rto: 'order', rtq: 'q', rtvd: 'vd', rtod: 'od' }[t.id]; RT[k] = t.type == 'checkbox' ? t.checked : Math.max(1, Math.min(365, +t.value || RT0[k])); LS('rt', RT); drawShops() }
  else if (t.id == 'shc') { shCity = t.value; shopsView() } else if (t.id == 'shs') { shSt = t.value; shopsView() }
  else if (t.id == 'impf') importBackup(t.files[0]); });
document.addEventListener('input', e => { if (e.target.id == 'shq') { shQ = e.target.value; drawShops() } });
$('#q').oninput = e => { Q = e.target.value.toLowerCase(); drawList() };
['d', 's', 'a'].forEach(k => $('#' + k).addEventListener('change', e => { H[k] = e.target.value;
  if (k == 'd') { if (!H.d || H.d < today()) { H.dm = 0; fixDate(); $('#d').value = H.d; alert('Прошедшую дату выбрать нельзя. Поставлена ближайшая пятница.') } else H.dm = 1 }
  if (k == 's') { // название магазина приводим к записи из общей базы (сначала тот же город), подставляем город, адрес и ID
    const v = H.s.trim().replace(/\s+/g, ' '), b = findBase(v, H.c) || base.find(x => norm(x.n) == norm(v)); H.s = b ? b.n : v; $('#s').value = H.s; H.sid = b ? b.id || '' : '';
    if (b) { H.a = b.a || H.a; if (b.c) { H.c = b.c; H.r = ''; cities() } $('#a').value = H.a || '' } shopWarn() }
  save() }));
$('#c').onchange = e => { H.r = ''; if (e.target.value == '+') { const n = (prompt('Название города') || '').trim(); if (n) { S.cities.push(n); LS('set', S); H.c = n } cities() } else H.c = e.target.value; save() };

/* ============ 9. СТАРТ ============ */
// Защита от случайного выхода: кнопка «назад» сначала закрывает шторку/фото, а при непустой корзине просит нажать ещё раз; закрытие вкладки на ноутбуке — с вопросом
history.replaceState({ ab: 0 }, '');
const arm = () => { if (!history.state || history.state.ab !== 1) history.pushState({ ab: 1 }, '') };   // запись «страж» добавляем по касанию: браузер пропускает записи истории, созданные без действий пользователя
document.addEventListener('pointerdown', arm, true);
window.addEventListener('popstate', () => {
  const keep = () => history.pushState({ ab: 1 }, '');
  if ($('#lb').classList.contains('on')) { $('#lb').classList.remove('on'); return keep() }
  if (document.body.classList.contains('sh')) { closeSheet(); drawList(); return keep() }
  if (lines().length && Date.now() - lastBack > 2500) { lastBack = Date.now(); keep(); return toast('Нажмите «назад» ещё раз, чтобы выйти. Корзина сохранится.') }
  leaving = true; history.back();
});
window.addEventListener('beforeunload', e => { if (!leaving && (lines().length || LS('pending'))) { e.preventDefault(); e.returnValue = '' } });
window.addEventListener('pageshow', () => { leaving = false });
$('#s').addEventListener('focus', drawDD); $('#s').addEventListener('input', e => { H.s = e.target.value; H.sid = ''; save(); drawDD(); shopWarn() });
// Свайп вниз закрывает шторку: тянуть можно за полоску, заголовок или за содержимое, если оно прокручено до верха
(() => { const sh = document.getElementById('sheet'); if (!sh) return; let y0 = 0, dy = 0, on = false, drag = false, t0 = 0;
  const head = e => !!e.target.closest('.grab,#st');
  sh.addEventListener('touchstart', e => { on = e.touches.length == 1 && (head(e) || (sh.scrollTop <= 0 && !e.target.closest('input:not(#dp),select,textarea'))); drag = false; dy = 0; if (on) { y0 = e.touches[0].clientY; t0 = Date.now() } }, { passive: true });
  sh.addEventListener('touchmove', e => { if (!on) return; dy = e.touches[0].clientY - y0;
    if (!drag && dy < -6) { on = false; return }                    // двигают вверх — это прокрутка, не свайп
    if (dy > 6 && (head(e) || sh.scrollTop <= 0)) { drag = true; sh.style.transition = 'none'; sh.style.transform = 'translateY(' + Math.max(0, dy) + 'px)'; if (e.cancelable) e.preventDefault() } }, { passive: false });
  const end = e => { if (!on) return; on = false; sh.style.transition = ''; sh.style.transform = '';
    if (drag) { if (e.cancelable) e.preventDefault(); drag = false; if (dy > 110 || (dy > 50 && Date.now() - t0 < 250)) { closeSheet(); drawList() } } };
  sh.addEventListener('touchend', end, { passive: false }); sh.addEventListener('touchcancel', end, { passive: false }) })();
// Установка на главный экран: плашка (Android Chrome) и кнопка в настройках
let instEv = null; const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const hideInst = () => { const e = document.getElementById('inst'); if (e) e.remove() };
function showInst() { if (standalone || LS('instx') || !instEv || document.getElementById('inst')) return; const d = document.createElement('div'); d.id = 'inst'; d.className = 'inst';
  d.innerHTML = `<span>Установите приложение на главный экран</span><button data-a="inst">Установить</button><button class="ix" data-a="instx" aria-label="Скрыть">${ico('x', 16)}</button>`; document.body.prepend(d) }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instEv = e; showInst() });
window.addEventListener('appinstalled', () => { instEv = null; hideInst() });
// Экспорт истории в CSV (разделитель «;», кодировка UTF-8 с BOM — открывается в Excel)
function exportCsv() {
  const q = v => { v = String(v == null ? '' : v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v }, n = v => String(v == null ? '' : v).replace('.', ','),
    dt = ts => { if (!ts) return ''; const d = new Date(ts), z = k => String(k).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) },
    list = allHist().filter(x => !x.del).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (!list.length) return alert('Нет заявок для выгрузки');
  const rows = [['Создана', 'Торговый', 'Магазин', 'Город', 'Адрес', 'Получатель', 'Поставка на', 'Цены', 'Скидка %', 'Сумма заявки', 'Товар', 'Граммовка', 'Ед.', 'Кол-во', 'Цена', 'Сумма позиции']];
  list.forEach(x => { const h = x.h || {}, head = [dt(x.ts), x.trader || '', h.s || '', h.c || '', h.a || '', (x.rc && x.rc.n) || '', h.d || '', x.m == 'vat' ? 'с НДС' : 'без НДС', n(x.disc || 0), n(x.sum)];
    (x.items && x.items.length ? x.items : [null]).forEach(i => rows.push(head.concat(i ? [i.n, i.g || '', i.u || '', n(i.q), n(i.p), n(Math.round(i.p * i.q))] : ['', '', '', '', '', ''])) ) });
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'zayavki-' + today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500) }
// Резервная копия данных этого устройства (черновики, избранное, очередь отправки, настройки) — для нового телефона и переезда на другой хостинг
const BAK = ['cart', 'disc', 'hdr', 'set', 'me', 'fav', 'drafts', 'hist', 'outbox', 'shopq', 'visq', 'delq', 'eo'];
function exportBackup() {
  const d = { app: 'alibaba', ver: VER, at: new Date().toISOString(), data: {} }; BAK.forEach(k => { const v = LS(k); if (v != null) d.data[k] = v });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'alibaba-backup-' + today() + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500) }
function importBackup(f) {
  if (!f) return; const r = new FileReader();
  r.onload = () => { let d; try { d = JSON.parse(r.result) } catch (e) { return alert('Файл повреждён: это не резервная копия') }
    if (!d || d.app != 'alibaba' || !d.data) return alert('Это не файл резервной копии «Али-Баба»');
    if (!confirm('Загрузить данные из файла (копия от ' + String(d.at || '').slice(0, 10) + ')?\nЧерновики, избранное и очередь отправки будут объединены с текущими; настройки и профиль заменены.')) return;
    const x = d.data, mg = (k, key) => { const m = new Map(); [...(LS(k) || []), ...(x[k] || [])].forEach((e, i) => m.set(key ? e[key] : JSON.stringify(e), e)); LS(k, [...m.values()]) };
    mg('fav'); mg('drafts'); mg('shopq'); mg('visq'); mg('delq', 'id'); mg('hist', 'id'); mg('outbox', 'id');
    if (x.set) LS('set', x.set); if (x.me) LS('me', x.me); if (!lines().length && x.cart) { LS('cart', x.cart); LS('disc', x.disc || 0); LS('hdr', x.hdr || H); LS('eo', x.eo || '') }
    alert('Данные загружены. Приложение перезапустится.'); leaving = true; location.reload() };
  r.readAsText(f) }
document.addEventListener('change', e => { if (e.target.id == 'dp' && e.target.value) { const [y, m, d] = e.target.value.split('-').map(Number); histDay = new Date(y, m - 1, d).getTime(); histView() } });   // выбор дня в календаре
$('#sl').addEventListener('pointerdown', e => e.preventDefault());   // не терять фокус поля при тапе по списку
document.addEventListener('click', e => { if (!e.target.closest('.cb')) $('#sl').hidden = true });
document.addEventListener('click', e => { const t = e.target; if (t.matches && t.matches('input[type=date]') && t.showPicker) { try { t.showPicker() } catch (_) {} } });   // на ноутбуке календарь открывается по клику на поле, а не только по значку
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkPending(); sync() } });
window.addEventListener('online', sync); window.addEventListener('offline', () => { syncErr = true; syncStatus() });
$('#sy').addEventListener('click', () => sync());
drawSeg(); fill(); shops(); draftBadge(); syncStatus(); load(); checkPending();
sync().then(() => { if (CFG.API_URL && !me && !LS('pending')) whoView() });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
