// Аюулгүй байдлын аудит бүртгэл: хэн, юу хийснийг зөвхөн нэмж хадгална. Нууц үг, токен хэзээ ч бичихгүй.
const { q } = require('../db/pool');

/** Алдаа гарсан ч үндсэн үйлдлийг зогсоохгүй */
async function log(req, action, { userId, entity = null, entityId = null, detail = null } = {}) {
  try {
    await q('INSERT INTO audit_log (user_id, action, entity, entity_id, detail, ip) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId ?? req?.user?.id ?? null, action, entity, entityId, detail ? String(detail).slice(0, 300) : null, req?.ip ? String(req.ip).slice(0, 64) : null]);
  } catch (e) { console.error('audit:', e.message); }
}
async function list({ limit = 100, action } = {}) {
  const { rows } = await q(`SELECT a.id, a.at, a.action, a.entity, a.entity_id, a.detail, a.ip, u.full_name AS user_name
    FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE ($2::text IS NULL OR a.action = $2)
    ORDER BY a.at DESC, a.id DESC LIMIT $1`, [Math.min(Number(limit) || 100, 500), action || null]);
  return rows;
}
module.exports = { log, list };
