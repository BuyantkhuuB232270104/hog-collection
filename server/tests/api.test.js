// Интеграцийн тест: баримтын 3.7.2-ын тестийн тохиолдлууд (TC-01 … TC-17).
// Тусдаа өгөгдлийн сан ашиглана: DATABASE_URL=.../hog_test npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('../src/config'); // .env-ийг ачаална
if (!/hog_test/.test(process.env.DATABASE_URL || '')) throw new Error('Тестийг зөвхөн hog_test өгөгдлийн сан дээр ажиллуулна (DATABASE_URL).');
const request = require('supertest');
const app = require('../src/app');
const { pool, q } = require('../src/db/pool');
const { seed, PASSWORD } = require('../src/db/seed');
const { _resetLoginLimiter } = require('../src/services/auth');

const TZ = 'Asia/Ulaanbaatar';
const day = (o = 0) => new Date(Date.now() + o * 864e5).toLocaleDateString('sv-SE', { timeZone: TZ });
let S; // seed ids
const agents = {};
async function login(name, loginId, password = PASSWORD) {
  const a = request.agent(app);
  const r = await a.post('/api/auth/login').send({ login: loginId, password });
  assert.equal(r.status, 200, `${loginId} нэвтэрч чадсангүй: ${JSON.stringify(r.body)}`);
  agents[name] = a; return a;
}
const newReq = (a, body = {}, key) => {
  let r = a.post('/api/requests');
  if (key) r = r.set('Idempotency-Key', key);
  return r.send({ addressId: 1, wasteTypeId: 2, description: 'Тест', ...body });
};
async function approved(a = agents.citizen) {
  const r = await newReq(a); await agents.coord.patch(`/api/requests/${r.body.id}/decision`).send({ decision: 'approve' }); return r.body.id;
}

before(async () => {
  S = await seed({ withSamples: false });
  _resetLoginLimiter();
  await login('citizen', '99000001'); await login('coord', '90000002'); await login('d1', '90000003'); await login('d2', '90000004');
  await login('manager', '90000005'); await login('admin', '90000001');
});
after(() => pool.end());

test('TC-01 Бүртгүүлэх: зөвшөөрөлгүй бол үүсэхгүй, зөвшөөрөлтэй бол үүснэ (FR-01, BR-01)', async () => {
  const base = { fullName: 'Тест Иргэн', phone: '88000001', password: 'Password1' };
  const no = await request(app).post('/api/auth/register').send({ ...base, consent: false });
  assert.equal(no.status, 400);
  const ok = await request(app).post('/api/auth/register').send({ ...base, consent: true });
  assert.equal(ok.status, 201); assert.equal(ok.body.status, 'active');
  const { rows } = await q('SELECT consent_at FROM users WHERE phone = $1', ['88000001']);
  assert.ok(rows[0].consent_at, 'зөвшөөрлийн огноо хадгалагдсан');
  const dup = await request(app).post('/api/auth/register').send({ ...base, consent: true });
  assert.equal(dup.status, 409);
  const biz = await request(app).post('/api/auth/register').send({ fullName: 'ААН Тест', phone: '88000002', password: 'Password1', consent: true, accountType: 'business', organizationName: 'Тест ХХК' });
  assert.equal(biz.body.status, 'pending'); // FR-02
});

test('TC-02 Нэвтрэх: буруу нууц үгэнд ерөнхий алдаа, 5 удаа буруу бол түр хаана', async () => {
  const bad = await request(app).post('/api/auth/login').send({ login: '88000001', password: 'wrong' });
  assert.equal(bad.status, 401); assert.match(bad.body.error.message, /нэр эсвэл нууц үг буруу/);
  for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({ login: '88000001', password: 'wrong' });
  const locked = await request(app).post('/api/auth/login').send({ login: '88000001', password: 'Password1' });
  assert.equal(locked.status, 429);
  _resetLoginLimiter();
  const me = await agents.coord.get('/api/auth/me');
  assert.ok(me.body.roles.some(r => r.code === 'coordinator'));
});

