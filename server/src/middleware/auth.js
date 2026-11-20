const jwt = require('jsonwebtoken');
const config = require('../config');
const { q } = require('../db/pool');
const { AppError, forbidden } = require('../errors');

const COOKIE = 'hog_token';

function sign(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: '8h' });
}
function setCookie(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 8 * 3600 * 1000 });
}

/** Хэрэглэгч ба үүргүүдийг ачаална: req.user = {id, full_name, status, roles:[{code, organization_id}]} */
async function loadUser(id) {
  const { rows } = await q(`SELECT u.id, u.full_name, u.phone, u.email, u.status, extract(epoch FROM u.password_changed_at) AS pwd_at,
      COALESCE(json_agg(json_build_object('code', r.code, 'organization_id', ur.organization_id))
        FILTER (WHERE r.code IS NOT NULL), '[]') AS roles
    FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1 GROUP BY u.id`, [id]);
  return rows[0];
}

async function authenticate(req, res, next) {
  try {
    const token = req.cookies[COOKIE];
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Нэвтэрнэ үү.');
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret); }
    catch { throw new AppError(401, 'UNAUTHENTICATED', 'Нэвтрэх хугацаа дууссан. Дахин нэвтэрнэ үү.'); }
    const user = await loadUser(payload.sub);
    if (!user || user.status === 'disabled') throw new AppError(401, 'UNAUTHENTICATED', 'Бүртгэл идэвхгүй байна.');
    // Нууц үг солигдсоны өмнө олгосон токен хүчингүй (хулгайлагдсан сессийг таслана)
    if (user.pwd_at && payload.iat < Math.floor(Number(user.pwd_at))) throw new AppError(401, 'UNAUTHENTICATED', 'Нууц үг солигдсон тул дахин нэвтэрнэ үү.');
    req.user = user;
    next();
  } catch (e) { next(e); }
}

const hasRole = (user, ...codes) => user.roles.some(r => codes.includes(r.code));
/** Үүргийн эрх шалгах (RBAC, NFR-01) */
const requireRole = (...codes) => (req, res, next) => (hasRole(req.user, ...codes) ? next() : next(forbidden()));
/** Тухайн үүргээр хамаарах байгууллагуудын id (зохицуулагч, жолооч, удирдлага) */
const orgIds = (user, ...codes) => user.roles.filter(r => codes.includes(r.code) && r.organization_id).map(r => Number(r.organization_id));

module.exports = { COOKIE, sign, setCookie, authenticate, requireRole, hasRole, orgIds, loadUser };
