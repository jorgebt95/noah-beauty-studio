/* Panel de Sophia */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const view = $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n).toLocaleString('es-MX');
const half = x => (Math.floor(x) === x ? String(x) : (Math.floor(x) ? Math.floor(x) + '½' : '½'));
const CAT = { unas: 'Uñas', pestanas: 'Pestañas', cejas: 'Cejas', depilacion: 'Depilación' };
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

async function api(url, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const r = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body && !isForm ? { 'Content-Type': 'application/json' } : {},
    credentials: 'same-origin',
    body: opts.body ? (isForm ? opts.body : JSON.stringify(opts.body)) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('/login')) { login(); throw new Error('Entra con tu PIN.'); }
  if (!r.ok) throw new Error(j.error || 'No se pudo completar.');
  return j;
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
const waTo = (phone, text) => `https://wa.me/52${String(phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;
const WA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/></svg>';

const A = { tab: 'hoy', date: null, info: null, sum: null };

function login() {
  view.innerHTML = `
  <section class="wrap section" style="padding-top:60px">
    <p class="eyebrow">Noah Beauty Studio</p>
    <h1 class="h1">Panel de Sophia</h1>
    <form id="f" class="stack" style="margin-top:10px">
      <div class="field"><label for="pin">Tu PIN</label><input id="pin" class="input pin" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" required autofocus></div>
      <div id="err"></div>
      <button class="btn dark" type="submit">Entrar</button>
    </form>
  </section>`;
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/login', { body: { pin: $('#pin').value } }); shell(); }
    catch (ex) { $('#err').innerHTML = `<div class="error">${esc(ex.message)}</div>`; }
  });
}

async function shell() {
  A.sum = await api('/api/admin/summary' + (A.date ? '?date=' + A.date : ''));
  A.date = A.sum.date;
  const done = A.sum.bookings.filter(b => b.status === 'done');
  const given = done.reduce((t, b) => t + (b.kind === 'touch' ? .5 : 1), 0);
  const tabs = [['hoy', 'Agenda'], ['sol', 'Solicitudes'], ['cli', 'Clientas'], ['svc', 'Servicios'], ['fot', 'Fotos'], ['aj', 'Ajustes']];
  view.innerHTML = `
  <header class="ahead wrap">
    <div style="display:flex;justify-content:space-between;align-items:center"><p class="eyebrow">Panel · solo Sophia</p><button type="button" id="out" class="btn ghost sm" style="color:#E5C1B8;border-color:#6B3A42;min-height:36px">Salir</button></div>
    <p class="h1" style="font-size:30px;margin-top:8px">Hola, Sophia</p>
    <p class="sub" style="color:#E5C1B8;font-size:19px">${esc(A.sum.date_label)}</p>
    <div class="stats"><div><b>${A.sum.bookings.filter(b => b.status !== 'cancelled').length}</b><span>citas</span></div><div><b>${done.length}</b><span>atendidas</span></div><div><b>${half(given)}</b><span>cerezas dadas</span></div></div>
  </header>
  <nav class="atabs wrap" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${A.tab === id}">${l}${id === 'sol' && A.sum.pending_requests ? ` <span class="badge">${A.sum.pending_requests}</span>` : ''}</button>`).join('')}</nav>
  <section id="body" class="wrap section" style="padding-top:12px"></section>`;
  if (A.sum && A.sum.calendar === false && A.tab === 'hoy') { /* aviso en Ajustes */ }
  $('#out').addEventListener('click', async () => { await api('/api/admin/logout', { body: {} }); login(); });
  view.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { A.tab = b.dataset.tab; shell(); }));
  ({ hoy, sol, cli, svc, fot, aj })[A.tab]();
}
const body = () => $('#body');

// ---------- Agenda ----------
function shiftDate(d, n) { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function hoy() {
  const s = A.sum;
  body().innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <button type="button" class="iconbtn" id="prev" aria-label="Día anterior" style="background:#FBF7F2">‹</button>
      <input type="date" id="d" class="input" value="${s.date}" style="flex:1">
      <button type="button" class="iconbtn" id="next" aria-label="Día siguiente" style="background:#FBF7F2">›</button>
    </div>
    ${s.date !== s.today ? '<button type="button" class="btn ghost sm" id="today" style="align-self:flex-start">Ir a hoy</button>' : ''}
    <div class="stack" id="list">
      ${s.bookings.length ? s.bookings.map(b => `
      <div class="acard" data-id="${b.id}">
        <div style="display:flex;gap:12px;align-items:center">
          <p class="num" style="margin:0;width:56px;font-size:18px">${b.start}</p>
          <div class="grow"><p style="margin:0;font-weight:500">${esc(b.client.name)}</p>
          <p class="small muted" style="margin:1px 0 0">${esc(b.service)}${b.kind === 'touch' ? ' (retoque)' : ''} · ${b.price_label}${b.special ? ' · horario especial' : ''}<br>${half(b.client.balance)} cerezas de 10${b.notes ? ' · ' + esc(b.notes) : ''}</p></div>
          <a class="iconbtn" style="background:#F3EBE3" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(b.client.name)}" href="${waTo(b.client.phone, `Hola ${b.client.name.split(' ')[0]} 🍒 Te recuerdo tu cita de ${b.service} el ${b.date_label} a las ${b.start}. ¡Te esperamos!`)}">${WA}</a>
        </div>
        ${b.status === 'confirmed' ? `<div class="actions">
          <button type="button" class="primary" data-st="done">Atendida · +${b.kind === 'touch' || /retoque/i.test(b.service) ? '½' : '1'}</button>
          <button type="button" data-st="noshow">No vino</button>
          <button type="button" data-st="cancelled">Cancelar</button></div>`
        : `<p class="status ${b.status}" style="margin:0">${{ done: 'Atendida · cereza sumada', noshow: 'No vino', cancelled: 'Cancelada' }[b.status]} · <a href="#" data-st="confirmed">deshacer</a></p>`}
      </div>`).join('') : '<p class="muted">No hay citas este día.</p>'}
    </div>
    <details class="acard"><summary style="cursor:pointer;font-weight:500;min-height:32px;display:flex;align-items:center">+ Agregar una cita a mano</summary>
      <form id="nf" class="stack" style="margin-top:10px">
        <div class="field"><label for="ns">Servicio</label><select id="ns" class="input"></select></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
          <div class="field"><label for="nd">Día</label><input id="nd" type="date" class="input" value="${s.date}" required></div>
          <div class="field"><label for="nt">Hora</label><input id="nt" type="time" class="input" required></div>
        </div>
        <div class="field"><label for="nn">Nombre</label><input id="nn" class="input" required></div>
        <div class="field"><label for="np">Celular</label><input id="np" class="input" type="tel" required></div>
        <label class="check"><input type="checkbox" id="nk"> <span>Es retoque (pestañas, mitad de precio)</span></label>
        <button class="btn dark" type="submit">Guardar cita</button>
      </form>
    </details>`;
  const go = d => { A.date = d; shell(); };
  $('#prev').addEventListener('click', () => go(shiftDate(s.date, -1)));
  $('#next').addEventListener('click', () => go(shiftDate(s.date, 1)));
  $('#d').addEventListener('change', e => go(e.target.value));
  if ($('#today')) $('#today').addEventListener('click', () => go(s.today));
  $('#list').addEventListener('click', async e => {
    const t = e.target.closest('[data-st]'); if (!t) return;
    e.preventDefault();
    const id = t.closest('[data-id]').dataset.id;
    try { await api(`/api/admin/bookings/${id}/status`, { body: { status: t.dataset.st } }); toast('Listo'); shell(); }
    catch (ex) { toast(ex.message); }
  });
  api('/api/admin/services').then(list => {
    $('#ns').innerHTML = Object.entries(CAT).map(([k, l]) => `<optgroup label="${l}">${list.filter(x => x.cat === k && x.active).map(x => `<option value="${x.id}">${esc(x.name)} · ${money(x.price)}</option>`).join('')}</optgroup>`).join('');
  });
  $('#nf').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/api/admin/bookings', { body: { service_id: $('#ns').value, date: $('#nd').value, time: $('#nt').value, name: $('#nn').value, phone: $('#np').value, kind: $('#nk').checked ? 'touch' : 'full' } });
      toast('Cita guardada'); A.date = $('#nd').value; shell();
    } catch (ex) { toast(ex.message); }
  });
}

