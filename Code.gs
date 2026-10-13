/* Али-Баба: приём заявок. Вставьте в Расширения → Apps Script ТОЙ ЖЕ таблицы, где лежит прайс.
 *
 * v26 — согласованность заказов, визитов, статусов и сводок магазинов.
 *  • «Посл. заказ» магазина = максимум ДАТЫ ОФОРМЛЕНИЯ (o.ts) среди действующих (не удалённых) заявок магазина. Дата поставки — отдельное поле.
 *  • Лист «Визиты» — общий журнал событий. Тип записи (колонка «Тип»): visit, status, order_create, order_edit, order_cancel, order_restore.
 *  • Визиты не удаляются физически: «отмена» = состояние cancelled, предыдущие данные хранятся в колонке «История изменений (JSON)».
 *  • Все операции идут по постоянному ID события и безопасны при повторной отправке.
 *  • Сводка магазина (посл. заказ / посл. визит) всегда ПЕРЕСЧИТЫВАЕТСЯ из записей (recalcShops), а не «двигается» инкрементом.
 *  • Сверка старых данных: reconcileDryRun() (ничего не меняет, пишет отчёт в лист «Сверка») и reconcileApply() (после просмотра отчёта). */
const KEY = '3puq8z64';   // тот же ключ, что API_KEY в app.js
const SRV = 26;           // версия серверной части (видна в «Настройки → Диагностика»)
const SHOP_HEAD = ['Магазин', 'Город', 'Адрес', 'ID', 'Статус', 'Заметка', 'Кем (статус)', 'Когда (статус, мс)', 'Контакт', 'Телефон', 'Район', 'Посл. заказ (мс)', 'Посл. визит (мс)', 'Итог визита', 'Кем (визит)', 'Тип', 'План визита (мс)', 'Открытый вопрос'];
const ORD_HEAD = ['Время', 'ID', 'Торговый', 'Дата', 'Город', 'Магазин', 'Адрес', 'Режим цен', 'Скидка %', 'Итого', 'Текст', 'JSON', 'Удалена', 'Удалена (мс)', 'ID магазина', 'Оформлена (мс)'];
const JR_HEAD = ['Время', 'ID', 'Магазин', 'ID магазина', 'Торговый', 'Тип', 'Значение', 'Заметка', 'Время (мс)', 'Состояние', 'Изменил', 'Изменено (мс)', 'История изменений (JSON)', 'ID заявки'];
const FUT = 10 * 6e4, OLDV = 400 * 864e5;   // визит из будущего (> 10 мин) и старше ~400 дней сервер не принимает

// Любая ошибка скрипта возвращается как понятный JSON, а не как страница ошибки Google (её браузер показывает как «нет связи»)
function doGet(e) { try { return doGet_(e) } catch (err) { return out({ error: 'server: ' + (err && err.message || err) }) } }
function doPost(e) { try { return doPost_(e) } catch (err) { return out({ error: 'server: ' + (err && err.message || err) }) } }
function doGet_(e) {                     // отдаёт торговых, магазины, получателей и историю: окно «7 дней у всех / 30 дней свои» или заявки за выбранный день
  const p = e.parameter; if (p.key !== KEY) return out({ error: 'key' });
  const undo = (+p.undo || 24) * 36e5, now = Date.now(), D = 864e5;
  if (p.action === 'range') {            // заявки всех торговых, созданные в [from, to) — для старых дней по запросу
    const from = +p.from, to = +p.to; if (!(from > 0) || !(to > from) || to - from > 40 * D) return out({ error: 'range' });
    return out({ hist: ordersIn(from, to, undo, now).reverse() });
  }
  if (p.action === 'visits') return out({ log: visitsOf(String(p.sid || ''), String(p.name || ''), Math.min(+p.limit || 15, 50)), mine: myVisit(String(p.sid || ''), String(p.name || ''), String(p.me || '')) });   // для клиентов до v26: только действующие отметки
  if (p.action === 'timeline') return out(timeline(String(p.sid || ''), String(p.name || ''), String(p.me || ''), Math.min(+p.limit || 60, 200)));   // v26: общая лента магазина
  if (p.action !== 'init') return out({ error: 'action' });
  const traders = sh('Торговые').getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean);
  const shops = ensureIds().map(pub);
  // окно: заявки всех торговых за 7 дней + свои (и заявки без торгового) за 30 дней; всё остальное приложение запрашивает по дню (action=range)
  const hist = ordersIn(now - 30 * D, now + D, undo, now).filter(o => (+o.ts || 0) >= now - 7 * D || !o.trader || o.trader === p.trader);
  return out({ srv: SRV, traders, shops, rcp: recipients(), hist: hist.reverse() });
}
const isD = v => Object.prototype.toString.call(v) === '[object Date]', ms = v => isD(v) ? v.getTime() : (+v || 0);
function ordersIn(from, to, undo, now) { // заявки, созданные в [from, to). Читаем только нужный участок листа, а не всё подряд
  const s = sh('Заявки'), n = s.getLastRow(); if (n < 2) return [];
  const A = s.getRange(2, 1, n - 1, 1).getValues(), D = 864e5; let a = -1, b = -1;   // колонка A — время записи на сервере (позже или равно времени создания)
  for (let i = 0; i < A.length; i++) { const t = ms(A[i][0]); if (a < 0 && t >= from - D) a = i; if (t < to + 3 * D) b = i }   // запас: часы телефона и заявки, отправленные с задержкой
  if (a < 0 || b < a) return [];
  const rows = [];
  s.getRange(a + 2, 1, b - a + 1, 14).getValues().forEach(r => {
    const dl = (+r[13] || 0) || (isD(r[12]) ? r[12].getTime() : 0); if (dl && now - dl > undo) return;   // время удаления: число из колонки N (запасной вариант — дата из M)
    try { const o = JSON.parse(r[11]), t = +o.ts || ms(r[0]); if (t < from || t >= to) return; o.del = dl; rows.push(o) } catch (_) {} });
  return rows;
}
function doPost_(e) {                    // записывает заявку, визит или правку магазина (повтор того же ID игнорируется)
  const d = JSON.parse(e.postData.contents); if (d.key !== KEY) return out({ error: 'key' });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (d.shop) { const x = d.shop;
      if (x.op == 'del') delShop(x.old, x.id); else if (x.op == 'edit') editShop(x.old, x.n, x.c, x.a, x.id, x.ty);
      else if (x.op == 'status') setStatus(x); else if (x.op == 'info') setInfo(x); else if (x.op == 'meta') setMeta(x); else upShop(x.n, x.c, x.a, x.id, x.ty);
      return out({ ok: 1 }) }
    if (d.visit) return out(addVisit(d.visit));                                       // новая отметка визита
    if (d.visitOp) return out(visitOp(d.visitOp));                                    // v26: правка / отмена / восстановление визита по ID события
    if (d.visitCancel) return out(cancelVisit(d.visitCancel));                        // для старых клиентов: мягкая отмена последнего действующего визита этого торгового
    if (d.rcpOp) return out(rcpOp(d.rcpOp));                                           // добавление / правка / удаление получателя
    if (d.orderOp) { const x = d.orderOp, r = setDeleted(x.id, x.del, x.trader, x.at); return out({ ok: 1, applied: r.applied, reason: r.reason, owner: r.owner, dup: r.dup }) }   // удаление / возврат заявки
    return out(saveOrder(d.order));
  } finally { lock.releaseLock() }
}

