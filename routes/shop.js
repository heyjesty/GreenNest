const express = require('express');
const db = require('../config/db');
const products = require('../lib/products');
const { paginate } = require('../lib/helpers');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
const PER_PAGE = 12;

router.get('/', async (req, res) => {
  const filters = {
    category: String(req.query.category || ''),
    q: String(req.query.q || '').trim().slice(0, 80),
    min: req.query.min,
    max: req.query.max,
    sort: products.SORTS[req.query.sort] ? req.query.sort : 'featured',
    inStock: req.query.stock === '1',
  };

  const { total } = await products.list({ ...filters, limit: 1 });
  const pager = paginate(total, req.query.page, PER_PAGE);
  const [{ rows }, categories] = await Promise.all([
    products.list({ ...filters, limit: PER_PAGE, offset: pager.offset }),
    products.categories(),
  ]);

  const activeCategory = categories.find((c) => c.slug === filters.category);
  res.render('pages/shop', {
    title: `${activeCategory ? activeCategory.name + ' Plants' : 'Shop All Plants'} · GreenNest`,
    products: rows, categories, filters, pager, activeCategory,
  });
});

router.get('/:slug', async (req, res, next) => {
  const product = await products.bySlug(req.params.slug);
  if (!product) return next();

  const [reviews, related] = await Promise.all([
    db.query(`SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
              WHERE r.product_id = ? ORDER BY r.created_at DESC`, [product.id]),
    products.list({ category: (product.category_slugs || '').split(' ')[0], excludeId: product.id, limit: 4 }),
  ]);

  const userReview = req.user ? reviews.find((r) => r.user_id === req.user.id) : null;
  res.render('pages/product', {
    title: `${product.name} · GreenNest`,
    metaDescription: product.short_description,
    product, reviews, related: related.rows, userReview,
  });
});

router.post('/:slug/reviews', requireLogin, async (req, res, next) => {
  const product = await products.bySlug(req.params.slug);
  if (!product) return next();

  const rating = parseInt(req.body.rating, 10);
  const comment = String(req.body.comment || '').trim().slice(0, 2000);
  if (!(rating >= 1 && rating <= 5) || comment.length < 5) {
    req.session.flash = { type: 'error', message: 'Please choose a rating and write at least a few words.' };
    return res.redirect(`/shop/${product.slug}#reviews`);
  }

  await db.query(
    `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?,?,?,?)
     ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()`,
    [product.id, req.user.id, rating, comment]
  );
  req.session.flash = { type: 'success', message: 'Thank you — your review has been saved.' };
  res.redirect(`/shop/${product.slug}#reviews`);
});

module.exports = router;
