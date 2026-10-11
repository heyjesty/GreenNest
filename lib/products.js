const db = require('../config/db');

const BASE = `
  SELECT p.*,
         GROUP_CONCAT(DISTINCT c.slug ORDER BY c.slug SEPARATOR ' ') AS category_slugs,
         GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS category_names,
         (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
  FROM products p
  LEFT JOIN product_categories pc ON pc.product_id = p.id
  LEFT JOIN categories c ON c.id = pc.category_id`;

const SORTS = {
  featured: 'p.is_featured DESC, p.id ASC',
  newest: 'p.created_at DESC, p.id DESC',
  'price-asc': 'p.price ASC',
  'price-desc': 'p.price DESC',
  name: 'p.name ASC',
};

/**
 * Lists active products with optional filters.
 * @param {object} f { category, q, min, max, sort, inStock, limit, offset }
 */
async function list(f = {}) {
  const where = ['p.is_active = 1'];
  const params = [];

  if (f.category) {
    where.push('p.id IN (SELECT pc2.product_id FROM product_categories pc2 JOIN categories c2 ON c2.id = pc2.category_id WHERE c2.slug = ?)');
    params.push(f.category);
  }
  if (f.q) {
    where.push('(p.name LIKE ? OR p.short_description LIKE ?)');
    params.push(`%${f.q}%`, `%${f.q}%`);
  }
  if (f.min !== undefined && f.min !== '' && !isNaN(f.min)) { where.push('p.price >= ?'); params.push(Number(f.min)); }
  if (f.max !== undefined && f.max !== '' && !isNaN(f.max)) { where.push('p.price <= ?'); params.push(Number(f.max)); }
  if (f.inStock) where.push('p.stock > 0');
  if (f.excludeId) { where.push('p.id <> ?'); params.push(f.excludeId); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);

  const order = SORTS[f.sort] || SORTS.featured;
  let sql = `${BASE} ${whereSql} GROUP BY p.id ORDER BY ${order}`;
  const rowParams = [...params];
  if (f.limit) { sql += ' LIMIT ? OFFSET ?'; rowParams.push(Number(f.limit), Number(f.offset || 0)); }

  const rows = await db.query(sql, rowParams);
  return { rows, total };
}

async function bySlug(slug) {
  return db.one(`${BASE} WHERE p.slug = ? AND p.is_active = 1 GROUP BY p.id`, [slug]);
}

async function categories() {
  return db.query(`
    SELECT c.*, COUNT(p.id) AS product_count
    FROM categories c
    LEFT JOIN product_categories pc ON pc.category_id = c.id
    LEFT JOIN products p ON p.id = pc.product_id AND p.is_active = 1
    GROUP BY c.id ORDER BY c.id`);
}

module.exports = { list, bySlug, categories, SORTS };
