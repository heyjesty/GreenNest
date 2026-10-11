const db = require('../config/db');

const FREE_SHIPPING_OVER = Number(process.env.FREE_SHIPPING_OVER || 50);
const SHIPPING_FEE = Number(process.env.SHIPPING_FEE || 5.99);
const MAX_QTY = 20;

// The cart lives in the (MySQL-backed) session as { productId: quantity }.
function getCart(session) {
  if (!session.cart) session.cart = {};
  return session.cart;
}

function cartCount(session) {
  return Object.values(session.cart || {}).reduce((sum, q) => sum + q, 0);
}

function setQty(session, productId, qty) {
  const cart = getCart(session);
  const q = Math.max(0, Math.min(MAX_QTY, parseInt(qty, 10) || 0));
  if (q === 0) delete cart[productId];
  else cart[productId] = q;
}

async function findCoupon(code) {
  if (!code) return null;
  return db.one(
    'SELECT code, percent FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)',
    [String(code).trim().toUpperCase()]
  );
}

/** Loads cart lines from the database and calculates totals. */
async function summary(session) {
  const cart = getCart(session);
  const ids = Object.keys(cart).map(Number).filter(Boolean);
  let lines = [];

  if (ids.length) {
    const rows = await db.query('SELECT id, name, slug, price, stock, image FROM products WHERE is_active = 1 AND id IN (?)', [ids]);
    lines = rows.map((p) => {
      const quantity = Math.min(cart[p.id], Math.max(p.stock, 0));
      return { ...p, quantity, requested: cart[p.id], lineTotal: +(p.price * quantity).toFixed(2) };
    });
    // Drop products that no longer exist or are out of stock.
    Object.keys(cart).forEach((id) => {
      const line = lines.find((l) => l.id === Number(id));
      if (!line || line.quantity === 0) delete cart[id];
      else cart[id] = line.quantity;
    });
    lines = lines.filter((l) => l.quantity > 0);
  }

  const subtotal = +lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(2);
  const coupon = await findCoupon(session.coupon);
  if (session.coupon && !coupon) delete session.coupon;
  const discount = coupon ? +(subtotal * coupon.percent / 100).toFixed(2) : 0;
  const shipping = subtotal === 0 || subtotal - discount >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  const total = +(subtotal - discount + shipping).toFixed(2);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  return { lines, count, subtotal, coupon, discount, shipping, total, freeShippingOver: FREE_SHIPPING_OVER };
}

module.exports = { getCart, cartCount, setQty, summary, findCoupon, MAX_QTY };
