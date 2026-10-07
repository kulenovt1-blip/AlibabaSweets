/* ============ 1. НАСТРОЙКИ (меняйте только здесь) ============ */
const CFG = {
  SHEET_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGyNVUyAyeZVoafaazZmZEQbtmmcyqXV5AJBYxhq1_4SELUbFuujtEr9XHfp9XCLktXud9Sc2Czmf_/pub?gid=928244906&single=true&output=csv',                 // ← ссылка на опубликованный CSV Google Таблицы (см. README.md)
  OPERATOR: '77474331973',       // номер оператора WhatsApp: код страны + номер, без + и пробелов
  CITIES: ['Петропавловск', 'Астана', 'Костанай']
};
// Колонки таблицы: категория | название | граммовка | цена | единица (шт/кг/кор) | ссылка на фото
const DEMO = [['Финики','Финики Ар-Раяна','400г','1500','шт',''],['Финики','Финики Ар-Раяна','600г','2100','шт',''],
  ['Напитки','Компот','1кг','1000','шт',''],['Орехи','Грецкий орех','1кг','4200','кг','']];

/* ============ 2. ХЕЛПЕРЫ И СОСТОЯНИЕ ============ */
const $ = s => document.querySelector(s);
const LS = (k, v) => v === undefined ? JSON.parse(localStorage.getItem(k) || 'null') : localStorage.setItem(k, JSON.stringify(v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const num = v => parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0; // «1 500 ₸» → 1500
const qf = n => String(+n.toFixed(2));
const fd = d => d ? +d.slice(8) + '.' + +d.slice(5, 7) : '';           // 2026-10-09 → 9.10
let P = [], cart = LS('cart') || {}, disc = LS('disc') || 0, H = LS('hdr') || { d: today() },
    S = LS('set') || { op: CFG.OPERATOR, cities: CFG.CITIES }, cat = 'Все', Q = '', view = '', editId = '';
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
  u = (u || '').trim(); const m = u.match(/\/d\/([\w-]+)|[?&]id=([\w-]+)/);
  return u.includes('drive.google') && m ? `https://drive.google.com/thumbnail?id=${m[1] || m[2]}&sz=w600` : u;
}
const toProducts = rows => rows.slice(1).filter(r => r[1] && num(r[3]) > 0).map(r =>
  ({ c: r[0].trim() || 'Прочее', n: r[1].trim(), g: (r[2] || '').trim(), pr: num(r[3]), u: (r[4] || 'шт').trim() || 'шт', f: photo(r[5]) }));
async function load() {
  let rows, err = '';
  if (CFG.SHEET_CSV) {
    try {
      const r = await fetch(CFG.SHEET_CSV, { cache: 'no-store' }), t = await r.text();
      if (!r.ok || /<html|<!doctype/i.test(t.slice(0, 300))) throw new Error('ссылка ведёт не на CSV. Нужна ссылка из «Опубликовать в интернете» → формат CSV');
      rows = parseCSV(t);
      if (!toProducts(rows).length) throw new Error('в таблице нет строк с названием и ценой (проверьте порядок колонок и заголовок в 1-й строке)');
      LS('prod', rows);
    } catch (e) { err = e.message == 'Failed to fetch' ? (location.protocol == 'file:' ? 'страница открыта как файл (file://) — браузер блокирует запросы к Google. Откройте сайт по ссылке с хостинга (https://)' : 'браузер не смог загрузить таблицу (адрес страницы: ' + location.origin + '). Возможна блокировка расширением, VPN или встроенным браузером мессенджера — откройте ссылку в Chrome') : e.message; rows = LS('prod'); }
  }
  P = toProducts(rows || LS('prod') || [[], ...DEMO]); drawChips(); drawList(); bar(); note(err, !CFG.SHEET_CSV);
}
function note(err, demo) { // плашка со статусом прайса
  let n = $('#note'); if (!n) { n = document.createElement('div'); n.id = 'note'; n.style.cssText = 'margin:6px 12px;padding:10px 14px;border-radius:14px;font-weight:800;font-size:14px'; $('#list').before(n) }
  n.hidden = !err && !demo;
  n.style.background = err ? '#fde0de' : '#fff3c4'; n.style.color = err ? '#C82B27' : '#6b5200';
  n.textContent = err ? 'Прайс не загружен: ' + err : 'Показаны демо-товары: в app.js не указана ссылка на таблицу';
}

/* ============ 4. КАТАЛОГ ============ */
function drawChips() {
  $('#chips').innerHTML = ['Все', ...new Set(P.map(p => p.c))].map(c =>
    `<button class="chip${c == cat ? ' on' : ''}" data-a="cat" data-v="${esc(c)}">${c == 'Все' ? '✨' : icon(c)} ${esc(c)}</button>`).join('');
}
const ctl = p => { const id = esc(pid(p)), q = qty(p);   // кнопка «В заявку» или степпер
  return q ? `<div class="st"><button data-a="m" data-id="${id}">−</button><input data-q="${id}" inputmode="decimal" value="${qf(q)}"><button data-a="p" data-id="${id}">+</button></div>`
           : `<button class="add" data-a="p" data-id="${id}">＋ В заявку</button>`; };
function drawList() {
  const l = P.filter(p => (cat == 'Все' || p.c == cat) && p.n.toLowerCase().includes(Q)), el = $('#list');
  el.innerHTML = l.map((p, i) => `<article class="pc" style="--i:${Math.min(i, 8)}"><button class="ph" data-a="zoom" data-src="${esc(p.f || 'logo.jpg')}"><img src="${esc(p.f || 'logo.jpg')}" onerror="this.src='logo.jpg'" loading="lazy" alt="">${p.g ? `<span class="tag">${esc(p.g)}</span>` : ''}</button><div class="pb"><b>${esc(p.n)}</b><span class="pr">${p.pr} ₸ <small>/ ${p.u}</small></span><div class="ctl" data-c="${esc(pid(p))}">${ctl(p)}</div></div></article>`).join('') || '<p class="empty">Ничего не найдено</p>';
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
  const n = lines().length; $('#bar').classList.toggle('off', !n || view != '' && view != undefined && document.body.classList.contains('sh'));
  $('#bn').textContent = '🛒 ' + n + ' поз.'; $('#bs').textContent = final() + ' ₸';
  if (bump) { const b = $('#bar'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump') }
}

/* ============ 5. ТЕКСТ ЗАЯВКИ (строгий формат) ============ */
function text() {
  let t = `Заявка на ${fd(H.d)} (${H.c || ''}) магазин ${H.s || ''}, ${H.a || ''}\n`;
  lines().forEach(p => { const n = price(p);
    t += `${p.n}${p.g ? `(${p.g})` : ''} - ${qf(qty(p))}${p.u}${n != p.pr ? ` по ${n} (было ${p.pr})` : ''};\n`; });
  return t + (disc > 0 ? `Сумма.${total()}\nИтого со скидкой.${final()}` : `Итого.${total()}`);
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
  `<div class="sum"><b>Скидка на весь чек</b><div class="dc">${[0, 3, 5, 10].map(x => `<button data-a="disc" data-v="${x}" class="${disc == x ? 'on' : ''}">${x ? x + '%' : 'Нет'}</button>`).join('')}<input id="dc" inputmode="decimal" placeholder="свой %" value="${[0, 3, 5, 10].includes(disc) ? '' : disc}"></div>
  <div class="r"><span>Сумма</span><b>${total()} ₸</b></div>${disc > 0 ? `<div class="r"><span>Скидка ${disc}%</span><b>−${total() - final()} ₸</b></div>` : ''}<div class="r t"><span>Итого</span><span>${final()} ₸</span></div></div>
  <button class="send" data-a="send">📲 Отправить в WhatsApp</button><button class="ghost" data-a="new">Новая заявка</button>`;
  const np = document.querySelector('[data-np]'); if (np) np.select();
}
function histView() {
  openSheet('hist', 'История заявок'); const h = LS('hist') || [];
  $('#sb').innerHTML = h.map((x, i) => `<div class="hi"><div><b>${esc(x.h.s || '—')}</b><div class="m">${fd(x.h.d)} · ${esc(x.h.c || '')}</div><b style="color:var(--r)">${x.sum} ₸</b></div><button data-a="rep" data-v="${i}" style="padding:14px 16px">Повторить</button></div>`).join('') || '<p class="empty">Отправленных заявок пока нет</p>';
}
function setView() {
  openSheet('set', 'Настройки');
  $('#sb').innerHTML = `<div class="sum"><b>Номер оператора WhatsApp</b><input id="op" inputmode="tel" value="${esc(S.op)}" placeholder="77001234567"><p class="m">Код страны и номер, без + и пробелов</p><b>Города (через запятую)</b><input id="ct" value="${esc(S.cities.join(', '))}"></div><button class="send" style="background:var(--g);box-shadow:none" data-a="ss">Сохранить</button><button class="ghost" data-a="rl">Обновить прайс</button>`;
}

/* ============ 7. ШАПКА ЗАЯВКИ ============ */
function cities() {
  if (H.c && !S.cities.includes(H.c)) { S.cities.push(H.c); LS('set', S) }
  $('#c').innerHTML = S.cities.map(c => `<option>${esc(c)}</option>`).join('') + '<option value="+">＋ Другой город…</option>';
  $('#c').value = H.c || S.cities[0]; H.c = $('#c').value;
}
const shops = () => { const u = [...new Set((LS('hist') || []).map(x => x.h.s).filter(Boolean))]; $('#shops').innerHTML = u.map(s => `<option>${esc(s)}</option>`).join('') };
function fill() { $('#d').value = H.d || today(); $('#s').value = H.s || ''; $('#a').value = H.a || ''; cities() }

/* ============ 8. СОБЫТИЯ ============ */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, p = id && find(id), v = b.dataset.v;
  if (a == 'cat') { cat = v; drawChips(); drawList() }
  else if (a == 'm') setQ(p, qty(p) - step(p)); else if (a == 'p') setQ(p, qty(p) + step(p));
  else if (a == 'rm') { delete cart[id]; save(); bar(); cartView(); drawList() }
  else if (a == 'cart') cartView(); else if (a == 'hist') histView(); else if (a == 'set') setView();
  else if (a == 'x') { if (e.target == b || b.classList.contains('grab')) { closeSheet(); drawList() } }
  else if (a == 'zoom') { $('#lb img').src = b.dataset.src; $('#lb').classList.add('on') }
  else if (a == 'lbx') $('#lb').classList.remove('on');
  else if (a == 'edit') { editId = id; cartView() }
  else if (a == 'reset') { delete cart[id].p; save(); bar(); cartView() }
  else if (a == 'disc') { disc = +v; save(); bar(); cartView() }
  else if (a == 'new') { if (confirm('Очистить текущую заявку?')) { cart = {}; disc = 0; save(); closeSheet(); drawList() } }
  else if (a == 'send') {
    if (!H.s || !lines().length) return alert('Укажите магазин и добавьте товары');
    const h = LS('hist') || []; h.unshift({ h: { ...H }, cart: JSON.parse(JSON.stringify(cart)), disc, sum: final() }); LS('hist', h.slice(0, 50)); shops();
    location.href = `https://wa.me/${S.op.replace(/\D/g, '')}?text=${encodeURIComponent(text())}`; }
  else if (a == 'rep') { const x = (LS('hist') || [])[v]; cart = x.cart; disc = x.disc; H = { ...x.h, d: today() }; save(); fill(); closeSheet(); drawList() }
  else if (a == 'ss') { S.op = $('#op').value; S.cities = $('#ct').value.split(',').map(s => s.trim()).filter(Boolean); LS('set', S); cities(); closeSheet() }
  else if (a == 'rl') { load(); closeSheet() }
});
document.addEventListener('change', e => { const t = e.target;
  if (t.dataset.q !== undefined) setQ(find(t.dataset.q), num(t.value));
  else if (t.dataset.np !== undefined) { const n = num(t.value), id = t.dataset.np; if (n > 0) { n == find(id).pr ? delete cart[id].p : cart[id].p = n; save() } editId = ''; bar(); cartView() }
  else if (t.id == 'dc') { disc = Math.min(100, num(t.value)); save(); bar(); cartView() } });
$('#q').oninput = e => { Q = e.target.value.toLowerCase(); drawList() };
['d', 's', 'a'].forEach(k => $('#' + k).addEventListener('change', e => { H[k] = e.target.value;
  if (k == 's' && !H.a) { const m = (LS('hist') || []).find(x => x.h.s == H.s); if (m) { H.a = m.h.a; $('#a').value = H.a } } save() }));
$('#c').onchange = e => { if (e.target.value == '+') { const n = (prompt('Название города') || '').trim(); if (n) { S.cities.push(n); LS('set', S); H.c = n } cities() } else H.c = e.target.value; save() };

/* ============ 9. СТАРТ ============ */
fill(); shops(); load();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