// ---------- Solicitudes ----------
async function sol() {
  const list = await api('/api/admin/requests');
  const label = { pending: '', accepted: 'Aceptada · ya está en tu agenda', other: 'Le propusiste otra hora', rejected: 'Rechazada' };
  body().innerHTML = `<p class="small muted" style="margin:0">Citas fuera de horario que piden las clientas.</p>
    <div class="stack" id="rl">${list.length ? list.map(r => {
      const first = r.name.split(' ')[0];
      const msg = {
        accepted: `Hola ${first} 🍒 ¡Listo! Te espero el ${r.date_label} a las ${r.time} para tu ${r.service}.`,
        other: `Hola ${first} 🍒 A las ${r.time} no me es posible el ${r.date_label}. ¿Te acomoda otra hora? Te propongo: `,
        rejected: `Hola ${first} 🍒 Una disculpa, ese día no voy a poder en horario especial. ¿Te late agendar en otro día? Aquí puedes ver mis horarios: ${location.origin}/#agendar`
      }[r.status];
      return `<div class="acard" data-id="${r.id}">
        <div style="display:flex;justify-content:space-between;gap:10px"><b style="font-weight:500">${esc(r.name)}</b><span class="num" style="color:#8C2F39">${esc(r.date_label.split(' ').slice(0, 2).join(' '))} · ${esc(r.time)}</span></div>
        <p class="small muted" style="margin:0">${esc(r.service)}${r.reason ? ' · “' + esc(r.reason) + '”' : ''} · ${esc(r.phone)}</p>
        ${r.status === 'pending' ? `<div class="actions"><button type="button" class="primary" data-a="accept">Aceptar</button><button type="button" data-a="other">Otra hora</button><button type="button" data-a="reject">No puedo</button></div>`
        : `<p class="status ${r.status === 'accepted' ? 'done' : 'noshow'}" style="margin:0">${label[r.status]}</p>
           <a class="btn dark sm" style="width:100%" target="_blank" rel="noopener" href="${waTo(r.phone, msg)}">${WA} Avisarle por WhatsApp (mensaje listo)</a>`}
      </div>`;
    }).join('') : '<p class="muted">No hay solicitudes.</p>'}</div>`;
  $('#rl').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    try { await api(`/api/admin/requests/${b.closest('[data-id]').dataset.id}`, { body: { action: b.dataset.a } }); shell(); }
    catch (ex) { toast(ex.message); }
  });
}

// ---------- Clientas ----------
function cli() {
  body().innerHTML = `<div class="field"><label for="q">Buscar por celular o nombre</label><input id="q" class="input" placeholder="442… o nombre"></div><div id="res" class="stack"></div><div id="det"></div>`;
  let t;
  $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => search(e.target.value), 250); });
  search('');
}
async function search(q) {
  const list = await api('/api/admin/clients?q=' + encodeURIComponent(q));
  $('#res').innerHTML = list.map(c => `<button type="button" class="acard" data-c="${c.id}" style="border:0;text-align:left;cursor:pointer;flex-direction:row;align-items:center"><span class="grow"><b style="font-weight:500">${esc(c.name)}</b><br><span class="small muted">${esc(c.phone)}${c.has_pin ? '' : ' · sin PIN'}</span></span><span class="num">${half(c.balance)} 🍒</span></button>`).join('') || '<p class="muted small">Sin resultados.</p>';
  $('#res').querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => detail(b.dataset.c)));
}
async function detail(id) {
  const c = await api('/api/admin/clients/' + id);
  $('#res').innerHTML = '';
  const k = c.card;
  $('#det').innerHTML = `<div class="acard">
    <div style="display:flex;justify-content:space-between;gap:10px"><div><b style="font-weight:500;font-size:18px">${esc(c.name)}</b><br><span class="small muted">${esc(c.phone)}</span></div>
    <a class="iconbtn" style="background:#F3EBE3" target="_blank" rel="noopener" href="${waTo(c.phone, `Hola ${c.name.split(' ')[0]} 🍒`)}" aria-label="WhatsApp">${WA}</a></div>
    <p style="margin:0" class="num">${half(k.balance)} de 10 cerezas</p>
    <div class="actions">
      <button type="button" data-ch="amiga">+1 amiga</button><button type="button" data-ch="cumple">+1 cumpleaños</button><button type="button" data-ch="ajuste">+½ ajuste</button>
    </div>
    <p style="margin:6px 0 0;font-weight:500">Premios</p>
    ${k.rewards.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="small">${r.at} · ${esc(r.label)}</span>${r.redeemed ? '<span class="small" style="color:#2F6B4F">Usado</span>' : r.reached ? `<button type="button" class="btn sm" data-rd="${r.at}">Canjear</button>` : '<span class="small muted">Aún no</span>'}</div>`).join('')}
    <form id="pf" style="display:flex;gap:8px;margin-top:6px"><input id="np" class="input pin" inputmode="numeric" maxlength="4" placeholder="Nuevo PIN" style="flex:1"><button class="btn dark sm" type="submit">Cambiar PIN</button></form>
    <p style="margin:6px 0 0;font-weight:500">Historial</p>
    ${c.history.map(b => `<p class="small" style="margin:0">${esc(b.date_label)} · ${esc(b.service)} · <span class="status ${b.status}">${{ confirmed: 'agendada', done: 'atendida', noshow: 'no vino', cancelled: 'cancelada' }[b.status]}</span></p>`).join('') || '<p class="small muted" style="margin:0">Sin citas todavía.</p>'}
    <button type="button" class="btn ghost sm" id="back">Volver a la búsqueda</button>
  </div>`;
  $('#det').querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', async () => {
    try { await api(`/api/admin/clients/${id}/cherry`, { body: { reason: b.dataset.ch, amount: b.dataset.ch === 'ajuste' ? .5 : 1 } }); toast('Cereza sumada'); detail(id); } catch (ex) { toast(ex.message); }
  }));
  $('#det').querySelectorAll('[data-rd]').forEach(b => b.addEventListener('click', async () => {
    try { await api(`/api/admin/clients/${id}/redeem`, { body: { milestone: Number(b.dataset.rd) } }); toast('Premio canjeado'); detail(id); } catch (ex) { toast(ex.message); }
  }));
  $('#pf').addEventListener('submit', async e => { e.preventDefault(); try { await api(`/api/admin/clients/${id}/pin`, { body: { pin: $('#np').value } }); toast('PIN cambiado'); $('#np').value = ''; } catch (ex) { toast(ex.message); } });
  $('#back').addEventListener('click', () => { $('#det').innerHTML = ''; search($('#q').value); });
}

