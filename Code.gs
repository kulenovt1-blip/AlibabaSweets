/* Али-Баба: приём заявок. Вставьте в Расширения → Apps Script ТОЙ ЖЕ таблицы, где лежит прайс.
 *
 * v32 — удаление места точки (только администратор): операция shop {op: 'geodel'} очищает колонки V–Z листа «Магазины»,
 *  в журнал «Визиты» пишется событие shop_geo_del (кто, когда, какое место было). В ленту магазина оно не попадает.
 *
 * v31 — маршрут, режим цен и место точки в таблице; «Отказались»; итоги; «Ходовые», «Брал раньше», «Продвигать».
 *  • Лист «Магазины», колонки S–Z: дни маршрута («Пн, Чт»), ответственный, режим цен точки, широта, долгота, точность, кто и когда записал место.
 *    Если S–Z заняты чем-то своим (заголовок или данные), сервер останавливается с понятной ошибкой и не пишет поверх.
 *  • Права: дни у точки с ответственным меняют он и администратор; свободную точку берёт любой, свою отдаёт сам, чужую передаёт администратор (запись shop_owner в журнале).
 *  • Лист «Продвигать»: товары, отмеченные администратором. Создаётся первой отметкой; чтение его не создаёт.
 *  • Сводки (режим последней заявки по точкам, «Ходовые», частые причины «Отказались», итоги) — в CacheService на 10 минут; запись заявки или статуса сбрасывает кеш.
 *  • Итоги: границы периодов присылает приложение (местное время торгового); торговый видит свои, администратор — всех с разбивкой.
 *
 * v27 — вход по профилю и паролю, роли, серверная проверка данных.
 *  • Общего ключа больше нет. Каждый запрос несёт токен, подписанный сервером (профиль, версия доступа, срок). Все данные идут через POST; doGet ничего не отдаёт.
 *  • Учётные записи — на листе «Торговые»: роль (admin / trader), версия доступа, хеш пароля, хеш одноразового приглашения. Паролей и приглашений в открытом виде нет нигде.
 *  • Пароль: PBKDF2-HMAC-SHA256 с солью, числом итераций (хранится в хеше) и серверным «перцем» из свойств скрипта. Это НЕ Argon2id: в Apps Script нет специализированных алгоритмов (см. README).
 *  • Сервер сам определяет пользователя по токену. Поля trader / by из запроса только сверяются с ним (иначе отказ trader_mismatch).
 *  • Заявки без торгового через обычный API не меняются (no_owner). Владельца назначает администратор отдельным инструментом с пробным прогоном и копией листа.
 *  • Все записи проходят проверку (типы, длины, диапазоны, списки значений). Строки, похожие на формулы, пишутся как текст.
 *  • Секреты (TOKEN_KEY, PEPPER) создаются сами и лежат в свойствах скрипта, а не в коде и не в таблице.
 *
 * v26 — согласованность заказов, визитов, статусов и сводок магазинов.
 *  • «Посл. заказ» магазина = максимум ДАТЫ ОФОРМЛЕНИЯ (o.ts) среди действующих (не удалённых) заявок магазина. Дата поставки — отдельное поле.
 *  • Лист «Визиты» — общий журнал событий. Тип записи (колонка «Тип»): visit, status, order_create, order_edit, order_cancel, order_restore, admin_*.
 *  • Визиты не удаляются физически: «отмена» = состояние cancelled, предыдущие данные хранятся в колонке «История изменений (JSON)».
 *  • Все операции идут по постоянному ID события и безопасны при повторной отправке.
 *  • Сводка магазина (посл. заказ / посл. визит) всегда ПЕРЕСЧИТЫВАЕТСЯ из записей (recalcShops), а не «двигается» инкрементом.
 *  • Сверка старых данных: reconcileDryRun() (ничего не меняет, пишет отчёт в лист «Сверка») и reconcileApply() (после просмотра отчёта). */
const SRV = 35;           // версия серверной части (видна в «Настройки → Служебная информация»)
const SHOP_HEAD = ['Магазин', 'Город', 'Адрес', 'ID', 'Статус', 'Заметка', 'Кем (статус)', 'Когда (статус, мс)', 'Контакт', 'Телефон', 'Район', 'Посл. заказ (мс)', 'Посл. визит (мс)', 'Итог визита', 'Кем (визит)', 'Тип', 'План визита (мс)', 'Открытый вопрос',
  'Дни маршрута', 'Ответственный', 'Цены (НДС)', 'Широта', 'Долгота', 'Точность места, м', 'Место: кем', 'Место: когда',   // v31: колонки S–Z
  'Юрлицо', 'Заметки'];   // v35: AB — постоянные заметки о точке   // v33: колонка AA — ИП / ТОО точки (только название; в текст заявки не идёт)
const SHOP_OLD = 18;                     // колонки A–R были до v31; S–Z сервер проверяет: если они заняты чем-то своим, останавливается, а не пишет поверх
const PROMO_HEAD = ['Товар', 'Кто', 'Когда'];   // v31: лист «Продвигать» — товары, которые отметил администратор (ключ: название|граммовка|единица, как в приложении)
const ORD_HEAD = ['Время', 'ID', 'Торговый', 'Дата', 'Город', 'Магазин', 'Адрес', 'Режим цен', 'Скидка %', 'Итого', 'Текст', 'JSON', 'Удалена', 'Удалена (мс)', 'ID магазина', 'Оформлена (мс)'];
const RD_HEAD = ['Дата', 'Торговый', 'ID магазина', 'Магазин', 'Действие', 'Кто', 'Когда (мс)', 'ID операции'];   // v35: разовые правки маршрута на день (общие, видны торговому на любом телефоне; администратор составляет за торговых). Действие: + добавить, − убрать
const JR_HEAD = ['Время', 'ID', 'Магазин', 'ID магазина', 'Торговый', 'Тип', 'Значение', 'Заметка', 'Время (мс)', 'Состояние', 'Изменил', 'Изменено (мс)', 'История изменений (JSON)', 'ID заявки'];
const TR_HEAD = ['Имя', 'Роль', 'Версия доступа', 'Пароль (хеш)', 'Приглашение (хеш)', 'Приглашение до (мс)', 'Доступ', 'Последний вход (мс)'];
const FUT = 10 * 6e4, OLDV = 400 * 864e5;   // событие из будущего (> 10 мин) и старше ~400 дней сервер не принимает
const EDIT_H = 24;                       // сколько часов после создания заявку можно менять
const UNDO_H = 24, UNDO_TOL = 5 * 6e4;   // сколько часов удалённую заявку можно вернуть; допуск — на расхождение часов и задержку нажатия
const QUEUE_MAX = 7 * 864e5;             // возврат или правка заявки из офлайн-очереди старше 7 дней не принимается (время нажатия присылает устройство, проверить его нельзя)
const TOKEN_DAYS = 14, INVITE_H = 48;    // срок действия токена и одноразового приглашения
const PW_MIN = 8, PW_MAX = 128;          // длина пароля
const ITER_DEF = 4000, ITER_MIN = 1000, ITER_MAX = 300000;   // итерации PBKDF2 (свойство скрипта PBKDF2_ITER; подбирается замером в меню)
const ATT_MAX = 5, ATT_LOCK = 15 * 6e4;                      // неудачных попыток на профиль → пауза
const ATT_G_MAX = 60, ATT_G_WIN = 10 * 6e4, ATT_G_LOCK = 5 * 6e4;   // то же для всех профилей вместе
const VISIT_RES = ['Взяли заказ', 'Заказа нет', 'Никого не было', 'Закрыто', 'Зайти позже', 'Другое'];   // тот же список, что VO в app.js
const STATUSES = ['reg', 'good', 'prom', 'neu', 'hard', 'no', 'closed', 'ref'];                           // ключи ST в app.js (ref — «Отказались», v31)
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];   // дни маршрута в таблице пишутся словами: «Пн, Чт»
// v31: «Ходовые» — товары, которые чаще всего встречаются в заявках за HOT_DAYS дней (не меньше HOT_MIN заявок, не больше HOT_TOP товаров). «Брал раньше» — последние PREV_N заявок точки не старше PREV_DAYS дней
const HOT_DAYS = 60, HOT_TOP = 15, HOT_MIN = 3, PREV_N = 5, PREV_DAYS = 183;
const REASON_MIN = 2, REASON_TOP = 12;   // причины «Отказались» в подсказках: со второго использования, не больше 12
const CACHE_S = 600;                     // сводки (ходовые, причины, режим последней заявки, итоги) кешируются на 10 минут; запись заявки или статуса сбрасывает кеш
const TYPES = ['магазин', 'минимаркет', 'супермаркет'];                                                   // TY в app.js
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;   // ID, которые присылает приложение. Служебные ID событий (oc:…, od:…, adm:…) содержат двоеточие и снаружи прийти не могут

/* ---------- Вход в скрипт ---------- */
function doGet(e) { return out({ error: 'get' }) }   // защищённые данные через GET не отдаются: токен не должен попадать в адрес запроса. Ответ отличается от «auth»: если Google по дороге превратил POST в GET, приложение повторит запрос, а не сочтёт вход отозванным
// Любая ошибка скрипта возвращается как понятный JSON, а не как страница ошибки Google (её браузер показывает как «нет связи»)
function doPost(e) { try { return doPost_(e) } catch (err) { return out({ error: 'server: ' + String(err && err.message || err).slice(0, 200) }) } }
function doPost_(e) {
  let d; try { d = JSON.parse(e.postData.contents) } catch (_) { return out({ error: 'request' }) }   // текст ошибки разбора не возвращаем: в нём может быть часть запроса
  if (!d || typeof d != 'object' || Array.isArray(d)) return out({ error: 'request' });
  if (d.auth) return out(authOp(d.auth));                   // вход и первое задание пароля — единственное, что доступно без токена
  const ctx = authCtx(d); if (!ctx) return out({ error: 'auth' });
  if (ctx.legacy && (d.q || d.admin)) return out({ error: 'auth' });   // ключ старых устройств — только дослать накопленное; читать базу и администрировать по нему нельзя
  if (d.q) return out(readOp(d, ctx));                      // чтение: без общей блокировки (ensureIds берёт её сам, только если нужно)
  if (d.admin) return out(adminOp(d.admin, ctx));
  return out(withLock(() => writeOp(d, ctx)));
}
function writeOp(d, ctx) {                // записывает заявку, визит или правку магазина (повтор того же ID игнорируется)
  if (d.order || d.orderOp || (d.shop && d.shop.op == 'status')) aggDrop();   // v31: сводки (ходовые, итоги, причины, режим последней заявки) пересчитаются при следующем чтении
  if (d.shop) return shopOp(d.shop, ctx);
  if (d.visit) return addVisit(d.visit, ctx);                                       // новая отметка визита
  if (d.visitOp) return visitOp(d.visitOp, ctx);                                    // правка / отмена / восстановление визита по ID события
  if (d.visitCancel) return cancelVisit(d.visitCancel, ctx);                        // для старых очередей: мягкая отмена последнего действующего визита этого торгового
  if (d.orderOp) return orderOp(d.orderOp, ctx);                                    // удаление / возврат заявки
  if (d.order) return saveOrder(d.order, ctx);
  return { error: 'action' };
}
const rdSheet = () => ensureHead(sh('Маршрут дня'), RD_HEAD);   // дату «2026-10-16» таблица может превратить в дату — читаем через dstr (в часовом поясе таблицы)
function routeDays(ctx, now) {         // v35: правки маршрута на день начиная со вчерашнего: торговому — свои, администратору — все. Последняя правка по (дата, торговый, точка) побеждает
  const s = rdSheet(), n = s.getLastRow(); if (n < 2) return [];
  const from = Utilities.formatDate(new Date(now - 36 * 36e5), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd'), adm = ctx.role == 'admin', m = {};
  s.getRange(2, 1, n - 1, 7).getValues().forEach(r => { const d = dstr(r[0]), tr = T(r[1]), sid = T(r[2]); if (!d || d < from || !tr || !sid || (!adm && !same(tr, ctx.user))) return;
    const k = d + '|' + tr + '|' + sid, at = +r[6] || 0; if (!m[k] || at >= m[k].at) m[k] = { d, tr, sid, on: T(r[4]) == '+', at, by: T(r[5]) } });
  return Object.keys(m).map(k => m[k]);
}
function readOp(d, ctx) {                 // торговые, магазины, получатели и история: окно «7 дней у всех / 30 дней свои» или заявки за выбранный день
  const now = Date.now(), D = 864e5, undo = Math.min(Math.max(+d.undo || UNDO_H, 1), 72) * 36e5;
  const user = ctx.user, meOut = { n: ctx.user, role: ctx.role };
  if (d.q == 'me') return { srv: SRV, me: meOut };
  if (d.q == 'range') {                  // заявки всех торговых, созданные в [from, to) — для старых дней по запросу
    const from = +d.from, to = +d.to; if (!(from > 0) || !(to > from) || to - from > 40 * D) return { error: 'range' };
    return { hist: ordersIn(from, to, undo, now).reverse() };
  }
  if (d.q == 'timeline') {
    const sid = str(d.sid, 64), name = str(d.name, 120); if (sid === null || name === null) return { error: 'range' };
    return timeline(sid, name, user, Math.min(Math.max(+d.limit || 60, 1), 200));
  }
  if (d.q == 'stats') return statsOp(d.b, ctx);
  if (d.q == 'per') return perOp(d, ctx);                                          // v35: итоги за период «Истории» (день / неделя / месяц / год), прошлый такой же и по месяцам                                    // v31: итоги за периоды (границы присылает приложение — в местном времени торгового)
  if (d.q == 'prev') { const sid = str(d.sid, 64); if (!sid || !ID_RE.test(sid)) return { error: 'range' }; return { ok: 1, sid, items: prevItems(sid) } }   // v31: «Брал раньше»
  if (d.q != 'init') return { error: 'action' };
  const traders = readTraders().map(x => x.n), ag = agg(), shops = ensureIds().map(x => { const o = pub(x), l = ag.lm[x.id]; if (l) { o.lm = l[0]; o.lmt = l[1] } return o });   // lm — режим цен последней заявки в точку (по всем торговым)
  // окно: заявки всех торговых за 7 дней + свои (и заявки без торгового — только для просмотра) за 30 дней; остальное приложение запрашивает по дню (q=range)
  const hist = ordersIn(now - 30 * D, now + D, undo, now).filter(o => (+o.ts || 0) >= now - 7 * D || !o.trader || same(o.trader, user));
  return { srv: SRV, me: meOut, traders, shops, rcp: recipients(), hist: hist.reverse(), hot: ag.hot, reasons: ag.reasons, promo: readPromo().map(x => x.k), rd: routeDays(ctx, now) };   // v35: rd — маршрут на день
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
    try { const o = JSON.parse(r[11]); if (!o || typeof o != 'object') return; const t = +o.ts || ms(r[0]); if (t < from || t >= to) return;
      o.trader = T(r[2]); o.del = dl; o.rg = ms(r[0]); if (dl) { const m = /\s·\s(.+)$/.exec(isD(r[12]) ? '' : T(r[12])); o.dby = m ? m[1].trim() : '' } rows.push(o) } catch (_) {} });   // владелец — всегда из колонки «Торговый», а не из JSON
  return rows;
}

