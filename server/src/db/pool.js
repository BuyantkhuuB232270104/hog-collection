const { Pool, types } = require('pg');
types.setTypeParser(1082, v => v); // DATE-ийг 'ОООО-СС-ӨӨ' текстээр
types.setTypeParser(20, v => Number(v)); // bigint id-г тоогоор
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
// tstzrange-ийг текстээр буцаана; бусад нь pg-ийн анхдагч хөрвүүлэлт
const q = (text, params) => pool.query(text, params);

/** Транзакц: fn(client) амжилттай бол COMMIT, алдаа гарвал ROLLBACK */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
module.exports = { pool, q, tx };
