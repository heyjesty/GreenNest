const express = require('express');
const db = require('../config/db');
const cart = require('../lib/cart');
const { isEmail, orderNumber } = require('../lib/helpers');

const router = express.Router();
const wantsJson = (req) => (req.get('accept') || '').includes('application/json');

// ---------- Cart ----------
router.get('/', async (req, res) => {
  const summary = await cart.summary(req.session);
  res.locals.cartCount = summary.count;
  res.render('pages/cart', { title: 'Your Cart · GreenNest', summary });
});

router.post('/add', async (req, res) => {
  const id = parseInt(req.body.productId, 10);
  const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const product = id ? await db.one('SELECT id, name, stock FROM products WHERE id = ? AND is_active = 1', [id]) : null;

  let result;
  if (!product) {
    result = { ok: false, message: 'Sorry, that plant is no longer available.' };
  } else {
    const current = cart.getCart(req.session)[id] || 0;
    const next = Math.min(current + qty, product.stock, cart.MAX_QTY);
    if (product.stock < 1) result = { ok: false, message: `${product.name} is currently out of stock.` };
    else if (next === current) result = { ok: false, message: `You already have the maximum available quantity of ${product.name}.` };
    else {
      cart.setQty(req.session, id, next);
      result = { ok: true, message: `${product.name} added to your cart.` };
    }
  }
  result.count = cart.cartCount(req.session);

  if (wantsJson(req)) return res.status(result.ok ? 200 : 422).json(result);
  req.session.flash = { type: result.ok ? 'success' : 'error', message: result.message };
  res.redirect(req.body.redirect === 'cart' ? '/cart' : (req.get('referer') || '/cart'));
});

router.post('/update', (req, res) => {
  const items = req.body.qty || {};
  Object.entries(typeof items === 'object' ? items : {}).forEach(([id, q]) => cart.setQty(req.session, Number(id), q));
  if (req.body.remove) cart.setQty(req.session, Number(req.body.remove), 0);
  res.redirect('/cart');
});

router.post('/coupon', async (req, res) => {
  if (req.body.remove) {
    delete req.session.coupon;
    req.session.flash = { type: 'info', message: 'Coupon removed.' };
    return res.redirect('/cart');
  }
  const coupon = await cart.findCoupon(req.body.code);
  if (coupon) {
    req.session.coupon = coupon.code;
    req.session.flash = { type: 'success', message: `Coupon ${coupon.code} applied — ${coupon.percent}% off!` };
  } else {
    req.session.flash = { type: 'error', message: 'That coupon code is not valid.' };
  }
  res.redirect('/cart');
});

// ---------- Checkout ----------
router.get('/checkout', async (req, res) => {
  const summary = await cart.summary(req.session);
  if (!summary.lines.length) return res.redirect('/cart');
  const u = req.user || {};
  const last = req.user ? await db.one('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]) : null;
  const form = {
    name: u.name || '', email: u.email || '', phone: u.phone || last?.phone || '',
    address: last?.address || '', city: last?.city || '', state: last?.state || '', postal_code: last?.postal_code || '',
  };
  res.render('pages/checkout', { title: 'Checkout · GreenNest', summary, form, errors: {} });
});

router.post('/checkout', async (req, res) => {
  const summary = await cart.summary(req.session);
  if (!summary.lines.length) return res.redirect('/cart');

  const field = (k, max = 190) => String(req.body[k] || '').trim().slice(0, max);
  const form = {
    name: field('name', 100), email: field('email').toLowerCase(), phone: field('phone', 30),
    address: field('address', 255), city: field('city', 100), state: field('state', 100),
    postal_code: field('postal_code', 20), notes: field('notes', 500),
  };
  const errors = {};
  if (form.name.length < 2) errors.name = 'Please enter your full name.';
  if (!isEmail(form.email)) errors.email = 'Please enter a valid email.';
  if (!/^[0-9+\-\s()]{7,20}$/.test(form.phone)) errors.phone = 'Please enter a valid phone number.';
  if (form.address.length < 5) errors.address = 'Please enter your street address.';
  if (!form.city) errors.city = 'Required.';
  if (!form.state) errors.state = 'Required.';
  if (!form.postal_code) errors.postal_code = 'Required.';

  if (Object.keys(errors).length) {
    return res.status(422).render('pages/checkout', { title: 'Checkout · GreenNest', summary, form, errors });
  }

  try {
    const number = await db.transaction(async (conn) => {
      // Lock the rows and re-check stock so two buyers can't oversell.
      const ids = summary.lines.map((l) => l.id);
      const stockRows = await conn.query('SELECT id, name, stock FROM products WHERE id IN (?) FOR UPDATE', [ids]);
      for (const line of summary.lines) {
        const row = stockRows.find((r) => r.id === line.id);
        if (!row || row.stock < line.quantity) {
          const e = new Error(`Sorry, only ${row ? row.stock : 0} × ${line.name} left in stock. Your cart has been updated.`);
          e.userFacing = true;
          throw e;
        }
      }

      const num = orderNumber();
      const orderId = await db.insert('orders', {
        order_number: num, user_id: req.user ? req.user.id : null, customer_name: form.name, email: form.email,
        phone: form.phone, address: form.address, city: form.city, state: form.state, postal_code: form.postal_code,
        notes: form.notes || null, subtotal: summary.subtotal, discount: summary.discount, shipping: summary.shipping,
        total: summary.total, coupon_code: summary.coupon ? summary.coupon.code : null,
      }, conn);
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_name, image, unit_price, quantity, line_total) VALUES ?',
        [summary.lines.map((l) => [orderId, l.id, l.name, l.image, l.price, l.quantity, l.lineTotal])]
      );
      for (const l of summary.lines) {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [l.quantity, l.id]);
      }
      if (req.user && form.phone && !req.user.phone) {
        await conn.query('UPDATE users SET phone = ? WHERE id = ?', [form.phone, req.user.id]);
      }
      return num;
    });

    req.session.cart = {};
    delete req.session.coupon;
    req.session.recentOrders = [...(req.session.recentOrders || []), number].slice(-10);
    res.redirect(`/cart/order/${number}`);
  } catch (err) {
    if (!err.userFacing) throw err;
    req.session.flash = { type: 'error', message: err.message };
    res.redirect('/cart');
  }
});

router.get('/order/:number', async (req, res, next) => {
  const order = await db.one('SELECT * FROM orders WHERE order_number = ?', [req.params.number]);
  const allowed = order && ((req.session.recentOrders || []).includes(order.order_number) || (req.user && req.user.id === order.user_id));
  if (!allowed) return next();
  const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.render('pages/order-success', { title: 'Order Confirmed · GreenNest', order, items });
});

module.exports = router;
