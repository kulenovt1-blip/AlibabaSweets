/* ============ 1. НАСТРОЙКИ (меняйте только здесь) ============ */
const CFG = {
  SHEET_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGyNVUyAyeZVoafaazZmZEQbtmmcyqXV5AJBYxhq1_4SELUbFuujtEr9XHfp9XCLktXud9Sc2Czmf_/pub?gid=928244906&single=true&output=csv',                 // ← ссылка на опубликованный CSV Google Таблицы (см. README.md)
  OPERATOR: '77474331973',       // номер оператора WhatsApp: код страны + номер, без + и пробелов
  CITIES: ['Петропавловск', 'Астана', 'Костанай'],
  PRICE_MODE: 'vat',             // режим цен по умолчанию: 'vat' — с НДС, 'net' — без НДС
  SHOW_VAT_LABEL: true,          // пометка «(с НДС)» / «(без НДС)» в последней строке заявки; false — убрать
  API_URL: '',                   // ссылка на веб-приложение Apps Script (см. README); пусто = без общей базы
  API_KEY: '3puq8z64'       // тот же ключ, что KEY в Code.gs
};
// Колонки таблицы: категория | название | граммовка | цена без НДС | цена с НДС | единица (шт/кг/кор) | фото
const DEMO = [['Финики','Финики FINDI caramel','150г','1704','1976','шт',''],['Мармелад','Кубик Манго','200г','500','600','шт',''],
  ['Орехи','Грецкий орех','1кг','4200','4872','кг','']];

/* ============ 2. ХЕЛПЕРЫ И СОСТОЯНИЕ ============ */
/* Версия сборки: должна совпадать с <meta name="ver"> в index.html. Если файлы на хостинге разных версий — покажем красную плашку. */
const VER = '12';
{ const m = document.querySelector('meta[name=ver]');
  if (!m || m.content != VER) document.body.insertAdjacentHTML('afterbegin', '<div style="background:#C82B27;color:#fff;padding:12px;font-weight:800">Файлы сайта разных версий. Загрузите ВСЕ файлы из архива заново (index.html, styles.css, app.js, sw.js) и обновите страницу дважды.</div>') }
const ghost = new Proxy(function () {}, { get: (t, k) => k == Symbol.toPrimitive ? () => '' : ghost, set: () => true, apply: () => ghost });   // заглушка вместо отсутствующего элемента — страница не падает целиком
const $ = s => document.querySelector(s) || ghost;
const LS = (k, v) => { if (v !== undefined) return localStorage.setItem(k, JSON.stringify(v)); try { return JSON.parse(localStorage.getItem(k) || 'null') } catch (e) { return null } };   // битые сохранённые данные не должны ронять приложение
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const num = v => parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0; // «1 500 ₸» → 1500
const qf = n => String(+n.toFixed(2));
const fd = d => d ? +d.slice(8) + '.' + +d.slice(5, 7) : '';           // 2026-10-09 → 9.10
let P = [], cart = LS('cart') || {}, disc = LS('disc') || 0, H = LS('hdr') || { d: today() },
    S = LS('set') || { op: CFG.OPERATOR, cities: CFG.CITIES }, cat = 'Все', Q = '', view = '', editId = '';
