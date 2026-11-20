// Нэмэлт өөрчлөлтүүдийг (db/migrations/*.sql) дарааллаар нь нэг удаа ажиллуулна. Өгөгдөл устахгүй.
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const dir = path.join(__dirname, '../../db/migrations');
  const users = await pool.query(`SELECT to_regclass('public.users') AS t`);
  if (!users.rows[0].t) return []; // схем хараахан үүсээгүй (db:init / db:seed хийгээгүй)
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
  const ran = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    ran.push(f);
  }
  return ran;
}
module.exports = migrate;
if (require.main === module) {
  migrate().then(r => { console.log(r.length ? `Шинэчлэгдлээ: ${r.join(', ')}` : 'Шинэчлэх зүйл алга.'); return pool.end(); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
