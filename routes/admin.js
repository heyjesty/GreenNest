const express = require('express');
const multer = require('multer');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { slugify, paginate } = require('../lib/helpers');

const router = express.Router();
router.use(requireAdmin);
router.use((req, res, next) => { res.locals.layout = 'admin'; next(); });

// ---------- Image uploads (stored in MySQL, served from /media/:id) ----------
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, IMAGE_TYPES.includes(file.mimetype)),
});

async function saveImage(file) {
  const r = await db.query('INSERT INTO media (mime_type, data) VALUES (?, ?)', [file.mimetype, file.buffer]);
  return `/media/${r.insertId}`;
}

/** Wraps multer so upload errors become a friendly flash message. */
const withUpload = (field) => (req, res, next) => upload.single(field)(req, res, (err) => {
  if (err) {
    req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 3 MB.' : 'Image upload failed.';
  }
  next();
});

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

async function uniqueSlug(table, base, excludeId = 0) {
  let slug = slugify(base);
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await db.one(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`, [slug, excludeId])) slug = `${slugify(base)}-${++i}`;
  return slug;
}

// ---------- Dashboard ----------
router.get('/', async (req, res) => {
  const [stats] = await db.query(`
    SELECT
      (SELECT COALESCE(SUM(total),0) FROM orders WHERE status <> 'cancelled') AS revenue,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pending,
      (SELECT COUNT(*) FROM products WHERE is_active = 1) AS products,
      (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
      (SELECT COUNT(*) FROM subscribers) AS subscribers,
      (SELECT COUNT(*) FROM contact_messages WHERE is_read = 0) AS unread`);
  const [recentOrders, lowStock, sales] = await Promise.all([
    db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 6'),
    db.query('SELECT id, name, stock, image FROM products WHERE is_active = 1 AND stock <= 10 ORDER BY stock ASC LIMIT 6'),
    db.query(`SELECT DATE(created_at) AS day, SUM(total) AS total, COUNT(*) AS n FROM orders
              WHERE status <> 'cancelled' AND created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(created_at)`),
  ]);

  // Build a full 7-day series (days without sales = 0).
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const row = sales.find((s) => new Date(s.day).toDateString() === key);
    days.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), total: row ? Number(row.total) : 0 });
  }

  res.render('admin/dashboard', { title: 'Dashboard', stats, recentOrders, lowStock, days });
});

// ---------- Products ----------
router.get('/products', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = await db.query(
    `SELECT p.*, GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') AS category_names
     FROM products p LEFT JOIN product_categories pc ON pc.product_id = p.id LEFT JOIN categories c ON c.id = pc.category_id
     WHERE p.name LIKE ? GROUP BY p.id ORDER BY p.created_at DESC`, [`%${q}%`]);
  res.render('admin/products', { title: 'Products', products: rows, q });
});

async function productForm(res, product, errors = {}) {
  const categories = await db.query('SELECT * FROM categories ORDER BY id');
  res.status(Object.keys(errors).length ? 422 : 200)
    .render('admin/product-form', { title: product.id ? `Edit ${product.name}` : 'New Product', product, categories, errors });
}

router.get('/products/new', (req, res) => productForm(res, { is_active: 1, stock: 10, category_ids: [] }));

router.get('/products/:id/edit', async (req, res, next) => {
  const product = await db.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return next();
  product.category_ids = (await db.query('SELECT category_id FROM product_categories WHERE product_id = ?', [product.id])).map((r) => r.category_id);
  productForm(res, product);
});

function readProduct(body) {
  const num = (v) => (v === '' || v === undefined ? null : Number(v));
  const cats = [].concat(body.categories || []).map(Number).filter(Boolean);
  return {
    name: String(body.name || '').trim().slice(0, 120),
    short_description: String(body.short_description || '').trim().slice(0, 255),
    description: String(body.description || '').trim(),
    price: num(body.price),
    compare_price: num(body.compare_price),
    stock: parseInt(body.stock, 10) || 0,
    light: String(body.light || '').trim().slice(0, 60) || 'Bright, indirect',
    water: String(body.water || '').trim().slice(0, 60) || 'Weekly',
    size: String(body.size || '').trim().slice(0, 60) || 'Medium',
    pet_friendly: body.pet_friendly ? 1 : 0,
    is_featured: body.is_featured ? 1 : 0,
    is_active: body.is_active ? 1 : 0,
    category_ids: cats,
  };
}

function validateProduct(p, needsImage) {
  const errors = {};
  if (p.name.length < 2) errors.name = 'Name is required.';
  if (!(p.price > 0)) errors.price = 'Enter a price greater than 0.';
  if (p.compare_price !== null && !(p.compare_price > p.price)) errors.compare_price = 'Compare-at price must be higher than the price (or leave empty).';
  if (p.stock < 0) errors.stock = 'Stock cannot be negative.';
  if (needsImage) errors.image = 'Please upload a product image (JPG, PNG or WebP).';
  return errors;
}

async function saveCategories(conn, productId, ids) {
  await conn.query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
  if (ids.length) await conn.query('INSERT INTO product_categories (product_id, category_id) VALUES ?', [ids.map((c) => [productId, c])]);
}

router.post('/products', withUpload('image'), async (req, res) => {
  const p = readProduct(req.body);
  const errors = validateProduct(p, !req.file);
  if (req.uploadError) errors.image = req.uploadError;
  if (Object.keys(errors).length) return productForm(res, p, errors);

  p.image = await saveImage(req.file);
  p.slug = await uniqueSlug('products', p.name);
  const id = await db.transaction(async (conn) => {
    const { category_ids: cats, ...cols } = p;
    const [r] = await conn.query('INSERT INTO products SET ?', [cols]);
    await saveCategories(conn, r.insertId, cats);
    return r.insertId;
  });
  req.session.flash = { type: 'success', message: `“${p.name}” has been created.` };
  res.redirect(`/admin/products/${id}/edit`);
});

router.post('/products/:id', withUpload('image'), async (req, res, next) => {
  const existing = await db.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return next();
  const p = readProduct(req.body);
  const errors = validateProduct(p, false);
  if (req.uploadError) errors.image = req.uploadError;
  if (Object.keys(errors).length) return productForm(res, { ...existing, ...p }, errors);

  if (req.file) p.image = await saveImage(req.file);
  if (p.name !== existing.name) p.slug = await uniqueSlug('products', p.name, existing.id);
  await db.transaction(async (conn) => {
    const { category_ids: cats, ...cols } = p;
    await conn.query('UPDATE products SET ? WHERE id = ?', [cols, existing.id]);
    await saveCategories(conn, existing.id, cats);
  });
  req.session.flash = { type: 'success', message: 'Product saved.' };
  res.redirect(`/admin/products/${existing.id}/edit`);
});

router.post('/products/:id/delete', async (req, res) => {
  const ordered = await db.one('SELECT id FROM order_items WHERE product_id = ? LIMIT 1', [req.params.id]);
  if (ordered) {
    // Keep order history intact: hide instead of deleting.
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'info', message: 'This product has orders, so it was hidden from the shop instead of deleted.' };
  } else {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', message: 'Product deleted.' };
  }
  res.redirect('/admin/products');
});

// ---------- Orders ----------
router.get('/orders', async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : '';
  const q = String(req.query.q || '').trim();
  const where = ['1=1']; const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (q) { where.push('(order_number LIKE ? OR customer_name LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM orders WHERE ${where.join(' AND ')}`, params);
  const pager = paginate(total, req.query.page, 20);
  const orders = await db.query(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 20 OFFSET ?`, [...params, pager.offset]);
  res.render('admin/orders', { title: 'Orders', orders, status, q, pager, statuses: STATUSES });
});

router.get('/orders/:id', async (req, res, next) => {
  const order = await db.one('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return next();
  const items = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.render('admin/order-detail', { title: `Order ${order.order_number}`, order, items, statuses: STATUSES });
});

router.post('/orders/:id/status', async (req, res, next) => {
  const order = await db.one('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return next();
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.redirect(`/admin/orders/${order.id}`);

  await db.transaction(async (conn) => {
    // Return stock when an order is cancelled, take it again if it is re-opened.
    if (status === 'cancelled' && order.status !== 'cancelled') {
      await conn.query('UPDATE products p JOIN order_items oi ON oi.product_id = p.id SET p.stock = p.stock + oi.quantity WHERE oi.order_id = ?', [order.id]);
    } else if (order.status === 'cancelled' && status !== 'cancelled') {
      await conn.query('UPDATE products p JOIN order_items oi ON oi.product_id = p.id SET p.stock = GREATEST(p.stock - oi.quantity, 0) WHERE oi.order_id = ?', [order.id]);
    }
    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);
  });
  req.session.flash = { type: 'success', message: `Order marked as ${status}.` };
  res.redirect(`/admin/orders/${order.id}`);
});

// ---------- Blog posts ----------
router.get('/posts', async (req, res) => {
  const posts = await db.query('SELECT * FROM blog_posts ORDER BY published_at DESC');
  res.render('admin/posts', { title: 'Blog Posts', posts });
});

async function postForm(res, post, errors = {}) {
  res.status(Object.keys(errors).length ? 422 : 200)
    .render('admin/post-form', { title: post.id ? 'Edit Post' : 'New Post', post, errors });
}

function readPost(body) {
  return {
    title: String(body.title || '').trim().slice(0, 160),
    category: String(body.category || '').trim().slice(0, 60) || 'Plant Care',
    excerpt: String(body.excerpt || '').trim().slice(0, 300),
    content: String(body.content || '').trim(),
    author: String(body.author || '').trim().slice(0, 100) || 'GreenNest Team',
    read_minutes: Math.min(60, Math.max(1, parseInt(body.read_minutes, 10) || 4)),
    is_published: body.is_published ? 1 : 0,
  };
}

function validatePost(p, needsImage) {
  const errors = {};
  if (p.title.length < 3) errors.title = 'Title is required.';
  if (p.excerpt.length < 10) errors.excerpt = 'Write a short summary (10+ characters).';
  if (p.content.length < 20) errors.content = 'Content is required.';
  if (needsImage) errors.image = 'Please upload a cover image.';
  return errors;
}

router.get('/posts/new', (req, res) => postForm(res, { is_published: 1, read_minutes: 4, author: 'GreenNest Team' }));

router.get('/posts/:id/edit', async (req, res, next) => {
  const post = await db.one('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!post) return next();
  postForm(res, post);
});

router.post('/posts', withUpload('image'), async (req, res) => {
  const p = readPost(req.body);
  const errors = validatePost(p, !req.file);
  if (req.uploadError) errors.image = req.uploadError;
  if (Object.keys(errors).length) return postForm(res, p, errors);
  p.image = await saveImage(req.file);
  p.slug = await uniqueSlug('blog_posts', p.title);
  const r = await db.query('INSERT INTO blog_posts SET ?', [p]);
  req.session.flash = { type: 'success', message: 'Post published.' };
  res.redirect(`/admin/posts/${r.insertId}/edit`);
});

router.post('/posts/:id', withUpload('image'), async (req, res, next) => {
  const existing = await db.one('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) return next();
  const p = readPost(req.body);
  const errors = validatePost(p, false);
  if (req.uploadError) errors.image = req.uploadError;
  if (Object.keys(errors).length) return postForm(res, { ...existing, ...p }, errors);
  if (req.file) p.image = await saveImage(req.file);
  if (p.title !== existing.title) p.slug = await uniqueSlug('blog_posts', p.title, existing.id);
  await db.query('UPDATE blog_posts SET ? WHERE id = ?', [p, existing.id]);
  req.session.flash = { type: 'success', message: 'Post saved.' };
  res.redirect(`/admin/posts/${existing.id}/edit`);
});

router.post('/posts/:id/delete', async (req, res) => {
  await db.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  req.session.flash = { type: 'success', message: 'Post deleted.' };
  res.redirect('/admin/posts');
});

// ---------- Messages ----------
router.get('/messages', async (req, res) => {
  const messages = await db.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
  res.render('admin/messages', { title: 'Messages', messages });
});

router.post('/messages/:id/read', async (req, res) => {
  await db.query('UPDATE contact_messages SET is_read = 1 - is_read WHERE id = ?', [req.params.id]);
  res.redirect('/admin/messages');
});

router.post('/messages/:id/delete', async (req, res) => {
  await db.query('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
  req.session.flash = { type: 'success', message: 'Message deleted.' };
  res.redirect('/admin/messages');
});

// ---------- Subscribers ----------
router.get('/subscribers', async (req, res) => {
  const subscribers = await db.query('SELECT * FROM subscribers ORDER BY created_at DESC');
  res.render('admin/subscribers', { title: 'Subscribers', subscribers });
});

router.get('/subscribers.csv', async (req, res) => {
  const rows = await db.query('SELECT email, created_at FROM subscribers ORDER BY created_at DESC');
  const csv = ['email,subscribed_at', ...rows.map((r) => `"${r.email.replace(/"/g, '""')}",${new Date(r.created_at).toISOString()}`)].join('\n');
  res.attachment('greennest-subscribers.csv').type('text/csv').send(csv);
});

router.post('/subscribers/:id/delete', async (req, res) => {
  await db.query('DELETE FROM subscribers WHERE id = ?', [req.params.id]);
  req.session.flash = { type: 'success', message: 'Subscriber removed.' };
  res.redirect('/admin/subscribers');
});

// ---------- Customers ----------
router.get('/customers', async (req, res) => {
  const customers = await db.query(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
           COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status <> 'cancelled' THEN o.total END), 0) AS spent
    FROM users u LEFT JOIN orders o ON o.user_id = u.id
    GROUP BY u.id ORDER BY u.created_at DESC`);
  res.render('admin/customers', { title: 'Customers', customers });
});

module.exports = router;