// ---------- Servicios ----------
async function svc() {
  const list = await api('/api/admin/services');
  const pending = list.filter(s => !s.duration_confirmed && s.active).length;
  body().innerHTML = `${pending ? `<div class="note"><b style="font-weight:500">${pending} servicios con duración provisional</b> (marcados en dorado). Corrige los minutos para que la agenda no empalme citas.</div>` : ''}
    <div class="svcrow small muted"><span>Servicio</span><span>Precio $</span><span>Minutos</span></div>
    ${Object.entries(CAT).map(([k, l]) => `<p style="margin:10px 0 0;font-weight:600">${l}</p>
      ${list.filter(s => s.cat === k).map(s => `<div class="svcrow" data-id="${s.id}">
        <input aria-label="Nombre" data-f="name" value="${esc(s.name)}" ${s.active ? '' : 'style="opacity:.5"'}>
        <input aria-label="Precio de ${esc(s.name)}" data-f="price" inputmode="numeric" value="${s.price}">
        <input aria-label="Minutos de ${esc(s.name)}" data-f="duration_min" inputmode="numeric" value="${s.duration_min}" class="${s.duration_confirmed ? '' : 'warn'}">
      </div>`).join('')}`).join('')}
    <p class="small muted">Los cambios se guardan al salir de cada casilla. En pestañas el retoque se calcula a la mitad del precio.</p>
    <details class="acard"><summary style="cursor:pointer;font-weight:500">+ Agregar servicio</summary>
      <form id="af" class="stack" style="margin-top:10px">
        <div class="field"><label for="ac">Categoría</label><select id="ac" class="input">${Object.entries(CAT).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="field"><label for="an">Nombre</label><input id="an" class="input" required></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><div class="field"><label for="ap">Precio $</label><input id="ap" class="input" inputmode="numeric" required></div><div class="field"><label for="am">Minutos</label><input id="am" class="input" inputmode="numeric" value="60" required></div></div>
        <button class="btn dark" type="submit">Agregar</button>
      </form></details>`;
  body().querySelectorAll('.svcrow[data-id] input').forEach(inp => inp.addEventListener('change', async () => {
    const row = inp.closest('[data-id]');
    const data = Object.fromEntries([...row.querySelectorAll('input')].map(i => [i.dataset.f, i.value]));
    try { await api('/api/admin/services/' + row.dataset.id, { method: 'PUT', body: data }); row.querySelector('[data-f="duration_min"]').classList.remove('warn'); toast('Guardado'); }
    catch (ex) { toast(ex.message); }
  }));
  $('#af').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/services', { body: { cat: $('#ac').value, name: $('#an').value, price: $('#ap').value, duration_min: $('#am').value } }); toast('Servicio agregado'); svc(); }
    catch (ex) { toast(ex.message); }
  });
}

