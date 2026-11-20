// UC-03 Хүсэлт удирдах (3.1–3.8), UC-05 хүсэлт шийдвэрлэх (5.1–5.4)
const { q, tx } = require('../db/pool');
const { bad, forbidden, notFound, conflict } = require('../errors');
const { hasRole, orgIds } = require('../middleware/auth');
const history = require('./history');
const { REQUEST_STATUS, JOB_STATUS } = require('./labels');

const CANCELLABLE = ['SUBMITTED', 'NEED_INFO', 'APPROVED']; // BR-06

const SELECT = `SELECT r.id, r.request_no, r.status, r.channel, r.description, r.address_detail, r.created_at,
    lower(r.preferred_window) AS preferred_from, upper(r.preferred_window) AS preferred_to,
    r.requester_id, r.contact_name, r.contact_phone,
    a.soum, a.bag, a.street, z.id AS zone_id, z.name AS zone_name, z.organization_id,
    w.id AS waste_type_id, w.name AS waste_type,
    j.id AS job_id, j.status AS job_status, lower(j.planned_window) AS planned_from, upper(j.planned_window) AS planned_to,
    j.assignee_id, j.reason AS job_reason, j.finished_at
  FROM requests r JOIN addresses a ON a.id = r.address_id JOIN service_zones z ON z.id = r.zone_id
  JOIN waste_types w ON w.id = r.waste_type_id LEFT JOIN jobs j ON j.request_id = r.id`;

/** 3.2 Хаягийн лавлахаас үйлчилгээний бүс тодорхойлох (1.4.1, BR-02) */
async function zoneForAddress(c, addressId) {
  const { rows } = await c.query(`SELECT a.id, a.zone_id, z.organization_id, o.active
    FROM addresses a JOIN service_zones z ON z.id = a.zone_id JOIN organizations o ON o.id = z.organization_id WHERE a.id = $1`, [addressId]);
  if (!rows[0] || !rows[0].active) throw bad('OUT_OF_ZONE', 'Энэ хаяг үйлчилгээний бүсэд хамаарахгүй байна.');
  return rows[0];
}

/** 3.1 Хүсэлт илгээх / 3.8 утсаар ирсэн хүсэлт бүртгэх. Давхар илгээлтээс хамгаална (BR-09). */
async function submit(user, dto, idemKey) {
  const byCoordinator = dto.channel && dto.channel !== 'web';
  if (byCoordinator && !hasRole(user, 'coordinator')) throw forbidden();
  if (!byCoordinator && !hasRole(user, 'citizen', 'business')) throw forbidden('Зөвхөн иргэн, ААН-ийн төлөөлөгч хүсэлт илгээнэ.');
  if (!byCoordinator && user.status === 'pending') throw forbidden('Байгууллагын бүртгэл админаар баталгаажаагүй байна.');
  if (idemKey) {
    const prev = await q('SELECT id, request_no, status FROM requests WHERE idempotency_key = $1', [idemKey]);
    if (prev.rowCount) return { ...prev.rows[0], duplicate: true };
  }
  const wt = await q('SELECT 1 FROM waste_types WHERE id = $1 AND active', [dto.wasteTypeId]);
  if (!wt.rowCount) throw bad('BAD_WASTE_TYPE', 'Хаягдлын төрөл буруу байна.');
  try {
    return await tx(async (c) => {
      const zone = await zoneForAddress(c, dto.addressId);
      if (byCoordinator && !orgIds(user, 'coordinator').includes(Number(zone.organization_id))) throw forbidden('Энэ бүсийн хүсэлтийг бүртгэх эрхгүй.');
      const window = dto.preferredFrom && dto.preferredTo ? `[${dto.preferredFrom},${dto.preferredTo})` : null;
      const r = await c.query(`INSERT INTO requests (requester_id, zone_id, address_id, address_detail, waste_type_id, preferred_window,
          description, channel, contact_name, contact_phone, idempotency_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, request_no, status`,
        [user.id, zone.zone_id, dto.addressId, dto.addressDetail || null, dto.wasteTypeId, window, dto.description || null,
          byCoordinator ? dto.channel : 'web', byCoordinator ? dto.contactName : null, byCoordinator ? dto.contactPhone : null, idemKey || null]);
      const req = r.rows[0];
      await history.log(c, { requestId: req.id, newStatus: 'SUBMITTED', userId: user.id });
      await history.notifyCoordinators(c, zone.organization_id, req.id, `Шинэ хүсэлт ирлээ: ${req.request_no}`);
      return req;
    });
  } catch (e) {
    if (e.code === '23505' && idemKey) { // зэрэг ирсэн ижил түлхүүртэй илгээлт
      const prev = await q('SELECT id, request_no, status FROM requests WHERE idempotency_key = $1', [idemKey]);
      return { ...prev.rows[0], duplicate: true };
    }
    throw e;
  }
}

