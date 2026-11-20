// UC-05 Ажил хуваарилалт (5.5–5.10), UC-06 Гүйцэтгэл (6.1–6.7)
const { q, tx } = require('../db/pool');
const { bad, forbidden, notFound, conflict } = require('../errors');
const { orgIds } = require('../middleware/auth');
const history = require('./history');
const { JOB_STATUS, NOT_DONE_REASONS } = require('./labels');

const TZ = 'Asia/Ulaanbaatar';
// Огноо + цагийг Улаанбаатарын цагаар tstzrange болгоно: [эхлэх, дуусах)
const WINDOW_SQL = (d, f, t) => `tstzrange((${d}::date + ${f}::time) AT TIME ZONE '${TZ}', (${d}::date + ${t}::time) AT TIME ZONE '${TZ}', '[)')`;

async function drivers(user, date) {
  const orgs = orgIds(user, 'coordinator');
  const { rows } = await q(`SELECT u.id, u.full_name, ur.organization_id,
      (SELECT count(*)::int FROM jobs j WHERE j.assignee_id = u.id AND j.status IN ('PLANNED','STARTED')
         AND lower(j.planned_window) >= ($2::date) AT TIME ZONE '${TZ}' AND lower(j.planned_window) < ($2::date + 1) AT TIME ZONE '${TZ}') AS jobs_that_day
    FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'driver' AND ur.organization_id = ANY($1) AND u.status = 'active' ORDER BY u.full_name`, [orgs, date]);
  return rows;
}

/** 5.6 Гүйцэтгэгчийн давхцал шалгах (BR-05). Давхцсан ажлын дугаарыг буцаана. */
async function findOverlap(c, assigneeId, date, from, to, exceptJobId) {
  const { rows } = await c.query(`SELECT j.id, r.request_no, lower(j.planned_window) AS planned_from, upper(j.planned_window) AS planned_to
    FROM jobs j JOIN requests r ON r.id = j.request_id
    WHERE j.assignee_id = $1 AND j.status IN ('PLANNED','STARTED') AND j.id <> COALESCE($5, 0)
      AND j.planned_window && ${WINDOW_SQL('$2', '$3', '$4')}`, [assigneeId, date, from, to, exceptJobId || null]);
  return rows[0];
}
function overlapError(o) {
  return conflict('OVERLAP', `Гүйцэтгэгч энэ интервалд ${o.request_no} ажилтай байна. Өөр интервал эсвэл гүйцэтгэгч сонгоно уу.`, o);
}

async function checkDriver(c, assigneeId, orgId) {
  const { rowCount } = await c.query(`SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1 AND r.code = 'driver' AND ur.organization_id = $2 AND u.status = 'active'`, [assigneeId, orgId]);
  if (!rowCount) throw bad('BAD_ASSIGNEE', 'Сонгосон гүйцэтгэгч энэ байгууллагын идэвхтэй жолооч биш байна.');
}

/** Exclusion constraint зөрчлийг (23P01) давхцлын алдаа болгоно — зэрэг ирсэн хуваарилалтаас хамгаална */
async function guard(fn, c, assigneeId, date, from, to, jobId) {
  await c.query('SAVEPOINT overlap_guard');
  try { const r = await fn(); await c.query('RELEASE SAVEPOINT overlap_guard'); return r; }
  catch (e) {
    if (e.code !== '23P01') throw e;
    await c.query('ROLLBACK TO SAVEPOINT overlap_guard');
    throw overlapError((await findOverlap(c, assigneeId, date, from, to, jobId)) || { request_no: '—' });
  }
}