S.mode = S.mode || CFG.PRICE_MODE;
if (!Array.isArray(S.cities) || !S.cities.length) S.cities = CFG.CITIES; S.op = S.op || CFG.OPERATOR;   // защита от данных старых версий
if (typeof H != 'object' || Array.isArray(H)) H = { d: today() }; if (typeof cart != 'object' || Array.isArray(cart)) cart = {};
let me = LS('me') || '', trs = LS('trs') || [], base = LS('base') || [], shist = LS('shist') || [], outbox = LS('outbox') || [], drafts = LS('drafts') || [], shopq = LS('shopq') || [];
// История = серверная + локальная (ещё не синхронизированная), без дублей
const allHist = () => { const m = new Map(); [...shist, ...(LS('hist') || [])].forEach(x => m.set(x.id || x.sum + x.h.s + x.h.d, x)); return [...m.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0)) };
// Позиция в корзине: cart[id] = { q: количество, p: ручная цена (необязательно) }
const pid = p => p.n + '|' + p.g + '|' + p.u;
const step = p => p.u == 'кг' ? .5 : 1;
const qty = p => cart[pid(p)]?.q || 0;
const price = p => cart[pid(p)]?.p ?? p.pr;
const find = id => P.find(p => pid(p) == id);
const lines = () => P.filter(p => qty(p) > 0);
const total = () => Math.round(lines().reduce((s, p) => s + price(p) * qty(p), 0));
const final = () => Math.round(total() * (1 - disc / 100));
const icon = c => { c = c.toLowerCase(); return c.includes('фин') ? '🌴' : c.includes('орех') ? '🥜' : c.includes('сух') ? '🍑' : /комп|напит/.test(c) ? '🥤' : '🍬' };
const save = () => { LS('cart', cart); LS('disc', disc); LS('hdr', H) };

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
// Колонки: 0 категория, 1 название, 2 граммовка, 3 цена без НДС, 4 цена с НДС, 5 единица, 6 фото
const toProducts = rows => rows.slice(1).filter(r => r[1] && (num(r[3]) > 0 || num(r[4]) > 0)).map(r =>
  ({ c: r[0].trim() || 'Прочее', n: r[1].trim(), g: (r[2] || '').trim(), pn: num(r[3]), pv: num(r[4]), pr: 0, u: (r[5] || 'шт').trim() || 'шт', f: photo(r[6]) }));
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
    : miss.length ? `Не заполнена цена (с НДС или без) у ${miss.length} тов.: ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}` : '';
  n.hidden = !msg; n.style.background = err ? '#fde0de' : '#fff3c4'; n.style.color = err ? '#C82B27' : '#6b5200'; n.textContent = msg;
}

/* ============ 4. КАТАЛОГ ============ */
function drawChips() {
  $('#chips').innerHTML = ['Все', ...new Set(P.map(p => p.c))].map(c =>
    `<button class="chip${c == cat ? ' on' : ''}" data-a="cat" data-v="${esc(c)}">${c == 'Все' ? '✨' : icon(c)} ${esc(c)}</button>`).join('');
}
const ctl = p => { const id = esc(pid(p)), q = qty(p); if (!p.pr) return `<button class="add" disabled>Нет цены ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}</button>`;   // кнопка «В заявку» или степпер
  return q ? `<div class="st"><button data-a="m" data-id="${id}">−</button><input data-q="${id}" inputmode="decimal" value="${qf(q)}"><button data-a="p" data-id="${id}">+</button></div>`
           : `<button class="add" data-a="p" data-id="${id}">＋ В заявку</button>`; };