test('TC-03 Хуваарь: шинэ хувилбар нийтлэхэд нэвтрээгүй хэрэглэгч зөвхөн хүчинтэй хувилбарыг харна (FR-08, 09)', async () => {
  const pub = await agents.coord.post('/api/schedules').send({ zoneId: S.zones[0], validFrom: day(0), note: 'Шинэ хуваарь', slots: [{ weekday: 3, timeFrom: '09:00', timeTo: '11:00' }] });
  assert.equal(pub.status, 201); assert.equal(pub.body.version, 2);
  const now = await request(app).get(`/api/zones/${S.zones[0]}/schedule`);
  assert.equal(now.body.version, 2); assert.equal(now.body.slots.length, 1); assert.equal(now.body.note, 'Шинэ хуваарь');
  const old = await request(app).get(`/api/zones/${S.zones[0]}/schedule?date=${day(-3)}`);
  assert.equal(old.body.version, 1);
  const forbidden = await agents.citizen.post('/api/schedules').send({ zoneId: S.zones[0], validFrom: day(0), slots: [{ weekday: 1, timeFrom: '09:00', timeTo: '11:00' }] });
  assert.equal(forbidden.status, 403);
});

test('TC-04 Хүсэлт илгээх: дугаар олгоно; бүсээс гадуур хаягт хадгалахгүй; зураг ≤ 5 МБ (FR-10–12, 30)', async () => {
  const r = await newReq(agents.citizen, { preferredDate: day(2), preferredFrom: '10:00', preferredTo: '12:00' });
  assert.equal(r.status, 201); assert.match(r.body.request_no, /^ХЦ-\d{4}-\d{6}$/); assert.equal(r.body.status, 'SUBMITTED');
  const out = await newReq(agents.citizen, { addressId: 99999 });
  assert.equal(out.status, 400); assert.equal(out.body.error.code, 'OUT_OF_ZONE');
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  const up = await agents.citizen.post(`/api/requests/${r.body.id}/attachments`).attach('file', png, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(up.status, 201);
  const big = await agents.citizen.post(`/api/requests/${r.body.id}/attachments`).attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'b.png', contentType: 'image/png' });
  assert.equal(big.status, 400);
  const phone = await agents.coord.post('/api/requests').send({ addressId: 2, wasteTypeId: 1, channel: 'phone', contactName: 'Утсаар залгагч', contactPhone: '99112233' });
  assert.equal(phone.status, 201);
  const { rows } = await q('SELECT channel FROM requests WHERE id = $1', [phone.body.id]);
  assert.equal(rows[0].channel, 'phone');
});

test('TC-05 Давхар илгээлт: ижил түлхүүрээр 10 удаа (2 нь зэрэг) илгээхэд 1 хүсэлт үүснэ (NFR-03, BR-09)', async () => {
  const key = crypto.randomUUID();
  const [a, b] = await Promise.all([newReq(agents.citizen, {}, key), newReq(agents.citizen, {}, key)]);
  const rest = []; for (let i = 0; i < 8; i++) rest.push(await newReq(agents.citizen, {}, key));
  const nos = new Set([a, b, ...rest].map(r => r.body.request_no));
  assert.equal(nos.size, 1);
  const { rows } = await q('SELECT count(*)::int AS n FROM requests WHERE idempotency_key = $1', [key]);
  assert.equal(rows[0].n, 1);
});

test('TC-06 Хүсэлт шийдвэрлэх: батлах — төлөв, түүх, мэдэгдэл; шалтгаангүй татгалзахгүй (FR-13–15, 24, 26)', async () => {
  const r = (await newReq(agents.citizen)).body;
  const noReason = await agents.coord.patch(`/api/requests/${r.id}/decision`).send({ decision: 'reject' });
  assert.equal(noReason.status, 400);
  const info = await agents.coord.patch(`/api/requests/${r.id}/decision`).send({ decision: 'need_info', reason: 'Хэдэн шуудай вэ?' });
  assert.equal(info.body.status, 'NEED_INFO');
  await agents.citizen.post(`/api/requests/${r.id}/info`).send({ description: '4 шуудай' });
  const ok = await agents.coord.patch(`/api/requests/${r.id}/decision`).send({ decision: 'approve' });
  assert.equal(ok.body.status, 'APPROVED');
  const d = await agents.citizen.get(`/api/requests/${r.id}`);
  assert.deepEqual(d.body.history.map(h => h.new_status), ['SUBMITTED', 'NEED_INFO', 'SUBMITTED', 'APPROVED']);
  const n = await agents.citizen.get('/api/notifications');
  assert.ok(n.body.some(x => x.message.includes(r.request_no) && x.message.includes('батлагдлаа')));
  const again = await agents.coord.patch(`/api/requests/${r.id}/decision`).send({ decision: 'approve' });
  assert.equal(again.status, 409); // төлөв өөрчлөгдсөн
});

