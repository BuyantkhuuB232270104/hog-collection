const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const S = require('./schemas');
const validate = require('../middleware/validate');
const { authenticate, requireRole, sign, setCookie, COOKIE, orgIds } = require('../middleware/auth');
const { bad, notFound } = require('../errors');
const { q } = require('../db/pool');
const auth = require('../services/auth');
const schedules = require('../services/schedules');
const requests = require('../services/requests');
const jobs = require('../services/jobs');
const complaints = require('../services/complaints');
const reports = require('../services/reports');
const admin = require('../services/admin');
const audit = require('../services/audit');
const dashboard = require('../services/dashboard');
const { pool } = require('../db/pool');

const r = express.Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then(data => { if (!res.headersSent) res.json(data ?? { ok: true }); }).catch(next);
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ulaanbaatar' });

// ---------- Нийтийн (нэвтрэлгүй) ----------
r.get('/zones', h(() => schedules.listZones()));
r.get('/zones/:id/schedule', h(req => schedules.currentSchedule(S.id.parse(req.params.id), S.date.safeParse(req.query.date).data || today())));
r.get('/waste-types', h(async () => (await q('SELECT id, name FROM waste_types WHERE active ORDER BY id')).rows));
r.get('/addresses', h(async (req) => (await q(`SELECT a.id, a.soum, a.bag, a.street, a.zone_id, z.name AS zone_name FROM addresses a
  JOIN service_zones z ON z.id = a.zone_id WHERE ($1::text IS NULL OR a.street ILIKE '%' || $1 || '%' OR a.bag ILIKE '%' || $1 || '%')
  ORDER BY a.soum, a.bag, a.street LIMIT 50`, [req.query.q || null])).rows));
r.get('/health', h(async () => { await pool.query('SELECT 1'); return { ok: true, time: new Date().toISOString() }; }));
r.get('/meta', h(() => ({ notDoneReasons: jobs.NOT_DONE_REASONS })));

// ---------- UC-01 Бүртгэл, нэвтрэлт ----------
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
r.post('/auth/register', authLimiter, validate(S.register), h(async (req, res) => { const u = await auth.register(req.valid); res.status(201); return u; }));
r.post('/auth/login', authLimiter, validate(S.login), h(async (req, res) => {
  let u;
  try { u = await auth.login(req.valid); }
  catch (e) { if (e.code === 'BAD_CREDENTIALS' || e.code === 'TOO_MANY_ATTEMPTS') await audit.log(req, e.code === 'BAD_CREDENTIALS' ? 'LOGIN_FAIL' : 'LOGIN_LOCKED', { detail: req.valid.login }); throw e; }
  setCookie(res, sign(u)); await audit.log(req, 'LOGIN_OK', { userId: u.id }); return { ok: true };
}));
r.post('/auth/logout', h((req, res) => { res.clearCookie(COOKIE); }));
const publicUser = ({ pwd_at, ...u }) => u; // дотоод талбарыг клиентэд өгөхгүй
r.get('/auth/me', authenticate, h(async req => ({ ...publicUser(req.user), unread: await complaints.unreadCount(req.user) })));
r.post('/auth/password', authenticate, authLimiter, validate(S.changePassword), h(async (req, res) => {
  await auth.changePassword(req.user.id, req.valid);
  await audit.log(req, 'PASSWORD_CHANGE', { entity: 'user', entityId: req.user.id });
  setCookie(res, sign(req.user)); return { ok: true };
}));
r.patch('/auth/profile', authenticate, validate(S.profile), h(async req => {
  const u = await auth.updateProfile(req.user.id, req.valid); await audit.log(req, 'PROFILE_UPDATE', { entity: 'user', entityId: req.user.id }); return u;
}));

// ---------- UC-02 Хуваарь ----------
r.post('/schedules', authenticate, requireRole('coordinator'), validate(S.schedule), h(async (req, res) => {
  const o = await schedules.publish(req.user, req.valid, orgIds(req.user, 'coordinator'));
  await audit.log(req, 'SCHEDULE_PUBLISH', { entity: 'zone', entityId: req.valid.zoneId }); res.status(201); return o;
}));

