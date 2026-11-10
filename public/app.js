/* Noah Beauty Studio — sitio para clientas (sin frameworks) */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const view = $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n).toLocaleString('es-MX');
const half = x => (Math.floor(x) === x ? String(x) : (Math.floor(x) ? Math.floor(x) + '½' : '½'));
const durLabel = m => m < 60 ? `${m} min` : (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);

async function api(url, opts = {}) {
  const r = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'No se pudo completar. Revisa tu conexión.'); e.status = r.status; throw e; }
  return j;
}

// ---------- íconos ----------
const NAIL = 'M30 4 C42 4 54 24 56 56 L56 120 C56 137 44 147 30 147 C16 147 4 137 4 120 L4 56 C6 24 18 4 30 4 Z';
const SPARK = 'M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0 Z';
const I = {
  nail: (c = '#8C2F39', w = 13) => `<svg width="${w}" height="${w * 2.1}" viewBox="0 0 60 150" aria-hidden="true"><path d="${NAIL}" fill="${c}"/></svg>`,
  lash: (c = '#8C2F39', w = 28) => `<svg width="${w}" height="${w * .45}" viewBox="0 0 160 72" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" aria-hidden="true"><path d="M10 30 Q80 62 150 30"/><path d="M26 37 Q18 44 14 52"/><path d="M46 44 Q41 53 40 62"/><path d="M68 48 Q66 57 66 67"/><path d="M92 48 Q94 57 94 67"/><path d="M114 44 Q119 53 120 62"/><path d="M134 37 Q142 44 146 52"/></svg>`,
  brow: (c = '#8C2F39') => `<svg width="26" height="14" viewBox="0 0 52 28" aria-hidden="true"><path d="M3 22 C12 8 30 4 49 12 C34 9 18 12 7 24 Z" fill="${c}"/></svg>`,
  spark: (c = '#8C2F39', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true"><path d="${SPARK}" fill="${c}"/></svg>`,
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  wa: (c = '#8C2F39') => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/></svg>`,
  map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8C2F39" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  cal: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  photo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8C2F39" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
  cherry: (w, stem = '#3B1219', hl = true) => `<svg width="${w}" height="${Math.round(w * 1.64)}" viewBox="0 0 140 230" aria-hidden="true"><path d="M70 98 C70 64 78 36 98 16" fill="none" stroke="${stem}" stroke-width="9" stroke-linecap="round"/><path d="M98 16 C108 2 128 0 138 6 C128 20 110 24 98 16 Z" fill="#C9A27E"/><circle cx="70" cy="162" r="64" fill="#8C2F39"/>${hl ? '<ellipse cx="48" cy="142" rx="10" ry="17" fill="#FBF7F2" opacity=".55"/>' : ''}</svg>`,
  halfCherry: w => `<svg width="${w}" height="${Math.round(w * 1.47)}" viewBox="0 0 140 230" aria-hidden="true"><defs><clipPath id="hc"><rect x="0" y="0" width="70" height="230"/></clipPath></defs><circle cx="70" cy="162" r="62" fill="none" stroke="#8C5A62" stroke-width="5" stroke-dasharray="10 9"/><g clip-path="url(#hc)"><circle cx="70" cy="162" r="64" fill="#8C2F39"/></g><path d="M70 98 C70 64 78 36 98 16" fill="none" stroke="#F3EBE3" stroke-width="10" stroke-linecap="round"/><path d="M98 16 C108 2 128 0 138 6 C128 20 110 24 98 16 Z" fill="#C9A27E"/></svg>`,
  cherries: s => `<svg width="${s}" height="${s}" viewBox="0 0 200 200" aria-hidden="true"><path d="M64 120 C70 80 86 52 104 30" fill="none" stroke="#3B1219" stroke-width="6" stroke-linecap="round"/><path d="M138 112 C134 80 122 52 104 30" fill="none" stroke="#3B1219" stroke-width="6" stroke-linecap="round"/><path d="M104 30 C112 10 136 4 158 10 C148 30 126 38 104 30 Z" fill="#C9A27E"/><circle cx="62" cy="146" r="40" fill="#8C2F39"/><circle cx="140" cy="138" r="40" fill="#8C2F39"/><ellipse cx="48" cy="134" rx="7" ry="12" fill="#FBF7F2" opacity=".55"/><ellipse cx="126" cy="126" rx="7" ry="12" fill="#FBF7F2" opacity=".55"/></svg>`
};
const CATS = [
  { id: 'unas', label: 'Uñas', icon: () => I.nail() },
  { id: 'pestanas', label: 'Pestañas', icon: () => I.lash() },
  { id: 'cejas', label: 'Cejas', icon: () => I.brow() },
  { id: 'depilacion', label: 'Depilación', icon: () => I.spark() }
];

const logo = (size, stem = '#3B1219', color = '#3B1219') => `
  <div class="mini-logo" style="color:${color}" role="img" aria-label="Noah">
    <b style="font-size:${size}px">N</b>${I.cherry(Math.round(size * .53), stem)}<b style="font-size:${size}px">ah</b>
  </div>`;

function top(back = '#inicio', center = null) {
  return `<header class="top wrap">
    <a class="iconbtn" href="${back}" aria-label="Volver">${I.back}</a>
    ${center || `<a href="#inicio" style="text-decoration:none">${logo(32)}</a>`}
    <span style="width:44px"></span>
  </header>`;
}

// ---------- estado ----------
const S = {
  info: null, services: [], me: undefined,
  b: { serviceId: null, kind: 'full', date: null, time: null },
  last: null
};
const svc = id => S.services.find(s => s.id === Number(id));
function wa(text) {
  const d = String(S.info?.whatsapp || '').replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? '52' + d : d}?text=${encodeURIComponent(text)}`;
}
async function loadMe(force) {
  if (S.me !== undefined && !force) return S.me;
  try { S.me = await api('/api/me'); } catch { S.me = null; }
  return S.me;
}
function render(html) { view.innerHTML = `<div class="fade">${html}</div>`; }
function errorBox(el, msg) { el.innerHTML = msg ? `<div class="error" role="alert">${esc(msg)}</div>` : ''; }

// ---------- vistas ----------
function inicio() {
  const i = S.info || {};
  const waUrl = wa('Hola Sophia, quiero información 🍒');
  render(`
  <section class="wrap" style="position:relative;display:flex;flex-direction:column;align-items:center;padding-top:56px;padding-bottom:28px;min-height:calc(100vh - 30px)">
    <span style="position:absolute;right:30px;top:40px">${I.spark('#8C2F39', 30)}</span>
    <span style="position:absolute;right:64px;top:78px">${I.spark('#C9A27E', 13)}</span>
    ${logo(92)}
    <p class="script" style="margin:10px 0 0;font-size:32px;line-height:1">beauty studio</p>
    <p class="eyebrow" style="margin-top:14px;letter-spacing:.26em;text-align:center;line-height:1.7">Uñas · Pestañas · Cejas${i.city ? ' · ' + esc(i.city) : ''}</p>

    <a class="btn" href="#agendar" style="margin-top:34px">${I.cal} Agendar cita</a>
    <div class="stack" style="width:100%;margin-top:14px">
      <a class="row-link dark" href="#tarjeta">${I.spark('#C9A27E', 22)}<span class="grow">Mi tarjeta Club Cereza</span><span class="script" style="color:#C9A27E;font-size:17px">cerezas</span></a>
      <a class="row-link" href="#servicios">${I.nail()}<span class="grow">Servicios y precios</span><span aria-hidden="true">›</span></a>
      <a class="row-link" href="#trabajos">${I.photo}<span class="grow">Trabajos que hemos hecho</span><span aria-hidden="true">›</span></a>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        ${waUrl ? `<a class="row-link" href="${waUrl}" target="_blank" rel="noopener" style="justify-content:center">${I.wa()} WhatsApp</a>` : ''}
        ${i.maps_url ? `<a class="row-link" href="${esc(i.maps_url)}" target="_blank" rel="noopener" style="justify-content:center">${I.map} Cómo llegar</a>` : ''}
      </div>
    </div>
    <div class="spacer"></div>
    <div class="center" style="margin-top:28px;display:flex;flex-direction:column;gap:6px;align-items:center">
      <p class="script" style="margin:0;font-size:20px">tu momento, tus uñas</p>
      ${i.address ? `<p class="small muted" style="margin:0">${esc(i.address)}</p>` : ''}
      <p class="small muted" style="margin:0">
        ${i.instagram ? `<a href="https://instagram.com/${esc(i.instagram.replace('@', ''))}" target="_blank" rel="noopener">@${esc(i.instagram.replace('@', ''))}</a>` : ''}
        ${i.tiktok ? ` · <a href="https://tiktok.com/@${esc(i.tiktok.replace('@', ''))}" target="_blank" rel="noopener">TikTok</a>` : ''}
      </p>
      <a class="small" href="#privacidad" style="color:#5C2A30">Aviso de privacidad</a>
    </div>
  </section>`);
}

function servicios(cat = 'unas') {
  if (!CATS.find(c => c.id === cat)) cat = 'unas';
  const c = CATS.find(x => x.id === cat);
  const list = S.services.filter(s => s.cat === cat);
  render(`${top()}
  <section class="wrap section">
    <div><h1 class="h1">Servicios</h1><p class="sub">y precios</p></div>
    <div class="tabs" role="tablist">${CATS.map(x => `<button type="button" role="tab" aria-selected="${x.id === cat}" data-cat="${x.id}">${x.label}</button>`).join('')}</div>
    <div class="stack">
      ${list.map(s => `
      <a class="card svc" href="#agendar/${s.id}">
        <span class="svc-ic">${c.icon()}</span>
        <span class="grow">
          <p class="svc-name">${esc(s.name)}</p>
          ${s.description ? `<p class="svc-desc">${esc(s.description)}</p>` : ''}
          ${s.touch_allowed ? `<p class="svc-desc">Retoque (dentro de ${s.touch_days} días): ${money(s.touch_price)}</p>` : ''}
          <p class="svc-desc">${durLabel(s.duration_min)} aprox.</p>
        </span>
        <p class="svc-price num">${money(s.price)}</p>
      </a>`).join('') || '<p class="muted">Pronto agregamos servicios aquí.</p>'}
    </div>
    <p class="small muted center">Toca un servicio para agendarlo.</p>
  </section>`);
  view.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#servicios/' + b.dataset.cat); servicios(b.dataset.cat); }));
}

async function agendar(serviceId) {
  if (serviceId && svc(serviceId)) { S.b.serviceId = Number(serviceId); S.b.kind = 'full'; S.b.time = null; }
  const days = await api('/api/days').catch(() => []);
  if (!S.b.date || !days.find(d => d.date === S.b.date)) S.b.date = days[0] ? days[0].date : null;
  const s = svc(S.b.serviceId);
  const opts = CATS.map(c => `<optgroup label="${c.label}">${S.services.filter(x => x.cat === c.id).map(x => `<option value="${x.id}" ${s && s.id === x.id ? 'selected' : ''}>${esc(x.name)} · ${money(x.price)}</option>`).join('')}</optgroup>`).join('');
  render(`${top('#inicio', '<p class="eyebrow">Paso 1 de 2</p>')}
  <section class="wrap section">
    <div><h1 class="h1">Agenda tu cita</h1><p class="sub">elige servicio, día y hora</p></div>
    <div class="field">
      <label for="svc">Servicio</label>
      <select id="svc" class="input"><option value="">Elige un servicio…</option>${opts}</select>
    </div>
    <div id="kind"></div>
    <div>
      <p style="margin:0 0 8px;font-weight:600;font-size:15px">Día</p>
      <div class="days" id="days">${days.map(d => `<button type="button" class="day" data-date="${d.date}" aria-pressed="${d.date === S.b.date}" aria-label="${esc(d.label)}"><small>${d.dow}</small><b>${d.num}</b></button>`).join('') || '<p class="muted">No hay días disponibles.</p>'}</div>
      <p class="small muted" id="daylabel" style="margin:6px 0 0"></p>
    </div>
    <div>
      <p style="margin:0 0 8px;font-weight:600;font-size:15px">Horarios disponibles</p>
      <div id="slots"><p class="small muted">Elige un servicio para ver horarios.</p></div>
      <p class="small muted" style="margin:10px 0 0">Horario: ${esc(S.info?.open_time || '10:00')} a ${esc(S.info?.last_start || '19:00')}. Tachado = ocupado.</p>
    </div>
    <div class="note" style="display:flex;align-items:center;gap:10px">
      <div class="grow"><b style="font-weight:500">¿Necesitas otra hora?</b><br><span class="muted">Antes de las ${esc(S.info?.open_time || '10:00')} o después de las ${esc(S.info?.last_start || '19:00')}</span></div>
      <a class="btn dark sm" href="#especial">Solicitar</a>
      ${wa('Hola Sophia, ¿tendrás espacio en un horario especial? 🍒') ? `<a class="iconbtn" style="background:#FBF7F2" target="_blank" rel="noopener" aria-label="Preguntar por WhatsApp" href="${wa('Hola Sophia, ¿tendrás espacio en un horario especial? 🍒')}">${I.wa()}</a>` : ''}
    </div>
    <div class="sticky-cta"><button type="button" class="btn" id="go" disabled>Continuar</button></div>
  </section>`);

  const kindEl = $('#kind'), slotsEl = $('#slots'), go = $('#go');
  const paintKind = () => {
    const x = svc(S.b.serviceId);
    if (!x || !x.touch_allowed) { kindEl.innerHTML = ''; S.b.kind = 'full'; return; }
    kindEl.innerHTML = `<div class="seg">
      <button type="button" data-k="full" aria-pressed="${S.b.kind === 'full'}">Completo · ${money(x.price)}</button>
      <button type="button" data-k="touch" aria-pressed="${S.b.kind === 'touch'}">Retoque · ${money(x.touch_price)}</button></div>
      ${S.b.kind === 'touch' ? `<p class="small muted" style="margin:8px 0 0">Aplica si tu último servicio de ${x.cat === 'pestanas' ? 'pestañas' : 'este tipo'} fue hace ${x.touch_days} días o menos. Lo revisamos con tu celular.</p>` : ''}`;
    kindEl.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { S.b.kind = b.dataset.k; paintKind(); paintGo(); }));
  };
  const paintGo = () => {
    const x = svc(S.b.serviceId);
    go.disabled = !(x && S.b.date && S.b.time);
    const d = days.find(z => z.date === S.b.date);
    go.textContent = go.disabled ? 'Continuar' : `Continuar · ${d ? d.dow + ' ' + d.num : ''}, ${S.b.time}`;
    $('#daylabel').textContent = d ? d.label : '';
  };
  const loadSlots = async () => {
    const x = svc(S.b.serviceId);
    if (!x || !S.b.date) { slotsEl.innerHTML = '<p class="small muted">Elige un servicio para ver horarios.</p>'; paintGo(); return; }
    slotsEl.innerHTML = '<p class="small muted">Buscando horarios…</p>';
    try {
      const r = await api(`/api/slots?service=${x.id}&date=${S.b.date}`);
      const free = r.slots.filter(z => !z.busy);
      if (S.b.time && !free.find(z => z.t === S.b.time)) S.b.time = null;
      slotsEl.innerHTML = r.slots.length
        ? `<div class="slots">${r.slots.map(z => `<button type="button" class="slot" data-t="${z.t}" ${z.busy ? 'disabled' : ''} aria-pressed="${z.t === S.b.time}">${z.t}</button>`).join('')}</div>`
          + (free.length ? '' : '<p class="small muted" style="margin:8px 0 0">Este día ya está lleno. Prueba otro día o solicita un horario especial.</p>')
        : '<p class="small muted">Ese día no hay citas.</p>';
      slotsEl.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
        S.b.time = b.dataset.t;
        slotsEl.querySelectorAll('[data-t]').forEach(y => y.setAttribute('aria-pressed', y.dataset.t === S.b.time));
        paintGo();
      }));
    } catch (e) { errorBox(slotsEl, e.message); }
    paintGo();
  };
  $('#svc').addEventListener('change', e => { S.b.serviceId = Number(e.target.value) || null; S.b.kind = 'full'; S.b.time = null; paintKind(); loadSlots(); });
  $('#days').addEventListener('click', e => {
    const b = e.target.closest('[data-date]'); if (!b) return;
    S.b.date = b.dataset.date; S.b.time = null;
    $('#days').querySelectorAll('[data-date]').forEach(y => y.setAttribute('aria-pressed', y.dataset.date === S.b.date));
    loadSlots();
  });
  go.addEventListener('click', () => { location.hash = 'datos'; });
  paintKind(); loadSlots();
  const sel = $('#days [aria-pressed="true"]'); if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
}