test('TC-07 Ажил хуваарилах, дахин хуваарилах, хойшлуулах, цуцлах (FR-16, 22, 31, 32)', async () => {
  const id = await approved();
  const a = await agents.coord.post('/api/jobs').send({ requestId: id, date: day(3), timeFrom: '08:00', timeTo: '09:00', assigneeId: S.d1 });
  assert.equal(a.status, 201);
  const re = await agents.coord.patch(`/api/jobs/${a.body.jobId}`).send({ action: 'reassign', reason: 'Машин эвдэрсэн', date: day(3), timeFrom: '09:00', timeTo: '10:00', assigneeId: S.d2 });
  assert.equal(re.body.status, 'PLANNED');
  const noReason = await agents.coord.patch(`/api/jobs/${a.body.jobId}`).send({ action: 'postpone' });
  assert.equal(noReason.status, 400);
  const pp = await agents.coord.patch(`/api/jobs/${a.body.jobId}`).send({ action: 'postpone', reason: 'Цас орсон' });
  assert.equal(pp.body.status, 'POSTPONED');
  await agents.coord.patch(`/api/jobs/${a.body.jobId}`).send({ action: 'reassign', reason: 'Шинэ өдөр', date: day(4), timeFrom: '09:00', timeTo: '10:00', assigneeId: S.d2 });
  const c = await agents.coord.patch(`/api/jobs/${a.body.jobId}`).send({ action: 'cancel', reason: 'Иргэн өөрөө зөөсөн' });
  assert.equal(c.body.status, 'CANCELLED');
  const r = await agents.citizen.get(`/api/requests/${id}`);
  assert.equal(r.body.status, 'APPROVED'); // дахин хуваарилах боломжтой
});

test('TC-08 Давхцал: 10:00–12:00 оноосон гүйцэтгэгчид 11:00–13:00 өгөхгүй, зэрэг ч өгөхгүй (FR-17, BR-05)', async () => {
  const id1 = await approved(); const id2 = await approved(); const id3 = await approved();
  const a = await agents.coord.post('/api/jobs').send({ requestId: id1, date: day(5), timeFrom: '10:00', timeTo: '12:00', assigneeId: S.d1 });
  assert.equal(a.status, 201);
  const b = await agents.coord.post('/api/jobs').send({ requestId: id2, date: day(5), timeFrom: '11:00', timeTo: '13:00', assigneeId: S.d1 });
  assert.equal(b.status, 409); assert.equal(b.body.error.code, 'OVERLAP'); assert.ok(b.body.error.details.request_no);
  const edge = await agents.coord.post('/api/jobs').send({ requestId: id2, date: day(5), timeFrom: '12:00', timeTo: '13:00', assigneeId: S.d1 });
  assert.equal(edge.status, 201, '[10,12) ба [12,13) давхцахгүй');
  // Зэрэг хоёр хуваарилалт: exclusion constraint нэгийг нь л зөвшөөрнө
  const id4 = await approved();
  const [x, y] = await Promise.all([
    agents.coord.post('/api/jobs').send({ requestId: id3, date: day(6), timeFrom: '14:00', timeTo: '15:00', assigneeId: S.d1 }),
    agents.coord.post('/api/jobs').send({ requestId: id4, date: day(6), timeFrom: '14:30', timeTo: '15:30', assigneeId: S.d1 }),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [201, 409]);
});

test('TC-09 Гүйцэтгэл: эхлүүлэх → дууссан; хугацаа, түүх бичигдэнэ (FR-18–20, 24)', async () => {
  const id = await approved();
  const j = (await agents.coord.post('/api/jobs').send({ requestId: id, date: day(0), timeFrom: '06:00', timeTo: '07:00', assigneeId: S.d2 })).body;
  const list = await agents.d2.get(`/api/jobs/today?date=${day(0)}`);
  assert.ok(list.body.some(x => x.id === j.jobId));
  const early = await agents.d2.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'done' });
  assert.equal(early.status, 409);
  await agents.d2.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'start' });
  const done = await agents.d2.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'done' });
  assert.equal(done.body.status, 'DONE');
  const { rows } = await q('SELECT started_at, finished_at FROM jobs WHERE id = $1', [j.jobId]);
  assert.ok(rows[0].started_at && rows[0].finished_at);
  const r = await agents.citizen.get(`/api/requests/${id}`);
  assert.equal(r.body.status, 'DONE'); assert.ok(r.body.can_complain);
  const other = await agents.d1.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'start' });
  assert.equal(other.status, 403); // BR-10
});