// ---------- UC-03 Хүсэлт ----------
r.post('/requests', authenticate, validate(S.request), h(async (req, res) => {
  const key = req.get('Idempotency-Key');
  if (key && !/^[0-9a-f-]{36}$/i.test(key)) throw bad('BAD_KEY', 'Idempotency-Key UUID байх ёстой.');
  const d = req.valid;
  const dto = { ...d, preferredFrom: d.preferredDate && d.preferredFrom ? `${d.preferredDate} ${d.preferredFrom}+08` : null,
    preferredTo: d.preferredDate && d.preferredTo ? `${d.preferredDate} ${d.preferredTo}+08` : null };
  const out = await requests.submit(req.user, dto, key);
  res.status(out.duplicate ? 200 : 201); return out;
}));
r.get('/requests/mine', authenticate, h(req => requests.mine(req.user)));
r.get('/requests', authenticate, requireRole('coordinator'), validate(S.requestSearch, 'query'), h(req => requests.forCoordinator(req.user, req.valid)));
r.get('/requests/:id', authenticate, h(req => requests.get(req.user, S.id.parse(req.params.id))));
r.post('/requests/:id/cancel', authenticate, h(req => requests.cancel(req.user, S.id.parse(req.params.id))));
r.post('/requests/:id/info', authenticate, validate(S.supply), h(req => requests.supplyInfo(req.user, S.id.parse(req.params.id), req.valid)));
r.patch('/requests/:id/decision', authenticate, requireRole('coordinator'), validate(S.decision), h(req => requests.decide(req.user, S.id.parse(req.params.id), req.valid)));

// 3.4 Зураг хавсаргах: JPG/PNG, ≤ 5 МБ (FR-30)
fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: config.uploadDir, filename: (req, file, cb) => cb(null, crypto.randomUUID() + (file.mimetype === 'image/png' ? '.png' : '.jpg')) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(['image/jpeg', 'image/png'].includes(file.mimetype) ? null : bad('BAD_FILE', 'Зөвхөн JPG, PNG зураг.'), true),
});
r.post('/requests/:id/attachments', authenticate, upload.single('file'), h(async (req, res) => {
  if (!req.file) throw bad('NO_FILE', 'Файл сонгоно уу.');
  res.status(201); return requests.addAttachment(req.user, S.id.parse(req.params.id), req.file);
}));
r.get('/attachments/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await q('SELECT a.file_path, a.request_id FROM attachments a WHERE a.id = $1', [S.id.parse(req.params.id)]);
    if (!rows[0]) throw notFound();
    await requests.get(req.user, rows[0].request_id); // эрх шалгана
    res.sendFile(path.resolve(config.uploadDir, path.basename(rows[0].file_path)));
  } catch (e) { next(e); }
});

// ---------- UC-05 Ажил хуваарилалт ----------
r.get('/drivers', authenticate, requireRole('coordinator'), h(req => jobs.drivers(req.user, S.date.safeParse(req.query.date).data || today())));
r.get('/jobs', authenticate, requireRole('coordinator'), h(req => jobs.forCoordinator(req.user, S.date.safeParse(req.query.date).data || today())));
r.post('/jobs', authenticate, requireRole('coordinator'), validate(S.assign), h(async (req, res) => { res.status(201); return jobs.assign(req.user, req.valid); }));
r.patch('/jobs/:id', authenticate, requireRole('coordinator'), validate(S.jobChange), h(req => jobs.change(req.user, S.id.parse(req.params.id), req.valid)));

// ---------- UC-06 Гүйцэтгэл ----------
r.get('/jobs/today', authenticate, requireRole('driver'), h(req => jobs.today(req.user, S.date.safeParse(req.query.date).data || today())));
r.patch('/jobs/:id/status', authenticate, requireRole('driver'), validate(S.jobRecord), h(req => jobs.record(req.user, S.id.parse(req.params.id), req.valid)));

