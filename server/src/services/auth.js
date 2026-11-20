// UC-01 Бүртгэл удирдах: бүртгүүлэх (1.1–1.3), нэвтрэх (1.4)
const argon2 = require('@node-rs/argon2');
const { q, tx } = require('../db/pool');
const { bad, conflict, AppError } = require('../errors');

// OWASP зөвлөмж: Argon2id, m = 19 MiB, t = 2, p = 1 (NFR-02)
const HASH_OPTS = { algorithm: argon2.Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const hashPassword = (pw) => argon2.hash(pw, HASH_OPTS);

async function register({ fullName, phone, email, password, consent, accountType, organizationName }) {
  if (!consent) throw bad('CONSENT_REQUIRED', 'Хувийн мэдээлэл боловсруулах зөвшөөрөл өгөх шаардлагатай.'); // BR-01
  const dup = await q('SELECT 1 FROM users WHERE ($1::text IS NOT NULL AND phone = $1) OR ($2::text IS NOT NULL AND email = $2)', [phone || null, email || null]);
  if (dup.rowCount) throw conflict('ALREADY_REGISTERED', 'Энэ утас эсвэл имэйл бүртгэлтэй байна. Нэвтэрнэ үү.');
  const hash = await hashPassword(password);
  const isBusiness = accountType === 'business';
  return tx(async (c) => {
    const u = await c.query(`INSERT INTO users (full_name, phone, email, password_hash, consent_at, status)
      VALUES ($1,$2,$3,$4, now(), $5) RETURNING id, full_name, status`, [fullName, phone || null, email || null, hash, isBusiness ? 'pending' : 'active']);
    const user = u.rows[0];
    if (isBusiness) {
      // FR-02: ААН-ийн төлөөлөгч — админ баталгаажуулах хүртэл “pending”
      const o = await c.query(`INSERT INTO organizations (name, type, active) VALUES ($1, 'business', false) RETURNING id`, [organizationName]);
      await c.query(`INSERT INTO user_roles (user_id, role_id, organization_id) SELECT $1, id, $2 FROM roles WHERE code = 'business'`, [user.id, o.rows[0].id]);
    } else {
      await c.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = 'citizen'`, [user.id]);
    }
    return user;
  });
}

// 15 минутад 5 удаа амжилтгүй бол түр хаана (UC-01 альтернатив урсгал)
const failures = new Map();
const WINDOW = 15 * 60 * 1000;
function tooMany(key) {
  const f = failures.get(key);
  return f && f.count >= 5 && Date.now() - f.first < WINDOW;
}
function recordFail(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first >= WINDOW) failures.set(key, { count: 1, first: Date.now() });
  else f.count++;
}

async function login({ login, password }) {
  const key = String(login).toLowerCase();
  if (tooMany(key)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Олон удаа буруу оролдсон тул 15 минут түр хаагдлаа.');
  const { rows } = await q('SELECT id, password_hash, status FROM users WHERE phone = $1 OR lower(email) = $1', [key]);
  const user = rows[0];
  const ok = user && user.status !== 'disabled' && (await argon2.verify(user.password_hash, password));
  if (!ok) { recordFail(key); throw new AppError(401, 'BAD_CREDENTIALS', 'Нэвтрэх нэр эсвэл нууц үг буруу байна.'); }
  failures.delete(key);
  return user;
}
/** Нууц үг солих: одоогийн нууц үгийг шалгана, солигдсоны дараа хуучин бүх сесс хүчингүй болно */
async function changePassword(userId, { currentPassword, newPassword }) {
  const { rows } = await q('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0] || !(await argon2.verify(rows[0].password_hash, currentPassword))) throw bad('BAD_CURRENT_PASSWORD', 'Одоогийн нууц үг буруу байна.', { currentPassword: 'Одоогийн нууц үг буруу байна.' });
  await q('UPDATE users SET password_hash = $2, password_changed_at = date_trunc(\'second\', now()) WHERE id = $1', [userId, await hashPassword(newPassword)]);
  return { ok: true };
}
/** Админ түр нууц үг оноох */
async function resetPassword(userId, password) {
  const { rowCount } = await q('UPDATE users SET password_hash = $2, password_changed_at = date_trunc(\'second\', now()) WHERE id = $1', [userId, await hashPassword(password)]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Хэрэглэгч олдсонгүй.');
  return { ok: true };
}
async function updateProfile(userId, { fullName, email }) {
  const e = email || null;
  if (e) {
    const dup = await q('SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2', [e, userId]);
    if (dup.rowCount) throw conflict('ALREADY_REGISTERED', 'Энэ имэйл өөр хэрэглэгчид бүртгэлтэй байна.');
  }
  const { rows } = await q('UPDATE users SET full_name = $2, email = $3 WHERE id = $1 RETURNING id, full_name, email', [userId, fullName, e]);
  return rows[0];
}
const _resetLoginLimiter = () => failures.clear();

module.exports = { register, login, hashPassword, changePassword, resetPassword, updateProfile, _resetLoginLimiter };