test('TC-10 Гүйцэтгээгүй: шалтгаангүй бол хадгалахгүй; шалтгаантай бол зохицуулагчид мэдэгдэнэ (FR-21, BR-04)', async () => {
  const id = await approved();
  const j = (await agents.coord.post('/api/jobs').send({ requestId: id, date: day(0), timeFrom: '07:00', timeTo: '08:00', assigneeId: S.d2 })).body;
  await agents.d2.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'start' });
  const no = await agents.d2.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'not_done' });
  assert.equal(no.status, 400);
  const yes = await agents.d2.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'not_done', reason: 'Хаалга, хашаа хаалттай' });
  assert.equal(yes.body.status, 'NOT_DONE');
  const n = await agents.coord.get('/api/notifications');
  assert.ok(n.body.some(x => x.message.includes('гүйцэтгэгдсэнгүй')));
  // Өгөгдлийн сангийн хамгаалалт: шалтгаангүй NOT_DONE шууд ч хадгалагдахгүй
  await assert.rejects(q(`UPDATE jobs SET status = 'NOT_DONE', reason = NULL WHERE id = $1`, [j.jobId]), /jobs_check/);
});

test('TC-11 Тайлан, CSV: тоо эх бүртгэлтэй таарна; CSV-д нэр, утас, хаяг гарахгүй (FR-25, 29, NFR-07, 10)', async () => {
  const from = day(-1), to = day(10);
  const rep = await agents.manager.get(`/api/reports/performance?from=${from}&to=${to}`);
  assert.equal(rep.status, 200);
  const { rows } = await q(`SELECT count(*)::int AS n FROM jobs WHERE (lower(planned_window) AT TIME ZONE '${TZ}')::date BETWEEN $1 AND $2`, [from, to]);
  assert.equal(rep.body.total.jobs, rows[0].n);
  const csv = await agents.manager.get(`/api/reports/requests?from=${from}&to=${to}&format=csv`);
  assert.match(csv.headers['content-type'], /text\/csv/);
  for (const secret of ['Иргэн-01', '99000001', 'Жишээ гудамж', 'Утсаар залгагч', '99112233']) assert.ok(!csv.text.includes(secret), `CSV-д ${secret} гарсан`);
  const t0 = Date.now(); await agents.manager.get(`/api/reports/performance?from=${from}&to=${to}`); assert.ok(Date.now() - t0 < 10000);
});

test('TC-12 Эрхийн хязгаар: 12 сөрөг хандалт 403/401 (NFR-01, FR-23, 27)', async () => {
  const mine = (await newReq(agents.citizen)).body;
  const other = (await request(app).post('/api/auth/register').send({ fullName: 'Өөр иргэн', phone: '88000009', password: 'Password1', consent: true }));
  assert.equal(other.status, 201);
  const o = await login('other', '88000009', 'Password1');
  const checks = [
    o.get(`/api/requests/${mine.id}`), o.post(`/api/requests/${mine.id}/cancel`), o.post(`/api/requests/${mine.id}/info`).send({ description: 'халдлага' }),
    agents.citizen.get('/api/requests'), agents.citizen.patch(`/api/requests/${mine.id}/decision`).send({ decision: 'approve' }),
    agents.citizen.post('/api/jobs').send({ requestId: mine.id, date: day(1), timeFrom: '10:00', timeTo: '11:00', assigneeId: S.d1 }),
    agents.citizen.get(`/api/reports/performance?from=${day(-1)}&to=${day(1)}`), agents.d1.get('/api/admin/users'),
    agents.coord.get('/api/admin/users'), agents.d1.get('/api/requests'), agents.manager.post('/api/schedules').send({}),
    request(app).get('/api/requests/mine'),
  ];
  const res = await Promise.all(checks);
  res.forEach((r, i) => assert.ok([401, 403].includes(r.status), `шалгалт ${i + 1}: ${r.status}`));
  assert.equal(res.length, 12);
  const own = await agents.citizen.post(`/api/requests/${mine.id}/cancel`);
  assert.equal(own.body.status, 'CANCELLED');
});

test('TC-13 Нууц үг зөвхөн Argon2id хэшээр хадгалагдана (NFR-02)', async () => {
  const { rows } = await q('SELECT password_hash FROM users');
  assert.ok(rows.length > 0);
  for (const r of rows) { assert.match(r.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/); assert.ok(!r.password_hash.includes(PASSWORD)); }
});

