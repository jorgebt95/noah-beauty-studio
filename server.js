const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const crypto = require('crypto');

const { db, settings, DATA_DIR } = require('./src/db');
const auth = require('./src/auth');
const loyalty = require('./src/loyalty');
const slots = require('./src/slots');
const calendar = require('./src/calendar');
const T = require('./src/time');

const ENV = process.env.NOAH_ENV || 'dev';       // dev | pre | prod
const PORT = Number(process.env.PORT) || 3000;
auth.ensureAdminPin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  if (ENV !== 'prod') res.set('X-Robots-Tag', 'noindex');
  next();
});

// ---------- utilidades ----------
const fail = (res, code, msg) => res.status(code).json({ error: msg });
const cleanPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : null; };
const cleanName = n => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 60);
const maskPhone = p => p ? `${p.slice(0, 3)} *** ** ${p.slice(-2)}` : '';
const money = n => '$' + Number(n).toLocaleString('es-MX');
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isTime = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { console.error(e); fail(res, 500, 'Algo salió mal. Intenta de nuevo en un momento.'); });

const qService = db.prepare('SELECT * FROM services WHERE id = ?');
const qClientByPhone = db.prepare('SELECT * FROM clients WHERE phone = ?');
const qClient = db.prepare('SELECT * FROM clients WHERE id = ?');
const insClient = db.prepare('INSERT INTO clients (phone, name, pin_hash) VALUES (?, ?, ?)');
const insBooking = db.prepare(`INSERT INTO bookings (client_id, service_id, kind, date, start_min, end_min, price, special, notes)
  VALUES (@client_id, @service_id, @kind, @date, @start_min, @end_min, @price, @special, @notes)`);
const qLastInCat = db.prepare(`SELECT b.date FROM bookings b JOIN services s ON s.id = b.service_id
  WHERE b.client_id = ? AND s.cat = ? AND b.status IN ('confirmed','done') AND b.date <= ? ORDER BY b.date DESC LIMIT 1`);

function publicService(s) {
  return {
    id: s.id, cat: s.cat, name: s.name, price: s.price, duration_min: s.duration_min,
    description: s.description, is_touch: !!s.is_touch,
    touch_allowed: !!s.touch_allowed, touch_price: s.touch_price, touch_days: s.touch_days
  };
}

function bookingView(b) {
  const s = qService.get(b.service_id);
  return {
    id: b.id, date: b.date, date_label: T.prettyDate(b.date), start: T.toHHMM(b.start_min), end: T.toHHMM(b.end_min),
    service: s ? s.name : '', service_cat: s ? s.cat : '', kind: b.kind, price: b.price, price_label: money(b.price),
    status: b.status, special: !!b.special, notes: b.notes
  };
}

async function pushToCalendar(bookingId) {
  if (!calendar.enabled()) return;
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  const c = qClient.get(b.client_id), s = qService.get(b.service_id);
  try {
    const url = await calendar.createEvent({
      date: b.date, start: T.toHHMM(b.start_min), end: T.toHHMM(b.end_min),
      title: `${c.name} · ${s.name}${b.kind === 'touch' ? ' (retoque)' : ''}`,
      description: `Cel: ${c.phone}\nPrecio: ${money(b.price)}${b.special ? '\nHorario especial' : ''}${b.notes ? '\nNotas: ' + b.notes : ''}\nAgendada desde la página.`
    });
    db.prepare('UPDATE bookings SET cal_uid = ? WHERE id = ?').run(url, b.id);
  } catch (e) { console.error('[calendario] no se pudo crear el evento:', e.message); }
}

// ---------- público ----------
app.get('/api/health', (req, res) => res.json({ ok: true, env: ENV }));

app.get('/api/info', (req, res) => {
  const s = settings.all();
  res.json({
    env: ENV, whatsapp: s.whatsapp, address: s.address, maps_url: s.maps_url, instagram: s.instagram, tiktok: s.tiktok,
    city: s.city, open_time: s.open_time, last_start: s.last_start, open_days: s.open_days,
    discount_pct: Number(s.discount_pct), cherry_months: Number(s.cherry_months), cancel_hours: s.cancel_hours,
    owner_name: s.owner_name, owner_email: s.owner_email
  });
});

