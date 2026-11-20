// Зохицуулагч, удирдлагын нүүр хуудасны товч тоо
const { q } = require('../db/pool');
const { orgIds } = require('../middleware/auth');

async function summary(user, today) {
  const orgs = orgIds(user, 'coordinator', 'manager');
  const reqs = await q(`SELECT r.status, count(*)::int AS n FROM requests r JOIN service_zones z ON z.id = r.zone_id
    WHERE z.organization_id = ANY($1) GROUP BY r.status`, [orgs]);
  const by = Object.fromEntries(reqs.rows.map(r => [r.status, r.n]));
  const jobs = await q(`SELECT j.status, count(*)::int AS n FROM jobs j JOIN requests r ON r.id = j.request_id JOIN service_zones z ON z.id = r.zone_id
    WHERE z.organization_id = ANY($1) AND (lower(j.planned_window) AT TIME ZONE 'Asia/Ulaanbaatar')::date = $2::date GROUP BY j.status`, [orgs, today]);
  const jb = Object.fromEntries(jobs.rows.map(r => [r.status, r.n]));
  const open = await q(`SELECT count(*)::int AS n FROM complaints cp JOIN jobs j ON j.id = cp.job_id JOIN requests r ON r.id = j.request_id JOIN service_zones z ON z.id = r.zone_id
    WHERE z.organization_id = ANY($1) AND cp.status <> 'RESOLVED'`, [orgs]);
  return {
    requests: { new: by.SUBMITTED || 0, needInfo: by.NEED_INFO || 0, toAssign: (by.APPROVED || 0) + (by.NOT_DONE || 0), assigned: by.ASSIGNED || 0 },
    today: { planned: (jb.PLANNED || 0) + (jb.POSTPONED || 0), started: jb.STARTED || 0, done: jb.DONE || 0, notDone: jb.NOT_DONE || 0 },
    openComplaints: open.rows[0].n,
  };
}
module.exports = { summary };
