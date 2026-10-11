const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'greennest',
};

// Cloud MySQL providers (TiDB Cloud, Aiven, PlanetScale...) require TLS.
if (process.env.DB_SSL === 'true') {
  dbConfig.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
}

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: process.env.VERCEL ? 3 : 10,
  decimalNumbers: true,
  dateStrings: false,
});

/** Run a query and return rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row (or null). */
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Run `fn(conn)` inside a transaction. */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, one, transaction, dbConfig };
