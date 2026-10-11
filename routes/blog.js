const express = require('express');
const db = require('../config/db');
const { paginate } = require('../lib/helpers');

const router = express.Router();
const PER_PAGE = 8;

router.get('/', async (req, res) => {
  const category = String(req.query.category || '').slice(0, 60);
  const q = String(req.query.q || '').trim().slice(0, 80);

  const where = ['is_published = 1'];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (q) { where.push('(title LIKE ? OR excerpt LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.join(' AND ');

  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM blog_posts WHERE ${whereSql}`, params);
  const pager = paginate(total, req.query.page, PER_PAGE);
  const [posts, categories] = await Promise.all([
    db.query(`SELECT * FROM blog_posts WHERE ${whereSql} ORDER BY published_at DESC LIMIT ? OFFSET ?`, [...params, PER_PAGE, pager.offset]),
    db.query('SELECT category, COUNT(*) AS n FROM blog_posts WHERE is_published = 1 GROUP BY category ORDER BY category'),
  ]);

  res.render('pages/blog', { title: 'The GreenVibe Blog · GreenNest', posts, categories, category, q, pager });
});

router.get('/:slug', async (req, res, next) => {
  const post = await db.one('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1', [req.params.slug]);
  if (!post) return next();
  const more = await db.query(
    'SELECT * FROM blog_posts WHERE is_published = 1 AND id <> ? ORDER BY (category = ?) DESC, published_at DESC LIMIT 3',
    [post.id, post.category]
  );
  res.render('pages/post', { title: `${post.title} · GreenNest Blog`, metaDescription: post.excerpt, post, more });
});

module.exports = router;