/* ---------- Блокировка: одна на выполнение. Вложенный запрос той же блокировки невозможен ---------- */
let LOCKED = false;
function withLock(fn) {
  if (LOCKED) return fn();               // блокировка уже наша — второй раз её не запрашиваем
  const lock = LockService.getScriptLock(); lock.waitLock(20000); LOCKED = true;
  try { return fn() } finally { LOCKED = false; lock.releaseLock() }
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
function trSheet() {                     // учётные записи. Если колонки B–H заняты чем-то своим, читать из них роли и хеши нельзя — останавливаемся с понятной ошибкой
  const s = ensureHead(sh('Торговые'), TR_HEAD), h = s.getRange(1, 1, 1, TR_HEAD.length).getValues()[0];
  for (let i = 1; i < TR_HEAD.length; i++) if (String(h[i]).trim() !== TR_HEAD[i]) throw new Error('лист «Торговые»: колонка ' + (i + 1) + ' занята. Колонки B–H нужны для учётных записей — освободите их');
  return s;
}
const T = x => String(x == null ? '' : x).trim();
const dstr = v => isD(v) ? Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : T(v);   // Sheets сам превращает «2026-10-16» в дату
const prevOf = j => { try { return JSON.parse(j.hist).prev || null } catch (_) { return null } };
function nameCands(shops, name, city) {  // магазины, подходящие под название (+город, если указан у обеих сторон)
  if (!T(name)) return [];
  return shops.filter(x => x.id && same(x.n, name) && (!T(city) || !x.c || same(x.c, city)));
}
// Запись значений. Строка, которую таблица приняла бы за формулу (=, +, -, @), сохраняется как текст: ячейке заранее ставится текстовый формат
const dng = v => typeof v == 'string' && /^[=+\-@\t\r]/.test(v);
function wr(s, r, c, rows) {
  const n = rows.length, m = rows[0].length; if (r + n - 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + n - 1 - s.getMaxRows());
  const g = s.getRange(r, c, n, m);
  if (rows.some(x => x.some(dng))) { const f = g.getNumberFormats(); rows.forEach((x, i) => x.forEach((v, j) => { if (dng(v)) f[i][j] = '@' })); g.setNumberFormats(f) }
  g.setValues(rows);
}
const ap = (s, row) => wr(s, s.getLastRow() + 1, 1, [row]);   // вместо appendRow
const no = (reason, f) => ({ ok: 1, applied: false, reason, f }), yes = x => Object.assign({ ok: 1, applied: true }, x || {});

/* ---------- Проверка входных данных (серверу нельзя полагаться на проверки в приложении) ---------- */
const CTL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
function str(v, max, multi) {            // строка не длиннее max; null — недопустимое значение. Управляющие символы убираются
  if (v == null) return ''; if (typeof v != 'string' && typeof v != 'number') return null;
  let s = String(v).replace(CTL, ''); if (!multi) s = s.replace(/[\r\n\t]+/g, ' '); s = s.trim();
  return s.length > max ? null : s;
}
const isNum = v => (typeof v == 'number' || (typeof v == 'string' && v.trim() !== '')) && isFinite(+v);
const rng = (v, lo, hi) => isNum(v) && +v >= lo && +v <= hi;
function validDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); if (!m) return false;
  const y = +m[1], mo = +m[2], da = +m[3], t = new Date(Date.UTC(y, mo - 1, da));
  return y >= 2000 && y <= 2100 && t.getUTCMonth() == mo - 1 && t.getUTCDate() == da;
}
function who(ctx, given) {               // кто выполняет операцию. Имя из запроса только сверяется с проверенным профилем; пустое имя правами не наделяет
  const g = T(given);
  if (ctx.legacy) return g ? { name: g } : { reason: 'trader_mismatch' };
  return g && same(g, ctx.user) ? { name: ctx.user } : { reason: 'trader_mismatch' };
}
function cleanOrder(o, now) {            // заявка: только разрешённые поля, проверенные типы и диапазоны. Возвращает { o } или { err: поле }
  if (!o || typeof o != 'object' || Array.isArray(o)) return { err: 'order' };
  const id = T(o.id); if (!ID_RE.test(id)) return { err: 'id' };
  const h = o.h; if (!h || typeof h != 'object' || Array.isArray(h)) return { err: 'h' };
  const s = str(h.s, 120), c = str(h.c, 60), a = str(h.a, 300), sid = str(h.sid, 64), d = T(h.d);
  if (!s) return { err: 'shop' }; if (c === null || a === null) return { err: 'address' }; if (sid === null || (sid && !ID_RE.test(sid))) return { err: 'sid' };
  if (!validDate(d)) return { err: 'date' };
  if (!isNum(o.ts)) return { err: 'ts' }; let ts = +o.ts; if (ts > now + FUT) ts = now;   // часы телефона не должны ставить заказ «в будущее»
  if (!(ts > 0) || (ts < now - OLDV && !o.ed)) return { err: 'ts' };   // у правки дата оформления может быть давней: администратор исправляет старые записи
  if (d < Utilities.formatDate(new Date(ts - 14 * 36e5), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd')) return { err: 'dts' };   // v34: поставка раньше дня заявки — не принимаем (запас 14 ч — на разницу часовых поясов телефона и таблицы; точную проверку делает приложение)
  let ed = 0; if (o.ed != null && o.ed !== 0 && o.ed !== '') { if (!rng(o.ed, now - OLDV, now + FUT)) return { err: 'ed' }; ed = +o.ed }
  const disc = o.disc == null || o.disc === '' ? 0 : o.disc; if (!rng(disc, 0, 100)) return { err: 'disc' };
  if (!rng(o.sum, 0, 1e9)) return { err: 'sum' };
  if (o.m != 'vat' && o.m != 'net') return { err: 'm' };
  const cart = {}, ck = o.cart == null ? [] : (typeof o.cart == 'object' && !Array.isArray(o.cart) ? Object.keys(o.cart) : null);
  if (!ck || ck.length > 300) return { err: 'cart' };
  for (const k of ck) { const x = o.cart[k]; if (k.length > 250 || !x || typeof x != 'object' || !rng(x.q, 0, 1e5) || !(+x.q > 0)) return { err: 'cart' };
    cart[k] = { q: +x.q }; if (x.p != null) { if (!rng(x.p, 0, 1e8)) return { err: 'cart' }; cart[k].p = +x.p } }
  const items = [], it = o.items == null ? [] : (Array.isArray(o.items) ? o.items : null); if (!it || it.length > 300) return { err: 'items' };
  for (const x of it) { if (!x || typeof x != 'object') return { err: 'items' };
    const n = str(x.n, 200), g = str(x.g, 60), u = str(x.u, 20);
    if (!n || g === null || u === null || !rng(x.q, 0, 1e5) || !(+x.q > 0) || !rng(x.p, 0, 1e8) || !rng(x.o == null ? x.p : x.o, 0, 1e8)) return { err: 'items' };
    items.push({ n, g, u, q: +x.q, p: +x.p, o: +(x.o == null ? x.p : x.o) }) }
  if (!items.length && !ck.length) return { err: 'empty' };
  if (items.length) { const tot = Math.round(items.reduce((z, x) => z + x.p * x.q, 0)), f = Math.round(tot * (1 - +disc / 100));   // та же формула, что в приложении
    if (Math.abs(f - +o.sum) > 2) return { err: 'sum' } }
  let rc = null; if (o.rc != null) { if (typeof o.rc != 'object') return { err: 'rc' }; const n = str(o.rc.n, 80), p = str(o.rc.p, 20); if (n === null || p === null || /\D/.test(p)) return { err: 'rc' }; rc = { n, p } }
  const text = str(o.text, 20000, true); if (text === null) return { err: 'text' };
  const r = { id, ts, trader: '', h: { d, c, s, a, sid }, cart, disc: +disc, sum: +o.sum, m: o.m, rc: rc || { n: '', p: '' }, text, items };
  if (ed) r.ed = ed;
  return { o: r };
}

/* ---------- Секреты, хеши, токены ---------- */
const props = () => PropertiesService.getScriptProperties();
const sb = x => x > 127 ? x - 256 : x;   // байты в Apps Script — со знаком
const hexOf = b => b.map(x => ('0' + (x & 255).toString(16)).slice(-2)).join('');
const bytesOfHex = h => h.match(/../g).map(x => sb(parseInt(x, 16)));
const utf8 = s => Utilities.newBlob(String(s)).getBytes();
const hmac = (msg, key) => Utilities.computeHmacSha256Signature(msg, key);
const b64u = b => Utilities.base64EncodeWebSafe(b).replace(/=+$/, '');
function rndHex(n) { let h = ''; while (h.length < n * 2) h += Utilities.getUuid().replace(/-/g, ''); return h.slice(0, n * 2) }   // случайные байты из UUID v4
function constEq(a, b) {                 // сравнение без раннего выхода
  a = String(a); b = String(b); if (a.length != b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
function secret(name) {                  // секрет создаётся при первом обращении и хранится в свойствах скрипта (не в коде и не в таблице)
  let v = props().getProperty(name); if (v) return v;
  return withLock(() => { let x = props().getProperty(name); if (!x) { x = rndHex(32); props().setProperty(name, x) } return x });
}
const authOn = () => props().getProperty('AUTH_REQUIRED') == '1';
const iterCfg = () => { const n = Math.round(+props().getProperty('PBKDF2_ITER') || ITER_DEF); return Math.min(Math.max(n, ITER_MIN), ITER_MAX) };
function pbkdf2(pw, salt, iter) {        // PBKDF2-HMAC-SHA256, один блок (32 байта)
  const key = utf8(pw); let u = hmac(salt.concat([0, 0, 0, 1]), key); const t = u.slice();
  for (let i = 1; i < iter; i++) { u = hmac(u, key); for (let j = 0; j < t.length; j++) t[j] ^= u[j] }
  return t;
}
const pepper = pw => Utilities.base64Encode(hmac(utf8(pw), utf8(secret('PEPPER'))));   // без «перца» из свойств скрипта хеши из таблицы подобрать нельзя
function hashPw(pw, iter) {
  iter = iter || iterCfg(); const salt = bytesOfHex(rndHex(16));
  return ['pbkdf2-sha256', iter, Utilities.base64Encode(salt), Utilities.base64Encode(pbkdf2(pepper(pw), salt, iter))].join('$');
}
function parseHash(s) {
  const p = String(s || '').split('$'); if (p.length != 4 || p[0] != 'pbkdf2-sha256') return null;
  const it = +p[1]; if (!(it >= ITER_MIN && it <= ITER_MAX) || it != Math.round(it)) return null;
  try { return { it, salt: Utilities.base64Decode(p[2]), h: p[3] } } catch (_) { return null }
}
function verifyPw(pw, stored) { const p = parseHash(stored); return !!p && constEq(Utilities.base64Encode(pbkdf2(pepper(pw), p.salt, p.it)), p.h) }
const burn = pw => { pbkdf2(pepper(pw), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], iterCfg()) };   // та же работа для несуществующего профиля: по времени ответа профиль не угадать
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // без похожих знаков (0/O, 1/I)
function newCode() { const b = bytesOfHex(rndHex(16)); let c = ''; for (let i = 0; i < 16; i++) c += (i && i % 4 == 0 ? '-' : '') + CODE_ABC[b[i] & 31]; return c }   // 80 бит
const normCode = c => String(c == null ? '' : c).toUpperCase().replace(/[^A-Z0-9]/g, '');
const invHash = code => 'inv$' + hexOf(hmac(utf8(normCode(code)), utf8(secret('PEPPER'))));
function pwProblem(pw, name) {           // требования к паролю; '' — подходит
  if (typeof pw != 'string' || pw.length < PW_MIN) return 'Пароль слишком короткий: нужно не меньше ' + PW_MIN + ' знаков.';
  if (pw.length > PW_MAX) return 'Пароль слишком длинный.';
  const l = pw.toLowerCase();
  if (/^(.)\1*$/.test(pw) || /^\d+$/.test(pw)) return 'Пароль слишком простой: не только цифры и не один повторяющийся знак.';
  if (T(name) && l.indexOf(T(name).toLowerCase()) >= 0) return 'Пароль не должен содержать имя профиля.';
  if (/^(password|parol|qwerty|йцукен|пароль|alibaba|али-?баба)/.test(l) || '01234567890123456789'.indexOf(l) >= 0 || 'abcdefghijklmnopqrstuvwxyz'.indexOf(l) >= 0) return 'Пароль слишком простой. Придумайте фразу из нескольких слов.';
  return '';
}

/* ---------- Учётные записи (лист «Торговые») ---------- */
const roleOf = v => /^(admin|админ)/i.test(T(v)) ? 'admin' : 'trader';
function readTraders() {
  const s = trSheet(), n = s.getLastRow(); if (n < 2) return [];
  return s.getRange(2, 1, n - 1, TR_HEAD.length).getValues().map((r, i) => ({ r: i + 2, n: T(r[0]), role: roleOf(r[1]), ver: +r[2] || 0, hash: T(r[3]), inv: T(r[4]), invU: +r[5] || 0, st: T(r[6]), last: +r[7] || 0 })).filter(x => x.n);
}
function findTrader(name, list) { const l = (list || readTraders()).filter(x => same(x.n, name)); return l.length == 1 ? l[0] : null }   // одинаковые имена — профиль не определён
const active = x => !!(x.hash && x.st != 'revoked');
function vName(v) { const s = str(v, 40); return s && !dng(s) && !/[<>"'`\\]/.test(s) ? s : '' }
function mkToken(row) {                  // токен: данные + подпись HMAC-SHA256; без секрета сервера его не подделать и не изменить
  const body = b64u(utf8(JSON.stringify({ u: row.n, v: row.ver, e: Date.now() + TOKEN_DAYS * 864e5 })));
  return body + '.' + b64u(hmac(utf8(body), utf8(secret('TOKEN_KEY'))));
}
function checkToken(tok) {               // подпись → срок → профиль существует, доступ не отозван, версия доступа та же. Роль берётся с листа, а не из токена
  const p = String(tok).split('.'); if (p.length != 2 || !p[0] || p[0].length > 600) return null;
  if (!constEq(b64u(hmac(utf8(p[0]), utf8(secret('TOKEN_KEY')))), p[1])) return null;
  let d; try { d = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0] + '==='.slice((p[0].length + 3) % 4))).getDataAsString()) } catch (_) { return null }   // дополнение «=» возвращаем: в токене его нет
  if (!d || !(+d.e > Date.now())) return null;
  const row = findTrader(d.u); if (!row || !active(row) || row.ver !== +d.v) return null;
  return { user: row.n, role: row.role };
}
function authCtx(d) {
  if (typeof d.tok == 'string' && d.tok) return checkToken(d.tok);
  if (!authOn() && typeof d.key == 'string' && d.key) {   // только до включения обязательной авторизации: очереди устройств со старой версией приложения
    const lk = props().getProperty('LEGACY_KEY'); if (lk && constEq(lk, d.key)) return { user: '', role: 'trader', legacy: true } }
  return null;
}
// Счётчик неудачных попыток: по профилю (ключ — хеш имени, так что существование профиля не раскрывается) и общий
const attKey = name => 'p:' + hexOf(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'n:' + String(name).trim().toLowerCase().replace(/ё/g, 'е'), Utilities.Charset.UTF_8)).slice(0, 24);
function attLoad() { try { return JSON.parse(props().getProperty('ATT') || '{}') || {} } catch (_) { return {} } }
function attWait(key, now) { const a = attLoad(), u = Math.max(a['*'] && a['*'].u || 0, a[key] && a[key].u || 0); return u > now ? Math.ceil((u - now) / 1000) : 0 }
function attFail(key, now) {
  withLock(() => { const a = attLoad();
    Object.keys(a).forEach(k => { const x = a[k]; if (!x || (x.u < now && now - x.t > Math.max(ATT_LOCK, ATT_G_WIN))) delete a[k] });
    const hit = (k, max, win, lock) => { let x = a[k]; if (!x || now - x.t > win) x = { n: 0, t: now, u: 0 }; x.n++; if (x.n >= max) { x.u = now + lock; x.n = 0; x.t = now } a[k] = x };
    hit(key, ATT_MAX, ATT_LOCK, ATT_LOCK); hit('*', ATT_G_MAX, ATT_G_WIN, ATT_G_LOCK);
    const ks = Object.keys(a).filter(k => k != '*'); if (ks.length > 100) ks.sort((p, q) => a[p].t - a[q].t).slice(0, ks.length - 100).forEach(k => delete a[k]);   // значение свойства скрипта ограничено 9 КБ; перебор по множеству имён ловит общий счётчик
    props().setProperty('ATT', JSON.stringify(a)) });
}
function attOk(key) { withLock(() => { const a = attLoad(); if (a[key]) { delete a[key]; props().setProperty('ATT', JSON.stringify(a)) } }) }
function authOp(a) {                      // вход по профилю и паролю / первое задание пароля по одноразовому приглашению
  if (!a || typeof a != 'object') return { error: 'request' };
  const now = Date.now(), name = str(a.name, 60), pw = a.password, bad = { error: 'login' };   // один и тот же ответ для «нет профиля», «не тот пароль», «нет доступа»
  if (!name || typeof pw != 'string' || !pw || pw.length > 1000) return bad;
  const key = attKey(name), wait = attWait(key, now); if (wait) return { error: 'throttled', wait };
  if (a.op == 'login') {
    const row = findTrader(name), ok = row && active(row) ? verifyPw(pw, row.hash) : (burn(pw), false);   // хеш считается вне блокировки
    if (!ok) { attFail(key, now); return bad }
    const p = parseHash(row.hash), up = p && p.it < iterCfg() ? hashPw(pw) : '';   // число итераций подняли — хеш обновляется при входе
    return withLock(() => { const cur = findTrader(name); if (!cur || !active(cur) || cur.hash !== row.hash || cur.ver !== row.ver) return bad;
      if (up) wr(trSheet(), cur.r, 4, [[up]]); wr(trSheet(), cur.r, 8, [[now]]); attOk(key);
      return { ok: 1, token: mkToken(cur), name: cur.n, role: cur.role, srv: SRV } });
  }
  if (a.op == 'redeem') {
    const code = normCode(a.invite); if (code.length != 16) { attFail(key, now); return bad }
    const row = findTrader(name), h = invHash(code), valid = r => !!(r && r.inv && r.invU > Date.now() && constEq(r.inv, h));
    if (!valid(row)) { attFail(key, now); return bad }
    const why = pwProblem(pw, row.n); if (why) return { error: 'weak', msg: why };   // приглашение при этом не расходуется
    const hash = hashPw(pw);
    return withLock(() => { const cur = findTrader(name); if (!valid(cur)) return bad;   // приглашение одноразовое: второй запрос с тем же кодом сюда не дойдёт
      const up = Object.assign({}, cur, { ver: cur.ver + 1 }); wr(trSheet(), cur.r, 3, [[up.ver, hash, '', '', '']]); attOk(key);
      audit(cur.n, 'admin_password_set', cur.n, '');
      return { ok: 1, token: mkToken(up), name: cur.n, role: cur.role, srv: SRV } });
  }
  return { error: 'request' };
}
function audit(by, kind, target, note) { jlog({ id: 'adm:' + Date.now().toString(36) + rndHex(3), who: by, kind, val: target, nt: note, ts: Date.now() }) }   // журнал действий с доступом: без паролей, кодов и токенов
function mkInvite(name, by) {             // новое одноразовое приглашение. Прежний пароль и все выданные токены перестают действовать
  return withLock(() => { const row = findTrader(name); if (!row) return null;
    const code = newCode(), until = Date.now() + INVITE_H * 36e5;
    wr(trSheet(), row.r, 3, [[row.ver + 1, '', invHash(code), until, '', '']]); audit(by, row.hash ? 'admin_reset' : 'admin_invite', row.n, '');   // «последний вход» обнуляется: учётная запись снова не проверена
    return { code, until, profile: row.n } });
}
const pubT = (x, now) => ({ n: x.n, role: x.role, state: x.st == 'revoked' ? 'revoked' : x.hash ? 'active' : x.inv ? (x.invU > now ? 'invited' : 'invite_expired') : 'none', until: !x.hash && x.invU > now ? x.invU : 0, last: x.last });
function adminOp(a, ctx) {                // всё административное: только роль admin, проверенная по листу «Торговые» при этом же запросе
  if (ctx.legacy || ctx.role != 'admin') return { error: 'forbidden' };
  if (!a || typeof a != 'object') return { error: 'request' };
  const now = Date.now(), me = ctx.user;
  if (a.op == 'list') return { ok: 1, profiles: readTraders().map(x => pubT(x, now)), required: authOn() };
  if (a.op == 'promo') { const k = str(a.key, 250); if (!k || dng(k) || (k.match(/\|/g) || []).length != 2) return no('invalid', 'key');   // v31: «Продвигать» — отметить товар (on) или снять отметку
    return withLock(() => { const s = promoSheet(), L = readPromo(), has = L.filter(x => x.k == k);
      if (a.on) { if (!has.length) ap(s, [k, me, new Date(now)]) } else has.map(x => x.r).sort((p, q) => q - p).forEach(r => s.deleteRow(r));
      return yes({ promo: readPromo().map(x => x.k) }) }) }
  if (a.op == 'ownersDry') return Object.assign({ ok: 1 }, ownersReport());
  if (a.op == 'ownersApply') return withLock(() => ownersApply(a, me));
  if (a.op == 'recDry' || a.op == 'recApply') { const apply = a.op == 'recApply'; if (apply && a.confirm !== true) return no('confirm');   // сверка старых данных — то же, что в меню таблицы
    return withLock(() => { const rep = reconcile_(apply); if (apply) { writeReport_(rep); audit(me, 'admin_reconcile', '', 'изменений: ' + rep.changes) }   // проверка из приложения ничего не пишет, даже отчёт
      return yes({ counts: rep.counts, changes: rep.changes }) }) }
  return withLock(() => {
    const list = readTraders(), others = n => list.filter(x => x.role == 'admin' && active(x) && !same(x.n, n)).length;
    if (a.op == 'add') { const n = vName(a.name); if (!n) return no('invalid', 'name'); if (list.some(x => same(x.n, n))) return no('exists');
      const role = a.role == 'admin' ? 'admin' : 'trader'; ap(trSheet(), [n, role, 0, '', '', '', '', '']); audit(me, 'admin_add', n, role); return yes() }
    const name = str(a.profile, 60), row = name ? findTrader(name, list) : null; if (!row) return no('not_found');
    if (a.op == 'invite') { if (row.role == 'admin' && active(row) && !others(row.n)) return no('last_admin');   // иначе потерянный ответ оставил бы систему без администратора; для этого случая есть меню таблицы
      const r = mkInvite(row.n, me); return r ? yes(r) : no('not_found') }
    if (a.op == 'revoke') { if (row.role == 'admin' && !others(row.n)) return no('last_admin');
      wr(trSheet(), row.r, 3, [[row.ver + 1, '', '', '', 'revoked', '']]); audit(me, 'admin_revoke', row.n, ''); return yes() }
    if (a.op == 'role') { if (a.role != 'admin' && a.role != 'trader') return no('invalid', 'role');
      if (row.st == 'revoked') return no('revoked');                              // сначала вернуть доступ приглашением, потом менять роль
      if (row.role == 'admin' && a.role != 'admin' && !others(row.n)) return no('last_admin');
      if (row.role == a.role) return yes({ dup: true });
      wr(trSheet(), row.r, 2, [[a.role, row.ver + 1]]); audit(me, 'admin_role', row.n, a.role); return yes() }   // версия доступа растёт: старые токены этого профиля теряют силу
    if (a.op == 'delete') { if (same(row.n, me)) return no('self');             // себя удалить нельзя — значит, хотя бы один действующий администратор остаётся всегда
      trSheet().deleteRow(row.r); audit(me, 'admin_delete', row.n, row.role); return yes() }   // заявки и визиты хранят имя и остаются как были; токены профиля перестают действовать — профиля больше нет
    return { error: 'action' } });
}
/* --- Заявки без торгового: только администратор, сначала пробный прогон, перед записью — копия листа --- */
function ownerless() {
  const s = ordSheet(), n = s.getLastRow(); if (n < 2) return [];
  const res = []; s.getRange(2, 1, n - 1, 16).getValues().forEach((r, i) => { if (T(r[2])) return; let o = {}; try { o = JSON.parse(r[11]) || {} } catch (_) {}
    res.push({ row: i + 2, id: T(r[1]), shop: T(r[5]), city: T(r[4]), d: dstr(r[3]), sum: +r[9] || 0, ts: +r[15] || +o.ts || ms(r[0]), jt: T(o.trader), del: !!((+r[13] || 0) || isD(r[12])) }) });
  return res;
}
function ownersReport() {                 // пробный прогон: ничего не записывает
  const l = ownerless(), ts = l.map(x => x.ts).filter(Boolean);
  return { count: l.length, deleted: l.filter(x => x.del).length, from: ts.length ? Math.min.apply(null, ts) : 0, to: ts.length ? Math.max.apply(null, ts) : 0,
    withJsonTrader: l.filter(x => x.jt).length, sample: l.slice(-100).reverse(), traders: readTraders().map(x => x.n) };
}
function ownersApply(a, me) {
  const owner = findTrader(str(a.owner, 60) || ''); if (!owner) return no('not_found');
  if (a.confirm !== 'НАЗНАЧИТЬ') return no('confirm');
  const l = ownerless(); if (!l.length) return yes({ updated: 0 });
  if (+a.expect !== l.length) return no('changed', String(l.length));       // после пробного прогона данные изменились — нужен новый прогон
  const ss = SpreadsheetApp.getActive(), s = ordSheet(), n = s.getLastRow();
  const bn = 'Заявки (копия ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH-mm-ss') + ')';
  const bk = s.copyTo(ss); bk.setName(bn); if (bk.getLastRow() !== n) return no('backup');   // без проверенной копии ничего не меняем
  const J = s.getRange(2, 12, n - 1, 1).getValues(); let k = 0;
  for (let i = 0; i < l.length;) {                                             // подряд идущие строки — одной записью; остальные строки листа не перезаписываются
    let j = i; while (j + 1 < l.length && l[j + 1].row == l[j].row + 1) j++;
    const part = l.slice(i, j + 1), js = part.map(x => { let o = null; try { o = JSON.parse(J[x.row - 2][0]) } catch (_) {}
      if (o && typeof o == 'object' && !Array.isArray(o)) { o.trader = owner.n; return [JSON.stringify(o)] } return [J[x.row - 2][0]] });   // данные, которые не разобрать, оставляем как есть
    wr(s, part[0].row, 3, part.map(() => [owner.n])); wr(s, part[0].row, 12, js); k += part.length; i = j + 1 }
  audit(me, 'admin_assign_owner', owner.n, 'заявок: ' + k + '; копия: ' + bn);
  return yes({ updated: k, backup: bn });
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
    if (sumDiff(x, f)) wr(shopSheet(), x.r, 12, [[f.lo || '', f.lv || '', f.lb, f.lw]]) });
}
const recalcShop = id => recalcShops([id]);
const shopIdAt = r => r ? T(shopSheet().getRange(r, 4).getValue()) : '';