function drawList() {
  const l = P.filter(p => (cat == 'Все' || p.c == cat) && p.n.toLowerCase().includes(Q)), el = $('#list');
  el.innerHTML = l.map((p, i) => `<article class="pc" style="--i:${Math.min(i, 8)}"><button class="ph" data-a="zoom" data-src="${esc(p.f || 'logo.jpg')}"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" loading="lazy" alt="">${p.g ? `<span class="tag">${esc(p.g)}</span>` : ''}</button><div class="pb"><b>${esc(p.n)}</b><span class="pr">${p.pr ? p.pr + ' ₸' : '—'} <small>/ ${p.u}</small></span><div class="ctl" data-c="${esc(pid(p))}">${ctl(p)}</div></div></article>`).join('') || '<p class="empty">Ничего не найдено</p>';
  el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); // перезапуск анимации
}
function setQ(p, v) {
  const k = pid(p), old = qty(p); v = Math.max(0, Math.round(v * 100) / 100) || 0;
  if (!v) delete cart[k]; else cart[k] = { ...cart[k], q: v };
  save(); bar(v > old);
  document.querySelectorAll(`[data-c="${CSS.escape(k)}"]`).forEach(e => { e.innerHTML = ctl(p); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop') });
  if (view == 'cart') cartView();
}
function bar(bump) {
  const n = lines().length; $('#clr').hidden = !n; $('#bar').classList.toggle('off', !n || view != '' && view != undefined && document.body.classList.contains('sh'));
  $('#bn').textContent = '🛒 ' + n + ' поз.'; $('#bs').textContent = final() + ' ₸';
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

/* ============ 6. ШТОРКА: корзина, история, настройки ============ */
function openSheet(v, title) { view = v; $('#st').textContent = title; document.body.classList.add('sh'); bar(); }
function closeSheet() { view = ''; editId = ''; document.body.classList.remove('sh'); bar(); }
function cartView() {
  if (view != 'cart') openSheet('cart', 'Ваша заявка');
  const L = lines();
  if (!L.length) { $('#sb').innerHTML = '<p class="empty">Корзина пуста. Добавьте товары из каталога.</p>'; return }
  $('#sb').innerHTML = L.map(p => { const id = esc(pid(p)), n = price(p), ch = n != p.pr;
    const pe = editId == pid(p) ? `<input class="np" data-np="${id}" inputmode="decimal" value="${n}">`
      : `<button class="pe${ch ? ' ch' : ''}" data-a="edit" data-id="${id}">${ch ? `<s>${p.pr}</s>` : ''}${n} ₸ ✏️</button>`;
    return `<div class="it"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" alt=""><div><b>${esc(p.n)}</b> <span class="m">${esc(p.g)}</span><div style="margin-top:6px">${pe}${ch ? ` <button class="pe" data-a="reset" data-id="${id}">↺</button>` : ''}</div></div><button class="x" data-a="rm" data-id="${id}">✕</button><div class="st" style="grid-column:1/4">${`<button data-a="m" data-id="${id}">−</button><input data-q="${id}" inputmode="decimal" value="${qf(qty(p))}"><button data-a="p" data-id="${id}">+</button>`}<b style="margin-left:auto">${Math.round(n * qty(p))} ₸</b></div></div>`; }).join('') +
  `<div class="sum"><div class="m">Цены: ${S.mode == 'vat' ? 'с НДС' : 'без НДС'}</div><b>Скидка на весь чек</b><div class="dc">${[0, 3, 5, 10].map(x => `<button data-a="disc" data-v="${x}" class="${disc == x ? 'on' : ''}">${x ? x + '%' : 'Нет'}</button>`).join('')}<input id="dc" inputmode="decimal" placeholder="свой %" value="${[0, 3, 5, 10].includes(disc) ? '' : disc}"></div>
  <div class="r"><span>Сумма</span><b>${total()} ₸</b></div>${disc > 0 ? `<div class="r"><span>Скидка ${disc}%</span><b>−${total() - final()} ₸</b></div>` : ''}<div class="r t"><span>Итого</span><span>${final()} ₸</span></div></div>
  <button class="send" data-a="send">📲 Отправить в WhatsApp</button><button class="ghost" data-a="dsave">💾 Сохранить как черновик</button><button class="ghost" data-a="new">Новая заявка</button>`;
  const np = document.querySelector('[data-np]'); if (np) np.select();
}
const ft = ts => ts ? new Date(ts).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
function histView() { // список: магазин, когда создана, на какую дату поставка, сумма
  openSheet('hist', 'История заявок'); const h = allHist();
  $('#sb').innerHTML = h.map((x, i) => `<div class="hi"><div data-a="hd" data-v="${i}" style="flex:1"><b>${esc(x.h.s || '—')} ›</b><div class="m">Создана: ${ft(x.ts)}</div><div class="m">Поставка на: ${fd(x.h.d)} · ${esc(x.h.c || '')}</div><b style="color:var(--r)">${x.sum} ₸</b><span class="m">${outbox.some(y => y.id == x.id) ? ' ⏳ не передано в базу' : ''}</span></div><button data-a="rep" data-v="${i}" style="padding:14px 16px">Повторить</button></div>`).join('') || '<p class="empty">Отправленных заявок пока нет</p>';
}
function histDetail(i) { // полная карточка заявки
  const x = allHist()[i]; if (!x) return; openSheet('hd', 'Заявка'); const R = (k, v) => `<div class="r"><span class="m">${k}</span><b>${v}</b></div>`;
  const rows = x.items ? x.items.map(t => `<div class="r"><span>${esc(t.n)}${t.g ? ' (' + esc(t.g) + ')' : ''}<br><span class="m">${qf(t.q)}${esc(t.u)} × ${t.o != t.p ? `<s>${t.o}</s> ` : ''}${t.p} ₸</span></span><b>${Math.round(t.p * t.q)} ₸</b></div>`).join('')
    : `<pre style="white-space:pre-wrap;font:inherit;margin:0">${esc(x.text || '')}</pre>`;
  $('#sb').innerHTML = `<div class="sum">${R('Магазин', esc(x.h.s || '—'))}${R('Город', esc(x.h.c || '—'))}${R('Адрес', esc(x.h.a || '—'))}${R('Торговый', esc(x.trader || '—'))}${R('Создана', ft(x.ts))}${R('Поставка на', fd(x.h.d))}${R('Цены', x.m == 'vat' ? 'с НДС' : 'без НДС')}${x.disc ? R('Скидка', x.disc + '%') : ''}</div>
  <div class="sum" style="margin-top:10px"><b>Товары</b>${rows}<div class="r t"><span>Итого</span><span>${x.sum} ₸</span></div></div>
  <button class="send" data-a="rep" data-v="${i}">Повторить заявку</button><button class="ghost" data-a="hcopy" data-v="${i}">Скопировать текст</button><button class="ghost" data-a="hist">← К списку</button>`;
}
function setView() {
  openSheet('set', 'Настройки');
  $('#sb').innerHTML = `${CFG.API_URL ? `<button class="ghost" style="margin:0 0 10px" data-a="who">👤 Профиль: ${esc(me || '—')} · сменить</button>` : ''}<div class="sum"><b>Номер оператора WhatsApp</b><input id="op" inputmode="tel" value="${esc(S.op)}" placeholder="77001234567"><p class="m">Код страны и номер, без + и пробелов</p><b>Города (через запятую)</b><input id="ct" value="${esc(S.cities.join(', '))}"></div><button class="send" style="background:var(--g);box-shadow:none" data-a="ss">Сохранить</button><button class="ghost" data-a="rl">Обновить прайс</button>`;
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
  $('#c').value = H.c || S.cities[0]; H.c = $('#c').value;
}
const shops = () => { if (!$('#sl').hidden) drawDD() };   // обновить открытый список магазинов
function fill() { $('#d').value = H.d || today(); $('#s').value = H.s || ''; $('#a').value = H.a || ''; cities() }

/* ============ 7б. СИНХРОНИЗАЦИЯ, ПОДТВЕРЖДЕНИЕ, ЧЕРНОВИКИ, ПРОФИЛЬ ============ */
let syncing = false, again = false, syncErr = false, syncAt = '';
function syncStatus() { // строка статуса под названием в шапке
  const n = outbox.length + shopq.length, el = $('#sy'); if (!CFG.API_URL) return;
  el.textContent = syncing ? '⏳ Синхронизация…' : syncErr ? '🔴 Нет связи с базой' + (n ? ' · ждут: ' + n : '') + ' (нажмите)' : n ? '⏳ Ждут отправки: ' + n : '✓ Синхронизировано ' + syncAt;
}
async function sync() { // отправляет накопленные заявки и правки магазинов, затем подтягивает торговых, магазины и историю
  if (!CFG.API_URL) return;
  if (syncing) { again = true; return }                 // уже идёт — повторим после
  if (!navigator.onLine) { syncErr = true; syncStatus(); return }
  syncing = true; syncStatus();
  try {
    for (const x of [...shopq]) { // правки магазинов — строго по порядку; при ошибке останавливаемся
      const r = await (await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ key: CFG.API_KEY, shop: x }) })).json();
      if (!r.ok) throw 0; shopq = shopq.filter(y => y !== x); LS('shopq', shopq);
    }
    for (const o of [...outbox]) {
      const r = await (await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify({ key: CFG.API_KEY, order: o }) })).json();
      if (!r.ok) throw 0; outbox = outbox.filter(x => x.id != o.id); LS('outbox', outbox);
    }
    const d = await (await fetch(`${CFG.API_URL}?action=init&key=${encodeURIComponent(CFG.API_KEY)}&trader=${encodeURIComponent(me)}`)).json();
    if (d.error) throw 0; trs = d.traders; if (!shopq.length) base = d.shops;   // пока есть неотправленные правки, локальную базу не затираем
    shist = d.hist; LS('trs', trs); LS('base', base); LS('shist', shist); shops();
    syncErr = false; syncAt = new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { syncErr = true }
  syncing = false; syncStatus();
  if (again) { again = false; return sync() }
}