test('TC-16 Лавлах, эрх: бүс нэмэх, ажилтанд үүрэг оноох, ААН баталгаажуулах (FR-02, 04–07)', async () => {
  const z = await agents.admin.post('/api/admin/lookups/service_zones').send({ organization_id: S.org, name: '4-р бүс (тест)', soum: 'Дархан', bag: '5-р баг' });
  assert.equal(z.status, 201);
  const zones = await request(app).get('/api/zones');
  assert.ok(zones.body.some(x => x.name === '4-р бүс (тест)'));
  const st = await agents.admin.post('/api/admin/users').send({ fullName: 'Шинэ жолооч', phone: '88000010', password: 'Password1', role: 'driver', organizationId: S.org });
  assert.equal(st.status, 201);
  const noOrg = await agents.admin.post('/api/admin/users').send({ fullName: 'Хүрээгүй', phone: '88000011', password: 'Password1', role: 'coordinator' });
  assert.equal(noOrg.status, 400);
  const users = (await agents.admin.get('/api/admin/users')).body;
  const pending = users.find(u => u.status === 'pending');
  const v = await agents.admin.post(`/api/admin/users/${pending.id}/verify`);
  assert.equal(v.body.status, 'active');
  await agents.admin.post(`/api/admin/users/${st.body.id}/status`).send({ status: 'disabled' });
  const dis = await request(app).post('/api/auth/login').send({ login: '88000010', password: 'Password1' });
  assert.equal(dis.status, 401);
});

test('TC-17 Гомдол: дууссан ажилд гаргана, өөр хүний ажилд гаргахгүй, зохицуулагч төлөв өөрчилнө (FR-28, 33)', async () => {
  const id = await approved();
  const j = (await agents.coord.post('/api/jobs').send({ requestId: id, date: day(0), timeFrom: '05:00', timeTo: '06:00', assigneeId: S.d1 })).body;
  const early = await agents.citizen.post('/api/complaints').send({ requestId: id, body: 'Ирээгүй байна шүү' });
  assert.equal(early.status, 400);
  await agents.d1.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'start' });
  await agents.d1.patch(`/api/jobs/${j.jobId}/status`).send({ result: 'done' });
  const c = await agents.citizen.post('/api/complaints').send({ requestId: id, body: 'Хогийн зарим хэсэг үлдсэн' });
  assert.equal(c.status, 201);
  const notMine = await agents.other.post('/api/complaints').send({ requestId: id, body: 'Өөр хүний гомдол' });
  assert.equal(notMine.status, 403);
  const list = await agents.coord.get('/api/complaints');
  assert.ok(list.body.some(x => x.id === c.body.id));
  const st = await agents.coord.patch(`/api/complaints/${c.body.id}`).send({ status: 'RESOLVED', note: 'Дахин очиж ачсан' });
  assert.equal(st.body.status, 'RESOLVED');
});

test('BR-08 Төлөвийн түүхийг засах, устгах боломжгүй (trigger)', async () => {
  await assert.rejects(q('DELETE FROM status_history WHERE id = (SELECT min(id) FROM status_history)'), /засах\/устгах хориотой/);
  await assert.rejects(q(`UPDATE status_history SET reason = 'x' WHERE id = (SELECT min(id) FROM status_history)`), /засах\/устгах хориотой/);
});

