const { Pool, types } = require('pg');

// Return NUMERIC (prices) and BIGINT (COUNT/SUM) as JS numbers instead of strings.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

// SSL is configured below, so drop `sslmode` from the URL (pg warns about its meaning changing).
const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const connectionString = rawUrl.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '') || undefined;
if (!connectionString) {
  console.warn('DATABASE_URL is not set — add it to .env (see README).');
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: true },
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10000,
});

/**
 * Lets the app keep writing `?` placeholders.
 *  - scalar            → $n
 *  - [a, b, c]         → $1, $2, $3            (for `IN (?)`)
 *  - [[a, b], [c, d]]  → ($1, $2), ($3, $4)    (for bulk `VALUES ?`)
 */
function prepare(sql, params = []) {
  const values = [];
  const ph = (v) => { values.push(v); return `$${values.length}`; };
  let i = 0;
  const text = sql.replace(/\?/g, () => {
    const p = params[i++];
    if (Array.isArray(p) && Array.isArray(p[0])) return p.map((row) => `(${row.map(ph).join(', ')})`).join(', ');
    if (Array.isArray(p)) return p.length ? p.map(ph).join(', ') : 'NULL';
    return ph(p);
  });
  return { text, values };
}

function runner(client) {
  const query = async (sql, params) => (await client.query(prepare(sql, params))).rows;
  const exec = async (sql, params) => client.query(prepare(sql, params)); // full result (rowCount)
  const one = async (sql, params) => (await query(sql, params))[0] || null;
  return { query, exec, one };
}

const { query, exec, one } = runner(pool);

/** Run `fn({ query, exec, one })` inside a transaction. */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(runner(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** INSERT a plain object and return the new id. */
async function insert(table, obj, db = { query }) {
  const cols = Object.keys(obj);
  const rows = await db.query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (?) RETURNING id`,
    [cols.map((c) => obj[c])]
  );
  return rows[0].id;
}

/** UPDATE a row by id from a plain object. */
async function update(table, id, obj, db = { query }) {
  const cols = Object.keys(obj);
  await db.query(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => obj[c]), id]);
}

module.exports = { pool, query, exec, one, transaction, insert, update, prepare };