/* ---------- Таблицы и общие помощники ---------- */
function ensureHead(s, head) {           // достраивает недостающие заголовки (старые таблицы обновляются сами; существующие данные не трогаем)
  const k = head.length; if (s.getMaxColumns() < k) s.insertColumnsAfter(s.getMaxColumns(), k - s.getMaxColumns());
  const h = s.getRange(1, 1, 1, k).getValues()[0]; let ch = false;
  head.forEach((t, i) => { if (!h[i]) { h[i] = t; ch = true } });
  if (ch) s.getRange(1, 1, 1, k).setValues([h]);
  return s;
}
const ordSheet = () => ensureHead(sh('Заявки'), ORD_HEAD), jSheet = () => ensureHead(sh('Визиты'), JR_HEAD);
const T = x => String(x == null ? '' : x).trim();
const dstr = v => isD(v) ? Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : T(v);   // Sheets сам превращает «2026-10-16» в дату
const prevOf = j => { try { return JSON.parse(j.hist).prev || null } catch (_) { return null } };
function nameCands(shops, name, city) {  // магазины, подходящие под название (+город, если указан у обеих сторон)
  if (!T(name)) return [];
  return shops.filter(x => x.id && same(x.n, name) && (!T(city) || !x.c || same(x.c, city)));
}
function readOrders(full) {              // заявки: узкие колонки; JSON читаем только если нужен (нет ID магазина / даты оформления или full)
  const s = ordSheet(), n = s.getLastRow(); if (n < 2) return []; const k = n - 1, col = (c, w) => s.getRange(2, c, k, w || 1).getValues();
  const A = col(1), BD = col(2, 3), J = col(10), MP = col(13, 4); let L = null;
  return BD.map((r, i) => {
    const x = { r: i + 2, id: T(r[0]), tr: T(r[1]), d: r[2], sum: +J[i][0] || 0, reg: ms(A[i][0]), del: (+MP[i][1] || 0) || (isD(MP[i][0]) ? MP[i][0].getTime() : 0), sid: T(MP[i][2]), ts: +MP[i][3] || 0, o: null };
    if (full || !x.sid || !x.ts) { if (!L) L = col(12); try { x.o = JSON.parse(L[i][0]) } catch (_) { x.o = {} } }
    if (!x.ts) x.ts = x.o && +x.o.ts || x.reg; x.tsFix = !+MP[i][3];
    return x });
}
function readJournal() {
  const s = jSheet(), n = s.getLastRow(); if (n < 2) return [];
  return s.getRange(2, 1, n - 1, JR_HEAD.length).getValues().map((r, i) => ({ r: i + 2, reg: ms(r[0]), id: T(r[1]), shop: T(r[2]), sid: T(r[3]), who: T(r[4]), kind: T(r[5]), val: r[6], nt: T(r[7]), ts: +r[8] || 0, state: T(r[9]), by: T(r[10]), at: +r[11] || 0, hist: T(r[12]), oid: T(r[13]) })).filter(j => j.id);
}
function linkAll(shops, orders, jr) {    // связь записи с магазином: явный ID → ID из JSON заявки → ЕДИНСТВЕННОЕ совпадение по названию. Неоднозначное не привязываем (cands)
  const ids = new Set(shops.map(x => x.id).filter(Boolean));
  orders.forEach(x => { x.link = ''; x.how = ''; x.cands = [];
    if (x.sid) { if (ids.has(x.sid)) { x.link = x.sid; x.how = 'id' } return }
    const h = (x.o && x.o.h) || {};
    if (h.sid && ids.has(String(h.sid))) { x.link = String(h.sid); x.how = 'json'; return }
    const c = nameCands(shops, h.s, h.c); if (c.length == 1) { x.link = c[0].id; x.how = 'name' } else x.cands = c.map(y => y.id) });
  jr.forEach(j => { j.link = ''; j.how = ''; j.cands = [];
    if (j.sid) { if (ids.has(j.sid)) { j.link = j.sid; j.how = 'id' } return }
    const c = nameCands(shops, j.shop, ''); if (c.length == 1) { j.link = c[0].id; j.how = 'name' } else j.cands = c.map(y => y.id) });
}
function loadState(full, virt) {
  const shops = readShops(); if (virt) shops.forEach(x => { if (!x.id) x.id = 'new#' + x.r });
  const orders = readOrders(full), jr = readJournal(); linkAll(shops, orders, jr); return { shops, orders, jr };
}
function sumsOf(st) {                    // сводки по всем магазинам: считаются заново из записей (идемпотентно)
  const m = {}, g = id => m[id] || (m[id] = { lo: 0, lv: 0, lb: '', lw: '', lvr: 0, amb: false, anyO: false, anyV: false });
  st.orders.forEach(o => { if (o.link) { const a = g(o.link); a.anyO = true; if (!o.del && o.ts > a.lo) a.lo = o.ts } else o.cands.forEach(id => { g(id).amb = true }) });
  st.jr.forEach(j => { if (/^order_/.test(j.kind)) { if (j.link) g(j.link).anyO = true; const p = j.kind == 'order_edit' ? prevOf(j) : null; if (p && p.sid) g(p.sid).anyO = true; return }   // у магазина были заявки (в т.ч. перенесённые/удалённые) — значит, «посл. заказ» считаем честно, вплоть до нуля
    if (j.kind != 'visit') return;
    if (j.link) { const a = g(j.link); a.anyV = true; if (!j.state && j.ts && (j.ts > a.lv || (j.ts == a.lv && j.r > a.lvr))) { a.lv = j.ts; a.lvr = j.r; a.lb = T(j.val); a.lw = j.who } }
    else j.cands.forEach(id => { g(id).amb = true }) });
  return m;
}
function fin(x, a) {                     // итоговые значения сводки. Значение, у которого нет ни одной записи-основания (или есть неоднозначные записи), не затираем
  a = a || { lo: 0, lv: 0, lb: '', lw: '', amb: false, anyO: false, anyV: false };
  let lo = a.lo, lv = a.lv, lb = a.lb, lw = a.lw;
  if ((a.amb || (!lo && !a.anyO)) && x.lo > lo) lo = x.lo;
  if ((a.amb || (!lv && !a.anyV)) && x.lv > lv) { lv = x.lv; lb = x.lb; lw = x.lw }
  return { lo, lv, lb: lv ? lb : '', lw: lv ? lw : '' };
}
const sumDiff = (x, f) => x.lo != f.lo || x.lv != f.lv || x.lb != f.lb || x.lw != f.lw;
function recalcShops(ids) {              // пересчёт сводок указанных магазинов; можно вызывать сколько угодно раз
  ids = [...new Set(ids.filter(Boolean))]; if (!ids.length) return;
  const st = loadState(), m = sumsOf(st);
  ids.forEach(id => { const x = st.shops.find(y => y.id == id); if (!x) return; const f = fin(x, m[id]);
    if (sumDiff(x, f)) shopSheet().getRange(x.r, 12, 1, 4).setValues([[f.lo || '', f.lv || '', f.lb, f.lw]]) });
}
const recalcShop = id => recalcShops([id]);
const shopIdAt = r => r ? T(shopSheet().getRange(r, 4).getValue()) : '';