// ---------- Fotos ----------
// Reduce la foto en el celular antes de subirla (máx. 1600 px, JPEG) para que la galería cargue rápido.
function shrink(file, max = 1600) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => resolve(b || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
async function fot() {
  const list = await api('/api/photos');
  const CATS = { unas: 'Uñas', pestanas: 'Pestañas', cejas: 'Cejas' };
  body().innerHTML = `<form id="uf" class="acard stack">
      <p style="margin:0;font-weight:600">Subir fotos a Trabajos</p>
      <div class="field"><label for="file">Elige una o varias fotos</label><input id="file" type="file" accept="image/*" multiple class="input" style="padding-top:12px" required></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
        <div class="field"><label for="cat">Tipo</label><select id="cat" class="input">${Object.entries(CATS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="field"><label for="tag">Etiqueta (opcional)</label><input id="tag" class="input" placeholder="French fino"></div>
      </div>
      <button class="btn dark" type="submit" id="up">Subir</button>
      <p class="small muted" style="margin:0">Las fotos se ajustan solas de tamaño. Aparecen al momento en la sección Trabajos de la página.</p>
    </form>
    <p style="margin:6px 0 0;font-weight:600">${list.length} ${list.length === 1 ? 'foto publicada' : 'fotos publicadas'}</p>
    <div class="ph">${list.map(p => `<figure><img src="/uploads/${encodeURIComponent(p.file)}" alt="${esc(p.tag || CATS[p.cat] || '')}" loading="lazy"><button type="button" data-del="${p.id}" aria-label="Borrar foto">✕</button></figure>`).join('')}</div>`;
  $('#uf').addEventListener('submit', async e => {
    e.preventDefault();
    const files = [...$('#file').files];
    if (!files.length) return toast('Elige al menos una foto');
    const up = $('#up'); up.disabled = true;
    let ok = 0;
    for (const [i, f] of files.entries()) {
      up.textContent = `Subiendo ${i + 1} de ${files.length}…`;
      const blob = await shrink(f);
      const fd = new FormData();
      fd.append('photo', blob, (f.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg');
      fd.append('cat', $('#cat').value); fd.append('tag', $('#tag').value);
      try { await api('/api/admin/photos', { body: fd }); ok++; } catch (ex) { toast(ex.message); }
    }
    toast(ok === files.length ? (ok === 1 ? 'Foto subida' : `${ok} fotos subidas`) : `Se subieron ${ok} de ${files.length}`);
    fot();
  });
  body().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = '¿?'; toast('Toca otra vez para borrar'); return; }
    await api('/api/admin/photos/' + b.dataset.del, { method: 'DELETE' }); fot();
  }));
}