async function datos() {
  const s = svc(S.b.serviceId);
  if (!s || !S.b.date || !S.b.time) { location.hash = 'agendar'; return; }
  const me = await loadMe();
  const days = await api('/api/days').catch(() => []);
  const d = days.find(z => z.date === S.b.date);
  const price = S.b.kind === 'touch' ? s.touch_price : s.price;
  render(`${top('#agendar', '<p class="eyebrow">Paso 2 de 2</p>')}
  <section class="wrap section">
    <div><h1 class="h1">Tus datos</h1><p class="sub">ya casi está</p></div>
    <div class="dark-card" style="display:flex;gap:14px;align-items:center">
      <div style="width:56px;height:62px;border-radius:14px;background:#8C2F39;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0"><small style="font-size:11px;letter-spacing:.14em;text-transform:uppercase">${d ? d.dow : ''}</small><b class="num" style="font-size:24px;line-height:1">${d ? d.num : ''}</b></div>
      <div><p style="margin:0;font-weight:500;font-size:17px">${esc(s.name)}</p>
      <p style="margin:2px 0 0;font-size:14px;color:#E5C1B8">${esc(d ? d.label : S.b.date)} · ${S.b.time}</p>
      <p style="margin:2px 0 0;font-size:14px;color:#C9A27E">${S.b.kind === 'touch' ? 'Retoque' : 'Servicio completo'} · ${money(price)} · ${durLabel(s.duration_min)} aprox.</p></div>
    </div>
    <form id="f" class="stack" novalidate>
      <div class="field"><label for="name">Nombre</label><input id="name" class="input" autocomplete="name" required value="${esc(me ? me.name : '')}" placeholder="¿Cómo te llamas?"></div>
      <div class="field"><label for="phone">Celular (WhatsApp)</label><input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel" required placeholder="442 000 0000" ${me ? 'readonly' : ''} value="${me ? '' : ''}">
        ${me ? `<p class="small muted" style="margin:0">Agendando como ${esc(me.name)} (${esc(me.phone)}). <a href="#" id="notme">¿No eres tú?</a></p>` : ''}</div>
      ${me ? '' : `<div class="field"><label for="pin">PIN de 4 números</label><input id="pin" class="input pin" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••">
        <p class="small muted" style="margin:0">Primera vez: crea tu PIN, con él entras a tu tarjeta. ¿Ya tienes uno? Escríbelo.</p></div>`}
      <div class="field"><label for="notes">Notas para Sophia <span class="muted" style="font-weight:400">(opcional)</span></label><textarea id="notes" class="input" rows="2" maxlength="300" placeholder="Idea de diseño, forma, largo…"></textarea></div>
      <label class="check"><input type="checkbox" id="ok" required> <span>Acepto el <a href="#privacidad" target="_blank">aviso de privacidad</a>${S.info?.cancel_hours ? ` y avisar con ${esc(S.info.cancel_hours)} horas si necesito cancelar` : ''}.</span></label>
      <div id="err"></div>
      <button class="btn" type="submit" id="send">Confirmar cita</button>
    </form>
  </section>`);
  if (me) {
    const phoneEl = $('#phone'); phoneEl.value = me.phone; phoneEl.type = 'text';
    $('#notme').addEventListener('click', async e => { e.preventDefault(); await api('/api/logout', { body: {} }); S.me = null; datos(); });
  }
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#err'); errorBox(err, '');
    if (!$('#ok').checked) return errorBox(err, 'Para agendar necesitas aceptar el aviso de privacidad.');
    const btn = $('#send'); btn.disabled = true; btn.textContent = 'Agendando…';
    try {
      const r = await api('/api/bookings', { body: {
        service_id: s.id, kind: S.b.kind, date: S.b.date, time: S.b.time,
        name: $('#name').value, phone: me ? '' : $('#phone').value,
        pin: me ? undefined : $('#pin').value, notes: $('#notes').value
      } });
      S.last = r.booking; S.b.time = null;
      if (r.logged_in) await loadMe(true);
      location.hash = 'confirmada';
    } catch (ex) {
      errorBox(err, ex.message); btn.disabled = false; btn.textContent = 'Confirmar cita';
    }
  });
}

