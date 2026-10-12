/* Али-Баба: приём заявок. Вставьте в Расширения → Apps Script ТОЙ ЖЕ таблицы, где лежит прайс. */
const KEY = '3puq8z64';   // тот же ключ, что API_KEY в app.js
const SRV = 23;           // версия серверной части (видна в «Настройки → Диагностика»)
const SHOP_HEAD = ['Магазин', 'Город', 'Адрес', 'ID', 'Статус', 'Заметка', 'Кем (статус)', 'Когда (статус, мс)', 'Контакт', 'Телефон', 'Район', 'Посл. заказ (мс)', 'Посл. визит (мс)', 'Итог визита', 'Кем (визит)'];

function doGet(e) {                      // отдаёт торговых, магазины, получателей и историю: окно «7 дней у всех / 30 дней свои» или заявки за выбранный день
  const p = e.parameter; if (p.key !== KEY) return out({ error: 'key' });
  const undo = (+p.undo || 24) * 36e5, now = Date.now(), D = 864e5;
  if (p.action === 'range') {            // заявки всех торговых, созданные в [from, to) — для старых дней по запросу
    const from = +p.from, to = +p.to; if (!(from > 0) || !(to > from) || to - from > 40 * D) return out({ error: 'range' });
    return out({ hist: ordersIn(from, to, undo, now).reverse() });
  }
  if (p.action === 'visits') return out({ log: visitsOf(String(p.sid || ''), String(p.name || ''), Math.min(+p.limit || 15, 50)) });   // журнал отметок одного магазина
  if (p.action !== 'init') return out({ error: 'action' });
  const traders = sh('Торговые').getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean);
  const shops = ensureIds().map(pub);
  // окно: заявки всех торговых за 7 дней + свои (и заявки без торгового) за 30 дней; всё остальное приложение запрашивает по дню (action=range)
  const hist = ordersIn(now - 30 * D, now + D, undo, now).filter(o => (+o.ts || 0) >= now - 7 * D || !o.trader || o.trader === p.trader);
  return out({ srv: SRV, traders, shops, rcp: recipients(), hist: hist.reverse() });
}
function ordersIn(from, to, undo, now) { // заявки, созданные в [from, to). Читаем только нужный участок листа, а не всё подряд
  const s = sh('Заявки'), n = s.getLastRow(); if (n < 2) return [];
  const isD = v => Object.prototype.toString.call(v) === '[object Date]', ms = v => isD(v) ? v.getTime() : (+v || 0);
  const A = s.getRange(2, 1, n - 1, 1).getValues(), D = 864e5; let a = -1, b = -1;   // колонка A — время записи на сервере (позже или равно времени создания)
  for (let i = 0; i < A.length; i++) { const t = ms(A[i][0]); if (a < 0 && t >= from - D) a = i; if (t < to + 3 * D) b = i }   // запас: часы телефона и заявки, отправленные с задержкой
  if (a < 0 || b < a) return [];
  const rows = [];
  s.getRange(a + 2, 1, b - a + 1, 14).getValues().forEach(r => {
    const dl = (+r[13] || 0) || (isD(r[12]) ? r[12].getTime() : 0); if (dl && now - dl > undo) return;   // время удаления: число из колонки N (запасной вариант — дата из M)
    try { const o = JSON.parse(r[11]), t = +o.ts || ms(r[0]); if (t < from || t >= to) return; o.del = dl; rows.push(o) } catch (_) {} });
  return rows;
}
function doPost(e) {                     // записывает заявку, визит или правку магазина (повтор того же ID игнорируется)
  const d = JSON.parse(e.postData.contents); if (d.key !== KEY) return out({ error: 'key' });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (d.shop) { const x = d.shop;
      if (x.op == 'del') delShop(x.old, x.id); else if (x.op == 'edit') editShop(x.old, x.n, x.c, x.a, x.id);
      else if (x.op == 'status') setStatus(x); else if (x.op == 'info') setInfo(x); else upShop(x.n, x.c, x.a, x.id);
      return out({ ok: 1 }) }
    if (d.visit) { addVisit(d.visit); return out({ ok: 1 }) }
    if (d.orderOp) { const r = setDeleted(d.orderOp.id, d.orderOp.del, d.orderOp.trader); return out({ ok: 1, applied: r.applied, reason: r.reason, owner: r.owner }) }   // удаление / возврат заявки
    const o = d.order, s = sh('Заявки');
    const ids = s.getLastRow() > 1 ? s.getRange(2, 2, s.getLastRow() - 1, 1).getValues().flat() : [];
    const ix = ids.indexOf(o.id);
    if (ix >= 0 && o.ed) return out(editOrder(s, ix + 2, o));   // правка существующей заявки
    if (ix < 0) {
      s.appendRow([new Date(), o.id, o.trader, o.h.d, o.h.c, o.h.s, o.h.a, o.m == 'vat' ? 'с НДС' : 'без НДС', o.disc, o.sum, o.text, JSON.stringify(o)]);
      const r = upShop(o.h.s, o.h.c, o.h.a, o.h.sid);        // новый магазин попадает в общую базу
      if (r) { const m = shopSheet(); if ((+o.ts || 0) > (+m.getRange(r, 12).getValue() || 0)) m.getRange(r, 12).setValue(+o.ts || Date.now()) }   // «посл. заказ»
    }
    return out({ ok: 1 });
  } finally { lock.releaseLock() }
}
const EDIT_H = 24;                       // сколько часов после создания заявку можно менять
function editOrder(s, row, o) {          // заменяет содержимое заявки; правит только владелец, не позже EDIT_H часов после создания
  const owner = String(s.getRange(row, 3).getValue()).trim(); let old = {}; try { old = JSON.parse(s.getRange(row, 12).getValue()) } catch (_) {}
  if (owner && String(o.trader).trim() !== owner) return { ok: 1, applied: false, reason: 'not_owner' };
  if ((+o.ed || 0) - (+old.ts || 0) > EDIT_H * 36e5 + 5 * 6e4) return { ok: 1, applied: false, reason: 'too_late' };
  if ((+old.ed || 0) >= +o.ed) return { ok: 1, applied: false, reason: 'stale' };     // более новая правка уже записана
  s.getRange(row, 4, 1, 9).setValues([[o.h.d, o.h.c, o.h.s, o.h.a, o.m == 'vat' ? 'с НДС' : 'без НДС', o.disc, o.sum, o.text, JSON.stringify(o)]]);
  upShop(o.h.s, o.h.c, o.h.a, o.h.sid);
  return { ok: 1, applied: true };
}
function setDeleted(id, ts, trader) {   // помечает заявку удалённой (строка остаётся) или снимает пометку; честно возвращает результат
  const s = sh('Заявки'), n = s.getLastRow(); if (n < 2) return { applied: false, reason: 'not_found' };
  if (!s.getRange(1, 13).getValue()) s.getRange(1, 13).setValue('Удалена');
  if (!s.getRange(1, 14).getValue()) s.getRange(1, 14).setValue('Удалена (мс)');
  const i = s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)); if (i < 0) return { applied: false, reason: 'not_found' };
  const owner = String(s.getRange(i + 2, 3).getValue()).trim();
  if (trader && owner && owner !== String(trader).trim()) return { applied: false, reason: 'not_owner', owner };   // чужую заявку удалить нельзя (у заявок без профиля владельца нет)
  if (ts) {
    s.getRange(i + 2, 13).setValue(Utilities.formatDate(new Date(ts), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm'));   // для людей
    s.getRange(i + 2, 14).setValue(ts);                                                                                                              // для приложения (число, без часовых поясов)
  } else { s.getRange(i + 2, 13, 1, 2).clearContent() }
  return { applied: true };
}

/* ---------- Магазины: ID, статусы, контакты, последний заказ и визит ---------- */
const same = (a, b) => String(a).trim().toLowerCase().replace(/ё/g, 'е') == String(b).trim().toLowerCase().replace(/ё/g, 'е');
const newId = () => 's' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
function shopSheet() {                   // лист «Магазины»: при необходимости достраиваем колонки и заголовки (старые таблицы обновляются сами)
  const s = sh('Магазины'), k = SHOP_HEAD.length;
  if (s.getMaxColumns() < k) s.insertColumnsAfter(s.getMaxColumns(), k - s.getMaxColumns());
  const h = s.getRange(1, 1, 1, k).getValues()[0]; let ch = false;
  SHOP_HEAD.forEach((t, i) => { if (!h[i]) { h[i] = t; ch = true } });
  if (ch) s.getRange(1, 1, 1, k).setValues([h]);
  return s;
}
function readShops() {
  const s = shopSheet(), n = s.getLastRow(); if (n < 2) return [];
  const L = x => +x || 0, T = x => String(x == null ? '' : x).trim();
  return s.getRange(2, 1, n - 1, SHOP_HEAD.length).getValues().map((r, i) => ({ r: i + 2, n: T(r[0]), c: T(r[1]), a: T(r[2]), id: T(r[3]), st: T(r[4]), nt: T(r[5]), sb: T(r[6]), sa: L(r[7]),
    ct: T(r[8]), tl: T(r[9]), rg: T(r[10]), lo: L(r[11]), lv: L(r[12]), lb: T(r[13]), lw: T(r[14]) })).filter(x => x.n);
}
const pub = x => ({ id: x.id, n: x.n, c: x.c, a: x.a, st: x.st, nt: x.nt, sb: x.sb, sa: x.sa, ct: x.ct, tl: x.tl, rg: x.rg, lo: x.lo, lv: x.lv, lb: x.lb, lw: x.lw });
function ensureIds() {                   // каждому магазину без ID присваиваем его (один раз; под блокировкой)
  let list = readShops(); if (!list.some(x => !x.id)) return list;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { list = readShops(); const s = shopSheet(); list.forEach(x => { if (!x.id) { x.id = newId(); s.getRange(x.r, 4).setValue(x.id) } }) } finally { lock.releaseLock() }
  return list;
}
const findShop = (list, id, name, city) => (id && list.find(x => x.id == id)) || (name && list.find(x => same(x.n, name) && (!city || !x.c || same(x.c, city)))) || null;   // одинаковое название в разных городах — разные магазины
function upShop(n, c, a, id) {           // находит магазин (по ID, затем по названию) или создаёт; возвращает номер строки
  n = String(n || '').trim(); if (!n) return 0;
  const s = shopSheet(), list = readShops(), x = findShop(list, id, n, c);
  if (x) { if (!x.c && c) s.getRange(x.r, 2).setValue(c); if (!x.a && a) s.getRange(x.r, 3).setValue(a);
    if (!x.id) s.getRange(x.r, 4).setValue(id && !list.some(y => y.id == id) ? String(id) : newId());
    return x.r }
  s.appendRow([n, c || '', a || '', id && !list.some(y => y.id == id) ? String(id) : newId()]);
  return s.getLastRow();
}
function delShop(old, id) {              // удаляет магазин из общей базы (заявки и журнал не трогает)
  const s = shopSheet(), list = readShops();
  list.filter(x => (id && x.id == id) || same(x.n, old)).map(x => x.r).sort((a, b) => b - a).forEach(r => s.deleteRow(r));
}
function editShop(old, n, c, a, id) {    // меняет название, город и адрес (ID, статус и контакты сохраняются)
  const s = shopSheet(), x = findShop(readShops(), id, old);
  if (x) s.getRange(x.r, 1, 1, 3).setValues([[n, c || '', a || '']]); else upShop(n, c, a, id);
}
function setStatus(x) {                  // статус магазина + запись в журнал; повтор той же отметки (rid) игнорируется
  if (x.rid && hasLog(x.rid)) return;
  const r = upShop(x.n, x.c, x.a, x.id); if (!r) return;
  const s = shopSheet(), at = +x.at || Date.now();
  if (at >= (+s.getRange(r, 8).getValue() || 0)) s.getRange(r, 5, 1, 4).setValues([[x.st || '', x.nt || '', x.by || '', at]]);   // старая отметка из офлайн-очереди не затирает более новую
  logRow(x.rid || newId(), x.n, x.id, x.by, 'status', x.st || '', x.nt || '', at);
}
function setInfo(x) {                    // контакт, телефон, район
  const r = upShop(x.n, x.c, x.a, x.id); if (r) shopSheet().getRange(r, 9, 1, 3).setValues([[x.ct || '', x.tl || '', x.rg || '']]);
}
function addVisit(v) {                   // визит: строка в журнале + «посл. визит» магазина
  if (v.id && hasLog(v.id)) return;
  const r = upShop(v.shop, v.c, v.a, v.sid), ts = +v.ts || Date.now();
  logRow(v.id || newId(), v.shop, v.sid, v.trader, 'visit', v.val || '', v.note || '', ts);
  if (r) { const s = shopSheet(); if (ts >= (+s.getRange(r, 13).getValue() || 0)) s.getRange(r, 13, 1, 3).setValues([[ts, v.val || '', v.trader || '']]) }
}
function logRow(id, shop, sid, who, kind, val, note, ts) { sh('Визиты').appendRow([new Date(), id, shop, sid || '', who || '', kind, val, note, ts]) }
function hasLog(id) { const s = sh('Визиты'), n = s.getLastRow(); return n > 1 && s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)) >= 0 }
function visitsOf(sid, name, limit) {    // последние отметки по магазину (новые сверху)
  const s = sh('Визиты'), n = s.getLastRow(); if (n < 2) return [];
  const v = s.getRange(2, 3, n - 1, 7).getValues(), res = [];   // колонки C..I
  for (let i = v.length - 1; i >= 0 && res.length < limit; i--) { const r = v[i];
    if ((sid && String(r[1]) === sid) || (name && same(r[0], name))) res.push({ ts: +r[6] || 0, who: String(r[2]), kind: String(r[3]), val: String(r[4]), nt: String(r[5]) }) }
  return res;
}

