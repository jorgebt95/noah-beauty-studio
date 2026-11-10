const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { SERVICES } = require('./seed-services');

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'noah.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cat TEXT NOT NULL,              -- unas | pestanas | cejas | depilacion
  name TEXT NOT NULL,
  price INTEGER NOT NULL,         -- pesos
  duration_min INTEGER NOT NULL,
  duration_confirmed INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  is_touch INTEGER NOT NULL DEFAULT 0,          -- el servicio en sí es un retoque (½ cereza)
  touch_allowed INTEGER NOT NULL DEFAULT 0,     -- se puede pedir como retoque a mitad de precio
  touch_price INTEGER,
  touch_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pin_hash TEXT,
  cycle INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  kind TEXT NOT NULL DEFAULT 'full',            -- full | touch
  date TEXT NOT NULL,                           -- YYYY-MM-DD (hora local)
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  price INTEGER NOT NULL,
  special INTEGER NOT NULL DEFAULT 0,           -- fuera de horario
  status TEXT NOT NULL DEFAULT 'confirmed',     -- confirmed | done | noshow | cancelled
  notes TEXT NOT NULL DEFAULT '',
  cal_uid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_id INTEGER NOT NULL REFERENCES services(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | accepted | other | rejected
  booking_id INTEGER REFERENCES bookings(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cherries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  booking_id INTEGER REFERENCES bookings(id),
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  cycle INTEGER NOT NULL,
  milestone INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, cycle, milestone)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                           -- client | admin
  client_id INTEGER,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file TEXT NOT NULL,
  cat TEXT NOT NULL DEFAULT 'unas',
  tag TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const DEFAULT_SETTINGS = {
  open_days: '1,2,3,4,5,6',       // lunes a sábado (0 = domingo)
  open_time: '10:00',
  last_start: '19:00',
  slot_step: '30',
  min_lead_min: '120',
  booking_window_days: '30',
  discount_pct: '50',
  cherry_months: '6',
  whatsapp: '',
  address: '',
  maps_url: '',
  instagram: '',
  tiktok: '',
  city: 'Querétaro',
  owner_name: '',
  owner_email: '',
  cancel_hours: ''
};

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const putSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  if (!getSetting.get(k)) putSetting.run(k, v);
}

if (db.prepare('SELECT COUNT(*) AS n FROM services').get().n === 0) {
  const ins = db.prepare(`INSERT INTO services (cat, name, price, duration_min, description, is_touch, touch_allowed, touch_price, touch_days, sort)
    VALUES (@cat, @name, @price, @duration_min, @description, @is_touch, @touch_allowed, @touch_price, @touch_days, @sort)`);
  db.transaction(() => SERVICES.forEach((s, i) => ins.run({ description: '', is_touch: 0, touch_allowed: 0, touch_price: null, touch_days: null, ...s, sort: i })))();
}

const settings = {
  get(key) { const r = getSetting.get(key); return r ? r.value : (DEFAULT_SETTINGS[key] ?? ''); },
  set(key, value) { putSetting.run(key, String(value)); },
  all() { return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])); }
};

module.exports = { db, settings, DATA_DIR, DEFAULT_SETTINGS };