/** 5.5 Ажил хуваарилах */
async function assign(user, { requestId, date, timeFrom, timeTo, assigneeId }) {
  if (timeTo <= timeFrom) throw bad('BAD_TIME', 'Дуусах цаг эхлэх цагаас хойш байх ёстой.');
  return tx(async (c) => {
    const { rows } = await c.query(`SELECT r.*, z.organization_id FROM requests r JOIN service_zones z ON z.id = r.zone_id WHERE r.id = $1 FOR UPDATE OF r`, [requestId]);
    const r = rows[0];
    if (!r) throw notFound('Хүсэлт олдсонгүй.');
    if (!orgIds(user, 'coordinator').includes(Number(r.organization_id))) throw forbidden();
    if (r.status !== 'APPROVED') throw conflict('STATUS_CHANGED', 'Зөвхөн “Батлагдсан” хүсэлтэд ажил хуваарилна.');
    await checkDriver(c, assigneeId, r.organization_id);
    const o = await findOverlap(c, assigneeId, date, timeFrom, timeTo, null);
    if (o) throw overlapError(o);
    const existing = await c.query('SELECT id FROM jobs WHERE request_id = $1', [requestId]); // цуцлагдсан ажлыг дахин ашиглана
    const job = await guard(async () => {
      if (existing.rowCount) {
        return (await c.query(`UPDATE jobs SET assignee_id = $2, planned_window = ${WINDOW_SQL('$3', '$4', '$5')}, status = 'PLANNED',
          reason = NULL, started_at = NULL, finished_at = NULL WHERE id = $1 RETURNING id`, [existing.rows[0].id, assigneeId, date, timeFrom, timeTo])).rows[0];
      }
      return (await c.query(`INSERT INTO jobs (request_id, assignee_id, planned_window) VALUES ($1, $2, ${WINDOW_SQL('$3', '$4', '$5')}) RETURNING id`,
        [requestId, assigneeId, date, timeFrom, timeTo])).rows[0];
    }, c, assigneeId, date, timeFrom, timeTo, null);
    await c.query(`UPDATE requests SET status = 'ASSIGNED' WHERE id = $1`, [requestId]);
    await history.log(c, { requestId, jobId: job.id, oldStatus: 'APPROVED', newStatus: 'ASSIGNED', reason: `${date} ${timeFrom}–${timeTo}`, userId: user.id });
    await history.notify(c, r.requester_id, requestId, `Таны ${r.request_no} хүсэлтийг ${date} ${timeFrom}–${timeTo} цагт ачихаар товлолоо.`);
    await history.notify(c, assigneeId, requestId, `Танд шинэ ажил оноогдлоо: ${r.request_no}, ${date} ${timeFrom}–${timeTo}`);
    return { jobId: job.id, requestId, status: 'ASSIGNED' };
  });
}

async function lockJob(c, jobId) {
  const { rows } = await c.query(`SELECT j.*, r.request_no, r.requester_id, r.status AS request_status, z.organization_id
    FROM jobs j JOIN requests r ON r.id = j.request_id JOIN service_zones z ON z.id = r.zone_id WHERE j.id = $1 FOR UPDATE OF j, r`, [jobId]);
  if (!rows[0]) throw notFound('Ажил олдсонгүй.');
  return rows[0];
}