async function addAttachment(user, requestId, file) {
  const r = await q('SELECT requester_id FROM requests WHERE id = $1', [requestId]);
  if (!r.rowCount) throw notFound();
  if (Number(r.rows[0].requester_id) !== Number(user.id)) throw forbidden();
  const n = await q('SELECT count(*)::int AS n FROM attachments WHERE request_id = $1', [requestId]);
  if (n.rows[0].n >= 3) throw bad('TOO_MANY_FILES', 'Нэг хүсэлтэд 3 хүртэл зураг хавсаргана.');
  const { rows } = await q('INSERT INTO attachments (request_id, file_path, size_bytes) VALUES ($1,$2,$3) RETURNING id',
    [requestId, file.filename, file.size]);
  return rows[0];
}

/** Хүсэлтийг үзэх эрх: эзэн, тухайн бүсийн зохицуулагч, оноогдсон гүйцэтгэгч (NFR-01, BR-10) */
function canView(user, r) {
  if (Number(r.requester_id) === Number(user.id)) return true;
  if (orgIds(user, 'coordinator', 'manager').includes(Number(r.organization_id))) return true;
  if (r.assignee_id && Number(r.assignee_id) === Number(user.id)) return true;
  return hasRole(user, 'admin');
}
/** Хувийн мэдээллийг үүргээр шүүнэ */
function present(user, r) {
  const out = { ...r, status_label: REQUEST_STATUS[r.status] };
  const isStaff = orgIds(user, 'coordinator').includes(Number(r.organization_id)) || (r.assignee_id && Number(r.assignee_id) === Number(user.id));
  if (!isStaff) { delete out.contact_name; delete out.contact_phone; }
  return out;
}

async function get(user, id) {
  const { rows } = await q(`${SELECT} WHERE r.id = $1`, [id]);
  const r = rows[0];
  if (!r || !canView(user, r)) throw forbidden('Энэ хүсэлтийг харах эрхгүй.'); // 403 — оршин буйг ч задлахгүй
  const h = await q(`SELECT h.old_status, h.new_status, h.reason, h.changed_at, ro.code AS by_role
    FROM status_history h LEFT JOIN LATERAL (SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = h.changed_by ORDER BY r.id DESC LIMIT 1) ro ON true
    WHERE h.request_id = $1 ORDER BY h.changed_at, h.id`, [id]);
  const att = await q('SELECT id, size_bytes FROM attachments WHERE request_id = $1 ORDER BY id', [id]);
  const out = present(user, r);
  out.history = h.rows.map(x => ({ ...x, new_label: REQUEST_STATUS[x.new_status] || (JOB_STATUS[x.new_status] ? 'Ажил ' + JOB_STATUS[x.new_status].toLowerCase() : x.new_status) }));
  out.attachments = att.rows;
  out.can_cancel = Number(r.requester_id) === Number(user.id) && CANCELLABLE.includes(r.status);
  const c = await q(`SELECT finished_at FROM jobs WHERE request_id = $1 AND status IN ('DONE','NOT_DONE') AND finished_at > now() - interval '7 days'`, [id]);
  out.can_complain = Number(r.requester_id) === Number(user.id) && c.rowCount > 0; // BR-07
  return out;
}

async function mine(user) {
  const { rows } = await q(`${SELECT} WHERE r.requester_id = $1 ORDER BY r.created_at DESC`, [user.id]);
  return rows.map(r => present(user, r));
}

