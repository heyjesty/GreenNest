const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const { isEmail } = require('../lib/helpers');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('pages/login', {
      title: 'Sign In · GreenNest', form: { email: req.body.email || '' },
      error: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
    });
  },
});

/** Regenerates the session on sign-in (prevents session fixation) while keeping the cart. */
function signIn(req, user) {
  const keep = { cart: req.session.cart, coupon: req.session.coupon, recentOrders: req.session.recentOrders, returnTo: req.session.returnTo };
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      Object.assign(req.session, keep, { userId: user.id });
      resolve();
    });
  });
}

function redirectAfterLogin(req, res, user) {
  const back = req.session.returnTo;
  delete req.session.returnTo;
  const safe = back && back.startsWith('/') && !back.startsWith('//') ? back : null;
  res.redirect(safe || (user.role === 'admin' ? '/admin' : '/account'));
}

// ---------- Login ----------
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.render('pages/login', { title: 'Sign In · GreenNest', form: {}, error: null });
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await db.one('SELECT * FROM users WHERE email = ?', [email]);
  const ok = user && (await bcrypt.compare(password, user.password_hash));

  if (!ok) {
    return res.status(401).render('pages/login', {
      title: 'Sign In · GreenNest', form: { email }, error: 'Incorrect email or password.',
    });
  }
  await signIn(req, user);
  req.session.flash = { type: 'success', message: `Welcome back, ${user.name.split(' ')[0]}!` };
  redirectAfterLogin(req, res, user);
});

// ---------- Register ----------
router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.render('pages/register', { title: 'Create Account · GreenNest', form: {}, errors: {} });
});

router.post('/register', loginLimiter, async (req, res) => {
  const form = {
    name: String(req.body.name || '').trim().slice(0, 100),
    email: String(req.body.email || '').trim().toLowerCase().slice(0, 190),
  };
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');
  const errors = {};

  if (form.name.length < 2) errors.name = 'Please enter your name.';
  if (!isEmail(form.email)) errors.email = 'Please enter a valid email address.';
  else if (await db.one('SELECT id FROM users WHERE email = ?', [form.email])) errors.email = 'An account with this email already exists.';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use at least 8 characters, including a letter and a number.';
  }
  if (password !== confirm) errors.confirm = 'Passwords do not match.';

  if (Object.keys(errors).length) {
    return res.status(422).render('pages/register', { title: 'Create Account · GreenNest', form, errors });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)', [form.name, form.email, hash]);
  const user = { id: result.insertId, role: 'customer' };
  await signIn(req, user);
  req.session.flash = { type: 'success', message: `Welcome to GreenNest, ${form.name.split(' ')[0]}! 🌿` };
  redirectAfterLogin(req, res, user);
});

// ---------- Logout ----------
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('greennest.sid');
    res.redirect('/');
  });
});

module.exports = router;