app.get('/api/services', (req, res) => {
  res.json(db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort, id').all().map(publicService));
});

app.get('/api/days', (req, res) => res.json(slots.bookableDays().map(d => ({ date: d, dow: T.DOW[T.weekday(d)], num: Number(d.slice(8)), label: T.prettyDate(d) }))));

app.get('/api/slots', wrap(async (req, res) => {
  const s = qService.get(Number(req.query.service));
  if (!s || !s.active) return fail(res, 400, 'Elige un servicio.');
  if (!isDate(req.query.date)) return fail(res, 400, 'Elige un día.');
  res.json(await slots.slotsFor(req.query.date, s.duration_min));
}));

app.post('/api/bookings', wrap(async (req, res) => {
  const { service_id, kind = 'full', date, time, name, phone, pin, notes } = req.body || {};
  const s = qService.get(Number(service_id));
  if (!s || !s.active) return fail(res, 400, 'Ese servicio ya no está disponible.');
  if (kind !== 'full' && kind !== 'touch') return fail(res, 400, 'Tipo de servicio no válido.');
  if (kind === 'touch' && !s.touch_allowed) return fail(res, 400, 'Este servicio no tiene precio de retoque.');
  if (!isDate(date) || !isTime(time)) return fail(res, 400, 'Elige día y hora.');
  if (!slots.bookableDays().includes(date)) return fail(res, 400, 'Ese día no hay citas. Elige otro.');
  const sess = auth.readSession(req, 'client');
  let client = sess ? qClient.get(sess.client_id) : null;
  let loggedIn = !!client;
  const cel = client ? client.phone : cleanPhone(phone), nom = cleanName(name) || (client && client.name);
  if (!nom || nom.length < 2) return fail(res, 400, 'Escribe tu nombre.');
  if (!cel) return fail(res, 400, 'Escribe tu celular a 10 dígitos.');

  if (!client) client = qClientByPhone.get(cel);
  if (loggedIn) {
    // ya entró con su PIN
  } else if (!client) {
    if (!auth.validPin(pin)) return fail(res, 400, 'Crea un PIN de 4 números para tu tarjeta.');
    const r = insClient.run(cel, nom, auth.hashPin(pin));
    client = qClient.get(r.lastInsertRowid);
    loggedIn = true;
  } else if (pin) {
    if (!client.pin_hash && auth.validPin(pin)) {
      db.prepare('UPDATE clients SET pin_hash = ? WHERE id = ?').run(auth.hashPin(pin), client.id);
      loggedIn = true;
    } else if (auth.checkPin(pin, client.pin_hash)) loggedIn = true;
  }

  if (kind === 'touch') {
    const last = qLastInCat.get(client.id, s.cat, date);
    if (!last || T.daysBetween(last.date, date) > s.touch_days) {
      return fail(res, 400, `El precio de retoque aplica si tu último servicio fue hace ${s.touch_days} días o menos. Puedes agendarlo como servicio completo.`);
    }
  }

  const start = T.toMin(time);
  if (!(await slots.isFree(date, start, s.duration_min))) return fail(res, 409, 'Esa hora se acaba de ocupar. Elige otra, porfa.');

  const price = kind === 'touch' ? s.touch_price : s.price;
  const r = insBooking.run({
    client_id: client.id, service_id: s.id, kind, date, start_min: start, end_min: start + s.duration_min,
    price, special: 0, notes: String(notes || '').slice(0, 300)
  });
  if (loggedIn) auth.createSession(res, 'client', client.id, 180);
  pushToCalendar(r.lastInsertRowid);
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(r.lastInsertRowid);
  res.json({ ok: true, booking: bookingView(b), client: { name: client.name }, logged_in: loggedIn });
}));

app.post('/api/requests', wrap(async (req, res) => {
  const { service_id, date, time, name, phone, reason } = req.body || {};
  const s = qService.get(Number(service_id));
  if (!s || !s.active) return fail(res, 400, 'Elige un servicio.');
  if (!isDate(date) || date < T.todayStr()) return fail(res, 400, 'Elige un día que no haya pasado.');
  if (!isTime(time)) return fail(res, 400, 'Escribe la hora que necesitas, por ejemplo 20:00.');
  const cel = cleanPhone(phone), nom = cleanName(name);
  if (!nom) return fail(res, 400, 'Escribe tu nombre.');
  if (!cel) return fail(res, 400, 'Escribe tu celular a 10 dígitos.');
  const client = qClientByPhone.get(cel);
  db.prepare('INSERT INTO requests (client_id, name, phone, service_id, date, time, reason) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(client ? client.id : null, nom, cel, s.id, date, time, String(reason || '').slice(0, 200));
  res.json({ ok: true, date_label: T.prettyDate(date), time });
}));

app.post('/api/login', (req, res) => {
  const cel = cleanPhone(req.body && req.body.phone);
  const pin = req.body && req.body.pin;
  const key = 'c:' + (cel || req.ip);
  if (auth.tooManyAttempts(key) || auth.tooManyAttempts('ip:' + req.ip)) return fail(res, 429, 'Demasiados intentos. Espera 15 minutos o pídele a Sophia que te cambie el PIN.');
  const client = cel && qClientByPhone.get(cel);
  if (!client || !client.pin_hash || !auth.checkPin(pin, client.pin_hash)) {
    auth.noteFailure(key); auth.noteFailure('ip:' + req.ip);
    return fail(res, 401, 'Ese celular y PIN no coinciden. Si es tu primera vez, tu PIN se crea al agendar tu primera cita.');
  }
  auth.createSession(res, 'client', client.id, req.body.remember === false ? 1 : 180);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => { auth.endSession(req, res, 'client'); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
  const sess = auth.readSession(req, 'client');
  if (!sess) return fail(res, 401, 'Entra con tu celular y PIN.');
  const c = qClient.get(sess.client_id);
  if (!c) return fail(res, 401, 'Entra con tu celular y PIN.');
  const upcoming = db.prepare("SELECT * FROM bookings WHERE client_id = ? AND status = 'confirmed' AND date >= ? ORDER BY date, start_min LIMIT 5")
    .all(c.id, T.todayStr()).map(bookingView);
  res.json({ name: c.name, phone: maskPhone(c.phone), card: loyalty.card(c), upcoming });
});

app.get('/api/photos', (req, res) => res.json(db.prepare('SELECT id, file, cat, tag FROM photos ORDER BY id DESC LIMIT 60').all()));

// ---------- panel de Sophia ----------
app.post('/api/admin/login', (req, res) => {
  const key = 'admin:' + req.ip;
  if (auth.tooManyAttempts(key)) return fail(res, 429, 'Demasiados intentos. Espera 15 minutos.');
  if (!auth.checkPin(req.body && req.body.pin, settings.get('admin_pin_hash'))) { auth.noteFailure(key); return fail(res, 401, 'PIN incorrecto.'); }
  auth.createSession(res, 'admin', null, 30);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { auth.endSession(req, res, 'admin'); res.json({ ok: true }); });

const A = express.Router();
A.use(auth.requireAdmin);

A.get('/summary', (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : T.todayStr();
  const rows = db.prepare(`SELECT b.*, c.name AS client_name, c.phone AS client_phone, c.id AS cid FROM bookings b JOIN clients c ON c.id = b.client_id
    WHERE b.date = ? AND b.status != 'cancelled' ORDER BY b.start_min`).all(date);
  const list = rows.map(b => ({ ...bookingView(b), client: { id: b.cid, name: b.client_name, phone: b.client_phone, balance: loyalty.card(qClient.get(b.cid)).balance } }));
  const pending = db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'pending'").get().n;
  res.json({ date, date_label: T.prettyDate(date), today: T.todayStr(), bookings: list, pending_requests: pending, calendar: calendar.enabled() });
});

A.post('/bookings/:id/status', wrap(async (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(req.params.id));
  if (!b) return fail(res, 404, 'No encontré esa cita.');
  const status = req.body && req.body.status;
  if (!['done', 'noshow', 'cancelled', 'confirmed'].includes(status)) return fail(res, 400, 'Estado no válido.');
  const s = qService.get(b.service_id);
  db.transaction(() => {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, b.id);
    db.prepare('DELETE FROM cherries WHERE booking_id = ? AND used = 0').run(b.id);
    if (status === 'done') {
      const half = b.kind === 'touch' || (s && s.is_touch);
      loyalty.addCherry(b.client_id, half ? 0.5 : 1, half ? 'Retoque' : 'Servicio', b.id);
    }
  })();
  if (status === 'cancelled' && b.cal_uid) calendar.deleteEvent(b.cal_uid, b.date).catch(e => console.error('[calendario]', e.message));
  res.json({ ok: true, balance: loyalty.card(qClient.get(b.client_id)).balance });
}));

A.post('/bookings', wrap(async (req, res) => { // cita capturada por Sophia (sin validar horario)
  const { service_id, kind = 'full', date, time, name, phone, notes } = req.body || {};
  const s = qService.get(Number(service_id));
  const cel = cleanPhone(phone), nom = cleanName(name);
  if (!s || !isDate(date) || !isTime(time) || !cel || !nom) return fail(res, 400, 'Faltan datos de la cita.');
  let client = qClientByPhone.get(cel);
  if (!client) client = qClient.get(insClient.run(cel, nom, null).lastInsertRowid);
  const start = T.toMin(time);
  const r = insBooking.run({ client_id: client.id, service_id: s.id, kind, date, start_min: start, end_min: start + s.duration_min,
    price: kind === 'touch' && s.touch_price ? s.touch_price : s.price, special: 0, notes: String(notes || '').slice(0, 300) });
  pushToCalendar(r.lastInsertRowid);
  res.json({ ok: true });
}));

A.get('/requests', (req, res) => {
  const rows = db.prepare(`SELECT r.*, s.name AS service FROM requests r JOIN services s ON s.id = r.service_id
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 40`).all();
  res.json(rows.map(r => ({ ...r, date_label: T.prettyDate(r.date) })));
});

A.post('/requests/:id', wrap(async (req, res) => {
  const r = db.prepare('SELECT * FROM requests WHERE id = ?').get(Number(req.params.id));
  if (!r) return fail(res, 404, 'No encontré esa solicitud.');
  const action = req.body && req.body.action;
  if (!['accept', 'other', 'reject'].includes(action)) return fail(res, 400, 'Acción no válida.');
  if (action === 'accept') {
    const s = qService.get(r.service_id);
    let client = qClientByPhone.get(r.phone);
    if (!client) client = qClient.get(insClient.run(r.phone, r.name, null).lastInsertRowid);
    const start = T.toMin(r.time);
    const b = insBooking.run({ client_id: client.id, service_id: s.id, kind: 'full', date: r.date, start_min: start,
      end_min: start + s.duration_min, price: s.price, special: 1, notes: r.reason ? 'Horario especial: ' + r.reason : 'Horario especial' });
    db.prepare("UPDATE requests SET status = 'accepted', booking_id = ?, client_id = ? WHERE id = ?").run(b.lastInsertRowid, client.id, r.id);
    pushToCalendar(b.lastInsertRowid);
  } else {
    db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(action === 'other' ? 'other' : 'rejected', r.id);
  }
  res.json({ ok: true });
}));

A.get('/clients', (req, res) => {
  const q = String(req.query.q || '').trim();
  const digits = q.replace(/\D/g, '');
  const rows = digits.length >= 3
    ? db.prepare('SELECT * FROM clients WHERE phone LIKE ? ORDER BY name LIMIT 20').all('%' + digits + '%')
    : db.prepare('SELECT * FROM clients WHERE name LIKE ? ORDER BY name LIMIT 20').all('%' + q + '%');
  res.json(rows.map(c => ({ id: c.id, name: c.name, phone: c.phone, balance: loyalty.card(c).balance, has_pin: !!c.pin_hash })));
});

A.get('/clients/:id', (req, res) => {
  const c = qClient.get(Number(req.params.id));
  if (!c) return fail(res, 404, 'No encontré a esa clienta.');
  const history = db.prepare('SELECT * FROM bookings WHERE client_id = ? ORDER BY date DESC, start_min DESC LIMIT 20').all(c.id).map(bookingView);
  res.json({ id: c.id, name: c.name, phone: c.phone, has_pin: !!c.pin_hash, card: loyalty.card(c), history });
});

A.post('/clients/:id/cherry', (req, res) => {
  const c = qClient.get(Number(req.params.id));
  if (!c) return fail(res, 404, 'No encontré a esa clienta.');
  const reasons = { amiga: 'Trajo a una amiga', cumple: 'Mes de cumpleaños', ajuste: 'Ajuste' };
  const reason = reasons[req.body && req.body.reason] || 'Ajuste';
  const amount = Number(req.body && req.body.amount) || 1;
  if (![0.5, 1].includes(amount)) return fail(res, 400, 'Solo se puede sumar ½ o 1 cereza.');
  loyalty.addCherry(c.id, amount, reason);
  res.json({ ok: true, card: loyalty.card(c) });
});

A.post('/clients/:id/redeem', (req, res) => {
  const c = qClient.get(Number(req.params.id));
  if (!c) return fail(res, 404, 'No encontré a esa clienta.');
  try { loyalty.redeem(c, Number(req.body && req.body.milestone)); }
  catch (e) { return fail(res, 400, e.message); }
  res.json({ ok: true, card: loyalty.card(qClient.get(c.id)) });
});

A.post('/clients/:id/pin', (req, res) => {
  const pin = req.body && req.body.pin;
  if (!auth.validPin(pin)) return fail(res, 400, 'El PIN debe ser de 4 números.');
  db.prepare('UPDATE clients SET pin_hash = ? WHERE id = ?').run(auth.hashPin(pin), Number(req.params.id));
  res.json({ ok: true });
});

A.get('/services', (req, res) => res.json(db.prepare('SELECT * FROM services ORDER BY sort, id').all()));
A.put('/services/:id', (req, res) => {
  const s = qService.get(Number(req.params.id));
  if (!s) return fail(res, 404, 'No encontré ese servicio.');
  const b = req.body || {};
  const price = b.price != null ? Math.round(Number(b.price)) : s.price;
  const dur = b.duration_min != null ? Math.round(Number(b.duration_min)) : s.duration_min;
  if (!(price >= 0) || !(dur >= 5 && dur <= 600)) return fail(res, 400, 'Revisa el precio y la duración.');
  db.prepare(`UPDATE services SET name = ?, price = ?, duration_min = ?, duration_confirmed = 1, description = ?, active = ?,
    touch_price = CASE WHEN touch_allowed = 1 THEN ? ELSE touch_price END WHERE id = ?`)
    .run(cleanName(b.name) || s.name, price, dur, String(b.description ?? s.description).slice(0, 160), b.active === false ? 0 : 1,
      s.touch_allowed ? Math.round(price / 2) : null, s.id);
  res.json({ ok: true });
});
A.post('/services', (req, res) => {
  const b = req.body || {};
  const cats = ['unas', 'pestanas', 'cejas', 'depilacion'];
  if (!cats.includes(b.cat) || !cleanName(b.name)) return fail(res, 400, 'Falta la categoría o el nombre.');
  const price = Math.round(Number(b.price) || 0), dur = Math.round(Number(b.duration_min) || 60);
  const touch = b.cat === 'pestanas' ? 1 : 0;
  db.prepare(`INSERT INTO services (cat, name, price, duration_min, duration_confirmed, description, touch_allowed, touch_price, touch_days, sort)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort),0)+1 FROM services))`)
    .run(b.cat, cleanName(b.name), price, dur, String(b.description || '').slice(0, 160), touch, touch ? Math.round(price / 2) : null, touch ? 15 : null);
  res.json({ ok: true });
});

const EDITABLE = ['open_days', 'open_time', 'last_start', 'slot_step', 'min_lead_min', 'booking_window_days', 'discount_pct', 'cherry_months',
  'whatsapp', 'address', 'maps_url', 'instagram', 'tiktok', 'city', 'owner_name', 'owner_email', 'cancel_hours'];
A.get('/settings', (req, res) => {
  const all = settings.all();
  res.json({ ...Object.fromEntries(EDITABLE.map(k => [k, all[k] ?? ''])), calendar: calendar.enabled() });
});
A.put('/settings', (req, res) => {
  const b = req.body || {};
  for (const k of EDITABLE) if (b[k] != null) settings.set(k, String(b[k]).slice(0, 300));
  res.json({ ok: true });
});
A.post('/pin', (req, res) => {
  const { current, pin } = req.body || {};
  if (!auth.checkPin(current, settings.get('admin_pin_hash'))) return fail(res, 401, 'Tu PIN actual no coincide.');
  if (!/^\d{4,8}$/.test(String(pin || ''))) return fail(res, 400, 'El PIN nuevo debe tener de 4 a 8 números.');
  settings.set('admin_pin_hash', auth.hashPin(pin));
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(DATA_DIR, 'uploads'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(8).toString('hex') + (path.extname(file.originalname).toLowerCase().match(/^\.(jpe?g|png|webp|heic)$/) ? path.extname(file.originalname).toLowerCase() : '.jpg'))
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});
A.post('/photos', upload.single('photo'), (req, res) => {
  if (!req.file) return fail(res, 400, 'Elige una foto (JPG, PNG o WebP).');
  const cat = ['unas', 'pestanas', 'cejas'].includes(req.body.cat) ? req.body.cat : 'unas';
  db.prepare('INSERT INTO photos (file, cat, tag) VALUES (?, ?, ?)').run(req.file.filename, cat, cleanName(req.body.tag));
  res.json({ ok: true });
});
A.delete('/photos/:id', (req, res) => {
  db.prepare('DELETE FROM photos WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.use('/api/admin', A);
app.use('/api', (req, res) => fail(res, 404, 'Ruta no encontrada.'));

// ---------- archivos ----------
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d', fallthrough: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m', index: false }));
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// limpieza diaria de sesiones vencidas
setInterval(() => db.prepare("DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')").run(), 6 * 3600000).unref();

app.listen(PORT, '127.0.0.1', () => console.log(`[noah] ${ENV} escuchando en 127.0.0.1:${PORT} · datos en ${DATA_DIR}`));
