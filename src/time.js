// Hora de Querétaro / Ciudad de México: UTC-6 todo el año (sin horario de verano desde 2022).
const OFFSET_MIN = -6 * 60;
const TZ_SUFFIX = '-06:00';

function nowLocal() {
  return new Date(Date.now() + OFFSET_MIN * 60000);
}
function todayStr() {
  return nowLocal().toISOString().slice(0, 10);
}
function nowMinutes() {
  const d = nowLocal();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}
function toHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(dateStr) { // 0 = domingo
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
// Fecha+hora local -> Date (instante real)
function localToDate(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00${TZ_SUFFIX}`);
}
// Instante real -> {date, min} en hora local
function dateToLocal(d) {
  const l = new Date(d.getTime() + OFFSET_MIN * 60000);
  return { date: l.toISOString().slice(0, 10), min: l.getUTCHours() * 60 + l.getUTCMinutes() };
}
function isoPlusMonths(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function prettyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${DOW_LONG[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

module.exports = { todayStr, nowMinutes, toMin, toHHMM, addDays, weekday, daysBetween, localToDate, dateToLocal, isoPlusMonths, prettyDate, DOW, TZ_SUFFIX };
