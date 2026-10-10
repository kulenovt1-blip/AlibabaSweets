/* Али-Баба: приём заявок. Вставьте в Расширения → Apps Script ТОЙ ЖЕ таблицы, где лежит прайс. */
const KEY = '3puq8z64';   // тот же ключ, что API_KEY в app.js

function doGet(e) {                      // отдаёт список торговых, магазинов и историю торгового
  const p = e.parameter; if (p.key !== KEY) return out({ error: 'key' });
  if (p.action !== 'init') return out({ error: 'action' });
  const traders = sh('Торговые').getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean);
  const shops = sh('Магазины').getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({ n: String(r[0]), c: String(r[1]), a: String(r[2]) }));
  const undo = (+p.undo || 24) * 36e5, now = Date.now(), rows = [];   // удалённые заявки отдаём, пока их можно вернуть
  sh('Заявки').getDataRange().getValues().slice(1).forEach(r => {
    const dl = (+r[13] || 0) || (Object.prototype.toString.call(r[12]) === '[object Date]' ? r[12].getTime() : 0); if (dl && now - dl > undo) return;   // время удаления: число из колонки N (запасной вариант — дата из M)
    try { const o = JSON.parse(r[11]); o.del = dl; rows.push(o) } catch (_) {} });
  // «Все заявки»: последние 100 по всем торговым + «Мои»: последние 50 этого торгового (без повторов)
  const own = rows.filter(o => o.trader === p.trader).slice(-50), take = new Set(rows.slice(-100).concat(own));
  return out({ traders, shops, hist: rows.filter(o => take.has(o)).reverse() });
}
function doPost(e) {                     // записывает заявку или новый магазин (повтор того же ID игнорируется)
  const d = JSON.parse(e.postData.contents); if (d.key !== KEY) return out({ error: 'key' });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (d.shop) { const x = d.shop;
      if (x.op == 'del') delShop(x.old); else if (x.op == 'edit') editShop(x.old, x.n, x.c, x.a); else upShop(x.n, x.c, x.a);
      return out({ ok: 1 }) }
    if (d.orderOp) { const r = setDeleted(d.orderOp.id, d.orderOp.del, d.orderOp.trader); return out({ ok: 1, applied: r.applied, reason: r.reason, owner: r.owner }) }   // удаление / возврат заявки
    const o = d.order, s = sh('Заявки');
    const ids = s.getLastRow() > 1 ? s.getRange(2, 2, s.getLastRow() - 1, 1).getValues().flat() : [];
    if (ids.indexOf(o.id) < 0) {
      s.appendRow([new Date(), o.id, o.trader, o.h.d, o.h.c, o.h.s, o.h.a, o.m == 'vat' ? 'с НДС' : 'без НДС', o.disc, o.sum, o.text, JSON.stringify(o)]);
      upShop(o.h.s, o.h.c, o.h.a);        // новый магазин попадает в общую базу
    }
    return out({ ok: 1 });
  } finally { lock.releaseLock() }
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
function upShop(n, c, a) {               // добавляет магазин или дополняет пустые город/адрес
  n = String(n || '').trim(); if (!n) return;
  const m = sh('Магазины'), v = m.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).trim().toLowerCase() == n.toLowerCase()) {
    if (!v[i][1] && c) m.getRange(i + 1, 2).setValue(c); if (!v[i][2] && a) m.getRange(i + 1, 3).setValue(a); return }
  m.appendRow([n, c || '', a || '']);
}
const same = (a, b) => String(a).trim().toLowerCase() == String(b).trim().toLowerCase();
function delShop(n) {                    // удаляет магазин из общей базы (заявки не трогает)
  const m = sh('Магазины'), v = m.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (same(v[i][0], n)) m.deleteRow(i + 1);
}
function editShop(old, n, c, a) {        // меняет название, город и адрес
  const m = sh('Магазины'), v = m.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (same(v[i][0], old)) { m.getRange(i + 1, 1, 1, 3).setValues([[n, c || '', a || '']]); return }
  upShop(n, c, a);
}
function sh(n) {                         // лист создаётся автоматически с заголовками
  const ss = SpreadsheetApp.getActive(); let s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow({ 'Торговые': ['Имя'], 'Магазины': ['Магазин', 'Город', 'Адрес'],
    'Заявки': ['Время', 'ID', 'Торговый', 'Дата', 'Город', 'Магазин', 'Адрес', 'Режим цен', 'Скидка %', 'Итого', 'Текст', 'JSON', 'Удалена', 'Удалена (мс)'] }[n]) }
  return s;
}
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
