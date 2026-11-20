// UC-01 админы хэсэг: 1.6 ААН баталгаажуулах, 1.7/1.9 эрх оноох, 1.8 лавлах (1.10 нэмэх, 1.11 засах, 1.12 идэвхгүй болгох)
const { q, tx } = require('../db/pool');
const { bad, notFound, conflict } = require('../errors');
const { hashPassword } = require('./auth');

// Лавлах бүрийн зөвшөөрөгдсөн баганууд (SQL injection-оос сэргийлж тогтмол жагсаалт)
const LOOKUPS = {
  organizations: { cols: ['name', 'type', 'active'], order: 'name' },
  service_zones: { cols: ['organization_id', 'name', 'soum', 'bag'], order: 'soum, name' },
  addresses: { cols: ['zone_id', 'soum', 'bag', 'street'], order: 'soum, bag, street' },
  waste_types: { cols: ['name', 'active'], order: 'id' },
};
function lookup(name) { const l = LOOKUPS[name]; if (!l) throw notFound('Лавлах олдсонгүй.'); return l; }

async function list(name) {
  lookup(name);
  const { rows } = await q(`SELECT * FROM ${name} ORDER BY ${LOOKUPS[name].order}`);
  return rows;
}
async function create(name, data) {
  const l = lookup(name);
  const cols = l.cols.filter(c => data[c] !== undefined);
  if (name === 'waste_types') { // smallint PK — гараар дараагийн дугаар
    const n = await q('SELECT COALESCE(max(id),0)+1 AS id FROM waste_types');
    cols.unshift('id'); data = { ...data, id: n.rows[0].id };
  }
  const { rows } = await q(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`, cols.map(c => data[c]));
  return rows[0];
}
async function update(name, id, data) {
  const l = lookup(name);
  const cols = l.cols.filter(c => data[c] !== undefined);
  if (!cols.length) throw bad('NOTHING', 'Өөрчлөх утга алга.');
  const { rows } = await q(`UPDATE ${name} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`, [id, ...cols.map(c => data[c])]);
  if (!rows[0]) throw notFound();
  return rows[0];
}

async function users() {
  const { rows } = await q(`SELECT u.id, u.full_name, u.phone, u.email, u.status, u.created_at,
      COALESCE(json_agg(json_build_object('id', ur.id, 'code', r.code, 'organization_id', ur.organization_id, 'organization', o.name))
        FILTER (WHERE ur.id IS NOT NULL), '[]') AS roles
    FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id LEFT JOIN organizations o ON o.id = ur.organization_id
    GROUP BY u.id ORDER BY u.status = 'pending' DESC, u.created_at DESC`);
  return rows;
}

/** Ажилтан үүсгэх (зохицуулагч, жолооч, удирдлага) — эрхийг шууд оноож, нууц үгийг Argon2id-ээр хадгална */
async function createStaff({ fullName, phone, email, password, role, organizationId }) {
  const dup = await q('SELECT 1 FROM users WHERE phone = $1 OR ($2::text IS NOT NULL AND email = $2)', [phone, email || null]);
  if (dup.rowCount) throw conflict('ALREADY_REGISTERED', 'Энэ утас эсвэл имэйл бүртгэлтэй байна.');
  const hash = await hashPassword(password);
  return tx(async (c) => {
    const u = await c.query(`INSERT INTO users (full_name, phone, email, password_hash, consent_at) VALUES ($1,$2,$3,$4, now()) RETURNING id`,
      [fullName, phone, email || null, hash]);
    await assignRoleTx(c, u.rows[0].id, role, organizationId);
    return u.rows[0];
  });
}

async function assignRoleTx(c, userId, role, organizationId) {
  const r = await c.query('SELECT id FROM roles WHERE code = $1', [role]);
  if (!r.rowCount) throw bad('BAD_ROLE', 'Үүрэг буруу.');
  if (['coordinator', 'driver', 'manager', 'business'].includes(role) && !organizationId) throw bad('ORG_REQUIRED', 'Байгууллагын хүрээ сонгоно уу.'); // 1.9
  await c.query(`INSERT INTO user_roles (user_id, role_id, organization_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [userId, r.rows[0].id, organizationId || null]);
}
const assignRole = (userId, { role, organizationId }) => tx(c => assignRoleTx(c, userId, role, organizationId));
async function revokeRole(userRoleId) { await q('DELETE FROM user_roles WHERE id = $1', [userRoleId]); }

/** 1.6 ААН-ийн төлөөлөгч баталгаажуулах: хэрэглэгч ба байгууллагыг идэвхжүүлнэ */
async function verifyBusiness(userId) {
  return tx(async (c) => {
    const u = await c.query(`UPDATE users SET status = 'active' WHERE id = $1 AND status = 'pending' RETURNING id`, [userId]);
    if (!u.rowCount) throw notFound('Баталгаажуулах хүлээгдэж буй хэрэглэгч олдсонгүй.');
    await c.query(`UPDATE organizations SET active = true WHERE id IN (SELECT organization_id FROM user_roles WHERE user_id = $1 AND organization_id IS NOT NULL)
      AND type = 'business'`, [userId]);
    await c.query(`INSERT INTO notifications (user_id, message) VALUES ($1, 'Таны байгууллагын бүртгэл баталгаажлаа. Хүсэлт илгээх боломжтой.')`, [userId]);
    return { id: userId, status: 'active' };
  });
}
async function setUserStatus(userId, status) {
  if (!['active', 'disabled'].includes(status)) throw bad('BAD_STATUS', 'Төлөв буруу.');
  const { rowCount } = await q('UPDATE users SET status = $2 WHERE id = $1', [userId, status]);
  if (!rowCount) throw notFound();
  return { id: userId, status };
}
module.exports = { list, create, update, users, createStaff, assignRole, revokeRole, verifyBusiness, setUserStatus, LOOKUPS };