/** 5.8 Дахин хуваарилах, 5.9 Хойшлуулах, 5.10 Цуцлах — шалтгаан заавал (BR-04) */
async function change(user, jobId, { action, reason, date, timeFrom, timeTo, assigneeId }) {
  if (!reason) throw bad('REASON_REQUIRED', 'Шалтгаан заавал оруулна.');
  return tx(async (c) => {
    const j = await lockJob(c, jobId);
    if (!orgIds(user, 'coordinator').includes(Number(j.organization_id))) throw forbidden();
    if (action === 'reassign') {
      if (!['PLANNED', 'POSTPONED', 'NOT_DONE'].includes(j.status)) throw conflict('STATUS_CHANGED', 'Энэ ажлыг дахин хуваарилах боломжгүй.');
      if (timeTo <= timeFrom) throw bad('BAD_TIME', 'Дуусах цаг эхлэх цагаас хойш байх ёстой.');
      await checkDriver(c, assigneeId, j.organization_id);
      const o = await findOverlap(c, assigneeId, date, timeFrom, timeTo, jobId);
      if (o) throw overlapError(o);
      await guard(() => c.query(`UPDATE jobs SET assignee_id = $2, planned_window = ${WINDOW_SQL('$3', '$4', '$5')}, status = 'PLANNED',
        reason = NULL, started_at = NULL, finished_at = NULL WHERE id = $1`, [jobId, assigneeId, date, timeFrom, timeTo]), c, assigneeId, date, timeFrom, timeTo, jobId);
      if (j.request_status !== 'ASSIGNED') await c.query(`UPDATE requests SET status = 'ASSIGNED' WHERE id = $1`, [j.request_id]);
      await history.log(c, { requestId: j.request_id, jobId, oldStatus: j.status, newStatus: 'PLANNED', reason: `Дахин хуваарилсан ${date} ${timeFrom}–${timeTo}: ${reason}`, userId: user.id });
      await history.notify(c, j.requester_id, j.request_id, `Таны ${j.request_no} хүсэлтийн ачилт ${date} ${timeFrom}–${timeTo} болж өөрчлөгдлөө.`);
      await history.notify(c, assigneeId, j.request_id, `Танд ажил оноогдлоо: ${j.request_no}, ${date} ${timeFrom}–${timeTo}`);
      if (Number(assigneeId) !== Number(j.assignee_id)) await history.notify(c, j.assignee_id, j.request_id, `${j.request_no} ажил өөр гүйцэтгэгчид шилжлээ.`);
      return { jobId, status: 'PLANNED' };
    }
    if (!['PLANNED'].includes(j.status)) throw conflict('STATUS_CHANGED', `Ажил “${JOB_STATUS[j.status]}” төлөвтэй байна.`);
    if (action === 'postpone') {
      await c.query(`UPDATE jobs SET status = 'POSTPONED', reason = $2 WHERE id = $1`, [jobId, reason]);
      await history.log(c, { requestId: j.request_id, jobId, oldStatus: 'PLANNED', newStatus: 'POSTPONED', reason, userId: user.id });
      await history.notify(c, j.requester_id, j.request_id, `Таны ${j.request_no} хүсэлтийн ачилт хойшлогдлоо. Шалтгаан: ${reason}`);
      await history.notify(c, j.assignee_id, j.request_id, `${j.request_no} ажил хойшлогдлоо.`);
      return { jobId, status: 'POSTPONED' };
    }
    if (action === 'cancel') {
      await c.query(`UPDATE jobs SET status = 'CANCELLED', reason = $2 WHERE id = $1`, [jobId, reason]);
      await c.query(`UPDATE requests SET status = 'APPROVED' WHERE id = $1`, [j.request_id]); // дахин хуваарилах боломжтой
      await history.log(c, { requestId: j.request_id, jobId, oldStatus: 'ASSIGNED', newStatus: 'APPROVED', reason: `Ажил цуцлагдсан: ${reason}`, userId: user.id });
      await history.notify(c, j.assignee_id, j.request_id, `${j.request_no} ажил цуцлагдлаа.`);
      return { jobId, status: 'CANCELLED' };
    }
    throw bad('BAD_ACTION', 'Үйлдэл буруу.');
  });
}

/** Зохицуулагчийн ажлын жагсаалт (өдрөөр) */
async function forCoordinator(user, date) {
  const { rows } = await q(`SELECT j.id, j.status, lower(j.planned_window) AS planned_from, upper(j.planned_window) AS planned_to, j.reason,
      r.id AS request_id, r.request_no, a.street, z.name AS zone_name, u.full_name AS assignee, j.assignee_id
    FROM jobs j JOIN requests r ON r.id = j.request_id JOIN addresses a ON a.id = r.address_id JOIN service_zones z ON z.id = r.zone_id
    JOIN users u ON u.id = j.assignee_id
    WHERE z.organization_id = ANY($1) AND (lower(j.planned_window) AT TIME ZONE '${TZ}')::date = $2
    ORDER BY lower(j.planned_window)`, [orgIds(user, 'coordinator'), date]);
  return rows.map(j => ({ ...j, status_label: JOB_STATUS[j.status] }));
}

