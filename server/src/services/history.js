/** Төлөвийн түүх (BR-08) ба мэдэгдэл (FR-26) — дуудагч транзакцын client-ийг дамжуулна */
async function log(c, { requestId, jobId = null, oldStatus = null, newStatus, reason = null, userId }) {
  await c.query(`INSERT INTO status_history (request_id, job_id, old_status, new_status, reason, changed_by)
    VALUES ($1,$2,$3,$4,$5,$6)`, [requestId, jobId, oldStatus, newStatus, reason, userId]);
}
async function notify(c, userId, requestId, message) {
  if (!userId) return;
  await c.query('INSERT INTO notifications (user_id, request_id, message) VALUES ($1,$2,$3)', [userId, requestId, message]);
}
/** Тухайн байгууллагын бүх зохицуулагчид мэдэгдэх */
async function notifyCoordinators(c, organizationId, requestId, message) {
  const { rows } = await c.query(`SELECT DISTINCT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'coordinator' AND ur.organization_id = $1`, [organizationId]);
  for (const r of rows) await notify(c, r.user_id, requestId, message);
}
module.exports = { log, notify, notifyCoordinators };