function checkPending() { // после возврата из WhatsApp спрашиваем, ушла ли заявка
  const o = LS('pending'); if (!o || view == 'pend') return; openSheet('pend', 'Заявка отправлена?');
  $('#sb').innerHTML = `<div class="sum"><b>${esc(o.h.s)}</b><div class="m">${esc(o.h.c || '')} · ${o.sum} ₸</div></div><button class="send" data-a="pyes">✅ Да, отправил</button><button class="ghost" data-a="pno">Нет, вернуться к заявке</button>`;
}
const draftBadge = () => $('#drb').textContent = '📁' + (drafts.length || '');
function draftSave() { // черновик хранит всё состояние заявки; корзина очищается для следующего магазина
  if (!lines().length) return alert('Заявка пуста');
  drafts.unshift({ H: { ...H }, cart: JSON.parse(JSON.stringify(cart)), disc, m: S.mode, n: lines().length, sum: final(), t: Date.now() }); LS('drafts', drafts);
  cart = {}; disc = 0; H.s = ''; H.a = ''; save(); fill(); closeSheet(); drawList(); bar(); draftBadge();
}
function draftView() {
  openSheet('dr', 'Черновики');
  $('#sb').innerHTML = drafts.map((x, i) => `<div class="hi"><div><b>${esc(x.H.s || 'Без названия')}</b><div class="m">${x.n} поз. · ${new Date(x.t).toLocaleString('ru', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</div><b style="color:var(--r)">${x.sum} ₸</b></div><div><button data-a="dopen" data-v="${i}" style="padding:12px 14px">Открыть</button> <button class="x" data-a="ddel" data-v="${i}">✕</button></div></div>`).join('') || '<p class="empty">Черновиков нет</p>';
}
function whoView() {
  openSheet('who', 'Кто вы?');
  $('#sb').innerHTML = trs.map(n => `<button class="send" style="background:var(--g);box-shadow:none;margin:0 0 8px" data-a="me" data-v="${esc(n)}">${esc(n)}</button>`).join('') || '<p class="empty">Список торговых пуст или не загрузился. Добавьте имена на лист «Торговые» и нажмите «Обновить».</p><button class="ghost" data-a="who2">Обновить</button>';
}