/* ---------- Журнал событий (лист «Визиты») ---------- */
function jlog(e) {                       // добавляет событие; повтор того же ID игнорируется. Возвращает true, если запись создана
  if (hasLog(e.id)) return false;
  jSheet().appendRow([new Date(), e.id, e.shop || '', e.sid || '', e.who || '', e.kind, e.val == null ? '' : e.val, e.nt || '', e.ts || Date.now(), '', '', '', e.hist ? JSON.stringify(e.hist) : '', e.oid || '']);
  return true;
}
const logRow = (id, shop, sid, who, kind, val, note, ts) => jlog({ id, shop, sid, who, kind, val, nt: note, ts });
function hasLog(id) { const s = jSheet(), n = s.getLastRow(); return n > 1 && s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)) >= 0 }

/* ---------- Заявки ---------- */
const EDIT_H = 24;                       // сколько часов после создания заявку можно менять
const vat = o => o.m == 'vat' ? 'с НДС' : 'без НДС';
function saveOrder(o) {                  // создание заявки (повтор того же ID не создаёт дубль, а лечит возможные хвосты прошлой попытки)
  if (!o || !o.id || !o.h || !T(o.h.s)) return { ok: 1, applied: false, reason: 'invalid' };
  const s = ordSheet(), n = s.getLastRow(), ids = n > 1 ? s.getRange(2, 2, n - 1, 1).getValues().flat().map(String) : [], ix = ids.indexOf(String(o.id));
  if (ix >= 0) return o.ed ? editOrder(s, ix + 2, o) : healOrder(s, ix + 2);
  const r = upShop(o.h.s, o.h.c, o.h.a, o.h.sid), sid = shopIdAt(r), now = Date.now();
  let ts = +o.ts || now; if (ts > now + FUT) ts = now;                  // часы телефона не должны ставить заказ «в будущее»
  o.ts = ts; o.h.sid = sid;
  s.appendRow([new Date(), o.id, o.trader, o.h.d, o.h.c, o.h.s, o.h.a, vat(o), o.disc, o.sum, o.text, JSON.stringify(o), '', '', sid, ts]);
  jlog({ id: 'oc:' + o.id, shop: o.h.s, sid, who: o.trader, kind: 'order_create', val: o.sum, nt: 'на ' + o.h.d, ts, oid: o.id });
  recalcShops([sid]);
  return { ok: 1, applied: true, sid };
}
function healOrder(s, row) {             // повторный запрос создания: ничего не дублируем, дописываем недостающее и пересчитываем
  const v = s.getRange(row, 1, 1, 16).getValues()[0]; let o = {}; try { o = JSON.parse(v[11]) } catch (_) {}
  let sid = T(v[14]), ts = +v[15] || 0;
  if (!sid) { const h = o.h || {}; sid = shopIdAt(upShop(h.s || v[5], h.c || v[4], h.a || v[6], h.sid)) }
  if (!ts) ts = +o.ts || ms(v[0]);
  s.getRange(row, 15, 1, 2).setValues([[sid, ts]]);
  if (!hasLog('oc:' + v[1])) jlog({ id: 'oc:' + v[1], shop: T(v[5]), sid, who: T(v[2]), kind: 'order_create', val: +v[9] || 0, nt: 'на ' + dstr(o.h && o.h.d || v[3]), ts, oid: T(v[1]) });
  recalcShops([sid]);
  return { ok: 1, applied: true, dup: true, sid };
}
function editOrder(s, row, o) {          // заменяет содержимое заявки; правит только владелец, не позже EDIT_H часов после создания
  const v = s.getRange(row, 1, 1, 16).getValues()[0], owner = T(v[2]); let old = {}; try { old = JSON.parse(v[11]) } catch (_) {}
  if (owner && T(o.trader) !== owner) return { ok: 1, applied: false, reason: 'not_owner' };
  const created = +v[15] || +old.ts || ms(v[0]);
  if ((+o.ed || 0) - created > EDIT_H * 36e5 + 5 * 6e4) return { ok: 1, applied: false, reason: 'too_late' };
  if ((+old.ed || 0) > +o.ed) return { ok: 1, applied: false, reason: 'stale' };      // более новая правка уже записана
  if (!o.h || !T(o.h.s)) return { ok: 1, applied: false, reason: 'invalid' };
  let oldSid = T(v[14]) || (() => { const st = loadState(true), x = st.orders.find(y => y.id == T(v[1])); return x ? x.link : '' })();
  const same_ = (+old.ed || 0) == +o.ed;                                            // та же правка пришла повторно — только долечиваем хвосты
  const r = upShop(o.h.s, o.h.c, o.h.a, o.h.sid), sid = shopIdAt(r); o.h.sid = sid; o.ts = created;
  const evId = 'oe:' + v[1] + ':' + o.ed;
  if (same_) { const je = readJournal().find(j => j.id == evId), pv = je && prevOf(je); if (pv && pv.sid) oldSid = pv.sid }   // повтор после сбоя: «старый» магазин берём из журнала, а не из уже обновлённой строки
  if (!same_ || !hasLog(evId)) jlog({ id: evId, shop: o.h.s, sid, who: o.trader, kind: 'order_edit', val: o.sum, nt: 'на ' + o.h.d, ts: +o.ed, oid: T(v[1]),
    hist: { prev: { sum: +v[9] || 0, d: dstr(v[3]), sid: oldSid, s: T(v[5]), c: T(v[4]), a: T(v[6]) } } });   // что было до правки — структурно
  s.getRange(row, 4, 1, 9).setValues([[o.h.d, o.h.c, o.h.s, o.h.a, vat(o), o.disc, o.sum, o.text, JSON.stringify(o)]]);
  s.getRange(row, 15, 1, 2).setValues([[sid, created]]);
  recalcShops([sid, oldSid]);                                                       // при переносе A→B пересчитываются оба магазина
  return same_ ? { ok: 1, applied: true, dup: true, sid } : { ok: 1, applied: true, sid };
}
function setDeleted(id, ts, trader, at) { // помечает заявку удалённой (строка остаётся) или снимает пометку; честно возвращает результат; повтор безопасен
  const s = ordSheet(), n = s.getLastRow(); if (n < 2) return { applied: false, reason: 'not_found' };
  const i = s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)); if (i < 0) return { applied: false, reason: 'not_found' };
  const row = i + 2, v = s.getRange(row, 1, 1, 16).getValues()[0], owner = T(v[2]);
  if (trader && owner && owner !== T(trader)) return { applied: false, reason: 'not_owner', owner };   // чужую заявку удалить нельзя (у заявок без профиля владельца нет)
  let sid = T(v[14]); if (!sid) { const st = loadState(true), x = st.orders.find(y => y.id == T(v[1])); sid = x ? x.link : '' }
  const cur = (+v[13] || 0) || (isD(v[12]) ? v[12].getTime() : 0), shop = T(v[5]), now = Date.now(), ev = { shop, sid, who: T(trader) || owner, oid: T(v[1]), val: +v[9] || 0 };
  if (ts) {                                                                          // удаление
    const dts = cur || +ts;                                                         // уже удалена — оставляем первое время удаления
    jlog(Object.assign({ id: 'od:' + v[1] + ':' + dts, kind: 'order_cancel', ts: dts }, ev));
    if (!cur) { s.getRange(row, 13).setValue(Utilities.formatDate(new Date(ts), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm'));   // для людей
      s.getRange(row, 14).setValue(+ts) }                                           // для приложения (число, без часовых поясов)
    recalcShops([sid]); return { applied: true, dup: !!cur };
  }
  if (!cur) { recalcShops([sid]); return { applied: true, dup: true } }              // уже не удалена
  jlog(Object.assign({ id: 'or:' + v[1] + ':' + cur, kind: 'order_restore', ts: +at || now }, ev));
  s.getRange(row, 13, 1, 2).clearContent();
  recalcShops([sid]); return { applied: true };
}

/* ---------- Магазины: ID, статусы, контакты, последний заказ и визит ---------- */
const same = (a, b) => String(a).trim().toLowerCase().replace(/ё/g, 'е') == String(b).trim().toLowerCase().replace(/ё/g, 'е');
const newId = () => 's' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
function shopSheet() { return ensureHead(sh('Магазины'), SHOP_HEAD) }   // при необходимости достраиваем колонки и заголовки
function readShops() {
  const s = shopSheet(), n = s.getLastRow(); if (n < 2) return [];
  const L = x => +x || 0;
  return s.getRange(2, 1, n - 1, SHOP_HEAD.length).getValues().map((r, i) => ({ r: i + 2, n: T(r[0]), c: T(r[1]), a: T(r[2]), id: T(r[3]), st: T(r[4]), nt: T(r[5]), sb: T(r[6]), sa: L(r[7]),
    ct: T(r[8]), tl: T(r[9]), rg: T(r[10]), lo: L(r[11]), lv: L(r[12]), lb: T(r[13]), lw: T(r[14]), ty: T(r[15]), pl: L(r[16]), fq: T(r[17]) })).filter(x => x.n);
}
const pub = x => ({ id: x.id, n: x.n, c: x.c, a: x.a, st: x.st, nt: x.nt, sb: x.sb, sa: x.sa, ct: x.ct, tl: x.tl, rg: x.rg, lo: x.lo, lv: x.lv, lb: x.lb, lw: x.lw, ty: x.ty, pl: x.pl, fq: x.fq });
function ensureIds() {                   // каждому магазину без ID присваиваем его (один раз; под блокировкой)
  let list = readShops(); if (!list.some(x => !x.id)) return list;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { list = readShops(); const s = shopSheet(); list.forEach(x => { if (!x.id) { x.id = newId(); s.getRange(x.r, 4).setValue(x.id) } }) } finally { lock.releaseLock() }
  return list;
}
const findShop = (list, id, name, city) => (id && list.find(x => x.id == id)) || (name && list.find(x => same(x.n, name) && (!city || !x.c || same(x.c, city)))) || null;   // одинаковое название в разных городах — разные магазины
function upShop(n, c, a, id, ty) {           // находит магазин (по ID, затем по названию) или создаёт; возвращает номер строки
  n = String(n || '').trim(); if (!n) return 0;
  const s = shopSheet(), list = readShops(), x = findShop(list, id, n, c);
  if (x) { if (!x.c && c) s.getRange(x.r, 2).setValue(c); if (!x.a && a) s.getRange(x.r, 3).setValue(a);
    if (!x.id) s.getRange(x.r, 4).setValue(id && !list.some(y => y.id == id) ? String(id) : newId());
    return x.r }
  s.appendRow([n, c || '', a || '', id && !list.some(y => y.id == id) ? String(id) : newId()]);
  if (ty) s.getRange(s.getLastRow(), 16).setValue(String(ty));
  return s.getLastRow();
}
function delShop(old, id) {              // удаляет магазин из общей базы (заявки и журнал не трогает)
  const s = shopSheet(), list = readShops();
  list.filter(x => (id && x.id == id) || same(x.n, old)).map(x => x.r).sort((a, b) => b - a).forEach(r => s.deleteRow(r));
}
function editShop(old, n, c, a, id, ty) {    // меняет название, город и адрес (ID, статус и контакты сохраняются)
  const s = shopSheet(), x = findShop(readShops(), id, old);
  if (x) { s.getRange(x.r, 1, 1, 3).setValues([[n, c || '', a || '']]); if (ty !== undefined) s.getRange(x.r, 16).setValue(String(ty || '')) } else upShop(n, c, a, id, ty);
}
function setStatus(x) {                  // статус магазина + запись в журнал; повтор той же отметки (rid) игнорируется
  if (x.rid && hasLog(x.rid)) return;
  const r = upShop(x.n, x.c, x.a, x.id); if (!r) return;
  const s = shopSheet(), at = +x.at || Date.now(), sid = shopIdAt(r);
  if (at >= (+s.getRange(r, 8).getValue() || 0)) s.getRange(r, 5, 1, 4).setValues([[x.st || '', x.nt || '', x.by || '', at]]);   // старая отметка из офлайн-очереди не затирает более новую
  jlog({ id: x.rid || newId(), shop: x.n, sid, who: x.by, kind: 'status', val: x.st || '', nt: x.nt || '', ts: at });
}
function setInfo(x) {                    // контакт, телефон, район
  const r = upShop(x.n, x.c, x.a, x.id); if (r) shopSheet().getRange(r, 9, 1, 3).setValues([[x.ct || '', x.tl || '', x.rg || '']]);
}
function setMeta(x) {                    // тип точки, запланированный визит (мс, 0 — нет), открытый вопрос
  const r = upShop(x.n, x.c, x.a, x.id, x.ty); if (r) shopSheet().getRange(r, 16, 1, 3).setValues([[String(x.ty || ''), +x.pl || '', String(x.fq || '')]]);
}

/* ---------- Визиты ---------- */
function addVisit(v) {                   // визит: событие в журнале + пересчёт «посл. визита» магазина. Повтор того же ID ничего не дублирует, но долечивает сводку
  const id = v.id || newId(), now = Date.now(), ts = +v.ts || now;
  const st0 = loadState(), old = st0.jr.find(j => j.id == id);
  if (old) { recalcShops([old.link]); return { ok: 1, applied: true, dup: true } }
  if (ts > now + FUT) return { ok: 1, applied: false, reason: 'future' };
  if (ts < now - OLDV) return { ok: 1, applied: false, reason: 'too_old' };
  const r = upShop(v.shop, v.c, v.a, v.sid); if (!r) return { ok: 1, applied: false, reason: 'invalid' };
  const sid = shopIdAt(r);
  jlog({ id, shop: v.shop, sid, who: v.trader, kind: 'visit', val: v.val || '', nt: v.note || '', ts });
  const s = shopSheet(), pl = +s.getRange(r, 17).getValue() || 0; if (pl && pl <= ts) s.getRange(r, 17).setValue('')   // визит выполняет запланированный визит
  recalcShops([sid]);
  return { ok: 1, applied: true, sid };
}
function visitChange(j, act, x) {        // одна операция над визитом; предыдущие данные сохраняются в «Истории изменений»
  let hist = []; try { hist = JSON.parse(j.hist) || [] } catch (_) {}
  if (x.opId && hist.some(h => h.op == x.opId)) return { dup: true };
  const at = +x.at || Date.now(), by = x.by || j.who; let state = j.state, ts = j.ts, val = j.val, nt = j.nt, prev;
  if (act == 'cancel') { if (state == 'cancelled') return { noop: true }; state = 'cancelled'; prev = { state: '' } }
  else if (act == 'restore') { if (!state) return { noop: true }; state = ''; prev = { state: 'cancelled' } }
  else { if (state) return { reason: 'cancelled' };
    const nts = x.ts != null ? +x.ts : ts, nv = x.val != null ? String(x.val) : T(j.val), nn = x.nt != null ? String(x.nt) : j.nt;
    if (nts > Date.now() + FUT) return { reason: 'future' }; if (nts < Date.now() - OLDV) return { reason: 'too_old' };
    if (nts == ts && nv == T(val) && nn == nt) return { noop: true };
    prev = { ts, val: T(val), nt }; ts = nts; val = nv; nt = nn }
  hist.push({ op: x.opId || ('s' + at), k: act, at, by, reg: Date.now(), prev });
  jSheet().getRange(j.r, 7, 1, 7).setValues([[val, nt, ts, state, by, at, JSON.stringify(hist)]]);   // одной записью: данные + состояние + история
  return { applied: true };
}
function visitOp(x) {                    // {act: edit|cancel|restore, id (ID события), opId, by, at, ts?, val?, nt?}
  const st = loadState(), j = st.jr.find(y => y.id == String(x.id) && y.kind == 'visit');
  if (!j) return { ok: 1, applied: false, reason: 'not_found' };
  if (T(x.by) !== j.who) return { ok: 1, applied: false, reason: 'not_owner' };     // менять и отменять можно только свои визиты
  if (['edit', 'cancel', 'restore'].indexOf(x.act) < 0) return { ok: 1, applied: false, reason: 'act' };
  const r = visitChange(j, x.act, x);
  if (r.reason) return { ok: 1, applied: false, reason: r.reason };
  recalcShops([j.link]);                                                           // и при повторе: если прошлая попытка упала после записи, сводка долечится
  const n = readJournal().find(y => y.id == j.id);
  return { ok: 1, applied: true, dup: !!(r.dup || r.noop), state: n.state, ts: n.ts, val: T(n.val), nt: n.nt };
}
function cancelVisit(v) {                // СТАРЫЕ клиенты: «отмена последней отметки». Теперь мягкая (запись остаётся в журнале) и точная: по ID магазина, а не по названию
  const st = loadState(), sid = T(v.sid); let list = st.jr.filter(j => j.kind == 'visit' && !j.state && j.who === T(v.trader));
  if (sid) list = list.filter(j => j.link == sid); else { const c = nameCands(st.shops, v.shop, ''); if (c.length != 1) return { ok: 1, applied: false, reason: 'ambiguous' }; list = list.filter(j => j.link == c[0].id) }
  list.sort((a, b) => a.ts - b.ts || a.r - b.r); const j = list[list.length - 1]; if (!j) return { ok: 1, applied: false, reason: 'not_found' };
  visitChange(j, 'cancel', { by: j.who, opId: 'legacy:' + j.id }); recalcShops([j.link]);
  return { ok: 1, applied: true, id: j.id };
}
function myVisit(sid, name, who) {       // время последнего действующего визита этого торгового в магазине (0 — не был)
  if (!who) return 0; const st = { shops: readShops(), jr: readJournal() }; linkAll(st.shops, [], st.jr);
  const c = sid ? [sid] : nameCands(st.shops, name, '').map(x => x.id); let t = 0;
  st.jr.forEach(j => { if (j.kind == 'visit' && !j.state && j.who === who && j.link && c.indexOf(j.link) >= 0) t = Math.max(t, j.ts) });
  return t;
}
function visitsOf(sid, name, limit) {    // для клиентов до v26: последние действующие отметки (визиты и статусы), новые сверху
  const st = { shops: readShops(), jr: readJournal() }; linkAll(st.shops, [], st.jr);
  const c = sid ? [sid] : nameCands(st.shops, name, '').map(x => x.id);
  return st.jr.filter(j => (j.kind == 'visit' || j.kind == 'status') && !j.state && j.link && c.indexOf(j.link) >= 0).reverse().slice(0, limit).map(j => ({ ts: j.ts, who: j.who, kind: j.kind, val: T(j.val), nt: j.nt }));
}
function timeline(sid, name, me, limit) { // общая лента магазина: визиты (в т.ч. отменённые), статусы, события заявок. Для заявок — актуальное состояние в «cur»
  const st = loadState(); let x = sid && st.shops.find(y => y.id == sid); if (!x && name) { const c = nameCands(st.shops, name, ''); if (c.length == 1) x = c[0] }
  const id = x ? x.id : sid;
  const byOid = {}; st.orders.forEach(o => { byOid[o.id] = o });
  const cur = oid => { const o = byOid[oid]; return o ? { sum: o.sum, d: dstr(o.d), del: o.del, sid: o.link, tr: o.tr } : null };
  const ev = [], hasC = new Set(st.jr.filter(j => j.kind == 'order_create').map(j => j.oid));
  st.jr.forEach(j => {
    const isO = /^order_/.test(j.kind), p = j.kind == 'order_edit' ? prevOf(j) : null, out_ = !!(p && p.sid == id && j.link != id);
    if (j.link != id && !out_) return;
    const e = { k: j.kind, id: j.id, ts: j.ts, reg: j.reg, who: j.who, sid: j.link, val: j.kind == 'status' || j.kind == 'visit' ? T(j.val) : +j.val || 0, nt: j.nt, state: j.state, by: j.by, at: j.at, oid: j.oid };
    if (j.kind == 'visit') { try { e.hist = JSON.parse(j.hist) || [] } catch (_) { e.hist = [] } }
    if (isO) { e.cur = cur(j.oid); if (p) e.prev = p; if (out_) e.mv = 'out'; else if (p && p.sid && p.sid != id) e.mv = 'in' }
    ev.push(e) });
  const eds = {}; st.jr.filter(j => j.kind == 'order_edit').sort((a, b) => a.ts - b.ts).forEach(j => { const p = prevOf(j); if (p && !(j.oid in eds)) eds[j.oid] = p.sid || '' });
  st.orders.forEach(o => { if (hasC.has(o.id)) return;                               // старая заявка без события создания: показываем «создана» по данным самой заявки
    const sid0 = o.id in eds ? eds[o.id] : o.link; if (sid0 != id) return;
    ev.push({ k: 'order_create', id: 'oc:' + o.id, ts: o.ts, reg: o.reg, who: o.tr, sid: sid0, val: o.sum, nt: '', state: '', oid: o.id, legacy: 1, cur: cur(o.id) }) });
  ev.sort((a, b) => b.ts - a.ts || b.reg - a.reg);
  return { srv: SRV, events: ev.slice(0, limit), total: ev.length, mine: myVisit(id, '', me), sid: id };
}

/* ---------- Сверка старых данных (запускается вручную из меню «Али-Баба» в таблице) ---------- */
function reconcile_(apply) {             // apply=false — «пробный прогон»: ничего не записывает. Неоднозначные связи НИКОГДА не исправляются автоматически
  let st = loadState(true, !apply), items = []; const add = (t, sheet, row, id, msg, act) => items.push([t, sheet, row, id, msg, act]), fixes = { ord: [], jr: [], ts: [] };
  const noId = st.shops.filter(x => !x.id || /^new#/.test(x.id));
  if (apply && noId.length) { const s = shopSheet(); noId.forEach(x => { s.getRange(x.r, 4).setValue(newId()) }); st = loadState(true) }
  const shopById = {}; st.shops.forEach(x => { shopById[x.id] = x });
  if (!apply) noId.forEach(x => add('no_id', 'Магазины', x.r, '', x.n + (x.c ? ' · ' + x.c : ''), 'будет присвоен ID'));
  else noId.forEach(x => add('no_id', 'Магазины', x.r, '', x.n, 'ID присвоен'));
  st.orders.forEach(o => {
    const h = (o.o && o.o.h) || {}, lab = (h.s || '') + (h.c ? ' · ' + h.c : '') + ' · ' + dstr(o.d);
    if (o.sid) { if (!shopById[o.sid]) add('orphan', 'Заявки', o.r, o.id, 'магазин с ID ' + o.sid + ' не найден (' + lab + ')', 'не меняю');
      else if (h.sid && h.sid != o.sid) add('conflict', 'Заявки', o.r, o.id, 'ID в колонке (' + o.sid + ') ≠ ID в данных заявки (' + h.sid + ')', 'не меняю') }
    else if (o.link) { fixes.ord.push(o); add('link_fix', 'Заявки', o.r, o.id, lab + ' → ' + shopById[o.link].n + ' [' + o.link + '] (' + (o.how == 'json' ? 'по ID из данных заявки' : 'единственное совпадение по названию') + ')', apply ? 'привязано' : 'будет привязано') }
    else if (o.cands.length) add('ambiguous', 'Заявки', o.r, o.id, lab + ' — подходят ' + o.cands.length + ' магазина: ' + o.cands.map(i => shopById[i].n + ' · ' + shopById[i].c + ' [' + i + ']').join('; '), 'не меняю — нужно решение человека');
    else add('unmatched', 'Заявки', o.r, o.id, lab + ' — магазин в справочнике не найден', 'не меняю');
    if (o.tsFix) { fixes.ts.push(o); add('ts_fix', 'Заявки', o.r, o.id, 'нет даты оформления → ' + new Date(o.ts).toISOString().slice(0, 16), apply ? 'заполнено' : 'будет заполнено') } });
  st.jr.forEach(j => { if (j.kind != 'visit' && j.kind != 'status') return;
    if (j.sid) { if (!shopById[j.sid]) add('orphan', 'Визиты', j.r, j.id, j.kind + ': магазин с ID ' + j.sid + ' не найден («' + j.shop + '»)', 'не меняю') }
    else if (j.link) { fixes.jr.push(j); add('link_fix', 'Визиты', j.r, j.id, j.kind + ': «' + j.shop + '» → [' + j.link + ']', apply ? 'привязано' : 'будет привязано') }
    else if (j.cands.length) add('ambiguous', 'Визиты', j.r, j.id, j.kind + ': «' + j.shop + '» — подходят ' + j.cands.length + ' магазина', 'не меняю — нужно решение человека');
    else add('unmatched', 'Визиты', j.r, j.id, j.kind + ': «' + j.shop + '» — магазин не найден', 'не меняю') });
  const m = sumsOf(st), diffs = [];
  st.shops.forEach(x => { const f = fin(x, m[x.id]); if (sumDiff(x, f)) { diffs.push([x, f]);
    const fm = t => t ? new Date(t).toISOString().slice(0, 10) : '—';
    add('sum_diff', 'Магазины', x.r, x.id, x.n + ' · ' + x.c + ': посл. заказ ' + fm(x.lo) + ' → ' + fm(f.lo) + '; посл. визит ' + fm(x.lv) + ' → ' + fm(f.lv), apply ? 'исправлено' : 'будет исправлено') } });
  if (apply) {                                                                      // записываем пачками (по колонкам), только то, что реально меняется
    if (fixes.ord.length || fixes.ts.length) { const s = ordSheet(), n = s.getLastRow(), cur = s.getRange(2, 15, n - 1, 2).getValues();
      fixes.ord.forEach(o => { cur[o.r - 2][0] = o.link }); fixes.ts.forEach(o => { cur[o.r - 2][1] = o.ts });
      st.orders.forEach(o => { if (o.link && !cur[o.r - 2][0]) cur[o.r - 2][0] = o.link; if (!cur[o.r - 2][1]) cur[o.r - 2][1] = o.ts });
      s.getRange(2, 15, n - 1, 2).setValues(cur) }
    if (fixes.jr.length) { const s = jSheet(), n = s.getLastRow(), cur = s.getRange(2, 4, n - 1, 1).getValues(); fixes.jr.forEach(j => { cur[j.r - 2][0] = j.link }); s.getRange(2, 4, n - 1, 1).setValues(cur) }
    diffs.forEach(d => { const x = d[0], f = d[1]; shopSheet().getRange(x.r, 12, 1, 4).setValues([[f.lo || '', f.lv || '', f.lb, f.lw]]) }) }
  const cnt = {}; items.forEach(i => { cnt[i[0]] = (cnt[i[0]] || 0) + 1 });
  const changes = fixes.ord.length + fixes.jr.length + fixes.ts.length + diffs.length + noId.length;
  return { apply: !!apply, counts: cnt, changes, items };
}
function writeReport_(rep) {             // отчёт в лист «Сверка» (единственное, что пишет пробный прогон; запускайте его на КОПИИ таблицы)
  const s = SpreadsheetApp.getActive().getSheetByName('Сверка') || SpreadsheetApp.getActive().insertSheet('Сверка');
  const old = s.getLastRow(); if (old) s.getRange(1, 1, old, 6).clearContent();
  const rows = [['Режим', rep.apply ? 'ПРИМЕНЕНО' : 'ПРОБНЫЙ ПРОГОН (ничего не изменено)', new Date(), '', '', ''], ['Итоги', JSON.stringify(rep.counts), '', '', '', ''], ['Тип', 'Лист', 'Строка', 'ID записи', 'Описание', 'Действие']].concat(rep.items);
  s.getRange(1, 1, rows.length, 6).setValues(rows);
}
function reconcileDryRun() {             // ничего не меняет в данных; пишет отчёт
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { const rep = reconcile_(false); writeReport_(rep); return rep } finally { lock.releaseLock() }
}
function reconcileApply(confirmed) {     // применяет ТОЛЬКО однозначные исправления (привязки, даты оформления, пересчёт сводок). Повторный запуск безопасен
  if (confirmed !== true) { try { const ui = SpreadsheetApp.getUi(); if (ui.alert('Применить исправления сверки?', 'Сначала посмотрите отчёт пробного прогона. Неоднозначные записи останутся как есть.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return null } catch (_) { return null } }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { const rep = reconcile_(true); writeReport_(rep); return rep } finally { lock.releaseLock() }
}
function onOpen() { try { SpreadsheetApp.getUi().createMenu('Али-Баба').addItem('Сверка: пробный прогон (ничего не меняет)', 'reconcileDryRun').addItem('Сверка: применить исправления', 'reconcileApply').addToUi() } catch (_) {} }

/* ---------- Получатели заявок (лист «Получатели»: имя, телефон, города, по умолчанию) ---------- */
function rcpOp(x) {                      // получатели заявок: add / edit (по старому имени) / del
  const s = sh('Получатели'), n = s.getLastRow(), v = n > 1 ? s.getRange(2, 1, n - 1, 1).getValues().flat().map(String) : [];
  const i = v.findIndex(a => same(a, x.old || x.n)), row = [String(x.n || '').trim(), String(x.p || '').trim(), (x.c || []).join(', '), x.d ? 'да' : ''];
  if (x.op === 'del') { if (i >= 0) s.deleteRow(i + 2) }
  else { if (!row[0] || !row[1]) return { ok: 1, applied: false, reason: 'empty' };
    if (x.op === 'add') { if (v.some(a => same(a, row[0]))) return { ok: 1, applied: false, reason: 'exists' }; s.appendRow(row) }
    else if (i >= 0) s.getRange(i + 2, 1, 1, 4).setValues([row]); else s.appendRow(row) }
  return { ok: 1, applied: true, rcp: recipients() };
}
function recipients() {
  return sh('Получатели').getDataRange().getValues().slice(1).map(r => {
    let p = String(r[1]).replace(/\D/g, ''); if (p.length == 11 && p[0] == '8') p = '7' + p.slice(1);   // 8 7xx… → 7 7xx…
    return { n: String(r[0]).trim(), p, c: String(r[2] || '').split(/[,;]/).map(x => x.trim()).filter(Boolean), d: /^(да|yes|y|1|\+|x|true)$/i.test(String(r[3]).trim()) } }).filter(x => x.n && x.p);
}

function sh(n) {                         // лист создаётся автоматически с заголовками
  const ss = SpreadsheetApp.getActive(); let s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow({ 'Торговые': ['Имя'], 'Магазины': SHOP_HEAD, 'Заявки': ORD_HEAD, 'Визиты': JR_HEAD,
    'Получатели': ['Имя', 'Телефон', 'Города (через запятую; пусто = все)', 'По умолчанию (да)'] }[n]) }
  return s;
}
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