/** 6.1 Өнөөдрийн ажил харах, 6.7 хаяг, дэлгэрэнгүй (BR-10: зөвхөн өөрийн ажил) */
async function today(user, date) {
  const { rows } = await q(`SELECT j.id, j.status, lower(j.planned_window) AS planned_from, upper(j.planned_window) AS planned_to, j.reason,
      j.started_at, j.finished_at, r.request_no, r.description, r.address_detail, a.soum, a.bag, a.street, w.name AS waste_type,
      COALESCE(r.contact_phone, ru.phone) AS contact_phone, COALESCE(r.contact_name, ru.full_name) AS contact_name
    FROM jobs j JOIN requests r ON r.id = j.request_id JOIN addresses a ON a.id = r.address_id JOIN waste_types w ON w.id = r.waste_type_id
    JOIN users ru ON ru.id = r.requester_id
    WHERE j.assignee_id = $1 AND (lower(j.planned_window) AT TIME ZONE '${TZ}')::date = $2 AND j.status <> 'CANCELLED'
    ORDER BY lower(j.planned_window)`, [user.id, date]);
  return rows.map(j => ({ ...j, status_label: JOB_STATUS[j.status] }));
}

/** 6.2 Эхлүүлэх, 6.3 Дууссан, 6.4–6.5 Гүйцэтгээгүй + шалтгаан, 6.6 түүх, мэдэгдэл */
async function record(user, jobId, { result, reason }) {
  return tx(async (c) => {
    const j = await lockJob(c, jobId);
    if (Number(j.assignee_id) !== Number(user.id)) throw forbidden('Энэ ажил танд оноогдоогүй.');
    if (result === 'start') {
      if (j.status !== 'PLANNED') throw conflict('STATUS_CHANGED', `Ажил “${JOB_STATUS[j.status]}” төлөвтэй байна.`);
      await c.query(`UPDATE jobs SET status = 'STARTED', started_at = now() WHERE id = $1`, [jobId]);
      await history.log(c, { requestId: j.request_id, jobId, oldStatus: 'PLANNED', newStatus: 'STARTED', userId: user.id });
      return { jobId, status: 'STARTED' };
    }
    if (j.status !== 'STARTED') throw conflict('STATUS_CHANGED', 'Эхлээд ажлыг “Эхлүүлэх” шаардлагатай.');
    if (result === 'done') {
      await c.query(`UPDATE jobs SET status = 'DONE', finished_at = now() WHERE id = $1`, [jobId]);
      await c.query(`UPDATE requests SET status = 'DONE' WHERE id = $1`, [j.request_id]);
      await history.log(c, { requestId: j.request_id, jobId, oldStatus: 'STARTED', newStatus: 'DONE', userId: user.id });
      await history.notify(c, j.requester_id, j.request_id, `Таны ${j.request_no} хүсэлтийн хог ачигдлаа.`);
      return { jobId, status: 'DONE' };
    }
    if (result === 'not_done') {
      if (!reason) throw bad('REASON_REQUIRED', 'Гүйцэтгээгүй шалтгаанаа сонгоно уу.');
      await c.query(`UPDATE jobs SET status = 'NOT_DONE', finished_at = now(), reason = $2 WHERE id = $1`, [jobId, reason]);
      await c.query(`UPDATE requests SET status = 'NOT_DONE' WHERE id = $1`, [j.request_id]);
      await history.log(c, { requestId: j.request_id, jobId, oldStatus: 'STARTED', newStatus: 'NOT_DONE', reason, userId: user.id });
      await history.notify(c, j.requester_id, j.request_id, `Таны ${j.request_no} хүсэлтийн ачилт гүйцэтгэгдсэнгүй. Шалтгаан: ${reason}`);
      await history.notifyCoordinators(c, j.organization_id, j.request_id, `${j.request_no} ажил гүйцэтгэгдсэнгүй: ${reason}`);
      return { jobId, status: 'NOT_DONE' };
    }
    throw bad('BAD_RESULT', 'Үр дүн буруу.');
  });
}

module.exports = { drivers, assign, change, forCoordinator, today, record, NOT_DONE_REASONS };