function icsFor(b) {
  const pad = n => String(n).padStart(2, '0');
  const toUtc = (date, hhmm) => { const d = new Date(`${date}T${hhmm}:00-06:00`); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; };
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Noah Beauty Studio//ES', 'BEGIN:VEVENT',
    `UID:noah-${b.id}@noahbeautystudio`, `DTSTAMP:${toUtc(b.date, '00:00')}`, `DTSTART:${toUtc(b.date, b.start)}`, `DTEND:${toUtc(b.date, b.end)}`,
    `SUMMARY:Noah Beauty Studio · ${b.service}`, `LOCATION:${(S.info?.address || '').replace(/,/g, '\\,')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Tu cita en Noah', 'TRIGGER:-PT2H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return URL.createObjectURL(new Blob([txt], { type: 'text/calendar' }));
}

function confirmada() {
  const b = S.last;
  if (!b) { location.hash = 'inicio'; return; }
  const waUrl = wa(`Hola Sophia 🍒 Acabo de agendar ${b.service} el ${b.date_label} a las ${b.start}.`);
  render(`<section class="wrap" style="background:#3B1219;color:#F3EBE3;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding-top:64px;padding-bottom:28px;position:relative">
    <span style="position:absolute;left:40px;top:56px">${I.spark('#C9A27E', 26)}</span>
    <span style="position:absolute;right:50px;top:116px">${I.spark('#E5C1B8', 16)}</span>
    ${I.cherries(120).replace(/#3B1219/g, '#F3EBE3')}
    <h1 class="h1" style="margin-top:20px;font-size:40px;text-align:center">¡Te esperamos!</h1>
    <p class="sub" style="color:#C9A27E;font-size:24px">tu cita quedó apartada</p>
    <div style="margin-top:26px;width:100%;background:#4A1C24;border-radius:20px;padding:18px 20px;display:flex;flex-direction:column;gap:10px">
      <div class="kv"><span>Servicio</span><span>${esc(b.service)}${b.kind === 'touch' ? ' (retoque)' : ''}</span></div>
      <div class="kv"><span>Cuándo</span><span>${esc(b.date_label)} · ${b.start}</span></div>
      <div class="kv"><span>Precio</span><span>${b.price_label}</span></div>
      ${S.info?.address ? `<div class="kv"><span>Dónde</span><span style="text-align:right">${esc(S.info.address)}</span></div>` : ''}
      <div style="height:1px;background:#6B3A42"></div>
      <p style="margin:0;font-size:14px;display:flex;align-items:center;gap:8px">${I.spark('#C9A27E', 16)} Al terminar tu cita sumas ${b.kind === 'touch' ? '½ cereza' : '1 cereza'}</p>
    </div>
    <div class="stack" style="width:100%;margin-top:18px">
      ${waUrl ? `<a class="btn light" href="${waUrl}" target="_blank" rel="noopener">${I.wa()} Avisarle a Sophia por WhatsApp</a>` : ''}
      <a class="btn ghost" style="color:#F3EBE3;border-color:#8C5A62" href="${icsFor(b)}" download="cita-noah.ics">${I.cal} Agregar a mi calendario</a>
    </div>
    <div class="spacer"></div>
    <div class="center stack" style="margin-top:24px">
      <a href="#tarjeta" style="color:#C9A27E">Ver mi tarjeta de cerezas</a>
      <a href="#inicio" style="color:#E5C1B8;font-size:14px">Volver al inicio</a>
    </div>
  </section>`);
}

function especial() {
  const opts = CATS.map(c => `<optgroup label="${c.label}">${S.services.filter(x => x.cat === c.id).map(x => `<option value="${x.id}" ${S.b.serviceId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
  const waUrl = wa('Hola Sophia, ¿tendrás espacio en un horario especial? 🍒');
  render(`${top('#agendar', '<p class="eyebrow">Horario especial</p>')}
  <section class="wrap section">
    <div><h1 class="h1">¿Necesitas otro horario?</h1>
    <p class="muted" style="margin:8px 0 0;line-height:1.5">Nuestro horario es de ${esc(S.info?.open_time || '10:00')} a ${esc(S.info?.last_start || '19:00')}. Si necesitas otra hora, mándale tu solicitud a Sophia y ella te confirma por WhatsApp.</p></div>
    <form id="f" class="stack" novalidate>
      <div class="field"><label for="svc">Servicio</label><select id="svc" class="input">${opts}</select></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
        <div class="field"><label for="date">Día</label><input id="date" class="input" type="date" required></div>
        <div class="field"><label for="time">Hora que necesitas</label><input id="time" class="input" type="time" required value="20:00"></div>
      </div>
      <div class="field"><label for="name">Nombre</label><input id="name" class="input" autocomplete="name" required value="${esc(S.me ? S.me.name : '')}"></div>
      <div class="field"><label for="phone">Celular (WhatsApp)</label><input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel" required placeholder="442 000 0000"></div>
      <div class="field"><label for="reason">Motivo <span class="muted" style="font-weight:400">(opcional)</span></label><textarea id="reason" class="input" rows="2" maxlength="200" placeholder="Ej. salgo tarde del trabajo, es para una boda…"></textarea></div>
      <p class="small muted" style="margin:0;display:flex;gap:8px">${I.spark('#C9A27E', 16)} El horario especial puede tener un costo extra; Sophia te lo confirma junto con tu cita.</p>
      <div id="err"></div>
      <button class="btn" type="submit" id="send">Enviar solicitud a Sophia</button>
      ${waUrl ? `<a class="btn ghost" href="${waUrl}" target="_blank" rel="noopener">${I.wa()} Mejor le pregunto por WhatsApp</a>` : ''}
    </form>
  </section>`);
  const dateEl = $('#date');
  const t = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);
  dateEl.min = t; dateEl.value = S.b.date || t;
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#err'); errorBox(err, '');
    const btn = $('#send'); btn.disabled = true;
    try {
      const r = await api('/api/requests', { body: { service_id: $('#svc').value, date: dateEl.value, time: $('#time').value, name: $('#name').value, phone: $('#phone').value, reason: $('#reason').value } });
      render(`${top('#inicio', '<p class="eyebrow">Horario especial</p>')}
      <section class="wrap section center" style="align-items:center;padding-top:40px">
        <div style="width:96px;height:96px;border-radius:50%;background:#F3EBE3;display:flex;align-items:center;justify-content:center;margin:0 auto">${I.cal.replace('currentColor', '#8C2F39')}</div>
        <h1 class="h1">Solicitud enviada</h1><p class="sub" style="margin-top:-8px">Sophia te confirma por WhatsApp</p>
        <div class="note" style="text-align:left;width:100%"><div class="kv"><span class="muted">Pediste</span><span>${esc(r.date_label)} · ${esc(r.time)}</span></div>
        <div class="kv" style="margin-top:6px"><span class="muted">Estado</span><span style="color:#8C2F39;font-weight:500">Esperando a Sophia</span></div></div>
        <p class="small muted">Si a esa hora no se puede, Sophia te propone otra. Tu cita se confirma cuando ella la acepte.</p>
        <a href="#inicio">Volver al inicio</a>
      </section>`);
    } catch (ex) { errorBox(err, ex.message); btn.disabled = false; }
  });
}

async function tarjeta() {
  const me = await loadMe(true);
  if (!me) return acceso();
  const c = me.card, n = c.balance, pct = c.discount_pct;
  const labels = { 3: 'Diseño 2 uñas', 6: 'Retiro o upgrade', 10: 'Descuento' };
  const cells = Array.from({ length: 10 }, (_, k) => {
    const i = k + 1, full = i <= n, halfC = !full && i - .5 <= n, mile = !!labels[i];
    const inner = full ? I.cherry(30, '#F3EBE3') : halfC ? I.halfCherry(30) : `<span>${i === 10 ? pct + '%' : i}</span>`;
    return `<div class="ch"><div class="ring ${full ? 'full' : ''} ${mile ? 'mile' : ''}" ${halfC ? 'style="border:0"' : ''}>${inner}</div><span class="lbl">${labels[i] || ''}</span></div>`;
  }).join('');
  const next = c.next;
  const left = next ? next.at - n : 0;
  const progress = !next ? `¡Completaste tu tarjeta! Tu ${pct}% de descuento te espera.`
    : `Llevas ${half(n)} de 10. Te ${left === 1 ? 'falta 1 cereza' : 'faltan ' + half(left) + ' cerezas'} para ${next.at === 10 ? 'tu ' + pct + '% de descuento' : next.label.toLowerCase()}.`;
  const ready = c.rewards.filter(r => r.reached && !r.redeemed);
  const exp = c.next_expiry ? new Date(c.next_expiry).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : null;
  render(`${top('#inicio', '<p class="eyebrow">Mi tarjeta</p>')}
  <section class="wrap section">
    <div class="note" style="display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px">
      <span class="grow">${esc(me.name)} · ${esc(me.phone)}</span>
      <button type="button" class="btn ghost sm" id="out" style="border:0">Salir</button>
    </div>
    <div class="dark-card">
      <span style="position:absolute;right:-14px;top:-14px">${I.spark('#8C2F39', 92)}</span>
      <p class="eyebrow" style="color:#C9A27E;font-size:11px;letter-spacing:.3em">Noah Beauty Studio</p>
      <p class="h1" style="font-size:32px;margin-top:6px">Club Cereza</p>
      <p class="sub" style="color:#E5C1B8;font-size:20px">hola, ${esc(me.name.split(' ')[0])}</p>
      <div class="cherries">${cells}</div>
      <div class="progress">${I.spark('#C9A27E', 18)}<span>${progress}</span></div>
      ${ready.length ? `<p style="margin:10px 0 0;font-size:14px;color:#E5C1B8">Tienes listo: <b style="color:#F3EBE3">${ready.map(r => esc(r.label)).join(', ')}</b>. Pídeselo a Sophia en tu próxima cita.</p>` : ''}
    </div>
    ${me.upcoming.length ? `<div class="stack"><p style="margin:0;font-weight:600">Tus próximas citas</p>${me.upcoming.map(b => `<div class="card" style="display:flex;justify-content:space-between;gap:10px"><span><b style="font-weight:500">${esc(b.service)}</b><br><span class="small muted">${esc(b.date_label)} · ${b.start}</span></span><span class="num">${b.price_label}</span></div>`).join('')}</div>` : ''}
    <div class="stack">
      <p class="sub" style="margin:0">cómo sumas cerezas</p>
      <div class="rules">
        <div class="rule"><b style="background:#8C2F39;color:#FBF7F2">1</b>Cada servicio</div>
        <div class="rule"><b style="background:#E5C1B8">½</b>Cada retoque</div>
        <div class="rule"><b style="background:#C9A27E">+1</b>Trae a una amiga (las dos)</div>
        <div class="rule"><b style="background:#3B1219;color:#F3EBE3">+1</b>En tu mes de cumpleaños</div>
      </div>
      <p class="small muted" style="margin:0">Premios: 3 cerezas, diseño en 2 uñas · 6 cerezas, retiro o upgrade · 10 cerezas, ${pct}% en el servicio de una visita, el que elijas. Cada cereza vence a los ${S.info?.cherry_months || 6} meses${exp ? `; la más próxima vence el ${exp}` : ''}.</p>
    </div>
    <a class="btn" href="#agendar">Agendar y sumar cereza</a>
  </section>`);
  $('#out').addEventListener('click', async () => { await api('/api/logout', { body: {} }); S.me = null; acceso(); });
}

function acceso() {
  render(`${top('#inicio', '<p class="eyebrow">Club Cereza</p>')}
  <section class="wrap section">
    <div class="center" style="padding-top:18px">${I.cherries(96)}
      <h1 class="h1" style="margin-top:12px">Mi tarjeta</h1><p class="sub">entra con tu celular y tu PIN</p></div>
    <form id="f" class="stack" novalidate>
      <div class="field"><label for="phone">Celular</label><input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="442 000 0000" required></div>
      <div class="field"><label for="pin">PIN de 4 números</label><input id="pin" class="input pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••" required></div>
      <label class="check"><input type="checkbox" id="rem" checked> <span>Recordarme en este celular</span></label>
      <div id="err"></div>
      <button class="btn" type="submit" id="send">Ver mis cerezas</button>
    </form>
    <div class="note">
      <p style="margin:0"><b style="font-weight:600">¿Primera vez?</b> Tu PIN lo creas al agendar tu primera cita.</p>
      <p style="margin:6px 0 0"><b style="font-weight:600">¿Olvidaste tu PIN?</b> Sophia te lo cambia en tu siguiente visita${wa('Hola Sophia, olvidé mi PIN del Club Cereza 🍒') ? ` o por <a target="_blank" rel="noopener" href="${wa('Hola Sophia, olvidé mi PIN del Club Cereza 🍒')}">WhatsApp</a>` : ''}.</p>
    </div>
  </section>`);
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#err'); errorBox(err, '');
    const btn = $('#send'); btn.disabled = true;
    try {
      await api('/api/login', { body: { phone: $('#phone').value, pin: $('#pin').value, remember: $('#rem').checked } });
      await tarjeta();
    } catch (ex) { errorBox(err, ex.message); btn.disabled = false; }
  });
}

async function trabajos(cat = 'todos') {
  const photos = await api('/api/photos').catch(() => []);
  const list = photos.filter(p => cat === 'todos' || p.cat === cat);
  const chip = (id, l) => `<button type="button" data-f="${id}" aria-pressed="${cat === id}">${l}</button>`;
  render(`${top()}
  <section class="wrap section">
    <div><h1 class="h1">Trabajos</h1><p class="sub">inspírate para tu cita</p></div>
    <div class="chips">${chip('todos', 'Todos')}${chip('unas', 'Uñas')}${chip('pestanas', 'Pestañas')}${chip('cejas', 'Cejas')}</div>
    ${list.length ? `<div class="gallery">${list.map(p => `<figure><img src="/uploads/${encodeURIComponent(p.file)}" alt="${esc(p.tag || 'Trabajo de Noah Beauty Studio')}" loading="lazy">${p.tag ? `<figcaption>${esc(p.tag)}</figcaption>` : ''}</figure>`).join('')}</div>`
      : `<div class="note center" style="padding:28px 16px">${I.nail('#8C2F39', 18)}<p style="margin:10px 0 0">Muy pronto subimos fotos de nuestros trabajos.</p></div>`}
    <a class="btn" href="#agendar">Quiero uno así · Agendar</a>
  </section>`);
  view.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => trabajos(b.dataset.f)));
}

function privacidad() {
  const i = S.info || {};
  const who = i.owner_name ? esc(i.owner_name) : 'la responsable de Noah Beauty Studio';
  render(`${top()}
  <section class="wrap section" style="line-height:1.6;font-size:15px">
    <h1 class="h1" style="font-size:30px">Aviso de privacidad</h1>
    <p><b>${who}</b>, responsable de Noah Beauty Studio${i.address ? `, con domicilio en ${esc(i.address)}` : ''}, usa tus datos personales (nombre y celular, y las notas que escribas) para agendar y recordarte tus citas, llevar tu tarjeta Club Cereza y contactarte por WhatsApp sobre tus servicios.</p>
    <p>No vendemos ni compartimos tus datos con nadie. Solo los usamos para darte el servicio y los guardamos mientras seas clienta.</p>
    <p>Puedes pedir ver, corregir o borrar tus datos, o dejar de recibir mensajes, escribiendo ${i.owner_email ? `a <b>${esc(i.owner_email)}</b>` : 'a Sophia'}${i.whatsapp ? ' o por WhatsApp' : ''}.</p>
    <p class="small muted">Este aviso puede cambiar; la versión vigente siempre estará en esta página.</p>
  </section>`);
}

const ROUTES = { inicio, servicios, agendar, datos, confirmada, especial, tarjeta, trabajos, privacidad };
function route() {
  const [name, arg] = location.hash.replace(/^#/, '').split('/');
  const fn = ROUTES[name] || inicio;
  window.scrollTo(0, 0);
  Promise.resolve(fn(arg)).catch(e => render(`<section class="wrap section"><div class="error">${esc(e.message)}</div><a class="btn" href="#inicio">Volver al inicio</a></section>`));
}

(async () => {
  try {
    [S.info, S.services] = await Promise.all([api('/api/info'), api('/api/services')]);
  } catch (e) {
    render('<section class="wrap section"><div class="error">No pudimos cargar la página. Revisa tu conexión e intenta de nuevo.</div></section>');
    return;
  }
  if (S.info.env && S.info.env !== 'prod') $('#envbar').hidden = false;
  window.addEventListener('hashchange', route);
  route();
})();
})();
