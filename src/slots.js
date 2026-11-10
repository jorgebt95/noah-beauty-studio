const { db, settings } = require('./db');
const { todayStr, nowMinutes, toMin, toHHMM, addDays, weekday } = require('./time');
const calendar = require('./calendar');

const qDayBookings = db.prepare("SELECT start_min, end_min FROM bookings WHERE date = ? AND status IN ('confirmed','done')");

function openDays() {
  return settings.get('open_days').split(',').map(Number).filter(n => !Number.isNaN(n));
}

// Días que se pueden reservar (a partir de hoy)
function bookableDays() {
  const n = Number(settings.get('booking_window_days')) || 30;
  const open = openDays();
  const out = [];
  for (let i = 0; i <= n; i++) {
    const d = addDays(todayStr(), i);
    if (open.includes(weekday(d))) out.push(d);
  }
  return out;
}

const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

async function slotsFor(date, durationMin) {
  const open = openDays();
  if (!open.includes(weekday(date))) return { slots: [], calError: false };
  const startMin = toMin(settings.get('open_time'));
  const lastStart = toMin(settings.get('last_start'));
  const step = Number(settings.get('slot_step')) || 30;
  const lead = Number(settings.get('min_lead_min')) || 0;
  const today = todayStr();
  if (date < today) return { slots: [], calError: false };

  let busy = qDayBookings.all(date);
  let calError = false;
  try { busy = busy.concat(await calendar.busy(date)); } catch (e) { calError = true; console.error('[calendario]', e.message); }

  const out = [];
  for (let t = startMin; t <= lastStart; t += step) {
    const end = t + durationMin;
    let taken = busy.some(b => overlaps(t, end, b.start_min, b.end_min));
    if (date === today && t < nowMinutes() + lead) taken = true;
    out.push({ t: toHHMM(t), busy: taken });
  }
  return { slots: out, calError };
}

async function isFree(date, startMin, durationMin) {
  const r = await slotsFor(date, durationMin);
  const s = (r.slots || []).find(x => toMin(x.t) === startMin);
  return !!(s && !s.busy);
}

module.exports = { bookableDays, slotsFor, isFree, openDays };
