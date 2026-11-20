// Хөгжүүлэлт, туршилтын ЖИШЭЭ өгөгдөл. Бүх нэр, хаяг, утас зохиомол.
const { pool, q } = require('./pool');
const init = require('./init');
const { hashPassword } = require('../services/auth');
const requests = require('../services/requests');
const jobs = require('../services/jobs');
const { loadUser } = require('../middleware/auth');

const PASSWORD = 'Demo12345';
const ulDate = (offset = 0) => { const d = new Date(Date.now() + offset * 86400000); return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ulaanbaatar' }); };

async function seed({ withSamples = true } = {}) {
  await init();
  await q(`INSERT INTO roles VALUES (1,'citizen'),(2,'business'),(3,'coordinator'),(4,'driver'),(5,'admin'),(6,'manager')`);
  const org = (await q(`INSERT INTO organizations (name, type) VALUES ('Хог тээврийн байгууллага (жишээ)', 'collector') RETURNING id`)).rows[0].id;
  await q(`INSERT INTO organizations (name, type) VALUES ('Сум, аймгийн ЗДТГ (жишээ)', 'government')`);
  const zones = [];
  for (const [name, bag] of [['1-р бүс (орон сууц)', '1-р баг'], ['2-р бүс (орон сууц)', '2-р баг'], ['3-р бүс (гэр хороолол)', '10-р баг']]) {
    zones.push((await q(`INSERT INTO service_zones (organization_id, name, soum, bag) VALUES ($1,$2,'Дархан',$3) RETURNING id`, [org, name, bag])).rows[0].id);
  }
  const streets = [['1-р баг', 'Жишээ гудамж 1, 5-р байр', 0], ['1-р баг', 'Жишээ гудамж 1, 7-р байр', 0], ['1-р баг', 'Жишээ гудамж 2, 12-р байр', 0],
    ['2-р баг', 'Жишээ өргөн чөлөө, 21-р байр', 1], ['2-р баг', 'Жишээ өргөн чөлөө, 23-р байр', 1],
    ['10-р баг', 'Жишээ гудамж 10, 4-р хашаа', 2], ['10-р баг', 'Жишээ гудамж 10, 15-р хашаа', 2], ['10-р баг', 'Жишээ гудамж 11, 2-р хашаа', 2]];
  for (const [bag, street, zi] of streets) await q(`INSERT INTO addresses (zone_id, soum, bag, street) VALUES ($1,'Дархан',$2,$3)`, [zones[zi], bag, street]);
  await q(`INSERT INTO waste_types VALUES (1,'Ахуйн хог', true),(2,'Том оврын ахуйн хог', true),(3,'Барилгын жижиг хог', true),(4,'Ногоон байгууламжийн хог', true)`);

  const hash = await hashPassword(PASSWORD);
  const mk = async (name, phone, email, role, orgId, status = 'active') => {
    const id = (await q(`INSERT INTO users (full_name, phone, email, password_hash, consent_at, status) VALUES ($1,$2,$3,$4, now(), $5) RETURNING id`,
      [name, phone, email, hash, status])).rows[0].id;
    await q(`INSERT INTO user_roles (user_id, role_id, organization_id) SELECT $1, id, $2 FROM roles WHERE code = $3`, [id, orgId, role]);
    return id;
  };
  const admin = await mk('Админ (жишээ)', '90000001', 'admin@example.com', 'admin', null);
  const coord = await mk('Зохицуулагч-01', '90000002', 'coordinator@example.com', 'coordinator', org);
  const d1 = await mk('Жолооч-03', '90000003', null, 'driver', org);
  const d2 = await mk('Жолооч-05', '90000004', null, 'driver', org);
  await mk('Удирдлага (жишээ)', '90000005', 'manager@example.com', 'manager', org);
  const citizen = await mk('Иргэн-01', '99000001', 'citizen@example.com', 'citizen', null);
  const bizOrg = (await q(`INSERT INTO organizations (name, type, active) VALUES ('Жишээ ХХК', 'business', false) RETURNING id`)).rows[0].id;
  await mk('ААН-ийн төлөөлөгч (жишээ)', '99000002', 'biz@example.com', 'business', bizOrg, 'pending');

  // Хуваарь: орон сууц — даваа, пүрэв 08–12; гэр хороолол — бямба 10–14
  const from = ulDate(-30);
  for (const [zi, slots, note] of [[0, [[1, '08:00', '12:00'], [4, '08:00', '12:00']], 'Орон сууцны хуваарь'], [1, [[2, '08:00', '12:00'], [5, '08:00', '12:00']], 'Орон сууцны хуваарь'], [2, [[6, '10:00', '14:00']], 'Гэр хорооллын хуваарь']]) {
    for (const [w, a, b] of slots) await q(`INSERT INTO schedules (zone_id, weekday, time_from, time_to, valid_from, version, note, published_by) VALUES ($1,$2,$3,$4,$5,1,$6,$7)`, [zones[zi], w, a, b, from, note, coord]);
  }

  if (withSamples) {
    const C = await loadUser(citizen); const K = await loadUser(coord); const D1 = await loadUser(d1);
    const addr = (await q('SELECT id FROM addresses ORDER BY id')).rows.map(r => r.id);
    const mkReq = (a, wt, desc) => requests.submit(C, { addressId: addr[a], wasteTypeId: wt, description: desc }, null);
    const r1 = await mkReq(0, 2, 'Хуучин буйдан, 2 сандал'); // → дууссан
    const r2 = await mkReq(3, 3, 'Засварын дараах хог, 6 шуудай'); // → оноогдсон (маргааш)
    const r3 = await mkReq(5, 2, 'Хуучин хөргөгч'); // → батлагдсан
    await mkReq(6, 1, 'Баярын дараах нэмэлт хог'); // → шинэ
    const r5 = await mkReq(1, 4, 'Мөчирсөн модны мөчир'); // → татгалзсан
    await requests.decide(K, r1.id, { decision: 'approve' });
    const j1 = await jobs.assign(K, { requestId: r1.id, date: ulDate(0), timeFrom: '08:00', timeTo: '10:00', assigneeId: d1 });
    await jobs.record(D1, j1.jobId, { result: 'start' });
    await jobs.record(D1, j1.jobId, { result: 'done' });
    // Жишээ өгөгдөл: гүйцэтгэлийн цагийг интервал дотор байрлуулж, тайланд «цагтаа» харагдуулна
    await q(`UPDATE jobs SET started_at = lower(planned_window) + interval '20 min',
      finished_at = lower(planned_window) + interval '55 min' WHERE id = $1`, [j1.jobId]);
    await requests.decide(K, r2.id, { decision: 'approve' });
    await jobs.assign(K, { requestId: r2.id, date: ulDate(1), timeFrom: '10:00', timeTo: '12:00', assigneeId: d1 });
    await requests.decide(K, r3.id, { decision: 'approve' });
    await requests.decide(K, r5.id, { decision: 'reject', reason: 'Ногоон байгууламжийн хогийг тусгай хуваариар авна' });
  }
  return { admin, coord, d1, d2, citizen, zones, org };
}
module.exports = { seed, PASSWORD };
if (require.main === module) {
  seed().then(() => { console.log(`Жишээ өгөгдөл орлоо. Бүх хэрэглэгчийн нууц үг: ${PASSWORD}`); return pool.end(); })
    .catch(e => { console.error(e); process.exit(1); });
}
