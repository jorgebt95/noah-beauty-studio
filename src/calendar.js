// Conexión opcional con el calendario de iCloud de Sophia (CalDAV).
// Se activa con ICLOUD_USER, ICLOUD_APP_PASSWORD (contraseña de app de su Apple ID) y ICLOUD_CALENDAR (nombre del calendario).
// - Lee sus eventos para bloquear horarios ocupados.
// - Crea un evento por cada cita confirmada.
// Eventos de todo el día solo bloquean el día si su título dice "cerrado", "vacaciones", "descanso" o "no agendar".
const crypto = require('crypto');
const { dateToLocal, localToDate, addDays } = require('./time');

const USER = process.env.ICLOUD_USER;
const PASS = process.env.ICLOUD_APP_PASSWORD;
const CAL_NAME = process.env.ICLOUD_CALENDAR || '';
const BLOCK_ALL_DAY = /cerrad|vacacion|descanso|no agendar|no citas/i;

let clientPromise = null;
let calendarObj = null;
const cache = new Map(); // date -> {at, busy}

function enabled() { return !!(USER && PASS); }

async function getCalendar() {
  if (calendarObj) return calendarObj;
  const { createDAVClient } = await import('tsdav');
  if (!clientPromise) {
    clientPromise = createDAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: { username: USER, password: PASS },
      authMethod: 'Basic',
      defaultAccountType: 'caldav'
    });
  }
  const client = await clientPromise;
  const cals = await client.fetchCalendars();
  const pick = (CAL_NAME && cals.find(c => String(c.displayName || '').trim().toLowerCase() === CAL_NAME.trim().toLowerCase()))
    || cals.find(c => !c.components || c.components.includes('VEVENT'));
  if (!pick) throw new Error('No encontré un calendario de eventos en iCloud.');
  calendarObj = { client, calendar: pick };
  return calendarObj;
}

async function listCalendars() {
  const { client } = await getCalendar();
  const cals = await client.fetchCalendars();
  return cals.map(c => String(c.displayName || ''));
}

// Intervalos ocupados (minutos locales) de un día.
async function busy(date) {
  if (!enabled()) return [];
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < 60000) return hit.busy;
  const ical = require('node-ical');
  const { client, calendar } = await getCalendar();
  const dayStart = localToDate(date, '00:00');
  const dayEnd = localToDate(addDays(date, 1), '00:00');
  const objs = await client.fetchCalendarObjects({
    calendar, timeRange: { start: dayStart.toISOString(), end: dayEnd.toISOString() }
  });
  const out = [];
  for (const o of objs) {
    let parsed;
    try { parsed = ical.sync.parseICS(o.data || ''); } catch { continue; }
    for (const ev of Object.values(parsed)) {
      if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
      if (ev.transparency === 'TRANSPARENT') continue;
      const allDay = ev.datetype === 'date';
      if (allDay) {
        if (BLOCK_ALL_DAY.test(String(ev.summary || ''))) out.push({ start_min: 0, end_min: 24 * 60 });
        continue;
      }
      const dur = (ev.end ? ev.end - ev.start : 60 * 60000);
      let starts = [ev.start];
      if (ev.rrule) {
        try { starts = ev.rrule.between(new Date(dayStart - 86400000), dayEnd, true); } catch { starts = [ev.start]; }
        const ex = ev.exdate ? Object.values(ev.exdate).map(d => +d) : [];
        starts = starts.filter(s => !ex.includes(+s));
      }
      for (const s of starts) {
        const e = new Date(+s + dur);
        if (e <= dayStart || s >= dayEnd) continue;
        const a = +s < +dayStart ? 0 : dateToLocal(s).min;
        const b = +e > +dayEnd ? 24 * 60 : dateToLocal(e).min || 24 * 60;
        out.push({ start_min: a, end_min: b });
      }
    }
  }
  cache.set(date, { at: Date.now(), busy: out });
  return out;
}

const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

async function createEvent({ date, start, end, title, description }) {
  if (!enabled()) return null;
  const { client, calendar } = await getCalendar();
  const uid = crypto.randomUUID() + '@noahbeautystudio';
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Noah Beauty Studio//Citas//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(localToDate(date, start))}`,
    `DTEND:${utc(localToDate(date, end))}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-PT60M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const filename = uid.replace(/[^A-Za-z0-9-]/g, '') + '.ics';
  await client.createCalendarObject({ calendar, filename, iCalString: ics });
  cache.delete(date);
  return new URL(filename, calendar.url).href;
}

async function deleteEvent(url, date) {
  if (!enabled() || !url) return;
  const { client } = await getCalendar();
  await client.deleteCalendarObject({ calendarObject: { url, etag: '' } });
  if (date) cache.delete(date);
}

module.exports = { enabled, busy, createEvent, deleteEvent, listCalendars };
