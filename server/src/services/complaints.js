// UC-04 Гомдол, мэдэгдэл удирдах (4.1–4.6)
const { q, tx } = require('../db/pool');
const { bad, forbidden, notFound } = require('../errors');
const { orgIds } = require('../middleware/auth');
const history = require('./history');

const STATUS = { OPEN: 'Шинэ', IN_REVIEW: 'Шалгаж байна', RESOLVED: 'Шийдвэрлэсэн' };

/** 4.2 Гомдол гаргах: зөвхөн өөрийн, дууссан/гүйцэтгэгдээгүй ажилд, 7 хоногт (BR-07) */
async function create(user, { requestId, body }) {
  return tx(async (c) => {
    const { rows } = await c.query(`SELECT j.id AS job_id, j.status, j.finished_at, r.requester_id, r.request_no, z.organization_id
      FROM requests r JOIN jobs j ON j.request_id = r.id JOIN service_zones z ON z.id = r.zone_id WHERE r.id = $1`, [requestId]);
    const j = rows[0];
    if (!j) throw notFound('Ажил олдсонгүй.');
    if (Number(j.requester_id) !== Number(user.id)) throw forbidden('Зөвхөн өөрийн хүсэлтэд гомдол гаргана.');
    if (!['DONE', 'NOT_DONE'].includes(j.status)) throw bad('NOT_FINISHED', 'Ажил дуусаагүй байна.');
    if (Date.now() - new Date(j.finished_at).getTime() > 7 * 24 * 3600 * 1000) throw bad('TOO_LATE', 'Гомдол гаргах 7 хоногийн хугацаа өнгөрсөн.');
    const r = await c.query('INSERT INTO complaints (job_id, user_id, body) VALUES ($1,$2,$3) RETURNING id, status', [j.job_id, user.id, body]);
    await history.notifyCoordinators(c, j.organization_id, requestId, `${j.request_no} хүсэлтэд гомдол ирлээ`);
    return r.rows[0];
  });
}

/** 4.4 Гомдлын жагсаалт (зохицуулагч) */
async function list(user) {
  const { rows } = await q(`SELECT cp.id, cp.body, cp.status, cp.created_at, r.id AS request_id, r.request_no, z.name AS zone_name,
      u.full_name AS assignee, j.status AS job_status
    FROM complaints cp JOIN jobs j ON j.id = cp.job_id JOIN requests r ON r.id = j.request_id JOIN service_zones z ON z.id = r.zone_id
    JOIN users u ON u.id = j.assignee_id WHERE z.organization_id = ANY($1) ORDER BY cp.created_at DESC`, [orgIds(user, 'coordinator')]);
  return rows.map(x => ({ ...x, status_label: STATUS[x.status] }));
}

/** 4.5 Гомдлын төлөв өөрчлөх */
async function setStatus(user, id, { status, note }) {
  if (!STATUS[status]) throw bad('BAD_STATUS', 'Төлөв буруу.');
  return tx(async (c) => {
    const { rows } = await c.query(`SELECT cp.user_id, r.id AS request_id, r.request_no, z.organization_id FROM complaints cp JOIN jobs j ON j.id = cp.job_id
      JOIN requests r ON r.id = j.request_id JOIN service_zones z ON z.id = r.zone_id WHERE cp.id = $1`, [id]);
    const cp = rows[0];
    if (!cp) throw notFound();
    if (!orgIds(user, 'coordinator').includes(Number(cp.organization_id))) throw forbidden();
    await c.query('UPDATE complaints SET status = $2 WHERE id = $1', [id, status]);
    await history.notify(c, cp.user_id, cp.request_id, `${cp.request_no} хүсэлтийн гомдол: ${STATUS[status]}${note ? '. ' + note : ''}`);
    return { id, status };
  });
}

/** 4.1, 4.6 Мэдэгдэл харах */
async function notifications(user) {
  const { rows } = await q(`SELECT n.id, n.message, n.is_read, n.created_at, n.request_id FROM notifications n
    WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 100`, [user.id]);
  return rows;
}
async function markRead(user) {
  await q('UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read', [user.id]);
}
async function unreadCount(user) {
  const { rows } = await q('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [user.id]);
  return rows[0].n;
}
module.exports = { create, list, setStatus, notifications, markRead, unreadCount };
