// Өгөгдлийн сангийн схемийг (db/schema.sql) үүсгэнэ. АНХААР: хуучин өгөгдөл устна.
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8');
  await pool.query(sql);
}
module.exports = init;
if (require.main === module) {
  init().then(() => { console.log('Схем үүслээ.'); return pool.end(); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