/* ============ 7в. СПИСОК МАГАЗИНОВ (поиск, выбор, добавление) ============ */
const norm = t => t.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
let ddL = [], eShop = '';
function shopEditView(i) { // правка / удаление магазина в общей базе
  const x = ddL[i]; eShop = x.n; $('#sl').hidden = true; openSheet('shop', 'Магазин');
  $('#sb').innerHTML = `<div class="sum"><b>Название</b><input id="en" value="${esc(x.n)}"><b>Город</b><select id="ec">${[...new Set([...S.cities, x.c].filter(Boolean))].map(c => `<option ${c == x.c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><b>Адрес</b><input id="ea" value="${esc(x.a)}"></div><button class="send" style="background:var(--g);box-shadow:none" data-a="ssave">Сохранить</button><button class="ghost" style="color:var(--r);border-color:var(--r)" data-a="sdel">Удалить магазин</button>`;
}
function shopList() { // база + магазины из истории, без дублей; магазины текущего города — выше
  const m = new Map(), put = (n, c, a) => { if (!n) return; const k = norm(n), o = m.get(k); if (o) { o.c = o.c || c; o.a = o.a || a } else m.set(k, { n, c: c || '', a: a || '' }) };
  base.forEach(b => put(b.n, b.c, b.a));   // база — единственный источник (иначе удалённый магазин вернулся бы из истории)
  return [...m.values()].sort((x, y) => (y.c == H.c) - (x.c == H.c) || x.n.localeCompare(y.n, 'ru'));
}
function upShop(n, c, a) { if (!n) return; const o = base.find(b => norm(b.n) == norm(n)); if (o) { o.c = o.c || c || ''; o.a = o.a || a || '' } else base.push({ n, c: c || '', a: a || '' }); LS('base', base) }
function addShop(n) { upShop(n, H.c, H.a); if (CFG.API_URL) { shopq.push({ n, c: H.c || '', a: H.a || '' }); LS('shopq', shopq); sync() } }
function drawDD() {
  const raw = $('#s').value.trim(), v = norm(raw); ddL = shopList().filter(x => norm(x.n).includes(v));
  $('#sl').innerHTML = ddL.map((x, i) => `<div class="dr"><button class="di" data-a="pick" data-v="${i}"><b>${esc(x.n)}</b><span class="m">${esc([x.c, x.a].filter(Boolean).join(' · '))}</span></button><button class="ed" data-a="sedit" data-v="${i}" aria-label="Изменить">✏️</button></div>`).join('')
    + (v && !ddL.some(x => norm(x.n) == v) ? `<button class="di add2" data-a="padd">＋ Добавить «${esc(raw)}»</button>` : '')
    || '<p class="m" style="padding:10px">Магазинов пока нет — впишите название</p>';
  $('#sl').hidden = false;
}

/* ============ 8. СОБЫТИЯ ============ */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, p = id && find(id), v = b.dataset.v;
  if (a == 'cat') { cat = v; drawChips(); drawList() }
  else if (a == 'm') setQ(p, qty(p) - step(p)); else if (a == 'p') setQ(p, qty(p) + step(p));
  else if (a == 'rm') { delete cart[id]; save(); bar(); cartView(); drawList() }
  else if (a == 'mode') setMode(v); else if (a == 'cart') cartView(); else if (a == 'hist') histView(); else if (a == 'set') setView();
  else if (a == 'x') { if (e.target == b || b.classList.contains('grab')) { closeSheet(); drawList() } }
  else if (a == 'zoom') { $('#lb img').src = b.dataset.src; $('#lb').classList.add('on') }
  else if (a == 'lbx') $('#lb').classList.remove('on');
  else if (a == 'edit') { editId = id; cartView() }
  else if (a == 'reset') { delete cart[id].p; save(); bar(); cartView() }
  else if (a == 'disc') { disc = +v; save(); bar(); cartView() }
  else if (a == 'new') { if (confirm('Очистить текущую заявку?')) { cart = {}; disc = 0; save(); closeSheet(); drawList() } }
  else if (a == 'send') {
    if (!H.s || !lines().length) return alert('Укажите магазин и добавьте товары');
    const o = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(), trader: me, h: { ...H }, cart: JSON.parse(JSON.stringify(cart)), disc, sum: final(), m: S.mode, text: text(), items: lines().map(p => ({ n: p.n, g: p.g, u: p.u, q: qty(p), p: price(p), o: p.pr })) };
    LS('pending', o); location.href = `https://wa.me/${S.op.replace(/\D/g, '')}?text=${encodeURIComponent(o.text)}`; }
  else if (a == 'clr') { if (confirm('Сбросить все выбранные товары?')) { cart = {}; disc = 0; save(); bar(); drawList() } }
  else if (a == 'hd') histDetail(+v);
  else if (a == 'hcopy') { try { navigator.clipboard.writeText(allHist()[v].text || '').then(() => alert('Текст скопирован')) } catch (e) { alert('Не удалось скопировать') } }
  else if (a == 'sedit') shopEditView(+v);
  else if (a == 'ssave') { const n = $('#en').value.trim().replace(/\s+/g, ' '), c = $('#ec').value, ad = $('#ea').value.trim(); if (!n) return;
    if (norm(n) != norm(eShop) && base.some(b => norm(b.n) == norm(n))) return alert('Магазин с таким названием уже есть');
    const o = base.find(b => norm(b.n) == norm(eShop)); if (o) { o.n = n; o.c = c; o.a = ad } else base.push({ n, c, a: ad }); LS('base', base);
    if (norm(H.s) == norm(eShop)) { H.s = n; H.a = ad; H.c = c; cities(); $('#s').value = n; $('#a').value = ad; save() }
    if (CFG.API_URL) { shopq.push({ op: 'edit', old: eShop, n, c, a: ad }); LS('shopq', shopq); sync() } closeSheet() }
  else if (a == 'sdel') { if (!confirm('Удалить магазин «' + eShop + '» из общей базы? Старые заявки сохранятся.')) return;
    base = base.filter(b => norm(b.n) != norm(eShop)); LS('base', base);
    if (norm(H.s) == norm(eShop)) { H.s = ''; H.a = ''; $('#s').value = ''; $('#a').value = ''; save() }
    if (CFG.API_URL) { shopq.push({ op: 'del', old: eShop }); LS('shopq', shopq); sync() } closeSheet() }
  else if (a == 'pick') { const x = ddL[v]; H.s = x.n; H.a = x.a || ''; if (x.c) { H.c = x.c; cities() } $('#s').value = H.s; $('#a').value = H.a; save(); $('#sl').hidden = true }
  else if (a == 'padd') { const n = $('#s').value.trim().replace(/\s+/g, ' '); if (!n) return; H.s = n; $('#s').value = n; addShop(n); save(); $('#sl').hidden = true }
  else if (a == 'pyes') { const o = LS('pending'); localStorage.removeItem('pending'); if (!o) return;
    const h = LS('hist') || []; h.unshift(o); LS('hist', h.slice(0, 50)); outbox.push(o); LS('outbox', outbox); upShop(o.h.s, o.h.c, o.h.a);   // новый магазин сразу попадает в список
    cart = {}; disc = 0; H.s = ''; H.a = ''; save(); fill(); shops(); closeSheet(); drawList(); bar(); sync() }
  else if (a == 'pno') { localStorage.removeItem('pending'); closeSheet() }
  else if (a == 'drafts') draftView(); else if (a == 'dsave') draftSave();
  else if (a == 'dopen') { if (lines().length && !confirm('Текущая заявка будет заменена. Продолжить?')) return;
    const x = drafts.splice(v, 1)[0]; LS('drafts', drafts); if (x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() }
    cart = x.cart; disc = x.disc; H = { ...x.H }; save(); fill(); closeSheet(); drawList(); bar(); draftBadge() }
  else if (a == 'ddel') { drafts.splice(v, 1); LS('drafts', drafts); draftBadge(); draftView() }
  else if (a == 'who2') sync().then(whoView); else if (a == 'who') whoView(); else if (a == 'me') { me = v; LS('me', me); closeSheet(); sync() }
  else if (a == 'rep') { const x = allHist()[v]; if (x.m && x.m != S.mode) { S.mode = x.m; LS('set', S); applyMode(); drawSeg() } cart = x.cart; disc = x.disc; H = { ...x.h, d: today() }; save(); fill(); closeSheet(); drawList() }
  else if (a == 'ss') { S.op = $('#op').value; S.cities = $('#ct').value.split(',').map(s => s.trim()).filter(Boolean); LS('set', S); cities(); closeSheet() }
  else if (a == 'rl') { load(); closeSheet() }
});
document.addEventListener('change', e => { const t = e.target;
  if (t.dataset.q !== undefined) setQ(find(t.dataset.q), num(t.value));
  else if (t.dataset.np !== undefined) { const n = num(t.value), id = t.dataset.np; if (n > 0) { n == find(id).pr ? delete cart[id].p : cart[id].p = n; save() } editId = ''; bar(); cartView() }
  else if (t.id == 'dc') { disc = Math.min(100, num(t.value)); save(); bar(); cartView() } });
