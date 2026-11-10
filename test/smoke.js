// Prueba de humo: levanta la app con datos temporales y recorre el flujo principal.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PORT = 3999;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'noah-test-'));
const base = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ['server.js'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, ADMIN_PIN: '2468', NOAH_ENV: 'test', ICLOUD_USER: '', ICLOUD_APP_PASSWORD: '' },
  stdio: ['ignore', 'pipe', 'pipe']
});
srv.stderr.on('data', d => process.stderr.write(d));

const jar = {};
async function call(who, method, url, body) {
  const r = await fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', Cookie: jar[who] || '' },
    body: body ? JSON.stringify(body) : undefined
  });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (set.length) jar[who] = set.map(c => c.split(';')[0]).join('; ');
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

(async () => {
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  const services = (await call('x', 'GET', '/api/services')).j;
  assert(services.length >= 40, 'servicios sembrados');
  const lash = services.find(s => s.name === 'Volumen Ruso');
  assert.equal(lash.touch_price, 450);

  const days = (await call('x', 'GET', '/api/days')).j;
  assert(days.length > 0, 'hay días');
  const day = days[2].date;
  const sl = (await call('x', 'GET', `/api/slots?service=${lash.id}&date=${day}`)).j;
  assert(sl.slots.length === 19, 'slots de 10:00 a 19:00 cada 30 min, hay ' + sl.slots.length);

  // nueva clienta sin PIN -> error
  let r = await call('ana', 'POST', '/api/bookings', { service_id: lash.id, date: day, time: '12:00', name: 'Ana Pérez', phone: '442 111 2233' });
  assert.equal(r.status, 400);
  // con PIN
  r = await call('ana', 'POST', '/api/bookings', { service_id: lash.id, date: day, time: '12:00', name: 'Ana Pérez', phone: '442 111 2233', pin: '1357' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert(r.j.logged_in);
  // el horario queda ocupado (y los que se traslapan con 2 h)
  const sl2 = (await call('x', 'GET', `/api/slots?service=${lash.id}&date=${day}`)).j.slots;
  assert(sl2.find(s => s.t === '12:00').busy && sl2.find(s => s.t === '13:30').busy && !sl2.find(s => s.t === '14:00').busy);
  // otra persona no puede tomar la misma hora
  r = await call('eva', 'POST', '/api/bookings', { service_id: lash.id, date: day, time: '12:30', name: 'Eva', phone: '4429998877', pin: '1111' });
  assert.equal(r.status, 409);

  // retoque: Ana tiene pestañas ese día, retoque 10 días después sí aplica
  const later = days.find(d => d.date > day && (new Date(d.date) - new Date(day)) / 86400000 <= 15 && (new Date(d.date) - new Date(day)) / 86400000 >= 7);
  if (later) {
    r = await call('ana', 'POST', '/api/bookings', { service_id: lash.id, kind: 'touch', date: later.date, time: '10:00' });
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.equal(r.j.booking.price, 450);
  }
  // Eva sin historial no puede pedir retoque
  r = await call('eva', 'POST', '/api/bookings', { service_id: lash.id, kind: 'touch', date: day, time: '16:00', name: 'Eva', phone: '4429998877', pin: '1111' });
  assert.equal(r.status, 400);

  // tarjeta
  r = await call('ana', 'GET', '/api/me');
  assert.equal(r.status, 200); assert.equal(r.j.card.balance, 0);
  // login con PIN incorrecto / correcto
  assert.equal((await call('ana2', 'POST', '/api/login', { phone: '4421112233', pin: '0000' })).status, 401);
  assert.equal((await call('ana2', 'POST', '/api/login', { phone: '4421112233', pin: '1357' })).status, 200);

  // panel
  assert.equal((await call('admin', 'GET', '/api/admin/summary')).status, 401);
  assert.equal((await call('admin', 'POST', '/api/admin/login', { pin: '2468' })).status, 200);
  const sum = (await call('admin', 'GET', '/api/admin/summary?date=' + day)).j;
  assert.equal(sum.bookings.length, 1);
  r = await call('admin', 'POST', `/api/admin/bookings/${sum.bookings[0].id}/status`, { status: 'done' });
  assert.equal(r.j.balance, 1);
  const anaId = sum.bookings[0].client.id;
  await call('admin', 'POST', `/api/admin/clients/${anaId}/cherry`, { reason: 'amiga', amount: 1 });
  await call('admin', 'POST', `/api/admin/clients/${anaId}/cherry`, { reason: 'ajuste', amount: 0.5 });
  r = await call('admin', 'GET', `/api/admin/clients/${anaId}`);
  assert.equal(r.j.card.balance, 2.5);
  r = await call('admin', 'POST', `/api/admin/clients/${anaId}/redeem`, { milestone: 3 });
  assert.equal(r.status, 400, 'no puede canjear 3 con 2.5');

  // solicitud de horario especial
  r = await call('x', 'POST', '/api/requests', { service_id: lash.id, date: day, time: '20:00', name: 'Lu', phone: '4425550000', reason: 'trabajo' });
  assert.equal(r.status, 200);
  const reqs = (await call('admin', 'GET', '/api/admin/requests')).j;
  r = await call('admin', 'POST', `/api/admin/requests/${reqs[0].id}`, { action: 'accept' });
  assert.equal(r.status, 200);
  const sum2 = (await call('admin', 'GET', '/api/admin/summary?date=' + day)).j;
  assert(sum2.bookings.some(b => b.special && b.start === '20:00'));

  // ajustes y servicios
  r = await call('admin', 'PUT', '/api/admin/settings', { whatsapp: '4421234567', discount_pct: '40' });
  assert.equal(r.status, 200);
  assert.equal((await call('x', 'GET', '/api/info')).j.discount_pct, 40);
  r = await call('admin', 'PUT', `/api/admin/services/${lash.id}`, { name: 'Volumen Ruso', price: 1000, duration_min: 150 });
  assert.equal(r.status, 200);
  const lash2 = (await call('x', 'GET', '/api/services')).j.find(s => s.id === lash.id);
  assert.equal(lash2.touch_price, 500); assert.equal(lash2.duration_min, 150);

  // páginas
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/admin')).status, 200);
  console.log('✓ prueba de humo completa');
  srv.kill(); fs.rmSync(DATA, { recursive: true, force: true });
})().catch(e => { console.error('✗', e); srv.kill(); process.exit(1); });
