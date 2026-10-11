const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin);

router.get('/', async (req, res) => {
  const orders = await db.query(
    `SELECT o.*, (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC`, [req.user.id]);
  res.render('pages/account', { title: 'My Account · GreenNest', orders, tab: req.query.tab || 'orders', errors: {} });
});

router.get('/orders/:number', async (req, res, next) => {
  const order = await db.one('SELECT * FROM orders WHERE order_number = ? AND user_id = ?', [req.params.number, req.user.id]);
  if (!order) return next();
  const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.render('pages/order-detail', { title: `Order ${order.order_number} · GreenNest`, order, items });
});

router.post('/orders/:number/cancel', async (req, res, next) => {
  const order = await db.one("SELECT * FROM orders WHERE order_number = ? AND user_id = ?", [req.params.number, req.user.id]);
  if (!order) return next();
  if (order.status !== 'pending') {
    req.session.flash = { type: 'error', message: 'This order is already being prepared and can no longer be cancelled online. Please contact us.' };
  } else {
    await db.transaction(async (conn) => {
      await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
      await conn.query(
        'UPDATE products p SET stock = p.stock + oi.quantity FROM order_items oi WHERE oi.product_id = p.id AND oi.order_id = ?',
        [order.id]);
    });
    req.session.flash = { type: 'success', message: `Order ${order.order_number} has been cancelled.` };
  }
  res.redirect(`/account/orders/${order.order_number}`);
});

router.post('/profile', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  const phone = String(req.body.phone || '').trim().slice(0, 30);
  if (name.length < 2) {
    req.session.flash = { type: 'error', message: 'Please enter your name.' };
  } else {
    await db.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name, phone || null, req.user.id]);
    req.session.flash = { type: 'success', message: 'Your profile has been updated.' };
  }
  res.redirect('/account?tab=profile');
});

router.post('/password', async (req, res) => {
  const { current = '', password = '', confirm = '' } = req.body;
  const user = await db.one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  let error = null;
  if (!(await bcrypt.compare(String(current), user.password_hash))) error = 'Your current password is incorrect.';
  else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) error = 'New password needs 8+ characters with a letter and a number.';
  else if (password !== confirm) error = 'New passwords do not match.';

  if (error) {
    req.session.flash = { type: 'error', message: error };
  } else {
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 12), req.user.id]);
    req.session.flash = { type: 'success', message: 'Your password has been changed.' };
  }
  res.redirect('/account?tab=security');
});

module.exports = router;