// ---------- Нэмэлт сайжруулалтын тестүүд (TC-18 …) ----------
test('TC-18 Нууц үг солих: буруу одоогийн нууц үг, сул нууц үгийг татгалзаж, солисны дараа хуучин сесс хүчингүй болно', async () => {
  const reg = await request(app).post('/api/auth/register').send({ fullName: 'Нууц Үг Тест', phone: '88000018', password: 'Password1', consent: true });
  assert.equal(reg.status, 201);
  const a = await login('pw', '88000018', 'Password1');
  const wrong = await a.post('/api/auth/password').send({ currentPassword: 'Nope12345', newPassword: 'NewPassw0rd' });
  assert.equal(wrong.status, 400); assert.equal(wrong.body.error.code, 'BAD_CURRENT_PASSWORD');
  const weak = await a.post('/api/auth/password').send({ currentPassword: 'Password1', newPassword: 'abcdefgh' });
  assert.equal(weak.status, 400); assert.ok(weak.body.error.details.newPassword);
  const same = await a.post('/api/auth/password').send({ currentPassword: 'Password1', newPassword: 'Password1' });
  assert.equal(same.status, 400);
  // хуучин сесс (өөр төхөөрөмж) нууц үг солигдсоны дараа хүчингүй
  const old = request.agent(app); await old.post('/api/auth/login').send({ login: '88000018', password: 'Password1' });
  await new Promise(r => setTimeout(r, 1100)); // токены iat нь солигдох секундээс өмнө байхын тулд
  const ok = await a.post('/api/auth/password').send({ currentPassword: 'Password1', newPassword: 'NewPassw0rd' });
  assert.equal(ok.status, 200);
  assert.equal((await old.get('/api/auth/me')).status, 401, 'хуучин токен хүчингүй');
  assert.equal((await a.get('/api/auth/me')).status, 200, 'шинэ токентой одоогийн сесс хэвээр');
  assert.equal((await request(app).post('/api/auth/login').send({ login: '88000018', password: 'Password1' })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ login: '88000018', password: 'NewPassw0rd' })).status, 200);
  const me = await a.get('/api/auth/me'); assert.ok(!('pwd_at' in me.body), 'дотоод талбар задрахгүй');
});

test('TC-19 Аудит бүртгэл: нэвтрэлт (амжилттай, амжилтгүй), нууц үг, админы үйлдэл бүртгэгдэж, зөвхөн админ харна', async () => {
  await request(app).post('/api/auth/login').send({ login: '88000018', password: 'wrongwrong1' });
  const forbidden = await agents.citizen.get('/api/admin/audit'); assert.equal(forbidden.status, 403);
  const r = await agents.admin.get('/api/admin/audit?limit=200'); assert.equal(r.status, 200);
  const actions = new Set(r.body.map(x => x.action));
  for (const a of ['LOGIN_OK', 'LOGIN_FAIL', 'PASSWORD_CHANGE']) assert.ok(actions.has(a), `${a} бүртгэгдсэн`);
  assert.ok(!JSON.stringify(r.body).includes('NewPassw0rd') && !JSON.stringify(r.body).includes('wrongwrong1'.slice(0, 5) + 'wrong1'), 'нууц үг бүртгэлд орохгүй');
  const u = await agents.admin.post('/api/admin/users').send({ fullName: 'Аудит Жолооч', phone: '88000019', password: 'Password1', role: 'driver', organizationId: S.org });
  const reset = await agents.admin.post(`/api/admin/users/${u.body.id}/password`).send({ password: 'ResetPass1' });
  assert.equal(reset.status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ login: '88000019', password: 'ResetPass1' })).status, 200);
  const self = await agents.admin.post(`/api/admin/users/${S.admin}/status`).send({ status: 'disabled' });
  assert.equal(self.status, 400, 'админ өөрийгөө идэвхгүй болгохгүй');
  const again = await agents.admin.get('/api/admin/audit?action=PASSWORD_RESET'); assert.ok(again.body.length >= 1);
});

test('TC-20 Профайл засах, нүүр хуудасны товч тоо, хайлт, health', async () => {
  const p = await agents.citizen.patch('/api/auth/profile').send({ fullName: 'Иргэн Шинэчилсэн', email: 'new.citizen@example.com' });
  assert.equal(p.status, 200); assert.equal(p.body.full_name, 'Иргэн Шинэчилсэн');
  const dup = await agents.coord.patch('/api/auth/profile').send({ fullName: 'Зохицуулагч', email: 'new.citizen@example.com' });
  assert.equal(dup.status, 409);
  const r = await newReq(agents.citizen, { description: 'Хайлтын тест уригдсан тавилга' });
  const found = await agents.coord.get('/api/requests?status=SUBMITTED&q=' + encodeURIComponent('уригдсан'));
  assert.ok(found.body.some(x => x.id === r.body.id), 'тайлбараар олдоно');
  const none = await agents.coord.get('/api/requests?status=SUBMITTED&q=' + encodeURIComponent('%'));
  assert.ok(!none.body.some(x => x.id === r.body.id), '% тэмдэгт wildcard биш');
  const dash = await agents.coord.get('/api/dashboard'); assert.equal(dash.status, 200);
  assert.ok(dash.body.requests.new >= 1); assert.ok('today' in dash.body);
  assert.equal((await agents.citizen.get('/api/dashboard')).status, 403);
  assert.equal((await request(app).get('/api/health')).status, 200);
});