$('#q').oninput = e => { Q = e.target.value.toLowerCase(); drawList() };
['d', 's', 'a'].forEach(k => $('#' + k).addEventListener('change', e => { H[k] = e.target.value;
  if (k == 's') { // название магазина приводим к записи из общей базы, подставляем город и адрес
    const v = H.s.trim().replace(/\s+/g, ' '), b = base.find(x => x.n.toLowerCase() == v.toLowerCase()); H.s = b ? b.n : v; $('#s').value = H.s;
    if (b) { H.a = b.a || H.a; if (b.c) { H.c = b.c; cities() } $('#a').value = H.a || '' } }
  save() }));
$('#c').onchange = e => { if (e.target.value == '+') { const n = (prompt('Название города') || '').trim(); if (n) { S.cities.push(n); LS('set', S); H.c = n } cities() } else H.c = e.target.value; save() };

/* ============ 9. СТАРТ ============ */
$('#s').addEventListener('focus', drawDD); $('#s').addEventListener('input', e => { H.s = e.target.value; save(); drawDD() });
$('#sl').addEventListener('pointerdown', e => e.preventDefault());   // не терять фокус поля при тапе по списку
document.addEventListener('click', e => { if (!e.target.closest('.cb')) $('#sl').hidden = true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkPending(); sync() } });
window.addEventListener('online', sync); window.addEventListener('offline', () => { syncErr = true; syncStatus() });
$('#sy').addEventListener('click', () => sync());
drawSeg(); fill(); shops(); draftBadge(); syncStatus(); load(); checkPending();
sync().then(() => { if (CFG.API_URL && !me && !LS('pending')) whoView() });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