/* ---------- Журнал событий (лист «Визиты») ---------- */
function jlog(e) {                       // добавляет событие; повтор того же ID игнорируется. Возвращает true, если запись создана
  if (hasLog(e.id)) return false;
  ap(jSheet(), [new Date(), e.id, e.shop || '', e.sid || '', e.who || '', e.kind, e.val == null ? '' : e.val, e.nt || '', e.ts || Date.now(), '', e.by || '', '', e.hist ? JSON.stringify(e.hist) : '', e.oid || '']);
  return true;
}
function hasLog(id) { const s = jSheet(), n = s.getLastRow(); return n > 1 && s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)) >= 0 }

/* ---------- Заявки ---------- */
const vat = o => o.m == 'vat' ? 'с НДС' : 'без НДС';
function saveOrder(o0, ctx) {            // создание заявки (повтор того же ID не создаёт дубль, а лечит возможные хвосты прошлой попытки)
  const now = Date.now(), adm = ctx.role == 'admin' && !ctx.legacy;
  const w = adm && o0 && o0.ed ? { name: ctx.user } : who(ctx, o0 && o0.trader); if (w.reason) return no(w.reason);   // администратор правит и чужие заявки: имя владельца в запросе не его, владельцем остаётся прежний торговый
  const cl = cleanOrder(o0, now); if (cl.err) return no('invalid', cl.err);
  const o = cl.o; o.trader = w.name;
  let bed = null; if (o0.bed != null && o0.bed !== '') { if (!isNum(o0.bed) || +o0.bed < 0) return no('invalid', 'bed'); bed = +o0.bed }   // v34: версия (ed), с которой начата правка; 0 — правок не было. Старые клиенты её не присылают
  const s = ordSheet(), n = s.getLastRow(), ids = n > 1 ? s.getRange(2, 2, n - 1, 1).getValues().flat().map(String) : [], ix = ids.indexOf(String(o.id));
  if (ix >= 0) { const owner = T(s.getRange(ix + 2, 3).getValue());
    if (!owner) return no('no_owner'); if (!same(owner, w.name) && !(adm && o.ed)) return no('not_owner');   // чужую заявку правит только администратор; заявку без владельца не меняет никто
    return o.ed ? editOrder(s, ix + 2, o, adm, w.name, bed) : healOrder(s, ix + 2) }
  const r = upShop(o.h.s, o.h.c, o.h.a, o.h.sid), sid = shopIdAt(r), ts = o.ts;
  o.h.sid = sid;
  ap(s, [new Date(), o.id, o.trader, o.h.d, o.h.c, o.h.s, o.h.a, vat(o), o.disc, o.sum, o.text, JSON.stringify(o), '', '', sid, ts]);
  jlog({ id: 'oc:' + o.id, shop: o.h.s, sid, who: o.trader, kind: 'order_create', val: o.sum, nt: 'на ' + o.h.d, ts, oid: o.id });
  recalcShops([sid]);
  return { ok: 1, applied: true, sid };
}
function healOrder(s, row) {             // повторный запрос создания: ничего не дублируем, дописываем недостающее и пересчитываем
  const v = s.getRange(row, 1, 1, 16).getValues()[0]; let o = {}; try { o = JSON.parse(v[11]) || {} } catch (_) {}
  let sid = T(v[14]), ts = +v[15] || 0;
  if (!sid) { const h = o.h || {}; sid = shopIdAt(upShop(h.s || v[5], h.c || v[4], h.a || v[6], h.sid)) }
  if (!ts) ts = +o.ts || ms(v[0]);
  s.getRange(row, 15, 1, 2).setValues([[sid, ts]]);
  if (!hasLog('oc:' + v[1])) jlog({ id: 'oc:' + v[1], shop: T(v[5]), sid, who: T(v[2]), kind: 'order_create', val: +v[9] || 0, nt: 'на ' + dstr(o.h && o.h.d || v[3]), ts, oid: T(v[1]) });
  recalcShops([sid]);
  return { ok: 1, applied: true, dup: true, sid };
}
function setLogTs(id, ts) { const s = jSheet(), n = s.getLastRow(); if (n < 2) return; const i = s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)); if (i >= 0) s.getRange(i + 2, 9).setValue(ts) }   // время события в журнале
function editOrder(s, row, o, adm, by, bed) { // заменяет содержимое заявки. Владелец — не позже EDIT_H часов после записи на сервере; администратор — любую заявку с владельцем и без срока
  const v = s.getRange(row, 1, 1, 16).getValues()[0], owner = T(v[2]); let old = {}; try { old = JSON.parse(v[11]) || {} } catch (_) {}
  if (!owner) return no('no_owner'); if (!same(owner, o.trader) && !adm) return no('not_owner');
  o.trader = owner;
  const created = +v[15] || +old.ts || ms(v[0]), reg = ms(v[0]) || created;         // срок правки считается от времени записи на сервере: дату оформления можно менять, и сдвигать ею срок нельзя
  if (!adm && ((+o.ed || 0) - reg > EDIT_H * 36e5 + 5 * 6e4 || Date.now() - (+o.ed || 0) > QUEUE_MAX)) return no('too_late');   // ed — время нажатия на устройстве: правка из очереди старше QUEUE_MAX не принимается, так что задним числом срок не обойти
  const curEd = +old.ed || 0;
  if (bed != null && curEd != +o.ed && curEd != bed) {                              // v34: с начала правки заявку уже изменил кто-то другой — не затираем; повтор той же правки (curEd == o.ed) проходит
    const je = curEd ? readJournal().find(j => j.id == 'oe:' + T(v[1]) + ':' + curEd) : null;
    return Object.assign(no('changed'), { by: je ? je.who : '', at: curEd }) }
  if (curEd > +o.ed) return no('stale');                                    // более новая правка уже записана
  let oldSid = T(v[14]) || (() => { const st = loadState(true), x = st.orders.find(y => y.id == T(v[1])); return x ? x.link : '' })();
  const same_ = (+old.ed || 0) == +o.ed;                                            // та же правка пришла повторно — только долечиваем хвосты
  const r = upShop(o.h.s, o.h.c, o.h.a, o.h.sid), sid = shopIdAt(r), ts = +o.ts > 0 ? +o.ts : created; o.h.sid = sid; o.ts = ts;   // ts — когда заявка сделана; её можно исправить
  const evId = 'oe:' + v[1] + ':' + o.ed;
  if (same_) { const je = readJournal().find(j => j.id == evId), pv = je && prevOf(je); if (pv && pv.sid) oldSid = pv.sid }   // повтор после сбоя: «старый» магазин берём из журнала, а не из уже обновлённой строки
  if (!same_ || !hasLog(evId)) jlog({ id: evId, shop: o.h.s, sid, who: by || o.trader, kind: 'order_edit', val: o.sum, nt: 'на ' + o.h.d, ts: +o.ed, oid: T(v[1]),
    hist: { prev: { sum: +v[9] || 0, d: dstr(v[3]), sid: oldSid, s: T(v[5]), c: T(v[4]), a: T(v[6]), ts: created } } });   // что было до правки — структурно
  wr(s, row, 4, [[o.h.d, o.h.c, o.h.s, o.h.a, vat(o), o.disc, o.sum, o.text, JSON.stringify(o)]]);
  s.getRange(row, 15, 1, 2).setValues([[sid, ts]]); if (ts != created) setLogTs('oc:' + v[1], ts);   // событие «заявка создана» в ленте магазина переезжает на новую дату
  recalcShops([sid, oldSid]);                                                       // при переносе A→B пересчитываются оба магазина
  return same_ ? { ok: 1, applied: true, dup: true, sid } : { ok: 1, applied: true, sid };
}
function orderOp(x, ctx) {               // удаление / возврат заявки: {id, del (мс; 0 — вернуть), trader, at (когда пользователь нажал)}
  if (!x || typeof x != 'object') return no('invalid', 'op');
  const w = who(ctx, x.trader); if (w.reason) return no(w.reason);
  const id = T(x.id), now = Date.now(); if (!ID_RE.test(id)) return no('invalid', 'id');
  let del = 0, at = 0;
  if (x.del != null && x.del !== '' && x.del !== 0 && x.del !== '0') { if (!isNum(x.del) || +x.del < 0) return no('invalid', 'del'); del = +x.del; if (del > now + FUT) return no('future'); if (del < now - OLDV) del = now }
  if (x.at != null && x.at !== '') { if (!isNum(x.at) || !(+x.at > 0)) return no('invalid', 'at'); at = +x.at; if (at > now + FUT) return no('future') }
  return Object.assign({ ok: 1 }, setDeleted(id, del, w.name, at, now, ctx.role == 'admin' && !ctx.legacy));
}
function setDeleted(id, ts, trader, at, now, adm) { // помечает заявку удалённой (строка остаётся) или снимает пометку; честно возвращает результат; повтор безопасен. v34: администратор — любую заявку с торговым
  const s = ordSheet(), n = s.getLastRow(); if (n < 2) return { applied: false, reason: 'not_found' };
  const i = s.getRange(2, 2, n - 1, 1).getValues().flat().map(String).indexOf(String(id)); if (i < 0) return { applied: false, reason: 'not_found' };
  const row = i + 2, v = s.getRange(row, 1, 1, 16).getValues()[0], owner = T(v[2]);
  const cur = (+v[13] || 0) || (isD(v[12]) ? v[12].getTime() : 0);
  if (!owner) return { applied: false, reason: 'no_owner', del: cur };                // у заявки нет владельца: менять её может только администратор отдельным инструментом
  if (!trader || (!same(owner, trader) && !adm)) return { applied: false, reason: 'not_owner', owner, del: cur };   // чужую заявку удалить или вернуть может только администратор; владелец при этом не меняется
  let sid = T(v[14]); if (!sid) { const st = loadState(true), x = st.orders.find(y => y.id == T(v[1])); sid = x ? x.link : '' }
  const shop = T(v[5]), ev = { shop, sid, who: owner, by: trader, oid: T(v[1]), val: +v[9] || 0 };   // who — владелец заявки, by — кто удалил или вернул (колонка «Изменил»)
  if (ts) {                                                                          // удаление
    const dts = cur || +ts;                                                         // уже удалена — оставляем первое время удаления
    jlog(Object.assign({ id: 'od:' + v[1] + ':' + dts, kind: 'order_cancel', ts: dts }, ev));
    if (!cur) { s.getRange(row, 13).setValue(Utilities.formatDate(new Date(ts), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm') + ' · ' + trader);   // для людей; v34: и кто удалил — по нему администратор видит в «Недавно удалённых» чужие заявки, удалённые им
      s.getRange(row, 14).setValue(+ts) }                                           // для приложения (число, без часовых поясов)
    recalcShops([sid]); return { applied: true, dup: !!cur, del: dts };
  }
  if (!cur) { recalcShops([sid]); return { applied: true, dup: true, del: 0 } }      // уже не удалена
  // Возврат — не позже UNDO_H часов после удаления. Есть время нажатия (at) — считаем от него, с небольшим допуском; нет (старая очередь) — строго по часам сервера
  const lim = UNDO_H * 36e5, strict = !at || at < cur - UNDO_TOL;
  if (strict ? now - cur > lim : (at - cur > lim + UNDO_TOL || now - at > QUEUE_MAX)) return { applied: false, reason: 'expired', del: cur };
  jlog(Object.assign({ id: 'or:' + v[1] + ':' + cur, kind: 'order_restore', ts: strict ? now : at }, ev));
  s.getRange(row, 13, 1, 2).clearContent();
  recalcShops([sid]); return { applied: true, del: 0 };
}

/* ---------- Магазины: ID, статусы, контакты, последний заказ и визит ---------- */
const same = (a, b) => String(a).trim().toLowerCase().replace(/ё/g, 'е') == String(b).trim().toLowerCase().replace(/ё/g, 'е');
const newId = () => 's' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);
function shopSheet() {                   // при необходимости достраиваем колонки и заголовки. Колонки S–Z (v31) должны быть нашими: чужие данные не перезаписываем
  const s0 = sh('Магазины'), k = Math.min(s0.getMaxColumns(), SHOP_HEAD.length) - SHOP_OLD, n0 = s0.getLastRow();
  if (k > 0) { const h0 = s0.getRange(1, SHOP_OLD + 1, 1, k).getValues()[0], col = i => { const k = SHOP_OLD + i; return k < 26 ? String.fromCharCode(65 + k) : 'A' + String.fromCharCode(39 + k) }, tail = ' Колонки S–AB нужны для маршрута, режима цен, места точки, юрлица и заметок — перенесите свои данные правее';   // проверяем ДО любой записи
    h0.forEach((t, i) => { const v = T(t);
      if (v && v !== SHOP_HEAD[SHOP_OLD + i]) throw new Error('лист «Магазины»: колонка ' + col(i) + ' занята («' + v + '»).' + tail);
      if (!v && n0 > 1 && s0.getRange(2, SHOP_OLD + 1 + i, n0 - 1, 1).getValues().some(r => T(r[0]) !== '')) throw new Error('лист «Магазины»: в колонке ' + col(i) + ' есть данные без заголовка.' + tail) }) }
  return ensureHead(s0, SHOP_HEAD);
}
const daysOf = v => { const t = T(v).toLowerCase(); return WD.map((d, i) => t.indexOf(d.toLowerCase()) >= 0 ? i : -1).filter(i => i >= 0) };   // «Пн, Чт» → [0, 3]; регистр не важен
const daysTxt = a => a.map(i => WD[i]).join(', ');
const vmOf = v => { const t = T(v).toLowerCase(); return /без/.test(t) ? 'net' : /ндс|nds|vat/.test(t) ? 'vat' : '' };
const VM_TXT = { vat: 'с НДС', net: 'без НДС', '': '' };
function readShops() {
  const s = shopSheet(), n = s.getLastRow(); if (n < 2) return [];
  const L = x => +x || 0;
  return s.getRange(2, 1, n - 1, SHOP_HEAD.length).getValues().map((r, i) => ({ r: i + 2, n: T(r[0]), c: T(r[1]), a: T(r[2]), id: T(r[3]), st: T(r[4]), nt: T(r[5]), sb: T(r[6]), sa: L(r[7]),
    ct: T(r[8]), tl: T(r[9]), rg: T(r[10]), lo: L(r[11]), lv: L(r[12]), lb: T(r[13]), lw: T(r[14]), ty: T(r[15]), pl: L(r[16]), fq: T(r[17]),
    rw: daysOf(r[18]), ow: T(r[19]), vm: vmOf(r[20]), la: r[21] === '' ? null : +r[21], ln: r[22] === '' ? null : +r[22], ac: L(r[23]), gb: T(r[24]), ga: ms(r[25]), ul: T(r[26]), nb: T(r[27]) })).filter(x => x.n);
}
const pub = x => ({ id: x.id, n: x.n, c: x.c, a: x.a, st: x.st, nt: x.nt, sb: x.sb, sa: x.sa, ct: x.ct, tl: x.tl, rg: x.rg, lo: x.lo, lv: x.lv, lb: x.lb, lw: x.lw, ty: x.ty, pl: x.pl, fq: x.fq,
  rw: x.rw, ow: x.ow, vm: x.vm, la: isFinite(x.la) && x.la !== null ? x.la : null, ln: isFinite(x.ln) && x.ln !== null ? x.ln : null, ac: x.ac, gb: x.gb, ga: x.ga, ul: x.ul, nb: x.nb });
function ensureIds() {                   // каждому магазину без ID присваиваем его (один раз; под блокировкой — через withLock, вложенной блокировки не бывает)
  let list = readShops(); if (!list.some(x => !x.id)) return list;
  return withLock(() => { const l = readShops(), s = shopSheet(); l.forEach(x => { if (!x.id) { x.id = newId(); s.getRange(x.r, 4).setValue(x.id) } }); return l });
}
function findShop(list, id, name, city, addr) { // v35: магазин с ID — только по ID (одинаковые названия — разные магазины, «Продукты» не склеиваются). Без ID (старые записи, вписанное от руки) — по названию + городу; несколько — по адресу, иначе первый
  if (id) return list.find(x => x.id == id) || null;
  if (!name) return null; const c = list.filter(x => same(x.n, name) && (!city || !x.c || same(x.c, city))); if (c.length < 2) return c[0] || null;
  return (addr && c.find(x => same(x.a, addr))) || c[0] }
function upShop(n, c, a, id, ty) {           // находит магазин (по ID; без ID — по названию) или создаёт; возвращает номер строки. v35: незнакомый ID — новый магазин с этим ID, а не «похожий по названию»
  n = String(n || '').trim(); if (!n) return 0;
  const s = shopSheet(), list = readShops(), x = findShop(list, id, n, c, a);
  if (x) { if (!x.c && c) wr(s, x.r, 2, [[c]]); if (!x.a && a) wr(s, x.r, 3, [[a]]);
    if (!x.id) s.getRange(x.r, 4).setValue(id && !list.some(y => y.id == id) ? String(id) : newId());
    return x.r }
  ap(s, [n, c || '', a || '', id && !list.some(y => y.id == id) ? String(id) : newId()]);
  if (ty) s.getRange(s.getLastRow(), 16).setValue(String(ty));
  return s.getLastRow();
}
function shopOp(x, ctx) {                // правки магазинов: каждое поле проверяется; статус записывается от имени проверенного профиля
  if (!x || typeof x != 'object') return no('invalid', 'shop');
  const now = Date.now(), op = T(x.op), id = str(x.id, 64); if (id === null || (id && !ID_RE.test(id))) return no('invalid', 'id');
  if (op == 'days' || op == 'owner' || op == 'vat' || op == 'geo' || op == 'geodel' || op == 'rday') return shopFieldOp(op, id, x, ctx, now);   // v35: rday — маршрут на день   // v31: поля маршрута, режима цен и места — каждое отдельной операцией; v32: geodel — удалить место (администратор)
  if (op == 'del') { if (!id) return no('invalid', 'id'); delShop(id); return yes() }
  const n = str(x.n, 120), c = str(x.c, 60), a = str(x.a, 300); if (!n) return no('invalid', 'name'); if (c === null || a === null) return no('invalid', 'address');
  const ty = str(x.ty, 30); if (ty === null || (ty && TYPES.indexOf(ty) < 0)) return no('invalid', 'ty');
  if (op == 'edit') { const old = str(x.old, 120); if (old === null) return no('invalid', 'old'); editShop(old, n, c, a, id, x.ty === undefined ? undefined : ty); return yes() }
  if (op == 'status') { const w = who(ctx, x.by); if (w.reason) return no(w.reason);
    const st = str(x.st, 20), nt = str(x.nt, 500), rid = str(x.rid, 64);
    if (st === null || (st && STATUSES.indexOf(st) < 0)) return no('invalid', 'st'); if (nt === null) return no('invalid', 'nt');
    if (st == 'no' && !nt) return no('invalid', 'nt'); if (rid === null || (rid && !ID_RE.test(rid))) return no('invalid', 'rid');
    let at = now; if (x.at != null && x.at !== '' && +x.at !== 0) { if (!isNum(x.at)) return no('invalid', 'at'); at = +x.at; if (at > now + FUT) return no('future'); if (at < now - 10 * 365 * 864e5) return no('too_old') }
    setStatus({ n, c, a, id, st, nt, by: w.name, at, rid }); return yes() }
  if (op == 'info') { const ct = str(x.ct, 100), tl = str(x.tl, 40), rg = str(x.rg, 100); if (ct === null || tl === null || rg === null) return no('invalid', 'info');
    const ul = x.ul === undefined ? undefined : str(x.ul, 120); if (ul === null) return no('invalid', 'ul');   // v33: юрлицо; старый клиент его не присылает — колонка не трогается
    setInfo({ n, c, a, id, ct, tl, rg, ul }); return yes() }
  if (op == 'note') { const nb = str(x.nb, 2000, true); if (nb === null) return no('invalid', 'nb'); if (!id) return no('invalid', 'id');   // v35: заметки о точке (колонка AB) — только у существующего магазина по ID
    const sp = readShops().find(y => y.id == id); if (!sp) return no('not_found'); wr(shopSheet(), sp.r, 28, [[nb]]); return yes({ nb }) }
  if (op == 'meta') { const fq = str(x.fq, 500); if (fq === null) return no('invalid', 'fq');
    let pl = 0; if (x.pl != null && x.pl !== '' && +x.pl !== 0) { if (!rng(x.pl, 946684800000, now + 5 * 365 * 864e5)) return no('invalid', 'pl'); pl = +x.pl }   // от 2000 года до +5 лет: старый невыполненный план — не ошибка
    setMeta({ n, c, a, id, ty, pl, fq }); return yes() }
  if (op) return no('invalid', 'op');
  upShop(n, c, a, id, ty); return yes();
}
/* v31. Дни маршрута, ответственный, режим цен, место точки. Только по ID существующего магазина (новых не создаёт).
   Права: дни у точки с ответственным меняют он и администратор; свободную точку берёт любой, свою отдаёт сам, чужую передаёт только администратор */
function shopFieldOp(op, id, x, ctx, now) {
  if (ctx.legacy || !ctx.user) return no('trader_mismatch');
  if (!id) return no('invalid', 'id');
  const list = readShops(), sp = list.find(y => y.id == id); if (!sp) return no('not_found');
  const s = shopSheet(), adm = ctx.role == 'admin', mine = !sp.ow || same(sp.ow, ctx.user);
  if (op == 'days') {
    const d = x.days; if (!Array.isArray(d) || d.length > 7 || d.some(i => !(Number.isInteger(i) && i >= 0 && i <= 6))) return no('invalid', 'days');
    if (!mine && !adm) return no('not_owner');
    const u = [...new Set(d)].sort(); wr(s, sp.r, 19, [[daysTxt(u)]]); return yes({ days: u });
  }
  if (op == 'owner') {
    const act = T(x.act), rid = str(x.rid, 64); if (rid === null || (rid && !ID_RE.test(rid))) return no('invalid', 'rid');
    let to;
    if (act == 'take') { if (sp.ow && !same(sp.ow, ctx.user)) return no('taken', sp.ow); to = ctx.user }
    else if (act == 'release') { if (!sp.ow) return yes({ ow: '' }); if (!same(sp.ow, ctx.user) && !adm) return no('not_owner'); to = '' }
    else if (act == 'set') { if (!adm) return no('forbidden'); const nm = str(x.name, 40); if (nm === null) return no('invalid', 'name');
      if (nm) { const t = findTrader(nm); if (!t) return no('unknown_trader'); to = t.n } else to = '' }
    else return no('invalid', 'act');
    if (same(sp.ow, to) && T(sp.ow) == to) return yes({ ow: to });
    wr(s, sp.r, 20, [[to]]);
    jlog({ id: rid || 'own:' + now.toString(36) + rndHex(3), shop: sp.n, sid: sp.id, who: ctx.user, kind: 'shop_owner', val: to, nt: sp.ow ? 'было: ' + sp.ow : '', ts: now });   // кто и когда взял / отдал точку
    return yes({ ow: to });
  }
  if (op == 'rday') {                   // v35: точка в маршруте торгового на дату (+) или убрана из него (−). Свой маршрут — сам, любой — администратор. Повтор той же операции (rid) ничего не дублирует
    const d = T(x.d), rid = str(x.rid, 64); if (!validDate(d)) return no('invalid', 'd'); if (!rid || !ID_RE.test(rid)) return no('invalid', 'rid');
    if (x.on !== true && x.on !== false) return no('invalid', 'on');
    const tr = str(x.tr, 40); if (!tr) return no('invalid', 'tr'); const t = findTrader(tr); if (!t) return no('unknown_trader');
    if (!same(t.n, ctx.user) && !adm) return no('forbidden');
    const rs = rdSheet(), n = rs.getLastRow(); if (n > 1 && rs.getRange(2, 8, n - 1, 1).getValues().some(r => T(r[0]) == rid)) return yes({ dup: true });
    ap(rs, [d, t.n, sp.id, sp.n, x.on ? '+' : '−', ctx.user, now, rid]); return yes() }
  if (op == 'vat') { const m = T(x.m); if (m != 'vat' && m != 'net' && m !== '') return no('invalid', 'm'); wr(s, sp.r, 21, [[VM_TXT[m]]]); return yes({ vm: m }) }
  if (op == 'geo') {
    if (!rng(x.la, -90, 90) || !rng(x.ln, -180, 180) || (+x.la === 0 && +x.ln === 0)) return no('invalid', 'geo');   // 0,0 — признак «место не определилось», а не точка
    if (!rng(x.ac, 0, 100000)) return no('invalid', 'ac');
    wr(s, sp.r, 22, [[Math.round(+x.la * 1e6) / 1e6, Math.round(+x.ln * 1e6) / 1e6, Math.round(+x.ac), ctx.user, new Date(now)]]);
    return yes({ la: Math.round(+x.la * 1e6) / 1e6, ln: Math.round(+x.ln * 1e6) / 1e6, ac: Math.round(+x.ac), gb: ctx.user, ga: now });
  }
  if (op == 'geodel') {                  // v32: удалить записанное место — только администратор. Повтор безопасен: места уже нет — ничего не пишем
    if (!adm) return no('forbidden');
    if (sp.la === null && sp.ln === null) return yes({ la: null, ln: null });
    wr(s, sp.r, 22, [['', '', '', '', '']]);
    jlog({ id: 'geo:' + now.toString(36) + rndHex(3), shop: sp.n, sid: sp.id, who: ctx.user, kind: 'shop_geo_del', val: '', nt: 'было: ' + sp.la + ', ' + sp.ln + ' (±' + (+sp.ac || 0) + ' м)' + (sp.gb ? ', записал ' + sp.gb : ''), ts: now });   // в ленту магазина не попадает, но видно, кто и когда удалил
    return yes({ la: null, ln: null });
  }
  return no('invalid', 'op');
}
function delShop(id) {                   // удаляет магазин только по ID; с неизвестным ID не делает ничего (повтор безопасен)
  id = T(id); if (!id) return;
  const s = shopSheet(), list = readShops();
  list.filter(x => x.id == id).map(x => x.r).sort((a, b) => b - a).forEach(r => s.deleteRow(r));
}
function editShop(old, n, c, a, id, ty) {    // меняет название, город и адрес (ID, статус и контакты сохраняются)
  const s = shopSheet(), x = findShop(readShops(), id, old);
  if (x) { wr(s, x.r, 1, [[n, c || '', a || '']]); if (ty !== undefined) s.getRange(x.r, 16).setValue(String(ty || '')) } else upShop(n, c, a, id, ty);
}
function setStatus(x) {                  // статус магазина + запись в журнал; повтор той же отметки (rid) игнорируется
  if (x.rid && hasLog(x.rid)) return;
  const r = upShop(x.n, x.c, x.a, x.id); if (!r) return;
  const s = shopSheet(), at = +x.at || Date.now(), sid = shopIdAt(r);
  if (at >= (+s.getRange(r, 8).getValue() || 0)) wr(s, r, 5, [[x.st || '', x.nt || '', x.by || '', at]]);   // старая отметка из офлайн-очереди не затирает более новую
  jlog({ id: x.rid || newId(), shop: x.n, sid, who: x.by, kind: 'status', val: x.st || '', nt: x.nt || '', ts: at });
}
function setInfo(x) {                    // контакт, телефон, район; v33 — юрлицо
  const r = upShop(x.n, x.c, x.a, x.id); if (r) { wr(shopSheet(), r, 9, [[x.ct || '', x.tl || '', x.rg || '']]); if (x.ul !== undefined) wr(shopSheet(), r, 27, [[x.ul || '']]) }   // v33: AA — юрлицо
}
function setMeta(x) {                    // тип точки, запланированный визит (мс, 0 — нет), открытый вопрос
  const r = upShop(x.n, x.c, x.a, x.id, x.ty); if (r) wr(shopSheet(), r, 16, [[String(x.ty || ''), +x.pl || '', String(x.fq || '')]]);
}

/* ---------- Визиты ---------- */
function addVisit(v, ctx) {              // визит: событие в журнале + пересчёт «посл. визита» магазина. Повтор того же ID ничего не дублирует, но долечивает сводку
  if (!v || typeof v != 'object') return no('invalid', 'visit');
  const w = who(ctx, v.trader); if (w.reason) return no(w.reason);
  const now = Date.now(), id = v.id == null || v.id === '' ? newId() : T(v.id); if (!ID_RE.test(id)) return no('invalid', 'id');
  const shop = str(v.shop, 120), c = str(v.c, 60), a = str(v.a, 300), sid = str(v.sid, 64), val = str(v.val, 60), note = str(v.note, 500);
  if (!shop || c === null || a === null || sid === null || (sid && !ID_RE.test(sid))) return no('invalid', 'shop');
  if (val === null || VISIT_RES.indexOf(val) < 0) return no('invalid', 'val');
  if (note === null || (val == 'Другое' && !note)) return no('invalid', 'note');
  if (v.ts != null && v.ts !== '' && !isNum(v.ts)) return no('invalid', 'ts');
  const ts = +v.ts || now;
  const st0 = loadState(), old = st0.jr.find(j => j.id == id);
  if (old) { if (old.kind != 'visit' || !same(old.who, w.name)) return no('not_owner'); recalcShops([old.link]); return { ok: 1, applied: true, dup: true } }
  if (ts > now + FUT) return no('future');
  if (ts < now - OLDV) return no('too_old');
  const r = upShop(shop, c, a, sid); if (!r) return no('invalid', 'shop');
  const sid2 = shopIdAt(r);
  jlog({ id, shop, sid: sid2, who: w.name, kind: 'visit', val, nt: note, ts });
  const s = shopSheet(), pl = +s.getRange(r, 17).getValue() || 0; if (pl && pl <= ts) s.getRange(r, 17).setValue('')   // визит выполняет запланированный визит
  recalcShops([sid2]);
  return { ok: 1, applied: true, sid: sid2 };
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
function visitOp(x, ctx) {               // {act: edit|cancel|restore, id (ID события), opId, by, at, ts?, val?, nt?}
  if (!x || typeof x != 'object') return no('invalid', 'op');
  const w = who(ctx, x.by); if (w.reason) return no(w.reason);
  const id = T(x.id), now = Date.now(); if (!ID_RE.test(id)) return no('invalid', 'id');
  if (['edit', 'cancel', 'restore'].indexOf(x.act) < 0) return no('act');
  const opId = str(x.opId, 64); if (opId === null || (opId && !ID_RE.test(opId))) return no('invalid', 'opId');
  let at = now; if (x.at != null && x.at !== '') { if (!isNum(x.at)) return no('invalid', 'at'); at = Math.min(+x.at, now) }
  const st = loadState(), j = st.jr.find(y => y.id == id && y.kind == 'visit');
  if (!j) return no('not_found');
  if (!j.who) return no('no_owner'); if (!same(j.who, w.name)) return no('not_owner');   // менять и отменять можно только свои визиты
  const c = { opId, at, by: w.name };
  if (x.act == 'edit') {
    if (x.ts != null) { if (!isNum(x.ts)) return no('invalid', 'ts'); c.ts = +x.ts }
    if (x.val != null) { const v = str(x.val, 60); if (v === null || (VISIT_RES.indexOf(v) < 0 && v !== T(j.val))) return no('invalid', 'val'); c.val = v }
    if (x.nt != null) { const t = str(x.nt, 500); if (t === null) return no('invalid', 'nt'); c.nt = t }
    if ((c.val != null ? c.val : T(j.val)) == 'Другое' && !(c.nt != null ? c.nt : j.nt)) return no('invalid', 'note');
  }
  const r = visitChange(j, x.act, c);
  if (r.reason) return no(r.reason);
  recalcShops([j.link]);                                                           // и при повторе: если прошлая попытка упала после записи, сводка долечится
  const n = readJournal().find(y => y.id == j.id);
  return { ok: 1, applied: true, dup: !!(r.dup || r.noop), state: n.state, ts: n.ts, val: T(n.val), nt: n.nt };
}
function cancelVisit(v, ctx) {           // СТАРЫЕ очереди: «отмена последней отметки». Мягкая (запись остаётся в журнале) и точная: по ID магазина, а не по названию
  if (!v || typeof v != 'object') return no('invalid', 'visit');
  const w = who(ctx, v.trader); if (w.reason) return no(w.reason);
  const sid = str(v.sid, 64), shop = str(v.shop, 120); if (sid === null || shop === null || (sid && !ID_RE.test(sid))) return no('invalid', 'shop');
  const st = loadState(); let list = st.jr.filter(j => j.kind == 'visit' && !j.state && j.who && same(j.who, w.name));
  if (sid) list = list.filter(j => j.link == sid); else { const c = nameCands(st.shops, shop, ''); if (c.length != 1) return no('ambiguous'); list = list.filter(j => j.link == c[0].id) }
  list.sort((a, b) => a.ts - b.ts || a.r - b.r); const j = list[list.length - 1]; if (!j) return no('not_found');
  visitChange(j, 'cancel', { by: w.name, opId: 'legacy:' + j.id }); recalcShops([j.link]);
  return { ok: 1, applied: true, id: j.id };
}
function myVisit(sid, name, who) {       // время последнего действующего визита этого торгового в магазине (0 — не был)
  if (!who) return 0; const st = { shops: readShops(), jr: readJournal() }; linkAll(st.shops, [], st.jr);
  const c = sid ? [sid] : nameCands(st.shops, name, '').map(x => x.id); let t = 0;
  st.jr.forEach(j => { if (j.kind == 'visit' && !j.state && j.who === who && j.link && c.indexOf(j.link) >= 0) t = Math.max(t, j.ts) });
  return t;
}
/* ---------- v31: «Продвигать», сводки для каталога и итоги ---------- */
const promoSheet = () => ensureHead(sh('Продвигать'), PROMO_HEAD);
function readPromo() { const s = SpreadsheetApp.getActive().getSheetByName('Продвигать'); if (!s) return []; const n = s.getLastRow(); if (n < 2) return []; return s.getRange(2, 1, n - 1, 1).getValues().map((r, i) => ({ r: i + 2, k: T(r[0]) })).filter(x => x.k) }   // чтение листа не создаёт: его создаёт первая отметка администратора (под блокировкой)
const cache = () => { try { return CacheService.getScriptCache() } catch (_) { return null } };
function cGet(k) { const c = cache(); if (!c) return null; try { const v = c.get(k); return v ? JSON.parse(v) : null } catch (_) { return null } }
function cPut(k, v) { const c = cache(); if (!c) return; try { const t = JSON.stringify(v); if (t.length < 90000) c.put(k, t, CACHE_S) } catch (_) {} }
const aggVer = () => { const c = cache(); return (c && c.get('aggv')) || '0' };
function aggDrop() { const c = cache(); if (c) try { c.put('aggv', Date.now().toString(36) + rndHex(2), 21600) } catch (_) {} }   // новая «версия» — все ключи сводок становятся устаревшими
function ordNarrow() {                   // заявки без JSON: торговый, режим, сумма, удаление, ID магазина, дата оформления. Быстро даже на большом листе
  const s = ordSheet(), n = s.getLastRow(); if (n < 2) return []; const k = n - 1, col = (c, w) => s.getRange(2, c, k, w || 1).getValues();
  const A = col(1), C = col(3), Hm = col(8), J = col(10), MP = col(13, 4);
  return A.map((a, i) => ({ r: i + 2, reg: ms(a[0]), tr: T(C[i][0]), m: vmOf(Hm[i][0]), sum: +J[i][0] || 0, del: (+MP[i][1] || 0) || (isD(MP[i][0]) ? MP[i][0].getTime() : 0), sid: T(MP[i][2]), ts: +MP[i][3] || ms(a[0]) }));
}
const normR = t => T(t).replace(/\s+/g, ' ').toLowerCase().replace(/ё/g, 'е');
function agg() {                          // для init: режим последней заявки по точкам, «Ходовые», частые причины «Отказались». Кеш 10 минут
  const key = 'agg:' + aggVer(), c = cGet(key); if (c) return c;
  const now = Date.now(), O = ordNarrow(), lm = {};
  O.forEach(o => { if (o.del || !o.sid || !o.m) return; const l = lm[o.sid]; if (!l || o.ts > l[1]) lm[o.sid] = [o.m, o.ts] });
  const hot = [], from = now - HOT_DAYS * 864e5, rows = O.filter(o => !o.del && o.ts >= from && o.ts <= now + FUT);
  if (rows.length) { const s = ordSheet(), a = Math.min(...rows.map(o => o.r)), b = Math.max(...rows.map(o => o.r)), L = s.getRange(a, 12, b - a + 1, 1).getValues(), want = new Set(rows.map(o => o.r)), cnt = {};
    L.forEach((r, i) => { if (!want.has(a + i)) return; let o; try { o = JSON.parse(r[0]) } catch (_) { return } const seen = new Set();
      (Array.isArray(o && o.items) ? o.items : []).forEach(it => { const k = T(it.n) + '|' + T(it.g) + '|' + T(it.u); if (!T(it.n) || seen.has(k)) return; seen.add(k); cnt[k] = (cnt[k] || 0) + 1 }) });
    Object.keys(cnt).filter(k => cnt[k] >= HOT_MIN).sort((p, q) => cnt[q] - cnt[p] || (p < q ? -1 : 1)).slice(0, HOT_TOP).forEach(k => hot.push({ k, c: cnt[k] })) }
  const reasons = [], js = jSheet(), jn = js.getLastRow();
  if (jn > 1) { const R = js.getRange(2, 6, jn - 1, 3).getValues(), m = {};   // Тип, Значение, Заметка
    R.forEach(r => { if (T(r[0]) != 'status' || T(r[1]) != 'ref') return; const t = normR(r[2]); if (!t || t.length > 120) return; const e = m[t] || (m[t] = { n: 0, f: {} }); e.n++; const v = T(r[2]).replace(/\s+/g, ' '); e.f[v] = (e.f[v] || 0) + 1 });
    Object.keys(m).filter(t => m[t].n >= REASON_MIN).sort((p, q) => m[q].n - m[p].n || (p < q ? -1 : 1)).slice(0, REASON_TOP)
      .forEach(t => { const f = m[t].f; reasons.push(Object.keys(f).sort((p, q) => f[q] - f[p])[0]) }) }   // показываем самое частое написание
  const r = { lm, hot, reasons }; cPut(key, r); return r;
}
function perOp(d, ctx) {                 // v35: итоги за любой период: cur и prev — [от, до) в мс (границы считает приложение в местном времени), bk — до 32 отрезков (месяцы года). who: торговый — всегда свои; администратор — 'me', '*' (все, с разбивкой) или имя
  const now = Date.now(), ok = p => Array.isArray(p) && p.length == 2 && rng(p[0], 946684800000, now + 400 * 864e5) && rng(p[1], 946684800000, now + 400 * 864e5) && +p[1] > +p[0] && +p[1] - +p[0] <= 367 * 864e5;
  const bk = d.bk == null ? [] : d.bk; if (!ok(d.cur) || !ok(d.prev) || !Array.isArray(bk) || bk.length > 32 || bk.some(p => !ok(p))) return { error: 'range' };
  const adm = ctx.role == 'admin' && !ctx.legacy, w = str(d.who, 40); if (w === null) return { error: 'range' };
  const who = !adm || w == 'me' ? ctx.user : w == '*' || !w ? '' : w;   // '' — все торговые
  const key = 'per:' + aggVer() + ':' + (who || '*') + ':' + [d.cur, d.prev].concat(bk).map(p => (+p[0]) + '-' + (+p[1])).join(','), c = cGet(key); if (c) return c;
  const z = () => ({ sum: 0, n: 0 }), out = { ok: 1, all: !who, cur: Object.assign(z(), { by: {} }), prev: z(), bk: bk.map(z) }, inP = (o, p) => o.ts >= +p[0] && o.ts < +p[1];
  ordNarrow().forEach(o => { if (o.del || !o.tr || (who && !same(o.tr, who))) return;
    if (inP(o, d.cur)) { out.cur.sum += o.sum; out.cur.n++; if (!who) { const t = out.cur.by[o.tr] || (out.cur.by[o.tr] = z()); t.sum += o.sum; t.n++ } }
    if (inP(o, d.prev)) { out.prev.sum += o.sum; out.prev.n++ }
    bk.forEach((p, i) => { if (inP(o, p)) { out.bk[i].sum += o.sum; out.bk[i].n++ } }) });
  const r = x => { x.sum = Math.round(x.sum) }; r(out.cur); r(out.prev); out.bk.forEach(r); Object.keys(out.cur.by).forEach(n => r(out.cur.by[n])); if (who) delete out.cur.by;
  cPut(key, out); return out;
}
function statsOp(b, ctx) {               // итоги: торговый — свои, администратор — все с разбивкой. b = { w: [от, до], pw: [...], m, pm, y, py } в мс
  const P = ['w', 'pw', 'm', 'pm', 'y', 'py'], now = Date.now();
  if (!b || typeof b != 'object' || P.some(p => !Array.isArray(b[p]) || b[p].length != 2 || !rng(b[p][0], 946684800000, now + 400 * 864e5) || !rng(b[p][1], 946684800000, now + 400 * 864e5) || +b[p][1] <= +b[p][0] || +b[p][1] - +b[p][0] > 367 * 864e5)) return { error: 'range' };
  const adm = ctx.role == 'admin' && !ctx.legacy, key = 'st:' + aggVer() + ':' + (adm ? '*' : ctx.user) + ':' + P.map(p => b[p].join('-')).join(','), c = cGet(key); if (c) return c;
  const out = { ok: 1, all: adm }; P.forEach(p => { out[p] = { sum: 0, n: 0, by: {} } });
  ordNarrow().forEach(o => { if (o.del || !o.tr) return; if (!adm && !same(o.tr, ctx.user)) return;
    P.forEach(p => { if (o.ts >= +b[p][0] && o.ts < +b[p][1]) { const z = out[p]; z.sum += o.sum; z.n++; if (adm) { const t = z.by[o.tr] || (z.by[o.tr] = { sum: 0, n: 0 }); t.sum += o.sum; t.n++ } } }) });
  P.forEach(p => { out[p].sum = Math.round(out[p].sum); if (!adm) delete out[p].by });
  cPut(key, out); return out;
}
function prevItems(sid) {                // «Брал раньше»: товары из последних PREV_N заявок точки (не старше PREV_DAYS дней): сколько брали в последний раз и когда
  const now = Date.now(), from = now - PREV_DAYS * 864e5, L = ordNarrow().filter(o => !o.del && o.sid == sid && o.ts >= from).sort((p, q) => q.ts - p.ts).slice(0, PREV_N);
  const s = ordSheet(), m = {};
  L.forEach(o => { let j; try { j = JSON.parse(s.getRange(o.r, 12).getValue()) } catch (_) { return }
    (Array.isArray(j && j.items) ? j.items : []).forEach(it => { const k = T(it.n) + '|' + T(it.g) + '|' + T(it.u); if (!T(it.n)) return;
      const e = m[k]; if (!e) m[k] = { k, q: +it.q || 0, ts: o.ts, c: 1 }; else if (e.ts != o.ts) e.c++ }) });   // заявки идут от новой к старой: первое вхождение — последнее количество
  return Object.keys(m).map(k => m[k]).sort((p, q) => q.ts - p.ts || q.c - p.c);
}
function timeline(sid, name, me, limit) { // общая лента магазина: визиты (в т.ч. отменённые), статусы, события заявок. Для заявок — актуальное состояние в «cur»
  const st = loadState(); let x = sid && st.shops.find(y => y.id == sid); if (!x && name) { const c = nameCands(st.shops, name, ''); if (c.length == 1) x = c[0] }
  const id = x ? x.id : sid;
  const byOid = {}; st.orders.forEach(o => { byOid[o.id] = o });
  const cur = oid => { const o = byOid[oid]; return o ? { sum: o.sum, d: dstr(o.d), del: o.del, sid: o.link, tr: o.tr } : null };
  const ev = [], hasC = new Set(st.jr.filter(j => j.kind == 'order_create').map(j => j.oid));
  st.jr.forEach(j => {
    if (!/^(order_|visit$|status$)/.test(j.kind)) return;                           // служебные записи (действия с доступом) в ленту магазина не попадают
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
    diffs.forEach(d => { const x = d[0], f = d[1]; wr(shopSheet(), x.r, 12, [[f.lo || '', f.lv || '', f.lb, f.lw]]) }) }
  const cnt = {}; items.forEach(i => { cnt[i[0]] = (cnt[i[0]] || 0) + 1 });
  const changes = fixes.ord.length + fixes.jr.length + fixes.ts.length + diffs.length + noId.length;
  return { apply: !!apply, counts: cnt, changes, items };
}
function writeReport_(rep) {             // отчёт в лист «Сверка» (единственное, что пишет пробный прогон; запускайте его на КОПИИ таблицы)
  const s = SpreadsheetApp.getActive().getSheetByName('Сверка') || SpreadsheetApp.getActive().insertSheet('Сверка');
  const old = s.getLastRow(); if (old) s.getRange(1, 1, old, 6).clearContent();
  const rows = [['Режим', rep.apply ? 'ПРИМЕНЕНО' : 'ПРОБНЫЙ ПРОГОН (ничего не изменено)', new Date(), '', '', ''], ['Итоги', JSON.stringify(rep.counts), '', '', '', ''], ['Тип', 'Лист', 'Строка', 'ID записи', 'Описание', 'Действие']].concat(rep.items);
  wr(s, 1, 1, rows);
}
function reconcileDryRun() { return withLock(() => { const rep = reconcile_(false); writeReport_(rep); return rep }) }   // ничего не меняет в данных; пишет отчёт
function reconcileApply(confirmed) {     // применяет ТОЛЬКО однозначные исправления (привязки, даты оформления, пересчёт сводок). Повторный запуск безопасен
  if (confirmed !== true) { try { const ui = SpreadsheetApp.getUi(); if (ui.alert('Применить исправления сверки?', 'Сначала посмотрите отчёт пробного прогона. Неоднозначные записи останутся как есть.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return null } catch (_) { return null } }
  return withLock(() => { const rep = reconcile_(true); writeReport_(rep); return rep });
}

/* ---------- Меню таблицы «Али-Баба». Запускает только тот, у кого есть право редактировать таблицу; через веб-адрес скрипта эти функции недоступны ---------- */
function onOpen() { try { SpreadsheetApp.getUi().createMenu('Али-Баба')
  .addItem('Доступ: назначить администратора и выдать приглашение', 'menuAdmin')
  .addItem('Доступ: выдать приглашение профилю (сброс пароля)', 'menuInvite')
  .addItem('Доступ: включить обязательную авторизацию', 'menuAuthOn')
  .addItem('Доступ: выключить обязательную авторизацию', 'menuAuthOff')
  .addItem('Доступ: ключ для устройств со старой версией (на время перехода)', 'menuLegacyKey')
  .addItem('Доступ: замер скорости хеширования', 'menuBench')
  .addItem('Доступ: число итераций хеширования', 'menuIter')
  .addSeparator()
  .addItem('Сверка: пробный прогон (ничего не меняет)', 'menuRecDry').addItem('Сверка: применить исправления', 'menuRecApply').addToUi() } catch (_) {} }
// Сверка из меню: раньше она отрабатывала молча (только лист «Сверка»), и было непонятно, выполнилась ли она
const REC_N = { link_fix: 'привязок к магазину', ts_fix: 'дат оформления', sum_diff: 'сводок магазинов', no_id: 'магазинов без ID', ambiguous: 'неоднозначных (не меняю)', unmatched: 'без магазина в справочнике (не меняю)', orphan: 'с неизвестным ID магазина (не меняю)', conflict: 'с расхождением ID (не меняю)' };
function recMsg_(rep) { const k = Object.keys(rep.counts); return 'Изменений: ' + rep.changes + (k.length ? '\n\n' + k.map(x => (REC_N[x] || x) + ': ' + rep.counts[x]).join('\n') : '') + '\n\nПодробности — на листе «Сверка».' }
function menuRec_(apply) { const ui = SpreadsheetApp.getUi();
  try { const rep = apply ? reconcileApply() : reconcileDryRun(); if (rep) ui.alert(apply ? 'Исправления применены' : 'Пробный прогон выполнен (ничего не изменено)', recMsg_(rep), ui.ButtonSet.OK) }
  catch (e) { ui.alert('Сверка не выполнена', String(e && e.message || e), ui.ButtonSet.OK) } }
function menuRecDry() { menuRec_(false) }
function menuRecApply() { menuRec_(true) }
const OWNER = 'владелец таблицы';
function fmtT_(t) { return Utilities.formatDate(new Date(t), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'dd.MM.yyyy HH:mm') }
function showInvite_(ui, r, head) { ui.alert(head, 'Профиль: ' + r.profile + '\n\nОдноразовое приглашение:\n' + r.code + '\n\nДействует до ' + fmtT_(r.until) + '.\nВ приложении: «У меня есть приглашение» → имя профиля, код и новый пароль.\nКод показан один раз и нигде не сохранён: в таблице лежит только его хеш.', ui.ButtonSet.OK) }
function adminSetup_(name) {             // первый администратор: назначается только отсюда — из таблицы, её владельцем
  return withLock(() => { const all = readTraders().filter(x => same(x.n, name)); if (all.length > 1) return { err: 'dup' };
    if (!all.length) ap(trSheet(), [name, 'admin', 0, '', '', '', '', '']); else wr(trSheet(), all[0].r, 2, [['admin', all[0].ver + 1]]);
    audit(OWNER, 'admin_role', name, 'admin'); return mkInvite(name, OWNER) });
}
function menuAdmin() {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt('Назначить администратора', 'Имя профиля с листа «Торговые» (если такого нет — будет добавлен):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return; const name = vName(r.getResponseText()); if (!name) return ui.alert('Недопустимое имя профиля.');
  const res = adminSetup_(name); if (!res || res.err) return ui.alert('На листе «Торговые» несколько строк с именем «' + name + '». Оставьте одну и повторите.');
  showInvite_(ui, res, 'Администратор назначен');
}
function menuInvite() {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt('Приглашение', 'Имя профиля с листа «Торговые». Прежний пароль этого профиля перестанет действовать:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return; const res = mkInvite(T(r.getResponseText()), OWNER);
  if (!res) return ui.alert('Профиль не найден (или на листе несколько строк с этим именем).');
  showInvite_(ui, res, 'Приглашение создано');
}
const authReady_ = () => readTraders().some(x => x.role == 'admin' && active(x) && x.last > 0);   // есть администратор с паролем, который уже входил по паролю
function menuAuthOn() {
  const ui = SpreadsheetApp.getUi();
  if (!authReady_()) return ui.alert('Пока нельзя', 'Сначала: 1) назначьте администратора; 2) задайте ему пароль по приглашению; 3) выйдите и войдите в приложении по паролю.\nТолько после успешного входа администратора обязательную авторизацию можно включить.', ui.ButtonSet.OK);
  if (ui.alert('Включить обязательную авторизацию?', 'Ключ для устройств со старой версией перестанет приниматься. Работать можно будет только после входа по паролю.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  props().setProperty('AUTH_REQUIRED', '1'); audit(OWNER, 'admin_auth_on', '', ''); ui.alert('Обязательная авторизация включена.');
}
function menuAuthOff() { const ui = SpreadsheetApp.getUi(); if (ui.alert('Выключить обязательную авторизацию?', 'Если задан ключ для старых устройств, он снова начнёт приниматься.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  props().deleteProperty('AUTH_REQUIRED'); audit(OWNER, 'admin_auth_off', '', ''); ui.alert('Обязательная авторизация выключена.') }
function menuLegacyKey() {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt('Ключ для старых устройств', 'Нужен только на время перехода, чтобы устройства с версией 26 дослали накопленное. Пусто — удалить ключ. При включённой обязательной авторизации ключ не действует.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return; const k = T(r.getResponseText());
  if (k) props().setProperty('LEGACY_KEY', k); else props().deleteProperty('LEGACY_KEY'); ui.alert(k ? 'Ключ сохранён в свойствах скрипта.' : 'Ключ удалён.');
}
function menuBench() {
  const ui = SpreadsheetApp.getUi(), t0 = Date.now(); pbkdf2('замер', [1, 2, 3, 4, 5, 6, 7, 8], 1000); const per = Math.max(1, Date.now() - t0);
  ui.alert('Замер хеширования', '1000 итераций: ' + per + ' мс.\nСейчас задано: ' + iterCfg() + ' (вход займёт около ' + Math.round(per * iterCfg() / 1000) + ' мс).\nЧтобы вход занимал около 1 с, поставьте примерно ' + Math.round(1e6 / per / 500) * 500 + ' (меню «число итераций»).', ui.ButtonSet.OK);
}
function menuIter() {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt('Число итераций', 'От ' + ITER_MIN + ' до ' + ITER_MAX + '. Сейчас: ' + iterCfg() + '. Действующие пароли продолжат работать; их хеши обновятся при следующем входе.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return; const n = Math.round(+r.getResponseText());
  if (!(n >= ITER_MIN && n <= ITER_MAX)) return ui.alert('Недопустимое значение.'); props().setProperty('PBKDF2_ITER', String(n)); ui.alert('Сохранено: ' + n);
}

/* ---------- Получатели заявок (лист «Получатели»: имя, телефон, города, по умолчанию) ---------- */
function recipients() {
  return sh('Получатели').getDataRange().getValues().slice(1).map(r => {
    let p = String(r[1]).replace(/\D/g, ''); if (p.length == 11 && p[0] == '8') p = '7' + p.slice(1);   // 8 7xx… → 7 7xx…
    return { n: String(r[0]).trim(), p, c: String(r[2] || '').split(/[,;]/).map(x => x.trim()).filter(Boolean), d: /^(да|yes|y|1|\+|x|true)$/i.test(String(r[3]).trim()) } }).filter(x => x.n && x.p);
}

function sh(n) {                         // лист создаётся автоматически с заголовками
  const ss = SpreadsheetApp.getActive(); let s = ss.getSheetByName(n);
  if (!s) { s = ss.insertSheet(n); s.appendRow({ 'Торговые': TR_HEAD, 'Магазины': SHOP_HEAD, 'Заявки': ORD_HEAD, 'Визиты': JR_HEAD,
    'Получатели': ['Имя', 'Телефон', 'Города (через запятую; пусто = все)', 'По умолчанию (да)'], 'Продвигать': PROMO_HEAD, 'Маршрут дня': RD_HEAD }[n]) }
  return s;
}
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
