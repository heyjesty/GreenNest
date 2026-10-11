const crypto = require('crypto');

const CURRENCY = process.env.CURRENCY_SYMBOL || '$';

function money(value) {
  return CURRENCY + Number(value || 0).toFixed(2);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

function formatDate(value, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', opts);
}

function orderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  return `GN${ymd}${crypto.randomInt(1000, 9999)}`;
}

/** Builds pagination info for a list page. */
function paginate(total, page, perPage) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
  return { total, pages, current, perPage, offset: (current - 1) * perPage };
}

/** Returns a query string with one key replaced (used by pagination/filter links). */
function withQuery(query, changes) {
  const params = new URLSearchParams();
  const merged = { ...query, ...changes };
  Object.entries(merged).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

const stars = (rating) => '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

module.exports = { money, slugify, formatDate, orderNumber, paginate, withQuery, isEmail, stars };
