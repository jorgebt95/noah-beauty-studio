// Lista de precios de Sophia (nov 2026). Las duraciones son provisionales hasta que ella las confirme
// en su panel (Servicios). Pestañas: retoque a mitad de precio dentro de 15 días.
const U = (name, price, extra = {}) => ({ cat: 'unas', name, price, duration_min: 60, ...extra });
const P = (name, price) => ({ cat: 'pestanas', name, price, duration_min: 120, touch_allowed: 1, touch_price: Math.round(price / 2), touch_days: 15 });
const C = (name, price, extra = {}) => ({ cat: 'cejas', name, price, duration_min: 45, ...extra });
const D = (name, price) => ({ cat: 'depilacion', name, price, duration_min: 15 });

const SERVICES = [
  U('Pedicure completo (Spa)', 500, { duration_min: 90, description: 'Sales, masaje, limpieza, limado, mascarilla y gel' }),
  U('Pedicure Express', 250, { description: 'Limpieza, limado, hidratación y gel (1 tono)' }),
  U('Pedicure Spa (sin gel)', 350, { duration_min: 75 }),
  U('Acripie en tono liso', 450, { duration_min: 90 }),
  U('Aplicación de Gelish', 200),
  U('Gelish tono liso manos', 150),
  U('Retiro de Gelish', 80, { duration_min: 30 }),
  U('Uñas acrílicas #1', 400, { duration_min: 120 }),
  U('Aplicación de acrílico', 450, { duration_min: 120 }),
  U('Retoque de acrílico', 300, { duration_min: 90, is_touch: 1, description: 'Dentro de 30 días de tu aplicación; después se cobra como servicio completo' }),
  U('Soft gel #1 liso', 300, { duration_min: 90 }),
  U('Rubber (nivelación) y color extra', 300),
  U('Retiro de acrílico nuestro', 100, { duration_min: 30 }),
  U('Retiro de acrílico de otro salón', 150, { duration_min: 45 }),
  U('Sólo retiro, sin ningún otro servicio', 180, { duration_min: 45 }),

  P('Clásicas', 650), P('Efecto Aura', 680), P('Híbridas', 750), P('Hawaianas', 700),
  P('Volumen Egipcio', 680), P('Volumen Árabe', 700), P('Volumen Griego', 700),
  P('Efecto Foxy Eyes', 750), P('Efecto LU', 750), P('Efecto Anime', 800),
  P('Volumen Ruso', 900), P('Volumen Artesanal', 1050), P('Mega Volumen', 1500),

  C('Laminado de ceja + depilación', 400, { duration_min: 60 }),
  C('Laminado de ceja', 300, { duration_min: 60 }),
  C('Diseño de cejas', 180, { duration_min: 30 }),
  C('Depilación de ceja (sin diseño)', 130, { duration_min: 20 }),
  C('Diseño + henna', 300),
  C('Retoque de henna (15 días)', 550, { is_touch: 1 }),
  C('Laminado + henna + diseño', 600, { duration_min: 75, description: 'Incluye botox de ceja' }),

  D('Bozo', 80), D('Mentón', 80), D('Patillas', 100), D('Frente', 80),
  D('Mejillas', 100), D('Nariz', 80), D('Rostro completo', 350)
];

module.exports = { SERVICES };