/** 5.1 Зохицуулагчийн жагсаалт: өөрийн байгууллагын бүсүүдээр */
async function forCoordinator(user, { status, zoneId, q: search }) {
  const orgs = orgIds(user, 'coordinator');
  const params = [orgs]; let where = 'z.organization_id = ANY($1)';
  if (status) { params.push(status.split(',')); where += ` AND r.status = ANY($${params.length})`; }
  if (zoneId) { params.push(zoneId); where += ` AND r.zone_id = $${params.length}`; }
  if (search) { // дугаар, хаяг, тайлбараар хайх
    params.push(`%${search.replace(/[%_\\]/g, m => '\\' + m)}%`);
    where += ` AND (r.request_no ILIKE $${params.length} OR a.street ILIKE $${params.length} OR a.bag ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
  }
  const { rows } = await q(`${SELECT} WHERE ${where} ORDER BY r.created_at`, params);
  return rows.map(r => present(user, r));
}

async function lockForUpdate(c, id) {
  const { rows } = await c.query(`SELECT r.*, z.organization_id FROM requests r JOIN service_zones z ON z.id = r.zone_id WHERE r.id = $1 FOR UPDATE OF r`, [id]);
  if (!rows[0]) throw notFound('Хүсэлт олдсонгүй.');
  return rows[0];
}

/** 5.2 Батлах, 5.3 Татгалзах, 5.4 Нэмэлт мэдээлэл шаардах (BR-04) */
async function decide(user, id, { decision, reason }) {
  const target = { approve: 'APPROVED', reject: 'REJECTED', need_info: 'NEED_INFO' }[decision];
  if (!target) throw bad('BAD_DECISION', 'Шийдвэр буруу.');
  if (decision !== 'approve' && !reason) throw bad('REASON_REQUIRED', 'Шалтгаан / асуултаа бичнэ үү.');
  return tx(async (c) => {
    const r = await lockForUpdate(c, id);
    if (!orgIds(user, 'coordinator').includes(Number(r.organization_id))) throw forbidden();
    if (r.status !== 'SUBMITTED') throw conflict('STATUS_CHANGED', `Хүсэлтийн төлөв өөрчлөгдсөн байна (${REQUEST_STATUS[r.status]}).`);
    await c.query('UPDATE requests SET status = $2 WHERE id = $1', [id, target]);
    await history.log(c, { requestId: id, oldStatus: r.status, newStatus: target, reason, userId: user.id });
    const msg = { APPROVED: 'батлагдлаа', REJECTED: `татгалзагдлаа. Шалтгаан: ${reason}`, NEED_INFO: `нэмэлт мэдээлэл шаардлаа: ${reason}` }[target];
    await history.notify(c, r.requester_id, id, `Таны ${r.request_no} хүсэлт ${msg}`);
    return { id, status: target };
  });
}

/** 3.7 Нэмэлт мэдээлэл нөхөх */
async function supplyInfo(user, id, { description }) {
  return tx(async (c) => {
    const r = await lockForUpdate(c, id);
    if (Number(r.requester_id) !== Number(user.id)) throw forbidden();
    if (r.status !== 'NEED_INFO') throw conflict('STATUS_CHANGED', 'Нэмэлт мэдээлэл шаардаагүй байна.');
    await c.query(`UPDATE requests SET status = 'SUBMITTED', description = concat_ws(E'\\n— Нэмэлт: ', description, $2::text) WHERE id = $1`, [id, description]);
    await history.log(c, { requestId: id, oldStatus: 'NEED_INFO', newStatus: 'SUBMITTED', reason: 'Нэмэлт мэдээлэл нөхсөн', userId: user.id });
    await history.notifyCoordinators(c, r.organization_id, id, `${r.request_no} хүсэлтэд нэмэлт мэдээлэл ирлээ`);
    return { id, status: 'SUBMITTED' };
  });
}

/** 3.6 Хүсэлт цуцлах (BR-06) */
async function cancel(user, id) {
  return tx(async (c) => {
    const r = await lockForUpdate(c, id);
    if (Number(r.requester_id) !== Number(user.id)) throw forbidden();
    if (!CANCELLABLE.includes(r.status)) throw conflict('NOT_CANCELLABLE', 'Энэ төлөвт цуцлах боломжгүй. Зохицуулагчид хандана уу.');
    await c.query(`UPDATE requests SET status = 'CANCELLED' WHERE id = $1`, [id]);
    await history.log(c, { requestId: id, oldStatus: r.status, newStatus: 'CANCELLED', reason: 'Хүсэлт гаргагч цуцалсан', userId: user.id });
    return { id, status: 'CANCELLED' };
  });
}

module.exports = { submit, addAttachment, get, mine, forCoordinator, decide, supplyInfo, cancel, canView, CANCELLABLE };
