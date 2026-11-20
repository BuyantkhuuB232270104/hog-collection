// UC-07 Тайлан удирдах (7.1–7.4). Хувийн мэдээлэл (нэр, утас, хаяг) гаргахгүй — NFR-10.
const { q } = require('../db/pool');
const { orgIds } = require('../middleware/auth');

const TZ = 'Asia/Ulaanbaatar';
/** 7.3 Огноо, бүс, гүйцэтгэгчээр шүүх */
function filter(user, { from, to, zoneId, assigneeId }, dateCol) {
  const params = [orgIds(user, 'manager', 'coordinator'), from, to];
  let where = `z.organization_id = ANY($1) AND (${dateCol} AT TIME ZONE '${TZ}')::date BETWEEN $2 AND $3`;
  if (zoneId) { params.push(zoneId); where += ` AND z.id = $${params.length}`; }
  if (assigneeId) { params.push(assigneeId); where += ` AND j.assignee_id = $${params.length}`; }
  return { where, params };
}

/** 7.1 Гүйцэтгэлийн тайлан: бүсээр бүлэглэсэн ажлын тоо, цагтаа биелсэн хувь */
async function performance(user, f) {
  const { where, params } = filter(user, f, 'lower(j.planned_window)');
  const { rows } = await q(`SELECT z.name AS zone,
      count(*)::int AS jobs,
      count(*) FILTER (WHERE j.status = 'DONE')::int AS done,
      count(*) FILTER (WHERE j.status = 'NOT_DONE')::int AS not_done,
      count(*) FILTER (WHERE j.status IN ('POSTPONED','CANCELLED'))::int AS postponed_cancelled,
      count(*) FILTER (WHERE j.status = 'DONE' AND j.finished_at <= upper(j.planned_window))::int AS on_time,
      (SELECT count(*)::int FROM complaints cp JOIN jobs j2 ON j2.id = cp.job_id JOIN requests r2 ON r2.id = j2.request_id
         WHERE r2.zone_id = z.id AND j2.id = ANY(array_agg(j.id))) AS complaints
    FROM jobs j JOIN requests r ON r.id = j.request_id JOIN service_zones z ON z.id = r.zone_id
    WHERE ${where} GROUP BY z.id, z.name ORDER BY z.name`, params);
  const total = rows.reduce((a, r) => ({ jobs: a.jobs + r.jobs, done: a.done + r.done, not_done: a.not_done + r.not_done,
    postponed_cancelled: a.postponed_cancelled + r.postponed_cancelled, on_time: a.on_time + r.on_time, complaints: a.complaints + r.complaints }),
    { jobs: 0, done: 0, not_done: 0, postponed_cancelled: 0, on_time: 0, complaints: 0 });
  return { columns: ['Бүс', 'Ажил', 'Дууссан', 'Гүйцэтгээгүй', 'Хойшилсон/цуцлагдсан', 'Цагтаа дууссан', 'Гомдол'],
    keys: ['zone', 'jobs', 'done', 'not_done', 'postponed_cancelled', 'on_time', 'complaints'], rows, total };
}

/** 7.2 Хүсэлтийн тайлан: бүсээр төлөв, сувгийн тоо */
async function requestsReport(user, f) {
  const { where, params } = filter(user, { ...f, assigneeId: null }, 'r.created_at');
  const { rows } = await q(`SELECT z.name AS zone, count(*)::int AS total,
      count(*) FILTER (WHERE r.status IN ('SUBMITTED','NEED_INFO'))::int AS pending,
      count(*) FILTER (WHERE r.status IN ('APPROVED','ASSIGNED'))::int AS in_progress,
      count(*) FILTER (WHERE r.status = 'DONE')::int AS done,
      count(*) FILTER (WHERE r.status = 'REJECTED')::int AS rejected,
      count(*) FILTER (WHERE r.status = 'CANCELLED')::int AS cancelled,
      count(*) FILTER (WHERE r.channel <> 'web')::int AS by_phone
    FROM requests r JOIN service_zones z ON z.id = r.zone_id LEFT JOIN jobs j ON j.request_id = r.id
    WHERE ${where} GROUP BY z.id, z.name ORDER BY z.name`, params);
  const keys = ['zone', 'total', 'pending', 'in_progress', 'done', 'rejected', 'cancelled', 'by_phone'];
  const total = Object.fromEntries(keys.slice(1).map(k => [k, rows.reduce((a, r) => a + r[k], 0)]));
  return { columns: ['Бүс', 'Нийт', 'Хүлээгдэж буй', 'Явагдаж буй', 'Гүйцэтгэгдсэн', 'Татгалзсан', 'Цуцлагдсан', 'Утсаар ирсэн'], keys, rows, total };
}

/** 7.4 CSV татах (Excel-д зөв нээгдэхээр UTF-8 BOM-той) */
function toCsv(report) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [report.columns.map(esc).join(','), ...report.rows.map(r => report.keys.map(k => esc(r[k])).join(','))];
  lines.push(['Нийт', ...report.keys.slice(1).map(k => report.total[k])].map(esc).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
module.exports = { performance, requestsReport, toCsv };
