const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/db');
const products = require('../lib/products');
const { isEmail } = require('../lib/helpers');

const router = express.Router();

const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

// ---------- Home ----------
router.get('/', async (req, res) => {
  const [{ rows: featured }, testimonials, posts] = await Promise.all([
    products.list({ sort: 'featured', limit: 8 }),
    db.query('SELECT * FROM testimonials WHERE is_active = 1 ORDER BY id LIMIT 2'),
    db.query('SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC LIMIT 4'),
  ]);
  res.render('pages/home', {
    title: 'GreenNest – Indoor Plants for Every Corner of Your Home',
    featured, testimonials, posts,
  });
});

// ---------- About ----------
router.get('/about', async (req, res) => {
  const [stats] = await db.query(`
    SELECT (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
           (SELECT COUNT(*) FROM blog_posts WHERE is_published = 1) AS posts`);
  const testimonials = await db.query('SELECT * FROM testimonials WHERE is_active = 1 ORDER BY id LIMIT 2');
  res.render('pages/about', { title: 'About Us · GreenNest', stats, testimonials });
});

// ---------- Plant care ----------
router.get('/plant-care', async (req, res) => {
  const guides = await db.query(
    "SELECT * FROM blog_posts WHERE is_published = 1 AND category IN ('Watering','Care Tips','Plant Care','Beginner Guides') ORDER BY published_at DESC LIMIT 6"
  );
  const { rows: easyPlants } = await products.list({ category: 'low-light', limit: 4 });
  res.render('pages/plant-care', { title: 'Plant Care Guides · GreenNest', guides, easyPlants });
});

// ---------- Contact ----------
router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us · GreenNest', form: {}, errors: {} });
});

router.post('/contact', formLimiter, async (req, res) => {
  const form = {
    name: String(req.body.name || '').trim().slice(0, 100),
    email: String(req.body.email || '').trim().toLowerCase().slice(0, 190),
    subject: String(req.body.subject || '').trim().slice(0, 160),
    message: String(req.body.message || '').trim().slice(0, 5000),
  };
  const errors = {};
  if (form.name.length < 2) errors.name = 'Please enter your name.';
  if (!isEmail(form.email)) errors.email = 'Please enter a valid email address.';
  if (form.subject.length < 3) errors.subject = 'Please add a subject.';
  if (form.message.length < 10) errors.message = 'Your message should be at least 10 characters.';

  if (Object.keys(errors).length) {
    return res.status(422).render('pages/contact', { title: 'Contact Us · GreenNest', form, errors });
  }
  await db.query('INSERT INTO contact_messages (name, email, subject, message) VALUES (?,?,?,?)',
    [form.name, form.email, form.subject, form.message]);
  req.session.flash = { type: 'success', message: 'Thanks for reaching out! Our plant experts will reply within 1–2 business days.' };
  res.redirect('/contact');
});

// ---------- Newsletter ----------
router.post('/subscribe', formLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const wantsJson = req.get('accept')?.includes('application/json');
  let result;

  if (!isEmail(email)) {
    result = { ok: false, message: 'Please enter a valid email address.' };
  } else {
    const r = await db.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [email]);
    result = r.affectedRows
      ? { ok: true, message: 'You’re subscribed! Welcome to the GreenNest community 🌿' }
      : { ok: true, message: 'You’re already subscribed — thanks for being here!' };
  }

  if (wantsJson) return res.status(result.ok ? 200 : 422).json(result);
  req.session.flash = { type: result.ok ? 'success' : 'error', message: result.message };
  res.redirect(req.get('referer') || '/');
});

// ---------- Legal / info pages ----------
const legalPages = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  'shipping-returns': 'Return and Shipping',
  faq: 'Frequently Asked Questions',
};
Object.entries(legalPages).forEach(([slug, heading]) => {
  router.get(`/${slug}`, (req, res) => {
    res.render(`pages/legal/${slug}`, { title: `${heading} · GreenNest`, heading });
  });
});

module.exports = router;