// ---------- UC-04 Гомдол, мэдэгдэл ----------
r.post('/complaints', authenticate, validate(S.complaint), h(async (req, res) => { res.status(201); return complaints.create(req.user, req.valid); }));
r.get('/complaints', authenticate, requireRole('coordinator'), h(req => complaints.list(req.user)));
r.patch('/complaints/:id', authenticate, requireRole('coordinator'), validate(S.complaintStatus), h(req => complaints.setStatus(req.user, S.id.parse(req.params.id), req.valid)));
r.get('/notifications', authenticate, h(req => complaints.notifications(req.user)));
r.post('/notifications/read', authenticate, h(req => complaints.markRead(req.user)));

// ---------- Нүүр хуудасны товч тоо ----------
r.get('/dashboard', authenticate, requireRole('coordinator', 'manager'), h(req => dashboard.summary(req.user, today())));

// ---------- UC-07 Тайлан ----------
const reportRoute = (fn, name) => [authenticate, requireRole('manager', 'coordinator'), validate(S.reportQuery, 'query'), h(async (req, res) => {
  const rep = await fn(req.user, req.valid);
  if (req.valid.format !== 'csv') return rep;
  res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="${name}_${req.valid.from}_${req.valid.to}.csv"`);
  res.send(reports.toCsv(rep));
})];
r.get('/reports/performance', ...reportRoute(reports.performance, 'guitsetgel'));
r.get('/reports/requests', ...reportRoute(reports.requestsReport, 'husel'));

// ---------- UC-01 Админ ----------
const A = [authenticate, requireRole('admin')];
r.get('/admin/users', ...A, h(() => admin.users()));
r.post('/admin/users', ...A, validate(S.staff), h(async (req, res) => { const u = await admin.createStaff(req.valid); await audit.log(req, 'USER_CREATE', { entity: 'user', entityId: u.id, detail: req.valid.role }); res.status(201); return u; }));
r.post('/admin/users/:id/verify', ...A, h(async req => { const id = S.id.parse(req.params.id); const o = await admin.verifyBusiness(id); await audit.log(req, 'USER_VERIFY', { entity: 'user', entityId: id }); return o; }));
r.post('/admin/users/:id/status', ...A, h(async req => {
  const id = S.id.parse(req.params.id);
  if (id === Number(req.user.id) && req.body.status === 'disabled') throw bad('SELF_DISABLE', 'Өөрийн бүртгэлийг идэвхгүй болгох боломжгүй.');
  const o = await admin.setUserStatus(id, req.body.status); await audit.log(req, 'USER_STATUS', { entity: 'user', entityId: id, detail: req.body.status }); return o;
}));
r.post('/admin/users/:id/password', ...A, validate(S.resetPassword), h(async req => {
  const id = S.id.parse(req.params.id); const o = await auth.resetPassword(id, req.valid.password);
  await audit.log(req, 'PASSWORD_RESET', { entity: 'user', entityId: id }); return o;
}));
r.get('/admin/audit', ...A, h(req => audit.list({ limit: req.query.limit, action: req.query.action })));
r.post('/admin/users/:id/roles', ...A, validate(S.role), h(async req => { const id = S.id.parse(req.params.id); const o = await admin.assignRole(id, req.valid); await audit.log(req, 'ROLE_ASSIGN', { entity: 'user', entityId: id, detail: req.valid.role }); return o; }));
r.delete('/admin/user-roles/:id', ...A, h(async req => { const id = S.id.parse(req.params.id); const o = await admin.revokeRole(id); await audit.log(req, 'ROLE_REVOKE', { entity: 'user_role', entityId: id }); return o; }));
r.get('/admin/lookups/:name', ...A, h(req => admin.list(req.params.name)));
r.post('/admin/lookups/:name', ...A, h(async (req, res) => { const o = await admin.create(req.params.name, req.body); await audit.log(req, 'LOOKUP_CREATE', { entity: req.params.name, entityId: o.id }); res.status(201); return o; }));
r.patch('/admin/lookups/:name/:id', ...A, h(async req => { const id = S.id.parse(req.params.id); const o = await admin.update(req.params.name, id, req.body); await audit.log(req, 'LOOKUP_UPDATE', { entity: req.params.name, entityId: id }); return o; }));

module.exports = r;