/* ---------- Получатели заявок (лист «Получатели»: имя, телефон, города, по умолчанию) ---------- */
function recipients() {
  return sh('Получатели').getDataRange().getValues().slice(1).map(r => {
    let p = String(r[1]).replace(/\D/g, ''); if (p.length == 11 && p[0] == '8') p = '7' + p.slice(1);   // 8 7xx… → 7 7xx…
    return { n: String(r[0]).trim(), p, c: String(r[2] || '').split(/[,;]/).map(x => x.trim()).filter(Boolean), d: /^(да|yes|y|1|\+|x|true)$/i.test(String(r[3]).trim()) } }).filter(x => x.n && x.p);
}

function sh(n) {                         // лист создаётся автоматически с заголовками
  const ss = SpreadsheetApp.getActive(); let s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow({ 'Торговые': ['Имя'], 'Магазины': SHOP_HEAD,
    'Заявки': ['Время', 'ID', 'Торговый', 'Дата', 'Город', 'Магазин', 'Адрес', 'Режим цен', 'Скидка %', 'Итого', 'Текст', 'JSON', 'Удалена', 'Удалена (мс)'],
    'Визиты': ['Время', 'ID', 'Магазин', 'ID магазина', 'Торговый', 'Тип', 'Значение', 'Заметка', 'Время (мс)'],
    'Получатели': ['Имя', 'Телефон', 'Города (через запятую; пусто = все)', 'По умолчанию (да)'] }[n]) }
  return s;
}
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
