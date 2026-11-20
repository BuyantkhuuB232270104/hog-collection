// UC-02 Хуваарь удирдах (FR-08, FR-09)
const { q, tx } = require('../db/pool');
const { bad, forbidden, notFound } = require('../errors');

async function listZones() {
  const { rows } = await q(`SELECT z.id, z.name, z.soum, z.bag, o.name AS organization
    FROM service_zones z JOIN organizations o ON o.id = z.organization_id ORDER BY z.soum, z.name`);
  return rows;
}

/** Тухайн огноонд хүчинтэй хамгийн сүүлийн хувилбарын хуваарь (нэвтрэлгүйгээр, 2.4–2.6) */
async function currentSchedule(zoneId, date) {
  const z = await q('SELECT id, name, soum, bag FROM service_zones WHERE id = $1', [zoneId]);
  if (!z.rowCount) throw notFound('Үйлчилгээний бүс олдсонгүй.');
  const v = await q(`SELECT max(version) AS version FROM schedules
    WHERE zone_id = $1 AND valid_from <= $2 AND (valid_to IS NULL OR valid_to >= $2)`, [zoneId, date]);
  const version = v.rows[0].version;
  if (!version) return { zone: z.rows[0], version: null, slots: [] };
  const { rows } = await q(`SELECT weekday, to_char(time_from,'HH24:MI') AS time_from, to_char(time_to,'HH24:MI') AS time_to,
      valid_from, valid_to, note FROM schedules WHERE zone_id = $1 AND version = $2 ORDER BY weekday, time_from`, [zoneId, version]);
  return { zone: z.rows[0], version, validFrom: rows[0].valid_from, validTo: rows[0].valid_to, note: rows[0].note, slots: rows };
}

/** Шинэ хувилбар нийтлэх: өмнөх хувилбарын хүчинтэй хугацааг хаана (2.1–2.3) */
async function publish(user, { zoneId, validFrom, note, slots }, coordinatorOrgs) {
  const z = await q('SELECT organization_id FROM service_zones WHERE id = $1', [zoneId]);
  if (!z.rowCount) throw notFound('Үйлчилгээний бүс олдсонгүй.');
  if (!coordinatorOrgs.includes(Number(z.rows[0].organization_id))) throw forbidden('Энэ бүсийн хуваарийг нийтлэх эрхгүй.');
  for (const s of slots) if (s.timeTo <= s.timeFrom) throw bad('BAD_TIME', 'Дуусах цаг эхлэх цагаас хойш байх ёстой.');
  return tx(async (c) => {
    const v = await c.query('SELECT COALESCE(max(version),0) + 1 AS next FROM schedules WHERE zone_id = $1', [zoneId]);
    const version = v.rows[0].next;
    await c.query(`UPDATE schedules SET valid_to = $2::date - 1
      WHERE zone_id = $1 AND (valid_to IS NULL OR valid_to >= $2::date) AND valid_from < $2::date`, [zoneId, validFrom]);
    for (const s of slots) {
      await c.query(`INSERT INTO schedules (zone_id, weekday, time_from, time_to, valid_from, version, note, published_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [zoneId, s.weekday, s.timeFrom, s.timeTo, validFrom, version, note || null, user.id]);
    }
    return { zoneId, version, validFrom };
  });
}
module.exports = { listZones, currentSchedule, publish };
