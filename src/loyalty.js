// Club Cereza: 10 cerezas. 1 por servicio, ½ por retoque, +1 por amiga referida y +1 en el mes de cumpleaños.
// Premios: 3 = diseño en 2 uñas · 6 = retiro o upgrade · 10 = descuento (% en settings) en el servicio de una visita.
// Cada cereza vence a los N meses (settings.cherry_months) de haberla ganado.
const { db, settings } = require('./db');
const { isoPlusMonths } = require('./time');

const MILESTONES = [
  { at: 3, label: 'Diseño en 2 uñas' },
  { at: 6, label: 'Retiro o upgrade' },
  { at: 10, label: null } // descuento; la etiqueta se arma con el % actual
];

function milestoneLabel(at) {
  if (at === 10) return `${settings.get('discount_pct')}% de descuento en un servicio`;
  return MILESTONES.find(m => m.at === at).label;
}

const qBalance = db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM cherries WHERE client_id = ? AND used = 0 AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')");
const qList = db.prepare("SELECT id, amount, reason, created_at, expires_at FROM cherries WHERE client_id = ? AND used = 0 AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') ORDER BY created_at");
const qRewards = db.prepare('SELECT milestone, redeemed_at FROM rewards WHERE client_id = ? AND cycle = ?');
const insCherry = db.prepare('INSERT INTO cherries (client_id, amount, reason, booking_id, expires_at) VALUES (?, ?, ?, ?, ?)');

function addCherry(clientId, amount, reason, bookingId = null) {
  const months = Number(settings.get('cherry_months')) || 6;
  insCherry.run(clientId, amount, reason, bookingId, isoPlusMonths(months));
}

function card(client) {
  const balance = Math.min(10, qBalance.get(client.id).n);
  const redeemed = new Set(qRewards.all(client.id, client.cycle).map(r => r.milestone));
  const rewards = MILESTONES.map(m => ({
    at: m.at, label: milestoneLabel(m.at),
    reached: balance >= m.at, redeemed: redeemed.has(m.at)
  }));
  const next = rewards.find(r => r.at > balance) || null;
  const list = qList.all(client.id);
  const soonest = list.length ? list[0].expires_at : null;
  return { balance, rewards, next, cherries: list, next_expiry: soonest, discount_pct: Number(settings.get('discount_pct')) };
}

const redeemTx = db.transaction((client, at) => {
  db.prepare('INSERT INTO rewards (client_id, cycle, milestone) VALUES (?, ?, ?)').run(client.id, client.cycle, at);
  if (at === 10) {
    db.prepare('UPDATE cherries SET used = 1 WHERE client_id = ? AND used = 0').run(client.id);
    db.prepare('UPDATE clients SET cycle = cycle + 1 WHERE id = ?').run(client.id);
  }
});
function redeem(client, at) {
  const c = card(client);
  const r = c.rewards.find(x => x.at === at);
  if (!r) throw new Error('Ese premio no existe.');
  if (!r.reached) throw new Error(`Aún no llega a ${at} cerezas.`);
  if (r.redeemed) throw new Error('Ese premio ya se usó en esta tarjeta.');
  redeemTx(client, at);
}

module.exports = { addCherry, card, redeem, MILESTONES };
