const crypto = require('crypto');
const { db, settings } = require('./db');

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${h}`;
}
function checkPin(pin, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(String(pin), salt, 32);
  const ref = Buffer.from(h, 'hex');
  return ref.length === test.length && crypto.timingSafeEqual(ref, test);
}
const validPin = pin => /^\d{4}$/.test(String(pin || ''));

// PIN del panel de Sophia: se toma de ADMIN_PIN la primera vez y luego se puede cambiar desde el panel.
function ensureAdminPin() {
  if (!settings.get('admin_pin_hash')) {
    const pin = process.env.ADMIN_PIN;
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      console.warn('[noah] Falta ADMIN_PIN (4 a 8 dígitos) para crear el PIN del panel.');
      return;
    }
    settings.set('admin_pin_hash', hashPin(pin));
  }
}

// --- sesiones (cookie httpOnly) ---
const insSession = db.prepare('INSERT INTO sessions (token, kind, client_id, expires_at) VALUES (?, ?, ?, ?)');
const getSession = db.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')");
const delSession = db.prepare('DELETE FROM sessions WHERE token = ?');

function createSession(res, kind, clientId, days) {
  const token = crypto.randomBytes(24).toString('base64url');
  const exp = new Date(Date.now() + days * 86400000);
  insSession.run(token, kind, clientId || null, exp.toISOString());
  const name = kind === 'admin' ? 'noah_admin' : 'noah_client';
  res.cookie(name, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1',
    maxAge: days * 86400000, path: '/'
  });
}
function readSession(req, kind) {
  const name = kind === 'admin' ? 'noah_admin' : 'noah_client';
  const token = req.cookies && req.cookies[name];
  if (!token) return null;
  const s = getSession.get(token);
  return s && s.kind === kind ? s : null;
}
function endSession(req, res, kind) {
  const name = kind === 'admin' ? 'noah_admin' : 'noah_client';
  const token = req.cookies && req.cookies[name];
  if (token) delSession.run(token);
  res.clearCookie(name, { path: '/' });
}
function requireAdmin(req, res, next) {
  if (readSession(req, 'admin')) return next();
  res.status(401).json({ error: 'Entra con tu PIN para ver el panel.' });
}

// --- límite simple de intentos de PIN (por IP y por teléfono) ---
const attempts = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter(t => now - t < 15 * 60000);
  attempts.set(key, a);
  return a.length >= 8;
}
function noteFailure(key) {
  const a = attempts.get(key) || [];
  a.push(Date.now());
  attempts.set(key, a);
}

module.exports = { hashPin, checkPin, validPin, ensureAdminPin, createSession, readSession, endSession, requireAdmin, tooManyAttempts, noteFailure };