// ---------- Ajustes ----------
async function aj() {
  const s = await api('/api/admin/settings');
  const days = s.open_days.split(',').map(Number);
  const f = (id, label, val, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" class="input" value="${esc(val)}" ${extra}></div>`;
  body().innerHTML = `<form id="sf" class="stack">
    <p style="margin:0;font-weight:600">Horario</p>
    <div class="chips" id="days">${DAYS.map((d, i) => `<button type="button" data-d="${i}" aria-pressed="${days.includes(i)}">${d}</button>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${f('open_time', 'Primera cita', s.open_time, 'type="time"')}${f('last_start', 'Última cita', s.last_start, 'type="time"')}</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${f('min_lead_min', 'Anticipación mínima (min)', s.min_lead_min, 'inputmode="numeric"')}${f('booking_window_days', 'Agenda abierta (días)', s.booking_window_days, 'inputmode="numeric"')}</div>
    ${f('cancel_hours', 'Horas para cancelar', s.cancel_hours, 'inputmode="numeric" placeholder="ej. 24"')}
    <p style="margin:8px 0 0;font-weight:600">Club Cereza</p>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${f('discount_pct', 'Descuento a las 10 (%)', s.discount_pct, 'inputmode="numeric"')}${f('cherry_months', 'Las cerezas vencen en (meses)', s.cherry_months, 'inputmode="numeric"')}</div>
    <p style="margin:8px 0 0;font-weight:600">Datos del negocio</p>
    ${f('whatsapp', 'WhatsApp (10 dígitos)', s.whatsapp, 'type="tel"')}
    ${f('address', 'Dirección', s.address)}
    ${f('maps_url', 'Link de Google Maps', s.maps_url, 'type="url"')}
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${f('instagram', 'Instagram', s.instagram, 'placeholder="@usuario"')}${f('tiktok', 'TikTok', s.tiktok, 'placeholder="@usuario"')}</div>
    ${f('city', 'Ciudad', s.city)}
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${f('owner_name', 'Nombre (aviso de privacidad)', s.owner_name)}${f('owner_email', 'Correo (aviso de privacidad)', s.owner_email, 'type="email"')}</div>
    <button class="btn dark" type="submit">Guardar ajustes</button>
  </form>
  <div class="note"><b style="font-weight:500">Calendario de iCloud:</b> ${s.calendar ? 'conectado. Tus eventos bloquean horarios y las citas nuevas aparecen en tu iPhone.' : 'todavía no está conectado. Mientras, la agenda solo cuenta las citas hechas aquí.'}</div>
  <form id="pinf" class="acard stack"><p style="margin:0;font-weight:600">Cambiar mi PIN</p>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><input id="cp" class="input pin" type="password" inputmode="numeric" maxlength="8" placeholder="Actual" aria-label="PIN actual"><input id="npn" class="input pin" type="password" inputmode="numeric" maxlength="8" placeholder="Nuevo" aria-label="PIN nuevo"></div>
    <button class="btn ghost" type="submit">Cambiar PIN</button></form>`;
  $('#days').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); });
  $('#sf').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries([...$('#sf').querySelectorAll('input.input')].map(i => [i.id, i.value]));
    data.open_days = [...$('#days').querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.d).join(',');
    data.whatsapp = data.whatsapp.replace(/\D/g, '');
    try { await api('/api/admin/settings', { method: 'PUT', body: data }); toast('Ajustes guardados'); } catch (ex) { toast(ex.message); }
  });
  $('#pinf').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/admin/pin', { body: { current: $('#cp').value, pin: $('#npn').value } }); toast('PIN cambiado'); $('#cp').value = $('#npn').value = ''; } catch (ex) { toast(ex.message); }
  });
}

(async () => {
  try { const info = await (await fetch('/api/info')).json(); if (info.env && info.env !== 'prod') $('#envbar').hidden = false; } catch {}
  try { await shell(); } catch { login(); }
})();
})();
